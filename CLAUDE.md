# CLAUDE.md — NETAGIRI: Parliament Under Siege

Multiplayer social-deduction browser game (6–10 players) set in a fictional
Indian Parliament. 2D top-down, 16-bit pixel-art style. 8-hour hackathon MVP.

## Sources of truth (read before changing behaviour)

| Topic | File |
|---|---|
| **Behaviour / rules** (wins over everything) | `docs/specs/gameplay-spec.txt` (from the `.docx`) |
| Game concept, story, scope | `docs/specs/game-design.txt` |
| **Appearance** | `docs/references/README.md`: index of every board + sprite sheet + key art, what each screen should follow, and where boards disagree with the spec. PDF: `docs/specs/NETAGIRI_Visual_Reference_Pack.pdf` |
| Module plan + build prompts | `docs/PROJECT_PLAN.md` |

Do not invent factions, mechanics or screens outside the spec without asking.
Out of scope: journalists/lobbyists, bribery, private messaging, voice chat,
multiple maps, progression.

Added beyond the spec and merged in PR #1: bots that fill empty seats,
Document Leak sabotage, camera follow, meeting replay, end-of-game badges,
ghost chat for eliminated players, invite link + QR code, kick, rejoin and play
again. `plan/plan.md` and `memory/PRD.md` describe them.

## Stack

Two apps plus a root folder for scripts and e2e tests. This is not an npm
workspace; each app has its own dependencies.

```
backend/              Python 3 · FastAPI + python-socketio, served by uvicorn on :8001.
                      Socket.IO path /api/socket.io. AUTHORITATIVE, in-memory game state.
  server.py           app + socket event handlers
  game/shared.py      settings, map, rules (Python twin of frontend/src/shared)
  game/match.py       per-room match state       game/rooms.py   RoomManager (by_socket)
  game/actions.py     validated player actions   game/flow.py    phases, timers, finish_if_won
  game/bots.py        bot players                game/puzzles.py mini-game puzzles + answers
  tests/              pytest suites; they connect to a RUNNING server over Socket.IO
frontend/             React 18 + TS + Redux Toolkit + React Router v6 + Vite + SCSS, port 3000
  src/shared/         types, socket contracts, settings, map, rules (import as @netagiri/shared)
e2e/                  Playwright multi-browser scripts (acceptance.cjs = Spec §13 pass)
plan/, memory/, test_reports/, .emergent/, deployer-agent-docs/   Emergent agent files
```

**The game rules exist twice**: `backend/game/shared.py` and
`frontend/src/shared/`. Change both together; the server's copy is the one
that counts.

### Commands (from the repo root)

| Command | What it does |
|---|---|
| `npm run setup` | Install root, frontend and local Python packages (`backend/requirements-local.txt`) |
| `npm run dev` | Backend (:8001, auto-reload) + frontend (:3000) together |
| `npm run typecheck` / `npm run build` | Frontend `tsc` / production build → `frontend/build` |
| `npm run test:backend` | pytest suites against the running server (start `npm run dev` first; ~4 min) |
| `npm run test:e2e` | `e2e/acceptance.cjs` with 6 browsers against :3000 (~4 min) |

Environment: `backend/.env` needs `CORS_ORIGINS` (the server won't start
without it; `*` for local). `frontend/.env` needs `VITE_PROXY_TARGET=http://localhost:8001`
so the dev server forwards `/api` to the backend. Copy the `.env.example` files.
`backend/requirements.txt` is Emergent's deploy environment and includes
packages from a private host; use `requirements-local.txt` locally.

## Golden rules

### Server authority (Spec §10)
1. The server owns roles, alive status, positions-for-actions, cooldown
   timestamps, task completion, votes, timers and victory. Clients **request**;
   the server validates and broadcasts.
2. Resolve the acting player from the socket id via `rooms.by_socket(sid)` — never
   trust an id, faction, cooldown or "success" flag sent by the client.
3. Every action handler checks, in order: player exists → alive → `match.state`
   allows it → range (`withinRange`) → faction → cooldown → target state. On
   failure `ack(fail('Short human reason'))` ("Too far away", "Cooldown: 8s",
   "Meeting in progress"). A rejected action never consumes a cooldown.
4. Never broadcast the role map. `ROLE_ASSIGNED` goes to one socket;
   `PublicPlayer.revealedFaction` is set only for dead players or at `GAME_OVER`.
5. Call `finish_if_won()` (`game/flow.py`) after every task completion, elimination, vote
   result and disconnect (Spec §9.3).
6. Gameplay numbers live in `backend/game/shared.py` and
   `frontend/src/shared/constants/settings.ts`, with the same values — no magic
   numbers in handlers or components.
7. Pure rules (victory, voting, role distribution, badges, geometry, map) live
   in `backend/game/shared.py` and `frontend/src/shared/rules|map`. Add a pytest
   in `backend/tests/` when you add or change a rule.

