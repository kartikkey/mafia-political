# NETAGIRI: Parliament Under Siege — Plan for the remaining build (Prompts 3–10)

A 6–10 player browser game of hidden roles set in a fictional Indian Parliament, in 16-bit pixel art. Government MPs complete tasks and vote out infiltrators. Deep State agents eliminate MPs, cut the power and try to blend in.

## Who it's for
Groups of 6–10 friends or hackathon judges, each playing in their own desktop browser and joining one room with a 5-letter code. The game is played with the keyboard first, and every action also has a button you can click.

## What exists today (kept as is)
- Players can create and join a room. The lobby shows the roster and the character picker, and a new host is picked if the host leaves.
- The host can start once at least 6 players are in. Each player gets a private role, and Deep State players see their teammates. The role screen shows for 4 seconds.
- The Parliament map has 5 rooms. Players move with WASD, walls block movement, positions sync 20 times a second, and the server checks every move.
- Every remaining action already has a message format between the browser and the server. Each one currently answers "Not implemented yet". The plan fills these in and keeps the formats as they are.
- Differences from the docs:
  - The repo runs on ports 5173 and 3001. The preview link needs different ports, so these change (see Phase 1, step 0).
  - The PROJECT_PLAN Prompt 3 text has its "Visual:" line pasted into the middle of a sentence. This is cosmetic.
  - The code's own comments mark tasks as part of "Prompt 4". PROJECT_PLAN puts them in Prompt 3. PROJECT_PLAN is followed.

## Core features and experience
**Tasks and shared progress (Prompt 3).** Press E at a task station and a task window opens. Tasks start as hold-to-complete (4 seconds). The server marks a task done only once and the team progress bar updates for everyone. Deep State players see the same window, but finishing it changes nothing. Duplicate completions, players out of range and repeated requests are rejected.

**Three mini-games (Prompt 4).** These replace hold-to-complete. Each type keeps a hold fallback in case one breaks.
- File Sort: put 3 documents into the Budget, Defence and Welfare folders.
- Restore Power: connect 3 terminals, each labelled with a colour and a name.
- Approve the Bill: repeat a 3-symbol sequence.

The server makes each puzzle and keeps the answer. The browser only sends the player's attempt.

**Deep State actions (Prompt 5).**
- **Eliminate:** works only on a nearby living MP, and only when the 25s cooldown is ready. The cooldown starts only after a successful elimination. It leaves exactly one body.
- **Power Cut:** triggered at the power panel. It lasts 15s and shows a red warning banner and a light vignette, so the game stays playable. MPs can end it early with the Restore Power task. The repair panel is never blocked.
- **Who sees what:** MPs never see the Deep State buttons.
- **Eliminated players:** they can't move and see an "eliminated" banner.

**Report, meeting and vote (Prompt 6).**
- **Starting a meeting:** press Space or click Report near a body. An on-screen Emergency button also works from anywhere, with one 60s cooldown shared by the whole room.
- **Meeting sequence:** a 2s transition, 40s of discussion, 20s of voting, then 4s of results.
- **Chat:** living players can chat during discussion and voting, up to 140 characters, with a rate limit. Dead players can't send or read the chat.
- **Voting:**
  - Each living player confirms one vote or chooses Skip.
  - Others see that a player voted, but not who they voted for.
  - Voting closes early once everyone has voted.
  - A tie or a Skip win means nobody is removed.
  - A removed player's faction is shown to all.

**Victory and disconnects (Prompt 7).**
- **When the server checks:** after every task, elimination, vote result and disconnect.
- **Government wins:** all tasks done, or every agent removed.
- **Deep State wins:** living agents equal or outnumber living MPs.
- **Disconnects:** a player who drops out mid-match no longer counts and their open task is reset. Reconnecting puts them back at the Join screen.
- **Empty or ended rooms:** an empty room is closed. Nothing works after Game Over.

**Results (Prompt 8).** A winner banner in each side's colours:
- Government: "Democracy survives!"
- Deep State: "The government has fallen!"

A table shows every player's character, name, faction (label and colour), tasks done, eliminations, meetings attended and whether they're alive. The host has a "Back to Lobby" button. Other players see "Waiting for host…" and a Leave button.

