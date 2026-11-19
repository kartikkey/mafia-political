# NETAGIRI: Parliament Under Siege — PRD

## Original problem statement
6–10 player multiplayer social-deduction browser game (2D top-down, 16-bit pixel art, fictional Indian Parliament).
Existing monorepo (shared/ server/ client/ e2e/) with docs as source of truth (CLAUDE.md, docs/PROJECT_PLAN.md,
docs/specs/gameplay-spec.txt wins on behaviour). Prompts 1–2 were done; implement Prompts 3–10 without changing stack
(Node + Express + Socket.IO authoritative server, React 18 + Redux Toolkit + Vite client, npm workspaces).
Out of scope: Media Center, journalists/lobbyists, bribery, voice chat, multiple maps, bots.

## Architecture
- shared/: types, event contracts, MATCH_SETTINGS/MINIGAME_ENABLED, puzzle types, pure rules, map (12 task stations, REPAIR_TASK_ID).
- server/: Match.ts (all validation), puzzles.ts (server-held answers), game/flow.ts (broadcasts, phase timers, victory), handlers.
- client/: api/ (socket + listeners), slices/ thunks, pages Join/Lobby/Game/Meeting/Results, helpers sprites/tiles/sound.
- Emergent preview: /app/frontend/package.json `start` → `npm run preview:emergent` (client :3000, server :8001, socket path /api/socket.io). No /app/backend (no Python).

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

## Backlog
- P1: deploy verification on Emergent hosting (Node server).
- P2: rejoin after disconnect, voice chat.
- Deployment: Emergent deploy pipeline expects backend/frontend layout — Node server deploy unverified.
