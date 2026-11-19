# NETAGIRI — Parliament Under Siege

> Power is temporary. Betrayal is permanent.

A 6–10 player multiplayer social-deduction browser game set in a fictional
Indian Parliament. Government MPs complete parliamentary tasks and vote out
infiltrators; undercover Deep State agents sabotage, eliminate and manipulate
emergency votes.

![Gameplay](docs/screenshots/game.png)

## Quick start

```bash
nvm use            # Node 22
npm install
npm run dev        # server http://localhost:3001 · client http://localhost:5173
```

Open the client in 6+ browser windows (or devices on your LAN — set
`VITE_SERVER_URL` in `client/.env` and `CLIENT_ORIGIN` in `server/.env`), create
a room in one, join with the 5-letter code in the others, and start.

| Command | What it does |
|---|---|
| `npm run dev` | Server (tsx watch) + client (Vite) together |
| `npm test` | Vitest — shared rules + server match logic |
| `npm run typecheck` | `tsc` across shared, server, client |
| `npm run build` | Production client build → `client/dist` |
| `node e2e/smoke.cjs` | 6-browser Playwright smoke (lobby → roles → movement); needs `npm run dev` |

## Controls

| Key | Action |
|---|---|
| WASD / Arrows | Move |
| E | Interact (task / sabotage object) |
| Space | Report nearby body |
| Esc | Close task panel |

## Repository layout

```
shared/   types, Socket.IO event contracts, settings, pure rules, Parliament map
server/   authoritative Socket.IO game server
client/   React + Redux Toolkit client (mecord folder structure)
docs/     specs (source of truth), PROJECT_PLAN.md (modules + build prompts), screenshots
e2e/      multi-client smoke test
```

See [`CLAUDE.md`](CLAUDE.md) for architecture rules and
[`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) for the module breakdown and
the step-by-step build prompts.

## Status

| Phase | Status |
|---|---|
| 1. Lobby, room codes, private roles | ✅ done, e2e-verified with 6 clients |
| 2. Parliament map, movement, collision, sync | ✅ done (placeholder art) |
| 3. Tasks + shared progress | ⏳ Prompt 3 |
| 4. Mini-games | ⏳ Prompt 4 |
| 5. Elimination + sabotage | ⏳ Prompt 5 |
| 6. Report → meeting → vote | ⏳ Prompt 6 |
| 7. Victory, disconnects, game over | ⏳ Prompt 7 |
| 8. Results reveal | ⏳ Prompt 8 |
| 9. Polish: news, sound, sprites | ⏳ Prompt 9 |
