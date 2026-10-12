import { getJob, json, apiError } from '../../server/quiz-jobs.mjs';

export default async request => {
  if (request.method !== 'GET') return json({ error: 'GET so‘rovi kerak.' }, 405);
  try {
    const id = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
    return json(await getJob(id));
  } catch (error) {
    return apiError(error);
  }
};
