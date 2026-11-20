"""Server-side mini-game generation + validation. Answers never leave the server."""
import random
import uuid

from .shared import BILL_SEQUENCE_LENGTH, BILL_SHOW_MS, HOLD_TASK_MS, MINIGAME_ENABLED

FOLDERS = [{"id": "BUDGET", "label": "Budget"}, {"id": "DEFENCE", "label": "Defence"}, {"id": "WELFARE", "label": "Welfare"}]
DOC_POOL = {
    "BUDGET": ["Annual Budget Estimates", "Tax Revenue Ledger", "Rupee Spending Plan", "Finance Bill Draft"],
    "DEFENCE": ["Border Patrol Orders", "Army Supply Memo", "Naval Fleet Report", "Air Defence Brief"],
    "WELFARE": ["Rural Health Scheme", "Pension Payout List", "School Meal Programme", "Housing Aid Register"],
}
WIRES = [{"color": "#c0392b", "label": "RED"}, {"color": "#2f6fd1", "label": "BLUE"},
         {"color": "#f2c14e", "label": "YELLOW"}, {"color": "#3f9d4e", "label": "GREEN"}]
SYMBOLS = ["BOOK", "RUPEE", "BUILDING", "FLAG"]


def _token() -> str:
    return uuid.uuid4().hex[:8]


def _shuffled(arr: list) -> list:
    a = list(arr)
    random.shuffle(a)
    return a


def generate_puzzle(task_type: str):
    """Returns (puzzle sent to client, answer kept on server; None = hold)."""
    if not MINIGAME_ENABLED.get(task_type) or task_type == "HOLD":
        return {"type": "HOLD", "ms": HOLD_TASK_MS}, None

    if task_type == "FILE_SORT":
        answer, docs = {}, []
        for f in _shuffled(FOLDERS):
            did = f"d-{_token()}"
            answer[did] = f["id"]
            docs.append({"id": did, "title": random.choice(DOC_POOL[f["id"]])})
        return {"type": task_type, "docs": docs, "folders": FOLDERS}, answer

    if task_type == "RESTORE_POWER":
        answer, sources, targets = {}, [], []
        for w in _shuffled(WIRES)[:3]:
            s = {"id": f"s-{_token()}", **w}
            t = {"id": f"t-{_token()}", **w}
            answer[s["id"]] = t["id"]
            sources.append(s)
            targets.append(t)
        return {"type": task_type, "sources": sources, "targets": _shuffled(targets)}, answer

    sequence = [random.choice(SYMBOLS) for _ in range(BILL_SEQUENCE_LENGTH)]
    return {"type": task_type, "symbols": SYMBOLS, "sequence": sequence, "showMs": BILL_SHOW_MS}, sequence


def check_answer(answer, payload) -> bool:
    if answer is None:
        return False
    if isinstance(answer, list):
        return isinstance(payload, list) and len(payload) == len(answer) and all(
            isinstance(p, str) and p == a for p, a in zip(payload, answer))
    if not isinstance(payload, dict):
        return False
    return len(payload) == len(answer) and all(isinstance(payload.get(k), str) and payload.get(k) == v for k, v in answer.items())
