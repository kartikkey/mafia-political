/**
 * T1 iteration 7: invite QR toggle, host kick (+ kicked rejoin), reload rejoin, offline drop banner,
 * HUD 'reconnecting', results play-again by non-host + results invite.
 *   node e2e/t1-iter7.cjs <baseUrl>
 */
const { chromium } = require('playwright')
const { io } = require('/app/frontend/node_modules/socket.io-client')
const BASE = process.argv[2]
const results = []
const rec = (name, ok, note = '') => { results.push([name, ok, note]); console.log(`${ok ? 'PASS' : 'FAIL'} [${name}] ${note}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const st = (page) => page.evaluate(() => window.__netagiri.store.getState())
async function until(fn, ms = 10000, step = 150) {
  const end = Date.now() + ms
  while (Date.now() < end) { const v = await fn().catch(() => null); if (v) return v; await sleep(step) }
  return null
}
const client = () => new Promise((r) => { const s = io(BASE, { path: '/api/socket.io', transports: ['websocket'], forceNew: true, reconnection: false }); s.on('connect', () => r(s)) })
const call = (s, ev, payload) => new Promise((res) => { const cb = (a) => res(a); payload === undefined ? s.emit(ev, cb) : s.emit(ev, payload, cb) })

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/pw-browsers/chromium_headless_shell-1248/chrome-linux/headless_shell' })
  const ctxs = [], pages = []
  for (let i = 0; i < 3; i++) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    ctxs.push(c); pages.push(await c.newPage())
  }
  const [H, A, B] = pages
  const socks = []
  try {
    // ── Lobby: create + join via invite URL
    await H.goto(BASE, { waitUntil: 'domcontentloaded' })
    await H.fill('[data-testid="join-name-input"]', 'TESTHost')
    await until(async () => H.isEnabled('[data-testid="create-room-btn"]'))
    await H.click('[data-testid="create-room-btn"]')
    await H.waitForURL(/lobby/, { timeout: 10000 })
    const code = (await st(H)).join.roomCode
    rec('room-created', !!code, code)
    for (const [p, n] of [[A, 'TESTAlice'], [B, 'TESTBob']]) {
      await p.goto(`${BASE}/?room=${code}`, { waitUntil: 'domcontentloaded' })
      await p.fill('[data-testid="join-name-input"]', n)
      await until(async () => p.isEnabled('[data-testid="join-room-btn"]'))
      await p.click('[data-testid="join-room-btn"]')
      const ok = await until(async () => /lobby/.test(p.url()), 10000)
      if (!ok) throw new Error(`${n} join failed url=${p.url()} err=${await p.locator('[data-testid="join-error"]').innerText().catch(() => '-')} code=${await p.inputValue('[data-testid="join-room-code-input"]').catch(() => '-')}`)
    }
    const ids = {}
    for (const [k, p] of [['H', H], ['A', A], ['B', B]]) ids[k] = (await st(p)).join.playerId
    const sess = await A.evaluate(() => sessionStorage.getItem('netagiri.session'))
    rec('session-token-stored', !!sess && JSON.parse(sess).token?.length > 8, sess)

    // QR toggle
    rec('qr-hidden-initially', !(await H.isVisible('[data-testid="invite-qr"]')))
    await H.click('[data-testid="toggle-invite-qr-btn"]')
    await sleep(400)
    const svg = await H.locator('[data-testid="invite-qr"] svg').count()
    rec('qr-shown-svg', (await H.isVisible('[data-testid="invite-qr"]')) && svg > 0, `svg=${svg}`)
    const qrText = await H.locator('[data-testid="invite-qr"]').innerText().catch(() => '')
    await H.screenshot({ path: '/app/.screenshots/iter7_lobby_qr.jpeg', quality: 40, type: 'jpeg' })
    await H.click('[data-testid="toggle-invite-qr-btn"]')
    await sleep(300)
    rec('qr-hidden-again', !(await H.isVisible('[data-testid="invite-qr"]')), qrText.slice(0, 80))

    // kick buttons
    await H.click('[data-testid="add-bots-btn"]'); await sleep(800)
    const kickIds = await H.$$eval('[data-testid^="kick-player-"]', (els) => els.map((e) => e.dataset.testid.replace('kick-player-', '')))
    rec('host-kick-btns-humans-only', kickIds.length === 2 && kickIds.includes(ids.A) && kickIds.includes(ids.B) && !kickIds.includes(ids.H), JSON.stringify(kickIds))
    const nonHostKick = await A.locator('[data-testid^="kick-player-"]').count()
    rec('non-host-no-kick-btns', nonHostKick === 0, `count=${nonHostKick}`)
    await H.click(`[data-testid="kick-player-${ids.A}"]`)
    const err = await until(async () => (await A.isVisible('[data-testid="join-error"]')) && A.innerText('[data-testid="join-error"]'), 6000)
    rec('kicked-lands-on-join-with-msg', /host removed you/i.test(err || '') && !/lobby/.test(A.url()), `${err} url=${A.url()}`)
    const hLobby = await until(async () => { const s = await st(H); const pl = s.lobby?.players ?? s.lobby?.lobby?.players; return pl && !pl.some((p) => p.id === ids.A) ? pl.length : null }, 4000)
    rec('host-roster-without-kicked', !!hLobby, `players=${hLobby}`)
    await A.screenshot({ path: '/app/.screenshots/iter7_kicked.jpeg', quality: 40, type: 'jpeg' })
    // kicked rejoins with same name
    await A.fill('[data-testid="join-name-input"]', 'TESTAlice')
    await A.fill('[data-testid="join-room-code-input"]', code)
    await until(async () => A.isEnabled('[data-testid="join-room-btn"]'))
    await A.click('[data-testid="join-room-btn"]')
    const rej = await A.waitForURL(/lobby/, { timeout: 8000 }).then(() => true).catch(() => false)
    rec('kicked-can-rejoin-same-name', rej, A.url())
    ids.A = (await st(A)).join.playerId

    // ── Fill with raw socket humans for a deterministic match (no bots)
    await H.click('[data-testid="remove-bots-btn"]'); await sleep(600)
    for (let i = 0; i < 3; i++) {
      const s = await client(); socks.push(s)
      s.on('ROLE_ASSIGNED', (r) => { s.faction = r.faction })
      const r = await call(s, 'JOIN_ROOM', { roomCode: code, name: `TESTSock${i}`, avatar: i })
      s.pid = r.data?.playerId
    }
    await sleep(600)
    await until(async () => H.isEnabled('[data-testid="start-game-btn"]'), 5000)
    await H.click('[data-testid="start-game-btn"]')
    const inGame = await until(async () => { for (const p of pages) if (!(await p.isVisible('[data-testid="game-screen"]'))) return false; return true }, 15000)
    rec('match-started-3-browsers', !!inGame)
    await until(async () => (await st(H)).game.match?.state === 'PLAYING', 10000); await sleep(500)
    const facB = (await st(B)).game.role?.faction

    // ── reload B
    await B.reload({ waitUntil: 'commit' })
    const sawRejoin = await until(async () => B.isVisible('[data-testid="rejoining-screen"]'), 4000, 30)
    const back = await until(async () => B.isVisible('[data-testid="game-screen"]'), 10000)
    const facB2 = back ? (await st(B)).game.role?.faction : null
    rec('reload-rejoins-game', !!back && facB2 === facB, `sawRejoiningScreen=${!!sawRejoin} faction ${facB} -> ${facB2} url=${B.url()}`)
    rec('reload-shows-rejoining-screen', !!sawRejoin)

    // ── offline drop A
    await ctxs[1].setOffline(true)
    const banner = await until(async () => A.isVisible('[data-testid="reconnecting-banner"]'), 30000, 200)
    const hud = await until(async () => H.isVisible(`[data-testid="hud-reconnecting-${ids.A}"]`), 30000, 200)
    rec('offline-banner-appears', !!banner)
    rec('hud-reconnecting-shown-to-others', !!hud)
    if (banner) await A.screenshot({ path: '/app/.screenshots/iter7_banner.jpeg', quality: 40, type: 'jpeg' })
    if (hud) await H.screenshot({ path: '/app/.screenshots/iter7_hud.jpeg', quality: 40, type: 'jpeg' })
    await sleep(3000)
    await ctxs[1].setOffline(false)
    const gone = await until(async () => !(await A.isVisible('[data-testid="reconnecting-banner"]')), 20000, 200)
    const hudGone = await until(async () => !(await H.isVisible(`[data-testid="hud-reconnecting-${ids.A}"]`)), 10000, 200)
    rec('banner-disappears-after-rejoin', !!gone && (await A.isVisible('[data-testid="game-screen"]')))
    rec('hud-reconnecting-cleared', !!hudGone)

    // ── end match: deep-state players leave
    const deep = []
    for (const s of socks) if (s.faction === 'DEEP_STATE') deep.push(['sock', s])
    for (const [k, p] of [['H', H], ['A', A], ['B', B]]) if ((await st(p)).game.role?.faction === 'DEEP_STATE') deep.push([k, p])
    console.log('deep:', deep.map((d) => d[0]))
    for (const [k, x] of deep) {
      if (k === 'sock') x.emit('LEAVE_ROOM')
      else await x.evaluate(() => window.__netagiri.socket.emit('LEAVE_ROOM'))
    }
    const remaining = [['H', H], ['A', A], ['B', B]].filter(([k]) => !deep.some((d) => d[0] === k))
    const onResults = await until(async () => { for (const [, p] of remaining) if (!(await p.isVisible('[data-testid="results-screen"]'))) return false; return true }, 12000)
    rec('results-screen', !!onResults, remaining.map((r) => r[0]).join(','))
    let allBtn = true
    for (const [, p] of remaining) allBtn = allBtn && (await p.isVisible('[data-testid="play-again-btn"]'))
    rec('play-again-visible-for-all', allBtn)
    const inv = await remaining[0][1].isVisible('[data-testid="results-invite"]') && await remaining[0][1].isVisible('[data-testid="copy-invite-link-btn"]')
    rec('results-invite-visible', inv)
    await remaining[0][1].screenshot({ path: '/app/.screenshots/iter7_results.jpeg', quality: 40, type: 'jpeg' })
    // non-host click
    let nonHost = null
    for (const [k, p] of remaining) { const s = await st(p); const me = s.game.match?.players?.find((x) => x.id === s.join.playerId); if (me && !me.isHost) { nonHost = [k, p]; break } }
    rec('found-non-host-on-results', !!nonHost, nonHost?.[0])
    if (nonHost) {
      await nonHost[1].click('[data-testid="play-again-btn"]')
      const lob = await until(async () => { for (const [, p] of remaining) if (!/lobby/.test(p.url())) return false; return true }, 8000)
      const codes = []
      for (const [, p] of remaining) codes.push((await st(p)).join.roomCode)
      rec('play-again-non-host-moves-all-to-lobby', !!lob && codes.every((c) => c === code), JSON.stringify(codes) + ' ' + remaining.map(([, p]) => p.url()).join(' '))
    }
  } catch (e) {
    rec('script-error', false, e.message)
  } finally {
    socks.forEach((s) => s.disconnect())
    await browser.close()
    const f = results.filter((r) => !r[1]).length
    console.log(`\n${results.length - f}/${results.length} passed`)
    process.exit(0)
  }
})()
