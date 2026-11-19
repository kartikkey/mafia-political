import { FACTION_COPY, type PublicPlayer, type RoleAssignment } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'
import PhaseTimer from 'components/PhaseTimer/PhaseTimer'

/** Private role screen (Spec §11.3). Only the local player's faction is shown. */
export default function RoleReveal({ role, players }: { role: RoleAssignment | null; players: PublicPlayer[] }) {
  if (!role) return <div className="role-reveal">Assigning roles…</div>
  const copy = FACTION_COPY[role.faction]
  const deep = role.faction === 'DEEP_STATE'
  const mates = players.filter((p) => role.teammateIds.includes(p.id))
  return (
    <div className={`role-reveal ${deep ? 'role-reveal--deep' : 'role-reveal--gov'}`}>
      <p className="muted">Your role</p>
      <h1>{deep ? '🕵 ' : '🏛 '}{copy.title}</h1>
      <p>{copy.objective}</p>
      {deep && (
        <div className="role-reveal__mates">
          <p>Your fellow agents:</p>
          {mates.map((m) => (
            <span key={m.id} className="role-reveal__mate">
              <Avatar avatar={m.avatar} size={32} /> {m.name}
            </span>
          ))}
        </div>
      )}
      <PhaseTimer label="Session begins in" />
    </div>
  )
}
