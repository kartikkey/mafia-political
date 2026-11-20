/**
 * T1 iteration 4 — 6 human browser contexts:
 *  lobby bot buttons (host vs non-host, BOT badge), body-report replay on every client, ghost whispers
 *  (PLAYING + meeting, isolation from living), emergency meeting has no replay, badges on Results.
 *   node e2e/t1-iter4-features.cjs [baseUrl]
 */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
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
const txt = (p, sel) => p.textContent(sel).catch(() => null)
const vis = (p, sel) => p.isVisible(sel).catch(() => false)

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
  const names = ['TEST_Spk', 'TEST_A', 'TEST_B', 'TEST_C', 'TEST_D', 'TEST_E']
  const host = pages[0]
  await host.goto(BASE); await until(async () => (await st(host)).join.connected)
  await host.fill('input[placeholder="Hon. Member"]', names[0]); await host.click('text=Create Room'); await host.waitForURL(/\/lobby\//)
  const code = host.url().split('/').pop()
  rec('ui-add-bots-btn-host-solo', /Fill 5 seats with bots/.test((await txt(host, '[data-testid="add-bots-btn"]')) ?? ''), await txt(host, '[data-testid="add-bots-btn"]'))
  const join = async (i) => {
    const p = pages[i]; await p.goto(BASE); await until(async () => (await st(p)).join.connected)
    await p.fill('input[placeholder="Hon. Member"]', names[i]); await p.click(`.join__avatar >> nth=${i}`)
    await p.fill('input[aria-label="Room code"]', code); await p.click('button:has-text("Join")'); await p.waitForURL(/\/lobby\//)
  }
  await join(1); await sleep(500)
  rec('ui-add-bots-btn-text-updates', /Fill 4 seats/.test((await txt(host, '[data-testid="add-bots-btn"]')) ?? ''), await txt(host, '[data-testid="add-bots-btn"]'))
  rec('ui-nonhost-no-bot-buttons', !(await vis(pages[1], '[data-testid="add-bots-btn"]')) && !(await vis(pages[1], '[data-testid="remove-bots-btn"]')))
  await host.click('[data-testid="add-bots-btn"]'); await sleep(700)
  const botBadges = await pages[1].locator('text=BOT').count()
  const botNames = (await st(pages[1])).lobby.lobby.players.filter((p) => p.isBot).map((p) => p.name)
  rec('ui-add-bots-roster', botBadges === 4 && botNames.length === 4 && !(await vis(host, '[data-testid="add-bots-btn"]')) && /Remove 4 bots/.test((await txt(host, '[data-testid="remove-bots-btn"]')) ?? ''),
    `BOT badges on guest=${botBadges}; names ${botNames}; remove btn "${await txt(host, '[data-testid="remove-bots-btn"]')}"; start enabled=${await host.isEnabled('[data-testid="start-game-btn"]')}`)
  await host.screenshot({ path: '/app/.screenshots/t4-lobby-bots.png' })
  await host.click('[data-testid="remove-bots-btn"]'); await sleep(700)
  rec('ui-remove-bots', (await st(host)).lobby.lobby.players.length === 2 && !(await vis(host, '[data-testid="remove-bots-btn"]')))
  for (let i = 2; i < 6; i++) await join(i)
  await sleep(500)
  rec('ui-no-add-bots-at-quorum', !(await vis(host, '[data-testid="add-bots-btn"]')))
  await host.click('[data-testid="start-game-btn"]')
  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal-title"]', { timeout: 15000 })))
  const S = await Promise.all(pages.map(st))
  const ids = S.map((s) => s.join.playerId)
  const fac = S.map((s) => s.game.role?.faction)
  const deep = fac.map((f, i) => (f === 'DEEP_STATE' ? i : -1)).filter((i) => i >= 0)
  const gov = fac.map((f, i) => (f === 'GOVERNMENT' ? i : -1)).filter((i) => i >= 0)
  const [D1, D2] = deep, [G1, G2, G3, G4] = gov
  console.log('deep', deep.map((i) => names[i]), 'gov', gov.map((i) => names[i]))
  await Promise.all(pages.map((p) => p.waitForSelector('[data-testid="role-reveal"]', { state: 'detached', timeout: 10000 })))
  mark('play began')

  const obsOf = (i) => (i === G4 ? G3 : G4)
  const posOf = async (i) => (await st(pages[obsOf(i)])).game.match.players.find((p) => p.id === ids[i]).position
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

  // ── Kill: D1 walks to G1 (G1 stays put) ──
  const gp = await posOf(G1)
  await walkStraight(D1, gp.x, gp.y, 14)
  await until(async () => Date.now() - t0 > 0 && (await st(pages[D1])).game.eliminationReadyAt <= Date.now() + 200, 14000, 300)
  await sleep(800)
  let k = await emit(pages[D1], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[G1] })
  if (!k.ok) { const gp2 = await posOf(G1); await walkStraight(D1, gp2.x, gp2.y, 8); await sleep(1500); k = await emit(pages[D1], 'PLAYER_ELIMINATE_REQUEST', { targetId: ids[G1] }) }
  rec('setup-kill', !!k.ok, JSON.stringify(k))
  mark('killed G1')

  // ── Ghost whisper in PLAYING with no other ghosts ──
  await sleep(600)
  const gcVisible = await vis(pages[G1], '[data-testid="ghost-chat"]')
  const livingHasGhostPanel = (await Promise.all(pages.filter((_, i) => i !== G1).map((p) => vis(p, '[data-testid="ghost-chat"]')))).some(Boolean)
  rec('ghost-chat-panel-playing', gcVisible && !livingHasGhostPanel, `ghost panel visible on ghost=${gcVisible}; on any living=${livingHasGhostPanel}`)
  await pages[G1].fill('[data-testid="ghost-chat-input"]', 'TEST_whisper_alone'); await pages[G1].click('[data-testid="ghost-chat-send-btn"]'); await sleep(900)
  const ownEcho = /TEST_whisper_alone/.test((await txt(pages[G1], '[data-testid="ghost-chat-messages"]')) ?? '')
  const leakLiving1 = (await Promise.all(pages.filter((_, i) => i !== G1).map(st))).some((s) => JSON.stringify(s).includes('TEST_whisper_alone'))
  rec('ghost-whisper-playing-hidden-from-living', !leakLiving1, `own echo shown=${ownEcho}; living stores contain=${leakLiving1}`)
  await pages[G1].screenshot({ path: '/app/.screenshots/t4-ghost-playing.png' })

  // ── G2 reports body ──
  const body = (await st(pages[G2])).game.match.bodies?.[0]
  await walkStraight(G2, body.position.x, body.position.y, 20)
  await sleep(300)
  const rp = await emit(pages[G2], 'BODY_REPORTED', { bodyId: body.bodyId })
  rec('setup-report', !!rp.ok, JSON.stringify(rp))
  await until(async () => (await Promise.all(pages.map((p) => vis(p, '[data-testid="meeting-replay"]')))).every(Boolean), 6000)
  const rv = await Promise.all(pages.map((p) => vis(p, '[data-testid="meeting-replay"]')))
  const rpl = (await st(host)).meeting.replay
  rec('replay-on-all-clients', rv.every(Boolean), `visible ${rv}; frames ${rpl?.frames.length}; radius ${rpl?.radius}; players/frame last ${rpl?.frames.at(-1)?.players.length}`)
  const t1 = await txt(host, '[data-testid="meeting-replay-time"]')
  await sleep(6500)
  const t2s = await Promise.all(pages.map((p) => txt(p, '[data-testid="meeting-replay-time"]')))
  rec('replay-ends-body-found', t2s.every((t) => t === 'Body found here') && /−\d+s/.test(t1 ?? ''), `early "${t1}", after 6.5s ${JSON.stringify(t2s)}`)
  await host.screenshot({ path: '/app/.screenshots/t4-replay-end.png' })
  await host.click('[data-testid="meeting-replay-again"]'); await sleep(400)
  const t3 = await txt(host, '[data-testid="meeting-replay-time"]')
  rec('replay-again-restarts', /−\d+s/.test(t3 ?? ''), `after Replay click "${t3}"`)
  const canvasLit = await host.evaluate(() => { const c = document.querySelector('[data-testid="meeting-replay"] canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n })
  rec('replay-canvas-drawn', canvasLit > 100, `lit samples ${canvasLit}`)

  // ── Meeting: ghost chat vs living chat ──
  await until(async () => (await st(host)).game.match.state === 'DISCUSSION', 6000)
  const ghostSeesGhostPanel = await vis(pages[G1], '[data-testid="ghost-chat"]')
  const ghostSeesDebate = await vis(pages[G1], '[data-testid="chat"]')
  const livingPanels = await Promise.all(pages.filter((_, i) => i !== G1).map(async (p) => [await vis(p, '[data-testid="chat"]'), await vis(p, '[data-testid="ghost-chat"]')]))
  rec('meeting-ghost-panel-swap', ghostSeesGhostPanel && !ghostSeesDebate && livingPanels.every(([c, g]) => c && !g), `ghost: ghost=${ghostSeesGhostPanel} debate=${ghostSeesDebate}; living ${JSON.stringify(livingPanels)}`)
  await pages[G1].fill('[data-testid="ghost-chat-input"]', 'TEST_ghost_meeting'); await pages[G1].click('[data-testid="ghost-chat-send-btn"]'); await sleep(900)
  await pages[G2].fill('[data-testid="chat-input"]', 'TEST_living_says'); await pages[G2].click('[data-testid="chat-send-btn"]'); await sleep(900)
  const livingDom = await Promise.all(pages.filter((_, i) => i !== G1).map((p) => txt(p, '[data-testid="chat-messages"]')))
  const livingStores = (await Promise.all(pages.filter((_, i) => i !== G1).map(st))).map((s) => JSON.stringify(s))
  rec('meeting-ghost-msg-hidden-from-living', livingDom.every((t) => !/TEST_ghost_meeting/.test(t ?? '')) && livingStores.every((s) => !s.includes('TEST_ghost_meeting')) && livingDom.every((t) => /TEST_living_says/.test(t ?? '')),
    `living chat DOM samples ${JSON.stringify(livingDom.slice(0, 2))}`)
  const ghostDom = await txt(pages[G1], '[data-testid="ghost-chat-messages"]')
  rec('meeting-ghost-does-not-see-living-chat-in-panel', !/TEST_living_says/.test(ghostDom ?? ''), `ghost panel: ${ghostDom}`)
  await pages[G1].screenshot({ path: '/app/.screenshots/t4-meeting-ghost.png' })

  // ── Voting: everyone living votes D2 → early close ──
  await until(async () => (await st(host)).game.match.state === 'VOTING', 45000, 500)
  mark('voting')
  const vt0 = Date.now()
  for (const i of [G2, G3, G4, D1, D2].filter((i) => i !== D2)) await emit(pages[i], 'VOTE_SUBMITTED', { choice: ids[D2] })
  await emit(pages[D2], 'VOTE_SUBMITTED', { choice: 'SKIP' })
  const gv = await emit(pages[G1], 'VOTE_SUBMITTED', { choice: 'SKIP' })
  const closed = await until(async () => (await st(host)).game.match.state === 'VOTE_RESULTS', 5000)
  rec('vote-early-close', !!closed && Date.now() - vt0 < 8000, `ghost vote ack ${JSON.stringify(gv)}; closed after ${Date.now() - vt0}ms`)
  await until(async () => (await st(host)).game.match.state === 'PLAYING', 30000, 500)
  mark('back to playing; D2 ghost')
  await sleep(1000)

  // ── Two ghosts whisper in PLAYING ──
  await pages[D2].fill('[data-testid="ghost-chat-input"]', 'TEST_hello_from_D2'); await pages[D2].click('[data-testid="ghost-chat-send-btn"]'); await sleep(1000)
  await pages[G1].fill('[data-testid="ghost-chat-input"]', 'TEST_reply_from_G1'); await pages[G1].click('[data-testid="ghost-chat-send-btn"]'); await sleep(1000)
  const g1Box = await txt(pages[G1], '[data-testid="ghost-chat-messages"]')
  const d2Box = await txt(pages[D2], '[data-testid="ghost-chat-messages"]')
  const livingLeak2 = (await Promise.all([G2, G3, G4, D1].map((i) => st(pages[i])))).some((s) => /TEST_hello_from_D2|TEST_reply_from_G1/.test(JSON.stringify(s)))
  rec('ghost-whisper-between-ghosts', /TEST_hello_from_D2/.test(g1Box ?? '') && /TEST_reply_from_G1/.test(d2Box ?? '') && !livingLeak2, `G1 box: ${g1Box} | D2 box: ${d2Box} | living leak=${livingLeak2}`)
  // ghost CHAT_SEND via socket must not reach living chat
  const gs = await emit(pages[D2], 'CHAT_SEND', { text: 'TEST_socket_ghost' }); await sleep(600)
  const livingLeak3 = (await Promise.all([G2, G3, G4, D1].map((i) => st(pages[i])))).some((s) => JSON.stringify(s).includes('TEST_socket_ghost'))
  rec('ghost-socket-chat-not-living', !livingLeak3, `ack ${JSON.stringify(gs)}`)
  // living chat in PLAYING rejected
  const lc = await emit(pages[G2], 'CHAT_SEND', { text: 'TEST_living_playing' })
  rec('living-chat-closed-in-playing', lc.ok === false, JSON.stringify(lc))
  await pages[D2].screenshot({ path: '/app/.screenshots/t4-ghosts-playing.png' })

  // ── Emergency meeting after cooldown → no replay; vote out D1 ──
  const em = await until(async () => { const r = await emit(pages[G3], 'EMERGENCY_MEETING'); return r.ok ? r : null }, 70000, 3000)
  rec('setup-emergency', !!em)
  await until(async () => (await st(host)).game.match.state === 'DISCUSSION', 6000)
  await sleep(500)
  const anyReplay = (await Promise.all(pages.map((p) => vis(p, '[data-testid="meeting-replay"]')))).some(Boolean)
  const replayState = (await st(host)).meeting.replay
  rec('emergency-no-replay', !anyReplay && !replayState, `visible=${anyReplay}; store replay=${!!replayState}`)
  // ghosts still chat in second meeting
  await pages[D2].fill('[data-testid="ghost-chat-input"]', 'TEST_meeting2_ghost'); await pages[D2].click('[data-testid="ghost-chat-send-btn"]'); await sleep(900)
  rec('meeting2-ghost-whisper-received', /TEST_meeting2_ghost/.test((await txt(pages[G1], '[data-testid="ghost-chat-messages"]')) ?? ''))
  await until(async () => (await st(host)).game.match.state === 'VOTING', 45000, 500)
  for (const i of [G2, G3, G4]) await emit(pages[i], 'VOTE_SUBMITTED', { choice: ids[D1] })
  await emit(pages[D1], 'VOTE_SUBMITTED', { choice: 'SKIP' })
  await until(async () => (await st(host)).results?.gameOver, 30000, 500)
  await until(async () => vis(host, '[data-testid="badge-shelf"]'), 8000)
  const go = (await st(host)).results.gameOver
  const badges = await Promise.all(pages.map((p) => p.$$eval('[data-testid^="badge-"]:not([data-testid="badge-shelf"])', (els) => els.map((e) => `${e.dataset.testid}:${e.querySelector('.badge-card__who')?.textContent.trim()}`))))
  console.log('result', go?.result, 'stats', JSON.stringify(go?.stats?.map((s) => ({ n: names[ids.indexOf(s.playerId)], ...s, playerId: undefined }))))
  console.log('badges host', badges[0])
  const b0 = badges[0].join('|')
  const has = (id, who) => new RegExp(`badge-${id}:[^|]*${who}`).test(b0)
  rec('badges-shelf-all-clients', badges.every((b) => b.length === badges[0].length && b.length > 0), `counts ${badges.map((b) => b.length)}`)
  rec('badge-silent-assassin', has('SILENT_ASSASSIN', names[D1]))
  rec('badge-first-responder', has('FIRST_RESPONDER', names[G2]))
  rec('badge-sharp-eye-ties', has('SHARP_EYE', names[G2]) && has('SHARP_EYE', names[G3]) && has('SHARP_EYE', names[G4]))
  rec('badge-survivor', has('SURVIVOR', names[G2]) && has('SURVIVOR', names[G3]) && has('SURVIVOR', names[G4]) && !has('SURVIVOR', names[G1]))
  rec('badge-zero-hidden', !/BILL_PASSER|MASTER_BLUFFER|POWER_BROKER/.test(b0), b0)
  await host.screenshot({ path: '/app/.screenshots/t4-results.png', fullPage: true })
  console.log('\n=== errors ===\n' + (logs.slice(0, 30).join('\n') || 'none'))
  console.log(`\n${results.filter((r) => r[1]).length}/${results.length} passed`)
  await browser.close()
}
main().catch((e) => { console.log('FATAL', e); console.log(`\n${results.filter((r) => r[1]).length}/${results.length} passed`); process.exit(1) })
