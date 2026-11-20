"""NETAGIRI game server: FastAPI + Socket.IO (path /api/socket.io). All game state is in memory."""
import asyncio
import logging
import math
import os
import secrets
from pathlib import Path

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI

from game import shared as S
from game.actions import act_chat, act_complete_task, act_eliminate, act_emergency, act_move, act_open_task, act_report, act_sabotage, act_vote
from game.bots import forget_bots, run_bots
from game.flow import broadcast_match, end_voting, finish_if_won, interacting, meeting_payload, wire_match
from game.io import IO
from game.rooms import RoomManager, sanitise_name

load_dotenv(Path(__file__).parent / ".env")
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("netagiri")

origins = os.environ["CORS_ORIGINS"]
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*" if origins == "*" else origins.split(","))
io = IO(sio)
rooms = RoomManager()

api = FastAPI()


@api.get("/api/health")
@api.get("/health")
async def health():
    return {"ok": True}


app = socketio.ASGIApp(sio, other_asgi_app=api, socketio_path="api/socket.io")


def fail(reason: str):
    return {"ok": False, "reason": reason}


def ok(data=None):
    return {"ok": True, "data": data}


def done(reason):
    return fail(reason) if reason else ok()


def on(event: str):
    """Register a handler taking (sid, payload); its return value is the ack."""
    def deco(fn):
        async def handler(sid, *args):
            payload = args[0] if args and isinstance(args[0], dict) else {}
            try:
                return fn(sid, payload)
            except Exception:
                log.exception("handler %s failed", event)
                return fail("Server error")
        sio.on(event, handler)
        return fn
    return deco


def valid_avatar(a) -> int:
    if isinstance(a, bool) or not isinstance(a, (int, float)) or not float(a).is_integer():
        return 0
    return int(a) if 0 <= a < 8 else 0


def push_lobby(match):
    io.emit("LOBBY_UPDATED", rooms.lobby_view(match), IO.room(match))


def send_roles(match):
    for p in match.players.values():
        if p.faction and p.connected:
            io.emit("ROLE_ASSIGNED", {"faction": p.faction, "teammateIds": match.teammates_of(p.id)}, p.socket_id)


async def ticker(match):
    """Per-room tick: records replay frames and drives computer players."""
    last = S.now_ms()
    while True:
        await asyncio.sleep(S.BOT_TICK_MS / 1000)
        now = S.now_ms()
        try:
            match.record_frame(now)
            if match.in_match:
                run_bots(io, match, now, now - last)
        except Exception:
            log.exception("tick failed in %s", match.room_code)
        last = now


def leave(sid: str):
    res = rooms.leave(sid)
    if res:
        after_leave(*res)


def after_leave(match, player_id: str, closed: bool):
    if closed:
        return
    p = match.players.get(player_id)
    io.emit("PLAYER_LEFT", {"playerId": player_id}, IO.room(match))
    if match.state == "WAITING":
        return push_lobby(match)
    if match.state == "PLAYING" and p:
        interacting(io, match, player_id, p.socket_id, None)
    if finish_if_won(io, match):
        return
    broadcast_match(io, match)
    if match.state == "VOTING" and match.all_voted():
        end_voting(io, match)


def start_grace(match, player):
    """Dropped mid-match: the character stays (and can be eliminated) until the grace period ends."""
    rooms.sockets.pop(player.socket_id, None)
    player.socket_id = f"away:{player.id}"
    player.away = True
    if player.open_task:
        match.close_task(player.id)
        interacting(io, match, player.id, player.socket_id, None)
    player.away_handle = asyncio.get_running_loop().call_later(S.REJOIN_GRACE_MS / 1000, expire_grace, match, player.id)
    broadcast_match(io, match)


def expire_grace(match, player_id: str):
    p = match.players.get(player_id)
    if rooms.rooms.get(match.room_code) is not match or not p or not p.away:
        return
    try:
        after_leave(*rooms.leave_player(match, p))
    except Exception:
        log.exception("grace expiry failed")


