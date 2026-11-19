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

## Backlog
- P1: initial elimination cooldown at match start (spec silent; kills possible at spawn), camera follow/zoom, map overlay (M).
- P2: Document Leak sabotage, fake task animation for Deep State, rejoin after disconnect, voice chat.
- Deployment: Emergent deploy pipeline expects backend/frontend layout — Node server deploy unverified.