**Polish (Prompt 9).**
- A breaking-news ticker for every public event.
- 8 pixel-art characters drawn in code (A1–A8), with idle, 4-direction walk, interact, eliminated and meeting frames. Each of the 5 rooms gets its own drawn tiles (green benches, cabinets, Speaker's chair, etc.).
- Short built-in sounds with a mute toggle.
- "Press E — station — action" prompts, and short error messages such as "Too far away" or "Cooldown: 8s".

**Acceptance pass (Prompt 10).** The 6-browser automated test is extended to cover every item on the Spec §13 checklist. Each item is reported as PASSED (actually run), FAILED (with output) or NOT RUN.

## User flow
Join (name and character) → Create Room or enter a code → Lobby (copy the code, host presses Start) → private Role Reveal → Parliament map (move, do tasks; agents eliminate and sabotage) → a body is reported or the Emergency button is pressed → Meeting (chat, vote, results showing the removed player's faction) → back to the map, or Game Over → Results with all roles shown → host returns everyone to the Lobby.

## UI/UX feel
Follows the repo's Visual Reference Pack and its colours: midnight navy, parliament green, paper beige, alert red and gold. Headings use Press Start 2P and body text uses VT323. UI has hard pixel borders and no rounded corners. The in-match screen layout:
- task list top-left;
- news bar along the top;
- "players alive" top-right;
- controls legend bottom-left;
- round Eliminate and Report buttons bottom-right.

Colour is never the only signal; there is always a label or icon too. Disabled buttons say why, and click targets are at least 44px.

## Conflicts and how they're resolved (the spec decides behaviour)
| Mismatch | Resolution |
|---|---|
| Boards show a 6th room, Media Center | Not added (out of scope, as you confirmed) |
| Boards use names like Journalist, Lobbyist, Party Whip | Neutral outfit names A1–A8 |
| Board legend says "R = Report" | Space is the main Report key; R works too |
| Results board has "Play Again" and "Back to Lobby" | One host "Back to Lobby" button |
| Board 2 lists 6 extra task names | Only the spec's 3 task types at the existing stations |
| Spec lists a 2s "Resume" phase that isn't in the game's phase sequence | The 4s results screen also counts as the 2s resume time; players get control back on the map right away |
| Spec suggests 12–15 tasks | The station count on the map is checked and adjusted to 12–15 if it differs |
| The task message format allows a Document Leak target | Not used; Power Cut is the only sabotage |
| The server has one phase timer, and meetings reset it | The Power Cut gets its own timer, so a meeting can't wipe or double-fire it; the outage is cleared when a meeting starts |

## Implementation phases
**Phase 1 — MVP, built now (feature freeze at hour 6)**
0. Make the game run on the Emergent preview link. The stack stays the same. Only the ports change (client on 3000, server on 8001), and the real-time connection runs under `/api` so it reaches the server. Done first, so all testing happens on the real link.
1. Hours 2–3: Tasks with hold-to-complete (P0), then the 3 mini-games (P1).
2. Hours 3–4: Elimination (P0) and Power Cut (P1).
3. Hours 4–5: Report, Emergency meeting, discussion, vote and results (P0), plus chat (counted as P0 because you asked for it).
4. Hours 5–6: Victory checks, disconnect handling (P0), then the Results screen (P0).
5. Hours 6–7: Polish: news ticker and sounds (P1), then code-drawn sprites and room tiles. Only bug fixes after hour 6.
6. Hours 7–8: Run the full Spec §13 checklist with 6 browsers, plus unit tests and type checks after every step. Fix critical bugs only.

**If time runs short, cut in this order:** room tile art → character animation frames (keep simple static sprites) → sounds → Approve the Bill and Restore Power mini-games (fall back to hold-to-complete) → File Sort → Power Cut. The P0 loop is never cut.

**Main risks**
- **Real-time connection on the preview link:** it must go through the `/api` path and needs WebSocket support. It falls back to slower polling if needed.
- **Settings:** the server and client addresses come from settings files. The allowed client address on the server must match the preview link.
- **Timing:** meeting timers can collide with late votes or disconnects. One timer drives the phases, and the server re-checks the phase before acting.
- **Load:** 10 players sending 20 updates a second each.
- **Art:** drawing sprites in code takes time, so it is limited to the hour-6 block.

**Phase 2 — after the MVP is accepted**
Second sabotage (Document Leak); optional map overlay (M); camera follow with zoom; fake task animation for Deep State.

**Phase 3 — later**
Voice chat in meetings (you mentioned this); rejoining a match after a disconnect; more complex puzzles.

## Assumptions
- The 5-letter room codes and the Join/Lobby flow stay exactly as they are.
- Task stations are shared, not assigned to individual players. The first valid completion wins.
- The emergency cooldown is shared by the whole room (60s) and starts again after every meeting. Reporting a body ignores it.
- The sabotage cooldown is 30s (the current setting). Starting a meeting ends an active Power Cut.
- Self-voting is off. If nobody votes, nobody is removed.
- Chat is only shown to living players. Dead players see a read-only "You are eliminated" notice instead.
- A disconnected player is removed from the living count immediately, with no grace period. A vote they already cast still counts.
- Sounds are built-in synthesized tones, so no audio files need to be produced.
- Desktop only. No mobile controls.
- Every gameplay number stays in the shared settings file.
