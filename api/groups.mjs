import { groupApi } from '../server/group-challenges.mjs';

const handler = request => groupApi(request);

// Vercel: Web `fetch` uslubidagi handler (default export (req, res) uchun ishlaydi, Response qaytarsa osilib qoladi).
export const GET = handler, POST = handler, PUT = handler, PATCH = handler, DELETE = handler, OPTIONS = handler, HEAD = handler;
