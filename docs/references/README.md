# Visual References

Concept boards that set the look of NETAGIRI. They are **visual direction only**:
the Visual Reference Pack itself says they are "not production-ready sprite sheets
or final UI assets". Redraw assets cleanly. When a board disagrees with
`docs/specs/gameplay-spec.txt` about rules, labels, player counts or rooms,
**the spec wins** (see "Conflicts" below).

| File | Source | Use it for |
|---|---|---|
| [`boards/board-1-characters-map-screens.webp`](boards/board-1-characters-map-screens.webp) | Visual Reference Pack p.3 (same image as the uploaded overview) | Overview: 8 character sprites A1–A8, animation states, full map, room close-ups, lobby / role reveal / meeting / HUD / results screens, icon set, palette, mini-games, props |
| [`boards/board-2-detailed-layout.webp`](boards/board-2-detailed-layout.webp) | Visual Reference Pack p.4 | Detailed layout: map with compass, room purposes, in-match HUD (task list, "8 Players Alive", Report/Eliminate buttons), lobby with room code + character picker, role reveal, voting checkboxes + Skip/Confirm, end screen with match summary |
| [`boards/board-3-full-visual-overview.webp`](boards/board-3-full-visual-overview.webp) | Visual Reference Pack p.5 | **Canonical palette + fonts** (used in `_tokens.scss`), art direction notes, tile/map overview, player journey from lobby to results |
| [`extra/character-sprite-sheet-a1-a8.webp`](extra/character-sprite-sheet-a1-a8.webp) | Uploaded separately | **Sprite sheet spec**: A1–A8 × Idle (4 frames), Walk (4 directions, 4 frames), Interact (3 frames), Eliminated (4 frames), Meeting/Talking (4 frames) |
| [`extra/key-art-poster.webp`](extra/key-art-poster.webp) | Uploaded separately | Key art / title screen / marketing. Logo treatment, "PLAY NETAGIRI" button, Government-vs-Deep-State red/green split |

Original PDF: [`../specs/NETAGIRI_Visual_Reference_Pack.pdf`](../specs/NETAGIRI_Visual_Reference_Pack.pdf)

## Where each reference applies

| Screen / asset | Primary reference | Code location |
|---|---|---|
| Palette & fonts | Board 3 → Colour Palette, Font | `client/src/assets/scss/_tokens.scss` |
| Character choices A1–A8 | Sprite sheet, Board 1 → Characters | `client/src/helpers/avatars.ts` |
| Character animations | Sprite sheet (frame counts above) | `client/src/assets/images/sprites/` (to be drawn), `ParliamentCanvas.tsx` |
| Parliament map & rooms | Boards 1–3 → Parliament Map, Area Snapshots | `shared/src/map/parliament.ts`, `ParliamentCanvas.tsx` |
| Join / title | Key art poster | `client/src/pages/Join` |
| Lobby | Board 1 & 2 → Lobby (room code card, ◀ character ▶ picker, roster with green dots, Start Game) | `client/src/pages/Lobby` |
| Role reveal | Boards 1 & 2 → Role Reveal (green Government / red Deep State split, silhouette for agent) | `pages/Game/components/RoleReveal.tsx` |
| In-match HUD | Board 1 & 2 → Gameplay UI (task list top-left, BREAKING NEWS bar top, players-alive top-right, controls legend bottom-left, round Eliminate/Report buttons bottom-right) | `pages/Game/components/Hud.tsx`, `ActionBar.tsx`, `components/NewsTicker` |
| Emergency meeting / voting | Boards 1 & 2 → Emergency Meeting (portrait row, discussion/voting timers, "Vote for: X", Confirm Vote, Skip Vote) | `client/src/pages/Meeting` |
| Results | Boards 1 & 2 → End Result (laurel "GOVERNMENT WINS!", match summary: duration, tasks completed, eliminations; players & roles list) | `client/src/pages/Results` |
| Mini-games | Boards 1 & 2 → Mini-games (File Sorting into Budget/Defence/Welfare; Restore Power wires; Approve the Bill symbol sequence) | `pages/Game/components/minigames/` |
| Icons | Board 1 & 2 → UI Assets & Icons (Tasks, Players, Report, Meeting, Vote, Settings, Eliminate, Sabotage, Files, Computer, Records, Power, Chat, Map, Info, Close, Start) | `client/src/assets/images/icons/` (to be drawn) |
| Props | Board 1 → Other Referenced Assets (flag, gavel, plant, bust, bookshelf, desk, Ashoka emblem, red carpet, green bench) | tileset (Prompt 9) |

## Palette as shown on each board

| Name | Board 3 (canonical) | Board 1 | Board 2 | Token |
|---|---|---|---|---|
| Midnight navy | #1B2B3D | #1B2B3D | #1B283D | `--c-primary` |
| Parliament green | #607B57 | #607B57 | #607B57 | `--c-green` |
| Paper beige | #D8C8A4 | #D8C8A4 | #D8C8A4 | `--c-beige` |
| Alert red | #A8463D | #A8463D | #A8463D | `--c-red` |
| Accent | #F2C14E gold | #6B5B95 purple | — | `--c-accent` (gold) / `--c-purple` |
| Ivory / cream | — | #F5E6C8 | #F4E6C1 | `--c-ivory` |

Fonts: Press Start 2P (headings, UI) + VT323 (body, labels), Board 3.

## Conflicts with the written spec (spec wins; flagged for a decision)

| Board shows | Spec says | What we do |
|---|---|---|
| A sixth room, **Media Center / Media Centre** ("Leaks & Scandals") | Exactly 5 areas (Lok Sabha, PM Office, Finance Ministry, Records Room, Central Hall); scandals and evidence are out of scope | Not on the map. Ask before adding it, even as decoration. |
| Board 2 cosmetic names "Journalist", "Lobbyist", "Agent", "Party Whip" | Journalist/lobbyist factions are out of scope; roles stay hidden | Use the neutral A1–A8 outfit names from the sprite sheet. No role-like names. |
| HUD legend "R Report", "M Map" | Space = Report, M = optional map (§3.1) | Space is primary. R can be an extra Report key; it doesn't conflict with anything. |
| Example names (Aarav, Meera, Raghav…), "Players (6/10)" | Real player names, 6–10 | Placeholders only. |
| "Play Again" + "Back to Lobby" on results | Host returns room to lobby | One host "Back to Lobby" button. "Play Again" = same action. |
| Board 2 task list has 6 extra task names (Calibrate System, Verify Reports…) | 3 mini-game types; stations in `parliament.ts` | Keep the spec's tasks. |
