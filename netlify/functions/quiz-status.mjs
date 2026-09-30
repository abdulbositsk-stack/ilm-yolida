import { getJob, json, apiError } from '../../server/quiz-jobs.mjs';
export default async request => {
  if (request.method !== 'GET') return json({ error: 'GET so‘rovi kerak.' }, 405);
  try { return json(await getJob(new URL(request.url).pathname.split('/').pop())); }
  catch (error) { return apiError(error); }
};
export const config = { path: '/api/quiz/:id', rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
