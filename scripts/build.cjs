const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.mkdirSync(output, { recursive: true });
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<script src="./assets/book-club.js">', '<script src="./assets/supabase-config.js"></script><script src="./assets/ilm-cloud.js"></script><script src="./assets/book-club.js">')
  .replace('</body>', '<script src="./assets/bookshelf-pro.js"></script><script src="./assets/reader-groups.js"></script></body>');
fs.writeFileSync(path.join(output, 'index.html'), indexHtml);
fs.copyFileSync(path.join(root, 'Hayot Strategiyam.html'), path.join(output, 'Hayot Strategiyam.html'));
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
const publicConfig = {
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
};
fs.writeFileSync(path.join(output, 'assets', 'supabase-config.js'), `window.ILM_SUPABASE_CONFIG=${JSON.stringify(publicConfig)};\n`);
require('esbuild').buildSync({
  absWorkingDir: root,
  entryPoints: ['assets/ilm-cloud-entry.js'],
  outfile: 'public/assets/ilm-cloud.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  legalComments: 'none',
});
console.log('Static site built in public/. Only Supabase URL and public anon key are included; server secrets stay private.');
