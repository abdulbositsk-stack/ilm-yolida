import assert from 'node:assert/strict';
import { createBot, telegramApi } from '../server/telegram-bot.mjs';

process.env.TELEGRAM_CHANNEL = '@ilmm_yolida';
process.env.TELEGRAM_ADMIN_IDS = '999';
const TOKEN = '123456:TESTTOKEN';
const BOT_ID = 123456;

const data = new Map();
const store = {
  async get(k) { return data.has(k) ? structuredClone(data.get(k)) : null; },
  async setJSON(k, v, o = {}) { if (o.onlyIfNew && data.has(k)) return { modified: false }; data.set(k, structuredClone(v)); return { modified: true }; },
  async delete(k) { data.delete(k); },
  async *list() { yield { blobs: [...data.keys()].map(key => ({ key })) }; },
};

const channelMembers = new Set([1]); // 1 = taklif qiluvchi
const sent = [], calls = []; let n = 0;
const call = async (method, params = {}) => {
  calls.push([method, params]);
  if (method === 'getChatMember') {
    if (params.user_id === BOT_ID) return { status: 'administrator', can_invite_users: true };
    return { status: channelMembers.has(params.user_id) ? 'member' : 'left' };
  }
  if (method === 'createChatInviteLink') return { invite_link: `https://t.me/+${params.name}-${++n}`, name: params.name, creator: { id: BOT_ID } };
  if (method === 'sendMessage') { sent.push(params); return { message_id: sent.length }; }
  if (method === 'getMe') return { id: BOT_ID, username: 'IlmMutolaaBot' };
  if (method === 'getWebhookInfo') return { url: 'https://x/api/telegram', pending_update_count: 0 };
  return true;
};
const bot = createBot({ store, call, token: TOKEN, now: () => 1_800_000_000_000 });
const lastTo = id => [...sent].reverse().find(m => m.chat_id === id);
const GROUP = '-1001234567890';
await store.setJSON('config', { groupId: GROUP });

const channelChat = { id: -100777, type: 'channel', username: 'ilmm_yolida' };
const join = (userId, inviteName, extra = {}) => bot.handleUpdate({ chat_member: { chat: channelChat, old_chat_member: { status: 'left', user: { id: userId } }, new_chat_member: { status: 'member', user: { id: userId, first_name: 'Do‘st' + userId } }, ...(inviteName ? { invite_link: { name: inviteName, creator: { id: BOT_ID }, invite_link: 'x' } } : {}), ...extra } });
const leave = userId => bot.handleUpdate({ chat_member: { chat: channelChat, old_chat_member: { status: 'member', user: { id: userId } }, new_chat_member: { status: 'left', user: { id: userId, first_name: 'Do‘st' } } } });
const say = (from, text) => bot.handleUpdate({ message: { chat: { id: from, type: 'private' }, from: { id: from, first_name: 'Ali' }, text } });

// 1) Kanalga a'zo bo'lmagan odam havola olmaydi
await say(2, '/start');
assert.match(lastTo(2).text, /obuna bo‘ling/);
assert.equal(calls.filter(c => c[0] === 'createChatInviteLink').length, 0);

// 2) A'zo bo'lgan odam shaxsiy havola oladi
await say(1, '/start');
assert.match(lastTo(1).text, /t\.me\/\+ref-1-/);
const link1 = (await store.get('user-1')).link;
await say(1, '/start');
assert.equal((await store.get('user-1')).link, link1, 'havola qayta yaratilmaydi');
assert.equal(calls.filter(c => c[0] === 'createChatInviteLink').length, 1);

// 3) Havolasiz yoki begona havola bilan qo'shilish sanalmaydi
await join(50, null);
await join(51, 'ref-99');           // mavjud bo'lmagan taklif qiluvchi
await join(1, 'ref-1');             // o'zini o'zi taklif qilish
assert.equal(Object.keys((await store.get('user-1')).invitees).length, 0);
// begona (bot yaratmagan) havola
await bot.handleUpdate({ chat_member: { chat: channelChat, old_chat_member: { status: 'left', user: { id: 52 } }, new_chat_member: { status: 'member', user: { id: 52, first_name: 'X' } }, invite_link: { name: 'ref-1', creator: { id: 4242 } } } });
assert.equal(Object.keys((await store.get('user-1')).invitees).length, 0, 'boshqa admin yaratgan havola hisoblanmaydi');

// 4) 4 ta do'st, takror qo'shilish ikki marta sanalmaydi
for (const id of [11, 12, 13, 14]) await join(id, 'ref-1');
await join(11, 'ref-1');
assert.equal(Object.values((await store.get('user-1')).invitees).filter(Boolean).length, 4);
assert.match(lastTo(1).text, /4\/5/);
assert.equal((await store.get('user-1')).rewarded, false);

// 5) Do'st chiqib ketsa kamayadi, qaytsa yana ko'payadi (boshqa havola bilan ham)
await leave(14);
assert.equal(Object.values((await store.get('user-1')).invitees).filter(Boolean).length, 3);
await join(14, 'ref-777');          // boshqa odam havolasi: birinchi taklif qiluvchiga qaytadi
assert.equal(Object.values((await store.get('user-1')).invitees).filter(Boolean).length, 4);

