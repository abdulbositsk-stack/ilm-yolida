import { getJob, json, apiError } from '../../server/quiz-jobs.mjs';

const handler = async request => {
  if (request.method !== 'GET') return json({ error: 'GET so‘rovi kerak.' }, 405);
  try {
    const id = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
    return json(await getJob(id));
  } catch (error) {
    return apiError(error);
  }
};

// Vercel: Web `fetch` uslubidagi handler (default export (req, res) uchun ishlaydi, Response qaytarsa osilib qoladi).
export const GET = handler, POST = handler, PUT = handler, PATCH = handler, DELETE = handler, OPTIONS = handler, HEAD = handler;
