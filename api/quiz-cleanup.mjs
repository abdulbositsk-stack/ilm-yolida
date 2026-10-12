import { cleanupJobs, json } from '../server/quiz-jobs.mjs';

export default async request => {
  if (request.method !== 'GET') return json({ error: 'GET so‘rovi kerak.' }, 405);
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return json({ error: 'Ruxsat yo‘q.' }, 401);
  await cleanupJobs();
  return json({ ok: true });
};
