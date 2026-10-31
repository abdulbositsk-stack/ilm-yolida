// Ustozlar davrasi: to'lovdan keyin beriladigan kirish kodlari.
// Har bir kod 1 kishi uchun, ko'pi bilan MAX_DEVICES ta qurilmaga bog'lanadi.
// Admin amallari ADMIN_KEY (Vercel Environment Variable) bilan himoyalangan.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const MAX_DEVICES = 2;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O, 1/I kabi chalkash belgilarsiz
const CODE_BODY = /^ILM[A-HJ-NP-Z2-9]{10}$/;
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;
const MAX_BODY = 4096;

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const fail = (status, error, reason) => reply({ ok: false, error, reason }, status);

export function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function displayCode(key) {
  return `ILM-${key.slice(3, 8)}-${key.slice(8, 13)}`;
}

function generateKey() {
  const bytes = randomBytes(10);
  let body = '';
  for (const byte of bytes) body += ALPHABET[byte % ALPHABET.length];
  return `ILM${body}`;
}

function sameSecret(given, expected) {
  const a = createHash('sha256').update(String(given || '')).digest();
  const b = createHash('sha256').update(String(expected || '')).digest();
  return timingSafeEqual(a, b);
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
  try { return JSON.parse(text || '{}'); } catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
}

// Lokal ko'rish (npm start) uchun: xotirada saqlanadi, server qayta ishga tushsa tozalanadi.
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
const isLocalDev = () => process.env.ILM_LOCAL_DEV === 'true';

async function openStore(injected) {
  if (injected) return injected;
  if (isLocalDev()) return localStore;
  const { persistentStore } = await import('./blob-store.mjs');
  return persistentStore('access');
}

function publicRecord(key, record) {
  return {
    code: displayCode(key),
    name: record.name || '',
    note: record.note || '',
    createdAt: record.createdAt,
    revoked: Boolean(record.revoked),
    maxDevices: record.maxDevices || MAX_DEVICES,
    devices: (record.devices || []).map(device => ({
      id: device.id.slice(0, 6),
      firstSeen: device.firstSeen,
      lastSeen: device.lastSeen,
      agent: device.agent || '',
    })),
  };
}

async function loadRecord(store, rawCode) {
  const key = normalizeCode(rawCode);
  if (!CODE_BODY.test(key)) return { key, record: null };
  const record = await store.get(key);
  return { key, record: record && typeof record === 'object' ? record : null };
}

// ---- Foydalanuvchi amallari ----
async function redeem(store, body, request) {
  const deviceId = String(body.deviceId || '');
  if (!DEVICE_ID.test(deviceId)) return fail(400, 'Qurilma aniqlanmadi. Sahifani yangilab qayta urinib ko‘ring.', 'bad_device');
  const { key, record } = await loadRecord(store, body.code);
  if (!record) return fail(404, 'Bunday kod topilmadi. Kodni tekshirib qayta kiriting.', 'not_found');
  if (record.revoked) return fail(403, 'Bu kod bekor qilingan. @abdulbasit_sk ga yozing.', 'revoked');

  const now = new Date().toISOString();
  const devices = Array.isArray(record.devices) ? record.devices : [];
  const known = devices.find(device => device.id === deviceId);
  if (known) {
    known.lastSeen = now;
  } else {
    const limit = record.maxDevices || MAX_DEVICES;
    if (devices.length >= limit) {
      return fail(403, `Bu kod ${limit} ta qurilmada ishlatib bo‘lingan. Yangi qurilma uchun @abdulbasit_sk ga yozing.`, 'device_limit');
    }
    devices.push({ id: deviceId, firstSeen: now, lastSeen: now, agent: String(request.headers.get('user-agent') || '').slice(0, 120) });
  }
  record.devices = devices;
  await store.setJSON(key, record);
  return reply({ ok: true });
}

async function check(store, body) {
  const deviceId = String(body.deviceId || '');
  const { key, record } = await loadRecord(store, body.code);
  if (!record || record.revoked || !DEVICE_ID.test(deviceId)) return fail(403, 'Kirish bekor qilingan.', 'invalid');
  const known = (record.devices || []).find(device => device.id === deviceId);
  if (!known) return fail(403, 'Bu qurilma kodga bog‘lanmagan.', 'unbound');
  const now = Date.now();
  if (now - Date.parse(known.lastSeen || 0) > 6 * 3600 * 1000) {
    known.lastSeen = new Date(now).toISOString();
    await store.setJSON(key, record);
  }
  return reply({ ok: true });
}

