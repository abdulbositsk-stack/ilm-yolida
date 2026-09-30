import { readJobInput, startJob, json, apiError } from '../../server/quiz-jobs.mjs';
export default async request => {
  try {
    const input = await readJobInput(request);
    const result = await startJob(input, { launch: async (id, signature) => {
      const url = new URL('/.netlify/functions/quiz-worker', process.env.DEPLOY_PRIME_URL || process.env.URL || request.url);
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-quiz-signature': signature }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(15000) });
      if (response.status !== 202) throw new Error('Worker did not accept job');
    } });
    return json(result, 202);
  } catch (error) { return apiError(error); }
};
export const config = { path: '/api/quiz', rateLimit: { windowLimit: 4, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
