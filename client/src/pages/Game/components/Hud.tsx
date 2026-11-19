import { useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardList } from 'lucide-react'
import type { PublicPlayer, RoleAssignment, TaskInstance } from '@netagiri/shared'
import Badge from 'common/components/Badge'

interface Props {
  role: RoleAssignment | null
  leakedIds: string[]
  tasks: TaskInstance[]
  completed: number
  total: number
  players: PublicPlayer[]
}

/** Top-left HUD (Spec §11.1): role, shared progress, task list (or fellow agents). */
export default function Hud({ role, leakedIds, tasks, completed, total, players }: Props) {
  const pct = total ? Math.round((completed / total) * 100) : 0
  const deep = role?.faction === 'DEEP_STATE'
  const mates = players.filter((p) => role?.teammateIds.includes(p.id))
  const [open, setOpen] = useState(true)
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <aside className="hud hud--tasks" data-testid="hud-tasks">
      <div className="hud__role">
        <Badge tone={deep ? 'error' : 'success'}>{deep ? 'Deep State Agent' : 'Government MP'}</Badge>
      </div>
      <h2 className="hud__title"><ClipboardList size={14} aria-hidden /> Task progress</h2>
      <div className="hud__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="hud__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="hud__count" data-testid="task-progress-text">{completed}/{total} ({pct}%)</p>

      {deep && (
        <>
          <h2 className="hud__title">Fellow agents</h2>
          <ul className="hud__list">{mates.map((m) => <li key={m.id}>{m.name}{!m.alive && ' (down)'}</li>)}</ul>
          <p className="hud__hint">Tasks you open are fake — they never add progress.</p>
        </>
      )}
      <button className="hud__toggle" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="hud-tasks-toggle">
        <Chevron size={14} aria-hidden /> {deep ? 'Cover tasks' : 'Tasks'} ({total - completed} left) — {open ? 'hide' : 'show'}
      </button>
      {open && <ul className="hud__list">
        {tasks.map((t) => (
          <li key={t.taskId} className={t.status === 'COMPLETE' ? 'is-done' : ''} data-testid={`task-item-${t.taskId}`}>
            <span aria-hidden>{t.status === 'COMPLETE' ? '[x]' : '[ ]'}</span> {t.label}
            {t.status === 'COMPLETE' && <span className="visually-hidden"> (complete)</span>}
            {leakedIds.includes(t.taskId) && <span className="hud__offline"> OFFLINE</span>}
          </li>
        ))}
      </ul>}
    </aside>
  )
}
