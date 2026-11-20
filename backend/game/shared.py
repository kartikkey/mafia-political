"""Match settings, the Parliament map and pure rules (port of the former shared TS package)."""
import math
import random
import time

MIN_PLAYERS = 6
MAX_PLAYERS = 10
MOVE_SPEED = 160
ELIMINATION_COOLDOWN_MS = 25_000
INITIAL_ELIMINATION_COOLDOWN_MS = 12_000
ELIMINATION_RANGE = 40
INTERACTION_RANGE = 48
REPORT_RANGE = 56
ROLE_REVEAL_MS = 4_000
MEETING_TRANSITION_MS = 2_000
DISCUSSION_MS = 40_000
VOTING_MS = 20_000
VOTE_RESULTS_MS = 4_000
EMERGENCY_MEETING_COOLDOWN_MS = 60_000
POWER_CUT_DURATION_MS = 15_000
SABOTAGE_COOLDOWN_MS = 30_000
DOCUMENT_LEAK_DURATION_MS = 20_000
HOLD_TASK_MS = 4_000
HOLD_TOLERANCE_MS = 300
BILL_SEQUENCE_LENGTH = 3
BILL_SHOW_MS = 2_500
ACTION_RATE_LIMIT_MS = 200
CHAT_MAX_LENGTH = 140
CHAT_MIN_INTERVAL_MS = 750
BOT_TICK_MS = 200
REPLAY_WINDOW_MS = 10_000
REPLAY_FRAME_MS = 200
REPLAY_RADIUS = 224
REJOIN_GRACE_MS = 30_000

MINIGAME_ENABLED = {"FILE_SORT": True, "RESTORE_POWER": True, "APPROVE_BILL": True, "HOLD": True}
TILE_SIZE = 32
ROOM_CODE_LENGTH = 5

ROLE_DISTRIBUTION = {6: (4, 2), 7: (5, 2), 8: (6, 2), 9: (6, 3), 10: (7, 3)}


def now_ms() -> int:
    return int(time.time() * 1000)


def distance(a: dict, b: dict) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def within_range(a: dict, b: dict, rng: float) -> bool:
    return distance(a, b) <= rng


# ── Map ────────────────────────────────────────────────────────────────
MAP_COLS = 40
MAP_ROWS = 26
MAP_WIDTH = MAP_COLS * TILE_SIZE
MAP_HEIGHT = MAP_ROWS * TILE_SIZE

ROOMS = [
    ("FINANCE_MINISTRY", (1, 1, 10, 9)),
    ("LOK_SABHA", (14, 1, 12, 11)),
    ("PM_OFFICE", (29, 1, 10, 9)),
    ("RECORDS_ROOM", (1, 15, 10, 10)),
    ("CENTRAL_HALL", (14, 15, 25, 10)),
]
PASSAGES = [(1, 12, 38, 2), (5, 10, 2, 2), (19, 12, 2, 1), (33, 10, 2, 2), (5, 14, 2, 1),
            (19, 14, 2, 1), (33, 14, 2, 1), (11, 4, 3, 2), (26, 4, 3, 2)]
FURNITURE = [(19, 2, 2, 1), (16, 5, 3, 1), (21, 5, 3, 1), (16, 8, 3, 1), (21, 8, 3, 1),
             (3, 3, 3, 1), (32, 3, 4, 1), (2, 17, 1, 6), (9, 17, 1, 6), (24, 19, 3, 2)]


def _build_grid():
    grid = [[1] * MAP_COLS for _ in range(MAP_ROWS)]

    def fill(r, v):
        x0, y0, w, h = r
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                grid[y][x] = v

    for _, r in ROOMS:
        fill(r, 0)
    for r in PASSAGES:
        fill(r, 0)
    for r in FURNITURE:
        fill(r, 2)
    return grid


GRID = _build_grid()


def tile_center(tx: int, ty: int) -> dict:
    return {"x": tx * TILE_SIZE + TILE_SIZE / 2, "y": ty * TILE_SIZE + TILE_SIZE / 2}


