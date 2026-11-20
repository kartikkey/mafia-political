/** T1: mute toggle persistence in-game (top bar), reload mid-match, far-elimination reason, layout screenshots. */
const { chromium } = require('playwright')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const st = (page) => page.evaluate(() => window.__netagiri.store.getState())
async function until(fn, ms = 10000, step = 150) {
  const end = Date.now() + ms
  while (Date.now() < end) { const v = await fn().catch(() => null); if (v) return v; await sleep(step) }
  return null
}
const res = []
const rec = (n, ok, note) => { res.push(n); console.log(`${ok ? 'PASS' : 'FAIL'} [${n}] ${note}`) }
;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || undefined })
  const pages = []
  for (let i = 0; i < 6; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const p = await ctx.newPage(); p.setDefaultTimeout(8000)
    p.on('pageerror', (e) => console.log(`[p${i} err]`, e.message))
    pages.push(p)
  }
  const host = pages[0]
  await host.goto(BASE); await until(async () => (await st(host)).join.connected)
  await host.fill('input[placeholder="Hon. Member"]', 'Host')
  await host.click('text=Create Room'); await host.waitForURL(/\/lobby\//)
  const code = host.url().split('/').pop()
  await host.screenshot({ path: '/app/.screenshots/t1-lobby-1920.png' })
  for (let i = 1; i < 6; i++) {
    const p = pages[i]
    await p.goto(BASE); await until(async () => (await st(p)).join.connected)
    await p.fill('input[placeholder="Hon. Member"]', `MP${i}`)
    await p.fill('input[aria-label="Room code"]', code)
    await p.click('button:has-text("Join")'); await p.waitForURL(/\/lobby\//)
  }
  const lobbyMute = await host.isVisible('[data-testid="mute-toggle"]')
  console.log('mute toggle visible in lobby:', lobbyMute)
  await sleep(300)
  await host.click('text=Start Game')
  await Promise.all(pages.slice(0, 5).map((p) => p.waitForURL(/\/game\//, { timeout: 10000 })))
  await Promise.all(pages.slice(0, 5).map((p) => p.waitForSelector('[data-testid="role-reveal"]', { state: 'detached', timeout: 12000 }).catch(() => {})))
  await host.screenshot({ path: '/app/.screenshots/t1-game-1920.png' })

  // Mute in game + reload
  const p1 = pages[1]
  const m = () => p1.locator('[data-testid="mute-toggle"]')
  const a = (await m().textContent()).trim()
  await m().click(); await sleep(200)
  const b = (await m().textContent()).trim()
  const ls = await p1.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))))
  await p1.reload()
  const back = await until(async () => /\/game\//.test(p1.url()) && (await p1.isVisible('[data-testid="mute-toggle"]')), 10000)
  const c = back ? (await m().textContent()).trim() : 'n/a'
  const s1 = await st(p1).catch(() => null)
  rec('mute-reload', a !== b && b === c, `"${a}" → "${b}" → after reload "${c}" (url ${p1.url()}, localStorage ${ls}); after reload in match=${!!s1?.game?.match}, role=${s1?.game?.role?.faction}`)
  await p1.screenshot({ path: '/app/.screenshots/t1-after-reload.png' })

  // Far elimination reason
  const S = await Promise.all(pages.slice(0, 5).map(st))
  const d = S.findIndex((s) => s.game.role?.faction === 'DEEP_STATE')
  if (d >= 0) {
    const pd = pages[d]
    // walk down into the corridor away from everyone
    const tx = 20 * 32
    await pd.keyboard.down('KeyS'); await sleep(1800); await pd.keyboard.up('KeyS'); await sleep(400)
    const reason = await pd.textContent('[data-testid="action-eliminate-reason"]').catch(() => 'n/a')
    const dis = await pd.isDisabled('[data-testid="action-eliminate"]')
    const pos = (await st(pd)).game.match.players.find((p) => p.id === S[d].join.playerId).position
    rec('elim-far-reason', dis && /No target in range|Cooldown/.test(reason), `deep at ${JSON.stringify(pos)} disabled=${dis} reason "${reason}"`)
  }
  // tablet layout
  await host.setViewportSize({ width: 768, height: 1024 }); await sleep(500)
  await host.screenshot({ path: '/app/.screenshots/t1-game-768.png' })
  await browser.close()
  process.exit(0)
})().catch((e) => { console.error('ERROR', e); process.exit(1) })
