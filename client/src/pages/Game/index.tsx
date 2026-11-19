import { MATCH_SETTINGS, withinRange } from '@netagiri/shared'
import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import { useMatchNavigation } from 'common/hooks/useMatchNavigation'
import { useCurrentPlayer } from 'common/hooks/useCurrentPlayer'
import { useRerenderEvery } from 'common/hooks/useRerenderEvery'
import GameLayout from 'layout/GameLayout'
import { callEmergencyMeeting, openTask } from 'slices/game/thunk'
import ParliamentCanvas from './components/ParliamentCanvas'
import RoleReveal from './components/RoleReveal'
import Hud from './components/Hud'
import ActionBar, { type Action } from './components/ActionBar'
import { useLocalMovement } from './hooks/useLocalMovement'
import './Game.scss'

export default function Game() {
  useMatchNavigation()
  const dispatch = useAppDispatch()
  const { match, role, feedback } = useAppSelector((s) => s.game)
  const playerId = useAppSelector((s) => s.join.playerId)
  const me = useCurrentPlayer()
  const { pos } = useLocalMovement()
  useRerenderEvery(150) // keep proximity prompts fresh while the local player moves

  if (!match) return <div className="page muted">Loading match…</div>

  const here = pos.current ?? me?.position
  const nearTask = here ? match.tasks.find((t) => t.status !== 'COMPLETE' && withinRange(here, t.position, MATCH_SETTINGS.interactionRange)) : undefined
  const playing = match.state === 'PLAYING'

  // TODO(Prompts 4–6): Report [Space], Eliminate, Sabotage and the E-key binding.
  const actions: Action[] = [
    {
      key: 'use',
      label: 'Use',
      hotkey: 'E',
      variant: 'green',
      disabledReason: !playing ? 'Meeting in progress' : nearTask ? null : 'Move closer to interact',
      onClick: () => nearTask && dispatch(openTask(nearTask.taskId)),
    },
    {
      key: 'meeting',
      label: 'Emergency',
      variant: 'danger',
      disabledReason: !playing || !me?.alive ? 'Unavailable' : null,
      onClick: () => dispatch(callEmergencyMeeting()),
    },
  ]

  return (
    <GameLayout>
      <div className="game">
        <div className="game__map">
          <ParliamentCanvas players={match.players} tasks={match.tasks} meId={playerId} localPos={pos} highlightTaskIds={nearTask ? [nearTask.taskId] : []} />
          {nearTask && playing && <div className="game__prompt">Press E — {nearTask.label}</div>}
        </div>
        <Hud role={role} tasks={match.tasks} completed={match.completedTasks} total={match.totalTasks} players={match.players} />
        <ActionBar actions={actions} feedback={feedback} />
      </div>
      {match.state === 'ROLE_ASSIGNMENT' && <RoleReveal role={role} players={match.players} />}
    </GameLayout>
  )
}
