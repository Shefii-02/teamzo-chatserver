#!/usr/bin/env node
// Manual end-to-end check of a running chat-server (no Laravel login needed: it mints a JWT from JWT_SECRET).
//   node scripts/smoke.js --user 1 [--url http://localhost:3005] [--chat 5] [--token <real jwt>]
// Without --chat it only checks auth + REST + socket connect. With --chat it also sends a message, then
// typing / delivered / read / delete over the socket and waits for the `team_chat` / `team_typing` events.
require('dotenv/config');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const url = (arg('url', `http://localhost:${process.env.PORT || 3005}`)).replace(/\/$/, '');
const user = arg('user'); const chat = arg('chat');
const token = arg('token') || (user && jwt.sign({ sub: String(user) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' }));
if (!token) { console.error('Need --user <id> (or --token <jwt>)'); process.exit(1); }

const ok = (m) => console.log('  ✓', m); const bad = (m) => { console.log('  ✗', m); process.exitCode = 1; };
const rest = async (path, opt = {}) => {
  const r = await fetch(url + '/api' + path, { ...opt, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opt.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const call = (s, ev, data) => new Promise((res) => s.timeout(5000).emit(ev, data, (err, ack) => res(err ? { ok: false, error: 'timeout' } : ack)));

(async () => {
  console.log(`chat-server @ ${url}`);
  const h = await rest('/health', { headers: { authorization: '' } });
  h.status === 200 ? ok('health') : bad(`health ${h.status}`);
  (await rest('/team-chat/chats', { headers: { authorization: 'Bearer nope' } })).status === 401 ? ok('bad token → 401') : bad('bad token was accepted!');

  const chats = await rest('/team-chat/chats');
  chats.status === 200 ? ok(`REST chats (${(chats.body?.data ?? chats.body ?? []).length ?? '?'})`) : bad(`REST chats ${chats.status} ${JSON.stringify(chats.body)}`);

  const noTok = io(url + '/staff', { transports: ['websocket'], reconnection: false });
  await new Promise((r) => { noTok.on('disconnect', () => { ok('socket without token is rejected'); r(); }); noTok.on('connect_error', r); setTimeout(r, 3000); });

  const s = io(url + '/staff', { transports: ['websocket'], auth: { token }, reconnection: false });
  const events = [];
  ['team_chat', 'team_typing', 'staff_online_ack'].forEach((e) => s.on(e, (d) => events.push([e, d])));
  await new Promise((r, j) => { s.on('connect', r); s.on('connect_error', (e) => j(e)); setTimeout(() => j(new Error('connect timeout')), 5000); })
    .then(() => ok('socket connected with JWT')).catch((e) => bad('socket: ' + e.message));
  await new Promise((r) => setTimeout(r, 500));
  events.some(([e]) => e === 'staff_online_ack') ? ok('staff_online_ack received') : bad('no staff_online_ack (inactive user / bad token?)');

  if (chat && s.connected) {
    const cid = Number(chat); const client_id = 'smoke-' + Date.now();
    const sent = await call(s, 'chat:send', { chat_id: cid, body: 'smoke test ' + new Date().toISOString(), client_id });
    sent.ok ? ok(`chat:send → message ${sent.message.id}`) : bad('chat:send ' + sent.error);
    const dup = await call(s, 'chat:send', { chat_id: cid, body: 'dup', client_id });
    sent.ok && dup.ok && dup.message.id === sent.message.id ? ok('same client_id is de-duplicated') : bad('client_id dedupe failed');
    s.emit('team_typing', { chat_id: cid, typing: true }); ok('team_typing emitted (other members see it)');
    (await call(s, 'chat:delivered', { chat_id: cid })).ok ? ok('chat:delivered') : bad('chat:delivered');
    (await call(s, 'chat:read', { chat_id: cid })).ok ? ok('chat:read') : bad('chat:read');
    if (sent.ok) (await call(s, 'chat:delete', { message_id: sent.message.id, scope: 'everyone' })).ok ? ok('chat:delete') : bad('chat:delete');
    const spoof = await call(s, 'chat:send', { chat_id: 999999999, body: 'x' });
    !spoof.ok ? ok('send to a chat you are not in is refused') : bad('SECURITY: sent into a foreign chat');
    await new Promise((r) => setTimeout(r, 800));
    console.log('  events seen on this device:', events.filter(([e]) => e === 'team_chat').map(([, d]) => d.kind).join(', ') || 'none');
  }
  s.close(); process.exit(process.exitCode || 0);
})();
