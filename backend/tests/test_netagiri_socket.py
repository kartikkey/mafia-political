# NETAGIRI Python port regression: health + Socket.IO lobby + full 6-human match flow (via external URL)
import asyncio
import math
import os
import sys
import time

import pytest
import requests
import socketio

sys.path.insert(0, "/app/backend")
from game import shared as S  # noqa: E402
from game.bots import find_path  # noqa: E402


def _base():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip()
    return url.rstrip("/")


BASE_URL = _base()


class C:
    """Async socket client wrapper recording all events."""

    def __init__(self, name):
        self.name = name
        self.sio = socketio.AsyncClient(reconnection=False)
        self.events = []
        self.pid = None
        self.pos = None
        self.faction = None
        self.team = []
        self.state = None

        @self.sio.on("*")
        async def any_event(ev, data=None):
            self.events.append((time.time(), ev, data))
            if ev in ("MATCH_STATE", "GAME_STARTED"):
                self.state = data
                me = next((p for p in data["players"] if p["id"] == self.pid), None)
                if me and ev == "GAME_STARTED":
                    self.pos = dict(me["position"])
            if ev == "ROLE_ASSIGNED":
                self.faction, self.team = data["faction"], data["teammateIds"]
            if ev == "PLAYER_MOVED" and data["playerId"] == self.pid:
                self.pos = dict(data["position"])  # snap-back

    async def connect(self):
        await self.sio.connect(BASE_URL, socketio_path="/api/socket.io", transports=["websocket"])

    async def call(self, ev, data=None, wait=0.25):
        await asyncio.sleep(wait)
        if data is None:
            return await self.sio.call(ev, timeout=6)
        return await self.sio.call(ev, data, timeout=6)

    def got(self, ev, since=0):
        return [d for t, ev2, d in self.events if ev2 == ev and t >= since]

    async def walk(self, target):
        pts = find_path(self.pos, target) + [dict(target)]
        for wp in pts:
            while True:
                dx, dy = wp["x"] - self.pos["x"], wp["y"] - self.pos["y"]
                d = math.hypot(dx, dy)
                if d < 0.5:
                    break
                step = min(8, d)
                self.pos = {"x": self.pos["x"] + dx / d * step, "y": self.pos["y"] + dy / d * step}
                await self.sio.emit("PLAYER_MOVED", {"position": self.pos, "facing": "down"})
                await asyncio.sleep(0.06)
        await asyncio.sleep(0.2)


async def wait_for(cond, timeout=10, step=0.1):
    end = time.time() + timeout
    while time.time() < end:
        if cond():
            return True
        await asyncio.sleep(step)
    return False


def run(coro):
    return asyncio.run(coro)


# ── Health ──
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200 and r.json() == {"ok": True}


