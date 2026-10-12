import { waitUntil } from '@vercel/functions';
import { readJobInput, startJob, runJob, json, apiError } from '../server/quiz-jobs.mjs';

export default async request => {
  try {
    const input = await readJobInput(request);
    const result = await startJob(input, { launch: async id => waitUntil(runJob(id)) });
    return json(result, 202);
  } catch (error) {
    return apiError(error);
  }
};
