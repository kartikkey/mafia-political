# NETAGIRI iteration 7: rejoinToken in acks, REJOIN after drop (grace), KICK_PLAYER, RETURN_TO_LOBBY by non-host
import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from test_netagiri_socket import C, wait_for, run  # noqa: E402


def me_in(state, pid):
    return next((p for p in state["players"] if p["id"] == pid), None)


async def make_room(n, prefix):
    cl = [C(f"{prefix}{i}") for i in range(n)]
    for c in cl:
        await c.connect()
    r = await cl[0].call("CREATE_ROOM", {"name": f"{prefix}0", "avatar": 0})
    assert r["ok"], r
    assert isinstance(r["data"].get("rejoinToken"), str) and len(r["data"]["rejoinToken"]) > 8, r
    code = r["data"]["roomCode"]
    cl[0].pid, cl[0].token = r["data"]["playerId"], r["data"]["rejoinToken"]
    for i, c in enumerate(cl[1:], 1):
        r = await c.call("JOIN_ROOM", {"roomCode": code, "name": f"{prefix}{i}", "avatar": i % 8}, wait=0.05)
        assert r["ok"], r
        assert isinstance(r["data"].get("rejoinToken"), str), r
        c.pid, c.token = r["data"]["playerId"], r["data"]["rejoinToken"]
    return code, cl


async def start(cl):
    r = await cl[0].call("START_GAME", {})
    assert r["ok"], r
    assert await wait_for(lambda: all(x.faction for x in cl), 5)
    assert await wait_for(lambda: all(x.state and x.state["state"] == "PLAYING" for x in cl), 8)


async def cleanup(cl):
    for x in cl:
        try:
            if x.sio.connected:
                await x.call("LEAVE_ROOM", {}, wait=0)
                await x.sio.disconnect()
        except Exception:
            pass


# Rejoin mid-match: reconnecting flag, wrong token, state resync, meeting resync, votes wait for away player
def test_rejoin_mid_match_and_meeting():
    async def go():
        code, cl = await make_room(6, "TESTRj")
        extra = []
        try:
            await start(cl)
            x = cl[2]
            faction, pid, token = x.faction, x.pid, x.token
            await x.sio.disconnect()
            obs = cl[0]
            assert await wait_for(lambda: (me_in(obs.state, pid) or {}).get("reconnecting") is True, 5), me_in(obs.state, pid)
            p = me_in(obs.state, pid)
            assert p["connected"] is True and p["alive"] is True, p

            # new socket, wrong token
            n = C("TESTRjNew"); n.pid = pid; extra.append(n)
            await n.connect()
            r = await n.call("REJOIN", {"roomCode": code, "playerId": pid, "token": "nope"})
            assert r == {"ok": False, "reason": "Session expired"}, r
            r = await n.call("REJOIN", {"roomCode": code, "playerId": pid})
            assert r == {"ok": False, "reason": "Session expired"}, r
            # correct token (lowercase room code too)
            t0 = time.time()
            r = await n.call("REJOIN", {"roomCode": code.lower(), "playerId": pid, "token": token})
            assert r["ok"], r
            assert r["data"]["name"] == "TESTRj2" and r["data"]["avatar"] == 2 and r["data"]["playerId"] == pid, r
            assert await wait_for(lambda: n.got("MATCH_STATE", t0) and n.got("ROLE_ASSIGNED", t0), 4)
            assert n.faction == faction
            if faction == "DEEP_STATE":
                assert await wait_for(lambda: n.got("COOLDOWN", t0), 3), "no COOLDOWN for deep state"
            assert await wait_for(lambda: "reconnecting" not in me_in(obs.state, pid), 4), me_in(obs.state, pid)
            # move works
            pos = dict(me_in(n.state, pid)["position"])
            n.pos = pos
            t1 = time.time()
            newpos = {"x": pos["x"] + 4, "y": pos["y"]}
            await n.sio.emit("PLAYER_MOVED", {"position": newpos, "facing": "right"})
            assert await wait_for(lambda: any(d["playerId"] == pid for d in obs.got("PLAYER_MOVED", t1)), 3), "move not broadcast"
            assert not any(d["playerId"] == pid for d in n.got("PLAYER_MOVED", t1)), "snap-back after rejoin"

            # old token reuse from yet another socket -> steals seat? (token still valid) ensure old n gets nothing harmful
            # ── Meeting: emergency then drop during DISCUSSION and rejoin
            r = await cl[0].call("EMERGENCY_MEETING", {})
            assert r["ok"], r
            assert await wait_for(lambda: obs.state["state"] == "DISCUSSION", 5), obs.state["state"]
            await n.sio.disconnect()
            assert await wait_for(lambda: (me_in(obs.state, pid) or {}).get("reconnecting") is True, 5)
            n2 = C("TESTRjNew2"); n2.pid = pid; extra.append(n2)
            await n2.connect()
            t2 = time.time()
            r = await n2.call("REJOIN", {"roomCode": code, "playerId": pid, "token": token})
            assert r["ok"], r
            assert await wait_for(lambda: n2.got("MEETING_STARTED", t2), 3), "no MEETING_STARTED on rejoin in DISCUSSION"
            # drop again, wait for VOTING, others vote; voting must NOT end early
            assert await wait_for(lambda: obs.state["state"] == "VOTING", 50), obs.state["state"]
            await n2.sio.disconnect()
            assert await wait_for(lambda: (me_in(obs.state, pid) or {}).get("reconnecting") is True, 5)
            others = [c for c in cl if c is not x]
            for c in others:
                r = await c.call("VOTE_SUBMITTED", {"choice": "SKIP"}, wait=0.05)
                assert r["ok"], r
            await asyncio.sleep(1.0)
            assert obs.state["state"] == "VOTING", f"voting ended early without away player: {obs.state['state']}"
            assert not obs.got("VOTE_RESULTS"), "VOTE_RESULTS before away player voted"
            n3 = C("TESTRjNew3"); n3.pid = pid; extra.append(n3)
            await n3.connect()
            t3 = time.time()
            r = await n3.call("REJOIN", {"roomCode": code, "playerId": pid, "token": token})
            assert r["ok"], r
            assert await wait_for(lambda: n3.got("MEETING_STARTED", t3), 3)
            assert await wait_for(lambda: len(n3.got("VOTE_CAST", t3)) == 5, 3), n3.got("VOTE_CAST", t3)
            r = await n3.call("VOTE_SUBMITTED", {"choice": "SKIP"})
            assert r["ok"], r
            assert await wait_for(lambda: obs.got("VOTE_RESULTS"), 3), "no results after last vote"
        finally:
            await cleanup(cl + extra)
    run(go())


