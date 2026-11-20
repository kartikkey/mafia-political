# NETAGIRI Lobby: Invite Link and Single-Bot Removal

The host can copy an invite link from the lobby and send it to friends. A friend who opens the link lands on the join screen with the room code already filled in.
In the lobby, the host can also remove any single bot, or remove all bots at once as today.

## Who it's for
- **Hosts** who create a room and want to bring friends in quickly, without reading the room code out loud.
- **Invited friends**, who open a link and only need to type their name.

## Core features and experience
- **Copy invite link (lobby):**
  - The lobby shows a "Copy invite link" button next to the room code.
  - Tapping it copies a link like `https://deep-state-game.emergent.host/?room=ABCDE` and shows a short "Link copied" confirmation.
  - On phones that support it, a "Share" option opens the phone's own share sheet (WhatsApp, Messages and so on).
  - If copying isn't allowed, the link is shown selected in a small box so it can be copied by hand.
  - Every player in the lobby sees the button, not just the host.
- **Opening an invite link:**
  - The link opens the join screen with the room code already filled in, and a note says "You're invited to room ABCDE".
  - The friend picks a name and an avatar, then taps Join.
  - The usual errors still apply: room not found, match already started, name taken, room full.
- **Remove a single bot (host only, lobby):**
  - Each bot in the lobby player list has its own small remove (×) button.
  - Removing a bot frees its seat right away, and everyone's lobby list updates.
  - The existing "Remove all bots" button stays.
  - Players who aren't the host don't see the remove buttons, and the server rejects removal requests from them.

## User flow
1. The host creates a room and lands in the lobby.
2. The host taps "Copy invite link" and pastes it into a chat.
3. A friend opens the link and sees the join screen with the room code filled in. They type a name and tap Join.
4. The host fills the empty seats with bots, then removes single bots with × as friends arrive.
5. The host starts the match when there are enough players.

## UI/UX feel
- Matches the current 16-bit Parliament look: the same pixel fonts, colours and button styles.
- The copy button briefly changes to "Copied" with a tick. The × on a bot row is small and appears clearly on hover or tap.
- On phones, the invite link and remove buttons are easy to tap.

## Implementation phases
- **Phase 1 (MVP, built now):**
  - Copy invite link, plus the phone share option.
  - Join screen with the room code filled in from the link.
  - Per-bot remove button for the host, checked by the server.
  - Existing "Remove all bots" kept.
- **Phase 2:**
  - Show a QR code of the invite link in the lobby, for friends in the same room.
  - Let the host kick a human player out of the lobby.
- **Phase 3:**
  - Private or public rooms.
  - A "Play again with the same group" link after the match.

## Assumptions
- The link uses the address of whichever site is open (preview or live), so it works in both.
- The link only fills in the code. The friend still chooses their name and avatar.
- Any player in the lobby can copy the link. Only the host can remove bots.
- Bots can only be removed in the lobby, never during a match.
- Removing a bot doesn't add a replacement. The host can tap "Fill seats with bots" again.
- If the link's room no longer exists, the friend sees the normal "Room not found" message and can type another code.
