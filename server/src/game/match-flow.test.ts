import { afterEach, describe, expect, it } from 'vitest'
import { MATCH_SETTINGS, POWER_PANEL, REPAIR_TASK_ID } from '@netagiri/shared'
import { RoomManager } from '../rooms/RoomManager'
import type { Match, ServerPlayer } from './Match'
import { checkAnswer, generatePuzzle } from './puzzles'

const matches: Match[] = []
afterEach(() => matches.splice(0).forEach((m) => m.dispose()))

function playing(n = 6) {
  const rooms = new RoomManager()
  const { match, player: host } = rooms.create('s0', 'Host', 0)
  for (let i = 1; i < n; i++) rooms.join(`s${i}`, match.roomCode, `MP${i}`, i % 8)
  match.start(host.id)
  match.setState('PLAYING')
  matches.push(match)
  const all = [...match.players.values()]
  return { rooms, match, gov: all.filter((p) => p.faction === 'GOVERNMENT'), deep: all.filter((p) => p.faction === 'DEEP_STATE') }
}

let clock = 1_000_000
const tick = () => (clock += 1_000)
const place = (p: ServerPlayer, at: { x: number; y: number }) => (p.position = { ...at })

describe('tasks (Prompt 3/4)', () => {
  it('government completes a task once; duplicates rejected; progress counts', () => {
    const { match, gov } = playing()
    const [a, b] = gov
    const task = match.tasks[0]
    place(a, task.position)
    place(b, task.position)
    const opened = match.openTask(a.id, task.taskId, tick())
    expect(typeof opened).toBe('object')
    match.openTask(b.id, task.taskId, tick())
    const answerA = a.openTask!.answer
    const answerB = b.openTask!.answer
    expect(match.completeTask(a.id, task.taskId, answerA, tick() + MATCH_SETTINGS.holdTaskMs)).toEqual({ progressed: true, restored: false })
    expect(match.completedTasks).toBe(1)
    expect(match.completeTask(b.id, task.taskId, answerB, tick() + MATCH_SETTINGS.holdTaskMs)).toBe('Task already complete')
    expect(match.completedTasks).toBe(1)
    expect(a.stats.tasksCompleted).toBe(1)
  })

  it('deep state cannot increase progress', () => {
    const { match, deep } = playing()
    const task = match.tasks[0]
    place(deep[0], task.position)
    match.openTask(deep[0].id, task.taskId, tick())
    expect(match.completeTask(deep[0].id, task.taskId, deep[0].openTask!.answer, tick() + MATCH_SETTINGS.holdTaskMs)).toEqual({ progressed: false, restored: false })
    expect(match.completedTasks).toBe(0)
    expect(task.status).toBe('AVAILABLE')
  })

  it('rejects out of range, wrong answers and unopened tasks', () => {
    const { match, gov } = playing()
    const task = match.tasks.find((t) => t.type !== 'HOLD')!
    expect(match.openTask(gov[0].id, task.taskId, tick())).toBe('Too far away')
    place(gov[0], task.position)
    expect(match.completeTask(gov[0].id, task.taskId, {}, tick())).toBe('Open the task first')
    match.openTask(gov[0].id, task.taskId, tick())
    expect(match.completeTask(gov[0].id, task.taskId, { bogus: 'x' }, tick())).toBe('Incorrect — try again')
    expect(match.completedTasks).toBe(0)
  })

  it('task victory fires at 100%', () => {
    const { match, gov } = playing()
    for (const t of match.tasks) t.status = 'COMPLETE'
    expect(match.finishIfWon()).toBe('GOVERNMENT_WINS')
    expect(match.state).toBe('GAME_OVER')
    expect(gov.length).toBeGreaterThan(0)
  })
})