# Grace expiry: after 30s the player is treated as left and REJOIN fails
def test_grace_expiry():
    async def go():
        code, cl = await make_room(7, "TESTGr")
        extra = []
        try:
            await start(cl)
            # drop a government player so the match keeps going
            x = next(c for c in cl[1:] if c.faction != "DEEP_STATE")
            await x.sio.disconnect()
            obs = cl[0]
            assert await wait_for(lambda: (me_in(obs.state, x.pid) or {}).get("reconnecting") is True, 5)
            assert await wait_for(lambda: me_in(obs.state, x.pid)["connected"] is False, 36), me_in(obs.state, x.pid)
            assert "reconnecting" not in me_in(obs.state, x.pid)
            assert obs.got("PLAYER_LEFT") and obs.got("PLAYER_LEFT")[-1]["playerId"] == x.pid
            n = C("TESTGrNew"); extra.append(n)
            await n.connect()
            r = await n.call("REJOIN", {"roomCode": code, "playerId": x.pid, "token": x.token})
            assert r == {"ok": False, "reason": "Session expired"}, r
        finally:
            await cleanup(cl + extra)
    run(go())


# Lobby disconnect removes immediately; KICK_PLAYER validation & flow; kicked can rejoin
def test_lobby_disconnect_and_kick():
    async def go():
        code, cl = await make_room(4, "TESTKk")
        h, g, k, d = cl
        try:
            r = await h.call("ADD_BOTS", {})
            assert r["ok"], r
            await asyncio.sleep(0.4)
            await d.sio.disconnect()
            assert await wait_for(lambda: d.pid not in [p["id"] for p in g.got("LOBBY_UPDATED")[-1]["players"]], 4)
            # REJOIN in lobby after removal -> Session expired
            n = C("TESTKkNew"); cl.append(n)
            await n.connect()
            r = await n.call("REJOIN", {"roomCode": code, "playerId": d.pid, "token": d.token})
            assert r == {"ok": False, "reason": "Session expired"}, r
            lob = g.got("LOBBY_UPDATED")[-1]
            bot = next(p for p in lob["players"] if p.get("isBot"))
            r = await g.call("KICK_PLAYER", {"playerId": k.pid})
            assert r == {"ok": False, "reason": "Only the host can remove players"}, r
            r = await h.call("KICK_PLAYER", {"playerId": h.pid})
            assert r == {"ok": False, "reason": "You cannot remove yourself"}, r
            r = await h.call("KICK_PLAYER", {"playerId": bot["id"]})
            assert r == {"ok": False, "reason": "No such player"}, r
            r = await h.call("KICK_PLAYER", {})
            assert r == {"ok": False, "reason": "No such player"}, r
            r = await n.call("KICK_PLAYER", {"playerId": k.pid})
            assert r == {"ok": False, "reason": "Not in a lobby"}, r
            t0 = time.time()
            r = await h.call("KICK_PLAYER", {"playerId": k.pid})
            assert r["ok"], r
            assert await wait_for(lambda: k.got("KICKED", t0), 3), "no KICKED"
            assert k.got("KICKED", t0)[0]["reason"] == "The host removed you from the lobby"
            assert await wait_for(lambda: g.got("LOBBY_UPDATED", t0) and k.pid not in [p["id"] for p in g.got("LOBBY_UPDATED", t0)[-1]["players"]], 3)
            # kicked socket no longer in room
            r = await k.call("SET_AVATAR", {"avatar": 3})
            assert r == {"ok": False, "reason": "Not in a lobby"}, r
            # rejoin with same name (room full with bots -> bot replaced)
            r = await k.call("JOIN_ROOM", {"roomCode": code, "name": "TESTKk2", "avatar": 2})
            assert r["ok"], r
            assert r["data"]["playerId"] != k.pid
            k.pid = r["data"]["playerId"]
            assert await wait_for(lambda: k.pid in [p["id"] for p in g.got("LOBBY_UPDATED")[-1]["players"]], 3)
            # in-match kick refused
            r = await h.call("ADD_BOTS", {})
            assert r["ok"], r
            r = await h.call("START_GAME", {})
            assert r["ok"], r
            await asyncio.sleep(0.5)
            r = await h.call("KICK_PLAYER", {"playerId": g.pid})
            assert r == {"ok": False, "reason": "Not in a lobby"}, r
        finally:
            await cleanup(cl)
    run(go())


