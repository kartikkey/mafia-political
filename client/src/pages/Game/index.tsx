import { Bell, Crosshair, FileWarning, Hand, Megaphone, ZapOff } from 'lucide-react'
import { REPAIR_TASK_ID } from '@netagiri/shared'
import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import { useMatchNavigation } from 'common/hooks/useMatchNavigation'
import { useCurrentPlayer } from 'common/hooks/useCurrentPlayer'
import { useRerenderEvery } from 'common/hooks/useRerenderEvery'
import GameLayout from 'layout/GameLayout'
import { secondsUntil } from 'helpers/clock'
import { callEmergencyMeeting, eliminatePlayer, openTask, reportBody, sabotage } from 'slices/game/thunk'
import ParliamentCanvas from './components/ParliamentCanvas'
import RoleReveal from './components/RoleReveal'
import Hud from './components/Hud'
import PlayersAlive from './components/PlayersAlive'
import ControlsLegend from './components/ControlsLegend'
import ActionBar, { type Action } from './components/ActionBar'
import TaskModal from './components/TaskModal'
import PowerCutOverlay from './components/PowerCutOverlay'
import LeakBanner from './components/LeakBanner'
import { useZoom } from './hooks/useZoom'
import { useMapToggle } from './hooks/useMapToggle'
import MapOverlay from './components/MapOverlay'
import { useLocalMovement } from './hooks/useLocalMovement'
import { useProximity } from './hooks/useProximity'
import { useGameHotkeys } from './hooks/useGameHotkeys'
import './Game.scss'

const cooldownLeft = secondsUntil