// ---- Admin amallari ----
async function listAll(store) {
  const keys = [];
  for await (const page of store.list()) for (const blob of page.blobs) keys.push(blob.key);
  const records = [];
  for (const key of keys) {
    if (!CODE_BODY.test(key)) continue;
    const record = await store.get(key);
    if (record) records.push(publicRecord(key, record));
  }
  records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return records;
}

async function admin(store, body) {
  const action = body.action;
  if (action === 'list') return reply({ ok: true, codes: await listAll(store), maxDevices: MAX_DEVICES });

  if (action === 'create') {
    const record = {
      name: String(body.name || '').trim().slice(0, 80),
      note: String(body.note || '').trim().slice(0, 200),
      createdAt: new Date().toISOString(),
      revoked: false,
      maxDevices: Math.min(5, Math.max(1, Number(body.maxDevices) || MAX_DEVICES)),
      devices: [],
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      const key = generateKey();
      const saved = await store.setJSON(key, record, { onlyIfNew: true });
      if (saved && saved.modified === false) continue;
      return reply({ ok: true, code: displayCode(key), record: publicRecord(key, record) });
    }
    return fail(500, 'Kod yaratib bo‘lmadi. Qayta urinib ko‘ring.', 'collision');
  }

  const { key, record } = await loadRecord(store, body.code);
  if (!record) return fail(404, 'Kod topilmadi.', 'not_found');
  if (action === 'revoke') record.revoked = true;
  else if (action === 'restore') record.revoked = false;
  else if (action === 'reset-devices') record.devices = [];
  else if (action === 'delete') { await store.delete(key); return reply({ ok: true }); }
  else return fail(400, 'Noma’lum amal.', 'bad_action');
  await store.setJSON(key, record);
  return reply({ ok: true, record: publicRecord(key, record) });
}

// Pullik funksiyalar (masalan, video-test) uchun server tomonda tekshiruv.
// REQUIRE_PAID_FOR_QUIZ=true bo'lsagina yoqiladi; aks holda hamma foydalanadi.
// Ruxsat bo'lsa null, bo'lmasa 402 Response qaytaradi.
export async function checkPaidAccess(request, { store: injected, enabled = process.env.REQUIRE_PAID_FOR_QUIZ === 'true' } = {}) {
  if (!enabled) return null;
  const denied = () => reply({
    error: 'Test yaratish faqat to‘lov qilgan foydalanuvchilar uchun. Ustozlar davrasida to‘lovdan keyin olingan kodni kiriting.',
    code: 'payment_required',
  }, 402);
  try {
    const code = request.headers.get('x-access-code');
    const deviceId = request.headers.get('x-device-id') || '';
    if (!code || !DEVICE_ID.test(deviceId)) return denied();
    const store = await openStore(injected);
    const { record } = await loadRecord(store, code);
    if (!record || record.revoked) return denied();
    return (record.devices || []).some(device => device.id === deviceId) ? null : denied();
  } catch (error) {
    console.error('paid access check failed', error);
    return reply({ error: 'Tekshiruvda xatolik. Birozdan keyin qayta urinib ko‘ring.', code: 'access_check_failed' }, 503);
  }
}

export async function accessApi(request, { store: injected, adminKey = process.env.ADMIN_KEY || (isLocalDev() ? 'local-admin-key' : '') } = {}) {
  if (request.method !== 'POST') return fail(405, 'POST so‘rovi kerak.', 'method');
  let body;
  try { body = await readBody(request); } catch (error) { return fail(error.status || 400, 'So‘rov noto‘g‘ri.', 'bad_request'); }

  try {
    const store = await openStore(injected);
    if (body.action === 'redeem') return await redeem(store, body, request);
    if (body.action === 'check') return await check(store, body);

    const given = request.headers.get('x-admin-key');
    if (!adminKey || String(adminKey).length < 8) return fail(503, 'Admin paroli (ADMIN_KEY) Vercel’da sozlanmagan.', 'admin_disabled');
    if (!sameSecret(given, adminKey)) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return fail(401, 'Admin paroli noto‘g‘ri.', 'unauthorized');
    }
    return await admin(store, body);
  } catch (error) {
    console.error('access api error', error);
    return fail(500, 'Server xatosi. Birozdan keyin qayta urinib ko‘ring.', 'server');
  }
}
