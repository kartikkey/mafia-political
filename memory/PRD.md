# NETAGIRI: Parliament Under Siege — PRD

## Original problem statement
6–10 player multiplayer social-deduction browser game (2D top-down, 16-bit pixel art, fictional Indian Parliament).
Existing monorepo (shared/ server/ client/ e2e/) with docs as source of truth (CLAUDE.md, docs/PROJECT_PLAN.md,
docs/specs/gameplay-spec.txt wins on behaviour). Prompts 1–2 were done; implement Prompts 3–10 without changing stack
(Node + Express + Socket.IO authoritative server, React 18 + Redux Toolkit + Vite client, npm workspaces).
Out of scope: Media Center, journalists/lobbyists, bribery, voice chat, multiple maps, bots.

## Architecture
- (2026-06, deploy fix) Server rewritten in Python at user's request so Emergent deploy works:
  - backend/: FastAPI + python-socketio (`uvicorn server:app`, :8001, path /api/socket.io). game/{shared,match,puzzles,flow,actions,bots,rooms,io}.py — 1:1 port of the old Node server; io.py = ordered emit queue. In-memory state (no DB use; MONGO_URL/DB_NAME kept in .env).
  - frontend/: React + Vite client (moved from client/); src/shared = TS copy of types/contracts/settings/map (alias @netagiri/shared) — keep in sync with backend/game/shared.py. `yarn build` → frontend/build.
  - Old server/, client/, shared/ removed. Tests: backend/tests/test_netagiri_socket.py, e2e/*.cjs (acceptance 18/18, phase3 5/5, bots pass on Python server).

## Implemented (2026-06)
- P3 tasks + shared progress, P4 three mini-games (HOLD fallback per type), P5 elimination + Power Cut (own timer, repair at panel or RESTORE_POWER task),
  P6 report/emergency (60s global), 2s/40s/20s/4s meeting, living-only chat (140 chars, 750ms), votes (skip, tie, early close),
  P7 victory checks after task/kill/vote/disconnect, disconnect handling, P8 results screen, P9 news ticker, synth sounds + mute,
  code-drawn A1–A8 sprites (idle/walk/interact/eliminated/meeting) and room tiles, P10 e2e/acceptance.cjs (Spec §13, 18/18 PASSED locally).
- Unit tests: 48 (vitest). Typecheck + build clean.

## Iteration 2 (2026-06)
- Document Leak sabotage (F at an available station → offline 20s, own news + recovery news, one sabotage at a time, shared 30s cooldown, cleared by meetings).
- Camera follow: canvas fills map area, player centred at 2× (Z / legend button cycles 2× → 1.4× → full map).
- Interact animation + "..." bubble broadcast for every station use (PLAYER_INTERACTING / TASK_CLOSED) — identical for Deep State fake tasks.
- Starting elimination grace period 12s (MATCH_SETTINGS.initialEliminationCooldownMs).
- Tests: 51 unit; e2e/acceptance.cjs 18/18; e2e/t1-features2.cjs all PASS.

## Iteration 3 (2026-06)
- Spectator ghosts: eliminated players drift through walls (map bounds), visible only to other ghosts (masked MATCH_STATE + ghost-only PLAYER_MOVED).
- Map overlay (M / legend button): full map, room names, open/done/offline stations, YOU marker; movement paused while open.
- Leak clue: meeting card "X was last seen at <station>" (starts on leaker, updated by any living player stepping up while offline; reset each round).
- Shared clock: TIME_SYNC (lowest-RTT of 4 samples, resync every 60s); all countdowns use serverNow().
- Tests: 55 unit; acceptance 18/18; e2e/phase3.cjs 5/5; testing agent iteration_3 21/21.

## Iteration 4 (2026-06)
- Computer players (user-requested scope change; originally out of scope): host "Fill N seats with bots" / "Remove bots"; real joiners bump a bot; room closes when only bots remain.
  Bots act via the same validated actions (game/actions.ts) on a 200ms server tick (game/ticker.ts, game/bots.ts: BFS pathing, tasks, kills on lone MPs, leaks, reports, chat, votes).
- Meeting replay: last 10s (200ms frames) of living players within 7 tiles of the body, sent with MEETING_STARTED for body reports; 2× mini-map playback.
- Badges (shared/rules/badges.ts): Bill Passer, Master Bluffer, Silent Assassin, Sharp Eye, First Responder, Power Broker, Survivor.
- Ghost whispers: eliminated players chat any time in a match, delivered only to other ghosts (in-game panel + meeting panel).
- Tests: 62 unit (incl. full bot-only match simulation); acceptance 18/18; e2e/bots.cjs solo match; testing agent iteration_4 fixes applied.

## Lobby invites (2026-06)
- Copy invite link (`origin/?room=CODE`) + native Share + manual-copy fallback; /?room= prefills Join code with invite note.
- Host-only per-bot remove (REMOVE_BOT {playerId}, server-validated); Remove-all kept. Mobile: Session panel shown above roster.
- Tested: iteration_6 (100%).

## Backlog
- Phase 2: QR code of invite link; host kick human players. Phase 3: private/public rooms; "play again with same group" link.
- P1: deploy verification on Emergent hosting (Node server).
- P2: rejoin after disconnect, voice chat.
- Deployment: Emergent deploy pipeline expects backend/frontend layout — Node server deploy unverified.
