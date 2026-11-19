/**
 * Computer-controlled players. They act only through game/actions.ts, so the
 * server validates them exactly like humans (range, cooldowns, phases).
 * Government bots walk to stations and do tasks, report bodies they find and
 * vote on hunches. Deep State bots fake tasks, strike lone MPs and blend in.
 */
import { GRID, MATCH_SETTINGS, TILE_SIZE, withinRange, type Direction, type Vec2 } from '@netagiri/shared'
import type { IO } from '../handlers/types'
import { actChat, actCompleteTask, actEliminate, actMove, actOpenTask, actReport, actSabotage, actVote } from './actions'
import type { Match, ServerPlayer } from './Match'

interface Brain {
  path: Vec2[]
  goalTaskId: string | null
  workUntil: number
  idleUntil: number
  voteAt: number | null
  chatAt: number | null
}

/** How far an MP bot notices a body (world px). */
const SIGHT_RANGE = 200
/** Agents hesitate: chance per tick to strike when a lone target is in reach. */
const KILL_CHANCE_PER_TICK = 0.12
/** Brains live on the match so they are dropped with the room. */
const brainOf = (match: Match, id: string) => {
  let b = match.botBrains.get(id) as Brain | undefined
  if (!b) match.botBrains.set(id, (b = { path: [], goalTaskId: null, workUntil: 0, idleUntil: 0, voteAt: null, chatAt: null }))
  return b
}
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const tileOf = (p: Vec2) => ({ x: Math.floor(p.x / TILE_SIZE), y: Math.floor(p.y / TILE_SIZE) })
const centre = (t: { x: number; y: number }) => ({ x: t.x * TILE_SIZE + TILE_SIZE / 2, y: t.y * TILE_SIZE + TILE_SIZE / 2 })

/** BFS over walkable tiles (4-neighbour). Returns tile-centre waypoints, excluding the start. */
export function findPath(from: Vec2, to: Vec2): Vec2[] {
  const s = tileOf(from)
  const g = tileOf(to)
  const key = (x: number, y: number) => y * 1000 + x
  const prev = new Map<number, number>([[key(s.x, s.y), -1]])
  const queue = [s]
  while (queue.length) {
    const c = queue.shift()!
    if (c.x === g.x && c.y === g.y) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx
      const ny = c.y + dy
      if (GRID[ny]?.[nx] !== 0 || prev.has(key(nx, ny))) continue
      prev.set(key(nx, ny), key(c.x, c.y))
      queue.push({ x: nx, y: ny })
    }
  }
  if (!prev.has(key(g.x, g.y))) return []
  const out: Vec2[] = []
  for (let k = key(g.x, g.y); k !== key(s.x, s.y) && k !== -1; k = prev.get(k)!) out.unshift(centre({ x: k % 1000, y: Math.floor(k / 1000) }))
  return out
}

const LINES = [
  'I was doing my tasks in the {room}.',
  'Not me — I was nowhere near there.',
  'Someone was acting shifty near the Central Hall.',
  'Skip unless we have proof.',
  'I saw {name} wandering alone.',
]

function step(io: IO, match: Match, bot: ServerPlayer, brain: Brain, dtMs: number) {
  const next = brain.path[0]
  if (!next) return
  const dx = next.x - bot.position.x
  const dy = next.y - bot.position.y
  const dist = Math.hypot(dx, dy)
  const max = (MATCH_SETTINGS.moveSpeed * dtMs) / 1000
  const pos = dist <= max ? next : { x: bot.position.x + (dx / dist) * max, y: bot.position.y + (dy / dist) * max }
  const facing: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
  if (!actMove(io, match, bot, pos, facing)) brain.path = [] // blocked → re-plan
  else if (dist <= max) brain.path.shift()
}

