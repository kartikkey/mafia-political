# NETAGIRI — Project Plan & Build Prompts

Generated from the three source documents in `docs/specs/`. The **Gameplay Spec**
is the behavioural source of truth; the **Visual Reference Pack** defines appearance.

---

## Project overview

| | |
|---|---|
| **Project** | NETAGIRI: Parliament Under Siege |
| **Type** | Real-time multiplayer social-deduction browser game (2D top-down, pixel art) |
| **Players** | 6–10 per room · 10–15 min matches |
| **Core entity** | Match (one per room code) |
| **Summary** | Players are secretly Government MPs or Deep State agents in a fictional Indian Parliament. MPs complete tasks and vote out infiltrators; agents eliminate, sabotage and blend in. Emergency sessions in the Lok Sabha drive discussion and voting. |

Core loop: **complete tasks → sabotage & investigate → report → debate → vote → reveal**.

---

## Roles (factions)

| Faction | Count (6/7/8/9/10 players) | Sees | Can do | Wins when |
|---|---|---|---|---|
| Government | 4/5/6/6/7 | own role only | move, tasks, report, emergency meeting, chat, vote | tasks 100% **or** all agents voted out |
| Deep State | 2/2/2/3/3 | own role + teammates | move, fake tasks, eliminate (25s cd), sabotage, report, meeting, chat, vote | living agents ≥ living MPs |
| Host (any faction) | 1 | — | start match, return room to lobby | — |
| Eliminated | — | — | nothing: no move, interact, vote or chat | — |

---

## State machine

```
WAITING ──host start (≥6)──▶ ROLE_ASSIGNMENT ──4s──▶ PLAYING
PLAYING ──report body / emergency──▶ MEETING_TRANSITION ──2s──▶ DISCUSSION ──40s──▶ VOTING
VOTING ──20s or all voted──▶ VOTE_RESULTS ──4s──▶ PLAYING (no winner) | GAME_OVER
PLAYING ──task done / elimination / disconnect + victory──▶ GAME_OVER
GAME_OVER ──host "Back to Lobby"──▶ WAITING
```

| State | Locked | Unlocked |
|---|---|---|
| WAITING | gameplay | join/leave, avatar, host start |
| ROLE_ASSIGNMENT | movement, actions | private role screen |
| PLAYING | chat, voting | move, tasks, eliminate, sabotage, report, meeting |
| MEETING_* / DISCUSSION | movement, tasks, actions; task modals close | chat (living only) |
| VOTING | as above | one confirmed vote or Skip |
| VOTE_RESULTS | everything | tally + ejected faction reveal |
| GAME_OVER | everything | results + full role reveal |

---

## Modules

| # | Module | Type | Complexity | Depends on | Status |
|---|---|---|---|---|---|
| 1 | Join (create/join room) | auth-like (flat) | simple | — | ✅ |
| 2 | Lobby | read-only + host action | simple | Join | ✅ |
| 3 | Game › Map & movement | real-time canvas | medium | Lobby | ✅ (placeholder art) |
| 4 | Game › Tasks & progress | embedded (HUD + modal) | medium | 3 | ⏳ |
| 5 | Game › Mini-games ×3 | embedded modals | medium | 4 | ⏳ |
| 6 | Game › Deep State actions | embedded | complex | 3 | ⏳ |
| 7 | Meeting (report, discuss, vote) | wizard-like phases | complex | 6 | ⏳ |
| 8 | Victory / disconnects | server state machine | complex | 4, 6, 7 | ⏳ |
| 9 | Results (final reveal) | read-only | simple | 8 | ⏳ |
| 10 | Polish (news, sound, sprites) | cross-cutting | medium | all | ⏳ |

## Screen flow (replaces a sidebar nav — this is a game)

```
/                     Join      name · character · Create Room / Join by code
/lobby/:roomCode      Lobby     roster · room code (copy) · host Start
/game/:roomCode       Game      role reveal overlay → map + HUD + action bar + task modals
/meeting/:roomCode    Meeting   discussion · chat · vote cards · Skip · tally
/results/:roomCode    Results   winner banner · full reveal table · Back to Lobby (host)
```

All in-room routes are wrapped in `RoomProtected` and follow the server's
`match.state` via `useMatchNavigation()` (`client/src/constants/routes.ts → pathForState`).

