"""Authoritative match state for one room. Action methods return a rejection reason (str) or a success value."""
import asyncio
import math

from . import shared as S
from .puzzles import check_answer, generate_puzzle

IN_MATCH = {"ROLE_ASSIGNMENT", "PLAYING", "MEETING_TRANSITION", "DISCUSSION", "VOTING", "VOTE_RESULTS"}


def secs(ms: float) -> int:
    return max(1, math.ceil(ms / 1000))


def fresh_stats() -> dict:
    return {"tasksCompleted": 0, "eliminations": 0, "meetingsAttended": 0, "fakeTasks": 0, "reports": 0, "powerRepairs": 0, "votesOnAgents": 0}


def power_on() -> dict:
    return {"powerStatus": "ON", "powerRestoreAt": None, "disabledTaskIds": [], "leakEndsAt": None}


def _later(ms: float, fn, *args):
    return asyncio.get_running_loop().call_later(ms / 1000, fn, *args)


class Player:
    def __init__(self, pid: str, socket_id: str, name: str, avatar: int, is_host: bool, position: dict):
        self.id = pid
        self.socket_id = socket_id
        self.name = name
        self.avatar = avatar
        self.is_host = is_host
        self.connected = True
        self.alive = True
        self.faction = None
        self.position = dict(position)
        self.facing = "down"
        self.last_move_at = S.now_ms()
        self.last_action_at = 0
        self.last_chat_at = 0
        self.elimination_ready_at = 0
        self.open_task = None  # {taskId, openedAt, answer, fake}
        self.stats = fresh_stats()
        self.ejected = False
        self.is_bot = False
        self.death_position = None