TASK_STATIONS = [
    ("fin-budget", "APPROVE_BILL", "Approve the Budget", "FINANCE_MINISTRY", (4, 4)),
    ("fin-ledger", "FILE_SORT", "Verify Allocations", "FINANCE_MINISTRY", (8, 7)),
    ("pm-bill", "APPROVE_BILL", "Pass the Bill", "PM_OFFICE", (33, 4)),
    ("pm-docs", "FILE_SORT", "Approve Government Documents", "PM_OFFICE", (36, 7)),
    ("rec-files", "FILE_SORT", "Organize Files", "RECORDS_ROOM", (5, 18)),
    ("rec-verify", "FILE_SORT", "Verify Records", "RECORDS_ROOM", (7, 22)),
    ("ch-power", "RESTORE_POWER", "Restore Power", "CENTRAL_HALL", (16, 17)),
    ("ch-comms", "RESTORE_POWER", "Repair Communications", "CENTRAL_HALL", (36, 22)),
    ("ls-register", "APPROVE_BILL", "Sign the Register", "LOK_SABHA", (24, 10)),
    ("ls-motion", "FILE_SORT", "File the Motion", "LOK_SABHA", (15, 3)),
    ("ch-bill", "APPROVE_BILL", "Approve the Bill", "CENTRAL_HALL", (30, 17)),
    ("ch-lights", "RESTORE_POWER", "Fix Hall Lighting", "CENTRAL_HALL", (28, 23)),
]

REPAIR_TASK_ID = "power-panel"
POWER_PANEL = tile_center(15, 22)
EMERGENCY_BUTTON = tile_center(20, 4)
SPAWN_POINTS = [tile_center(*t) for t in [(17, 3), (18, 3), (21, 3), (22, 3), (17, 7), (18, 7), (21, 7), (22, 7), (17, 10), (22, 10)]]


def is_solid_tile(tx: int, ty: int) -> bool:
    if tx < 0 or ty < 0 or tx >= MAP_COLS or ty >= MAP_ROWS:
        return True
    return GRID[ty][tx] != 0


def in_map_bounds(pos: dict, margin: float = 16) -> bool:
    return margin <= pos["x"] <= MAP_WIDTH - margin and margin <= pos["y"] <= MAP_HEIGHT - margin


def is_walkable(pos: dict, radius: float = 10) -> bool:
    corners = [(pos["x"] - radius, pos["y"] - radius), (pos["x"] + radius, pos["y"] - radius),
               (pos["x"] - radius, pos["y"] + radius), (pos["x"] + radius, pos["y"] + radius)]
    return all(not is_solid_tile(math.floor(x / TILE_SIZE), math.floor(y / TILE_SIZE)) for x, y in corners)


def room_at(pos: dict):
    tx = math.floor(pos["x"] / TILE_SIZE)
    ty = math.floor(pos["y"] / TILE_SIZE)
    for rid, (x, y, w, h) in ROOMS:
        if x <= tx < x + w and y <= ty < y + h:
            return rid
    return None


# ── Rules ──────────────────────────────────────────────────────────────
def assign_roles(player_ids: list) -> dict:
    dist = ROLE_DISTRIBUTION.get(len(player_ids))
    if not dist:
        raise ValueError(f"Unsupported player count: {len(player_ids)}")
    shuffled = list(player_ids)
    random.shuffle(shuffled)
    return {pid: ("DEEP_STATE" if i < dist[1] else "GOVERNMENT") for i, pid in enumerate(shuffled)}


def check_victory(players: list, completed: int, total: int) -> str:
    living = [p for p in players if p["alive"] and p["connected"]]
    gov = sum(1 for p in living if p["faction"] == "GOVERNMENT")
    deep = sum(1 for p in living if p["faction"] == "DEEP_STATE")
    if total > 0 and completed >= total:
        return "GOVERNMENT_WINS"
    if deep == 0:
        return "GOVERNMENT_WINS"
    if deep >= gov:
        return "DEEP_STATE_WINS"
    return "NO_WINNER"


def tally_votes(votes: dict):
    """Ejected only if strictly more votes than every other option (incl. Skip)."""
    counts = {"SKIP": 0}
    for choice in votes.values():
        counts[choice] = counts.get(choice, 0) + 1
    top, top_count, tied = None, -1, False
    for choice, count in counts.items():
        if count > top_count:
            top, top_count, tied = choice, count, False
        elif count == top_count:
            tied = True
    ejected = top if (not tied and top and top != "SKIP" and top_count > 0) else None
    return counts, ejected
