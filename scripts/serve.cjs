const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
process.env.ILM_LOCAL_DEV = 'true';
const api = import('../server/quiz-jobs.mjs');
const limits = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname === '/api/quiz' || pathname.startsWith('/api/quiz/')) {
    const { readJobInput, startJob, runJob, getJob, json, apiError } = await api;
    const create = pathname === '/api/quiz', bucket = (req.socket.remoteAddress || '') + (create ? ':create' : ':status');
    const recent = (limits.get(bucket) || []).filter(time => Date.now() - time < 60000);
    if (recent.length >= (create ? 4 : 40)) { res.writeHead(429, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'So‘rovlar limiti. Bir daqiqadan so‘ng urinib ko‘ring.' })); return; }
    recent.push(Date.now()); limits.set(bucket, recent);
    let response;
    try {
      if (create) {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 450000) { res.writeHead(413).end(); return; } chunks.push(chunk); }
        const request = new Request('http://' + req.headers.host + req.url, { method: req.method, headers: req.headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}) });
        response = json(await startJob(await readJobInput(request), { launch: async id => { setImmediate(() => runJob(id).catch(() => {})); } }), 202);
      } else response = req.method === 'GET' ? json(await getJob(pathname.split('/').pop())) : json({ error: 'GET so‘rovi kerak.' }, 405);
    } catch (error) { response = apiError(error); }
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (relative !== 'index.html' && !/^assets\/[a-z0-9-]+\.(png|mp3|js)$/i.test(relative)) {
    res.writeHead(404).end('Not found'); return;
  }
  const file = path.join(root, relative);
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': stat.size });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
});
const port = Number(process.env.PORT || 4174);
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Ilm Yo‘lida: http://127.0.0.1:${port}`));