describe('puzzle validators (Prompt 4)', () => {
  for (const type of ['FILE_SORT', 'RESTORE_POWER', 'APPROVE_BILL'] as const) {
    it(`${type}: correct passes, wrong fails`, () => {
      const { puzzle, answer } = generatePuzzle(type)
      expect(puzzle.type).toBe(type)
      expect(checkAnswer(answer, answer)).toBe(true)
      const wrong = Array.isArray(answer) ? [...answer].reverse().concat('BOOK') : { ...answer, extra: 'x' }
      expect(checkAnswer(answer, wrong)).toBe(false)
      expect(checkAnswer(answer, null)).toBe(false)
    })
  }
  it('FILE_SORT prompt never contains the folder mapping', () => {
    const { puzzle } = generatePuzzle('FILE_SORT')
    expect(JSON.stringify(puzzle)).not.toMatch(/"folderId"|answer/)
  })
})

describe('elimination (Prompt 5)', () => {
  it('rejects teammate, distant and dead targets without consuming cooldown', () => {
    const { match, gov, deep } = playing()
    const [k, mate] = deep
    place(k, gov[0].position)
    place(mate, gov[0].position)
    expect(match.eliminate(k.id, mate.id, tick())).toBe('Cannot eliminate a teammate')
    place(gov[1], { x: gov[0].position.x + 400, y: gov[0].position.y })
    expect(match.eliminate(k.id, gov[1].id, tick())).toBe('Too far away')
    expect(k.eliminationReadyAt).toBe(0)
    const body = match.eliminate(k.id, gov[0].id, tick())
    expect(typeof body).toBe('object')
    expect(match.bodies).toHaveLength(1)
    expect(match.eliminate(mate.id, gov[0].id, tick())).toBe('Target already eliminated')
    expect(match.bodies).toHaveLength(1)
  })

  it('cooldown blocks a second kill and government cannot eliminate', () => {
    const { match, gov, deep } = playing(8)
    place(deep[0], gov[0].position)
    place(gov[1], gov[0].position)
    match.eliminate(deep[0].id, gov[0].id, tick())
    expect(match.eliminate(deep[0].id, gov[1].id, tick())).toMatch(/^Cooldown: \d+s$/)
    expect(match.eliminate(gov[2].id, gov[1].id, tick())).toBe('Not allowed')
  })

  it('parity win after kill (6 players: 4 gov / 2 deep)', () => {
    const { match, gov, deep } = playing(6)
    gov[0].alive = false
    expect(match.finishIfWon()).toBeNull()
    place(deep[0], gov[1].position)
    match.eliminate(deep[0].id, gov[1].id, tick())
    expect(match.finishIfWon()).toBe('DEEP_STATE_WINS')
  })

  it('rejects kill during a meeting', () => {
    const { match, gov, deep } = playing()
    place(deep[0], gov[0].position)
    match.setState('DISCUSSION')
    expect(match.eliminate(deep[0].id, gov[0].id, tick())).toBe('Meeting in progress')
  })
})

describe('power cut (Prompt 5)', () => {
  it('deep state cuts power at the panel; government repairs early', () => {
    const { match, gov, deep } = playing()
    expect(match.sabotageAction(deep[0].id, 'POWER_CUT', undefined, tick())).toBe('Too far away')
    place(deep[0], POWER_PANEL)
    expect(match.sabotageAction(deep[0].id, 'POWER_CUT', undefined, tick())).toEqual({ closedFor: [] })
    expect(match.sabotage.powerStatus).toBe('OUT')
    expect(match.sabotageAction(deep[1].id, 'POWER_CUT', undefined, tick())).not.toBeNull()
    place(gov[0], POWER_PANEL)
    match.openTask(gov[0].id, REPAIR_TASK_ID, tick())
    expect(match.completeTask(gov[0].id, REPAIR_TASK_ID, gov[0].openTask!.answer, tick())).toEqual({ progressed: false, restored: true })
    expect(match.sabotage.powerStatus).toBe('ON')
    expect(match.completedTasks).toBe(0)
  })
})

