/**
 * Server-side mini-game generation + validation (Spec §6). The answer stays
 * on the server; only the prompt is sent to the client.
 */
import {
  MATCH_SETTINGS,
  MINIGAME_ENABLED,
  type BillSymbol,
  type FolderId,
  type TaskPuzzle,
  type TaskType,
  type Terminal,
} from '@netagiri/shared'

export interface GeneratedPuzzle {
  puzzle: TaskPuzzle
  /** Exact expected payload. null for HOLD (validated by elapsed time). */
  answer: Record<string, string> | string[] | null
}

type Rng = () => number

const FOLDERS: { id: FolderId; label: string }[] = [
  { id: 'BUDGET', label: 'Budget' },
  { id: 'DEFENCE', label: 'Defence' },
  { id: 'WELFARE', label: 'Welfare' },
]

const DOC_POOL: Record<FolderId, string[]> = {
  BUDGET: ['Annual Budget Estimates', 'Tax Revenue Ledger', 'Rupee Spending Plan', 'Finance Bill Draft'],
  DEFENCE: ['Border Patrol Orders', 'Army Supply Memo', 'Naval Fleet Report', 'Air Defence Brief'],
  WELFARE: ['Rural Health Scheme', 'Pension Payout List', 'School Meal Programme', 'Housing Aid Register'],
}

const WIRES: { color: string; label: string }[] = [
  { color: '#c0392b', label: 'RED' },
  { color: '#2f6fd1', label: 'BLUE' },
  { color: '#f2c14e', label: 'YELLOW' },
  { color: '#3f9d4e', label: 'GREEN' },
]

const SYMBOLS: BillSymbol[] = ['BOOK', 'RUPEE', 'BUILDING', 'FLAG']

const pick = <T,>(arr: T[], rng: Rng) => arr[Math.floor(rng() * arr.length)]
function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const token = (rng: Rng) => Math.floor(rng() * 1e9).toString(36)

export function generatePuzzle(type: TaskType, rng: Rng = Math.random): GeneratedPuzzle {
  if (!MINIGAME_ENABLED[type] || type === 'HOLD') return { puzzle: { type: 'HOLD', ms: MATCH_SETTINGS.holdTaskMs }, answer: null }

  if (type === 'FILE_SORT') {
    const answer: Record<string, FolderId> = {}
    const docs = shuffle(FOLDERS, rng).map((f) => {
      const id = `d-${token(rng)}`
      answer[id] = f.id
      return { id, title: pick(DOC_POOL[f.id], rng) }
    })
    return { puzzle: { type, docs, folders: FOLDERS }, answer }
  }

  if (type === 'RESTORE_POWER') {
    const wires = shuffle(WIRES, rng).slice(0, 3)
    const answer: Record<string, string> = {}
    const sources: Terminal[] = []
    const targets: Terminal[] = []
    for (const w of wires) {
      const s = { id: `s-${token(rng)}`, ...w }
      const t = { id: `t-${token(rng)}`, ...w }
      answer[s.id] = t.id
      sources.push(s)
      targets.push(t)
    }
    return { puzzle: { type, sources, targets: shuffle(targets, rng) }, answer }
  }

  const sequence = Array.from({ length: MATCH_SETTINGS.billSequenceLength }, () => pick(SYMBOLS, rng))
  return { puzzle: { type, symbols: SYMBOLS, sequence, showMs: MATCH_SETTINGS.billShowMs }, answer: sequence }
}

/** Exact comparison of a client payload against the server-held answer. */
export function checkAnswer(answer: GeneratedPuzzle['answer'], payload: unknown): boolean {
  if (answer === null) return false
  if (Array.isArray(answer)) {
    return Array.isArray(payload) && payload.length === answer.length && answer.every((v, i) => payload[i] === v)
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const p = payload as Record<string, unknown>
  const keys = Object.keys(answer)
  return Object.keys(p).length === keys.length && keys.every((k) => p[k] === answer[k])
}
