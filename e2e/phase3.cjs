/**
 * Phase 3 check: shared clock (one browser 90s fast), map overlay (M), leak clue in meetings, spectator ghosts.
 *   node e2e/phase3.cjs [baseUrl]
 */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const SKEW = 90_000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (k, ok, note) => (results.push([ok ? 'PASS' : 'FAIL', k, note]), console.log(ok ? 'PASS' : 'FAIL', k, note))

;(async () => {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || undefined })
  const pages = []
  for (let i = 0; i < 6; i++) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
    // Browser 5's clock runs 90s fast.
    if (i === 5) await ctx.addInitScript((skew) => { const n = Date.now; Date.now = () => n() + skew }, SKEW)
    const p = await ctx.newPage()
    p.setDefaultTimeout(8000)
    p.on('pageerror', (e) => console.log(`[page ${i} error]`, e.message))
    pages.push(p)
  }
  const st = (p) => p.evaluate(() => window.__netagiri.store.getState())
  const emit = async (p, e, payload) => (await sleep(260), p.evaluate(([e, x]) => new Promise((res) => (x === undefined ? window.__netagiri.socket.emit(e, res) : window.__netagiri.socket.emit(e, x, res))), [e, payload]))
  await pages[0].goto(BASE); await sleep(1500)
  await pages[0].fill('input[placeholder="Hon. Member"]', 'Host'); await pages[0].click('text=Create Room'); await pages[0].waitForURL(/lobby/)
  const code = pages[0].url().split('/').pop()
  for (let i = 1; i < 6; i++) { const p = pages[i]; await p.goto(BASE); await sleep(1200); await p.fill('input[placeholder="Hon. Member"]', 'MP' + i); await p.click(`.join__avatar >> nth=${i}`); await p.fill('input[aria-label="Room code"]', code); await p.click('button:has-text("Join")'); await p.waitForURL(/lobby/) }
  await pages[0].click('text=Start Game'); await sleep(1500)
  const S = await Promise.all(pages.map(st))
  const ids = S.map((s) => s.join.playerId)
  const f = S.map((s) => s.game.role.faction)
  await sleep(4300) // role reveal

  const deepIdx = f.map((x, i) => (x === 'DEEP_STATE' ? i : -1)).filter((i) => i >= 0)

  // ── Map overlay ──
  await pages[1].keyboard.press('KeyM'); await sleep(500)
  const mapOpen = await pages[1].isVisible('[data-testid="map-overlay"]')
  await pages[1].screenshot({ path: 'docs/screenshots/map-overlay.png' })
  await pages[1].keyboard.press('KeyM'); await sleep(300)
  const mapClosed = !(await pages[1].isVisible('[data-testid="map-overlay"]'))
  await pages[1].click('[data-testid="map-toggle"]'); await sleep(300)
  const viaBtn = await pages[1].isVisible('[data-testid="map-overlay"]')
  await pages[1].keyboard.press('Escape'); await sleep(300)
  check('map-overlay', mapOpen && mapClosed && viaBtn && !(await pages[1].isVisible('[data-testid="map-overlay"]')), `M opens=${mapOpen}, M closes=${mapClosed}, button opens=${viaBtn}, Esc closes`)

  // ── Leak clue: a Deep State agent leaks "File the Motion" (tile 15,3), then an MP calls an emergency meeting ──
  const D = deepIdx[0]
  const obs = D === 0 ? 1 : 0
  const pos = async (i) => (await st(pages[i === 0 ? 1 : 0])).game.match.players.find((p) => p.id === ids[i]).position
  async function go(i, axis, target) {
    for (let n = 0; n < 30; n++) {
      const p = await pos(i); const d = target - p[axis]
      if (Math.abs(d) < 8) return
      const key = axis === 'x' ? (d > 0 ? 'KeyD' : 'KeyA') : d > 0 ? 'KeyS' : 'KeyW'
      await pages[i].keyboard.down(key); await sleep(Math.min(500, (Math.abs(d) / 160) * 1000)); await pages[i].keyboard.up(key); await sleep(150)
    }
  }
  await go(D, 'y', 112); await go(D, 'x', 496)
  await sleep(300)
  await pages[D].keyboard.press('KeyF'); await sleep(600)
  const leaked = (await st(pages[obs])).game.match.sabotage.disabledTaskIds
  const caller = f.findIndex((x, i) => x === 'GOVERNMENT' && i !== D)
  const em = await emit(pages[caller], 'EMERGENCY_MEETING')
  await sleep(1500)
  const clueTexts = await Promise.all(pages.map((p) => p.textContent('[data-testid="leak-clue-player"]').catch(() => null)))
  await pages[caller].screenshot({ path: 'docs/screenshots/meeting-leak-clue.png' })
  await sleep(1500)
  const timers = await Promise.all(pages.map((p) => p.textContent('[data-testid="meeting-timer"]')))
  const secs = timers.map((t) => Number(t.match(/(\d+)s/)?.[1]))
  check('clock-sync-phase', Math.max(...secs) - Math.min(...secs) <= 1, `meeting timers (browser 5 is ${SKEW / 1000}s fast): ${JSON.stringify(timers)}`)
  check('leak-clue', leaked[0] === 'ls-motion' && em.ok && clueTexts.every((t) => t === (D === 0 ? 'Host' : `MP${D}`)), `leak ${leaked}; emergency ${JSON.stringify(em)}; clue on all clients ${JSON.stringify(clueTexts)}`)
  console.log('waiting out the meeting (~66s)…')
  for (let n = 0; n < 50; n++) { if ((await st(pages[0])).game.match.state === 'VOTING') break; await sleep(1500) }
  for (const i of [0, 1, 2, 3, 4, 5]) await emit(pages[i], 'VOTE_SUBMITTED', { choice: 'SKIP' })
  for (let n = 0; n < 20; n++) { if ((await st(pages[0])).game.match.state === 'PLAYING') break; await sleep(500) }
  await sleep(800)
  const clueAfter = (await st(pages[0])).meeting.clue
  const emTexts = await Promise.all(pages.map((p) => p.textContent('[data-testid="action-emergency-reason"]')))
  const emSecs = emTexts.map((t) => Number(t.match(/(\d+)s/)?.[1]))
  check('clock-sync-cooldown', emSecs.every((x) => x >= 55 && x <= 60) && Math.max(...emSecs) - Math.min(...emSecs) <= 1, `emergency cooldown after resume: ${JSON.stringify(emTexts)}`)

  // ── Ghosts: agent eliminates an adjacent MP (spawn pairs are 32px apart) ──
  const ps = await Promise.all(pages.map((_, i) => pos(i)))
  let pair = null
  for (const d of deepIdx) for (let g = 0; g < 6; g++) if (f[g] === 'GOVERNMENT' && ps[d].y === ps[g].y) pair ??= [d, g]
  if (pair) await go(pair[0], 'x', ps[pair[1]].x + (ps[pair[0]].x < ps[pair[1]].x ? -20 : 20))
  if (!pair) {
    check('ghost', false, 'NOT RUN — no Deep State/Government pair on the same spawn row this run')
  } else {
    const [d, g] = pair
    const cd = (await st(pages[d])).game.eliminationReadyAt
    const k = await emit(pages[d], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[g] })
    await sleep(500)
    const living = [0, 1, 2, 3, 4, 5].find((i) => i !== g)
    const deathPos = (await st(pages[living])).game.match.players.find((p) => p.id === ids[g]).position
    // ghost drifts straight up through the bench/wall rows
    await pages[g].keyboard.down('KeyW'); await sleep(900); await pages[g].keyboard.up('KeyW'); await sleep(500)
    const livingSees = (await st(pages[living])).game.match.players.find((p) => p.id === ids[g]).position
    const bannerTxt = await pages[g].textContent('[data-testid="eliminated-banner"]').catch(() => '')
    await pages[g].screenshot({ path: 'docs/screenshots/ghost-view.png' })
    // second elimination later would let ghost 1 watch ghost 2; here confirm no ghost moves leak to the living
    check('ghost', k.ok && livingSees.x === deathPos.x && livingSees.y === deathPos.y && /ghost/i.test(bannerTxt),
      `kill ${JSON.stringify(k)} (cooldown was ready=${cd <= Date.now()}); living still see ghost at death spot ${JSON.stringify(livingSees)} (death ${JSON.stringify(deathPos)}); banner "${bannerTxt.trim().slice(0, 40)}…"`)
  }

  console.log('\n=== SUMMARY ===')
  for (const r of results) console.log(r.join(' — '))
  await b.close()
})()
