import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { generateQuiz, validateInput, QuizError } from './quiz-service.mjs';

export function memoryStore() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? structuredClone(data.get(key).value) : null; },
    async setJSON(key, value, options = {}) { if (options.onlyIfNew && data.has(key)) return { modified: false }; data.set(key, { value: structuredClone(value), metadata: options.metadata }); return { modified: true }; },
    async delete(key) { data.delete(key); },
    async *list() { yield { blobs: [...data].map(([key, item]) => ({ key, metadata: item.metadata })) }; }
  };
}
const localStore = memoryStore();
export function jobStore() {
  return process.env.ILM_LOCAL_DEV === 'true' ? localStore : getStore({ name: 'ilm-quiz-jobs', consistency: 'strong' });
}
export function json(data, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
export function apiError(error) { return json({ error: error instanceof QuizError ? error.message : 'Test xizmatida xatolik. Keyinroq urinib ko‘ring.', code: error instanceof QuizError ? error.code : 'server_error' }, error instanceof QuizError ? error.status : 500); }
export function signJob(id, secret) { return createHmac('sha256', secret).update('ilm-quiz:' + id).digest('hex'); }
export function validSignature(id, signature, secret) {
  if (!secret || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(signJob(id, secret), 'hex'));
}
const jobIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export async function readJobInput(request) {
  if (request.method !== 'POST') throw new QuizError('method', 'POST so‘rovi kerak.', 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new QuizError('origin', 'So‘rov manbasi mos emas.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new QuizError('content_type', 'JSON so‘rovi kerak.', 415);
  if (Number(request.headers.get('content-length')) > 450000) throw new QuizError('too_large', 'Matn hajmi juda katta.', 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 450000) throw new QuizError('too_large', 'Matn hajmi juda katta.', 413);
  let input; try { input = JSON.parse(raw); } catch { throw new QuizError('invalid_input', 'So‘rovni o‘qib bo‘lmadi.'); }
  return validateInput(input);
}
export async function startJob(input, { store = jobStore(), env = process.env, launch, now = Date.now } = {}) {
  input = validateInput(input);
  if (!env.OPENAI_API_KEY || (input.mode === 'auto' && !env.SUPADATA_API_KEY)) throw new QuizError('not_configured', 'AI test xizmati hali ulanmagan. Administrator xizmatni yoqishi kerak.', 503);
  const id = randomUUID(), createdAt = now(), expiresAt = createdAt + 3600000;
  await store.setJSON('job/' + id, { id, input, createdAt, expiresAt, status: 'queued', stage: input.mode === 'auto' ? 'transcript' : 'questions', videoId: input.videoId }, { metadata: { expiresAt } });
  try { await launch(id, signJob(id, env.OPENAI_API_KEY)); }
  catch { await store.delete('job/' + id); throw new QuizError('launch_failed', 'Testni boshlash imkoni bo‘lmadi. Qayta urinib ko‘ring.', 503); }
  return { id, status: 'queued', videoId: input.videoId };
}
export async function runJob(id, { store = jobStore(), env = process.env, generate = generateQuiz, now = Date.now } = {}) {
  if (!jobIdPattern.test(id)) return;
  const key = 'job/' + id, job = await store.get(key, { type: 'json' });
  if (!job || job.status !== 'queued' || job.expiresAt < now()) return;
  const lock = await store.setJSON('lock/' + id, true, { onlyIfNew: true, metadata: { expiresAt: job.expiresAt } });
  if (!lock.modified) return;
  const { input, ...publicJob } = job;
  try {
    // Remove the pasted source from storage once the worker has loaded it.
    await store.setJSON(key, { ...publicJob, status: 'running' }, { metadata: { expiresAt: job.expiresAt } });
    const quiz = await generate(input, { env, onStage: async stage => {
      await store.setJSON(key, { ...publicJob, status: 'running', stage }, { metadata: { expiresAt: job.expiresAt } });
    } });
    await store.setJSON(key, { ...publicJob, status: 'completed', stage: 'done', quiz }, { metadata: { expiresAt: job.expiresAt } });
  } catch (error) {
    await store.setJSON(key, { ...publicJob, status: 'failed', error: error instanceof QuizError ? error.message : 'Test yaratilmadi. Matnni joylang yoki qayta urinib ko‘ring.', code: error instanceof QuizError ? error.code : 'generation_failed' }, { metadata: { expiresAt: job.expiresAt } });
  }
}
export async function getJob(id, { store = jobStore(), now = Date.now } = {}) {
  if (!jobIdPattern.test(id)) throw new QuizError('not_found', 'Test topilmadi.', 404);
  const key = 'job/' + id, job = await store.get(key, { type: 'json' });
  if (!job || job.expiresAt < now()) { if (job) await store.delete(key); throw new QuizError('expired', 'Test so‘rovining muddati tugadi. Qayta boshlang.', 404); }
  if (['queued', 'running'].includes(job.status) && now() - job.createdAt > 14 * 60000)
    return { id, videoId: job.videoId, status: 'failed', code: 'timeout', error: 'Test yaratish vaqti tugadi. Matnni joylang yoki qayta urinib ko‘ring.' };
  const { input, ...result } = job;
  return result;
}
export async function cleanupJobs(store = jobStore(), now = Date.now) {
  for await (const page of store.list({ paginate: true, metadata: true }))
    for (const blob of page.blobs) if (blob.metadata?.expiresAt < now()) await store.delete(blob.key);
}
