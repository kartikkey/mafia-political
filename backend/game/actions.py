"""Validated in-match actions + broadcasts, shared by socket handlers and bots. Return a reason or None."""
import itertools
import re

from . import shared as S
from .flow import announce_meeting, broadcast_match, end_voting, finish_if_won, interacting, living_socket_ids, news, send_cooldowns
from .io import IO

_chat_seq = itertools.count(1)
_CTRL = re.compile(r"[\u0000-\u001f\u007f<>]")
_SPACE = re.compile(r"\s+")


def sanitise_chat(raw) -> str:
    if not isinstance(raw, str):
        return ""
    return _SPACE.sub(" ", _CTRL.sub("", raw)).strip()[: S.CHAT_MAX_LENGTH]


def _ghost_sockets(match, except_id=None):
    return [x.socket_id for x in match.players.values() if not x.alive and x.connected and x.id != except_id]


def act_move(io: IO, match, p, position: dict, facing: str) -> bool:
    if not match.move(p.id, position, facing):
        return False
    msg = {"playerId": p.id, "position": position, "facing": p.facing}
    if p.alive:
        io.emit("PLAYER_MOVED", msg, IO.room(match, p.socket_id))
    else:
        io.emit("PLAYER_MOVED", msg, _ghost_sockets(match, p.id))
    return True


def act_open_task(io: IO, match, p, task_id: str):
    res = match.open_task(p.id, task_id)
    if not isinstance(res, str):
        interacting(io, match, p.id, p.socket_id, task_id)
    return res


def act_complete_task(io: IO, match, p, task_id: str, payload):
    res = match.complete_task(p.id, task_id, payload)
    if not p.open_task:
        interacting(io, match, p.id, p.socket_id, None)
    if isinstance(res, str):
        return res
    if res["restored"]:
        news(io, match, "POWER_RESTORED")
        broadcast_match(io, match)
    if res["progressed"]:
        io.emit("TASK_PROGRESS", {"taskId": task_id, "completedTasks": match.completed_tasks, "totalTasks": len(match.tasks)}, IO.room(match))
        finish_if_won(io, match)
    return None


def act_eliminate(io: IO, match, p, target_id: str):
    victim = match.players.get(target_id)
    was_working = bool(victim and victim.open_task)
    body = match.eliminate(p.id, target_id)
    if isinstance(body, str):
        return body
    if was_working:
        interacting(io, match, victim.id, victim.socket_id, None)
    io.emit("PLAYER_ELIMINATED", {"body": body, "livingCount": len(match.living_players)}, IO.room(match))
    send_cooldowns(io, match)
    if not finish_if_won(io, match):
        broadcast_match(io, match)
    return None


def act_sabotage(io: IO, match, p, kind, target_task_id=None):
    res = match.sabotage_action(p.id, kind, target_task_id)
    if isinstance(res, str):
        return res
    for pid in res["closedFor"]:
        interacting(io, match, pid, match.players[pid].socket_id, None)
    news(io, match, "POWER_SABOTAGED" if kind == "POWER_CUT" else "DOCUMENT_LEAK")
    send_cooldowns(io, match)
    broadcast_match(io, match)
    return None


def act_report(io: IO, match, p, body_id: str):
    reason = match.report(p.id, body_id)
    if not reason:
        announce_meeting(io, match)
    return reason


def act_emergency(io: IO, match, p):
    reason = match.call_emergency(p.id)
    if not reason:
        announce_meeting(io, match)
    return reason


def act_vote(io: IO, match, p, choice: str):
    res = match.vote(p.id, choice)
    if isinstance(res, str):
        return res
    io.emit("VOTE_CAST", {"voterId": p.id}, IO.room(match))
    if res["allVoted"]:
        end_voting(io, match)
    return None


def act_chat(io: IO, match, p, raw):
    """Living: meeting chat for the living. Ghosts: whispers to other ghosts any time in the match."""
    ghost = not p.alive
    if not match.in_match:
        return "Chat is closed"
    if not ghost and match.state not in ("DISCUSSION", "VOTING"):
        return "Chat opens during discussion"
    text = sanitise_chat(raw)
    if not text:
        return "Message is empty"
    now = S.now_ms()
    if now - p.last_chat_at < S.CHAT_MIN_INTERVAL_MS:
        return "Slow down"
    p.last_chat_at = now
    msg = {"id": f"c{next(_chat_seq)}", "playerId": p.id, "text": text, "at": now}
    if ghost:
        msg["ghost"] = True
    io.emit("CHAT_MESSAGE", msg, _ghost_sockets(match) if ghost else living_socket_ids(match))
    return None
