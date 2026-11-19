const { chromium } = require('playwright')
const out = process.argv[2] ?? 'docs/screenshots'
;(async () => {
  const browser = await chromium.launch()
  const pages = []
  for (let i = 0; i < 6; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    pages.push(await ctx.newPage())
  }
  const [host, ...rest] = pages
  await host.goto('http://localhost:5173/')
  await host.fill('input[placeholder="Hon. Member"]', 'Speaker')
  await host.click('text=Create Room')
  await host.waitForURL(/\/lobby\//)
  const code = host.url().split('/').pop()
  console.log('room', code)
  for (const [i, p] of rest.entries()) {
    await p.goto('http://localhost:5173/')
    await p.fill('input[placeholder="Hon. Member"]', `MP${i + 1}`)
    await p.click(`.join__avatar >> nth=${i + 1}`)
    await p.fill('input[aria-label="Room code"]', code)
    await p.click('button:has-text("Join")')
    await p.waitForURL(/\/lobby\//)
  }
  await host.waitForSelector('text=Quorum reached.')
  await host.screenshot({ path: `${out}/lobby.png` })
  await host.click('text=Start Game')
  await Promise.all(pages.map((p) => p.waitForURL(/\/game\//)))
  await host.waitForSelector('.role-reveal h1')
  const roles = await Promise.all(pages.map((p) => p.textContent('.role-reveal h1')))
  console.log('roles', roles)
  const deep = pages[roles.findIndex((r) => r.includes('Deep'))]
  await deep.screenshot({ path: `${out}/reveal-deep.png` })
  await host.waitForSelector('.role-reveal', { state: 'detached', timeout: 8000 })
  // Move host right for 600ms and check another client sees it.
  const before = await rest[0].evaluate(() => 0)
  await host.keyboard.down('KeyD'); await host.waitForTimeout(600); await host.keyboard.up('KeyD')
  await host.waitForTimeout(300)
  await host.screenshot({ path: `${out}/game.png` })
  await rest[0].screenshot({ path: `${out}/game-other.png` })
  console.log('ok')
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