class Match:
    def __init__(self, room_code: str):
        self.room_code = room_code
        self.state = "WAITING"
        self.phase_ends_at = None
        self.players: dict[str, Player] = {}
        self.tasks: list[dict] = []
        self.bodies: list[dict] = []
        self.sabotage = power_on()
        self.sabotage_ready_at = 0
        self.emergency_available_at = 0
        self.votes: dict[str, str] = {}
        self.meeting = None
        self.last_tally = None
        self.leak_clue = None
        self.result = None
        self._timer = None
        self._sabotage_timer = None
        self._body_seq = 0
        self.tick_task = None
        self.bot_brains: dict = {}
        self._frames: list[dict] = []
        self.on_phase_end = lambda state: None
        self.on_sabotage_ended = lambda kind: None

    # ── Views ──
    @property
    def host_id(self):
        return next((p.id for p in self.players.values() if p.is_host), None)

    @property
    def connected_players(self):
        return [p for p in self.players.values() if p.connected]

    @property
    def in_match(self):
        return self.state in IN_MATCH

    @property
    def living_players(self):
        return [p for p in self.players.values() if p.alive and p.connected]

    @property
    def completed_tasks(self):
        return sum(1 for t in self.tasks if t["status"] == "COMPLETE")

    def public_player(self, p: Player, ghost_view=False) -> dict:
        out = {
            "id": p.id, "name": p.name, "avatar": p.avatar, "isHost": p.is_host, "connected": p.connected,
            "alive": p.alive,
            "position": (p.death_position or p.position) if (not p.alive and not ghost_view) else p.position,
            "facing": p.facing,
        }
        if p.is_bot:
            out["isBot"] = True
        if (self.state == "GAME_OVER" or not p.alive) and p.faction:
            out["revealedFaction"] = p.faction
        return out

    def public_players(self, ghost_view=False):
        return [self.public_player(p, ghost_view) for p in self.players.values()]

    def view(self, ghost_view=False) -> dict:
        return {
            "roomCode": self.room_code, "state": self.state, "phaseEndsAt": self.phase_ends_at,
            "players": self.public_players(ghost_view), "tasks": self.tasks, "completedTasks": self.completed_tasks,
            "totalTasks": len(self.tasks), "bodies": self.bodies, "sabotage": self.sabotage,
            "emergencyAvailableAt": self.emergency_available_at,
        }

    # ── Replay ──
    def record_frame(self, now: int):
        if self.state != "PLAYING":
            return
        if self._frames and now - self._frames[-1]["at"] < S.REPLAY_FRAME_MS - 20:
            return
        self._frames.append({"at": now, "players": [{"id": p.id, "x": round(p.position["x"]), "y": round(p.position["y"])} for p in self.living_players]})
        keep = math.ceil(S.REPLAY_WINDOW_MS / S.REPLAY_FRAME_MS)
        if len(self._frames) > keep:
            del self._frames[: len(self._frames) - keep]

    def replay_around(self, body: dict, now: int) -> dict:
        c = body["position"]
        frames = [{"players": [q for q in f["players"] if math.hypot(q["x"] - c["x"], q["y"] - c["y"]) <= S.REPLAY_RADIUS]}
                  for f in self._frames if now - f["at"] <= S.REPLAY_WINDOW_MS]
        return {"center": c, "radius": S.REPLAY_RADIUS, "frameMs": S.REPLAY_FRAME_MS, "bodyPlayerId": body["playerId"], "frames": frames}

    # ── Lifecycle ──
    def start(self, requester_id: str):
        if self.state != "WAITING":
            return "Match already started"
        if requester_id != self.host_id:
            return "Only the host can start the match"
        ids = [p.id for p in self.connected_players]
        if len(ids) < S.MIN_PLAYERS:
            return f"Need at least {S.MIN_PLAYERS} players"
        if len(ids) > S.MAX_PLAYERS:
            return f"At most {S.MAX_PLAYERS} players"
        roles = S.assign_roles(ids)
        for i, pid in enumerate(ids):
            p = self.players[pid]
            p.faction = roles[pid]
            p.alive = True
            p.position = dict(S.SPAWN_POINTS[i % len(S.SPAWN_POINTS)])
            p.elimination_ready_at = 0
            p.open_task = None
            p.stats = fresh_stats()
            p.ejected = False
            p.death_position = None
        self.tasks = [{"taskId": sid, "type": t, "label": label, "roomId": room, "position": S.tile_center(*tile),
                       "status": "AVAILABLE", "assignedTo": None} for sid, t, label, room, tile in S.TASK_STATIONS]
        self.bodies = []
        self.votes.clear()
        self.meeting = None
        self.last_tally = None
        self.result = None
        self.leak_clue = None
        self.sabotage_ready_at = 0
        self.emergency_available_at = 0
        self.clear_sabotage()
        self.set_state("ROLE_ASSIGNMENT", S.ROLE_REVEAL_MS)
        return None

    def teammates_of(self, pid: str):
        me = self.players.get(pid)
        if not me or me.faction != "DEEP_STATE":
            return []
        return [p.id for p in self.players.values() if p.faction == "DEEP_STATE" and p.id != pid]

    def move(self, pid: str, position: dict, facing: str) -> bool:
        now = S.now_ms()
        p = self.players.get(pid)
        if not p or not p.connected or self.state != "PLAYING":
            return False
        if not (S.is_walkable(position) if p.alive else S.in_map_bounds(position)):
            return False
        dt = max(16, now - p.last_move_at)
        max_step = (S.MOVE_SPEED * dt) / 1000 + 8
        if math.hypot(position["x"] - p.position["x"], position["y"] - p.position["y"]) > max_step:
            return False
        p.position = position
        p.facing = facing
        p.last_move_at = now
        self._track_leak_sighting(p)
        return True

    def _track_leak_sighting(self, p: Player):
        ids = self.sabotage["disabledTaskIds"]
        leaked = next((t for t in self.tasks if ids and t["taskId"] == ids[0]), None)
        if leaked and p.alive and S.within_range(p.position, leaked["position"], S.INTERACTION_RANGE):
            self.leak_clue = {"taskId": leaked["taskId"], "stationLabel": leaked["label"], "playerId": p.id}

    def _actor(self, pid: str, now: int):
        p = self.players.get(pid)
        if not p or not p.connected:
            return "Not in this match"
        if not p.alive:
            return "You have been eliminated"
        if self.state == "GAME_OVER":
            return "Match is over"
        if self.state != "PLAYING":
            return "Meeting in progress"
        if now - p.last_action_at < S.ACTION_RATE_LIMIT_MS:
            return "Slow down"
        p.last_action_at = now
        return p

    def _task(self, task_id: str):
        return next((t for t in self.tasks if t["taskId"] == task_id), None)

    # ── Tasks ──
    def open_task(self, pid: str, task_id: str):
        now = S.now_ms()
        p = self._actor(pid, now)
        if isinstance(p, str):
            return p
        if task_id == S.REPAIR_TASK_ID:
            if not S.within_range(p.position, S.POWER_PANEL, S.INTERACTION_RANGE):
                return "Too far away"
            if self.sabotage["powerStatus"] != "OUT":
                return "Power is already on"
            puzzle, answer = generate_puzzle("RESTORE_POWER")
        else:
            task = self._task(task_id)
            if not task:
                return "Task unavailable"
            if not S.within_range(p.position, task["position"], S.INTERACTION_RANGE):
                return "Too far away"
            if task["status"] == "COMPLETE":
                return "Task already complete"
            if task_id in self.sabotage["disabledTaskIds"]:
                return f"Documents leaked — back in {secs((self.sabotage['leakEndsAt'] or now) - now)}s"
            puzzle, answer = generate_puzzle(task["type"])
        p.open_task = {"taskId": task_id, "openedAt": now, "answer": answer, "fake": p.faction != "GOVERNMENT"}
        return {"puzzle": puzzle}

    def close_task(self, pid: str):
        p = self.players.get(pid)
        if p:
            p.open_task = None

    def complete_task(self, pid: str, task_id: str, payload):
        now = S.now_ms()
        p = self._actor(pid, now)
        if isinstance(p, str):
            return p
        op = p.open_task
        if not op or op["taskId"] != task_id:
            return "Open the task first"
        is_repair = task_id == S.REPAIR_TASK_ID
        task = self._task(task_id)
        if not is_repair and not task:
            return "Task unavailable"
        at = S.POWER_PANEL if is_repair else task["position"]
        if not S.within_range(p.position, at, S.INTERACTION_RANGE):
            return "Too far away"
        if task and task["status"] == "COMPLETE":
            p.open_task = None
            return "Task already complete"
        if is_repair and self.sabotage["powerStatus"] != "OUT":
            p.open_task = None
            return "Power is already on"
        if op["answer"] is None:
            valid = now - op["openedAt"] >= S.HOLD_TASK_MS - S.HOLD_TOLERANCE_MS
        else:
            valid = check_answer(op["answer"], payload)
        if not valid:
            return "Keep holding" if op["answer"] is None else "Incorrect — try again"
        p.open_task = None
        if op["fake"]:
            if not is_repair:
                p.stats["fakeTasks"] += 1
            return {"progressed": False, "restored": False}
        restored = False
        if is_repair or (task["type"] == "RESTORE_POWER" and self.sabotage["powerStatus"] == "OUT"):
            self.clear_sabotage()
            restored = True
            p.stats["powerRepairs"] += 1
        if is_repair:
            return {"progressed": False, "restored": restored}
        task["status"] = "COMPLETE"
        p.stats["tasksCompleted"] += 1
        return {"progressed": True, "restored": restored}

    # ── Deep State ──
    def eliminate(self, actor_id: str, target_id: str):
        now = S.now_ms()
        p = self._actor(actor_id, now)
        if isinstance(p, str):
            return p
        if p.faction != "DEEP_STATE":
            return "Not allowed"
        target = self.players.get(target_id)
        if not target or not target.connected:
            return "No target"
        if not target.alive:
            return "Target already eliminated"
        if target.faction != "GOVERNMENT":
            return "Cannot eliminate a teammate"
        if not S.within_range(p.position, target.position, S.ELIMINATION_RANGE):
            return "Too far away"
        if now < p.elimination_ready_at:
            return f"Cooldown: {secs(p.elimination_ready_at - now)}s"
        target.alive = False
        target.open_task = None
        target.death_position = dict(target.position)
        p.elimination_ready_at = now + S.ELIMINATION_COOLDOWN_MS
        p.stats["eliminations"] += 1
        self._body_seq += 1
        body = {"bodyId": f"b{self._body_seq}", "playerId": target.id, "position": dict(target.position),
                "roomId": S.room_at(target.position), "reported": False}
        self.bodies.append(body)
        return body

    def sabotage_action(self, actor_id: str, kind, target_task_id=None):
        now = S.now_ms()
        p = self._actor(actor_id, now)
        if isinstance(p, str):
            return p
        if p.faction != "DEEP_STATE":
            return "Not allowed"
        if kind not in ("POWER_CUT", "DOCUMENT_LEAK"):
            return "Sabotage unavailable"
        leak_task = None
        if kind == "POWER_CUT":
            if not S.within_range(p.position, S.POWER_PANEL, S.INTERACTION_RANGE):
                return "Too far away"
            if self.sabotage["powerStatus"] == "OUT":
                return "Power is already out"
        else:
            leak_task = self._task(target_task_id) if isinstance(target_task_id, str) else None
            if not leak_task:
                return "Stand at a task station"
            if not S.within_range(p.position, leak_task["position"], S.INTERACTION_RANGE):
                return "Too far away"
            if leak_task["status"] == "COMPLETE":
                return "Task already complete"
        if self.sabotage_active:
            return "Sabotage already active"
        if now < self.sabotage_ready_at:
            return f"Cooldown: {secs(self.sabotage_ready_at - now)}s"

        self.sabotage_ready_at = now + S.SABOTAGE_COOLDOWN_MS
        closed_for = []
        if kind == "POWER_CUT":
            duration = S.POWER_CUT_DURATION_MS
            self.sabotage = {"powerStatus": "OUT", "powerRestoreAt": now + duration, "disabledTaskIds": [], "leakEndsAt": None}
        else:
            duration = S.DOCUMENT_LEAK_DURATION_MS
            self.sabotage = {"powerStatus": "ON", "powerRestoreAt": None, "disabledTaskIds": [leak_task["taskId"]], "leakEndsAt": now + duration}
            self.leak_clue = {"taskId": leak_task["taskId"], "stationLabel": leak_task["label"], "playerId": p.id}
            for pl in self.players.values():
                if pl.open_task and pl.open_task["taskId"] == leak_task["taskId"]:
                    pl.open_task = None
                    closed_for.append(pl.id)
        self._sabotage_timer = _later(duration, self._end_sabotage, kind)
        return {"closedFor": closed_for}

    def _end_sabotage(self, kind):
        self._sabotage_timer = None
        if not self.sabotage_active:
            return
        self.sabotage = power_on()
        self.on_sabotage_ended(kind)

    @property
    def sabotage_active(self):
        return self.sabotage["powerStatus"] == "OUT" or len(self.sabotage["disabledTaskIds"]) > 0

    def clear_sabotage(self):
        if self._sabotage_timer:
            self._sabotage_timer.cancel()
        self._sabotage_timer = None
        self.sabotage = power_on()

    def begin_play(self):
        now = S.now_ms()
        for p in self.players.values():
            if p.faction == "DEEP_STATE":
                p.elimination_ready_at = now + S.INITIAL_ELIMINATION_COOLDOWN_MS
        self.set_state("PLAYING")

    # ── Meetings & voting ──
    def report(self, pid: str, body_id: str):
        now = S.now_ms()
        p = self._actor(pid, now)
        if isinstance(p, str):
            return p
        body = next((b for b in self.bodies if b["bodyId"] == body_id), None)
        if not body:
            return "Nothing to report"
        if body["reported"]:
            return "Already reported"
        if not S.within_range(p.position, body["position"], S.REPORT_RANGE):
            return "Too far away"
        body["reported"] = True
        p.stats["reports"] += 1
        self._begin_meeting({"reason": "BODY", "callerId": p.id, "bodyId": body_id, "replay": self.replay_around(body, now)})
        return None

    def call_emergency(self, pid: str):
        now = S.now_ms()
        p = self._actor(pid, now)
        if isinstance(p, str):
            return p
        if now < self.emergency_available_at:
            return f"Cooldown: {secs(self.emergency_available_at - now)}s"
        self._begin_meeting({"reason": "EMERGENCY", "callerId": p.id})
        return None

    def _begin_meeting(self, info: dict):
        self.meeting = {**info, "clue": self.leak_clue}
        self.votes.clear()
        self.last_tally = None
        self.clear_sabotage()
        for b in self.bodies:
            b["reported"] = True
        for p in self.players.values():
            p.open_task = None
            if p.alive and p.connected:
                p.stats["meetingsAttended"] += 1
        self.set_state("MEETING_TRANSITION", S.MEETING_TRANSITION_MS)

    def vote(self, voter_id: str, choice):
        p = self.players.get(voter_id)
        if not p or not p.connected:
            return "Not in this match"
        if not p.alive:
            return "Eliminated players cannot vote"
        if self.state != "VOTING":
            return "Voting is not open"
        if voter_id in self.votes:
            return "Vote already cast"
        if choice != "SKIP":
            if choice == voter_id:
                return "You cannot vote for yourself"
            target = self.players.get(choice)
            if not target or not target.alive or not target.connected:
                return "Invalid vote"
        self.votes[voter_id] = choice
        return {"allVoted": self.all_voted()}

    def all_voted(self):
        eligible = self.living_players
        return len(eligible) > 0 and all(p.id in self.votes for p in eligible)

    def resolve_votes(self) -> dict:
        for voter_id, choice in self.votes.items():
            t = self.players.get(choice)
            if choice != "SKIP" and t and t.faction == "DEEP_STATE":
                self.players[voter_id].stats["votesOnAgents"] += 1
        counts, ejected_id = S.tally_votes(self.votes)
        ejected_faction = None
        if ejected_id:
            ej = self.players[ejected_id]
            ej.alive = False
            ej.ejected = True
            ej.death_position = dict(ej.position)
            ejected_faction = ej.faction
        self.last_tally = {"counts": counts, "ejectedPlayerId": ejected_id, "ejectedFaction": ejected_faction}
        self.set_state("VOTE_RESULTS", S.VOTE_RESULTS_MS)
        return self.last_tally

    def resume_play(self):
        now = S.now_ms()
        for i, p in enumerate(self.players.values()):
            p.position = dict(S.SPAWN_POINTS[i % len(S.SPAWN_POINTS)])
            p.last_move_at = now
        self.bodies = []
        self.votes.clear()
        self.meeting = None
        self.leak_clue = None
        self._frames = []
        self.emergency_available_at = now + S.EMERGENCY_MEETING_COOLDOWN_MS
        self.set_state("PLAYING")

    # ── Victory ──
    def finish_if_won(self):
        if not self.in_match:
            return None
        result = S.check_victory(
            [{"faction": p.faction, "alive": p.alive, "connected": p.connected} for p in self.players.values() if p.faction],
            self.completed_tasks, len(self.tasks))
        if result == "NO_WINNER":
            return None
        self.result = result
        self.clear_sabotage()
        for p in self.players.values():
            p.open_task = None
        self.set_state("GAME_OVER")
        return result

    def match_stats(self):
        return [{"playerId": p.id, "faction": p.faction, **p.stats, "alive": p.alive and p.connected, "ejected": bool(p.ejected)}
                for p in self.players.values() if p.faction]

    def mark_disconnected(self, pid: str):
        p = self.players.get(pid)
        if p:
            p.connected = False
            p.open_task = None

    def set_state(self, state: str, duration_ms=None):
        if self._timer:
            self._timer.cancel()
        self._timer = None
        self.state = state
        self.phase_ends_at = S.now_ms() + duration_ms if duration_ms else None
        if duration_ms:
            self._timer = _later(duration_ms, self.on_phase_end, state)

    def reset_to_lobby(self):
        self.set_state("WAITING")
        self.clear_sabotage()
        self.tasks = []
        self.bodies = []
        self.votes.clear()
        self.meeting = None
        self.last_tally = None
        self.result = None
        for p in self.players.values():
            p.faction = None
            p.alive = True
            p.open_task = None
            p.elimination_ready_at = 0
            p.stats = fresh_stats()

    def dispose(self):
        if self._timer:
            self._timer.cancel()
        if self.tick_task:
            self.tick_task.cancel()
        self.clear_sabotage()
