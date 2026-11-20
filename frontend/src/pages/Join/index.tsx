import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import PixelButton from 'common/components/PixelButton'
import MuteToggle from 'common/components/MuteToggle'
import PixelPanel from 'common/components/PixelPanel'
import Avatar from 'common/components/Avatar'
import { AVATARS } from 'helpers/avatars'
import { load, save } from 'helpers/storage'
import { STORAGE_KEYS } from 'config/constants'
import { PATHS } from 'constants/routes'
import { createRoom, joinRoom } from 'slices/join/thunk'
import { clearJoinError } from 'slices/join/reducer'
import './Join.scss'

export default function Join() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { roomCode, submitLoading, error, connected } = useAppSelector((s) => s.join)

  const [name, setName] = useState(() => load(STORAGE_KEYS.name) ?? '')
  const [avatar, setAvatar] = useState(() => Number(load(STORAGE_KEYS.avatar) ?? 0) % AVATARS.length)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (roomCode) navigate(PATHS.lobby(roomCode))
  }, [roomCode])

  const remember = () => {
    save(STORAGE_KEYS.name, name)
    save(STORAGE_KEYS.avatar, String(avatar))
  }

  const onCreate = () => {
    remember()
    dispatch(createRoom({ name: name.trim(), avatar }))
  }

  const onJoin = (e: FormEvent) => {
    e.preventDefault()
    remember()
    dispatch(joinRoom({ roomCode: code.trim(), name: name.trim(), avatar }))
  }

  return (
    <div className="page join">
      <div className="page-corner"><MuteToggle /></div>
      <header className="join__brand">
        <h1>NETAGIRI</h1>
        <p className="join__sub">PARLIAMENT UNDER SIEGE</p>
        <p className="muted">Power is temporary. Betrayal is permanent.</p>
      </header>

      <PixelPanel title="Enter Parliament" className="join__panel">
        <label className="join__field">
          <span>Your name</span>
          <input value={name} maxLength={16} onChange={(e) => { setName(e.target.value); dispatch(clearJoinError()) }} placeholder="Hon. Member" />
        </label>

        <div className="join__avatars" role="radiogroup" aria-label="Choose your politician">
          {AVATARS.map((a, i) => (
            <button key={a.name} type="button" role="radio" aria-checked={avatar === i} className={`join__avatar ${avatar === i ? 'is-selected' : ''}`} onClick={() => setAvatar(i)} title={a.name}>
              <Avatar avatar={i} size={40} />
            </button>
          ))}
        </div>

        <PixelButton variant="primary" size="lg" disabled={submitLoading || name.trim().length < 2 || !connected} onClick={onCreate}>
          Create Room
        </PixelButton>

        <form className="join__code" onSubmit={onJoin}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={5} aria-label="Room code" />
          <PixelButton variant="green" type="submit" disabled={submitLoading || code.length < 5 || name.trim().length < 2 || !connected}>
            Join
          </PixelButton>
        </form>

        {!connected && <p className="muted">Connecting to server…</p>}
        {error && <p className="error-text" role="alert">{error}</p>}
      </PixelPanel>
    </div>
  )
}
