import { cleanupJobs, json } from '../server/quiz-jobs.mjs';

const handler = async request => {
  if (request.method !== 'GET') return json({ error: 'GET so‘rovi kerak.' }, 405);
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return json({ error: 'Ruxsat yo‘q.' }, 401);
  await cleanupJobs();
  return json({ ok: true });
};

// Vercel: Web `fetch` uslubidagi handler (default export (req, res) uchun ishlaydi, Response qaytarsa osilib qoladi).
export const GET = handler, POST = handler, PUT = handler, PATCH = handler, DELETE = handler, OPTIONS = handler, HEAD = handler;
