# NETAGIRI REMOVE_BOT (per-bot removal) socket validation + regression start with bots
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from test_netagiri_socket import C, wait_for, run  # noqa: E402


def lobby(c):
    return c.got("LOBBY_UPDATED")[-1]


def bots(c):
    return [p for p in lobby(c)["players"] if p.get("isBot")]


def test_remove_bot_validation_and_flow():
    async def go():
        h, g = C("TEST_RBHost"), C("TEST_RBGuest")
        await h.connect(); await g.connect()
        try:
            r = await h.call("CREATE_ROOM", {"name": "TESTRBHost", "avatar": 0})
            assert r["ok"], r
            code, h.pid = r["data"]["roomCode"], r["data"]["playerId"]
            r = await g.call("JOIN_ROOM", {"roomCode": code, "name": "TESTRBGuest", "avatar": 1})
            assert r["ok"], r
            g.pid = r["data"]["playerId"]

            # REMOVE_BOT outside of lobby context for a fresh socket
            r = await h.call("ADD_BOTS", {})
            assert r["ok"], r
            assert await wait_for(lambda: len(bots(g)) == 4, 4), lobby(g)
            b = bots(g)
            # non-host
            r = await g.call("REMOVE_BOT", {"playerId": b[0]["id"]})
            assert r == {"ok": False, "reason": "Only the host can remove computer players"}
            # human id
            r = await h.call("REMOVE_BOT", {"playerId": g.pid})
            assert r == {"ok": False, "reason": "No such computer player"}
            r = await h.call("REMOVE_BOT", {"playerId": h.pid})
            assert r == {"ok": False, "reason": "No such computer player"}
            # bad / missing payload
            r = await h.call("REMOVE_BOT", {"playerId": "bot:nope"})
            assert r == {"ok": False, "reason": "No such computer player"}
            r = await h.call("REMOVE_BOT", {})
            assert r == {"ok": False, "reason": "No such computer player"}
            r = await h.call("REMOVE_BOT", {"playerId": 123})
            assert r == {"ok": False, "reason": "No such computer player"}
            # valid removal -> broadcast to guest
            r = await h.call("REMOVE_BOT", {"playerId": b[0]["id"]})
            assert r["ok"], r
            assert await wait_for(lambda: len(bots(g)) == 3, 4)
            assert b[0]["id"] not in [p["id"] for p in lobby(g)["players"]]
            assert len(lobby(g)["players"]) == 5
            # remove same again
            r = await h.call("REMOVE_BOT", {"playerId": b[0]["id"]})
            assert r == {"ok": False, "reason": "No such computer player"}
            # remove all remaining
            r = await h.call("REMOVE_BOTS", {})
            assert r["ok"]
            assert await wait_for(lambda: len(bots(g)) == 0, 4)
            # refill and start -> REMOVE_BOT during match
            r = await h.call("ADD_BOTS", {})
            assert r["ok"]
            assert await wait_for(lambda: len(bots(h)) == 4, 4)
            bid = bots(h)[0]["id"]
            r = await h.call("START_GAME", {})
            assert r["ok"], r
            assert await wait_for(lambda: h.got("GAME_STARTED"), 4)
            r = await h.call("REMOVE_BOT", {"playerId": bid})
            assert r == {"ok": False, "reason": "Not in a lobby"}
        finally:
            for x in (h, g):
                try:
                    await x.call("LEAVE_ROOM", {}, wait=0)
                except Exception:
                    pass
                await x.sio.disconnect()

    run(go())


def test_remove_bot_not_in_room():
    async def go():
        x = C("TEST_lone")
        await x.connect()
        try:
            r = await x.call("REMOVE_BOT", {"playerId": "bot:x"})
            assert r == {"ok": False, "reason": "Not in a lobby"}
        finally:
            await x.sio.disconnect()
    run(go())
