import assert from 'node:assert/strict';
import { accessApi, checkPaidAccess } from '../server/access.mjs';

const data = new Map();
const store = {
  async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
  async setJSON(key, value, options = {}) {
    if (options.onlyIfNew && data.has(key)) return { modified: false };
    data.set(key, structuredClone(value));
    return { modified: true };
  },
  async delete(key) { data.delete(key); },
  async *list() { yield { blobs: [...data.keys()].map(key => ({ key })) }; },
};

const ADMIN = 'test-admin-key-123';
const call = async (body, key) => {
  const response = await accessApi(new Request('http://x/api/access', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-admin-key': key } : {}) },
    body: JSON.stringify(body),
  }), { store, adminKey: ADMIN });
  return { status: response.status, body: await response.json() };
};
const dev = n => `device-${String(n).padStart(20, '0')}`;

// Admin parolisiz kod yaratib bo'lmaydi
assert.equal((await call({ action: 'create' })).status, 401);
assert.equal((await call({ action: 'list' }, 'wrong-key-123')).status, 401);

// Kod yaratish
const created = await call({ action: 'create', name: 'Anton' }, ADMIN);
assert.equal(created.status, 200);
const code = created.body.code;
assert.match(code, /^ILM-[A-Z2-9]{5}-[A-Z2-9]{5}$/);

// Noto'g'ri kod
assert.equal((await call({ action: 'redeem', code: 'ILM-AAAAA-BBBBB', deviceId: dev(1) })).status, 404);
assert.equal((await call({ action: 'redeem', code, deviceId: 'short' })).status, 400);

// 2 ta qurilma ishlaydi, 3-si rad etiladi
assert.equal((await call({ action: 'redeem', code, deviceId: dev(1) })).status, 200);
assert.equal((await call({ action: 'redeem', code: code.toLowerCase(), deviceId: dev(1) })).status, 200, 'bir qurilmada qayta kiritish mumkin, kichik harf ham');
assert.equal((await call({ action: 'redeem', code, deviceId: dev(2) })).status, 200);
const third = await call({ action: 'redeem', code, deviceId: dev(3) });
assert.equal(third.status, 403);
assert.equal(third.body.reason, 'device_limit');

// check: faqat bog'langan qurilma
assert.equal((await call({ action: 'check', code, deviceId: dev(1) })).status, 200);
assert.equal((await call({ action: 'check', code, deviceId: dev(3) })).status, 403);

// Admin ro'yxati
const list = await call({ action: 'list' }, ADMIN);
assert.equal(list.body.codes.length, 1);
assert.equal(list.body.codes[0].devices.length, 2);
assert.equal(list.body.codes[0].name, 'Anton');
assert.ok(!JSON.stringify(list.body).includes(dev(1)), 'to‘liq qurilma ID ro‘yxatda ko‘rinmasligi kerak');

// Bekor qilish
assert.equal((await call({ action: 'revoke', code }, ADMIN)).status, 200);
assert.equal((await call({ action: 'check', code, deviceId: dev(1) })).status, 403);
assert.equal((await call({ action: 'redeem', code, deviceId: dev(1) })).body.reason, 'revoked');

// Qayta tiklash va qurilmalarni tozalash
assert.equal((await call({ action: 'restore', code }, ADMIN)).status, 200);
assert.equal((await call({ action: 'reset-devices', code }, ADMIN)).status, 200);
assert.equal((await call({ action: 'redeem', code, deviceId: dev(3) })).status, 200);
assert.equal((await call({ action: 'check', code, deviceId: dev(1) })).status, 403, 'eski qurilma tozalangan');

// O'chirish
assert.equal((await call({ action: 'delete', code }, ADMIN)).status, 200);
assert.equal((await call({ action: 'check', code, deviceId: dev(3) })).status, 403);

// ADMIN_KEY sozlanmagan bo'lsa admin o'chiq
const disabled = await accessApi(new Request('http://x/', { method: 'POST', body: JSON.stringify({ action: 'list' }), headers: { 'x-admin-key': 'anything-long' } }), { store, adminKey: '' });
assert.equal(disabled.status, 503);

// GET ruxsat etilmaydi
assert.equal((await accessApi(new Request('http://x/'), { store, adminKey: ADMIN })).status, 405);

// ---- Pullik funksiya tekshiruvi (video-test) ----
const paid = (headersInit, enabled = true) => checkPaidAccess(new Request('http://x/api/quiz', { method: 'POST', headers: headersInit }), { store, enabled });
const made = await call({ action: 'create', name: 'Pullik' }, ADMIN);
const payCode = made.body.code;
assert.equal(await paid({}, false), null, 'o‘chiq bo‘lsa hamma uchun ochiq');
assert.equal((await paid({})).status, 402, 'kodsiz rad etiladi');
assert.equal((await paid({ 'x-access-code': payCode, 'x-device-id': dev(7) })).status, 402, 'bog‘lanmagan qurilma rad etiladi');
await call({ action: 'redeem', code: payCode, deviceId: dev(7) });
assert.equal(await paid({ 'x-access-code': payCode, 'x-device-id': dev(7) }), null, 'to‘lagan qurilma ruxsat oladi');
assert.equal((await paid({ 'x-access-code': payCode, 'x-device-id': dev(8) })).status, 402, 'boshqa qurilma rad etiladi');
await call({ action: 'revoke', code: payCode }, ADMIN);
assert.equal((await paid({ 'x-access-code': payCode, 'x-device-id': dev(7) })).status, 402, 'bekor qilingan kod rad etiladi');

console.log('access-api: OK');
