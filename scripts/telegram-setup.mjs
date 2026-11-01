// Botni saytsiz, bir buyruq bilan ulash: node scripts/telegram-setup.mjs https://sizning-sayt.vercel.app
// TELEGRAM_BOT_TOKEN .env faylidan olinadi (hech qayerga yuborilmaydi, faqat api.telegram.org ga).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCaller, setupBot } from '../server/telegram-bot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const site = String(process.argv[2] || process.env.SITE_URL || '').trim().replace(/\/+$/, '');
const channel = process.env.TELEGRAM_CHANNEL || '@ilmm_yolida';
const fail = text => { console.error('\n❌ ' + text + '\n'); process.exit(1); };

if (!/^\d+:[\w-]{20,}$/.test(token)) fail('TELEGRAM_BOT_TOKEN topilmadi yoki noto‘g‘ri. .env faylida TELEGRAM_BOT_TOKEN=... qatori bo‘lishi kerak.');
if (!/^https:\/\/[^\s/]+$/.test(site)) fail('Sayt manzili noto‘g‘ri. Masalan: https://ilm-yolida.vercel.app');

const call = makeCaller(token);
try {
  const me = await call('getMe');
  console.log(`🤖 Bot: @${me.username}`);
  await setupBot(call, token, `${site}/api/telegram`);
  console.log(`✅ Webhook ulandi: ${site}/api/telegram`);
  const m = await call('getChatMember', { chat_id: channel, user_id: me.id }).catch(error => ({ error: error.message }));
  if (m.error) console.log(`❌ Kanal ${channel}: ${m.error}`);
  else if (m.status === 'creator' || (m.status === 'administrator' && m.can_invite_users)) console.log(`✅ Kanal ${channel}: bot admin va taklif huquqi bor`);
  else console.log(`❌ Kanal ${channel}: botni admin qiling va «Foydalanuvchilarni taklif qilish» huquqini yoqing`);
  const hook = await call('getWebhookInfo');
  if (hook.last_error_message) console.log(`⚠️ Telegram oxirgi xatosi: ${hook.last_error_message}`);
  console.log('\nKeyingi qadam: maxsus guruhda (admin sifatida) /setgroup yozing, bot guruhni eslab qoladi.');
  console.log('Keyin botga /start bosib sinab ko‘ring.\n');
} catch (error) {
  fail('Telegram xatosi: ' + error.message);
}