# ── Lobby validation, join errors, host hand-off, ack vs broadcast ordering ──
def test_lobby_flow():
    async def go():
        a, b, c = C("TEST_A"), C("TEST_B"), C("TEST_C")
        for x in (a, b, c):
            await x.connect()
        try:
            r = await a.call("CREATE_ROOM", {"name": "x", "avatar": 0})
            assert r == {"ok": False, "reason": "Name must be 2–16 letters or numbers"}
            r = await a.call("CREATE_ROOM", {"name": "<>", "avatar": 0})
            assert r["ok"] is False
            r = await a.call("CREATE_ROOM", {"name": "TEST_Host", "avatar": 3})
            assert r["ok"] is True and len(r["data"]["roomCode"]) == 5 and isinstance(r["data"]["playerId"], str)
            code, host_id = r["data"]["roomCode"], r["data"]["playerId"]
            assert await wait_for(lambda: a.got("LOBBY_UPDATED"), 3), "no LOBBY_UPDATED after create"
            lv = a.got("LOBBY_UPDATED")[-1]
            assert lv["hostId"] == host_id and lv["minPlayers"] == 6 and lv["maxPlayers"] == 10
            assert lv["players"][0]["avatar"] == 3 and lv["players"][0]["isHost"] is True and "isBot" not in lv["players"][0]

            assert (await b.call("JOIN_ROOM", {"roomCode": "ZZZZZ", "name": "TEST_B", "avatar": 0}))["reason"] == "Room not found"
            assert (await b.call("JOIN_ROOM", {"roomCode": code, "name": "test_host", "avatar": 0}))["reason"] == "Name already taken in this room"
            assert (await b.call("JOIN_ROOM", {"name": "TEST_B", "avatar": 0}))["reason"] == "Enter a room code"
            r = await b.call("JOIN_ROOM", {"roomCode": code.lower(), "name": "TEST_B", "avatar": 1})
            assert r["ok"] and r["data"]["roomCode"] == code
            b_id = r["data"]["playerId"]
            assert await wait_for(lambda: any(d["id"] == b_id for d in a.got("PLAYER_JOINED")), 3)
            r = await c.call("JOIN_ROOM", {"roomCode": code, "name": "TEST_C", "avatar": 9})
            assert r["ok"]
            await asyncio.sleep(0.5)
            assert len(a.got("LOBBY_UPDATED")[-1]["players"]) == 3
            assert next(p for p in a.got("LOBBY_UPDATED")[-1]["players"] if p["name"] == "TEST_C")["avatar"] == 0

            # START by non-host / too few
            assert (await b.call("START_GAME"))["reason"] == "Only the host can start the match"
            assert (await a.call("START_GAME"))["reason"] == "Need at least 6 players"
            # SET_AVATAR
            assert (await b.call("SET_AVATAR", {"avatar": 5}))["ok"]
            await asyncio.sleep(0.4)
            assert next(p for p in a.got("LOBBY_UPDATED")[-1]["players"] if p["id"] == b_id)["avatar"] == 5
            # TIME_SYNC
            r = await a.call("TIME_SYNC")
            assert r["ok"] and abs(r["data"]["serverNow"] - time.time() * 1000) < 5000

            # host leaves -> B becomes host
            t0 = time.time()
            await a.sio.emit("LEAVE_ROOM")
            assert await wait_for(lambda: b.got("PLAYER_LEFT", t0) and b.got("LOBBY_UPDATED", t0), 3)
            lv = b.got("LOBBY_UPDATED", t0)[-1]
            assert lv["hostId"] == b_id and len(lv["players"]) == 2
            # bots
            assert (await c.call("ADD_BOTS"))["reason"] == "Only the host can add computer players"
            assert (await b.call("ADD_BOTS"))["ok"]
            await asyncio.sleep(0.4)
            lv = b.got("LOBBY_UPDATED")[-1]
            assert len(lv["players"]) == 6 and sum(1 for p in lv["players"] if p.get("isBot")) == 4
            assert (await b.call("REMOVE_BOTS"))["ok"]
            await asyncio.sleep(0.4)
            assert len(b.got("LOBBY_UPDATED")[-1]["players"]) == 2
        finally:
            for x in (a, b, c):
                await x.sio.disconnect()
    run(go())


# ── Ack ordering vs. broadcasts (port difference check: Node emitted broadcasts before ack) ──
def test_ack_ordering_create_room():
    async def go():
        a = C("TEST_Ord")
        await a.connect()
        try:
            r = await a.sio.call("CREATE_ROOM", {"name": "TEST_Ord", "avatar": 0}, timeout=6)
            assert r["ok"]
            got_before = bool(a.got("LOBBY_UPDATED"))
            print("LOBBY_UPDATED received before ack:", got_before)
            assert await wait_for(lambda: a.got("LOBBY_UPDATED"), 3)
        finally:
            await a.sio.disconnect()
    run(go())


