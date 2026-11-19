import { REPAIR_TASK_ID, type TaskInstance, type TaskPuzzle } from '@netagiri/shared'
import Modal from 'common/components/Modal'
import { useAppDispatch, useAppSelector } from 'common/hooks/redux'
import { completeTask, dismissTask } from 'slices/game/thunk'
import HoldTask from './minigames/HoldTask'
import FileSort from './minigames/FileSort'
import RestorePower from './minigames/RestorePower'
import ApproveBill from './minigames/ApproveBill'

const INSTRUCTIONS: Record<TaskPuzzle['type'], string> = {
  HOLD: 'Stay at the station while the paperwork processes.',
  FILE_SORT: 'Drag each file into its folder — or click a file, then a folder.',
  RESTORE_POWER: 'Click a terminal on the left, then the matching one on the right.',
  APPROVE_BILL: 'Watch the sequence, then repeat it.',
}

/** Mini-game modal over the map (Spec §6.5). Esc / ✕ closes; closes itself on meeting/death. */
export default function TaskModal({ tasks }: { tasks: TaskInstance[] }) {
  const dispatch = useAppDispatch()
  const { activeTaskId, activePuzzle, taskError, taskBusy } = useAppSelector((s) => s.game)
  if (!activeTaskId || !activePuzzle) return null

  const title = activeTaskId === REPAIR_TASK_ID ? 'Power Panel — Restore Power' : (tasks.find((t) => t.taskId === activeTaskId)?.label ?? 'Task')
  const submit = (payload: unknown) => dispatch(completeTask({ taskId: activeTaskId, payload }))
  const common = { error: taskError, busy: taskBusy, onSubmit: submit }

  return (
    <Modal title={title} onClose={() => dispatch(dismissTask())}>
      <div className="task-modal" data-testid="task-modal" data-puzzle-type={activePuzzle.type}>
        <p className="task-modal__hint">{INSTRUCTIONS[activePuzzle.type]}</p>
        {activePuzzle.type === 'HOLD' && <HoldTask puzzle={activePuzzle} {...common} />}
        {activePuzzle.type === 'FILE_SORT' && <FileSort puzzle={activePuzzle} {...common} />}
        {activePuzzle.type === 'RESTORE_POWER' && <RestorePower puzzle={activePuzzle} {...common} />}
        {activePuzzle.type === 'APPROVE_BILL' && <ApproveBill puzzle={activePuzzle} {...common} />}
        {taskError && <p className="task-modal__error" role="alert" data-testid="task-error">{taskError}</p>}
      </div>
    </Modal>
  )
}
