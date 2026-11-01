import { groupApi } from '../../server/group-challenges.mjs';

const handler = (request, context) => {
  const code = context?.params?.code || new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
  return groupApi(request, code);
};

// Vercel: Web `fetch` uslubidagi handler (default export (req, res) uchun ishlaydi, Response qaytarsa osilib qoladi).
export const GET = handler, POST = handler, PUT = handler, PATCH = handler, DELETE = handler, OPTIONS = handler, HEAD = handler;
