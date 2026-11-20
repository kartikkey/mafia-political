import { Landmark, VenetianMask } from 'lucide-react'
import { FACTION_COPY, type PublicPlayer, type RoleAssignment } from '@netagiri/shared'
import Avatar from 'common/components/Avatar'
import PhaseTimer from 'components/PhaseTimer/PhaseTimer'

/** Private role screen (Spec §11.3). Only the local player's faction is shown. */
export default function RoleReveal({ role, players }: { role: RoleAssignment | null; players: PublicPlayer[] }) {
  if (!role) return <div className="role-reveal">Assigning roles…</div>
  const copy = FACTION_COPY[role.faction]
  const deep = role.faction === 'DEEP_STATE'
  const mates = players.filter((p) => role.teammateIds.includes(p.id))
  const Icon = deep ? VenetianMask : Landmark
  return (
    <div className={`role-reveal ${deep ? 'role-reveal--deep' : 'role-reveal--gov'}`} data-testid="role-reveal">
      <p className="muted">Your role</p>
      <Icon size={64} aria-hidden className="role-reveal__icon" />
      <h1 data-testid="role-reveal-title">{copy.title}</h1>
      <p>{copy.objective}</p>
      {deep && (
        <div className="role-reveal__mates" data-testid="role-reveal-teammates">
          <p>Your fellow agents:</p>
          {mates.map((m) => (
            <span key={m.id} className="role-reveal__mate">
              <Avatar avatar={m.avatar} size={36} /> {m.name}
            </span>
          ))}
        </div>
      )}
      <PhaseTimer label="Session begins in" />
    </div>
  )
}
