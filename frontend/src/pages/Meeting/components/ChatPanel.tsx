import type { PublicPlayer } from '@netagiri/shared'
import { useAppSelector } from 'common/hooks/redux'
import ChatBox from 'components/ChatBox/ChatBox'

/** Living players debate (Spec §8.5); eliminated players only see and send ghost whispers. */
export default function ChatPanel({ players, canChat, alive }: { players: PublicPlayer[]; canChat: boolean; alive: boolean }) {
  const chat = useAppSelector((s) => s.meeting.chat)
  const ghostChat = useAppSelector((s) => s.game.ghostChat)
  if (!alive) return <ChatBox messages={ghostChat} players={players} canChat ghost testid="ghost-chat" />
  return <ChatBox messages={chat} players={players} canChat={canChat} testid="chat" />
}
