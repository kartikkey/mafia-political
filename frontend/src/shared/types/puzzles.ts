/** Mini-game prompts (server → client) and answers (client → server). Spec §6. */

export type BillSymbol = 'BOOK' | 'RUPEE' | 'BUILDING' | 'FLAG'
export type FolderId = 'BUDGET' | 'DEFENCE' | 'WELFARE'

export interface HoldPuzzle {
  type: 'HOLD'
  ms: number
}

export interface FileSortPuzzle {
  type: 'FILE_SORT'
  docs: { id: string; title: string }[]
  folders: { id: FolderId; label: string }[]
}

export interface Terminal {
  id: string
  color: string
  label: string
}

export interface RestorePowerPuzzle {
  type: 'RESTORE_POWER'
  sources: Terminal[]
  targets: Terminal[]
}

export interface ApproveBillPuzzle {
  type: 'APPROVE_BILL'
  symbols: BillSymbol[]
  sequence: BillSymbol[]
  showMs: number
}

export type TaskPuzzle = HoldPuzzle | FileSortPuzzle | RestorePowerPuzzle | ApproveBillPuzzle

/** docId → folderId */
export type FileSortAnswer = Record<string, FolderId>
/** sourceId → targetId */
export type RestorePowerAnswer = Record<string, string>
export type ApproveBillAnswer = BillSymbol[]
