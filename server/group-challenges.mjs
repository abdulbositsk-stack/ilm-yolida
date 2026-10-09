import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { memoryStore } from './quiz-jobs.mjs';

const localStore = memoryStore();
const codePattern = /^ILM-[A-Z0-9]{5}$/;
const clean = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeNumber = (value, max) => Math.max(1, Math.min(max, Number.parseInt(value, 10) || 0));

export const groupStore = () => process.env.ILM_LOCAL_DEV === 'true'
  ? localStore
  : getStore({ name: 'ilm-group-challenges', consistency: 'strong' });
export const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const code = () => 'ILM-' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
const key = value => 'group/' + value;

async function readJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw [415, 'JSON so‘rovi kerak.'];
  const text = await request.text();
  if (text.length > 25000) throw [413, 'So‘rov juda katta.'];
  try { return JSON.parse(text); } catch { throw [400, 'So‘rovni o‘qib bo‘lmadi.']; }
}
async function readGroup(value, store) {
  if (!codePattern.test(value)) throw [404, 'Challenge kodi topilmadi.'];
  const group = await store.get(key(value), { type: 'json' });
  if (!group) throw [404, 'Challenge kodi topilmadi.'];
  return group;
}
const publicGroup = group => ({ ...group, members: group.members.map(({ id, name, pages, days, logs }) => ({ id, name, pages, days, logs })) });

export async function createGroup(input, store = groupStore()) {
  const name = clean(input.name), ownerName = clean(input.ownerName, 60), book = input.book || {};
  const title = clean(book.title), author = clean(book.author, 120);
  const days = safeNumber(input.days, 365), dailyPages = safeNumber(input.dailyPages, 1000);
  if (!name || !ownerName || !title || !days || !dailyPages) throw [400, 'Challenge ma’lumotlarini to‘liq kiriting.'];
  let inviteCode, result;
  for (let i = 0; i < 4; i++) {
    inviteCode = code();
    const group = { id: randomUUID(), code: inviteCode, name, book: { title, author, cover: clean(book.cover, 250000) }, days, dailyPages, createdAt: new Date().toISOString(), members: [{ id: randomUUID(), name: ownerName, pages: 0, days: 0, logs: [] }] };
    result = await store.setJSON(key(inviteCode), group, { onlyIfNew: true });
    if (result.modified) return { group: publicGroup(group), memberId: group.members[0].id };
  }
  throw [503, 'Kod yaratilmadi. Qayta urinib ko‘ring.'];
}
export async function joinGroup(inviteCode, input, store = groupStore()) {
  const group = await readGroup(inviteCode, store), name = clean(input.name, 60);
  if (!name) throw [400, 'Ismingizni kiriting.'];
  const existing = group.members.find(member => member.name.toLowerCase() === name.toLowerCase());
  if (existing) return { group: publicGroup(group), memberId: existing.id };
  const member = { id: randomUUID(), name, pages: 0, days: 0, logs: [] };
  group.members.push(member);
  await store.setJSON(key(inviteCode), group);
  return { group: publicGroup(group), memberId: member.id };
}
export async function logProgress(inviteCode, input, store = groupStore()) {
  const group = await readGroup(inviteCode, store), member = group.members.find(item => item.id === clean(input.memberId, 80));
  const pages = safeNumber(input.pages, 1000), note = clean(input.note, 2000);
  if (!member || !pages || !note) throw [400, 'Sahifa va xulosani kiriting.'];
  const day = new Date().toISOString().slice(0, 10);
  member.logs = member.logs.filter(item => item.day !== day);
  member.logs.unshift({ day, pages, note, createdAt: new Date().toISOString() });
  member.pages = member.logs.reduce((sum, item) => sum + item.pages, 0);
  member.days = member.logs.length;
  await store.setJSON(key(inviteCode), group);
  return { group: publicGroup(group) };
}
export async function groupApi(request, inviteCode = '', store = groupStore()) {
  try {
    if (request.method === 'GET') return json({ group: publicGroup(await readGroup(inviteCode, store)) });
    if (request.method !== 'POST') return json({ error: 'GET yoki POST so‘rovi kerak.' }, 405);
    const input = await readJson(request);
    if (!inviteCode) return json(await createGroup(input, store), 201);
    if (input.action === 'join') return json(await joinGroup(inviteCode, input, store));
    if (input.action === 'progress') return json(await logProgress(inviteCode, input, store));
    return json({ error: 'Noma’lum amal.' }, 400);
  } catch (error) {
    const [status, message] = Array.isArray(error) ? error : [500, 'Guruh challenge xizmatida xatolik.'];
    return json({ error: message }, status);
  }
}
