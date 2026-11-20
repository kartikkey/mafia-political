"""Room membership and lifecycle. One Match per room code; host passes on; bot-only rooms close."""
import random
import unicodedata
import uuid

from . import shared as S
from .match import Match, Player

BOT_NAMES = ["Bot Sharma", "Bot Iyer", "Bot Reddy", "Bot Das", "Bot Khan", "Bot Mehta", "Bot Pillai", "Bot Gill"]
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def sanitise_name(raw):
    if not isinstance(raw, str):
        return None
    kept = "".join(c for c in raw if c in " _.-" or unicodedata.category(c)[0] in ("L", "N"))
    name = kept.strip()[:16]
    return name if len(name) >= 2 else None


class RoomManager:
    def __init__(self):
        self.rooms: dict[str, Match] = {}
        self.sockets: dict[str, tuple[str, str]] = {}

    def get(self, code: str):
        return self.rooms.get(code.upper())

    def by_socket(self, sid: str):
        ref = self.sockets.get(sid)
        if not ref:
            return None
        match = self.rooms.get(ref[0])
        player = match.players.get(ref[1]) if match else None
        return (match, player) if match and player else None

    def create(self, sid: str, name: str, avatar: int):
        code = None
        while code is None or code in self.rooms:
            code = "".join(random.choice(ALPHABET) for _ in range(S.ROOM_CODE_LENGTH))
        match = Match(code)
        self.rooms[code] = match
        return match, self._add(match, sid, name, avatar, True)

    def join(self, sid: str, code: str, name: str, avatar: int):
        match = self.get(code)
        if not match:
            return "Room not found"
        if match.state != "WAITING":
            return "Match already in progress"
        if any(p.name.lower() == name.lower() for p in match.connected_players):
            return "Name already taken in this room"
        if len(match.connected_players) >= S.MAX_PLAYERS:
            bot = next((p for p in match.connected_players if p.is_bot), None)
            if not bot:
                return "Room is full"
            self.remove_bot(match, bot.id)
        return match, self._add(match, sid, name, avatar, False)

    def _add(self, match: Match, sid: str, name: str, avatar: int, is_host: bool) -> Player:
        p = Player(str(uuid.uuid4()), sid, name, avatar, is_host, S.SPAWN_POINTS[len(match.players) % len(S.SPAWN_POINTS)])
        match.players[p.id] = p
        self.sockets[sid] = (match.room_code, p.id)
        return p

    def leave(self, sid: str):
        """Lobby: player removed. Mid-match: marked disconnected so stats/reveal still include them."""
        ref = self.by_socket(sid)
        self.sockets.pop(sid, None)
        if not ref:
            return None
        match, player = ref
        if match.state == "WAITING":
            match.players.pop(player.id, None)
        else:
            match.mark_disconnected(player.id)
        if player.is_host:
            player.is_host = False
            nxt = next((p for p in match.connected_players if not p.is_bot), None)
            if nxt:
                nxt.is_host = True
        closed = all(p.is_bot for p in match.connected_players)
        if closed:
            match.dispose()
            self.rooms.pop(match.room_code, None)
        return match, player.id, closed

    def add_bots(self, match: Match) -> int:
        added = 0
        while len(match.connected_players) < S.MIN_PLAYERS:
            taken = {p.name for p in match.connected_players}
            name = next((n for n in BOT_NAMES if n not in taken), f"Bot {len(match.players) + 1}")
            bot = self._add(match, f"bot:{uuid.uuid4()}", name, len(match.players) % 8, False)
            bot.is_bot = True
            added += 1
        return added

    def remove_bot(self, match: Match, pid: str):
        p = match.players.get(pid)
        if not p or not p.is_bot:
            return
        match.players.pop(pid, None)
        self.sockets.pop(p.socket_id, None)

    def lobby_view(self, match: Match) -> dict:
        return {"roomCode": match.room_code, "hostId": match.host_id or "",
                "players": [x for x in match.public_players() if x["connected"]],
                "minPlayers": S.MIN_PLAYERS, "maxPlayers": S.MAX_PLAYERS}
