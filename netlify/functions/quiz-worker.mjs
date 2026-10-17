import { validSignature, runJob } from '../../server/quiz-jobs.mjs';
import { quizSecret } from '../../server/quiz-service.mjs';
export default async request => {
  if (request.method !== 'POST') return;
  let body; try { body = await request.json(); } catch { return; }
  if (typeof body.id !== 'string' || !validSignature(body.id, request.headers.get('x-quiz-signature'), quizSecret(process.env))) return;
  await runJob(body.id);
};
export const config = { background: true };
