import { cleanupJobs } from '../../server/quiz-jobs.mjs';
export default async () => { await cleanupJobs(); };
export const config = { schedule: '0 * * * *' };