---

## Build order (maps to the spec's 8-hour plan, §14)

```
Phase 1 — Foundation         (0:00–2:00)   ✅  Prompt 1 Join+Lobby+Roles · Prompt 2 Map+Movement
Phase 2 — Government loop    (2:00–3:00)       Prompt 3 Tasks (hold-to-complete first) · Prompt 4 Mini-games
Phase 3 — Deep State         (3:00–4:00)       Prompt 5 Elimination + Power Cut
Phase 4 — Social deduction   (4:00–5:00)       Prompt 6 Report → Meeting → Vote
Phase 5 — Match end          (5:00–6:00)       Prompt 7 Victory + disconnects · Prompt 8 Results
Phase 6 — Polish             (6:00–7:00)       Prompt 9 News, sound, sprites, feedback
Phase 7 — Stabilise          (7:00–8:00)       Prompt 10 Acceptance test pass. STOP adding features at hour 6.
```

Priority cut line (Spec §14.1): **P0** lobby, roles, movement, map, task
progress, elimination, report, meeting, voting, win, results. **P1** one
sabotage, 1–2 real mini-games, ticker, sounds. **P2 (skip)** extra sabotages,
full chat, map overlay, cosmetics.

---

## Claude Code prompts

Each prompt assumes `CLAUDE.md` is loaded. Keep the game runnable after each.

### PROMPT 1 — Join, Lobby & Role Assignment ✅ DONE

Implemented: `CREATE_ROOM`, `JOIN_ROOM`, `SET_AVATAR`, `START_GAME`,
`LEAVE_ROOM`/disconnect, host reassignment, private `ROLE_ASSIGNED` with Deep
State teammate ids, 4s role reveal → `PLAYING`. Tests in
`server/src/game/Match.test.ts`; e2e in `e2e/smoke.cjs`.

### PROMPT 2 — Map, Movement & Sync ✅ DONE (art pending)

Implemented: shared tile grid (`shared/src/map/parliament.ts`) with 5 rooms,
corridors, furniture; WASD/arrow movement with normalised diagonals and
per-axis wall sliding; 20 Hz sync; server rejects walls/teleports and snaps
back. Remaining: replace flat-colour rendering with 16-bit tiles & 4-direction
sprites from the Visual Pack (do in Prompt 9).

### PROMPT 3 — Task System & Shared Progress

```
Read CLAUDE.md first. Implement Spec §5 (task system) with the §6.4 HOLD fallback first.

Server (server/src/game/Match.ts + handlers/gameHandlers.ts):
- TASK_OPENED {taskId}: validate PLAYING, alive, task exists, withinRange(player, task,
  MATCH_SETTINGS.interactionRange), task not COMPLETE/DISABLED. Deep State: return a fake
  puzzle and never change state (Spec §7.3). Government: mark IN_PROGRESS for that player,
  record openedAt, return { puzzle } (for HOLD: { type:'HOLD', ms: holdTaskMs }).
- TASK_COMPLETED {taskId, payload}: Government only; still in range; for HOLD require
  now - openedAt >= holdTaskMs; first valid request wins, duplicates rejected; set COMPLETE,
  increment per-player tasksCompleted stat, emit TASK_PROGRESS to room, then checkVictory().
- Reset IN_PROGRESS → AVAILABLE when a meeting starts or the player dies/leaves.
- Rate-limit task requests per socket (basic, Spec §12.1).

Client:
- Game page: E key (ignore when typing in inputs) dispatches openTask(nearTask.taskId).
- pages/Game/components/TaskModal.tsx using common Modal: title = task.label, short
  instruction, HOLD progress bar, Close (Esc). Auto-closes when state != PLAYING
  (game reducer already clears activeTaskId).
- Deep State sees the same modal; completion silently does nothing visible to others.
- Hud: completed tasks struck through; progress bar from server counts only.

Tests: duplicate completion ignored; Deep State cannot increase progress; out-of-range
rejected; task victory fires at 100%; totalTasks 0 never wins.
```

### PROMPT 4 — Mini-games