def sync_rejoined(match, p):
    """Bring a rejoined client back to the current phase."""
    sid = p.socket_id
    if match.state == "WAITING":
        return push_lobby(match)
    broadcast_match(io, match)
    if p.faction:
        io.emit("ROLE_ASSIGNED", {"faction": p.faction, "teammateIds": match.teammates_of(p.id)}, sid)
    if p.faction == "DEEP_STATE":
        io.emit("COOLDOWN", {"eliminationReadyAt": p.elimination_ready_at, "sabotageReadyAt": match.sabotage_ready_at}, sid)
    if match.meeting and match.state in ("MEETING_TRANSITION", "DISCUSSION", "VOTING", "VOTE_RESULTS"):
        io.emit("MEETING_STARTED", meeting_payload(match), sid)
        for voter in match.votes:
            io.emit("VOTE_CAST", {"voterId": voter}, sid)
        if match.state == "VOTE_RESULTS" and match.last_tally:
            io.emit("VOTE_RESULTS", match.last_tally, sid)
    if match.state == "GAME_OVER" and match.result:
        io.emit("GAME_OVER", {"result": match.result, "stats": match.match_stats()}, sid)


# ── Lobby ──
@on("CREATE_ROOM")
def create_room(sid, p):
    name = sanitise_name(p.get("name"))
    if not name:
        return fail("Name must be 2–16 letters or numbers")
    leave(sid)
    match, player = rooms.create(sid, name, valid_avatar(p.get("avatar")))
    wire_match(io, match)
    match.tick_task = asyncio.get_running_loop().create_task(ticker(match))
    push_lobby(match)
    return ok({"roomCode": match.room_code, "playerId": player.id, "rejoinToken": player.token})


@on("JOIN_ROOM")
def join_room(sid, p):
    name = sanitise_name(p.get("name"))
    if not name:
        return fail("Name must be 2–16 letters or numbers")
    code = p.get("roomCode")
    if not isinstance(code, str):
        return fail("Enter a room code")
    leave(sid)
    res = rooms.join(sid, code.strip(), name, valid_avatar(p.get("avatar")))
    if isinstance(res, str):
        return fail(res)
    match, player = res
    io.emit("PLAYER_JOINED", match.public_player(player), IO.room(match))
    push_lobby(match)
    return ok({"roomCode": match.room_code, "playerId": player.id, "rejoinToken": player.token})


@on("REJOIN")
def rejoin(sid, p):
    code, pid, token = p.get("roomCode"), p.get("playerId"), p.get("token")
    if not all(isinstance(v, str) for v in (code, pid, token)):
        return fail("Session expired")
    match = rooms.get(code)
    player = match.players.get(pid) if match else None
    if not player or player.is_bot or not player.connected or not secrets.compare_digest(player.token, token):
        return fail("Session expired")
    current = rooms.by_socket(sid)
    if current and current[1] is not player:
        leave(sid)
    rooms.rebind(match, player, sid)
    sync_rejoined(match, player)
    return ok({"roomCode": match.room_code, "playerId": player.id, "name": player.name, "avatar": player.avatar})


@on("KICK_PLAYER")
def kick_player(sid, p):
    ref = rooms.by_socket(sid)
    if not ref or ref[0].state != "WAITING":
        return fail("Not in a lobby")
    match, host = ref
    if not host.is_host:
        return fail("Only the host can remove players")
    target = match.players.get(str(p.get("playerId") or ""))
    if not target or target.is_bot:
        return fail("No such player")
    if target.id == host.id:
        return fail("You cannot remove yourself")
    rooms.kick(match, target.id)
    io.emit("KICKED", {"reason": "The host removed you from the lobby"}, target.socket_id)
    io.emit("PLAYER_LEFT", {"playerId": target.id}, IO.room(match))
    push_lobby(match)
    return ok()


@on("SET_AVATAR")
def set_avatar(sid, p):
    ref = rooms.by_socket(sid)
    if not ref or ref[0].state != "WAITING":
        return fail("Not in a lobby")
    ref[1].avatar = valid_avatar(p.get("avatar"))
    push_lobby(ref[0])
    return ok()


