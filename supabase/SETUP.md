# Ilm Yo‘lida cloud setup

Kitob javoni, guruhlar, chat, umumiy profil va bildirishnomalarni qurilmalar orasida ishlatish uchun Supabase loyihasi kerak. Kod mavjud Supabase Auth, Postgres va Storage bilan ishlaydi.

## Bir marta sozlash

1. Supabase loyihasida SQL Editor’ni oching va `supabase/schema.sql` faylini ishga tushiring.
2. Keyin `supabase/migrations/20261014_reading_community.sql` faylini ishga tushiring.
3. Supabase Project Settings → API’dan Project URL va `anon` public key’ni oling.
4. Vercel loyihasining Settings → Environment Variables bo‘limida quyidagilarni Production, Preview va Development uchun kiriting:
   - `SUPABASE_URL` — Project URL
   - `SUPABASE_ANON_KEY` — `anon` public key
5. Supabase Authentication → URL Configuration’da Site URL’ni `https://ilm-yolida.vercel.app` qiling. Redirect URLs’ga shu domenni va kerak bo‘lsa Vercel Preview domenlarini qo‘shing.
6. Google bilan kirish uchun Supabase Authentication → Providers’da Google’ni yoqing, OAuth client ID/secret’ni kiriting va Supabase ko‘rsatgan callback URL’ni Google OAuth klientiga qo‘shing.
7. Vercel’da yangi deployment yarating. Keyin saytda akkaunt yarating va emailni tasdiqlang.

`anon` public key is client-side and is protected by the SQL row-level security policies. Never put the `service_role` key in Vercel frontend variables or this repository.

Mavjud javon va kitob yozuvlari foydalanuvchi akkauntga birinchi marta kirganda shu brauzerdan import qilinadi. Eski invite-code guruhlari alohida Blob saqlashda qoladi; ularni yangi akkauntli guruhlarga ko‘chirish bu migration tarkibiga kirmaydi.
