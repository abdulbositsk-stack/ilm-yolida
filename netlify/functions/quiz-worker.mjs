import { validSignature, runJob } from '../../server/quiz-jobs.mjs';
export default async request => {
  if (request.method !== 'POST') return;
  let body; try { body = await request.json(); } catch { return; }
  if (typeof body.id !== 'string' || !validSignature(body.id, request.headers.get('x-quiz-signature'), process.env.OPENAI_API_KEY)) return;
  await runJob(body.id);
};
export const config = { background: true };
