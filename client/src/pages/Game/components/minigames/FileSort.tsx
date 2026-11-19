import { useEffect, useState } from 'react'
import { FileText, Folder } from 'lucide-react'
import type { FileSortPuzzle, FolderId } from '@netagiri/shared'
import { playSound } from 'helpers/sound'

interface Props {
  puzzle: FileSortPuzzle
  error: string | null
  busy: boolean
  onSubmit: (payload: unknown) => void
}

/** Spec §6.1: three files → Budget / Defence / Welfare. Server checks the exact mapping. */
export default function FileSort({ puzzle, error, busy, onSubmit }: Props) {
  const [placed, setPlaced] = useState<Record<string, FolderId>>({})
  const [selected, setSelected] = useState<string | null>(null)

  // Wrong mapping → files bounce back to the tray (Spec §6.1 failure).
  useEffect(() => {
    if (error) setPlaced({})
  }, [error])

  const place = (docId: string, folder: FolderId) => {
    const next = { ...placed, [docId]: folder }
    setPlaced(next)
    setSelected(null)
    playSound('vote')
    if (Object.keys(next).length === puzzle.docs.length) onSubmit(next)
  }

  const tray = puzzle.docs.filter((d) => !placed[d.id])

  return (
    <div className="file-sort">
      <div className="file-sort__tray" aria-label="Files to sort">
        {tray.map((d) => (
          <button
            key={d.id}
            className={`doc-card ${selected === d.id ? 'is-selected' : ''}`}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', d.id)}
            onClick={() => setSelected(selected === d.id ? null : d.id)}
            disabled={busy}
            data-testid={`file-doc-${d.id}`}
          >
            <FileText size={18} aria-hidden /> {d.title}
          </button>
        ))}
        {tray.length === 0 && <p className="muted">{busy ? 'Checking…' : 'All files placed.'}</p>}
      </div>
      <div className="file-sort__folders">
        {puzzle.folders.map((f) => (
          <button
            key={f.id}
            className="folder-target"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/plain')
              if (id && !placed[id]) place(id, f.id)
            }}
            onClick={() => selected && place(selected, f.id)}
            disabled={busy}
            data-testid={`file-folder-${f.id}`}
          >
            <Folder size={28} aria-hidden />
            <strong>{f.label}</strong>
            <small>{Object.entries(placed).filter(([, v]) => v === f.id).length} file(s)</small>
          </button>
        ))}
      </div>
    </div>
  )
}