describe('meetings & voting (Prompt 6)', () => {
  function inVoting() {
    const ctx = playing(7)
    const { match, gov, deep } = ctx
    place(deep[0], gov[0].position)
    const body = match.eliminate(deep[0].id, gov[0].id, tick())
    if (typeof body === 'string') throw new Error(body)
    place(gov[1], body.position)
    expect(match.report(gov[1].id, body.bodyId, tick())).toBeNull()
    expect(match.state).toBe('MEETING_TRANSITION')
    match.setState('VOTING')
    return { ...ctx, body }
  }

  it('report twice → one meeting; dead cannot vote', () => {
    const { match, gov, body } = inVoting()
    expect(match.report(gov[2].id, body.bodyId, tick())).toBe('Meeting in progress')
    expect(match.vote(gov[0].id, 'SKIP')).toBe('Eliminated players cannot vote')
  })

  it('one vote per player, no self-vote, early close when all voted', () => {
    const { match, gov, deep } = inVoting()
    expect(match.vote(gov[1].id, gov[1].id)).toBe('You cannot vote for yourself')
    expect(match.vote(gov[1].id, deep[0].id)).toEqual({ allVoted: false })
    expect(match.vote(gov[1].id, 'SKIP')).toBe('Vote already cast')
    const voters = match.livingPlayers.filter((p) => p.id !== gov[1].id)
    let last: unknown
    for (const v of voters) last = match.vote(v.id, v.id === deep[0].id ? 'SKIP' : deep[0].id)
    expect(last).toEqual({ allVoted: true })
    const tally = match.resolveVotes()
    expect(tally.ejectedPlayerId).toBe(deep[0].id)
    expect(tally.ejectedFaction).toBe('DEEP_STATE')
    expect(match.view().players.find((p) => p.id === deep[0].id)?.revealedFaction).toBe('DEEP_STATE')
  })

  it('tie → no ejection and meetings counted', () => {
    const { match, gov, deep } = inVoting()
    match.vote(gov[1].id, deep[0].id)
    match.vote(gov[2].id, gov[3].id)
    expect(match.resolveVotes().ejectedPlayerId).toBeNull()
    expect(gov[1].stats.meetingsAttended).toBe(1)
    expect(gov[0].stats.meetingsAttended).toBe(0)
  })

  it('emergency meeting respects the global cooldown after resume', () => {
    const { match, gov } = inVoting()
    match.resolveVotes()
    match.resumePlay(clock)
    expect(match.callEmergency(gov[1].id, tick())).toMatch(/^Cooldown/)
    expect(match.callEmergency(gov[1].id, clock + MATCH_SETTINGS.emergencyMeetingCooldownMs + 1000)).toBeNull()
  })

  it('disconnected voter keeps a cast vote; excluded from eligibility', () => {
    const { match, gov, deep } = inVoting()
    match.vote(gov[1].id, deep[0].id)
    match.markDisconnected(gov[1].id)
    expect(match.votes.get(gov[1].id)).toBe(deep[0].id)
    expect(match.livingPlayers.some((p) => p.id === gov[1].id)).toBe(false)
  })
})

describe('victory & disconnects (Prompt 7)', () => {
  it('last agent voted out → government wins', () => {
    const { match, deep } = playing(6)
    deep[0].alive = false
    deep[1].alive = false
    expect(match.finishIfWon()).toBe('GOVERNMENT_WINS')
  })

  it('disconnect triggers parity win', () => {
    const { rooms, match, gov } = playing(6)
    gov[0].alive = false
    rooms.leave(gov[1].socketId)
    expect(match.finishIfWon()).toBe('DEEP_STATE_WINS')
  })

  it('rejects actions after GAME_OVER', () => {
    const { match, gov } = playing(6)
    for (const t of match.tasks) t.status = 'COMPLETE'
    match.finishIfWon()
    expect(match.openTask(gov[0].id, match.tasks[0].taskId, tick())).toBe('Match is over')
    expect(match.callEmergency(gov[0].id, tick())).toBe('Match is over')
    expect(match.view().players.every((p) => p.revealedFaction)).toBe(true)
    expect(match.matchStats()).toHaveLength(6)
  })

  it('empty room is disposed', () => {
    const { rooms, match } = playing(6)
    for (const p of [...match.players.values()]) rooms.leave(p.socketId)
    expect(rooms.get(match.roomCode)).toBeUndefined()
  })
})

