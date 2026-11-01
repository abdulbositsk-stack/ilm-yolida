import { telegramApi } from '../server/telegram-bot.mjs';

const handler = request => telegramApi(request);

// Vercel: Web `fetch` uslubidagi handler (default export (req, res) uchun ishlaydi, Response qaytarsa osilib qoladi).
export const GET = handler, POST = handler, PUT = handler, PATCH = handler, DELETE = handler, OPTIONS = handler, HEAD = handler;
