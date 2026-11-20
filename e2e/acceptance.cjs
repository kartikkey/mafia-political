/**
 * Spec §13 acceptance pass — 6 (+) Playwright browser contexts against a running dev stack.
 *   node e2e/acceptance.cjs [baseUrl]        (default http://localhost:3000)
 * Reports every checklist item as PASSED / FAILED / NOT RUN. Never marks an
 * item passed unless its assertion actually executed.
 * Uses window.__netagiri (dev-only) to read each client's OWN view and to send
 * raw requests for negative (anti-cheat) checks.
 */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const T = 32
const SPEED = 160

const CHECKS = [
  ['join6', 'At least six players can join the same room using a room code'],
  ['start', 'Host can start a match and all clients transition to role reveal'],
  ['roles', 'Government see own role; Deep State see own role and teammates'],
  ['sync', 'Player positions synchronize across all connected clients'],
  ['walls', 'Players cannot walk through walls or furniture'],
  ['task', 'Government can open and complete a task; progress updates for everyone'],
  ['deepTask', 'Deep State cannot increase Government task progress'],
  ['kill', 'Deep State can eliminate a nearby Government player when cooldown is ready'],
  ['killReject', 'Deep State cannot eliminate a teammate, dead player or distant player'],
  ['body', 'Successful elimination creates exactly one reportable body'],
  ['report', 'Living player can report a nearby body and meeting starts for everyone'],
  ['frozen', 'Movement and actions are disabled during meeting'],
  ['voting', 'Voting accepts one vote per living player and correctly handles skip and ties'],
  ['reveal', 'Correct role is revealed after ejection'],
  ['govWin', 'Government wins at full task progress or when all Deep State agents are eliminated'],
  ['deepWin', 'Deep State wins when living agents equal or outnumber living Government players'],
  ['results', 'Results screen shows correct winner and all player roles'],
  ['disconnect', 'Disconnects do not leave the match permanently stuck'],
]
const status = Object.fromEntries(CHECKS.map(([k]) => [k, { s: 'NOT RUN', note: '' }]))
const pass = (k, note = '') => (status[k] = { s: 'PASSED', note })
const failed = (k, note) => (status[k] = { s: 'FAILED', note })
function check(k, cond, note) {
  console.log(`${cond ? 'PASSED' : 'FAILED'} [${k}] ${note}`)
  if (cond) pass(k, note)
  else failed(k, note)
  return cond
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const st = (page) => page.evaluate(() => window.__netagiri.store.getState())
// Server rate-limits consequential actions per socket (actionRateLimitMs) — space requests out.
const emit = async (page, event, payload) =>
  (await sleep(260), page).evaluate(
    ([e, p]) =>
      new Promise((res) => {
        setTimeout(() => res({ ok: null, reason: 'no ack' }), 1500)
        if (p === undefined) window.__netagiri.socket.emit(e, res)
        else window.__netagiri.socket.emit(e, p, res)
      }),
    [event, payload]
  )
const onUrl = (p, re, ms = 8000) => until(async () => re.test(p.url()), ms).then(Boolean)
async function until(fn, ms = 10000, step = 150) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await fn()
    if (v) return v
    await sleep(step)
  }
  return null
}