function playTurn(io: IO, match: Match, bot: ServerPlayer, now: number, dtMs: number) {
  const brain = brainOf(match, bot.id)
  const deep = bot.faction === 'DEEP_STATE'
  const living = match.livingPlayers

  // Report any body in reach (agents only report their own handiwork sometimes, to look innocent).
  const body = match.bodies.find((b) => !b.reported && withinRange(bot.position, b.position, MATCH_SETTINGS.reportRange))
  if (body && (!deep || Math.random() < 0.004)) {
    actReport(io, match, bot, body.bodyId)
    return
  }

  // MPs who spot a body nearby walk over to report it.
  const seen = !deep && match.bodies.find((b) => !b.reported && withinRange(bot.position, b.position, SIGHT_RANGE))
  if (seen && !bot.openTask) {
    if (brain.goalTaskId !== `body:${seen.bodyId}`) {
      brain.goalTaskId = `body:${seen.bodyId}`
      brain.path = findPath(bot.position, seen.position)
    }
    step(io, match, bot, brain, dtMs)
    return
  }

  if (deep && now >= bot.eliminationReadyAt && Math.random() < KILL_CHANCE_PER_TICK) {
    const target = living.find(
      (p) => p.faction === 'GOVERNMENT' && withinRange(bot.position, p.position, MATCH_SETTINGS.eliminationRange) &&
        !living.some((w) => w.id !== p.id && w.id !== bot.id && w.faction === 'GOVERNMENT' && withinRange(w.position, p.position, 160))
    )
    if (target && !actEliminate(io, match, bot, target.id)) return
  }

  // Working a station (real or fake): finish after a plausible time.
  if (bot.openTask) {
    if (now >= brain.workUntil) {
      actCompleteTask(io, match, bot, bot.openTask.taskId, bot.openTask.answer ?? { held: true })
      brain.goalTaskId = null
      brain.idleUntil = now + rand(1500, 4000)
    }
    return
  }
  if (now < brain.idleUntil) return

  const goal = match.tasks.find((t) => t.taskId === brain.goalTaskId)
  if (goal && goal.status !== 'COMPLETE' && withinRange(bot.position, goal.position, MATCH_SETTINGS.interactionRange - 8)) {
    if (deep && Math.random() < 0.15) actSabotage(io, match, bot, 'DOCUMENT_LEAK', goal.taskId)
    else if (typeof actOpenTask(io, match, bot, goal.taskId) !== 'string') brain.workUntil = now + rand(5000, 9000)
    brain.path = []
    return
  }
  if (!goal || goal.status === 'COMPLETE' || match.sabotage.disabledTaskIds.includes(goal.taskId) || brain.path.length === 0) {
    const open = match.tasks.filter((t) => t.status !== 'COMPLETE' && !match.sabotage.disabledTaskIds.includes(t.taskId))
    const choice = pick(open)
    brain.goalTaskId = choice?.taskId ?? null
    brain.path = choice ? findPath(bot.position, choice.position) : []
    // Agents sometimes shadow a lone MP instead.
    if (deep && Math.random() < 0.35) {
      const prey = pick(living.filter((p) => p.faction === 'GOVERNMENT'))
      if (prey) brain.path = findPath(bot.position, prey.position)
    }
  }
  step(io, match, bot, brain, dtMs)
}

function meetingTurn(io: IO, match: Match, bot: ServerPlayer, now: number) {
  const brain = brainOf(match, bot.id)
  const others = match.livingPlayers.filter((p) => p.id !== bot.id)
  if (match.state === 'DISCUSSION') {
    brain.voteAt = null
    brain.chatAt ??= Math.random() < 0.6 ? now + rand(3000, 25000) : Infinity
    if (now >= brain.chatAt) {
      brain.chatAt = Infinity
      const room = match.tasks.find((t) => t.taskId === brain.goalTaskId)?.roomId.replace('_', ' ').toLowerCase() ?? 'corridor'
      actChat(io, match, bot, pick(LINES).replace('{room}', room).replace('{name}', pick(others)?.name ?? 'someone'))
    }
  }
  if (match.state === 'VOTING' && !match.votes.has(bot.id)) {
    brain.voteAt ??= now + rand(2500, 12000)
    if (now < brain.voteAt) return
    const clue = match.meeting?.clue?.playerId
    let choice: string = 'SKIP'
    if (bot.faction === 'GOVERNMENT') {
      if (clue && clue !== bot.id && others.some((p) => p.id === clue) && Math.random() < 0.6) choice = clue
      else if (Math.random() < 0.4 && others.length) choice = pick(others).id
    } else if (Math.random() < 0.3) {
      choice = pick(others.filter((p) => p.faction === 'GOVERNMENT'))?.id ?? 'SKIP'
    }
    actVote(io, match, bot, choice)
  }
  if (match.state === 'VOTE_RESULTS' || match.state === 'MEETING_TRANSITION') brain.chatAt = null
}

/** One server tick for every living bot in the match. */
export function runBots(io: IO, match: Match, now: number, dtMs: number) {
  for (const bot of match.players.values()) {
    if (!bot.isBot || !bot.alive || !bot.connected) continue
    if (match.state === 'PLAYING') playTurn(io, match, bot, now, dtMs)
    else meetingTurn(io, match, bot, now)
    if (match.state === 'GAME_OVER') return
  }
}

export const forgetBots = (match: Match) => match.botBrains.clear()
