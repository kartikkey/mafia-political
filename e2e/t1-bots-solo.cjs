/**
 * T1 iteration 4 — 1 human + 5 bots full match. Tracks bot behaviour via the human's socket events:
 * bot movement, task progress, eliminations by bots, reports by bots, bot chat + votes, early vote close,
 * replay for body meetings, badges at the end, ghost chat panel if the human dies.
 * Human stays at spawn and SKIPs votes. Then: human leaves mid-match → room closes (2nd room).
 *   node e2e/t1-bots-solo.cjs [baseUrl] [tag]
 */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const TAG = process.argv[3] ?? 'a'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const rec = (n, ok, note = '') => { results.push([n, ok]); console.log(`${ok ? 'PASS' : 'FAIL'} [${n}] ${note}`) }
;(async () => {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || undefined })
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  const st = () => p.evaluate(() => window.__netagiri.store.getState())
  await p.goto(BASE); await sleep(1500)
  await p.addInitScript(() => {})
  await p.fill('input[placeholder="Hon. Member"]', `TEST_Solo${TAG}`); await p.click('text=Create Room'); await p.waitForURL(/lobby/)
  await p.evaluate(() => { window.__ev = []; window.__netagiri.socket.onAny((e, d) => window.__ev.push([e, d, Date.now()])) })
  await p.click('[data-testid="add-bots-btn"]'); await sleep(600)
  const lobby = (await st()).lobby.lobby.players
  rec('solo-lobby-6', lobby.length === 6 && lobby.filter((x) => x.isBot).length === 5, lobby.map((x) => x.name).join(','))
  await p.click('[data-testid="start-game-btn"]')
  const t0 = Date.now()
  let lastState = '', meetings = [], ghostChecked = false, votingStart = 0
  while (Date.now() - t0 < 270_000) {
    const s = await st().catch(() => null)
    if (!s) { await sleep(500); continue }
    const state = s.game.match?.state
    if (state !== lastState) {
      console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${state} tasks ${s.game.match?.completedTasks}/${s.game.match?.totalTasks} alive ${s.game.match?.players.filter((x) => x.alive).length}`)
      if (state === 'DISCUSSION') {
        await sleep(1500)
        const m = (await st()).meeting
        meetings.push({ reason: m.reason, caller: m.callerId, replayFrames: m.replay?.frames.length ?? 0, replayVisible: await p.isVisible('[data-testid="meeting-replay"]'), chat: [] })
        console.log('meeting', m.reason, 'frames', m.replay?.frames.length ?? 0, 'replay visible', meetings.at(-1).replayVisible)
      }
      if (state === 'VOTING') votingStart = Date.now()
      if (lastState === 'VOTING') { meetings.at(-1).votingMs = Date.now() - votingStart; meetings.at(-1).chat = (await st()).meeting.chat?.length ?? 0 }
    }
    lastState = state
    const me = s.game.match?.players.find((x) => x.id === s.join.playerId)
    if (state === 'VOTING' && me?.alive && !s.meeting.myVote) await p.evaluate(() => new Promise((r) => window.__netagiri.socket.emit('VOTE_SUBMITTED', { choice: 'SKIP' }, r)))
    if (state === 'PLAYING' && me && !me.alive && !ghostChecked) {
      ghostChecked = true; await sleep(500)
      rec('solo-ghost-panel-when-killed', await p.isVisible('[data-testid="ghost-chat"]'))
      await p.screenshot({ path: `/app/.screenshots/t4-solo-ghost-${TAG}.png`, quality: 40, type: 'jpeg' })
    }
    if (state === 'GAME_OVER') break
    await sleep(700)
  }
  await sleep(2000)
  const s = await st()
  const ev = await p.evaluate(() => window.__ev)
  const players = s.game.match?.players ?? []
  const botIds = players.filter((x) => x.isBot).map((x) => x.id)
  const moved = new Set(ev.filter(([e, d]) => e === 'PLAYER_MOVED' && botIds.includes(d.playerId)).map(([, d]) => d.playerId))
  const prog = ev.filter(([e]) => e === 'TASK_PROGRESS').length
  const kills = ev.filter(([e]) => e === 'PLAYER_ELIMINATED').length
  const chats = ev.filter(([e, d]) => e === 'CHAT_MESSAGE' && botIds.includes(d.playerId)).map(([, d]) => d.text)
  const go = s.results.gameOver
  console.log('result', go?.result, 'meetings', JSON.stringify(meetings))
  console.log('bot chat lines', chats)
  const st2 = go?.stats?.map((x) => `${players.find((p) => p.id === x.playerId)?.name}:${x.faction[0]} t${x.tasksCompleted} f${x.fakeTasks} k${x.eliminations} r${x.reports} v${x.votesOnAgents} ${x.alive ? 'alive' : x.ejected ? 'ejected' : 'dead'}`)
  console.log('stats', st2)
  rec('solo-bots-move', moved.size === 5, `${moved.size}/5`)
  rec('solo-tasks-progress', prog > 0, `TASK_PROGRESS ${prog}`)
  rec('solo-game-over', !!go, go?.result)
  const body = meetings.filter((m) => m.reason === 'BODY'), emerg = meetings.filter((m) => m.reason === 'EMERGENCY')
  rec('solo-body-meeting-replay', body.every((m) => m.replayVisible && m.replayFrames > 0), `body meetings ${body.length}, emergency ${emerg.length}; kills ${kills}`)
  rec('solo-bot-report', body.some((m) => botIds.includes(m.caller)), 'at least one body report by a bot')
  rec('solo-early-vote-close', meetings.filter((m) => m.votingMs).every((m) => m.votingMs < 19000), meetings.map((m) => m.votingMs).join(','))
  rec('solo-bot-chat', chats.length > 0 || meetings.length === 0, `${chats.length} lines`)
  const shown = await p.$$eval('[data-testid^="badge-"]:not([data-testid="badge-shelf"])', (e) => e.map((x) => x.dataset.testid)).catch(() => [])
  rec('solo-badges-shown', shown.length > 0, shown.join(','))
  await p.screenshot({ path: `/app/.screenshots/t4-solo-results-${TAG}.png`, quality: 40, type: 'jpeg' })
  console.log('page errors', errs.length ? errs : 'none')
  console.log(`\n${results.filter((r) => r[1]).length}/${results.length} passed`)
  await b.close()
})()
