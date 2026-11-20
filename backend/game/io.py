"""Ordered outbound event queue: game logic stays synchronous, one worker delivers in order."""
import asyncio
import json
import logging

log = logging.getLogger("netagiri")


class IO:
    def __init__(self, sio):
        self.sio = sio
        self._queue: asyncio.Queue | None = None

    def emit(self, event: str, data, to):
        sids = [to] if isinstance(to, str) else list(to)
        sids = [s for s in sids if s and not s.startswith("bot:")]
        if not sids:
            return
        if self._queue is None:
            self._queue = asyncio.Queue()
            asyncio.get_running_loop().create_task(self._worker())
        # Snapshot now: state may change before delivery.
        self._queue.put_nowait((event, json.loads(json.dumps(data)), sids))

    async def _worker(self):
        while True:
            event, data, sids = await self._queue.get()
            for sid in sids:
                try:
                    await self.sio.emit(event, data, to=sid)
                except Exception:
                    log.exception("emit %s failed", event)

    @staticmethod
    def room(match, except_sid=None):
        """Sockets of everyone still in the room (connected humans)."""
        return [p.socket_id for p in match.players.values() if p.connected and not p.is_bot and p.socket_id != except_sid]
