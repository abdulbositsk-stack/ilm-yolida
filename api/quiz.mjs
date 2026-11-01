import { waitUntil } from '@vercel/functions';
import { readJobInput, startJob, runJob, json, apiError } from '../server/quiz-jobs.mjs';
import { checkPaidAccess } from '../server/access.mjs';

const handler = async request => {
  try {
    const denied = await checkPaidAccess(request);
    if (denied) return denied;
    const input = await readJobInput(request);
    const result = await startJob(input, { launch: async id => waitUntil(runJob(id)) });
    return json(result, 202);
  } catch (error) {
    return apiError(error);
  }
};

// Vercel: Web `fetch` uslubidagi handler (default export (req, res) uchun ishlaydi, Response qaytarsa osilib qoladi).
export const GET = handler, POST = handler, PUT = handler, PATCH = handler, DELETE = handler, OPTIONS = handler, HEAD = handler;