export default function Game() {
  useMatchNavigation()
  const dispatch = useAppDispatch()
  const { match, role, feedback, feedbackAt, activeTaskId, eliminationReadyAt, sabotageReadyAt, interacting } = useAppSelector((s) => s.game)
  const { zoom, cycleZoom } = useZoom()
  const playerId = useAppSelector((s) => s.join.playerId)
  const me = useCurrentPlayer()
  const { mapOpen, toggleMap, closeMap } = useMapToggle()
  const { pos } = useLocalMovement(mapOpen)
  useRerenderEvery(150) // keep proximity prompts + cooldowns fresh while the local player moves
  const { nearTask, nearBody, nearTarget, nearPanel, roomLabel } = useProximity(match, me, role, pos)

  const deep = role?.faction === 'DEEP_STATE'
  const playing = match?.state === 'PLAYING'
  const alive = !!me?.alive
  const powerOut = match?.sabotage.powerStatus === 'OUT'
  const leakedIds = match?.sabotage.disabledTaskIds ?? []
  const sabotageActive = powerOut || leakedIds.length > 0
  const nearLeaked = !!nearTask && leakedIds.includes(nearTask.taskId)
  const blockReason = !playing ? 'Meeting in progress' : !alive ? 'You are eliminated' : null

  const useTarget = nearTask ? nearTask.taskId : !deep && nearPanel && powerOut ? REPAIR_TASK_ID : null
  const canSabotageHere = deep && nearPanel && !nearTask
  const elimCd = cooldownLeft(eliminationReadyAt)
  const sabCd = cooldownLeft(sabotageReadyAt)
  const emCd = cooldownLeft(match?.emergencyAvailableAt ?? 0)

  const actions: Action[] = [
    {
      key: 'use', label: 'Use', hotkey: 'E', keys: canSabotageHere ? [] : ['E'], icon: Hand, variant: 'green',
      disabledReason: blockReason ?? (nearLeaked && useTarget === nearTask?.taskId ? 'Station offline (leak)' : useTarget ? null : 'Move closer to interact'),
      onClick: () => useTarget && dispatch(openTask(useTarget)),
    },
    {
      key: 'report', label: 'Report', hotkey: 'SPACE', keys: ['SPACE', 'R'], icon: Megaphone, variant: 'danger',
      disabledReason: blockReason ?? (nearBody ? null : 'No body nearby'),
      onClick: () => nearBody && dispatch(reportBody(nearBody.bodyId)),
    },
    {
      key: 'emergency', label: 'Meeting', icon: Bell, variant: 'primary',
      disabledReason: blockReason ?? (emCd > 0 ? `Cooldown: ${emCd}s` : null),
      onClick: () => dispatch(callEmergencyMeeting()),
    },
  ]
  if (deep) {
    actions.push(
      {
        key: 'sabotage', label: 'Sabotage', hotkey: 'E', keys: canSabotageHere ? ['E'] : [], icon: ZapOff, variant: 'ghost',
        disabledReason: blockReason ?? (!nearPanel ? 'Go to the power panel' : sabotageActive ? 'Sabotage active' : sabCd > 0 ? `Cooldown: ${sabCd}s` : null),
        onClick: () => dispatch(sabotage({ type: 'POWER_CUT' })),
      },
      {
        key: 'leak', label: 'Leak', hotkey: 'F', keys: ['F'], icon: FileWarning, variant: 'ghost',
        disabledReason: blockReason ?? (!nearTask ? 'Stand at a task station' : sabotageActive ? 'Sabotage active' : sabCd > 0 ? `Cooldown: ${sabCd}s` : null),
        onClick: () => nearTask && dispatch(sabotage({ type: 'DOCUMENT_LEAK', targetTaskId: nearTask.taskId })),
      },
      {
        key: 'eliminate', label: 'Eliminate', hotkey: 'Q', keys: ['Q'], icon: Crosshair, variant: 'danger',
        disabledReason: blockReason ?? (elimCd > 0 ? `Cooldown: ${elimCd}s` : nearTarget ? null : 'No target in range'),
        onClick: () => nearTarget && dispatch(eliminatePlayer(nearTarget.id)),
      }
    )
  }
  useGameHotkeys(actions, !!activeTaskId || !playing)

  if (!match) return <div className="page muted">Loading match…</div>

  const prompt = !playing || !alive || activeTaskId
    ? null
    : nearBody
      ? `Press SPACE — Report the body of ${match.players.find((p) => p.id === nearBody.playerId)?.name ?? 'an MP'}`
      : nearTask
        ? nearLeaked ? `${nearTask.label} — offline: documents leaked` : `Press E — ${roomLabel} — ${nearTask.label}`
        : nearPanel
          ? deep ? (powerOut ? null : 'Press E — Power Panel — Cut the Power') : powerOut ? 'Press E — Power Panel — Restore Power' : null
          : null

  return (
    <GameLayout>
      <div className="game" data-testid="game-screen">
        <div className="game__map">
          <ParliamentCanvas
            players={match.players}
            tasks={match.tasks}
            bodies={match.bodies}
            meId={playerId}
            localPos={pos}
            highlightTaskIds={nearTask ? [nearTask.taskId] : []}
            highlightBodyId={nearBody?.bodyId ?? null}
            teammateIds={role?.teammateIds ?? []}
            interactingIds={[...Object.keys(interacting), ...(activeTaskId && playerId ? [playerId] : [])]}
            disabledTaskIds={leakedIds}
            powerOut={powerOut}
            zoom={zoom}
          />
          {powerOut && playing && <PowerCutOverlay restoreAt={match.sabotage.powerRestoreAt} deep={deep} />}
          {leakedIds.length > 0 && playing && (
            <LeakBanner endsAt={match.sabotage.leakEndsAt ?? null} station={match.tasks.find((t) => t.taskId === leakedIds[0])?.label ?? 'A station'} />
          )}
          {prompt && <div className="game__prompt" data-testid="interaction-prompt">{prompt}</div>}
          {!alive && match.state !== 'ROLE_ASSIGNMENT' && (
            <div className="game__dead" role="status" data-testid="eliminated-banner">
              You are a ghost — drift through walls to watch. Only other ghosts can see you.
            </div>
          )}
        </div>
        <Hud role={role} leakedIds={leakedIds} tasks={match.tasks} completed={match.completedTasks} total={match.totalTasks} players={match.players} />
        <PlayersAlive players={match.players} />
        <ControlsLegend deep={deep} zoom={zoom} onZoom={cycleZoom} onMap={toggleMap} />
        <ActionBar actions={actions} feedback={feedback} feedbackAt={feedbackAt} />
      </div>
      <TaskModal tasks={match.tasks} />
      {mapOpen && match.state === 'PLAYING' && (
        <MapOverlay tasks={match.tasks} disabledTaskIds={leakedIds} me={pos.current ?? me?.position ?? null} onClose={closeMap} />
      )}
      {match.state === 'ROLE_ASSIGNMENT' && <RoleReveal role={role} players={match.players} />}
    </GameLayout>
  )
}