# GAME_OVER: JOIN_ROOM refused; non-host RETURN_TO_LOBBY returns everyone to the same lobby
def test_return_to_lobby_non_host():
    async def go():
        code, cl = await make_room(6, "TESTRl")
        extra = []
        try:
            r = await cl[0].call("RETURN_TO_LOBBY", {})
            assert r == {"ok": False, "reason": "Match still in progress"}, r
            await start(cl)
            deep = [c for c in cl if c.faction == "DEEP_STATE"]
            gov = [c for c in cl if c.faction != "DEEP_STATE"]
            for c in deep:
                await c.call("LEAVE_ROOM", {}, wait=0.05)
            obs = gov[0]
            assert await wait_for(lambda: obs.got("GAME_OVER"), 5), "no GAME_OVER"
            n = C("TESTRlNew"); extra.append(n)
            await n.connect()
            r = await n.call("JOIN_ROOM", {"roomCode": code, "name": "TESTRlNew", "avatar": 1})
            assert r == {"ok": False, "reason": "This match just ended — try again once the group is back in the lobby"}, r
            nonhost = next(c for c in gov if c.pid != (obs.state or {}).get("hostId") and not any(p["id"] == c.pid and p["isHost"] for p in obs.state["players"]))
            t0 = time.time()
            r = await nonhost.call("RETURN_TO_LOBBY", {})
            assert r["ok"], r
            for c in gov:
                assert await wait_for(lambda: c.got("LOBBY_UPDATED", t0), 3), c.name
            lob = obs.got("LOBBY_UPDATED", t0)[-1]
            assert lob["roomCode"] == code
            ids = {p["id"] for p in lob["players"]}
            assert ids == {c.pid for c in gov}, (ids, [c.pid for c in gov])
            assert lob["hostId"] in ids
            r = await n.call("JOIN_ROOM", {"roomCode": code, "name": "TESTRlNew", "avatar": 1})
            assert r["ok"], r
        finally:
            await cleanup(cl + extra)
    run(go())
