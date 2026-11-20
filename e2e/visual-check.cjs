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
  const shot = (i, name) => pages[i].screenshot({ path: `docs/screenshots/${name}.png` })
  await shot(g, 'camera-follow')
  // Fake task at File the Motion (tile 15,3): others must see the same interact bubble as a real task.
  await go('y', 112); await go('x', 496)
  await pages[d].keyboard.press('KeyE'); await sleep(700)
  const seen = (await st(pages[g])).game.interacting[ids[d]]
  console.log('gov sees deep interacting at', seen)
  await pages[g].keyboard.press('KeyZ'); await pages[g].keyboard.press('KeyZ'); await sleep(400)
  await shot(g, 'fake-task-bubble-fullmap')
  await pages[d].keyboard.press('Escape'); await sleep(500)
  console.log('after Esc, gov sees', (await st(pages[g])).game.interacting[ids[d]] ?? 'nothing')
  await sleep(300)
  await pages[d].keyboard.press('KeyF'); await sleep(800)
  const sab = (await st(pages[g])).game.match.sabotage
  console.log('leak', JSON.stringify(sab), 'news', (await st(pages[g])).game.news.at(-1)?.key)
  await pages[g].keyboard.press('KeyZ'); await sleep(400)
  await shot(g, 'document-leak-gov')
  await shot(d, 'document-leak-deep')
  await b.close()
})()
