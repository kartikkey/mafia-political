/** Bottom-left controls legend (Board 1 & 2). Space is the primary Report key (Spec §3.1). */
export default function ControlsLegend({ deep }: { deep: boolean }) {
  const rows: [string, string][] = [
    ['WASD', 'Move'],
    ['E', deep ? 'Use / Sabotage' : 'Use'],
    ['SPACE / R', 'Report body'],
    ...(deep ? ([['Q', 'Eliminate']] as [string, string][]) : []),
    ['ESC', 'Close task'],
  ]
  return (
    <aside className="hud hud--legend" aria-label="Controls" data-testid="controls-legend">
      {rows.map(([k, v]) => (
        <p key={k}><kbd>{k}</kbd> {v}</p>
      ))}
    </aside>
  )
}
