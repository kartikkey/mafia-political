import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageSquare } from 'lucide-react'
import { MATCH_SETTINGS, type PublicPlayer } from '@netagiri/shared'
import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import PixelButton from 'common/components/PixelButton'
import { sendChat } from 'slices/meeting/thunk'

/** Meeting text chat (Spec §8.5) — living players only; dead see a notice instead. */
export default function ChatPanel({ players, canChat, alive }: { players: PublicPlayer[]; canChat: boolean; alive: boolean }) {
  const dispatch = useAppDispatch()
  const chat = useAppSelector((s) => s.meeting.chat)
  const [text, setText] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chat.length])

  if (!alive) return <div className="chat chat--dead" data-testid="chat-dead-notice">You are eliminated — the chamber can no longer hear you.</div>

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    dispatch(sendChat(text.trim()))
    setText('')
  }

  return (
    <div className="chat" data-testid="chat-panel">
      <h2 className="chat__title"><MessageSquare size={14} aria-hidden /> Debate</h2>
      <ul className="chat__list" ref={listRef} data-testid="chat-messages">
        {chat.length === 0 && <li className="muted">No statements yet.</li>}
        {chat.map((m) => (
          <li key={m.id}>
            <strong>{players.find((p) => p.id === m.playerId)?.name ?? '?'}:</strong> {m.text}
          </li>
        ))}
      </ul>
      <form className="chat__form" onSubmit={onSend}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MATCH_SETTINGS.chatMaxLength}
          placeholder={canChat ? 'Make your case…' : 'Chat is closed'}
          disabled={!canChat}
          aria-label="Chat message"
          data-testid="chat-input"
        />
        <PixelButton type="submit" variant="green" disabled={!canChat || !text.trim()} data-testid="chat-send-btn">Send</PixelButton>
      </form>
    </div>
  )
}
