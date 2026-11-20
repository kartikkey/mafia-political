/**
 * T1 iteration 4 — socket-level checks for computer players (lobby add/remove, bump on full room,
 * non-host rejection, close when last human leaves, mixed 3 humans + 3 bots start).
 *   node e2e/t1-bots-socket.cjs [baseUrl]
 */
const { io } = require('socket.io-client')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const rec = (n, ok, note = '') => { results.push([n, ok]); console.log(`${ok ? 'PASS' : 'FAIL'} [${n}] ${note}`) }
function client() {
  const s = io(BASE, { path: '/api/socket.io', transports: ['websocket'], forceNew: true })
  s.lobby = null; s.events = []
  s.on('LOBBY_UPDATED', (l) => { s.lobby = l })
  s.onAny((ev, d) => s.events.push([ev, d]))
  return new Promise((r) => s.on('connect', () => r(s)))
}
const call = async (s, ev, payload) => { await sleep(230); return new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), 4000)
  const cb = (a) => { clearTimeout(t); res(a) }
  payload === undefined ? s.emit(ev, cb) : s.emit(ev, payload, cb)
}) }

;(async () => {
  try {
    const H = await client()
    const c = await call(H, 'CREATE_ROOM', { name: 'TEST_Host', avatar: 0 })
    const code = c.data?.roomCode ?? c.roomCode
    console.log('create', JSON.stringify(c))
    const N = await client()
    const j = await call(N, 'JOIN_ROOM', { name: 'TEST_Guest', avatar: 1, roomCode: code })
    rec('guest-join', j.ok !== false, JSON.stringify(j))
    const nb = await call(N, 'ADD_BOTS')
    rec('nonhost-add-rejected', nb.ok === false, JSON.stringify(nb))
    const a = await call(H, 'ADD_BOTS'); await sleep(300)
    let bots = H.lobby.players.filter((p) => p.isBot)
    rec('add-bots-fills-to-6', a.ok !== false && H.lobby.players.length === 6 && bots.length === 4 && bots.every((b) => b.name.startsWith('Bot ')), H.lobby.players.map((p) => p.name + (p.isBot ? '*' : '')).join(','))
    const a2 = await call(H, 'ADD_BOTS')
    rec('add-bots-when-full-quorum-rejected', a2.ok === false, JSON.stringify(a2))
    const nr = await call(N, 'REMOVE_BOTS')
    rec('nonhost-remove-rejected', nr.ok === false, JSON.stringify(nr))
    const r = await call(H, 'REMOVE_BOTS'); await sleep(300)
    rec('remove-bots', r.ok !== false && H.lobby.players.length === 2 && !H.lobby.players.some((p) => p.isBot), `${H.lobby.players.length}`)
    await call(H, 'ADD_BOTS'); await sleep(300)
    // fill to 10 with 4 more humans → 6 humans + 4 bots
    const extra = []
    for (let i = 0; i < 4; i++) { const s = await client(); extra.push(s); await call(s, 'JOIN_ROOM', { name: `TEST_X${i}`, avatar: i, roomCode: code }) }
    await sleep(300)
    rec('fill-to-10', H.lobby.players.length === 10 && H.lobby.players.filter((p) => p.isBot).length === 4, `${H.lobby.players.length} players, ${H.lobby.players.filter((p) => p.isBot).length} bots`)
    // 11th human bumps a bot
    const B = await client(); extra.push(B)
    const jb = await call(B, 'JOIN_ROOM', { name: 'TEST_Bumper', avatar: 2, roomCode: code }); await sleep(300)
    rec('join-full-bumps-bot', jb.ok !== false && H.lobby.players.length === 10 && H.lobby.players.filter((p) => p.isBot).length === 3, `${JSON.stringify(jb)} → ${H.lobby.players.length} players, ${H.lobby.players.filter((p) => p.isBot).length} bots`)
    // Duplicate name on full room: should NOT consume a bot
    const D = await client(); extra.push(D)
    const jd = await call(D, 'JOIN_ROOM', { name: 'TEST_Guest', avatar: 2, roomCode: code }); await sleep(300)
    const st = await call(H, 'SET_AVATAR', { avatar: 3 }); await sleep(300) // forces a lobby push
    rec('dup-name-on-full-room-keeps-bot', jd.ok === false && H.lobby.players.filter((p) => p.isBot).length === 3 && H.lobby.players.length === 10,
      `${JSON.stringify(jd)} → after push: ${H.lobby.players.length} players, ${H.lobby.players.filter((p) => p.isBot).length} bots`)
    // last human leaves → room closes
    for (const s of [N, ...extra]) s.disconnect()
    await sleep(500)
    H.disconnect(); await sleep(500)
    const P = await client()
    const jc = await call(P, 'JOIN_ROOM', { name: 'TEST_Late', avatar: 0, roomCode: code })
    rec('room-closed-after-last-human', jc.ok === false && /not found/i.test(jc.error ?? JSON.stringify(jc)), JSON.stringify(jc))
    P.disconnect()

    // Mixed: 3 humans + 3 bots, start, observe bots move and act for 25s
    const hs = [await client(), await client(), await client()]
    const c2 = await call(hs[0], 'CREATE_ROOM', { name: 'TEST_M0', avatar: 0 })
    const code2 = c2.data?.roomCode ?? c2.roomCode
    await call(hs[1], 'JOIN_ROOM', { name: 'TEST_M1', avatar: 1, roomCode: code2 })
    await call(hs[2], 'JOIN_ROOM', { name: 'TEST_M2', avatar: 2, roomCode: code2 })
    await call(hs[0], 'ADD_BOTS'); await sleep(300)
    const botIds = hs[0].lobby.players.filter((p) => p.isBot).map((p) => p.id)
    const sg = await call(hs[0], 'START_GAME')
    rec('mixed-start', sg.ok !== false && botIds.length === 3, JSON.stringify(sg))
    await sleep(30000)
    const moved = new Set(hs[1].events.filter(([e, d]) => e === 'PLAYER_MOVED' && botIds.includes(d.playerId)).map(([, d]) => d.playerId))
    const prog = hs[1].events.filter(([e]) => e === 'TASK_PROGRESS').length
    const evNames = [...new Set(hs[1].events.map(([e]) => e))]
    rec('mixed-bots-move', moved.size === 3, `bots moved: ${moved.size}/3; task progress events ${prog}; events ${evNames.join(',')}`)
    rec('mixed-bots-progress-tasks', prog > 0, `TASK_PROGRESS events in 30s: ${prog}`)
    hs.forEach((s) => s.disconnect())
  } catch (e) { console.log('ERROR', e) }
  console.log(`\n${results.filter((r) => r[1]).length}/${results.length} passed`)
  process.exit(0)
})()
