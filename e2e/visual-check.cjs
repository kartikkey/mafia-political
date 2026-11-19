/** Visual check: power cut (both factions), a task modal and the Deep State HUD. Screenshots → docs/screenshots. */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || undefined })
  const pages = []
  for (let i = 0; i < 6; i++) pages.push(await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage())
  const st = (p) => p.evaluate(() => window.__netagiri.store.getState())
  await pages[0].goto(BASE); await sleep(1500)
  await pages[0].fill('input[placeholder="Hon. Member"]', 'Host'); await pages[0].click('text=Create Room'); await pages[0].waitForURL(/lobby/)
  const code = pages[0].url().split('/').pop()
  for (let i = 1; i < 6; i++) { const p = pages[i]; await p.goto(BASE); await sleep(1200); await p.fill('input[placeholder="Hon. Member"]', 'MP' + i); await p.click(`.join__avatar >> nth=${i}`); await p.fill('input[aria-label="Room code"]', code); await p.click('button:has-text("Join")'); await p.waitForURL(/lobby/) }
  await pages[0].screenshot({ path: 'docs/screenshots/lobby.png' })
  await pages[0].click('text=Start Game'); await sleep(1500)
  const S = await Promise.all(pages.map(st))
  const ids = S.map((s) => s.join.playerId)
  const d = S.findIndex((s) => s.game.role.faction === 'DEEP_STATE')
  const g = S.findIndex((s) => s.game.role.faction === 'GOVERNMENT')
  await pages[d].screenshot({ path: 'docs/screenshots/reveal-deep.png' })
  await sleep(4000)
  const obs = d === 0 ? 1 : 0
  const pos = async () => (await st(pages[obs])).game.match.players.find((p) => p.id === ids[d]).position
  async function go(axis, target) {
    for (let n = 0; n < 30; n++) {
      const p = await pos(); const delta = target - p[axis]
      if (Math.abs(delta) < 8) return
      const key = axis === 'x' ? (delta > 0 ? 'KeyD' : 'KeyA') : delta > 0 ? 'KeyS' : 'KeyW'
      await pages[d].keyboard.down(key); await sleep(Math.min(500, Math.abs(delta) / 160 * 1000)); await pages[d].keyboard.up(key); await sleep(150)
    }
  }
  await go('y', 112); await go('x', 640); await go('y', 720); await go('x', 500)
  await sleep(300)
  await pages[d].screenshot({ path: 'docs/screenshots/deep-at-panel.png' })
  await pages[d].keyboard.press('KeyE'); await sleep(800)
  const s2 = await st(pages[g])
  console.log('power', s2.game.match.sabotage.powerStatus)
  await pages[g].screenshot({ path: 'docs/screenshots/power-cut-gov.png' })
  await pages[d].screenshot({ path: 'docs/screenshots/power-cut-deep.png' })
  // Gov opens nearest-free task via raw state: walk not needed for the modal look — use the station next to spawn if in range.
  await pages[g].keyboard.press('KeyE'); await sleep(600)
  console.log('gov feedback', (await st(pages[g])).game.feedback)
  await b.close()
})()