// 6) 5-do'st -> avtomatik guruh havolasi (bir martalik, 48 soat)
await join(15, 'ref-1');
const user1 = await store.get('user-1');
assert.equal(user1.rewarded, true);
assert.match(lastTo(1).text, /bir martalik/);
const groupCall = calls.filter(c => c[0] === 'createChatInviteLink' && c[1].chat_id === GROUP).pop()[1];
assert.equal(groupCall.member_limit, 1);
assert.equal(groupCall.expire_date, 1_800_000_000 + 48 * 3600);

// 7) 5 ta bo'lmagan odam guruh havolasini ololmaydi
channelMembers.add(3); await say(3, '/start'); await join(60, 'ref-3'); await say(3, '/guruh');
assert.match(lastTo(3).text, /1\/5/);
assert.equal(calls.filter(c => c[0] === 'createChatInviteLink' && c[1].chat_id === GROUP).length, 1);

// 8) /guruh qayta bosilsa eski havola bekor qilinib yangisi beriladi
await say(1, '/guruh');
assert.ok(calls.some(c => c[0] === 'revokeChatInviteLink'));
assert.equal(calls.filter(c => c[0] === 'createChatInviteLink' && c[1].chat_id === GROUP).length, 2);

// 9) Guruhga kirgach "allaqachon guruhdasiz"
await bot.handleUpdate({ chat_member: { chat: { id: Number(GROUP), type: 'supergroup' }, old_chat_member: { status: 'left' }, new_chat_member: { status: 'member', user: { id: 1 } } } });
await say(1, '/guruh');
assert.match(lastTo(1).text, /allaqachon/);

// 10) Kanaldan chiqib ketgan odam guruh havolasini ololmaydi
channelMembers.add(4); await say(4, '/start');
for (const id of [71, 72, 73, 74, 75]) await join(id, 'ref-4');
const before4 = calls.filter(c => c[0] === 'createChatInviteLink' && c[1].chat_id === GROUP).length;
assert.ok((await store.get('user-4')).rewarded, 'avtomatik mukofot');
channelMembers.delete(4); await store.setJSON('user-4', { ...(await store.get('user-4')), inGroup: false });
await say(4, '/guruh');
assert.match(lastTo(4).text, /chiqib ketgansiz/);
assert.equal(calls.filter(c => c[0] === 'createChatInviteLink' && c[1].chat_id === GROUP).length, before4);

// 11) /stat faqat adminga
await say(5, '/stat'); assert.doesNotMatch(lastTo(5).text, /Statistika/);
await say(999, '/stat'); assert.match(lastTo(999).text, /Statistika/);

// 12) Guruh sozlanmagan bo'lsa
await store.delete('config');
channelMembers.add(8); await say(8, '/start');
for (const id of [81, 82, 83, 84, 85]) await join(id, 'ref-8');
assert.match(lastTo(8).text, /sozlanmagan/);

// ---- HTTP qatlami ----
const req = (method, headers = {}, body) => new Request('https://site.test/api/telegram', { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
const secret = (await import('node:crypto')).createHash('sha256').update('ilm-yolida-webhook:' + TOKEN).digest('hex').slice(0, 48);
const api = r => telegramApi(r, { store, call, token: TOKEN, adminKey: 'admin-key-123' });
assert.equal((await api(req('GET'))).status, 200);
assert.equal((await (await api(req('GET'))).json()).bot, 'IlmMutolaaBot');
assert.equal((await api(req('POST', { 'x-telegram-bot-api-secret-token': 'wrong' }, {}))).status, 401, 'webhook maxfiy kalitsiz kirmaydi');
assert.equal((await api(req('POST', { 'x-telegram-bot-api-secret-token': secret }, { message: { chat: { id: 1, type: 'private' }, from: { id: 1, first_name: 'A' }, text: '/yordam' } }))).status, 200);
assert.equal((await api(req('POST', {}, { action: 'info' }))).status, 401, 'adminsiz sozlash mumkin emas');
const setup = await api(req('POST', { 'x-admin-key': 'admin-key-123' }, { action: 'setup' }));
assert.equal((await setup.json()).url, 'https://site.test/api/telegram');
const setHook = calls.filter(c => c[0] === 'setWebhook').pop()[1];
assert.equal(setHook.secret_token, secret);
assert.ok(setHook.allowed_updates.includes('chat_member'));
const info = await (await api(req('POST', { 'x-admin-key': 'admin-key-123' }, { action: 'info' }))).json();
assert.equal(info.channel.ok, true);
assert.equal((await api(req('POST', { 'x-admin-key': 'admin-key-123' }, { action: 'set-group', chatId: 'abc' }))).status, 400);
assert.equal((await (await api(req('POST', { 'x-admin-key': 'admin-key-123' }, { action: 'set-group', chatId: GROUP }))).json()).groupId, GROUP);
assert.equal((await telegramApi(req('POST'), { store, call, token: '' })).status, 503);

console.log('telegram-bot: OK');
