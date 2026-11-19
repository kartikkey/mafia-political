import type { PublicPlayer, RoleAssignment, TaskInstance } from '@netagiri/shared'
import PixelPanel from 'common/components/PixelPanel'
import Badge from 'common/components/Badge'

interface Props {
  role: RoleAssignment | null
  tasks: TaskInstance[]
  completed: number
  total: number
  players: PublicPlayer[]
}

/** Gameplay HUD (Spec §11.1): role, task list, shared progress, living count. */
export default function Hud({ role, tasks, completed, total, players }: Props) {
  const pct = total ? Math.round((completed / total) * 100) : 0
  const living = players.filter((p) => p.alive && p.connected).length
  const deep = role?.faction === 'DEEP_STATE'
  const mates = players.filter((p) => role?.teammateIds.includes(p.id))

  return (
    <aside className="hud">
      <PixelPanel title={deep ? 'Deep State' : 'Government'}>
        <Badge tone={deep ? 'error' : 'success'}>{deep ? 'Agent' : 'MP'}</Badge>{' '}
        <span>Living MPs: {living}</span>
      </PixelPanel>

      <PixelPanel title="Task progress">
        <div className="hud__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="hud__bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span>{completed}/{total} ({pct}%)</span>
      </PixelPanel>

      {deep ? (
        <PixelPanel title="Fellow agents">
          <ul className="hud__list">{mates.map((m) => <li key={m.id}>{m.name}{!m.alive && ' (down)'}</li>)}</ul>
        </PixelPanel>
      ) : (
        <PixelPanel title="Tasks">
          <ul className="hud__list">
            {tasks.map((t) => (
              <li key={t.taskId} className={t.status === 'COMPLETE' ? 'is-done' : ''}>
                {t.status === 'COMPLETE' ? '✔' : '□'} {t.label}
              </li>
            ))}
          </ul>
        </PixelPanel>
      )}
    </aside>
  )
}
