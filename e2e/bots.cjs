/**
 * Solo play with computer players: 1 human + bots fill the lobby, the match runs to the end.
 *   node e2e/bots.cjs [baseUrl]   → screenshots in docs/screenshots (bots-*.png)
 */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || undefined })
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  p.on('pageerror', (e) => console.log('[page error]', e.message))
  const st = () => p.evaluate(() => window.__netagiri.store.getState())
  await p.goto(BASE); await sleep(1500)
  await p.fill('input[placeholder="Hon. Member"]', 'Solo'); await p.click('text=Create Room'); await p.waitForURL(/lobby/)
  await p.click('[data-testid="add-bots-btn"]'); await sleep(600)
  const lobby = (await st()).lobby.lobby.players
  console.log('lobby', lobby.map((x) => `${x.name}${x.isBot ? '(bot)' : ''}`).join(', '))
  await p.screenshot({ path: 'docs/screenshots/bots-lobby.png' })
  await p.click('[data-testid="start-game-btn"]')
  const t0 = Date.now()
  let shotMeeting = false, shotGame = false, lastState = ''
  while (Date.now() - t0 < 300_000) {
    const s = await st()
    const state = s.game.match?.state
    if (state !== lastState) console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${state} tasks ${s.game.match?.completedTasks}/${s.game.match?.totalTasks}`)
    lastState = state
    if (state === 'PLAYING' && !shotGame && Date.now() - t0 > 15000) { await p.screenshot({ path: 'docs/screenshots/bots-game.png' }); shotGame = true }
    if ((state === 'DISCUSSION') && !shotMeeting) {
      await sleep(2500)
      await p.screenshot({ path: 'docs/screenshots/bots-meeting.png' })
      shotMeeting = true
      const m = (await st()).meeting
      console.log('meeting', m.reason, 'replay frames', m.replay?.frames.length ?? 0, 'chat', m.chat.length)
    }
    if (state === 'VOTING' && !(await st()).meeting.myVote) await p.evaluate(() => new Promise((r) => window.__netagiri.socket.emit('VOTE_SUBMITTED', { choice: 'SKIP' }, r)))
    if (state === 'GAME_OVER') break
    await sleep(1000)
  }
  await sleep(1500)
  const go = (await st()).results.gameOver
  console.log('result', go?.result, 'badges shown', await p.$$eval('[data-testid^="badge-"]', (e) => e.length).catch(() => 0))
  await p.screenshot({ path: 'docs/screenshots/bots-results.png', fullPage: true })
  await b.close()
})()
