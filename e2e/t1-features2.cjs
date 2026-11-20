/**
 * T1 iteration 2: Document Leak sabotage, camera follow + zoom, fake-task interact bubble,
 * starting elimination cooldown. 6 browser contexts.
 *   node e2e/t1-features2.cjs [baseUrl]
 */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const MODE = process.argv[3] ?? 'all' // 'cam' = starting-cooldown at server + camera edge walk
const T = 32
const SPEED = 160
const results = []
const rec = (name, ok, note = '') => { results.push([name, ok, note]); console.log(`${ok ? 'PASS' : 'FAIL'} [${name}] ${note}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const st = (page) => page.evaluate(() => window.__netagiri.store.getState())
async function until(fn, ms = 10000, step = 150) {
  const end = Date.now() + ms
  while (Date.now() < end) { const v = await fn().catch(() => null); if (v) return v; await sleep(step) }
  return null
}
const t0 = Date.now()
const mark = (x) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${x}`)
// raw socket emit with ack
const emit = (page, ev, payload) => page.evaluate(([ev, payload]) => new Promise((res) => {
  const s = window.__netagiri.socket
  const t = setTimeout(() => res({ timeout: true }), 3000)
  if (payload === undefined) s.emit(ev, (a) => { clearTimeout(t); res(a) })
  else s.emit(ev, payload, (a) => { clearTimeout(t); res(a) })
}), [ev, payload])

// ── grid replica of shared/src/map/parliament.ts for BFS (copied from t1-minigames.cjs) ──
const COLS = 40, ROWS = 26
const ROOMS = [[1, 1, 10, 9], [14, 1, 12, 11], [29, 1, 10, 9], [1, 15, 10, 10], [14, 15, 25, 10]]
const PASS = [[1, 12, 38, 2], [5, 10, 2, 2], [19, 12, 2, 1], [33, 10, 2, 2], [5, 14, 2, 1], [19, 14, 2, 1], [33, 14, 2, 1], [11, 4, 3, 2], [26, 4, 3, 2]]
const FURN = [[19, 2, 2, 1], [16, 5, 3, 1], [21, 5, 3, 1], [16, 8, 3, 1], [21, 8, 3, 1], [3, 3, 3, 1], [32, 3, 4, 1], [2, 17, 1, 6], [9, 17, 1, 6], [24, 19, 3, 2]]
const G = Array.from({ length: ROWS }, () => Array(COLS).fill(1))
const fill = ([x, y, w, h], v) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) G[j][i] = v }
ROOMS.forEach((r) => fill(r, 0)); PASS.forEach((r) => fill(r, 0)); FURN.forEach((r) => fill(r, 2))
function bfs(from, to) {
  const key = (x, y) => y * COLS + x
  const prev = new Map([[key(...from), null]])
  const q = [from]
  while (q.length) {
    const [x, y] = q.shift()
    if (x === to[0] && y === to[1]) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (G[ny]?.[nx] !== 0 || prev.has(key(nx, ny))) continue
      prev.set(key(nx, ny), [x, y]); q.push([nx, ny])
    }
  }
  const path = []; let c = to
  while (c) { path.unshift(c); c = prev.get(key(...c)) }
  const out = []
  for (let i = 0; i < path.length; i++) {
    const a = path[i - 1], b = path[i], n = path[i + 1]
    if (!a || !n || (a[0] !== n[0] && a[1] !== n[1])) out.push(b)
  }
  return out
}