@on("START_GAME")
def start_game(sid, _p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    match, player = ref
    reason = match.start(player.id)
    if reason:
        return fail(reason)
    io.emit("GAME_STARTED", match.view(), IO.room(match))
    send_roles(match)
    return ok()


@on("ADD_BOTS")
def add_bots(sid, _p):
    ref = rooms.by_socket(sid)
    if not ref or ref[0].state != "WAITING":
        return fail("Not in a lobby")
    if not ref[1].is_host:
        return fail("Only the host can add computer players")
    if rooms.add_bots(ref[0]) == 0:
        return fail("Lobby already has enough players")
    push_lobby(ref[0])
    return ok()


@on("REMOVE_BOTS")
def remove_bots(sid, _p):
    ref = rooms.by_socket(sid)
    if not ref or ref[0].state != "WAITING":
        return fail("Not in a lobby")
    if not ref[1].is_host:
        return fail("Only the host can remove computer players")
    for pl in list(ref[0].players.values()):
        if pl.is_bot:
            rooms.remove_bot(ref[0], pl.id)
    push_lobby(ref[0])
    return ok()


@on("REMOVE_BOT")
def remove_bot(sid, p):
    ref = rooms.by_socket(sid)
    if not ref or ref[0].state != "WAITING":
        return fail("Not in a lobby")
    if not ref[1].is_host:
        return fail("Only the host can remove computer players")
    target = ref[0].players.get(str(p.get("playerId") or ""))
    if not target or not target.is_bot:
        return fail("No such computer player")
    rooms.remove_bot(ref[0], target.id)
    push_lobby(ref[0])
    return ok()


@on("RETURN_TO_LOBBY")
def return_to_lobby(sid, _p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    match, player = ref
    if match.state != "GAME_OVER":
        return fail("Match still in progress")
    for pid in [k for k, v in match.players.items() if not v.connected or v.away]:
        if match.players[pid].away_handle:
            match.players[pid].away_handle.cancel()
        rooms.sockets.pop(match.players[pid].socket_id, None)
        del match.players[pid]
    if not match.host_id:
        nxt = next((x for x in match.players.values() if not x.is_bot), None)
        if nxt:
            nxt.is_host = True
    forget_bots(match)
    match.reset_to_lobby()
    push_lobby(match)
    broadcast_match(io, match)
    return ok()


@on("LEAVE_ROOM")
def leave_room(sid, _p):
    leave(sid)


@sio.on("disconnect")
async def disconnect(sid, *args):
    try:
        ref = rooms.by_socket(sid)
        if ref and ref[0].in_match and not ref[1].is_bot:
            start_grace(*ref)
        else:
            leave(sid)
    except Exception:
        log.exception("disconnect cleanup failed")


# ── In match ──
@on("TIME_SYNC")
def time_sync(sid, _p):
    return ok({"serverNow": S.now_ms()})


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


@on("PLAYER_MOVED")
def player_moved(sid, p):
    ref = rooms.by_socket(sid)
    pos = p.get("position")
    if not ref or not isinstance(pos, dict):
        return
    match, player = ref
    position = {"x": pos.get("x"), "y": pos.get("y")}
    facing = p.get("facing") if p.get("facing") in ("up", "down", "left", "right") else "down"
    if not (_num(position["x"]) and _num(position["y"])) or not act_move(io, match, player, position, facing):
        io.emit("PLAYER_MOVED", {"playerId": player.id, "position": player.position, "facing": player.facing}, sid)


@on("TASK_OPENED")
def task_opened(sid, p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    res = act_open_task(io, ref[0], ref[1], str(p.get("taskId") or ""))
    return fail(res) if isinstance(res, str) else ok({"puzzle": res["puzzle"]})


@on("TASK_CLOSED")
def task_closed(sid, _p):
    ref = rooms.by_socket(sid)
    if not ref or not ref[1].open_task:
        return
    ref[0].close_task(ref[1].id)
    interacting(io, ref[0], ref[1].id, sid, None)


@on("TASK_COMPLETED")
def task_completed(sid, p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    return done(act_complete_task(io, ref[0], ref[1], str(p.get("taskId") or ""), p.get("payload")))


@on("PLAYER_ELIMINATE_REQUEST")
def eliminate(sid, p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    return done(act_eliminate(io, ref[0], ref[1], str(p.get("targetId") or "")))


@on("SABOTAGE_REQUEST")
def sabotage(sid, p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    return done(act_sabotage(io, ref[0], ref[1], p.get("type"), p.get("targetTaskId")))


@on("BODY_REPORTED")
def body_reported(sid, p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    return done(act_report(io, ref[0], ref[1], str(p.get("bodyId") or "")))


@on("EMERGENCY_MEETING")
def emergency(sid, _p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    return done(act_emergency(io, ref[0], ref[1]))


@on("CHAT_SEND")
def chat_send(sid, p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    return done(act_chat(io, ref[0], ref[1], p.get("text")))


@on("VOTE_SUBMITTED")
def vote_submitted(sid, p):
    ref = rooms.by_socket(sid)
    if not ref:
        return fail("Not in a room")
    return done(act_vote(io, ref[0], ref[1], str(p.get("choice") or "")))
