// Ilm Yo'lida | Mutolaa: Telegram bot (Vercel webhook).
// Ishtirokchi botga /start bosadi -> kanal (@ilmm_yolida) uchun shaxsiy taklif havolasi oladi.
// 5 ta do'sti shu havola orqali kanalga qo'shilsa -> bot maxsus guruh uchun bir martalik havola yuboradi.
// Kerakli env: TELEGRAM_BOT_TOKEN. Ixtiyoriy: TELEGRAM_CHANNEL, TELEGRAM_GROUP_ID, TELEGRAM_INVITE_TARGET,
// TELEGRAM_ADMIN_IDS (vergul bilan), ADMIN_KEY (sozlash sahifasi uchun).
import { createHash, timingSafeEqual } from 'node:crypto';

const TG_API = 'https://api.telegram.org';
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const MEMBER = new Set(['member', 'administrator', 'creator']);
const ALLOWED_UPDATES = ['message', 'callback_query', 'chat_member', 'my_chat_member'];
const SUPPORT = '@abdulbasit_sk';

const isLocalDev = () => process.env.ILM_LOCAL_DEV === 'true';
const channelName = () => process.env.TELEGRAM_CHANNEL || '@ilmm_yolida';
const channelUrl = () => `https://t.me/${channelName().replace(/^@/, '')}`;
const target = () => Math.max(1, Math.floor(Number(process.env.TELEGRAM_INVITE_TARGET)) || 5);
const adminIds = () => String(process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
const botToken = () => process.env.TELEGRAM_BOT_TOKEN || '';
const botIdOf = token => String(token).split(':')[0];
const webhookSecret = token => createHash('sha256').update('ilm-yolida-webhook:' + token).digest('hex').slice(0, 48);
const html = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function sameSecret(given, expected) {
  const a = createHash('sha256').update(String(given || '')).digest();
  const b = createHash('sha256').update(String(expected || '')).digest();
  return timingSafeEqual(a, b);
}

const localData = new Map();
const localStore = {
  async get(key) { return localData.has(key) ? structuredClone(localData.get(key)) : null; },
  async setJSON(key, value, options = {}) {
    if (options.onlyIfNew && localData.has(key)) return { modified: false };
    localData.set(key, structuredClone(value));
    return { modified: true };
  },
  async delete(key) { localData.delete(key); },
  async *list() { yield { blobs: [...localData.keys()].map(key => ({ key })) }; },
};

async function openStore() {
  if (isLocalDev()) return localStore;
  const { persistentStore } = await import('./blob-store.mjs');
  return persistentStore('telegram');
}

/** Telegram Bot API chaqiruvi. Xatoda description bilan Error tashlaydi. */
export function makeCaller(token = botToken(), fetchImpl = fetch) {
  return async (method, params = {}) => {
    if (!token) throw Object.assign(new Error('TELEGRAM_BOT_TOKEN sozlanmagan'), { code: 0 });
    const response = await fetchImpl(`${TG_API}/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => ({}));
    if (!data.ok) throw Object.assign(new Error(data.description || `Telegram xatosi (${response.status})`), { code: data.error_code || response.status });
    return data.result;
  };
}

/* ---------- matnlar ---------- */
const bar = (n, total) => '▰'.repeat(Math.min(n, total)) + '▱'.repeat(Math.max(0, total - n));
const countOf = user => Object.values(user.invitees || {}).filter(Boolean).length;

const T = {
  needChannel: () => `📚 <b>Ilm Yo‘lida | Mutolaa</b>\n\nMaxsus guruhga kirish uchun avval <b>${html(channelName())}</b> kanaliga obuna bo‘ling, so‘ng <b>«Obuna bo‘ldim»</b> tugmasini bosing.`,
  welcome: (user, link) => `📚 <b>Ilm Yo‘lida | Mutolaa</b>\n\nAssalomu alaykum, <b>${html(user.first || 'do‘st')}</b>!\n\nMaxsus mutolaa guruhiga kirish uchun <b>${target()} ta do‘stingizni</b> ${html(channelName())} kanaliga taklif qiling.\n\n<b>Qanday ishlaydi?</b>\n1️⃣ Pastdagi <b>shaxsiy havolangizni</b> do‘stlaringizga yuboring.\n2️⃣ Ular shu havola orqali kanalga qo‘shiladi.\n3️⃣ ${target()} ta do‘st qo‘shilgach, bot sizga guruh havolasini yuboradi.\n\n🔗 <b>Sizning havolangiz:</b>\n${html(link)}\n\n${T.progress(countOf(user))}`,
  progress: n => `📊 <b>Natija:</b> ${bar(n, target())}  <b>${Math.min(n, target())}/${target()}</b>\n${n >= target() ? '🎉 Tayyor! «Guruhga kirish» tugmasini bosing.' : `Yana <b>${target() - n} ta</b> do‘st qoldi.`}`,
  joined: (name, n) => `✅ <b>${html(name)}</b> kanalga qo‘shildi!\n\n${T.progress(n)}`,
  reward: link => `🎉 <b>Tabriklaymiz!</b> ${target()} ta do‘stingiz qo‘shildi.\n\nMaxsus guruh havolasi (faqat siz uchun, bir martalik):\n${html(link)}\n\n⏳ Havola 48 soat amal qiladi. Muddati o‘tsa, «Guruhga kirish» tugmasini qayta bosing.`,
  alreadyIn: () => '✅ Siz allaqachon maxsus guruhdasiz. Mutolaadan zavq oling! 📖',
  groupMissing: () => `⚙️ Maxsus guruh hali sozlanmagan. Iltimos, ${SUPPORT} ga yozing.`,
  notMember: () => `⚠️ Siz ${html(channelName())} kanalidan chiqib ketgansiz. Avval kanalga qayting, so‘ng urinib ko‘ring.`,
  busy: () => `⏳ Bot hozir sozlanmoqda. Birozdan so‘ng qayta urinib ko‘ring yoki ${SUPPORT} ga yozing.`,
  help: () => `ℹ️ <b>Yordam</b>\n\n/start — shaxsiy havolangizni olish\n/holat — nechta do‘st qo‘shilganini ko‘rish\n/guruh — maxsus guruhga kirish\n/reyting — eng faol ishtirokchilar\n\nSavollar bo‘lsa: ${SUPPORT}`,
  menuReady: () => '👇 Menyu tayyor. Pastdagi tugmalardan foydalaning.',
  top: (rows, me) => `🏆 <b>Eng faol ishtirokchilar</b>\n\n${rows.length ? rows.map((r, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} ${html(r.first || 'Ishtirokchi')} — <b>${r.n}</b> ta do‘st`).join('\n') : 'Hali hech kim do‘st taklif qilmagan. Birinchi bo‘ling! 🚀'}${me ? `\n\n📍 Sizning o‘rningiz: <b>${me.rank}</b> (${me.n} ta do‘st)` : ''}`,
  groupSaved: title => `✅ Bu guruh (<b>${html(title)}</b>) maxsus mutolaa guruhi sifatida saqlandi.`,
  groupWelcome: name => `🎉 Xush kelibsiz, <b>${html(name)}</b>! Siz ${target()} ta do‘st taklif qilib, maxsus mutolaa guruhiga kirdingiz. Har kuni o‘qing va xulosangizni shu yerda ulashing 📖`,
  noRights: () => '⛔ Bu buyruq faqat guruh adminlari uchun.',
};

const keyboard = (rows) => ({ inline_keyboard: rows });
const MENU = { status: '📊 Holatim', link: '🔗 Havolam', group: '👥 Guruhga kirish', top: '🏆 Reyting', help: 'ℹ️ Yordam' };
const menuMarkup = () => ({ keyboard: [[{ text: MENU.status }, { text: MENU.link }], [{ text: MENU.group }, { text: MENU.top }], [{ text: MENU.help }]], resize_keyboard: true, is_persistent: true });
const shareUrl = link => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('📚 Ilm Yo‘lida | Mutolaa — bepul 15 kunlik challenge. Kanalga qo‘shiling:')}`;
const mainButtons = (link, n) => keyboard([
  [{ text: '📤 Do‘stlarga ulashish', url: shareUrl(link) }],
  [{ text: '📊 Holatim', callback_data: 'status' }, { text: n >= target() ? '👥 Guruhga kirish' : '👥 Guruh', callback_data: 'group' }],
]);

/* ---------- asosiy mantiq ---------- */
export function createBot({ store, call, token = botToken(), now = () => Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  const botId = botIdOf(token);
  const userKey = id => `user-${id}`;
  const getUser = id => store.get(userKey(id));
  const saveUser = user => store.setJSON(userKey(user.id), user);

  /** Reyting jadvali bitta faylda saqlanadi, shuning uchun reyting/statistika uchun hamma foydalanuvchini o'qimaymiz. */
  async function loadBoard() {
    const saved = await store.get('board');
    if (saved && saved.rows) return saved;
    const rows = {};                                   // birinchi marta: mavjud foydalanuvchilardan bir martalik yig'ish
    for await (const page of store.list()) for (const blob of page.blobs) {
      if (!blob.key.startsWith('user-')) continue;
      const u = await store.get(blob.key);
      if (u) rows[u.id] = { first: u.first || '', n: countOf(u), r: !!u.rewarded, g: !!u.inGroup };
    }
    const board = { rows };
    await store.setJSON('board', board);
    return board;
  }
  async function updateBoard(user) {
    const board = await loadBoard();
    const row = { first: user.first || '', n: countOf(user), r: !!user.rewarded, g: !!user.inGroup };
    const old = board.rows[user.id];
    if (!row.n && !row.r && !row.g) { if (!old) return; delete board.rows[user.id]; }
    else if (old && old.first === row.first && old.n === row.n && old.r === row.r && old.g === row.g) return;
    else board.rows[user.id] = row;
    await store.setJSON('board', board);
  }
  const safeSend = async (chatId, text, extra = {}) => {
    try { return await call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }); }
    catch (error) { if (error.code !== 403 && error.code !== 400) console.error('[telegram] sendMessage', error.message); return null; }
  };
  const notifyAdmins = text => Promise.all(adminIds().map(id => safeSend(id, `⚠️ ${html(text)}`)));

  const isChannelChat = chat => !!chat && chat.type === 'channel' && (
    (chat.username && `@${chat.username}`.toLowerCase() === channelName().toLowerCase()) || String(chat.id) === channelName());
  const getGroupId = async () => (await store.get('config'))?.groupId || process.env.TELEGRAM_GROUP_ID || '';

  async function isChannelMember(userId) {
    try {
      const m = await call('getChatMember', { chat_id: channelName(), user_id: userId });
      return MEMBER.has(m.status) || (m.status === 'restricted' && m.is_member === true);
    } catch { return false; }
  }

  async function upsertUser(from) {
    const existing = await getUser(from.id);
    const user = existing || { id: from.id, invitees: {}, rewarded: false, inGroup: false, createdAt: new Date(now()).toISOString() };
    const first = String(from.first_name || '').slice(0, 60), username = from.username || '';
    const changed = !existing || user.first !== first || user.username !== username;
    user.first = first; user.username = username;
    if (changed) await saveUser(user);   // har xabarda yozmaymiz: Blob limiti tejaladi
    return user;
  }

  async function ensureLink(user) {
    if (user.link) return user.link;
    const created = await call('createChatInviteLink', { chat_id: channelName(), name: `ref-${user.id}` });
    user.link = created.invite_link;
    await saveUser(user);
    return user.link;
  }

  async function sendLinkMessage(chatId, from) {
    const user = await upsertUser(from);
    if (!(await isChannelMember(from.id))) {
      return safeSend(chatId, T.needChannel(), { reply_markup: keyboard([[{ text: `📢 ${channelName()} kanaliga o‘tish`, url: channelUrl() }], [{ text: '✅ Obuna bo‘ldim', callback_data: 'link' }]]) });
    }
    let link;
    try { link = await ensureLink(user); }
    catch (error) { console.error('[telegram] createChatInviteLink', error.message); await notifyAdmins(`Taklif havolasi yaratilmadi: ${error.message}. Bot kanalda admin va «Foydalanuvchilarni taklif qilish» huquqiga egami?`); return safeSend(chatId, T.busy()); }
    return safeSend(chatId, T.welcome(user, link), { reply_markup: mainButtons(link, countOf(user)) });
  }

  async function sendStatus(chatId, from) {
    const user = await getUser(from.id);
    if (!user || !user.link) return sendLinkMessage(chatId, from);
    return safeSend(chatId, T.progress(countOf(user)), { reply_markup: mainButtons(user.link, countOf(user)) });
  }

  /** Maxsus guruh uchun bir martalik havola yaratib yuboradi (yetarli do'st bo'lsa). */
  async function sendGroupLink(chatId, from) {
    const user = await getUser(from.id);
    if (!user || !user.link) return sendLinkMessage(chatId, from);
    const n = countOf(user);
    if (n < target()) return safeSend(chatId, T.progress(n), { reply_markup: mainButtons(user.link, n) });
    if (user.inGroup) return safeSend(chatId, T.alreadyIn());
    const groupId = await getGroupId();
    if (!groupId) { await notifyAdmins('Maxsus guruh sozlanmagan, lekin kimdir 5 ta do‘st yig‘di. Sozlash sahifasidan guruhni tanlang.'); return safeSend(chatId, T.groupMissing()); }
    if (!(await isChannelMember(from.id))) return safeSend(chatId, T.notMember(), { reply_markup: keyboard([[{ text: `📢 ${channelName()}`, url: channelUrl() }]]) });
    if (user.groupLink) { try { await call('revokeChatInviteLink', { chat_id: groupId, invite_link: user.groupLink }); } catch { /* eskisi allaqachon ishlatilgan bo'lishi mumkin */ } }
    try {
      const created = await call('createChatInviteLink', { chat_id: groupId, member_limit: 1, expire_date: Math.floor(now() / 1000) + 48 * 3600, name: `grp-${user.id}` });
      user.groupLink = created.invite_link; user.rewarded = true; user.groupLinkAt = new Date(now()).toISOString();
      await saveUser(user); await updateBoard(user);
      return safeSend(chatId, T.reward(created.invite_link), { reply_markup: keyboard([[{ text: '👥 Maxsus guruhga kirish', url: created.invite_link }]]) });
    } catch (error) {
      console.error('[telegram] group link', error.message);
      await notifyAdmins(`Guruh havolasi yaratilmadi: ${error.message}. Bot guruhda admin va «Foydalanuvchilarni taklif qilish» huquqiga egami?`);
      return safeSend(chatId, T.busy());
    }
  }

  async function sendStats(chatId) {
    let users = 0;
    for await (const page of store.list()) for (const blob of page.blobs) if (blob.key.startsWith('user-')) users++;
    const rows = Object.values((await loadBoard()).rows);
    const active = rows.reduce((sum, r) => sum + r.n, 0), rewarded = rows.filter(r => r.r).length, inGroup = rows.filter(r => r.g).length;
    return safeSend(chatId, `📈 <b>Statistika</b>\n\nIshtirokchilar: <b>${users}</b>\nTaklif orqali kirganlar (hozir kanalda): <b>${active}</b>\nGuruh havolasi olganlar: <b>${rewarded}</b>\nGuruhga kirganlar: <b>${inGroup}</b>`);
  }

  async function topList() {
    const board = await loadBoard();
    const rows = Object.entries(board.rows).map(([id, r]) => ({ id: Number(id), first: r.first, n: r.n }));
    rows.sort((a, b) => b.n - a.n);
    return { rows, ranked: rows.filter(r => r.n > 0) };
  }

  async function sendTop(chatId, from) {
    const { rows, ranked } = await topList();
    const index = ranked.findIndex(r => r.id === from.id);
    return safeSend(chatId, T.top(ranked.slice(0, 10), index >= 0 ? { rank: index + 1, n: ranked[index].n } : null));
  }

  async function broadcast(chatId, text) {
    if (!text) return safeSend(chatId, 'Foydalanish: <code>/xabar Matn…</code>');
    const ids = [];
    for await (const page of store.list()) for (const blob of page.blobs) if (blob.key.startsWith('user-')) ids.push(blob.key.slice(5));
    let ok = 0;
    for (let i = 0; i < ids.length && i < 1500; i += 25) {
      const results = await Promise.all(ids.slice(i, i + 25).map(id => safeSend(id, html(text))));
      ok += results.filter(Boolean).length;
      if (i + 25 < ids.length) await sleep(1000);
    }
    return safeSend(chatId, `📣 Xabar yuborildi: <b>${ok}</b> / ${Math.min(ids.length, 1500)}`);
  }

  async function onGroupMessage(message) {
    const command = String(message.text || '').trim().split(/[\s@]/)[0].toLowerCase();
    if (command !== '/setgroup' || !message.from) return;
    let admin = false;
    try { const m = await call('getChatMember', { chat_id: message.chat.id, user_id: message.from.id }); admin = m.status === 'creator' || m.status === 'administrator'; } catch { admin = false; }
    if (!admin) return safeSend(message.chat.id, T.noRights());
    await store.setJSON('config', { ...((await store.get('config')) || {}), groupId: String(message.chat.id) });
    return safeSend(message.chat.id, T.groupSaved(message.chat.title || 'guruh'));
  }

  async function onMessage(message) {
    if (message.chat && (message.chat.type === 'group' || message.chat.type === 'supergroup')) return onGroupMessage(message);
    if (message.chat?.type !== 'private' || !message.from || message.from.is_bot) return;
    const raw = String(message.text || '').trim();
    const command = raw.split(/[\s@]/)[0].toLowerCase();
    if (raw === MENU.status) return sendStatus(message.chat.id, message.from);
    if (raw === MENU.link) return sendLinkMessage(message.chat.id, message.from);
    if (raw === MENU.group) return sendGroupLink(message.chat.id, message.from);
    if (raw === MENU.top) return sendTop(message.chat.id, message.from);
    if (raw === MENU.help) return safeSend(message.chat.id, T.help());
    if (command === '/reyting') return sendTop(message.chat.id, message.from);
    if (command === '/xabar' && adminIds().includes(String(message.from.id))) return broadcast(message.chat.id, raw.replace(/^\/xabar(@\w+)?\s*/i, '').trim());
    if (command === '/start') { await safeSend(message.chat.id, T.menuReady(), { reply_markup: menuMarkup() }); return sendLinkMessage(message.chat.id, message.from); }
    if (command === '/holat') return sendStatus(message.chat.id, message.from);
    if (command === '/guruh') return sendGroupLink(message.chat.id, message.from);
    if (command === '/yordam' || command === '/help') return safeSend(message.chat.id, T.help());
    if (command === '/stat' && adminIds().includes(String(message.from.id))) return sendStats(message.chat.id);
    return safeSend(message.chat.id, T.help());
  }

  async function onCallback(query) {
    const from = query.from, chatId = query.message?.chat?.id || from.id;
    try { await call('answerCallbackQuery', { callback_query_id: query.id }); } catch { /* eskirgan tugma */ }
    if (query.data === 'status') return sendStatus(chatId, from);
    if (query.data === 'group') return sendGroupLink(chatId, from);
    if (query.data === 'link') return sendLinkMessage(chatId, from);
  }

  /** Kanalga qo'shilish / chiqish. Faqat BOT yaratgan "ref-<id>" havolalari hisoblanadi. */
  async function onChannelMember(update) {
    const { old_chat_member: before, new_chat_member: after, invite_link: invite } = update;
    const wasIn = !!before && (MEMBER.has(before.status) || (before.status === 'restricted' && before.is_member));
    const isIn = MEMBER.has(after.status) || (after.status === 'restricted' && after.is_member);
    const invitee = after.user;
    if (!invitee || invitee.is_bot) return;

    console.log('[telegram] kanal a\'zoligi', JSON.stringify({ user: invitee.id, before: before?.status, after: after.status, link: invite ? { name: invite.name, creator: invite.creator?.id, hasLink: !!invite.invite_link } : null }));
    if (!wasIn && isIn) {
      const fromBot = invite && String(invite.creator?.id) === botId;
      const match = fromBot && /^ref-(\d+)$/.exec(invite.name || '');
      const record = await store.get(`inv-${invitee.id}`);
      let inviterId = match ? Number(match[1]) : null;
      if (record) inviterId = record.inviter;              // bir odam faqat birinchi taklif qilgan kishiga hisoblanadi
      else if (inviterId && inviterId !== invitee.id) {
        const saved = await store.setJSON(`inv-${invitee.id}`, { inviter: inviterId, at: new Date(now()).toISOString() }, { onlyIfNew: true });
        if (!saved.modified) inviterId = (await store.get(`inv-${invitee.id}`))?.inviter ?? null;
      } else inviterId = null;                              // havolasiz yoki o'zini o'zi taklif qilgan
      console.log('[telegram] taklif qiluvchi', JSON.stringify({ inviterId, hadRecord: !!record, fromBot: !!fromBot }));
      if (!inviterId || inviterId === invitee.id) return;
      const inviter = await getUser(inviterId);
      if (!inviter) { console.log('[telegram] taklif qiluvchi topilmadi', inviterId); return; }
      inviter.invitees = inviter.invitees || {};
      const already = inviter.invitees[invitee.id] === true;
      inviter.invitees[invitee.id] = true;
      await saveUser(inviter); await updateBoard(inviter);
      if (already) return;
      const n = countOf(inviter);
      await safeSend(inviterId, T.joined(invitee.first_name || 'Do‘stingiz', n), { reply_markup: mainButtons(inviter.link || channelUrl(), n) });
      if (n >= target() && !inviter.rewarded) await sendGroupLink(inviterId, { id: inviterId, first_name: inviter.first, username: inviter.username });
    } else if (wasIn && !isIn) {
      const record = await store.get(`inv-${invitee.id}`);
      if (!record) return;
      const inviter = await getUser(record.inviter);
      if (inviter?.invitees?.[invitee.id]) { inviter.invitees[invitee.id] = false; await saveUser(inviter); await updateBoard(inviter); }
    }
  }

  async function onGroupMember(update) {
    const after = update.new_chat_member;
    if (!after?.user || after.user.is_bot) return;
    const user = await getUser(after.user.id);
    if (!user) return;
    const isIn = MEMBER.has(after.status) || (after.status === 'restricted' && after.is_member);
    if (user.inGroup !== isIn) {
      user.inGroup = isIn; await saveUser(user); await updateBoard(user);
      if (isIn) await safeSend(update.chat.id, T.groupWelcome(user.first || after.user.first_name || 'do‘st'));
    }
  }

  async function onMyChatMember(update) {
    const chat = update.chat; if (!chat) return;
    const status = update.new_chat_member?.status;
    if (MEMBER.has(status)) await store.setJSON(`chat-${chat.id}`, { id: chat.id, title: chat.title || chat.username || String(chat.id), type: chat.type, status });
    else await store.delete(`chat-${chat.id}`);
  }

  async function handleUpdate(update) {
    try {
      if (update.message) return await onMessage(update.message);
      if (update.callback_query) return await onCallback(update.callback_query);
      if (update.my_chat_member) return await onMyChatMember(update.my_chat_member);
      if (update.chat_member) {
        const chat = update.chat_member.chat;
        if (isChannelChat(chat)) return await onChannelMember(update.chat_member);
        const groupId = await getGroupId();
        if (groupId && String(chat.id) === String(groupId)) return await onGroupMember(update.chat_member);
      }
    } catch (error) {
      console.error('[telegram] update xatosi', error);
      const m = update.message, q = update.callback_query;
      const chat = m?.chat?.type === 'private' ? m.chat.id : (q?.message?.chat?.type === 'private' ? q.message.chat.id : null);
      if (chat) await safeSend(chat, '⏳ Hozir texnik ishlar ketmoqda. Iltimos, birozdan keyin qayta urinib ko‘ring.');
    }
    return undefined;
  }

  return { handleUpdate, getGroupId };
}

/** Webhook, buyruqlar va bot tavsifini bir yo'la sozlaydi (admin sahifasi va scripts/telegram-setup.mjs ishlatadi). */
export async function setupBot(call, token, url) {
  await call('setWebhook', { url, secret_token: webhookSecret(token), allowed_updates: ALLOWED_UPDATES, drop_pending_updates: false });
  await call('setMyCommands', { commands: [
    { command: 'start', description: 'Shaxsiy taklif havolasini olish' },
    { command: 'holat', description: 'Nechta do‘st qo‘shilganini ko‘rish' },
    { command: 'guruh', description: 'Maxsus guruhga kirish' },
    { command: 'reyting', description: 'Eng faol ishtirokchilar' },
    { command: 'yordam', description: 'Yordam' },
  ] });
  await call('setMyCommands', { scope: { type: 'all_chat_administrators' }, commands: [{ command: 'setgroup', description: 'Shu guruhni maxsus mutolaa guruhi qilish' }] });
  await call('setMyShortDescription', { short_description: `Ilm Yo‘lida | Mutolaa: ${target()} ta do‘st taklif qiling va maxsus mutolaa guruhiga kiring.` });
  await call('setMyDescription', { description: `Ilm Yo‘lida | Mutolaa — bepul 15 kunlik challenge.\n\n${target()} ta do‘stingizni ${channelName()} kanaliga taklif qiling va maxsus mutolaa guruhiga havola oling.\n\nBoshlash uchun /start bosing.` });
}

/* ---------- HTTP (api/telegram.mjs) ---------- */
let cachedUsername = null;

export async function telegramApi(request, { store: injected, call: injectedCall, token = botToken(), adminKey = process.env.ADMIN_KEY || (isLocalDev() ? 'local-admin-key' : '') } = {}) {
  const call = injectedCall || makeCaller(token);
  if (request.method === 'GET') {
    let bot = null;
    if (token) {
      try { cachedUsername ||= (await call('getMe')).username; bot = cachedUsername; } catch { bot = null; }
    }
    return reply({ ok: true, bot, channel: channelName(), target: target() });
  }
  if (request.method !== 'POST') return reply({ ok: false, error: 'POST kerak.' }, 405);
  if (!token) return reply({ ok: false, error: 'TELEGRAM_BOT_TOKEN sozlanmagan.' }, 503);

  const store = injected || await openStore();
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  if (secretHeader !== null) {
    if (!sameSecret(secretHeader, webhookSecret(token))) return reply({ ok: false }, 401);
    let update; try { update = await request.json(); } catch { return reply({ ok: false }, 400); }
    await createBot({ store, call, token }).handleUpdate(update);
    return reply({ ok: true });
  }

  // Admin amallari
  if (!adminKey) return reply({ ok: false, error: 'ADMIN_KEY sozlanmagan.' }, 503);
  if (!sameSecret(request.headers.get('x-admin-key'), adminKey)) return reply({ ok: false, error: 'Admin paroli noto‘g‘ri.' }, 401);
  let body; try { body = JSON.parse((await request.text()) || '{}'); } catch { return reply({ ok: false, error: 'Noto‘g‘ri so‘rov.' }, 400); }

  try {
    if (body.action === 'setup') {
      const url = `${new URL(request.url).origin}/api/telegram`;
      await setupBot(call, token, url);
      return reply({ ok: true, url });
    }
    if (body.action === 'info') {
      const me = await call('getMe');
      const hook = await call('getWebhookInfo');
      const check = async chatId => {
        if (!chatId) return { ok: false, note: 'sozlanmagan' };
        try {
          const m = await call('getChatMember', { chat_id: chatId, user_id: me.id });
          const admin = m.status === 'administrator' || m.status === 'creator';
          return { ok: admin && (m.status === 'creator' || m.can_invite_users === true), status: m.status, canInvite: m.can_invite_users ?? null };
        } catch (error) { return { ok: false, note: error.message }; }
      };
      const chats = [];
      for await (const page of store.list()) for (const blob of page.blobs) if (blob.key.startsWith('chat-')) { const c = await store.get(blob.key); if (c) chats.push(c); }
      const groupId = await createBot({ store, call, token }).getGroupId();
      return reply({ ok: true, bot: me.username, webhook: { url: hook.url || '', pending: hook.pending_update_count, lastError: hook.last_error_message || '' },
        channel: { name: channelName(), ...(await check(channelName())) }, group: { id: groupId, ...(await check(groupId)) }, chats });
    }
    if (body.action === 'set-group') {
      const chatId = String(body.chatId || '').trim();
      if (!/^-?\d{5,20}$/.test(chatId)) return reply({ ok: false, error: 'Chat ID noto‘g‘ri.' }, 400);
      const me = await call('getMe');
      const m = await call('getChatMember', { chat_id: chatId, user_id: me.id });
      if (!(m.status === 'administrator' || m.status === 'creator')) return reply({ ok: false, error: 'Bot bu guruhda admin emas.' }, 400);
      await store.setJSON('config', { ...((await store.get('config')) || {}), groupId: chatId });
      return reply({ ok: true, groupId: chatId });
    }
  } catch (error) {
    return reply({ ok: false, error: error.message }, 502);
  }
  return reply({ ok: false, error: 'Noma’lum amal.' }, 400);
}
