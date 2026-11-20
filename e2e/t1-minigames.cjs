/**
 * T1 regression: mini-game UIs (File Sort drag/drop + wrong answer, Approve the Bill, Restore Power),
 * Power Cut + repair, elimination UI reasons/victim freeze, meeting chat/dead notice, voting UI,
 * results (Leave / Back to Lobby / second start), mute toggle persistence.
 *   node e2e/t1-minigames.cjs [baseUrl]
 */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
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

// ── grid replica of shared/src/map/parliament.ts for BFS ──
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
  // compress to corners
  const out = []
  for (let i = 0; i < path.length; i++) {
    const a = path[i - 1], b = path[i], n = path[i + 1]
    if (!a || !n || (a[0] !== n[0] && a[1] !== n[1])) out.push(b)
  }
  return out
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || undefined })
  const pages = []
  const logs = []
  for (let i = 0; i < 6; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000)
    pg.on('pageerror', (e) => logs.push(`[p${i}] ${e.message}`))
    pg.on('console', (m) => m.type() === 'error' && logs.push(`[p${i} console] ${m.text()}`))
    pages.push(pg)
  }
  const names = ['Speaker', 'MP1', 'MP2', 'MP3', 'MP4', 'MP5']
  const [host] = pages
  // ── Join ──
  mark('join')
  await host.goto(BASE)
  await until(async () => (await st(host)).join.connected)
  await host.fill('input[placeholder="Hon. Member"]', names[0])
  await host.click('text=Create Room')
  await host.waitForURL(/\/lobby\//)
  const code = host.url().split('/').pop()
  async function join(p, i) {
    await p.goto(BASE)
    await until(async () => (await st(p)).join.connected)
    await p.fill('input[placeholder="Hon. Member"]', names[i])
    await p.click(`.join__avatar >> nth=${i % 6}`)
    await p.fill('input[aria-label="Room code"]', code)
    await p.click('button:has-text("Join")')
    await p.waitForURL(/\/lobby\//)
  }
  for (let i = 1; i < 5; i++) await join(pages[i], i)
  await sleep(400)
  const disabled5 = await host.isDisabled('button:has-text("Start Game")')
  await join(pages[5], 5)
  await sleep(400)
  const enabled6 = await host.isEnabled('button:has-text("Start Game")')
  rec('start-gate', disabled5 && enabled6, `5 players disabled=${disabled5}, 6 players enabled=${enabled6}, code=${code}`)

  // ── Start / roles ──
  await host.click('text=Start Game')
  await Promise.all(pages.map((p) => p.waitForURL(/\/game\//)))
  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal-title"]', { timeout: 15000 })))
  const S = await Promise.all(pages.map(st))
  const ids = S.map((s) => s.join.playerId)
  const fac = S.map((s) => s.game.role?.faction)
  const deep = fac.map((f, i) => (f === 'DEEP_STATE' ? i : -1)).filter((i) => i >= 0)
  const gov = fac.map((f, i) => (f === 'GOVERNMENT' ? i : -1)).filter((i) => i >= 0)
  const govMate = await Promise.all(gov.map((i) => pages[i].isVisible('[data-testid="role-reveal-teammates"]')))
  const deepMateTxt = await pages[deep[0]].textContent('[data-testid="role-reveal-teammates"]').catch(() => '')
  const govTitle = await pages[gov[0]].textContent('[data-testid="role-reveal-title"]')
  const deepTitle = await pages[deep[0]].textContent('[data-testid="role-reveal-title"]')
  rec('role-reveal', govMate.every((v) => !v) && deepMateTxt.includes(names[deep[1]]), `gov title "${govTitle}", deep title "${deepTitle}", deep teammates "${deepMateTxt}"`)
  await host.screenshot({ path: '/app/.screenshots/t1-role-reveal-host.png' }).catch(() => {})
  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal"]', { state: 'detached', timeout: 10000 })))
  console.log('deep', deep.map((i) => names[i]), 'gov', gov.map((i) => names[i]))

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
  const prog = async () => Promise.all(pages.map(async (p) => (await st(p)).game.match.completedTasks))
  const KW = { BUDGET: /budget|tax|rupee|finance/i, DEFENCE: /border|army|naval|air|defence/i, WELFARE: /health|pension|school|housing/i }
  const WRONG = { BUDGET: 'DEFENCE', DEFENCE: 'WELFARE', WELFARE: 'BUDGET' }

  const [GA, GB, GC, GD] = gov
  const [D1, D2] = deep

  // ── File Sort via drag-and-drop; wrong first ──
  mark('file sort')
  await goTile(GA, 15, 3)
  await pages[GA].keyboard.press('KeyE')
  try {
    await pages[GA].waitForSelector('[data-testid="task-modal"][data-puzzle-type="FILE_SORT"]', { timeout: 4000 })
    await pages[GA].screenshot({ path: '/app/.screenshots/t1-filesort.png' })
    const dnd = async (mapFn) => {
      for (let k = 0; k < 3; k++) {
        const doc = pages[GA].locator('[data-testid^="file-doc-"]').first()
        const title = await doc.textContent()
        const right = Object.keys(KW).find((f) => KW[f].test(title))
        await doc.dragTo(pages[GA].locator(`[data-testid="file-folder-${mapFn(right)}"]`))
        await sleep(150)
      }
    }
    await dnd((r) => WRONG[r])
    const err = await until(async () => (await pages[GA].textContent('[data-testid="task-error"]')), 4000)
    await sleep(300)
    const back = await pages[GA].locator('[data-testid^="file-doc-"]').count()
    const p0 = await prog()
    rec('filesort-wrong', /Incorrect/.test(err ?? '') && back === 3 && p0.every((c) => c === 0), `error "${err}", files back in tray=${back}, progress ${p0}`)
    await dnd((r) => r)
    const ok = await until(async () => { const c = await prog(); return c.every((x) => x === 1) && c }, 5000)
    const hud = await pages[D2].textContent('[data-testid="task-progress-text"]')
    rec('filesort-dnd', !!ok, `drag-and-drop solve → progress ${ok}; D2 HUD "${hud}"`)
  } catch (e) { rec('filesort-dnd', false, e.message) }

  // ── Approve the Bill (ls-register 24,10) with GB; wrong press first ──
  mark('approve bill')
  // GC heads towards the power panel area meanwhile (parallel)
  const gcWalk = goTile(GC, 15, 21, 12)
  await goTile(GB, 24, 10)
  console.log('GB pos', JSON.stringify(await posOf(GB)), 'prompt', await pages[GB].textContent('[data-testid="interaction-prompt"]').catch(() => 'none'))
  await pages[GB].keyboard.press('KeyE')
  if (!(await pages[GB].waitForSelector('[data-testid="task-modal"]', { timeout: 2000 }).catch(() => null))) {
    console.log('APPROVE BILL modal did not open on 1st E; feedback:', await pages[GB].textContent('[data-testid="action-feedback"]').catch(() => 'none'))
    await sleep(500); await pages[GB].keyboard.press('KeyE')
  }
  try {
    await pages[GB].waitForSelector('[data-testid="task-modal"][data-puzzle-type="APPROVE_BILL"]', { timeout: 4000 })
    await sleep(300)
    const seq = await pages[GB].$$eval('[data-testid="bill-sequence"] [data-symbol]', (els) => els.map((e) => e.getAttribute('data-symbol')))
    const disabledWhileShowing = await pages[GB].isDisabled('[data-testid^="bill-symbol-"] >> nth=0')
    await pages[GB].waitForSelector('[data-testid^="bill-symbol-"]:not([disabled])', { timeout: 5000 })
    const hiddenAfter = await pages[GB].$$eval('[data-testid="bill-sequence"] [data-symbol]', (e) => e.length)
    const all = ['BOOK', 'RUPEE', 'BUILDING', 'FLAG']
    const wrong = all.find((s) => s !== seq[0])
    await pages[GB].click(`[data-testid="bill-symbol-${wrong}"]`)
    const retry = await pages[GB].isVisible('text=Try again')
    for (const s of seq) await pages[GB].click(`[data-testid="bill-symbol-${s}"]`)
    const ok = await until(async () => { const c = await prog(); return c.every((x) => x === 2) && c }, 5000)
    const modalGone = !(await pages[GB].isVisible('[data-testid="task-modal"]'))
    rec('approve-bill', seq.length === 3 && disabledWhileShowing && hiddenAfter === 0 && retry && !!ok && modalGone,
      `seq ${seq}, pad disabled while showing=${disabledWhileShowing}, sequence hidden after=${hiddenAfter === 0}, wrong→"Try again"=${retry}, progress ${ok}`)
  } catch (e) { rec('approve-bill', false, e.message) }
  await gcWalk

  // ── Power cut: D1 to panel (15,22) ──
  mark('power cut')
  await goTile(D1, 15, 22, 14)
  await goTile(GC, 15, 22, 20)
  const sabReason = await pages[D1].textContent('[data-testid="action-sabotage-reason"]').catch(() => 'n/a')
  const prompt = await pages[D1].textContent('[data-testid="interaction-prompt"]').catch(() => 'n/a')
  console.log('D1 at panel: sabotage reason', JSON.stringify(sabReason), 'prompt', JSON.stringify(prompt))
  await pages[D1].keyboard.press('KeyE')
  const banners = await until(async () => { const v = await Promise.all(pages.map((p) => p.isVisible('[data-testid="power-cut-banner"]'))); return v.every(Boolean) && v }, 4000)
  const bannerTxt = await pages[GA].textContent('[data-testid="power-cut-banner"]').catch(() => '')
  rec('power-cut-banner', !!banners, `banner on all 6=${!!banners}; text "${bannerTxt}"`)
  await pages[GA].screenshot({ path: '/app/.screenshots/t1-powercut.png' })
  // Gov repairs
  try {
    const gcPrompt = await pages[GC].textContent('[data-testid="interaction-prompt"]').catch(() => 'n/a')
    await pages[GC].keyboard.press('KeyE')
    await pages[GC].waitForSelector('[data-testid="task-modal"][data-puzzle-type="RESTORE_POWER"]', { timeout: 4000 })
    const title = await pages[GC].textContent('.modal__title, [role="dialog"] h2').catch(() => '')
    const labels = await pages[GC].$$eval('[data-testid^="wire-source-"]', (e) => e.map((x) => x.getAttribute('data-testid').replace('wire-source-', '')))
    const targetDisabledInitially = await pages[GC].isDisabled(`[data-testid="wire-target-${labels[0]}"]`)
    // wrong target first
    await pages[GC].click(`[data-testid="wire-source-${labels[0]}"]`)
    await pages[GC].click(`[data-testid="wire-target-${labels[1]}"]`)
    const linesAfterWrong = await pages[GC].locator('.wires__lines line').count()
    await pages[GC].screenshot({ path: '/app/.screenshots/t1-restorepower.png' })
    for (const l of labels) {
      await pages[GC].click(`[data-testid="wire-source-${l}"]`)
      await pages[GC].click(`[data-testid="wire-target-${l}"]`)
    }
    const restored = await until(async () => { const v = await Promise.all(pages.map(async (p) => (await st(p)).game.match.sabotage.powerStatus)); return v.every((x) => x === 'ON') && v }, 4000)
    const news = await until(async () => { const t = await pages[GA].textContent('[data-testid="news-ticker-text"]'); return /restored/i.test(t) && t }, 4000)
    const bannerGone = !(await pages[GA].isVisible('[data-testid="power-cut-banner"]'))
    const p2 = await prog()
    rec('power-repair', !!restored && !!news && bannerGone && p2.every((c) => c === 2),
      `prompt "${gcPrompt}", title "${title}", ${labels.length} terminals, target disabled until source=${targetDisabledInitially}, wrong target lines=${linesAfterWrong}, restored=${!!restored}, news "${news}", repair didn't add progress (${p2[0]})`)
    // sabotage cooldown shown
    await sleep(400)
    const cdReason = await pages[D1].textContent('[data-testid="action-sabotage-reason"]').catch(() => 'n/a')
    rec('sabotage-cooldown', /Cooldown/.test(cdReason), `after repair D1 sabotage reason "${cdReason}"`)
  } catch (e) { rec('power-repair', false, e.message) }

  // ── Restore Power task station (16,17) with GC ──
  mark('restore power task')
  await goTile(GC, 16, 17, 14)
  await pages[GC].keyboard.press('KeyE')
  try {
    await pages[GC].waitForSelector('[data-testid="task-modal"][data-puzzle-type="RESTORE_POWER"]', { timeout: 4000 })
    const labels = await pages[GC].$$eval('[data-testid^="wire-source-"]', (e) => e.map((x) => x.getAttribute('data-testid').replace('wire-source-', '')))
    for (const l of labels) { await pages[GC].click(`[data-testid="wire-source-${l}"]`); await pages[GC].click(`[data-testid="wire-target-${l}"]`) }
    const ok = await until(async () => { const c = await prog(); return c.every((x) => x === 3) && c }, 5000)
    const hud = await pages[D1].textContent('[data-testid="task-progress-text"]')
    rec('restore-power-task', !!ok, `progress ${ok}; HUD "${hud}"`)
  } catch (e) { rec('restore-power-task', false, e.message) }

  // ── Elimination UI ──
  mark('elimination')
  const farReason = await pages[D2].textContent('[data-testid="action-eliminate-reason"]').catch(() => 'n/a')
  const farDisabled = await pages[D2].isDisabled('[data-testid="action-eliminate"]')
  await goTile(D1, 16, 18, 14)
  const vp = await posOf(GC)
  await walkStraight(D1, vp.x, vp.y + 0, 20)
  await sleep(300)
  let me = (await st(pages[D1])).game.eliminationReadyAt
  console.log('kill ready in', me - Date.now())
  await sleep(Math.max(0, me - Date.now()) + 600)
  const nearReason = await pages[D1].textContent('[data-testid="action-eliminate-reason"]').catch(() => '')
  const nearEnabled = await pages[D1].isEnabled('[data-testid="action-eliminate"]')
  await pages[D1].click('[data-testid="action-eliminate"]')
  const dead = await until(async () => !(await st(host)).game.match.players.find((p) => p.id === ids[GC]).alive, 4000)
  await sleep(400)
  const banner = await pages[GC].isVisible('[data-testid="eliminated-banner"]')
  const cdTxt = await pages[D1].textContent('[data-testid="action-eliminate-reason"]').catch(() => '')
  const before = await posOf(GC)
  await pages[GC].keyboard.down('KeyD'); await sleep(500); await pages[GC].keyboard.up('KeyD'); await sleep(300)
  const after = await posOf(GC)
  // far-reason is only meaningful if no Government MP happens to stand next to D2 (spawns are adjacent) — see t1-mute-reload.cjs
  rec('eliminate-ui', nearEnabled && !!dead && banner && /Cooldown: \d+s/.test(cdTxt) && after.x === before.x,
    `far: disabled=${farDisabled} "${farReason}"; near: enabled=${nearEnabled} reason "${nearReason}"; killed=${!!dead}; victim banner=${banner}; cooldown "${cdTxt}"; victim x ${before.x}→${after.x}`)
  await pages[GC].screenshot({ path: '/app/.screenshots/t1-victim.png' })

  // ── Report via Space ──
  mark('report')
  await pages[D1].keyboard.press('Space')
  const inMeeting = await Promise.all(pages.map((p) => until(async () => /\/meeting\//.test(p.url()), 6000)))
  rec('report-space', inMeeting.every(Boolean), `${inMeeting.filter(Boolean).length}/6 on /meeting`)
  await until(async () => (await st(host)).game.match.state === 'DISCUSSION', 5000)
  await sleep(500)
  const deadNotice = await pages[GC].isVisible('[data-testid="chat-dead-notice"]')
  const deadInput = await pages[GC].isVisible('[data-testid="chat-input"]')
  await pages[GA].fill('[data-testid="chat-input"]', 'TEST_ I saw D1 near the panel')
  await pages[GA].click('[data-testid="chat-send-btn"]')
  // Dead players get a notice instead of the chat list (by design), so check the 5 living clients.
  const chatSeen = await until(async () => { const v = await Promise.all(pages.filter((_, i) => i !== GC).map((p) => p.textContent('[data-testid="chat-messages"]'))); return v.every((t) => t.includes('TEST_ I saw')) }, 4000)
  rec('chat', deadNotice && !deadInput && !!chatSeen, `dead notice=${deadNotice}, dead input visible=${deadInput}, message on all 5 living clients=${!!chatSeen}`)
  await pages[GA].screenshot({ path: '/app/.screenshots/t1-meeting.png' })

  // ── Voting UI: eject GA (Government) → 2 v 2 → Deep wins ──
  mark('voting (waiting ~40s)')
  await until(async () => (await st(host)).game.match.state === 'VOTING', 50000, 500)
  const livingIdx = [0, 1, 2, 3, 4, 5].filter((i) => i !== GC)
  const selfDisabled = await pages[GA].isDisabled(`[data-testid="vote-card-${ids[GA]}"]`).catch(() => 'n/a')
  const deadCardDisabled = await pages[GA].isDisabled(`[data-testid="vote-card-${ids[GC]}"]`).catch(() => 'n/a')
  const deadCanVote = await pages[GC].isVisible('[data-testid="vote-confirm-btn"]')
  for (const i of livingIdx) {
    if (i === GA) await pages[i].click('[data-testid="vote-skip-btn"]')
    else await pages[i].click(`[data-testid="vote-card-${ids[GA]}"]`)
    await pages[i].click('[data-testid="vote-confirm-btn"]')
    await sleep(300)
    if (i === livingIdx[0]) {
      const voted = await pages[GB].isVisible(`[data-testid="vote-card-voted-${ids[i]}"]`).catch(() => false)
      rec('voted-marker', voted, `VOTED marker for ${names[i]} visible on another client=${voted}`)
    }
  }
  const tallyOk = await until(async () => (await pages[GB].isVisible('[data-testid="vote-results"]')), 5000)
  const verdict = await pages[GB].textContent('[data-testid="vote-results-verdict"]').catch(() => '')
  await pages[GB].screenshot({ path: '/app/.screenshots/t1-vote-results.png' })
  rec('vote-ui', !!tallyOk && /Government/i.test(verdict), `self card disabled=${selfDisabled}, dead card disabled=${deadCardDisabled}, dead sees confirm=${deadCanVote}, verdict "${verdict}"`)

  // ── Results ──
  mark('results')
  const onResults = await Promise.all(pages.map((p) => until(async () => /\/results\//.test(p.url()), 12000)))
  await sleep(600)
  const rtitle = await pages[GB].textContent('[data-testid="results-title"]').catch(() => '')
  const rowCount = await pages[GB].locator('[data-testid^="reveal-row-"]').count()
  const table = await pages[GB].textContent('[data-testid="reveal-table"]').catch(() => '')
  await pages[GB].screenshot({ path: '/app/.screenshots/t1-results.png' })
  rec('results-screen', onResults.every(Boolean) && rowCount === 6 && /Deep State/i.test(table) && /Government/i.test(table), `title "${rtitle}", rows ${rowCount}, all on results=${onResults.every(Boolean)}`)
  const hostBtn = await host.isVisible('[data-testid="back-to-lobby-btn"]')
  const nonHostWaiting = await pages[1].isVisible('[data-testid="waiting-for-host"]')
  const nonHostBtn = await pages[1].isVisible('[data-testid="back-to-lobby-btn"]')
  // Leave from results (page 5)
  const leaver = 5
  await pages[leaver].click('[data-testid="results-leave-btn"]')
  const left = await until(async () => !/\/results\//.test(pages[leaver].url()) && pages[leaver].url(), 5000)
  rec('results-leave', !!left && hostBtn && nonHostWaiting && !nonHostBtn, `leaver url ${left}; host button=${hostBtn}; non-host waiting=${nonHostWaiting}, non-host has button=${nonHostBtn}`)
  await host.click('[data-testid="back-to-lobby-btn"]')
  const inLobby = await Promise.all(pages.filter((_, i) => i !== leaver).map((p) => until(async () => /\/lobby\//.test(p.url()), 6000)))
  await sleep(500)
  const lobbyCount = (await st(host)).lobby.lobby?.players?.length
  const leaverUrl = pages[leaver].url()
  rec('back-to-lobby', inLobby.every(Boolean) && lobbyCount === 5 && !/lobby|results/.test(leaverUrl), `${inLobby.filter(Boolean).length}/5 in lobby, lobby count ${lobbyCount}, leaver at ${leaverUrl}`)

  // ── Mute toggle persistence (leaver page) ──
  mark('mute')
  try {
    const p = pages[leaver]
    const m = p.locator('[data-testid="mute-toggle"]')
    const vis = await m.isVisible()
    const t1 = (await m.textContent()).trim()
    await m.click(); await sleep(200)
    const t2 = (await m.textContent()).trim()
    await p.reload(); await p.waitForSelector('[data-testid="mute-toggle"]')
    const t3 = (await p.locator('[data-testid="mute-toggle"]').textContent()).trim()
    await p.locator('[data-testid="mute-toggle"]').click(); await sleep(200)
    const t4 = (await p.locator('[data-testid="mute-toggle"]').textContent()).trim()
    // in-game top bar too
    const hostMute = await host.isVisible('[data-testid="mute-toggle"]')
    rec('mute-toggle', vis && t1 !== t2 && t2 === t3 && t4 === t1 && /Sound (on|off)/.test(t2), `"${t1}" → click "${t2}" → reload "${t3}" → click "${t4}"; host(lobby) toggle visible=${hostMute}`)
  } catch (e) { rec('mute-toggle', false, e.message) }

  // ── rejoin + second match ──
  mark('second match')
  await join(pages[leaver], leaver)
  await sleep(500)
  await host.click('text=Start Game')
  const g2 = await Promise.all(pages.map((p) => until(async () => /\/game\//.test(p.url()), 10000)))
  await sleep(800)
  const S2 = await Promise.all(pages.map(st))
  const fresh = S2.every((s) => s.game.match?.completedTasks === 0 && s.game.match?.players.every((p) => p.alive) && s.game.match?.sabotage.powerStatus === 'ON')
  rec('second-match', g2.every(Boolean) && fresh, `${g2.filter(Boolean).length}/6 in game, fresh state=${fresh}`)
  await sleep(4500)
  await host.screenshot({ path: '/app/.screenshots/t1-match2.png' })

  console.log('\n=== errors ===\n' + (logs.slice(0, 30).join('\n') || 'none'))
  await browser.close()
}

setTimeout(() => { console.log('WATCHDOG'); summary(); process.exit(1) }, 420000).unref()
function summary() {
  console.log('\n=== SUMMARY ===')
  for (const [n, ok, note] of results) console.log(`${ok ? 'PASS' : 'FAIL'} ${n} — ${note}`)
}
main().catch((e) => console.error('ERROR', e)).finally(() => { summary(); process.exit(0) })