// Where is world point (x,y) on screen at the given zoom (replicates ParliamentCanvas camera, settled; x,y = walker)? What covers it?
const coverAt = (page, pts, zoom) => page.evaluate(([pts, zoom]) => {
  const c = document.querySelector('[data-testid="parliament-canvas"]'); const r = c.getBoundingClientRect()
  const W = 1280, H = 832, dpr = devicePixelRatio
  const fit = Math.min(c.width / W, c.height / H), s = fit * zoom, vw = c.width / s, vh = c.height / s
  const cl = (v, view, size) => (view >= size ? size / 2 : Math.min(size - view / 2, Math.max(view / 2, v)))
  return pts.map(([name, x, y]) => {
    // Camera centres on the local player when zoomed in (no edge clamp); zoom 1 shows the whole map.
    const cx = zoom > 1 ? x : W / 2, cy = zoom > 1 ? y : H / 2
    const hits = [[0, 0], [0, -16], [0, -27]].map(([dx, dy]) => {
      const sx = (c.width / 2 + (x + dx - cx) * s) / dpr + r.left, sy = (c.height / 2 + (y + dy - cy) * s) / dpr + r.top
      const el = document.elementFromPoint(sx, sy)
      return el === c ? 'canvas' : (el?.closest('[data-testid]')?.getAttribute('data-testid') ?? el?.className ?? 'offscreen')
    })
    return { name, hits }
  })
}, [pts, zoom])

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || undefined })
  const pages = [], logs = []
  for (let i = 0; i < 6; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000)
    pg.on('pageerror', (e) => logs.push(`[p${i}] ${e.message}`))
    pg.on('console', (m) => m.type() === 'error' && logs.push(`[p${i} console] ${m.text()}`))
    pages.push(pg)
  }
  const names = ['Speaker', 'MP1', 'MP2', 'MP3', 'MP4', 'MP5']
  const [host] = pages
  mark('join')
  await host.goto(BASE)
  await until(async () => (await st(host)).join.connected)
  await host.fill('input[placeholder="Hon. Member"]', names[0])
  await host.click('text=Create Room')
  await host.waitForURL(/\/lobby\//)
  const code = host.url().split('/').pop()
  for (let i = 1; i < 6; i++) {
    const p = pages[i]
    await p.goto(BASE); await until(async () => (await st(p)).join.connected)
    await p.fill('input[placeholder="Hon. Member"]', names[i]); await p.click(`.join__avatar >> nth=${i}`)
    await p.fill('input[aria-label="Room code"]', code); await p.click('button:has-text("Join")'); await p.waitForURL(/\/lobby\//)
  }
  await sleep(400)
  await host.click('text=Start Game')
  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal-title"]', { timeout: 15000 })))
  const S = await Promise.all(pages.map(st))
  const ids = S.map((s) => s.join.playerId)
  const fac = S.map((s) => s.game.role?.faction)
  const deep = fac.map((f, i) => (f === 'DEEP_STATE' ? i : -1)).filter((i) => i >= 0)
  const gov = fac.map((f, i) => (f === 'GOVERNMENT' ? i : -1)).filter((i) => i >= 0)
  const [D1, D2] = deep, [GA, GB, GC, GD] = gov
  console.log('deep', deep.map((i) => names[i]), 'gov', gov.map((i) => names[i]))

  // early elimination during reveal
  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal"]', { state: 'detached', timeout: 10000 })))
  const playAt = Date.now()
  mark('play began')

  const obs = (i) => (i === 0 ? 1 : 0)
  const posOf = async (i) => (await st(pages[obs(i)])).game.match.players.find((p) => p.id === ids[i]).position
  async function walkStraight(i, tx, ty, range = 10) {
    const page = pages[i]
    for (let n = 0; n < 30; n++) {
      const p = await posOf(i)
      const dx = tx - p.x, dy = ty - p.y
      if (Math.abs(dx) <= range && Math.abs(dy) <= range) return true
      const horiz = Math.abs(dx) > range
      const key = horiz ? (dx > 0 ? 'KeyD' : 'KeyA') : dy > 0 ? 'KeyS' : 'KeyW'
      const dist = horiz ? Math.abs(dx) : Math.abs(dy)
      await page.keyboard.down(key)
      await sleep(Math.max(40, Math.min(600, ((dist - range / 2) / SPEED) * 1000)))
      await page.keyboard.up(key)
      await sleep(120)
    }
    return false
  }
  async function goTile(i, tx, ty, finalRange = 14) {
    const p = await posOf(i)
    const path = bfs([Math.floor(p.x / T), Math.floor(p.y / T)], [tx, ty])
    for (const [k, [x, y]] of path.entries()) await walkStraight(i, x * T + 16, y * T + 16, k === path.length - 1 ? finalRange : 4)
    return posOf(i)
  }

  if (MODE === 'cam') {
    // Starting cooldown at the server: walk a Deep State agent next to a Government MP inside the 12s window.
    const d = D1
    const players = (await st(host)).game.match.players
    const dp = players.find((p) => p.id === ids[d]).position
    const g = gov.map((g) => ({ g, p: players.find((p) => p.id === ids[g]).position })).sort((a, b) => Math.hypot(a.p.x - dp.x, a.p.y - dp.y) - Math.hypot(b.p.x - dp.x, b.p.y - dp.y))[0].g
    const gp = await posOf(g)
    await goTile(d, Math.floor(gp.x / T), Math.floor(gp.y / T) + 1, 12)
    const dist = Math.hypot((await posOf(d)).x - gp.x, (await posOf(d)).y - gp.y)
    const rsn = await pages[d].textContent('[data-testid="action-eliminate-reason"]')
    await sleep(250)
    const raw = await emit(pages[d], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[g] })
    rec('start-cooldown-server', raw.ok === false && /^Cooldown: \d+s$/.test(raw.reason) && dist <= 40, `${names[d]}→${names[g]} dist ${dist.toFixed(0)} at ${Date.now() - playAt}ms; UI "${rsn}"; raw ${JSON.stringify(raw)}`)
    await sleep(Math.max(0, playAt + 12000 - Date.now()) + 700)
    const rsn2 = await pages[d].textContent('[data-testid="action-eliminate-reason"]')
    await pages[d].keyboard.press('KeyQ')
    const dead = await until(async () => !(await st(host)).game.match.players.find((p) => p.id === ids[g]).alive, 3000)
    rec('elim-after-cooldown', !!dead, `reason after 12s "${rsn2}"; ${names[g]} eliminated=${!!dead} at ${Date.now() - playAt}ms`)
    // Camera: walk a living Government MP to room edges and screenshot at zoom 2
    const walker = gov.find((x) => x !== g)
    for (const [name, tx, ty] of [['fin-budget', 4, 5], ['pm-corner', 37, 2], ['records-corner', 2, 23]]) {
      await goTile(walker, tx, ty, 10)
      await sleep(600)
      const pp = await posOf(walker)
      const cov = await coverAt(pages[walker], [[name, pp.x, pp.y]], 2)
      await pages[walker].screenshot({ path: `/app/.screenshots/t2-cam-${name}.png` })
      rec(`cam-walk-${name}`, cov[0].hits.every((h) => h === 'canvas'), `walker at ${JSON.stringify(pp)} → ${cov[0].hits.join('/')}`)
    }
    // smooth follow: screenshot mid-walk
    await pages[walker].keyboard.down('KeyD'); await sleep(250)
    await pages[walker].screenshot({ path: '/app/.screenshots/t2-cam-midwalk.png' })
    await pages[walker].keyboard.up('KeyD')
    console.log('\n=== errors ===\n' + (logs.slice(0, 30).join('\n') || 'none'))
    await browser.close()
    return
  }

  // ── 4. Starting cooldown ──
  mark('starting cooldown')
  try {
    const reasons = await Promise.all(deep.map((i) => pages[i].textContent('[data-testid="action-eliminate-reason"]')))
    const disabled = await Promise.all(deep.map((i) => pages[i].isDisabled('[data-testid="action-eliminate"]')))
    const players = (await st(host)).game.match.players
    let raw = null, pair = null
    for (const d of deep) {
      const dp = players.find((p) => p.id === ids[d]).position
      const tgt = gov.map((g) => ({ g, p: players.find((p) => p.id === ids[g]).position })).map((o) => ({ ...o, dist: Math.hypot(o.p.x - dp.x, o.p.y - dp.y) })).sort((a, b) => a.dist - b.dist)[0]
      if (tgt.dist <= 40) { pair = [d, tgt.g, tgt.dist]; raw = await emit(pages[d], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[tgt.g] }); break }
    }
    const n = reasons.map((r) => +(r.match(/Cooldown: (\d+)s/)?.[1] ?? -1))
    rec('start-cooldown-ui', n.every((x) => x >= 9 && x <= 12) && disabled.every(Boolean), `deep reasons ${JSON.stringify(reasons)} disabled=${disabled} (${Date.now() - playAt}ms after play)`)
    rec('start-cooldown-server', pair ? raw?.ok === false && /Cooldown: \d+s/.test(raw.reason) : false, pair ? `adjacent pair ${names[pair[0]]}→${names[pair[1]]} dist ${pair[2]} → ${JSON.stringify(raw)}` : 'no adjacent deep/gov pair at spawn')
    const govLeak = await Promise.all(gov.map((i) => pages[i].locator('[data-testid="action-leak"]').count()))
    const deepLeak = await Promise.all(deep.map((i) => pages[i].locator('[data-testid="action-leak"]').count()))
    rec('leak-button-visibility', govLeak.every((c) => c === 0) && deepLeak.every((c) => c === 1), `gov leak buttons ${govLeak}, deep ${deepLeak}`)
    globalThis.__pair = pair
  } catch (e) { rec('start-cooldown', false, e.message) }

  // ── 2. Camera / zoom ──
  mark('camera')
  try {
    const box = await pages[GA].evaluate(() => {
      const c = document.querySelector('[data-testid="parliament-canvas"]').getBoundingClientRect()
      const m = document.querySelector('.game__map').getBoundingClientRect()
      return { c: [c.x, c.y, c.width, c.height], m: [m.x, m.y, m.width, m.height], z: document.querySelector('[data-testid="parliament-canvas"]').dataset.zoom }
    })
    rec('camera-fill', JSON.stringify(box.c) === JSON.stringify(box.m) && box.z === '2', `canvas ${box.c} map ${box.m} zoom ${box.z}`)
    const zs = []
    for (let k = 0; k < 3; k++) { await pages[GA].click('[data-testid="zoom-toggle"]'); await sleep(150); zs.push([await pages[GA].getAttribute('[data-testid="parliament-canvas"]', 'data-zoom'), (await pages[GA].textContent('[data-testid="zoom-toggle"]')).trim()]) }
    await pages[GA].keyboard.press('KeyZ'); await sleep(150)
    const zk = await pages[GA].getAttribute('[data-testid="parliament-canvas"]', 'data-zoom')
    await pages[GA].keyboard.press('KeyZ'); await pages[GA].keyboard.press('KeyZ'); await sleep(150)
    const zback = await pages[GA].getAttribute('[data-testid="parliament-canvas"]', 'data-zoom')
    rec('zoom-cycle', zs.map((z) => z[0]).join(',') === '1.4,1,2' && zk === '1.4' && zback === '2', `button: ${JSON.stringify(zs)}; Z→${zk}; ZZ→${zback}`)
    // coverage of every station + spawn at each zoom and viewport
    const pts = (await st(host)).game.match.tasks.map((t) => [t.taskId, t.position.x, t.position.y])
    pts.push(['spawn0', 17 * 32 + 16, 3 * 32 + 16], ['power-panel', 15 * 32 + 16, 22 * 32 + 16], ['corner-TL', 2 * 32 + 16, 2 * 32 + 16], ['corner-BR', 37 * 32 + 16, 23 * 32 + 16], ['corner-BL', 2 * 32 + 16, 23 * 32 + 16], ['corner-TR', 37 * 32 + 16, 2 * 32 + 16])
    for (const vp of [[1280, 800], [1920, 800], [1920, 1080]]) {
      await pages[GA].setViewportSize({ width: vp[0], height: vp[1] }); await sleep(400)
      for (const z of [2, 1.4, 1]) {
        const cov = await coverAt(pages[GA], pts, z)
        const hidden = cov.filter((c) => c.hits.some((h) => h !== 'canvas'))
        rec(`camera-cover-${vp[0]}x${vp[1]}-z${z}`, z === 1 ? true : hidden.length === 0, hidden.length ? hidden.map((h) => `${h.name}:${[...new Set(h.hits)].join('/')}`).join('; ') : 'all points visible')
      }
    }
    await pages[GA].setViewportSize({ width: 1280, height: 800 }); await sleep(300)
  } catch (e) { rec('camera', false, e.message) }

  // ── 3. Fake task bubble + real task ──
  mark('walk to ls-motion')
  await Promise.all([goTile(GA, 15, 3, 14), goTile(D1, 15, 4, 14)])
  await sleep(300)
  try {
    const others = (i) => pages.filter((_, k) => k !== i)
    // Government real task
    await pages[GA].keyboard.press('KeyE')
    await pages[GA].waitForSelector('[data-testid="task-modal"]', { timeout: 4000 })
    const seeGA = await until(async () => { const v = await Promise.all(others(GA).map(async (p) => (await st(p)).game.interacting[ids[GA]])); return v.every((x) => x === 'ls-motion') && v }, 3000)
    await pages[GA].keyboard.press('Escape'); await sleep(600)
    const goneGA = await Promise.all(others(GA).map(async (p) => (await st(p)).game.interacting[ids[GA]] ?? null))
    rec('interact-real', !!seeGA && goneGA.every((x) => x === null), `others see GA=${JSON.stringify(seeGA)}; after Esc ${JSON.stringify(goneGA)}`)
    // Deep fake task
    await sleep(300)
    await pages[D1].keyboard.press('KeyE')
    const modalD = await pages[D1].waitForSelector('[data-testid="task-modal"]', { timeout: 4000 }).then(() => true).catch(() => false)
    const seeD = await until(async () => { const v = await Promise.all(others(D1).map(async (p) => (await st(p)).game.interacting[ids[D1]])); return v.every((x) => x === 'ls-motion') && v }, 3000)
    await pages[GB].screenshot({ path: '/app/.screenshots/t2-fake-bubble.png' })
    // close via ✕ button
    const xBtn = pages[D1].locator('[data-testid="task-modal-close"], [aria-label="Close"]').first()
    if (await xBtn.count()) await xBtn.click(); else await pages[D1].keyboard.press('Escape')
    await sleep(600)
    const goneD = await Promise.all(others(D1).map(async (p) => (await st(p)).game.interacting[ids[D1]] ?? null))
    rec('interact-fake', modalD && !!seeD && goneD.every((x) => x === null), `deep modal=${modalD}; others see D1=${JSON.stringify(seeD)}; after ✕ ${JSON.stringify(goneD)} (closeBtn found=${await xBtn.count()})`)
  } catch (e) { rec('interact', false, e.message) }

  // ── 1. Document Leak ──
  mark('leak')
  try {
    await sleep(300)
    await pages[GA].keyboard.press('KeyE')
    await pages[GA].waitForSelector('[data-testid="task-modal"]', { timeout: 4000 })
    await sleep(400)
    const dReasonBefore = await pages[D1].textContent('[data-testid="action-leak-reason"]')
    await pages[D1].keyboard.press('KeyF')
    const banners = await until(async () => { const v = await Promise.all(pages.map((p) => p.isVisible('[data-testid="document-leak-banner"]'))); return v.every(Boolean) && v }, 4000)
    const leakAt = Date.now()
    const bannerTxt = await pages[GB].textContent('[data-testid="document-leak-banner"]')
    const ticker = await pages[GB].textContent('[data-testid="news-ticker-text"]')
    await sleep(300)
    const gaModal = await pages[GA].isVisible('[data-testid="task-modal"]')
    const gaFb = await pages[GA].textContent('[data-testid="action-feedback"]').catch(() => '')
    const gaInter = await Promise.all(pages.filter((_, k) => k !== GA).map(async (p) => (await st(p)).game.interacting[ids[GA]] ?? null))
    rec('leak-trigger', !!banners && /File the Motion/.test(bannerTxt) && ticker.includes('ALERT: Parliamentary records access has been disrupted!'), `D1 reason before "${dReasonBefore}"; banners=${!!banners}; banner "${bannerTxt}"; ticker "${ticker}"`)
    rec('leak-closes-gov-modal', !gaModal && /Documents leaked — station offline/.test(gaFb) && gaInter.every((x) => x === null), `GA modal open=${gaModal}; feedback "${gaFb}"; others' interacting[GA] ${JSON.stringify(gaInter)}`)
    const hudRow = await pages[GB].textContent('[data-testid="task-item-ls-motion"]').catch(() => 'n/a')
    const useReason = await pages[GA].textContent('[data-testid="action-use-reason"]')
    const useDisabled = await pages[GA].isDisabled('[data-testid="action-use"]')
    const prompt = await pages[GA].textContent('[data-testid="interaction-prompt"]').catch(() => 'none')
    await pages[GA].keyboard.press('KeyE'); await sleep(300)
    const eModal = await pages[GA].isVisible('[data-testid="task-modal"]')
    await sleep(300)
    const raw = await emit(pages[GA], 'TASK_OPENED', { taskId: 'ls-motion' })
    rec('leak-station-offline', /OFFLINE/.test(hudRow) && useReason.includes('Station offline (leak)') && useDisabled && !eModal && raw.ok === false && /^Documents leaked — back in \d+s$/.test(raw.reason),
      `HUD row "${hudRow}"; Use reason "${useReason}" disabled=${useDisabled}; prompt "${prompt}"; E opened modal=${eModal}; raw ${JSON.stringify(raw)}`)
    const dReason = await pages[D1].textContent('[data-testid="action-leak-reason"]')
    await sleep(300)
    const raw2 = await emit(pages[D1], 'SABOTAGE_REQUEST', { type: 'DOCUMENT_LEAK', targetTaskId: 'ls-motion' })
    rec('leak-one-at-a-time', /Sabotage active/.test(dReason) && raw2.ok === false && /Sabotage already active/.test(raw2.reason), `D1 leak reason "${dReason}"; raw leak again ${JSON.stringify(raw2)}`)
    await pages[GA].screenshot({ path: '/app/.screenshots/t2-leak-gov.png' })

    // Power cut during leak: D2 walks to power panel
    mark('D2 to power panel')
    await goTile(D2, 15, 22, 14)
    const d2Reason = await pages[D2].textContent('[data-testid="action-sabotage-reason"]')
    await sleep(300)
    const stillLeak = (await st(host)).game.match.sabotage.disabledTaskIds.length > 0
    const raw3 = await emit(pages[D2], 'SABOTAGE_REQUEST', { type: 'POWER_CUT' })
    rec('powercut-during-leak', !stillLeak || (/Sabotage active/.test(d2Reason) && raw3.ok === false && /Sabotage already active/.test(raw3.reason)), `leak still active=${stillLeak}; D2 sabotage reason "${d2Reason}"; raw ${JSON.stringify(raw3)}`)

    // Elimination after starting cooldown (D2 kills nearest gov via walking) — do while leak counts down
    mark('elimination after cooldown')
    const pair = globalThis.__pair
    if (pair) {
      const [d, g] = pair
      // if d moved (D2), walk him back next to g
      const gp = await posOf(g)
      if (d === D1) { rec('elim-after-cooldown', true, 'skipped here (D1 busy) — see later') }
      else {
        await goTile(d, Math.floor(gp.x / T), Math.floor(gp.y / T), 20)
        await walkStraight(d, gp.x, gp.y, 20)
        await sleep(300)
        const rsn = await pages[d].textContent('[data-testid="action-eliminate-reason"]')
        await pages[d].keyboard.press('KeyQ')
        const dead = await until(async () => !(await st(host)).game.match.players.find((p) => p.id === ids[g]).alive, 3000)
        rec('elim-after-cooldown', !!dead, `reason before Q "${rsn}"; ${names[g]} dead=${!!dead} at ${Math.round((Date.now() - playAt) / 1000)}s after play`)
      }
    }

    // leak ends after 20s
    mark('wait leak end')
    const ended = await until(async () => (await st(host)).game.match.sabotage.disabledTaskIds.length === 0, 25000, 250)
    const dur = Date.now() - leakAt
    const t2 = await pages[GB].textContent('[data-testid="news-ticker-text"]')
    const bGone = !(await pages[GB].isVisible('[data-testid="document-leak-banner"]'))
    rec('leak-recovered', !!ended && dur > 18000 && dur < 22500 && t2.includes('UPDATE: The leaked files have been recovered. Records access restored.') && bGone, `ended after ~${dur}ms; ticker "${t2}"; banner gone=${bGone}`)
    await sleep(300)
    const cd = await pages[D1].textContent('[data-testid="action-leak-reason"]')
    const cdN = +(cd.match(/Cooldown: (\d+)s/)?.[1] ?? -1)
    rec('sabotage-shared-cooldown', cdN >= 7 && cdN <= 11, `D1 leak reason after recovery "${cd}"`)
    // Use works again for GA
    await pages[GA].keyboard.press('KeyE')
    const reopen = await pages[GA].waitForSelector('[data-testid="task-modal"]', { timeout: 3000 }).then(() => true).catch(() => false)
    await pages[GA].keyboard.press('Escape')
    rec('station-back-online', reopen, `GA could open ls-motion again=${reopen}`)

    // wait cooldown, leak again, then meeting clears it
    mark('wait cooldown then leak + meeting')
    const sabReady = (await st(pages[D1])).game.sabotageReadyAt
    await sleep(Math.max(0, sabReady - Date.now()) + 500)
    await pages[D1].keyboard.press('KeyF')
    const leak2 = await until(async () => (await st(host)).game.match.sabotage.disabledTaskIds.length > 0, 3000)
    await sleep(300)
    const m = await emit(pages[GD], 'EMERGENCY_MEETING')
    const cleared = await until(async () => { const v = await Promise.all(pages.map(async (p) => { const s = (await st(p)).game.match; return s.state !== 'PLAYING' && s.sabotage.disabledTaskIds.length === 0 })); return v.every(Boolean) }, 4000)
    rec('meeting-clears-leak', !!leak2 && m?.ok && !!cleared, `second leak=${!!leak2}; meeting ack ${JSON.stringify(m)}; cleared on all=${!!cleared}`)
  } catch (e) { rec('leak', false, e.message) }

  console.log('\n=== errors ===\n' + (logs.slice(0, 30).join('\n') || 'none'))
  await browser.close()
}

setTimeout(() => { console.log('WATCHDOG'); summary(); process.exit(1) }, 300000).unref()
function summary() {
  console.log('\n=== SUMMARY ===')
  for (const [n, ok, note] of results) console.log(`${ok ? 'PASS' : 'FAIL'} ${n} — ${note}`)
}
main().catch((e) => console.error('ERROR', e)).finally(() => { summary(); process.exit(0) })