### Client — mecord folder structure (adapted for a socket game)

```
frontend/src/
├── api/          gameSocket.ts (the ONE socket instance + emitWithAck)
│                 serverEvents.ts (the ONLY place socket listeners are bound → dispatch)
├── assets/       scss/_tokens.scss (palette + fonts), images/, fonts/
├── common/       components/ (PixelButton, PixelPanel, Badge, Avatar, Modal, MuteToggle), hooks/, types/
├── components/   global layout-level widgets (NewsTicker, PhaseTimer, ChatBox)
├── config/       env.ts, constants.ts
├── constants/    routes.ts (PATHS + pathForState)
├── helpers/      avatars.ts, storage.ts
├── layout/       GameLayout (news ticker shell)
├── pages/        Join · Lobby · Game · Meeting · Results
├── shared/       @netagiri/shared (see Stack)
├── routes/       <Module>/<Module>Routes.tsx, allRoutes.tsx, RoomProtected.tsx
├── slices/       join · lobby · game · meeting · results  (reducer.ts + thunk.ts)
└── store.ts
```

1. **slices/ and routes/ mirror pages/** — every page module has
   `slices/<module>/{reducer,thunk}.ts` and `routes/<Module>/<Module>Routes.tsx`.
2. `allRoutes.tsx` only imports and spreads. Route files use `lazy()` imports.
3. **Pages only `dispatch()` and `useAppSelector()`** — no socket calls in
   pages or components. Emits happen in `thunk.ts` via `emitWithAck` /
   `gameSocket.emit`; listeners only in `api/serverEvents.ts`.
4. Every reducer exports a `reset<Module>` action.
5. A module-level `components/` only holds things used by that module;
   cross-module UI goes to `common/components/`.
6. Navigation is driven by server state: in-room pages call
   `useMatchNavigation()`; don't `navigate()` between game screens manually.
7. Room-gated routes are wrapped in `RoomProtected` (the AuthProtected equivalent).
8. Naming: module folders PascalCase, slice folders camelCase, entry files
   `index.tsx`, components PascalCase.

### Visual language (Visual Reference Pack, Board 3; see docs/references/)
- Before building or restyling a screen, open the reference listed for it in
  `docs/references/README.md` and match its layout.
- Characters are the 8 sprite-sheet variations A1–A8 (`helpers/avatars.ts`).
  Sprites need Idle 4f, Walk 4 directions × 4f, Interact 3f, Eliminated 4f, Meeting 4f.
- Boards also show a "Media Center" room and Journalist/Lobbyist names. These
  are **not** in scope (spec wins); ask before adding them.
- Colours only via CSS vars from `_tokens.scss`: `--c-primary` #1B2B3D
  (midnight navy), `--c-green` #607B57 (parliament green), `--c-beige` #D8C8A4
  (paper), `--c-red` #A8463D (alert), `--c-accent` #F2C14E (gold), `--c-ivory` #F5E6C8.
- Fonts: `--f-heading` Press Start 2P (headings, buttons), `--f-body` VT323.
- Pixel look: hard borders, `--shadow-pixel`, `image-rendering: pixelated`, no
  rounded corners or soft gradients on UI chrome.
- Accessibility (Spec §11.4): never colour alone — pair with a label/icon;
  disabled buttons show the reason; click targets ≥ 44px.

## Domain vocabulary

| Term | Meaning |
|---|---|
| Government / MP | Majority faction. Completes tasks, reports, votes. |
| Deep State / Agent | Hidden faction. Eliminates, sabotages, fakes tasks. Knows teammates. |
| Task station | Interactable on the map opening a mini-game (FILE_SORT, RESTORE_POWER, APPROVE_BILL; HOLD fallback). |
| Body | Marker left where an MP was eliminated; reportable once. |
| Emergency session / meeting | Lok Sabha meeting: transition → discussion (40s) → voting (20s) → results (4s). |
| Skip Vote | Explicit abstain. Skip plurality or any tie → nobody ejected. |
| Power Cut | Sabotage: 15s outage, repairable at Restore Power panel. |
| News ticker | Breaking-news strip (the server sends a key; the text is in `frontend/src/shared/constants/news.ts`). |

## State machine (Spec §9.1)

```
WAITING → ROLE_ASSIGNMENT → PLAYING ⇄ MEETING_TRANSITION → DISCUSSION → VOTING → VOTE_RESULTS
                                 ↘ GAME_OVER ↙ (any victory check)            ↘ PLAYING (no winner)
GAME_OVER → WAITING (host "Back to Lobby")
```

Movement only in PLAYING. Task modals close on leaving PLAYING or on death.

## Reporting rule
After implementing anything, report which acceptance tests (Spec §13) were
actually run and passed, which failed, and what remains. Never claim a test
passed that wasn't run.
