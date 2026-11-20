"""Match flow + broadcasting: phase timers, meetings, votes, victory."""
from . import shared as S
from .io import IO


def broadcast_match(io: IO, match):
    players = [p for p in match.players.values() if p.connected]
    living = [p.socket_id for p in players if p.alive or not match.in_match]
    ghosts = [p.socket_id for p in players if not p.alive and match.in_match]
    if living:
        io.emit("MATCH_STATE", match.view(False), living)
    if ghosts:
        io.emit("MATCH_STATE", match.view(True), ghosts)


def news(io: IO, match, key: str):
    io.emit("NEWS", {"key": key, "at": S.now_ms()}, IO.room(match))


def send_cooldowns(io: IO, match):
    for p in match.players.values():
        if p.faction == "DEEP_STATE" and p.connected:
            io.emit("COOLDOWN", {"eliminationReadyAt": p.elimination_ready_at, "sabotageReadyAt": match.sabotage_ready_at}, p.socket_id)


def finish_if_won(io: IO, match) -> bool:
    result = match.finish_if_won()
    if not result:
        return False
    broadcast_match(io, match)
    io.emit("GAME_OVER", {"result": result, "stats": match.match_stats()}, IO.room(match))
    news(io, match, result)
    return True


def meeting_payload(match) -> dict:
    m = match.meeting
    payload = {"reason": m["reason"], "callerId": m["callerId"], "phaseEndsAt": match.phase_ends_at or S.now_ms()}
    for k in ("bodyId", "clue", "replay"):
        if m.get(k) is not None:
            payload[k] = m[k]
    return payload


def announce_meeting(io: IO, match):
    m = match.meeting
    io.emit("MEETING_STARTED", meeting_payload(match), IO.room(match))
    news(io, match, "BODY_REPORTED" if m["reason"] == "BODY" else "MEETING_STARTED")
    broadcast_match(io, match)


def end_voting(io: IO, match):
    if match.state != "VOTING":
        return
    tally = match.resolve_votes()
    io.emit("VOTE_RESULTS", tally, IO.room(match))
    news(io, match, "PLAYER_VOTED_OUT" if tally["ejectedPlayerId"] else "NO_EJECTION")
    broadcast_match(io, match)


def interacting(io: IO, match, player_id: str, socket_id: str, task_id):
    io.emit("PLAYER_INTERACTING", {"playerId": player_id, "taskId": task_id}, IO.room(match, socket_id))


def living_socket_ids(match):
    return [p.socket_id for p in match.living_players]


def wire_match(io: IO, match):
    match.on_phase_end = lambda state: _on_phase_end(io, match, state)

    def sabotage_ended(kind):
        news(io, match, "POWER_RESTORED" if kind == "POWER_CUT" else "DOCUMENT_LEAK_CONTAINED")
        broadcast_match(io, match)

    match.on_sabotage_ended = sabotage_ended


def _on_phase_end(io: IO, match, state: str):
    if match.state != state:
        return
    if state == "ROLE_ASSIGNMENT":
        match.begin_play()
        if finish_if_won(io, match):
            return
        broadcast_match(io, match)
        send_cooldowns(io, match)
    elif state == "MEETING_TRANSITION":
        match.set_state("DISCUSSION", S.DISCUSSION_MS)
        broadcast_match(io, match)
    elif state == "DISCUSSION":
        match.set_state("VOTING", S.VOTING_MS)
        broadcast_match(io, match)
    elif state == "VOTING":
        end_voting(io, match)
    elif state == "VOTE_RESULTS":
        if finish_if_won(io, match):
            return
        match.resume_play()
        broadcast_match(io, match)
