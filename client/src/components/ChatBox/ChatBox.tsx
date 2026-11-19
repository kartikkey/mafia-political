import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Ghost, MessageSquare } from 'lucide-react'
import { MATCH_SETTINGS, type ChatMessage, type PublicPlayer } from '@netagiri/shared'
import { useAppDispatch } from 'common/hooks/redux'
import PixelButton from 'common/components/PixelButton'
import { sendChat } from 'slices/meeting/thunk'
import './ChatBox.scss'

interface Props {
  messages: ChatMessage[]
  players: PublicPlayer[]
  canChat: boolean
  ghost?: boolean
  testid: string
}

/** Text chat used for the living debate and for ghost whispers (server routes by alive state). */
export default function ChatBox({ messages, players, canChat, ghost = false, testid }: Props) {
  const dispatch = useAppDispatch()
  const [text, setText] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages.length])

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    dispatch(sendChat(text.trim()))
    setText('')
  }
  const Icon = ghost ? Ghost : MessageSquare

  return (
    <div className={`chat ${ghost ? 'chat--ghost' : ''}`} data-testid={testid}>
      <h2 className="chat__title"><Icon size={14} aria-hidden /> {ghost ? 'Ghost whispers — only the eliminated can hear' : 'Debate'}</h2>
      <ul className="chat__list" ref={listRef} data-testid={`${testid}-messages`}>
        {messages.length === 0 && <li className="muted">{ghost ? 'The afterlife is quiet…' : 'No statements yet.'}</li>}
        {messages.map((m) => (
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
          placeholder={canChat ? (ghost ? 'Whisper to other ghosts…' : 'Make your case…') : 'Chat is closed'}
          disabled={!canChat}
          aria-label={ghost ? 'Ghost whisper' : 'Chat message'}
          data-testid={`${testid}-input`}
        />
        <PixelButton type="submit" variant="green" disabled={!canChat || !text.trim()} data-testid={`${testid}-send-btn`}>Send</PixelButton>
      </form>
    </div>
  )
}