let stage = 'init'
const mark = (x) => { stage = x; console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${x}`) }
const t0 = Date.now()

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || undefined })
  const ctxs = []
  const pages = []
  for (let i = 0; i < 6; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    ctxs.push(ctx)
    const pg = await ctx.newPage()
    pg.setDefaultTimeout(8000)
    pg.on('pageerror', (e) => console.log(`[page ${i} error]`, e.message))
    pages.push(pg)
  }
  const names = ['Speaker', 'MP1', 'MP2', 'MP3', 'MP4', 'MP5']
  const [host, ...rest] = pages

  mark('1. Join')
  // ── 1. Join ──
  await host.goto(BASE)
  await until(async () => (await st(host)).join.connected)
  await host.fill('input[placeholder="Hon. Member"]', names[0])
  await host.click('text=Create Room')
  await host.waitForURL(/\/lobby\//)
  const code = host.url().split('/').pop()
  for (const [i, p] of rest.entries()) {
    await p.goto(BASE)
    await until(async () => (await st(p)).join.connected)
    await p.fill('input[placeholder="Hon. Member"]', names[i + 1])
    await p.click(`.join__avatar >> nth=${i + 1}`)
    await p.fill('input[aria-label="Room code"]', code)
    await p.click('button:has-text("Join")')
    await p.waitForURL(/\/lobby\//)
  }
  const lobbyCount = (await st(host)).lobby.lobby.players.length
  check('join6', lobbyCount === 6, `room ${code}, ${lobbyCount} players in lobby`)

  mark('2. Start')
  // ── 2. Start + roles ──
  await host.click('text=Start Game')
  await Promise.all(pages.map((p) => p.waitForURL(/\/game\//)))
  const reveals = await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal-title"]', { timeout: 15000 }).then(() => true).catch(() => false)))
  await host.screenshot({ path: '/tmp/after-start.png' })
  check('start', reveals.every(Boolean), `${reveals.filter(Boolean).length}/6 saw role reveal`)
  const S = await Promise.all(pages.map(st))
  const ids = S.map((s) => s.join.playerId)
  const factions = S.map((s) => s.game.role?.faction)
  const deepIdx = factions.map((f, i) => (f === 'DEEP_STATE' ? i : -1)).filter((i) => i >= 0)
  const govIdx = factions.map((f, i) => (f === 'GOVERNMENT' ? i : -1)).filter((i) => i >= 0)
  const roleOk =
    deepIdx.length === 2 &&
    govIdx.length === 4 &&
    deepIdx.every((i) => S[i].game.role.teammateIds.length === 1 && deepIdx.some((j) => j !== i && ids[j] === S[i].game.role.teammateIds[0])) &&
    govIdx.every((i) => S[i].game.role.teammateIds.length === 0) &&
    S.every((s) => s.game.match.players.every((p) => !p.revealedFaction))
  const mateShown = await pages[deepIdx[0]].isVisible('[data-testid="role-reveal-teammates"]')
  check('roles', roleOk && mateShown, `deep=${deepIdx.map((i) => names[i])} gov=${govIdx.map((i) => names[i])}`)
  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal"]', { state: 'detached', timeout: 8000 })))

  const name = (i) => names[i]
  const posOf = async (observer, i) => (await st(pages[observer])).game.match.players.find((p) => p.id === ids[i]).position
  const obsFor = (i) => (i === 0 ? 1 : 0)
  async function walkTo(i, tx, ty, range = 20) {
    const page = pages[i]
    for (let n = 0; n < 40; n++) {
      const p = await posOf(obsFor(i), i)
      const dx = tx - p.x
      const dy = ty - p.y
      if (Math.abs(dx) <= range && Math.abs(dy) <= range) return p
      const horiz = Math.abs(dx) > range
      const key = horiz ? (dx > 0 ? 'KeyD' : 'KeyA') : dy > 0 ? 'KeyS' : 'KeyW'
      const dist = horiz ? Math.abs(dx) : Math.abs(dy)
      await page.keyboard.down(key)
      await sleep(Math.max(40, Math.min(400, ((dist - range / 2) / SPEED) * 1000)))
      await page.keyboard.up(key)
      await sleep(180)
    }
    return posOf(obsFor(i), i)
  }

  mark('3. Sync')
  // ── 3. Sync + walls ──
  const before = await posOf(1, 0)
  await host.keyboard.down('KeyD')
  await sleep(400)
  await host.keyboard.up('KeyD')
  await sleep(400)
  const seen = await Promise.all([1, 2, 3, 4, 5].map((o) => posOf(o, 0)))
  check('sync', seen.every((p) => p.x > before.x + 20 && Math.abs(p.x - seen[0].x) < 2), `host x ${before.x}→${seen.map((p) => p.x).join(',')}`)
  await host.keyboard.down('KeyW')
  await sleep(1500)
  await host.keyboard.up('KeyW')
  await sleep(300)
  const afterWall = await posOf(1, 0)
  // Row 0 is wall; a 10px hitbox can't go above y = 32 + 10.
  const wallOk = afterWall.y >= 42
  const teleport = await emit(host, 'PLAYER_MOVED', { position: { x: 5, y: 5 }, facing: 'up' })
  await sleep(300)
  const afterTp = await posOf(1, 0)
  check('walls', wallOk && afterTp.y >= 42, `after holding W y=${afterWall.y}; wall teleport rejected y=${afterTp.y}`)

  // Pick a Deep State + Government pair on the same spawn row (rows 3 and 7 are clear corridors).
  const spawnRow = async (i) => Math.floor((await posOf(obsFor(i), i)).y / T)
  const rows = await Promise.all(pages.map((_, i) => spawnRow(i)))
  let D1 = deepIdx.find((d) => govIdx.some((g) => rows[g] === rows[d] && rows[d] === 3))
  if (D1 === undefined) D1 = deepIdx.find((d) => govIdx.some((g) => rows[g] === rows[d]))
  const G1 = govIdx.find((g) => rows[g] === rows[D1])
  const D2 = deepIdx.find((d) => d !== D1)
  if (D1 === undefined || G1 === undefined) {
    console.log('No same-row Deep State/Government pair this run; elimination checks NOT RUN')
  }

  const station = (S[0].game.match.tasks.find((t) => t.taskId === 'ls-motion') ?? {}).position
  const KW = { BUDGET: /budget|tax|rupee|finance/i, DEFENCE: /border|army|naval|defence/i, WELFARE: /health|pension|school|housing/i }
  async function solveOpenTask(page) {
    await page.waitForSelector('[data-testid="task-modal"]', { timeout: 5000 })
    const type = await page.getAttribute('[data-testid="task-modal"]', 'data-puzzle-type')
    if (type === 'FILE_SORT') {
      for (let k = 0; k < 3; k++) {
        const doc = page.locator('[data-testid^="file-doc-"]').first()
        const title = await doc.textContent()
        const folder = Object.keys(KW).find((f) => KW[f].test(title))
        await doc.click()
        await page.click(`[data-testid="file-folder-${folder}"]`)
      }
    } else if (type === 'APPROVE_BILL') {
      await sleep(400)
      const seq = await page.$$eval('[data-testid="bill-sequence"] [data-symbol]', (els) => els.map((e) => e.getAttribute('data-symbol')))
      await page.waitForSelector('[data-testid^="bill-symbol-"]:not([disabled])', { timeout: 5000 })
      for (const s of seq) await page.click(`[data-testid="bill-symbol-${s}"]`)
    } else if (type === 'RESTORE_POWER') {
      for (const label of ['RED', 'BLUE', 'YELLOW', 'GREEN']) {
        if (!(await page.isVisible(`[data-testid="wire-source-${label}"]`))) continue
        await page.click(`[data-testid="wire-source-${label}"]`)
        await page.click(`[data-testid="wire-target-${label}"]`)
      }
    }
    await page.waitForSelector('[data-testid="task-modal"]', { state: 'detached', timeout: 8000 })
  }

  mark('4. Tasks')
  // ── 4. Tasks ──
  if (D1 !== undefined && G1 !== undefined && station) {
    await walkTo(D1, station.x, station.y, 16)
    await pages[D1].keyboard.press('KeyE')
    await solveOpenTask(pages[D1])
    await sleep(500)
    const progAfterDeep = await Promise.all(pages.map(async (p) => (await st(p)).game.match.completedTasks))
    check('deepTask', progAfterDeep.every((c) => c === 0), `Deep State completed the File the Motion puzzle → progress on all clients ${progAfterDeep.join(',')}`)

    await walkTo(G1, station.x, station.y, 16)
    await pages[G1].keyboard.press('KeyE')
    await solveOpenTask(pages[G1])
    const prog = await until(async () => {
      const c = await Promise.all(pages.map(async (p) => (await st(p)).game.match.completedTasks))
      return c.every((x) => x === 1) && c
    }, 4000)
    const txt = await pages[D2].textContent('[data-testid="task-progress-text"]')
    check('task', !!prog, `progress on all 6 clients: ${prog}; HUD shows "${txt}"`)
    const dup = await emit(pages[G1], 'TASK_COMPLETED', { taskId: 'ls-motion', payload: {} })
    console.log('duplicate completion →', dup)
  }

  await host.screenshot({ path: 'docs/screenshots/game.png' })
  mark('5. Elimination')
  // ── 5. Elimination ──
  let bodyId = null
  if (D1 !== undefined && G1 !== undefined) {
    const mate = await emit(pages[D1], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[D2] })
    const farGov = govIdx.find((g) => g !== G1 && rows[g] !== rows[D1]) ?? govIdx.find((g) => g !== G1)
    const far = await emit(pages[D1], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[farGov] })
    const gp = await posOf(obsFor(D1) === G1 ? obsFor(G1) : obsFor(D1), G1)
    await walkTo(D1, gp.x, gp.y, 14)
    // Starting grace period (initialEliminationCooldownMs) must run out first.
    const readyAt = (await st(pages[D1])).game.eliminationReadyAt
    const graceBlocked = await pages[D1].textContent('[data-testid="action-eliminate-reason"]')
    console.log('starting cooldown on the Eliminate button:', graceBlocked)
    await sleep(Math.max(0, readyAt - Date.now()) + 300)
    const btnEnabled = await pages[D1].isEnabled('[data-testid="action-eliminate"]')
    await pages[D1].keyboard.press('KeyQ')
    const bodies = await until(async () => {
      const b = await Promise.all(pages.map(async (p) => (await st(p)).game.match.bodies.length))
      return b.every((n) => n === 1) && b
    }, 4000)
    const victimDead = !(await st(pages[D2])).game.match.players.find((p) => p.id === ids[G1]).alive
    check('kill', !!bodies && victimDead && btnEnabled && /^Cooldown/.test(graceBlocked), `${name(D1)} eliminated ${name(G1)} with Q once the starting grace period ended (was "${graceBlocked}", then button enabled=${btnEnabled})`)
    const dead = await emit(pages[D2], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[G1] })
    await sleep(300)
    const cdText = await pages[D1].textContent('[data-testid="action-eliminate-reason"]')
    const cd = { ok: !/^Cooldown: \d+s$/.test(cdText), reason: cdText }
    check('killReject', !mate.ok && !far.ok && !dead.ok && !cd.ok, `teammate: "${mate.reason}", distant: "${far.reason}", dead: "${dead.reason}", cooldown: "${cd.reason}"`)
    check('body', !!bodies, `bodies per client: ${bodies}`)
    bodyId = (await st(pages[D1])).game.match.bodies[0]?.bodyId
    const govDead = await pages[G1].isVisible('[data-testid="eliminated-banner"]')
    console.log('victim sees eliminated banner:', govDead)
  }

  mark('6. Report')
  // ── 6. Report → meeting ──
  async function reportAndMeet(reporter, body) {
    await sleep(300)
    console.log('  pressing Space on', name(reporter))
    await pages[reporter].keyboard.press('Space')
    console.log('  pressed; waiting for meeting URL')
    const alive = await Promise.all(pages.map((p, i) => Promise.race([p.evaluate(() => location.pathname).then((x) => `${i}:${x}`), sleep(3000).then(() => `${i}:BLOCKED`)])))
    console.log('  responsiveness', alive.join(' '))
    const ok = await Promise.all(pages.map((p) => onUrl(p, /\/meeting\//, 6000)))
    const twice = await emit(pages[reporter], 'BODY_REPORTED', { bodyId: body })
    return { ok, twice }
  }
  const living = async () => (await st(host)).game.match.players.filter((p) => p.alive && p.connected).map((p) => ids.indexOf(p.id))
  async function waitPhase(phase, ms) {
    return until(async () => (await st(host)).game.match.state === phase, ms, 300)
  }
  async function vote(i, choice) {
    if (choice !== 'SKIP') await pages[i].click(`[data-testid="vote-card-${ids[choice]}"]`)
    else await pages[i].click('[data-testid="vote-skip-btn"]')
    await pages[i].click('[data-testid="vote-confirm-btn"]')
    // The last vote closes voting early, so the confirmation may be replaced by the results.
    await until(async () => (await pages[i].isVisible('[data-testid="vote-confirmed"]')) || (await st(pages[i])).meeting.myVote, 4000)
  }

  if (bodyId) {
    // Reporter: the killer stands next to the body.
    const { ok, twice } = await reportAndMeet(D1, bodyId)
    check('report', ok.every(Boolean), `${ok.filter(Boolean).length}/6 moved to the meeting; second report → "${twice.reason}"`)

    const frozenPos = await posOf(obsFor(D2), D2)
    const mv = await emit(pages[D2], 'PLAYER_MOVED', { position: { x: frozenPos.x + 4, y: frozenPos.y }, facing: 'right' })
    await sleep(300)
    const after = await posOf(obsFor(D2), D2)
    const killInMeeting = await emit(pages[D1], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[govIdx.find((g) => g !== G1)] })
    const taskInMeeting = await emit(pages[G1 === govIdx[0] ? govIdx[1] : govIdx[0]], 'TASK_OPENED', { taskId: 'ls-register' })
    check('frozen', after.x === frozenPos.x && !killInMeeting.ok && !taskInMeeting.ok, `move ignored (x ${frozenPos.x}→${after.x}); kill: "${killInMeeting.reason}"; task: "${taskInMeeting.reason}"`)

    // Chat: living players only.
    await waitPhase('DISCUSSION', 5000)
    await pages[D2].fill('[data-testid="chat-input"]', 'I was in the Lok Sabha the whole time')
    await pages[D2].click('[data-testid="chat-send-btn"]')
    await sleep(600)
    const chatCounts = await Promise.all(pages.map(async (p) => (await st(p)).meeting.chat.length))
    const deadNotice = await pages[G1].isVisible('[data-testid="chat-dead-notice"]')
    const deadChat = await emit(pages[G1], 'CHAT_SEND', { text: 'boo' })
    console.log(`chat: counts ${chatCounts} (dead ${name(G1)}=${chatCounts[G1]}), dead notice=${deadNotice}, dead send → "${deadChat.reason}"`)

    // Meeting 1 → eject D1 (Deep State) with a double-vote and dead-vote check on the way.
    await waitPhase('VOTING', 45000)
    mark('6a. voting 1')
    const L = await living()
    const deadVote = await emit(pages[G1], 'VOTE_SUBMITTED', { choice: 'SKIP' })
    const order = L.map((i) => [i, i === D1 || i === D2 ? 'SKIP' : D1])
    await vote(...order[0])
    const dbl = await emit(pages[order[0][0]], 'VOTE_SUBMITTED', { choice: 'SKIP' })
    for (const [i, c] of order.slice(1)) await vote(i, c)
    await waitPhase('VOTE_RESULTS', 5000)
    await pages[D2].screenshot({ path: 'docs/screenshots/meeting-results.png' })
    const t1 = (await st(host)).meeting.tally
    const verdict = await pages[D2].textContent('[data-testid="vote-results-verdict"]')
    const revealed = (await st(pages[order[0][0]])).game.match.players.find((p) => p.id === ids[D1])?.revealedFaction
    const revealOk = t1?.ejectedPlayerId === ids[D1] && t1.ejectedFaction === 'DEEP_STATE' && revealed === 'DEEP_STATE' && /was Deep State/.test(verdict)
    check('reveal', revealOk, `ejected ${name(D1)} → "${verdict}"`)
    await waitPhase('PLAYING', 8000)
    await Promise.all(pages.map((p) => onUrl(p, /\/game\//, 8000)))

    // Second elimination (D2 has never killed → cooldown ready), then Meeting 2 → tie.
    mark('6b. second elimination')
    const rows2 = await Promise.all(pages.map((_, i) => spawnRow(i)))
    const L2 = await living()
    const victim2 = govIdx.find((g) => L2.includes(g) && rows2[g] === rows2[D2])
    console.log('victim2', victim2 === undefined ? 'none on D2 row' : name(victim2), 'rows', rows2)
    if (victim2 !== undefined) {
      const vp = await posOf(obsFor(victim2) === D2 ? obsFor(D2) : obsFor(victim2), victim2)
      await walkTo(D2, vp.x, vp.y, 14)
      const k2 = await emit(pages[D2], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[victim2] })
      console.log('second elimination →', k2)
      await until(async () => (await st(host)).game.match.bodies.length === 1, 4000)
      const b2 = (await st(pages[D2])).game.match.bodies[0]?.bodyId
      if (b2) {
        mark('6c. meeting 2 (tie)')
        await reportAndMeet(D2, b2)
        await waitPhase('VOTING', 45000)
        const L3 = await living()
        const [ga, gb] = govIdx.filter((g) => L3.includes(g))
        const plan = [[ga, D2], [gb, 'SKIP'], [D2, ga]]
        for (const [i, c] of plan) await vote(i, c)
        await waitPhase('VOTE_RESULTS', 5000)
        const t2 = (await st(host)).meeting.tally
        check('voting', t2?.ejectedPlayerId === null && !dbl.ok && !deadVote.ok && revealOk,
          `meeting 1 plurality ejected ${name(D1)}; meeting 2 tie ${JSON.stringify(Object.values(t2?.counts ?? {}))} → nobody; double vote: "${dbl.reason}"; dead vote: "${deadVote.reason}"; both closed early when all voted`)
        await waitPhase('PLAYING', 8000)

        // Meeting 3 via the Emergency button (global 60s cooldown) → vote out the last agent.
        mark('6d. emergency meeting')
        await Promise.all(pages.map((p) => onUrl(p, /\/game\//, 8000)))
        const emergencyAt = (await st(host)).game.match.emergencyAvailableAt
        const earlyReason = await pages[ga].textContent('[data-testid="action-emergency-reason"]')
        console.log('emergency button before cooldown:', earlyReason)
        await sleep(Math.max(0, emergencyAt - Date.now()) + 800)
        await pages[ga].click('[data-testid="action-emergency"]')
        await Promise.all(pages.map((p) => onUrl(p, /\/meeting\//, 6000)))
        await waitPhase('VOTING', 45000)
        const L4 = await living()
        for (const i of L4) await vote(i, i === D2 ? 'SKIP' : D2)
        const over = await waitPhase('GAME_OVER', 10000)
        const go = (await st(pages[0])).results.gameOver
        check('govWin', !!over && go?.result === 'GOVERNMENT_WINS', `last agent ${name(D2)} voted out → ${go?.result}`)
        await Promise.all(pages.map((p) => onUrl(p, /\/results\//, 6000)))
        await sleep(600)
        const viewer = pages.findIndex((_, i) => i !== 0)
        await pages[viewer].screenshot({ path: 'docs/screenshots/results.png' })
        const title = await pages[viewer].textContent('[data-testid="results-title"]')
        const rowsShown = await pages[viewer].$$eval('[data-testid^="reveal-row-"]', (r) => r.length)
        const factionsOk = go.stats.length === 6 && go.stats.every((s) => s.faction === factions[ids.indexOf(s.playerId)])
        // Since PR #1 every player gets "Play again" (no host-only button / "Waiting for host…").
        const hostBtn = await host.isVisible('[data-testid="play-again-btn"]')
        const otherBtn = await pages[viewer].isVisible('[data-testid="play-again-btn"]')
        check('results', title === 'Democracy survives!' && rowsShown === 6 && factionsOk && hostBtn && otherBtn, `title "${title}", ${rowsShown} rows, factions match=${factionsOk}, Play again: host=${hostBtn}, other player=${otherBtn}`)
      }
    }
  }

  mark('7. Back')
  // ── 7. Back to lobby, second match: disconnect → parity win ──
  if (await host.isVisible('[data-testid="play-again-btn"]')) {
    await host.click('[data-testid="play-again-btn"]')
    await Promise.all(pages.map((p) => onUrl(p, /\/lobby\//, 6000)))
    await host.click('text=Start Game')
    await Promise.all(pages.map((p) => onUrl(p, /\/game\//, 10000)))
    const S2 = await Promise.all(pages.map(st))
    const f2 = S2.map((s) => s.game.role?.faction)
    const govs = f2.map((f, i) => (f === 'GOVERNMENT' && i !== 0 ? i : -1)).filter((i) => i >= 0)
    // 6 players = 4 gov / 2 deep. Two MPs drop → 2 v 2 → Deep State wins.
    await pages[govs[0]].close()
    await pages[govs[1]].close()
    const remaining = pages.filter((_, i) => i !== govs[0] && i !== govs[1])
    const ended = await until(async () => (await st(remaining[0])).game.match?.state === 'GAME_OVER', 8000)
    const go2 = (await st(remaining[0])).results.gameOver
    check('disconnect', !!ended, `two MPs disconnected → match state ${(await st(remaining[0])).game.match?.state}`)
    check('deepWin', go2?.result === 'DEEP_STATE_WINS', `living agents 2 vs MPs 2 → ${go2?.result}`)
    await remaining[0].waitForURL(/\/results\//, { timeout: 5000 }).catch(() => {})
    const t2 = await remaining[0].textContent('[data-testid="results-title"]').catch(() => '')
    console.log('second match results title:', t2)
  }

  await browser.close()
}

setTimeout(() => { console.log('WATCHDOG at stage', stage); summary(); process.exit(1) }, Number(process.env.E2E_MAX_MS ?? 380000)).unref()

function summary() {
  console.log('\nSpec §13 acceptance checklist')
  for (const [k, label] of CHECKS) console.log(`${status[k].s.padEnd(8)} ${label}${status[k].note ? `\n         ↳ ${status[k].note}` : ''}`)
}

main()
  .catch((e) => console.error('ERROR', e))
  .finally(() => {
    summary()
    process.exit(Object.values(status).some((v) => v.s === 'FAILED') ? 1 : 0)
  })