```
Read CLAUDE.md first. Replace HOLD with the three Spec §6 mini-games, keeping HOLD as a
fallback per task type flag. Folder: client/src/pages/Game/components/minigames/.

Puzzles are generated server-side in server/src/game/puzzles.ts and kept on the Match;
only the prompt goes to the client, never the answer.

- FILE_SORT (§6.1): 3 docs → folders Budget/Defence/Welfare. Click doc then folder
  (drag optional). Wrong placement bounces back with brief feedback. Submit
  {docId: folderId}; server checks exact mapping.
- RESTORE_POWER (§6.2): 3 coloured left terminals → shuffled right terminals. Click
  source then destination, draw line, allow replace. Submit pairs. Colour + text label
  on each terminal (no colour-only).
- APPROVE_BILL (§6.3): 4 symbols (book, rupee, building, flag). Flash a 3-symbol
  sequence, then accept clicks; wrong → reset "Try again". Submit sequence.

Each: title, one-line instruction, close button, 5–12s to solve, mouse-only usable,
success sound + toast. Server validates every submission (never trust client success).
Tests for each validator (correct, wrong, replayed after COMPLETE).
```

### PROMPT 5 — Deep State: Elimination & Power Cut

```
Read CLAUDE.md first. Implement Spec §7.

Elimination (PLAYER_ELIMINATE_REQUEST {targetId}):
- Reject unless: state PLAYING, actor alive & DEEP_STATE, target alive & GOVERNMENT &
  connected, withinRange(eliminationRange), now >= actor.eliminationReadyAt.
- On success: target.alive=false, create Body {bodyId, playerId, position, roomId}, set
  actor.eliminationReadyAt = now + 25s (only on success), emit PLAYER_ELIMINATED to room,
  COOLDOWN to actor only, stats++, checkVictory().
- Concurrent requests on the same target: second fails because target is dead.

Power Cut (SABOTAGE_REQUEST {type:'POWER_CUT'}):
- Deep State, alive, PLAYING, within interactionRange of POWER_PANEL, sabotage cooldown.
- powerStatus=OUT, powerRestoreAt=now+15s; emit MATCH_STATE + NEWS POWER_SABOTAGED.
- Timer restores → NEWS POWER_RESTORED. Government completing a RESTORE_POWER task during
  an outage restores early. Never block access to the repair panel.

Client:
- ActionBar adds role-specific buttons: Eliminate (nearest eligible target in range,
  shows "Cooldown: Ns" from server timestamp), Sabotage (near power panel).
  Government never sees these buttons.
- Canvas: draw bodies (grey sprite + pulsing marker when within reportRange);
  Power Cut = vignette/darkness overlay + red warning banner (keep playable; Spec §7.2).
- Dead local player: movement disabled, "You have been eliminated" banner, spectator view.

Tests: teammate kill rejected; out-of-range rejected; rejected attempt doesn't consume
cooldown; body created exactly once; parity win after kill.
```

### PROMPT 6 — Reporting, Meetings & Voting

```
Read CLAUDE.md first. Implement Spec §8 and the meeting states of §9.1.

Server:
- BODY_REPORTED {bodyId}: alive reporter within reportRange of an unreported body; mark
  reported; bypasses emergency cooldown. EMERGENCY_MEETING: alive, PLAYING, now >=
  emergencyAvailableAt (global 60s). Communication Breakdown not in scope.
- startMeeting(reason, callerId, bodyId?): close all tasks, emit MEETING_STARTED + NEWS
  (BODY_REPORTED or MEETING_STARTED), setState MEETING_TRANSITION 2s → DISCUSSION 40s →
  VOTING 20s → VOTE_RESULTS 4s. Increment meetingsAttended for living players.
- CHAT_SEND: living players, DISCUSSION or VOTING only, sanitise, max 140 chars, rate
  limit 750ms; broadcast CHAT_MESSAGE to living players' sockets only.
- VOTE_SUBMITTED {choice}: VOTING only, alive voter, one confirmed vote, target must be
  living & not self (or 'SKIP'). Broadcast VOTE_CAST {voterId} (not the choice). Close
  voting early when all eligible living voters have voted.
- Results: tallyVotes() from shared; eject → alive=false, revealedFaction set; emit
  VOTE_RESULTS {counts, ejectedPlayerId, ejectedFaction} + NEWS PLAYER_VOTED_OUT or
  NO_EJECTION; checkVictory(); else respawn everyone at SPAWN_POINTS and → PLAYING;
  emergencyAvailableAt = now + 60s.
- Disconnect during voting: exclude from eligible voters, keep a cast vote (§8.6).

Client (pages/Meeting/):
- Header: "Emergency Session" + reason (body found / called by X) + PhaseTimer.
- Grid of PlayerVoteCard (living players, dead ones greyed), VOTED marker from VOTE_CAST.
- VOTING: select a card or Skip Vote → Confirm. Esc must not cancel a confirmed vote.
- components/ChatPanel.tsx (hidden/read-only for dead players).
- VOTE_RESULTS: tally bars per option incl. Skip, "X was Deep State / was not Deep State".

Tests: tie → none; skip plurality → none; double vote rejected; dead can't vote/chat;
report twice → one meeting.
```