describe('document leak + starting cooldown (phase 2)', () => {
  it('leak takes one available station offline, closes open copies, blocks opening; one sabotage at a time', () => {
    const { match, gov, deep } = playing()
    const task = match.tasks[0]
    place(gov[0], task.position)
    match.openTask(gov[0].id, task.taskId, tick())
    expect(match.sabotageAction(deep[0].id, 'DOCUMENT_LEAK', task.taskId, tick())).toBe('Too far away')
    place(deep[0], task.position)
    expect(match.sabotageAction(deep[0].id, 'DOCUMENT_LEAK', task.taskId, tick())).toEqual({ closedFor: [gov[0].id] })
    expect(match.sabotage.disabledTaskIds).toEqual([task.taskId])
    expect(gov[0].openTask).toBeNull()
    expect(match.openTask(gov[0].id, task.taskId, tick())).toMatch(/^Documents leaked — back in \d+s$/)
    place(deep[1], POWER_PANEL)
    expect(match.sabotageAction(deep[1].id, 'POWER_CUT', undefined, tick())).toBe('Sabotage already active')
  })

  it('leak rejected on a completed station; meeting clears it', () => {
    const { match, gov, deep } = playing()
    const [t0, t1] = match.tasks
    t0.status = 'COMPLETE'
    place(deep[0], t0.position)
    expect(match.sabotageAction(deep[0].id, 'DOCUMENT_LEAK', t0.taskId, tick())).toBe('Task already complete')
    place(deep[0], t1.position)
    match.sabotageAction(deep[0].id, 'DOCUMENT_LEAK', t1.taskId, tick())
    match.callEmergency(gov[0].id, tick())
    expect(match.sabotage.disabledTaskIds).toEqual([])
  })

  it('agents cannot eliminate during the starting grace period', () => {
    const { match, gov, deep } = playing()
    const now = tick()
    match.beginPlay(now)
    place(deep[0], gov[0].position)
    expect(match.eliminate(deep[0].id, gov[0].id, now + 1000)).toMatch(/^Cooldown/)
    expect(typeof match.eliminate(deep[0].id, gov[0].id, now + MATCH_SETTINGS.initialEliminationCooldownMs + 1)).toBe('object')
  })
})

describe('ghosts, leak clue (phase 3)', () => {
  it('eliminated players drift through walls (in bounds) and living players see only the death spot', () => {
    const { match, gov, deep } = playing()
    place(deep[0], gov[0].position)
    match.eliminate(deep[0].id, gov[0].id, tick())
    const ghost = gov[0]
    const start = { ...ghost.position }
    ghost.lastMoveAt = clock
    // straight up into the top wall row (y=16 is wall) — allowed for a ghost
    expect(match.move(ghost.id, { x: start.x, y: start.y - 60 }, 'up', clock + 1000)).toBe(true)
    expect(match.move(ghost.id, { x: start.x, y: 2 }, 'up', clock + 2000)).toBe(false) // off-map
    expect(match.view().players.find((p) => p.id === ghost.id)!.position).toEqual(start)
    expect(match.view(true).players.find((p) => p.id === ghost.id)!.position.y).toBe(start.y - 60)
    expect(match.openTask(ghost.id, match.tasks[0].taskId, tick())).toBe('You have been eliminated')
  })

  it('leak clue = last living player seen at the leaked station, attached to the next meeting', () => {
    const { match, gov, deep } = playing()
    const task = match.tasks[0]
    place(deep[0], task.position)
    match.sabotageAction(deep[0].id, 'DOCUMENT_LEAK', task.taskId, tick())
    expect(match.leakClue?.playerId).toBe(deep[0].id)
    place(gov[0], { x: task.position.x + 20, y: task.position.y })
    gov[0].lastMoveAt = clock
    expect(match.move(gov[0].id, { x: task.position.x + 10, y: task.position.y }, 'left', clock + 500)).toBe(true)
    expect(match.leakClue?.playerId).toBe(gov[0].id)
    match.callEmergency(gov[1].id, tick())
    expect(match.meeting?.clue).toEqual({ taskId: task.taskId, stationLabel: task.label, playerId: gov[0].id })
    match.resumePlay(clock)
    expect(match.leakClue).toBeNull()
  })
})
