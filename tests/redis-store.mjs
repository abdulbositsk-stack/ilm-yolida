import assert from 'node:assert/strict';
import { redisStore } from '../server/blob-store.mjs';
import { createBot } from '../server/telegram-bot.mjs';

// Upstash REST ning minimal taqlidi: POST [buyruq, ...argumentlar] -> { result }
const data = new Map();
const calls = [];
const fakeFetch = async (url, init) => {
  assert.match(init.headers.Authorization, /^Bearer tok$/);
  const [command, ...a] = JSON.parse(init.body);
  calls.push(command);
  let result;
  switch (command) {
    case 'GET': result = data.has(a[0]) ? data.get(a[0]) : null; break;
    case 'SET': if (a[2] === 'NX' && data.has(a[0])) result = null; else { data.set(a[0], a[1]); result = 'OK'; } break;
    case 'DEL': result = data.delete(a[0]) ? 1 : 0; break;
    case 'SCAN': { const pre = a[2].replace(/\*$/, ''); result = ['0', [...data.keys()].filter(x => x.startsWith(pre))]; break; }
    case 'MGET': result = a.map(x => data.get(x) ?? null); break;
    default: return { ok: false, status: 400, json: async () => ({ error: 'unknown ' + command }) };
  }
  return { ok: true, status: 200, json: async () => ({ result }) };
};
const store = redisStore('telegram', { url: 'https://x', token: 'tok' }, fakeFetch);

assert.equal(await store.get('a'), null);
assert.deepEqual(await store.setJSON('a', { n: 1 }), { modified: true });
assert.deepEqual(await store.get('a'), { n: 1 });
assert.deepEqual(await store.setJSON('a', { n: 2 }, { onlyIfNew: true }), { modified: false });
assert.deepEqual(await store.get('a'), { n: 1 });
await store.setJSON('job/b', { x: 1 }, { metadata: { expiresAt: 5 } });
const keys = []; for await (const page of store.list()) keys.push(...page.blobs.map(b => b.key));
assert.deepEqual(keys.sort(), ['a', 'job/b']);
const meta = []; for await (const page of store.list({ metadata: true })) meta.push(...page.blobs);
assert.equal(meta.find(b => b.key === 'job/b').metadata.expiresAt, 5);
await store.delete('a'); assert.equal(await store.get('a'), null);

// Bot shu ombor bilan ishlaydi
process.env.TELEGRAM_BOT_TOKEN = '123:abc'; process.env.TELEGRAM_CHANNEL = '@ch';
const sent = [];
const call = async (m, p) => { if (m === 'sendMessage') { sent.push(p.text); return {}; } if (m === 'createChatInviteLink') return { invite_link: 'https://t.me/+abc' }; if (m === 'getChatMember') return { status: 'member' }; return {}; };
const bot = createBot({ store, call, token: '123:abc', now: () => Date.now(), sleep: async () => {} });
await bot.handleUpdate({ message: { chat: { id: 7, type: 'private' }, from: { id: 7, first_name: 'Ali' }, text: '/start' } });
assert.ok(sent.some(t => t.includes('https://t.me/+abc')));
await bot.handleUpdate({ message: { chat: { id: 7, type: 'private' }, from: { id: 7, first_name: 'Ali' }, text: '🏆 Reyting' } });
assert.ok(data.has('ilm-yolida:telegram:user-7') && data.has('ilm-yolida:telegram:board'));
console.log('redis-store: OK');