### PROMPT 7 — Victory, Disconnects & Game Over

```
Read CLAUDE.md first. Implement Spec §9.2–9.3 and §12.

- Central match.finishIfWon(io): result = checkVictory(); if not NO_WINNER → setState
  GAME_OVER, set revealedFaction on everyone, emit MATCH_STATE + GAME_OVER {result,
  stats: PlayerMatchStats[]} + NEWS GOVERNMENT_WINS/DEEP_STATE_WINS.
- Call it after task completion, elimination, vote results and disconnect (replace the
  TODO in lobbyHandlers leave()).
- Mid-match disconnect: connected=false, excluded from living counts, open task reset.
  Rejoin is NOT supported for MVP — a reconnecting browser starts at Join.
- All players gone → dispose room. Host leaves → next connected player becomes host.
- Reject every action when state is GAME_OVER.

Tests: all government gone → Deep State wins; last agent voted out → Government wins;
disconnect triggers parity win; actions after GAME_OVER rejected.
```

### PROMPT 8 — Results Screen

```
Read CLAUDE.md first. Complete pages/Results per Game Design §9.

- Government win: "Democracy survives!" + "The Deep State conspiracy has been exposed."
  Deep State win: "The government has fallen!" + "Parliament has been infiltrated."
  Distinct palette per outcome (green/gold vs alert red).
- RevealTable: every player's avatar, name, faction badge (label + colour), tasks
  completed, eliminations, meetings attended, alive/eliminated.
- Host: "Back to Lobby" (RETURN_TO_LOBBY). Others: "Waiting for host…" + Leave.
- Slice: results.gameOver from GAME_OVER; reset on return.
```

### PROMPT 9 — Polish: News Ticker, Sound, Sprites, Feedback

```
Read CLAUDE.md first. Spec §11 + Game Design §8 + Visual Pack.

- Emit NEWS from every server event listed in shared/src/constants/news.ts.
- Sprites: 16-bit politician sprites (kurta, bandhgala, saree, Nehru jacket…) with
  idle / walk ×4 directions / interact / eliminated states in assets/images; tileset
  for each room (Lok Sabha green benches + Speaker's chair, PM Office, Finance Ministry,
  Records Room cabinets, Central Hall). Replace flat fills in ParliamentCanvas.
- Optional camera follow with zoom (keep whole-map fallback).
- Short sounds (assets/sounds): task success, elimination, report siren, vote, win/lose.
  Mute toggle stored in localStorage via helpers/storage.
- Interaction prompts: "Press E — <station> — <action>", invalid reasons from server
  acks shown in ActionBar feedback for ~2s.
```

### PROMPT 10 — Acceptance Test Pass

```
Read CLAUDE.md first. Extend e2e/smoke.cjs (Playwright, 6 contexts) to cover every
item of Spec §13. Run it, fix critical bugs only, and report each checklist item as
PASSED (actually run), FAILED (with output) or NOT RUN. Never claim untested passes.
```

---

## Setup notes (Foundation step adapted)

The project-starter "Foundation design system" step is replaced by the in-repo
pixel design system, because NETAGIRI's look comes from its own Visual
Reference Pack:

- Brand colours & fonts → `client/src/assets/scss/_tokens.scss`
  (navy #1B2B3D · green #607B57 · beige #D8C8A4 · red #A8463D · gold #F2C14E;
  Press Start 2P + VT323).
- Shared primitives → `client/src/common/components/` (PixelButton, PixelPanel,
  Badge, Avatar, Modal).
- App name / logo → `client/index.html` title and `pages/Join` header.
