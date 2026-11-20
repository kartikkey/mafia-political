"""Computer-controlled players. They act only through actions.py, so the server validates them like humans."""
import math
import random
from collections import deque
from dataclasses import dataclass, field

from . import shared as S
from .actions import act_chat, act_complete_task, act_eliminate, act_move, act_open_task, act_report, act_sabotage, act_vote

SIGHT_RANGE = 200
KILL_CHANCE_PER_TICK = 0.12
LINES = [
    "I was doing my tasks in the {room}.",
    "Not me — I was nowhere near there.",
    "Someone was acting shifty near the Central Hall.",
    "Skip unless we have proof.",
    "I saw {name} wandering alone.",
]


@dataclass
class Brain:
    path: list = field(default_factory=list)
    goal_task_id: str | None = None
    work_until: float = 0
    idle_until: float = 0
    vote_at: float | None = None
    chat_at: float | None = None


def _brain(match, pid: str) -> Brain:
    if pid not in match.bot_brains:
        match.bot_brains[pid] = Brain()
    return match.bot_brains[pid]


def _rand(a: float, b: float) -> float:
    return a + random.random() * (b - a)


def _tile(p: dict):
    return math.floor(p["x"] / S.TILE_SIZE), math.floor(p["y"] / S.TILE_SIZE)


def find_path(start: dict, goal: dict) -> list:
    """BFS over walkable tiles; tile-centre waypoints excluding the start."""
    s, g = _tile(start), _tile(goal)
    prev = {s: None}
    q = deque([s])
    while q:
        c = q.popleft()
        if c == g:
            break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c[0] + dx, c[1] + dy)
            if S.is_solid_tile(*n) or n in prev:
                continue
            prev[n] = c
            q.append(n)
    if g not in prev:
        return []
    out = []
    k = g
    while k is not None and k != s:
        out.append(S.tile_center(*k))
        k = prev[k]
    out.reverse()
    return out


def _step(io, match, bot, brain: Brain, dt_ms: float):
    if not brain.path:
        return
    nxt = brain.path[0]
    dx, dy = nxt["x"] - bot.position["x"], nxt["y"] - bot.position["y"]
    dist = math.hypot(dx, dy)
    mx = (S.MOVE_SPEED * dt_ms) / 1000
    pos = dict(nxt) if dist <= mx else {"x": bot.position["x"] + dx / dist * mx, "y": bot.position["y"] + dy / dist * mx}
    facing = ("right" if dx > 0 else "left") if abs(dx) > abs(dy) else ("down" if dy > 0 else "up")
    if not act_move(io, match, bot, pos, facing):
        brain.path = []
    elif dist <= mx:
        brain.path.pop(0)


def _play_turn(io, match, bot, now: int, dt_ms: float):
    brain = _brain(match, bot.id)
    deep = bot.faction == "DEEP_STATE"
    living = match.living_players

    body = next((b for b in match.bodies if not b["reported"] and S.within_range(bot.position, b["position"], S.REPORT_RANGE)), None)
    if body and (not deep or random.random() < 0.004):
        act_report(io, match, bot, body["bodyId"])
        return

    seen = None if deep else next((b for b in match.bodies if not b["reported"] and S.within_range(bot.position, b["position"], SIGHT_RANGE)), None)
    if seen and not bot.open_task:
        if brain.goal_task_id != f"body:{seen['bodyId']}":
            brain.goal_task_id = f"body:{seen['bodyId']}"
            brain.path = find_path(bot.position, seen["position"])
        _step(io, match, bot, brain, dt_ms)
        return

    if deep and now >= bot.elimination_ready_at and random.random() < KILL_CHANCE_PER_TICK:
        target = next((p for p in living if p.faction == "GOVERNMENT"
                       and S.within_range(bot.position, p.position, S.ELIMINATION_RANGE)
                       and not any(w.id not in (p.id, bot.id) and w.faction == "GOVERNMENT" and S.within_range(w.position, p.position, 160) for w in living)), None)
        if target and not act_eliminate(io, match, bot, target.id):
            return

    if bot.open_task:
        if now >= brain.work_until:
            ans = bot.open_task["answer"]
            act_complete_task(io, match, bot, bot.open_task["taskId"], ans if ans is not None else {"held": True})
            brain.goal_task_id = None
            brain.idle_until = now + _rand(1500, 4000)
        return
    if now < brain.idle_until:
        return

    disabled = match.sabotage["disabledTaskIds"]
    goal = next((t for t in match.tasks if t["taskId"] == brain.goal_task_id), None)
    if goal and goal["status"] != "COMPLETE" and S.within_range(bot.position, goal["position"], S.INTERACTION_RANGE - 8):
        if deep and random.random() < 0.15:
            act_sabotage(io, match, bot, "DOCUMENT_LEAK", goal["taskId"])
        elif not isinstance(act_open_task(io, match, bot, goal["taskId"]), str):
            brain.work_until = now + _rand(5000, 9000)
        brain.path = []
        return
    if not goal or goal["status"] == "COMPLETE" or goal["taskId"] in disabled or not brain.path:
        open_tasks = [t for t in match.tasks if t["status"] != "COMPLETE" and t["taskId"] not in disabled]
        choice = random.choice(open_tasks) if open_tasks else None
        brain.goal_task_id = choice["taskId"] if choice else None
        brain.path = find_path(bot.position, choice["position"]) if choice else []
        if deep and random.random() < 0.35:
            prey = [p for p in living if p.faction == "GOVERNMENT"]
            if prey:
                brain.path = find_path(bot.position, random.choice(prey).position)
    _step(io, match, bot, brain, dt_ms)


def _meeting_turn(io, match, bot, now: int):
    brain = _brain(match, bot.id)
    others = [p for p in match.living_players if p.id != bot.id]
    if match.state == "DISCUSSION":
        brain.vote_at = None
        if brain.chat_at is None:
            brain.chat_at = now + _rand(3000, 25000) if random.random() < 0.6 else math.inf
        if now >= brain.chat_at:
            brain.chat_at = math.inf
            task = next((t for t in match.tasks if t["taskId"] == brain.goal_task_id), None)
            room = task["roomId"].replace("_", " ", 1).lower() if task else "corridor"
            name = random.choice(others).name if others else "someone"
            act_chat(io, match, bot, random.choice(LINES).replace("{room}", room).replace("{name}", name))
    if match.state == "VOTING" and bot.id not in match.votes:
        if brain.vote_at is None:
            brain.vote_at = now + _rand(2500, 12000)
        if now < brain.vote_at:
            return
        clue = (match.meeting or {}).get("clue") or {}
        clue_id = clue.get("playerId")
        choice = "SKIP"
        if bot.faction == "GOVERNMENT":
            if clue_id and clue_id != bot.id and any(p.id == clue_id for p in others) and random.random() < 0.6:
                choice = clue_id
            elif random.random() < 0.4 and others:
                choice = random.choice(others).id
        elif random.random() < 0.3:
            gov = [p for p in others if p.faction == "GOVERNMENT"]
            choice = random.choice(gov).id if gov else "SKIP"
        act_vote(io, match, bot, choice)
    if match.state in ("VOTE_RESULTS", "MEETING_TRANSITION"):
        brain.chat_at = None


def run_bots(io, match, now: int, dt_ms: float):
    for bot in list(match.players.values()):
        if not bot.is_bot or not bot.alive or not bot.connected:
            continue
        if match.state == "PLAYING":
            _play_turn(io, match, bot, now, dt_ms)
        else:
            _meeting_turn(io, match, bot, now)
        if match.state == "GAME_OVER":
            return


def forget_bots(match):
    match.bot_brains.clear()
