/** T1 iter4: 1 human + 5 bots start, human disconnects mid-match → room closes (join → Room not found). */
const { io } = require('socket.io-client')
const BASE = process.argv[2] ?? 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const client = () => new Promise((r) => { const s = io(BASE, { path: '/api/socket.io', transports: ['websocket'], forceNew: true }); s.on('connect', () => r(s)) })
const call = async (s, ev, payload) => { await sleep(230); return new Promise((res) => { const cb = (a) => res(a); payload === undefined ? s.emit(ev, cb) : s.emit(ev, payload, cb) }) }
;(async () => {
  const H = await client()
  const c = await call(H, 'CREATE_ROOM', { name: 'TEST_Leaver', avatar: 0 })
  const code = c.data.roomCode
  await call(H, 'ADD_BOTS')
  const sg = await call(H, 'START_GAME')
  await sleep(8000)
  const P = await client()
  const during = await call(P, 'JOIN_ROOM', { name: 'TEST_Probe', avatar: 0, roomCode: code })
  console.log('join during match:', JSON.stringify(during), 'start', JSON.stringify(sg))
  H.disconnect(); await sleep(1500)
  const after = await call(P, 'JOIN_ROOM', { name: 'TEST_Probe', avatar: 0, roomCode: code })
  console.log(/not found/i.test(after.reason ?? '') ? 'PASS' : 'FAIL', '[room-closes-midmatch-last-human-leaves]', JSON.stringify(after))
  P.disconnect(); process.exit(0)
})()
