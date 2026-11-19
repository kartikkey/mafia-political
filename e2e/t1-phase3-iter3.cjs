/**
 * T1 iteration 3: Spectator ghosts (ghost→ghost visibility, living masking, restrictions, voted-out ghost),
 * Map overlay (markers via pixel sampling, close paths), Leak clue (updates to later visitor, resets next meeting),
 * Shared clock (pages skewed +90s / -120s / +45s / -60s; grace, leak, power-cut, meeting timer, emergency cooldown).
 *   node e2e/t1-phase3-iter3.cjs [baseUrl]
 */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const MODE = process.argv[3] ?? 'all' // 'power' = power-cut banner seconds on skewed clients only
const SKEWS = [0, 90_000, -120_000, 0, 45_000, -60_000]
const T = 32, SPEED = 160
const results = []
const rec = (name, ok, note = '') => { results.push([name, ok, note]); console.log(`${ok ? 'PASS' : 'FAIL'} [${name}] ${note}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const st = (page) => page.evaluate(() => window.__netagiri.store.getState())
const t0 = Date.now()
const mark = (x) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${x}`)
async function until(fn, ms = 10000, step = 150) {
  const end = Date.now() + ms
  while (Date.now() < end) { const v = await fn().catch(() => null); if (v) return v; await sleep(step) }
  return null
}
const emit = async (page, ev, payload) => { await sleep(260); return page.evaluate(([ev, payload]) => new Promise((res) => {
  const s = window.__netagiri.socket
  const t = setTimeout(() => res({ timeout: true }), 3000)
  if (payload === undefined) s.emit(ev, (a) => { clearTimeout(t); res(a) })
  else s.emit(ev, payload, (a) => { clearTimeout(t); res(a) })
}), [ev, payload]) }
const secsOf = (t) => Number(String(t).match(/(\d+)s/)?.[1] ?? NaN)
const spread = (a) => Math.max(...a) - Math.min(...a)

const COLS = 40, ROWS = 26
const ROOMS = [[1, 1, 10, 9], [14, 1, 12, 11], [29, 1, 10, 9], [1, 15, 10, 10], [14, 15, 25, 10]]
const PASS = [[1, 12, 38, 2], [5, 10, 2, 2], [19, 12, 2, 1], [33, 10, 2, 2], [5, 14, 2, 1], [19, 14, 2, 1], [33, 14, 2, 1], [11, 4, 3, 2], [26, 4, 3, 2]]
const FURN = [[19, 2, 2, 1], [16, 5, 3, 1], [21, 5, 3, 1], [16, 8, 3, 1], [21, 8, 3, 1], [3, 3, 3, 1], [32, 3, 4, 1], [2, 17, 1, 6], [9, 17, 1, 6], [24, 19, 3, 2]]
const G = Array.from({ length: ROWS }, () => Array(COLS).fill(1))
const fill = ([x, y, w, h], v) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) G[j][i] = v }
ROOMS.forEach((r) => fill(r, 0)); PASS.forEach((r) => fill(r, 0)); FURN.forEach((r) => fill(r, 2))
function bfs(from, to) {
  const key = (x, y) => y * COLS + x
  const prev = new Map([[key(...from), null]]); const q = [from]
  while (q.length) {
    const [x, y] = q.shift(); if (x === to[0] && y === to[1]) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (G[ny]?.[nx] !== 0 || prev.has(key(nx, ny))) continue
      prev.set(key(nx, ny), [x, y]); q.push([nx, ny])
    }
  }
  const path = []; let c = to
  while (c) { path.unshift(c); c = prev.get(key(...c)) }
  const out = []
  for (let i = 0; i < path.length; i++) { const a = path[i - 1], b = path[i], n = path[i + 1]; if (!a || !n || (a[0] !== n[0] && a[1] !== n[1])) out.push(b) }
  return out
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || undefined })
  const pages = [], logs = []
  for (let i = 0; i < 6; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    if (SKEWS[i]) await ctx.addInitScript((skew) => { const n = Date.now.bind(Date); Date.now = () => n() + skew }, SKEWS[i])
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000)
    pg.on('pageerror', (e) => logs.push(`[p${i}] ${e.message}`))
    pg.on('console', (m) => m.type() === 'error' && logs.push(`[p${i} console] ${m.text()}`))
    pages.push(pg)
  }
  const names = ['Speaker', 'MP1', 'MP2', 'MP3', 'MP4', 'MP5']
  const host = pages[0]
  await host.goto(BASE); await until(async () => (await st(host)).join.connected)
  await host.fill('input[placeholder="Hon. Member"]', names[0]); await host.click('text=Create Room'); await host.waitForURL(/\/lobby\//)
  const code = host.url().split('/').pop()
  for (let i = 1; i < 6; i++) {
    const p = pages[i]; await p.goto(BASE); await until(async () => (await st(p)).join.connected)
    await p.fill('input[placeholder="Hon. Member"]', names[i]); await p.click(`.join__avatar >> nth=${i}`)
    await p.fill('input[aria-label="Room code"]', code); await p.click('button:has-text("Join")'); await p.waitForURL(/\/lobby\//)
  }
  await sleep(400); await host.click('text=Start Game')
  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal-title"]', { timeout: 15000 })))
  const S = await Promise.all(pages.map(st))
  const ids = S.map((s) => s.join.playerId)
  const fac = S.map((s) => s.game.role?.faction)
  const deep = fac.map((f, i) => (f === 'DEEP_STATE' ? i : -1)).filter((i) => i >= 0)
  const gov = fac.map((f, i) => (f === 'GOVERNMENT' ? i : -1)).filter((i) => i >= 0)
  const [D1, D2] = deep
  console.log('deep', deep.map((i) => `${names[i]}(skew ${SKEWS[i] / 1000}s)`), 'gov', gov.map((i) => `${names[i]}(skew ${SKEWS[i] / 1000}s)`))
  const offsets = await Promise.all(pages.map((p) => p.evaluate(() => window.__netagiri.store.getState().game.clockOffset ?? null).catch(() => null)))
  console.log('store clockOffset (if exposed):', offsets)

  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal"]', { state: 'detached', timeout: 10000 })))
  mark('play began')

  // ── Clock: starting grace on all Deep pages ──
  try {
    const r = await Promise.all(deep.map((i) => pages[i].textContent('[data-testid="action-eliminate-reason"]')))
    const n = r.map(secsOf)
    rec('clock-grace', n.every((x) => x >= 10 && x <= 12) && spread(n) <= 1, `deep ${deep.map((i) => `${names[i]}(${SKEWS[i] / 1000}s)`)} reasons ${JSON.stringify(r)}`)
  } catch (e) { rec('clock-grace', false, e.message) }

  const obsOf = (i) => (i === 0 ? 1 : 0)
  const posOf = async (i, via) => (await st(pages[via ?? obsOf(i)])).game.match.players.find((p) => p.id === ids[i]).position
  async function walkStraight(i, tx, ty, range = 10) {
    for (let n = 0; n < 30; n++) {
      const p = await posOf(i); const dx = tx - p.x, dy = ty - p.y
      if (Math.abs(dx) <= range && Math.abs(dy) <= range) return true
      const horiz = Math.abs(dx) > range
      const key = horiz ? (dx > 0 ? 'KeyD' : 'KeyA') : dy > 0 ? 'KeyS' : 'KeyW'
      const dist = horiz ? Math.abs(dx) : Math.abs(dy)
      await pages[i].keyboard.down(key); await sleep(Math.max(40, Math.min(600, ((dist - range / 2) / SPEED) * 1000))); await pages[i].keyboard.up(key); await sleep(120)
    }
    return false
  }
  async function goTile(i, tx, ty, finalRange = 14) {
    const p = await posOf(i)
    const path = bfs([Math.floor(p.x / T), Math.floor(p.y / T)], [tx, ty])
    for (const [k, [x, y]] of path.entries()) await walkStraight(i, x * T + 16, y * T + 16, k === path.length - 1 ? finalRange : 4)
    return posOf(i)
  }
  // Pixel colour on the map overlay canvas at world point
  const overlayPx = (page, x, y) => page.evaluate(([x, y]) => { const c = document.querySelector('[data-testid="map-overlay"] canvas'); const d = c.getContext('2d').getImageData(x - 8, y - 8, 1, 1).data; return [d[0], d[1], d[2]] }, [x, y])

  if (MODE === 'power') {
    for (const D of deep) {
      mark(`${names[D]} to power panel`)
      const end = await goTile(D, 15, 22, 12)
      console.log('arrived', end)
      if (Math.hypot(end.x - 496, end.y - 720) > 44) continue
      await sleep(300); await pages[D].keyboard.press('KeyE')
      const on = await until(async () => (await st(host)).game.match.sabotage.powerStatus === 'OUT', 3000)
      for (const wait of [1200, 6000]) {
        await sleep(wait)
        const b = await Promise.all(pages.map((p) => p.textContent('[data-testid="power-cut-banner"]').catch(() => 'none')))
        const n = b.map(secsOf)
        rec(`clock-power-banner+${wait}`, !!on && n.every((x) => x >= 1 && x <= 15) && spread(n) <= 1, `out=${!!on}; secs ${JSON.stringify(n)} skews ${SKEWS.map((s) => s / 1000)}`)
      }
      const cd = await Promise.all(deep.map((i) => pages[i].textContent('[data-testid="action-sabotage-reason"]').catch(() => 'n/a')))
      console.log('deep sabotage reasons during cut', cd)
      await pages[gov[0]].screenshot({ path: '/app/.screenshots/t3-powercut.png' })
      break
    }
    console.log('\n=== errors ===\n' + (logs.slice(0, 30).join('\n') || 'none'))
    await browser.close(); return
  }
  // ── Map overlay basics (gov page) ──
  const GA = gov[0]
  try {
    const tasks = (await st(pages[GA])).game.match.tasks
    await pages[GA].keyboard.press('KeyM'); await sleep(400)
    const open = await pages[GA].isVisible('[data-testid="map-overlay"]')
    const px = await overlayPx(pages[GA], tasks[0].position.x, tasks[0].position.y)
    await pages[GA].screenshot({ path: '/app/.screenshots/t3-map-open.png' })
    await pages[GA].click('[data-testid="map-overlay-close"]'); await sleep(300)
    const closedBtn = !(await pages[GA].isVisible('[data-testid="map-overlay"]'))
    await pages[GA].click('[data-testid="map-toggle"]'); await sleep(300)
    await pages[GA].mouse.click(10, 10); await sleep(300)
    const closedBackdrop = !(await pages[GA].isVisible('[data-testid="map-overlay"]'))
    // movement keys while open? (map should not let the player walk around blind — informational)
    await pages[GA].keyboard.press('KeyM'); await sleep(300)
    const before = await posOf(GA)
    await pages[GA].keyboard.down('KeyS'); await sleep(300); await pages[GA].keyboard.up('KeyS'); await sleep(300)
    const after = await posOf(GA)
    await pages[GA].keyboard.press('Escape'); await sleep(300)
    console.log(`INFO map open while pressing S: moved=${before.y !== after.y}`)
    // walk GA back to spawn if moved
    rec('map-overlay', open && closedBtn && closedBackdrop && px[1] > px[0], `open=${open}; first station pixel ${px} (green expected); close btn=${closedBtn}; backdrop=${closedBackdrop}`)
  } catch (e) { rec('map-overlay', false, e.message) }

  // ── Leak: D1 leaks ls-motion from (15,4), walks away; G visitor walks to (15,3) ──
  const VIS = gov[1], CALLER = gov[2]
  let leakAt = 0
  try {
    mark('D1 to ls-motion')
    await goTile(D1, 15, 4, 12)
    await sleep(300)
    await pages[D1].keyboard.press('KeyF')
    const leaked = await until(async () => (await st(host)).game.match.sabotage.disabledTaskIds[0], 3000)
    leakAt = Date.now()
    await sleep(1200)
    const banners = await Promise.all(pages.map((p) => p.textContent('[data-testid="document-leak-banner"]').catch(() => 'none')))
    const n = banners.map(secsOf)
    rec('clock-leak-banner', n.every((x) => x >= 17 && x <= 20) && spread(n) <= 1, `leak=${leaked}; banners secs ${JSON.stringify(n)}`)
    // map overlay offline marker on a gov page
    const task = (await st(pages[GA])).game.match.tasks.find((t) => t.taskId === leaked)
    await pages[GA].keyboard.press('KeyM'); await sleep(400)
    const px = await overlayPx(pages[GA], task.position.x, task.position.y)
    await pages[GA].screenshot({ path: '/app/.screenshots/t3-map-offline.png' })
    await pages[GA].keyboard.press('KeyM'); await sleep(200)
    rec('map-offline-marker', px[0] > 150 && px[1] < 90, `pixel at ${leaked} = ${px} (red #c0392b expected)`)
    const clue0 = (await st(host)).game.match.sabotage
    // D1 walks away out of range (to 17,4 → dist 71px)
    await goTile(D1, 18, 4, 8)
    mark(`visitor ${names[VIS]} to ls-motion`)
    await goTile(VIS, 15, 3, 10)
    const vp = await posOf(VIS)
    console.log('visitor at', vp, 'leak still active', (await st(host)).game.match.sabotage.disabledTaskIds, 'elapsed', Date.now() - leakAt)
    await goTile(VIS, 17, 6 > 0 ? 3 : 3, 10) // step away again
    await sleep(300)
    const em = await emit(pages[CALLER], 'EMERGENCY_MEETING')
    await until(async () => (await Promise.all(pages.map((p) => p.isVisible('[data-testid="leak-clue"]')))).every(Boolean), 6000)
    const clue = await Promise.all(pages.map((p) => p.textContent('[data-testid="leak-clue-player"]').catch(() => null)))
    await pages[CALLER].screenshot({ path: '/app/.screenshots/t3-clue-visitor.png' })
    rec('leak-clue-later-visitor', em.ok && clue.every((c) => c === names[VIS]), `emergency ${JSON.stringify(em)}; expected ${names[VIS]} (leaker ${names[D1]}); clue on all ${JSON.stringify(clue)}`)
    await sleep(2500)
    const timers = await Promise.all(pages.map((p) => p.textContent('[data-testid="meeting-timer"]')))
    rec('clock-meeting-timer', spread(timers.map(secsOf)) <= 1, `${JSON.stringify(timers)} skews ${SKEWS.map((s) => s / 1000)}`)
  } catch (e) { rec('leak-clue', false, e.message) }

  mark('wait for voting')
  await until(async () => (await st(host)).game.match.state === 'VOTING', 60000, 1000)
  for (const i of [0, 1, 2, 3, 4, 5]) await emit(pages[i], 'VOTE_SUBMITTED', { choice: 'SKIP' })
  await until(async () => (await st(host)).game.match.state === 'PLAYING', 15000, 300)
  await sleep(1000)
  try {
    const t = await Promise.all(pages.map((p) => p.textContent('[data-testid="action-emergency-reason"]')))
    const n = t.map(secsOf)
    rec('clock-emergency-cooldown', n.every((x) => x >= 54 && x <= 60) && spread(n) <= 1, JSON.stringify(t))
  } catch (e) { rec('clock-emergency-cooldown', false, e.message) }

  // ── Kill: D1 walks next to a gov target X (not VIS/CALLER) and kills; D2 goes to the power panel ──
  const X = gov.find((g) => g !== VIS && g !== CALLER && g !== GA) ?? gov[3]
  let bodyId = null
  try {
    mark(`D1 ${names[D1]} → ${names[X]}; D2 to power panel`)
    const xp = await posOf(X)
    const d2walk = goTile(D2, 15, 22, 12)
    await goTile(D1, Math.floor(xp.x / T), Math.floor(xp.y / T) + (Math.floor(xp.y / T) === 3 ? 1 : -1), 10)
    await walkStraight(D1, xp.x, xp.y, 24)
    const k = await emit(pages[D1], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[X] })
    await sleep(600)
    bodyId = (await st(host)).game.match.bodies?.[0]?.bodyId ?? null
    const banner = await pages[X].textContent('[data-testid="eliminated-banner"]').catch(() => '')
    rec('kill', k.ok, `${JSON.stringify(k)} body=${bodyId}; banner "${banner.trim()}"`)
    const living = pages.map((_, i) => i).filter((i) => i !== X)
    const deathSeen = await Promise.all(living.map(async (i) => (await posOf(X, i))))
    // Ghost drifts up through wall row 0
    await pages[X].keyboard.down('KeyW'); await sleep(1100); await pages[X].keyboard.up('KeyW'); await sleep(600)
    const own = await posOf(X, X)
    const livingNow = await Promise.all(living.map(async (i) => (await posOf(X, i))))
    const masked = livingNow.every((p, k) => p.x === deathSeen[k].x && p.y === deathSeen[k].y)
    await pages[X].screenshot({ path: '/app/.screenshots/t3-ghost1.png' })
    rec('ghost-banner', /ghost/i.test(banner), `(own store pos is not updated for the local player — wall passage is verified by ghost-sees-ghost) own pos ${JSON.stringify(own)} (wall row 0 → y<32); death ${JSON.stringify(deathSeen[0])}`)
    rec('ghost-masked-to-living', masked, `living see ${JSON.stringify(livingNow)}`)
    // restrictions
    const tId = (await st(pages[X])).game.match.tasks.find((t) => t.status !== 'COMPLETE').taskId
    const r1 = await emit(pages[X], 'TASK_OPENED', { taskId: tId })
    const r2 = await emit(pages[X], 'EMERGENCY_MEETING')
    const r3 = await emit(pages[X], 'BODY_REPORTED', { bodyId })
    const r4 = await emit(pages[X], 'CHAT_SEND', { text: 'boo' })
    const btns = await pages[X].evaluate(() => ['action-use', 'action-report', 'action-emergency'].map((id) => { const b = document.querySelector(`[data-testid="${id}"]`); return `${id}:${b ? (b.disabled ? 'disabled' : 'ENABLED') : 'absent'}` }))
    rec('ghost-restrictions', [r1, r2, r3, r4].every((r) => r.ok === false), `task ${JSON.stringify(r1)} emergency ${JSON.stringify(r2)} report ${JSON.stringify(r3)} chat ${JSON.stringify(r4)}; buttons ${btns}`)
    // canvas: living GA must not draw ghost — compare via store only (draw rule code-reviewed)
  } catch (e) { rec('kill/ghost', false, e.message) }

  // ── Power cut banner seconds ──
  try {
    await until(async () => { const p = await posOf(D2); return Math.hypot(p.x - (15 * 32 + 16), p.y - (22 * 32 + 16)) < 40 }, 40000, 500)
    await sleep(300)
    await pages[D2].keyboard.press('KeyE')
    const on = await until(async () => (await st(host)).game.match.sabotage.powerStatus === 'OUT', 3000)
    await sleep(1200)
    const b = await Promise.all(pages.map((p) => p.textContent('[data-testid="power-cut-banner"]').catch(() => 'none')))
    const n = b.map(secsOf)
    const alivePages = n.filter((_, i) => i !== X)
    rec('clock-power-banner', !!on && alivePages.every((x) => x >= 12 && x <= 15) && spread(alivePages) <= 1, `power out=${!!on}; banner secs ${JSON.stringify(n)} (ghost page ${X} may differ)`)
  } catch (e) { rec('clock-power-banner', false, e.message) }

  // ── Meeting 2 via body report: clue must be reset; ghost can't vote; vote out D2 ──
  try {
    const body = (await st(host)).game.match.bodies.find((b) => b.bodyId === bodyId)
    const REP = gov.find((g) => g !== X)
    await goTile(REP, Math.floor(body.position.x / T), Math.floor(body.position.y / T), 20)
    await walkStraight(REP, body.position.x, body.position.y, 30)
    const rr = await emit(pages[REP], 'BODY_REPORTED', { bodyId })
    await sleep(2500)
    const clueCount = await Promise.all(pages.map((p) => p.locator('[data-testid="leak-clue"]').count()))
    const storeClue = await Promise.all(pages.map(async (p) => (await st(p)).meeting?.clue ?? null))
    rec('leak-clue-reset', rr.ok && clueCount.every((c) => c === 0) && storeClue.every((c) => !c), `report ${JSON.stringify(rr)}; leak-clue elements ${clueCount}; store clue ${JSON.stringify(storeClue)}`)
    const dead = await pages[X].locator('[data-testid="chat-dead-notice"]').count()
    await until(async () => (await st(host)).game.match.state === 'VOTING', 60000, 1000)
    const vX = await emit(pages[X], 'VOTE_SUBMITTED', { choice: 'SKIP' })
    const voteUiX = await pages[X].locator('[data-testid="vote-confirm-btn"]').count()
    rec('ghost-no-vote-chat', vX.ok === false && dead === 1, `ghost vote ${JSON.stringify(vX)}; dead chat notice=${dead}; vote-confirm-btn count on ghost=${voteUiX}`)
    for (const i of [0, 1, 2, 3, 4, 5]) { if (i === X) continue; await emit(pages[i], 'VOTE_SUBMITTED', { choice: fac[i] === 'GOVERNMENT' ? ids[D2] : 'SKIP' }) }
    await until(async () => (await st(host)).game.match.state === 'PLAYING', 15000, 300)
    await sleep(800)
  } catch (e) { rec('meeting2', false, e.message) }

  // ── Voted-out ghost D2 + ghost↔ghost visibility ──
  try {
    const m = (await st(host)).game.match
    const d2dead = !m.players.find((p) => p.id === ids[D2]).alive
    const living = pages.map((_, i) => i).filter((i) => i !== X && i !== D2)
    const livBefore = await Promise.all(living.map((i) => posOf(D2, i)))
    const xSeesBefore = await posOf(D2, X)
    const ban = await pages[D2].textContent('[data-testid="eliminated-banner"]').catch(() => '')
    // D2 drifts down through bench/wall rows
    await pages[D2].keyboard.down('KeyS'); await sleep(1500); await pages[D2].keyboard.up('KeyS'); await sleep(700)
    const d2own = await posOf(D2, D2)
    const xSees = await posOf(D2, X)
    const livAfter = await Promise.all(living.map((i) => posOf(D2, i)))
    await pages[X].screenshot({ path: '/app/.screenshots/t3-ghost-sees-ghost.png' })
    await pages[living[0]].screenshot({ path: '/app/.screenshots/t3-living-view.png' })
    rec('voted-out-ghost-moves', d2dead && xSees.y > xSeesBefore.y + 200 && /ghost/i.test(ban), `D2 dead=${d2dead}; own ${JSON.stringify(xSeesBefore)}→${JSON.stringify(d2own)}; banner "${ban.trim()}"`)
    rec('ghost-sees-ghost', xSees.y !== xSeesBefore.y, `X sees D2 ${JSON.stringify(xSeesBefore)}→${JSON.stringify(xSees)}`)
    rec('voted-ghost-masked', livAfter.every((p, k) => p.x === livBefore[k].x && p.y === livBefore[k].y), `living see D2 ${JSON.stringify(livAfter)}`)
    // reverse: X moves, D2 sees
    const before = await posOf(X, D2)
    await pages[X].keyboard.down('KeyD'); await sleep(800); await pages[X].keyboard.up('KeyD'); await sleep(600)
    const after = await posOf(X, D2), xown = await posOf(X, X)
    const livX = await Promise.all(living.map((i) => posOf(X, i)))
    rec('ghost-sees-ghost-reverse', after.x !== before.x && livX.every((p) => p.x === before.x), `D2 sees X ${JSON.stringify(before)}→${JSON.stringify(after)} (own ${JSON.stringify(xown)}); living see X ${JSON.stringify(livX[0])}`)
    // living canvas does not draw ghosts: pixel diff is hard; check ghost names not in any DOM text
  } catch (e) { rec('ghost2', false, e.message) }

  console.log('\n=== errors ===\n' + (logs.slice(0, 30).join('\n') || 'none'))
  await browser.close()
}
setTimeout(() => { console.log('WATCHDOG'); summary(); process.exit(1) }, 330000).unref()
function summary() { console.log('\n=== SUMMARY ==='); for (const [n, ok, note] of results) console.log(`${ok ? 'PASS' : 'FAIL'} ${n} — ${note}`) }
main().catch((e) => console.error('ERROR', e)).finally(() => { summary(); process.exit(0) })