# ── Full match: roles, movement, tasks, fake tasks, leak, kill, report+replay, chat, voting, power cut, GAME_OVER, return ──
def test_full_match_flow():
    log = []

    def check(name, cond, note=""):
        log.append((name, bool(cond), note))
        print(("PASS " if cond else "FAIL ") + name + " " + str(note))

    async def go():
        cl = [C(f"TEST_P{i}") for i in range(6)]
        for x in cl:
            await x.connect()
        try:
            r = await cl[0].call("CREATE_ROOM", {"name": cl[0].name, "avatar": 0})
            code = r["data"]["roomCode"]
            cl[0].pid = r["data"]["playerId"]
            for x in cl[1:]:
                r = await x.call("JOIN_ROOM", {"roomCode": code, "name": x.name, "avatar": 1}, wait=0.05)
                x.pid = r["data"]["playerId"]
            await asyncio.sleep(0.5)
            t_start = time.time()
            r = await cl[0].call("START_GAME")
            check("start", r == {"ok": True, "data": None}, r)
            await wait_for(lambda: all(x.faction for x in cl), 4)
            deep = [x for x in cl if x.faction == "DEEP_STATE"]
            gov = [x for x in cl if x.faction == "GOVERNMENT"]
            check("roles 4/2", len(deep) == 2 and len(gov) == 4)
            check("deep teammates", all(d.team == [o.pid for o in deep if o is not d] for d in deep))
            check("gov no teammates", all(g.team == [] for g in gov))
            gs = cl[1].got("GAME_STARTED")
            check("GAME_STARTED ROLE_ASSIGNMENT", gs and gs[0]["state"] == "ROLE_ASSIGNMENT" and gs[0]["totalTasks"] == 12, gs and gs[0]["state"])
            check("no faction leak in view", gs and all("revealedFaction" not in p for p in gs[0]["players"]))
            await wait_for(lambda: all(x.state and x.state["state"] == "PLAYING" for x in cl), 6)
            check("PLAYING after ~4s", all(x.state["state"] == "PLAYING" for x in cl), round(time.time() - t_start, 1))
            cds = deep[0].got("COOLDOWN")
            check("COOLDOWN sent to deep", cds and cds[-1]["eliminationReadyAt"] > time.time() * 1000 + 9000, cds and cds[-1])
            check("no COOLDOWN to gov", not gov[0].got("COOLDOWN"))

            for x in cl:  # sync positions from state
                me = next(p for p in x.state["players"] if p["id"] == x.pid)
                x.pos = dict(me["position"])

            # movement: wall reject + too-fast reject
            g0 = gov[0]
            start = dict(g0.pos)
            t0 = time.time()
            await g0.sio.emit("PLAYER_MOVED", {"position": {"x": start["x"], "y": 20}, "facing": "up"})
            await wait_for(lambda: g0.got("PLAYER_MOVED", t0), 2)
            sb = g0.got("PLAYER_MOVED", t0)
            check("wall move snapped back", sb and sb[-1]["position"] == start and sb[-1]["playerId"] == g0.pid, sb)
            g0.pos = dict(start)
            t0 = time.time()
            await g0.sio.emit("PLAYER_MOVED", {"position": {"x": start["x"] + 4, "y": start["y"]}, "facing": "right"})
            await asyncio.sleep(0.5)
            others = [m for m in cl[0 if cl[0] is not g0 else 1].got("PLAYER_MOVED", t0) if m["playerId"] == g0.pid]
            check("valid move broadcast to others", others and others[-1]["position"]["x"] == start["x"] + 4, others)
            check("valid move not echoed to mover", not g0.got("PLAYER_MOVED", t0))
            g0.pos = {"x": start["x"] + 4, "y": start["y"]}
            await g0.walk(start)

            # Gov task at ls-register (APPROVE_BILL)
            st = {t["taskId"]: t for t in g0.state["tasks"]}
            far = await g0.call("TASK_OPENED", {"taskId": "ls-register"})
            check("task too far", far == {"ok": False, "reason": "Too far away"}, far)
            await g0.walk(st["ls-register"]["position"])
            t0 = time.time()
            r = await g0.call("TASK_OPENED", {"taskId": "ls-register"})
            pz = r.get("data", {}).get("puzzle", {})
            check("APPROVE_BILL puzzle", r["ok"] and pz.get("type") == "APPROVE_BILL" and len(pz["sequence"]) == 3 and pz["showMs"] == 2500, r)
            await asyncio.sleep(0.3)
            pi = [m for m in cl[0 if cl[0] is not g0 else 1].got("PLAYER_INTERACTING", t0)]
            check("PLAYER_INTERACTING start", pi and pi[0] == {"playerId": g0.pid, "taskId": "ls-register"}, pi)
            bad = await g0.call("TASK_COMPLETED", {"taskId": "ls-register", "payload": ["FLAG", "FLAG", "FLAG", "FLAG"]})
            check("wrong answer rejected", bad == {"ok": False, "reason": "Incorrect — try again"}, bad)
            r = await g0.call("TASK_COMPLETED", {"taskId": "ls-register", "payload": pz["sequence"]})
            check("correct answer ok", r == {"ok": True, "data": None}, r)
            await asyncio.sleep(0.5)
            tp = cl[5].got("TASK_PROGRESS")
            check("TASK_PROGRESS broadcast", tp and tp[-1] == {"taskId": "ls-register", "completedTasks": 1, "totalTasks": 12}, tp)
            again = await g0.call("TASK_OPENED", {"taskId": "ls-register"})
            check("complete task cannot reopen", again.get("reason") == "Task already complete", again)

            # Deep A: fake task at ls-motion (FILE_SORT), then DOCUMENT_LEAK
            dA, dB = deep
            await dA.walk(st["ls-motion"]["position"])
            r = await dA.call("TASK_OPENED", {"taskId": "ls-motion"})
            pz = r["data"]["puzzle"]
            check("FILE_SORT puzzle", pz["type"] == "FILE_SORT" and len(pz["docs"]) == 3 and len(pz["folders"]) == 3, pz)
            # FILE_SORT answer unknown to client: brute-force permutations of folders over docs
            import itertools
            ok_done = False
            for perm in itertools.permutations([f["id"] for f in pz["folders"]]):
                ans = {d["id"]: f for d, f in zip(pz["docs"], perm)}
                rr = await dA.call("TASK_COMPLETED", {"taskId": "ls-motion", "payload": ans})
                if rr["ok"]:
                    ok_done = True
                    break
            await asyncio.sleep(0.5)
            check("deep fake task accepted but no progress", ok_done and len(cl[5].got("TASK_PROGRESS")) == 1)
            check("ls-motion still AVAILABLE", next(t for t in cl[5].state["tasks"] if t["taskId"] == "ls-motion")["status"] == "AVAILABLE")
            r = await gov[1].call("SABOTAGE_REQUEST", {"type": "POWER_CUT"})
            check("gov cannot sabotage", r.get("reason") == "Not allowed", r)
            t_leak = time.time()
            r = await dA.call("SABOTAGE_REQUEST", {"type": "DOCUMENT_LEAK", "targetTaskId": "ls-motion"})
            check("DOCUMENT_LEAK ok", r["ok"], r)
            await asyncio.sleep(0.5)
            sab = cl[5].state["sabotage"]
            check("leak disabled task", sab["disabledTaskIds"] == ["ls-motion"] and sab["leakEndsAt"], sab)
            r = await dB.call("SABOTAGE_REQUEST", {"type": "POWER_CUT"})
            check("2nd sabotage rejected (far/active)", not r["ok"], r)
            news = [n["key"] for n in cl[5].got("NEWS")]
            check("NEWS DOCUMENT_LEAK", "DOCUMENT_LEAK" in news, news)
            r = await dA.call("TASK_OPENED", {"taskId": "ls-motion"})
            check("leaked station offline", (r.get("reason") or "").startswith("Documents leaked — back in"), r)

            # Kill: deep A -> victim gov[3] (stationary at spawn)
            victim = gov[3]
            await dA.walk(victim.pos)
            r = await dA.call("PLAYER_ELIMINATE_REQUEST", {"targetId": dB.pid})
            check("kill teammate rejected", r.get("reason") == "Cannot eliminate a teammate", r)
            ready = dA.got("COOLDOWN")[-1]["eliminationReadyAt"] / 1000
            if time.time() < ready - 1:
                r = await dA.call("PLAYER_ELIMINATE_REQUEST", {"targetId": victim.pid})
                check("initial cooldown enforced", (r.get("reason") or "").startswith("Cooldown:"), r)
            await asyncio.sleep(max(0, ready - time.time() + 0.3))
            t0 = time.time()
            r = await dA.call("PLAYER_ELIMINATE_REQUEST", {"targetId": victim.pid})
            check("kill ok", r == {"ok": True, "data": None}, r)
            await wait_for(lambda: cl[5].got("PLAYER_ELIMINATED", t0), 3)
            pe = cl[5].got("PLAYER_ELIMINATED", t0)
            check("PLAYER_ELIMINATED payload", pe and pe[0]["body"]["playerId"] == victim.pid and pe[0]["livingCount"] == 5 and pe[0]["body"]["reported"] is False, pe)
            await wait_for(lambda: dA.got("COOLDOWN", t0), 3)
            cd = dA.got("COOLDOWN", t0)
            check("25s cooldown", cd and 23000 < cd[-1]["eliminationReadyAt"] - t0 * 1000 < 27000, cd and cd[-1])
            r = await dA.call("PLAYER_ELIMINATE_REQUEST", {"targetId": victim.pid})
            check("kill dead rejected", r.get("reason") in ("Target already eliminated",), r)
            vs = victim.state
            check("victim ghost view", next(p for p in vs["players"] if p["id"] == victim.pid)["alive"] is False)
            check("dead player's faction revealed", next(p for p in cl[5].state["players"] if p["id"] == victim.pid).get("revealedFaction") == "GOVERNMENT")
            body = pe[0]["body"]

            # Ghost whisper during PLAYING
            t0 = time.time()
            r = await victim.call("CHAT_SEND", {"text": "TEST_ghost <b>hi</b>"})
            check("ghost chat ok in PLAYING", r["ok"], r)
            r = await gov[0].call("CHAT_SEND", {"text": "TEST_living"})
            check("living chat closed in PLAYING", r.get("reason") == "Chat opens during discussion", r)
            await asyncio.sleep(0.5)
            gm = victim.got("CHAT_MESSAGE", t0)
            check("ghost receives own whisper, sanitised", gm and gm[0]["ghost"] is True and gm[0]["text"] == "TEST_ghost bhi/b", gm)
            check("living don't get ghost chat", not any(x.got("CHAT_MESSAGE", t0) for x in cl if x is not victim))

            # Report by gov[2]
            rep = gov[2]
            await rep.walk(body["position"])
            t0 = time.time()
            r = await rep.call("BODY_REPORTED", {"bodyId": body["bodyId"]})
            check("report ok", r["ok"], r)
            await wait_for(lambda: all(x.got("MEETING_STARTED", t0) for x in cl), 3)
            ms = cl[0].got("MEETING_STARTED", t0)
            m = ms[0] if ms else {}
            check("MEETING_STARTED to all 6", all(x.got("MEETING_STARTED", t0) for x in cl))
            check("meeting payload", m.get("reason") == "BODY" and m.get("callerId") == rep.pid and m.get("bodyId") == body["bodyId"], {k: m.get(k) for k in ("reason", "callerId", "bodyId")})
            rp = m.get("replay") or {}
            check("replay frames", rp.get("radius") == 224 and rp.get("frameMs") == 200 and rp.get("bodyPlayerId") == victim.pid and len(rp.get("frames", [])) > 10, len(rp.get("frames", [])))
            check("leak clue in meeting", (m.get("clue") or {}).get("taskId") == "ls-motion" and m["clue"].get("stationLabel") == "File the Motion", m.get("clue"))
            await asyncio.sleep(0.3)
            check("state MEETING_TRANSITION", cl[0].state["state"] == "MEETING_TRANSITION", cl[0].state["state"])
            check("sabotage cleared at meeting", cl[0].state["sabotage"]["disabledTaskIds"] == [])
            r = await gov[0].call("TASK_OPENED", {"taskId": "ls-register"})
            check("actions frozen in meeting", r.get("reason") == "Meeting in progress", r)
            await wait_for(lambda: cl[0].state["state"] == "DISCUSSION", 4)
            check("DISCUSSION", cl[0].state["state"] == "DISCUSSION")
            t0 = time.time()
            r = await gov[0].call("CHAT_SEND", {"text": "TEST_living_msg"})
            check("living chat in discussion ok", r["ok"], r)
            r = await victim.call("CHAT_SEND", {"text": "TEST_ghost_meet"})
            await asyncio.sleep(0.5)
            liv = [x for x in cl if x is not victim]
            check("living msg to all living", all(any(c["text"] == "TEST_living_msg" for c in x.got("CHAT_MESSAGE", t0)) for x in liv))
            check("living msg hidden from ghost", not any(c["text"] == "TEST_living_msg" for c in victim.got("CHAT_MESSAGE", t0)))
            check("ghost msg hidden from living", not any(c["text"] == "TEST_ghost_meet" for x in liv for c in x.got("CHAT_MESSAGE", t0)))
            r = await gov[0].call("VOTE_SUBMITTED", {"choice": "SKIP"})
            check("vote rejected in discussion", r.get("reason") == "Voting is not open", r)
            await wait_for(lambda: cl[0].state["state"] == "VOTING", 45)
            check("VOTING", cl[0].state["state"] == "VOTING")
            r = await victim.call("VOTE_SUBMITTED", {"choice": "SKIP"})
            check("ghost vote rejected", r.get("reason") == "Eliminated players cannot vote", r)
            r = await gov[0].call("VOTE_SUBMITTED", {"choice": gov[0].pid})
            check("self vote rejected", r.get("reason") == "You cannot vote for yourself", r)
            t0 = time.time()
            for x in liv:
                ch = dA.pid if x is not dA else gov[0].pid
                r = await x.call("VOTE_SUBMITTED", {"choice": ch}, wait=0.05)
            r = await gov[0].call("VOTE_SUBMITTED", {"choice": "SKIP"})
            check("double vote rejected", r.get("reason") in ("Vote already cast", "Voting is not open"), r)
            await wait_for(lambda: cl[0].got("VOTE_RESULTS", t0), 3)
            vr = cl[0].got("VOTE_RESULTS", t0)
            check("VOTE_CAST events", len(cl[0].got("VOTE_CAST", t0)) == 5)
            check("vote results eject deep", vr and vr[0]["ejectedPlayerId"] == dA.pid and vr[0]["ejectedFaction"] == "DEEP_STATE" and vr[0]["counts"].get(dA.pid) == 4 and "SKIP" in vr[0]["counts"], vr)
            await wait_for(lambda: cl[0].state["state"] == "PLAYING", 7)
            check("resume PLAYING", cl[0].state["state"] == "PLAYING")
            check("bodies cleared", cl[0].state["bodies"] == [])
            check("emergency cooldown set", cl[0].state["emergencyAvailableAt"] > time.time() * 1000 + 50000)
            await asyncio.sleep(0.3)
            for x in cl:
                me = next(p for p in x.state["players"] if p["id"] == x.pid)
                x.pos = dict(me["position"])
            r = await gov[0].call("EMERGENCY_MEETING")
            check("emergency cooldown", (r.get("reason") or "").startswith("Cooldown:"), r)

            # Power cut by deep B at panel; repair by gov[0]
            await dB.walk(S.POWER_PANEL)
            leak_ready = t_leak + 30
            await asyncio.sleep(max(0, leak_ready - time.time() + 0.3))
            t0 = time.time()
            r = await dB.call("SABOTAGE_REQUEST", {"type": "POWER_CUT"})
            check("POWER_CUT ok", r["ok"], r)
            await asyncio.sleep(0.5)
            check("power OUT", cl[0].state["sabotage"]["powerStatus"] == "OUT" and cl[0].state["sabotage"]["powerRestoreAt"])
            r = await dB.call("SABOTAGE_REQUEST", {"type": "POWER_CUT"})
            check("power already out", r.get("reason") == "Power is already out", r)
            fixer = gov[0]
            await fixer.walk(S.POWER_PANEL)
            r = await fixer.call("TASK_OPENED", {"taskId": "power-panel"})
            pz = (r.get("data") or {}).get("puzzle") or {}
            check("RESTORE_POWER puzzle", pz.get("type") == "RESTORE_POWER" and len(pz.get("sources", [])) == 3, r)
            if pz:
                ans = {s["id"]: next(t["id"] for t in pz["targets"] if t["label"] == s["label"]) for s in pz["sources"]}
                t1 = time.time()
                r = await fixer.call("TASK_COMPLETED", {"taskId": "power-panel", "payload": ans})
                check("power repaired", r["ok"], r)
                await asyncio.sleep(0.5)
                check("power ON + NEWS", cl[0].state["sabotage"]["powerStatus"] == "ON" and "POWER_RESTORED" in [n["key"] for n in cl[0].got("NEWS", t1)])
            r = await dB.call("SABOTAGE_REQUEST", {"type": "POWER_CUT"})
            check("shared sabotage cooldown", (r.get("reason") or "").startswith("Cooldown:"), r)

            # dB kills fixer (cooldown ready since start), then another gov -> DEEP_STATE_WINS
            r = await dB.call("PLAYER_ELIMINATE_REQUEST", {"targetId": fixer.pid})
            check("kill #2 ok", r["ok"], r)
            await asyncio.sleep(0.4)
            check("no game over yet (2 gov vs 1 deep)", cl[1].state["state"] == "PLAYING")
            last = gov[1]
            await dB.walk(last.pos)
            ready = dB.got("COOLDOWN")[-1]["eliminationReadyAt"] / 1000
            await asyncio.sleep(max(0, ready - time.time() + 0.3))
            t0 = time.time()
            r = await dB.call("PLAYER_ELIMINATE_REQUEST", {"targetId": last.pid})
            check("kill #3 ok", r["ok"], r)
            await wait_for(lambda: cl[0].got("GAME_OVER", t0), 3)
            go_ = cl[0].got("GAME_OVER", t0)
            check("GAME_OVER DEEP_STATE_WINS", go_ and go_[0]["result"] == "DEEP_STATE_WINS", go_ and go_[0]["result"])
            if go_:
                stats = {s["playerId"]: s for s in go_[0]["stats"]}
                check("stats 6 players", len(stats) == 6)
                check("stats dB eliminations 2", stats[dB.pid]["eliminations"] == 2, stats[dB.pid])
                check("stats dA 1 elim/1 fake, ejected", stats[dA.pid]["eliminations"] == 1 and stats[dA.pid]["fakeTasks"] == 1 and stats[dA.pid]["ejected"] is True, stats[dA.pid])
                check("stats g0 task+repair", stats[g0.pid]["tasksCompleted"] == 1 and stats[g0.pid]["powerRepairs"] == 1, stats[g0.pid])
                check("stats reporter", stats[rep.pid]["reports"] == 1 and stats[rep.pid]["votesOnAgents"] == 1, stats[rep.pid])
            check("GAME_OVER state reveals all", cl[0].state["state"] == "GAME_OVER" and all(p.get("revealedFaction") for p in cl[0].state["players"]))
            r = await cl[1].call("RETURN_TO_LOBBY")
            check("non-host return rejected", r.get("reason") == "Only the host can reset the room", r)
            t0 = time.time()
            r = await cl[0].call("RETURN_TO_LOBBY")
            check("host return ok", r["ok"], r)
            await wait_for(lambda: cl[3].got("LOBBY_UPDATED", t0) and cl[3].state["state"] == "WAITING", 4)
            print("lobby after return:", [p["name"] for p in cl[3].got("LOBBY_UPDATED", t0)[-1]["players"]] if cl[3].got("LOBBY_UPDATED", t0) else None)
            check("back to WAITING", cl[3].state["state"] == "WAITING" and len(cl[3].got("LOBBY_UPDATED", t0)[-1]["players"]) == 6)
            check("factions cleared", all("revealedFaction" not in p and p["alive"] for p in cl[3].state["players"]))
        finally:
            for x in cl:
                await x.sio.disconnect()

    run(go())
    fails = [n for n, ok, _ in log if not ok]
    assert not fails, f"failed checks: {fails}"
