import { Map as MapIcon, ZoomIn } from 'lucide-react'

/** Bottom-left controls legend (Board 1 & 2). Space is the primary Report key (Spec §3.1). */
export default function ControlsLegend({ deep, zoom, onZoom, onMap }: { deep: boolean; zoom: number; onZoom: () => void; onMap: () => void }) {
  const rows: [string, string][] = [
    ['WASD', 'Move'],
    ['E', deep ? 'Use / Cut power' : 'Use'],
    ['SPACE / R', 'Report body'],
    ...(deep ? ([['Q', 'Eliminate'], ['F', 'Leak documents']] as [string, string][]) : []),
    ['ESC', 'Close task'],
  ]
  return (
    <aside className="hud hud--legend" aria-label="Controls" data-testid="controls-legend">
      {rows.map(([k, v]) => (
        <p key={k}><kbd>{k}</kbd> {v}</p>
      ))}
      <button className="hud__zoom" onClick={onZoom} data-testid="zoom-toggle">
        <kbd>Z</kbd> <ZoomIn size={14} aria-hidden /> Zoom {zoom === 1 ? 'full map' : `${zoom}×`}
      </button>
      <button className="hud__zoom" onClick={onMap} data-testid="map-toggle">
        <kbd>M</kbd> <MapIcon size={14} aria-hidden /> Map
      </button>
    </aside>
  )
}
