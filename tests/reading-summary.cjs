const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('assets/reading-challenge.js', 'utf8');
const KEY = 'ilm-yolida-mutolaa15';
const wait = () => new Promise(resolve => setTimeout(resolve, 25));

function fixture(saved, clips = new Map()) {
  const dom = new JSDOM('<main id="main"></main>', { url: 'https://example.test', runScripts: 'outside-only' });
  const w = dom.window;
  let stopped = 0, lastBlob, failSave = false, failAudio = false;
  w.storage = {
    get: (key, fallback) => JSON.parse(w.localStorage.getItem(key)) || fallback,
    set: (key, value) => { if (failSave) return false; w.localStorage.setItem(key, JSON.stringify(value)); return true; },
  };
  if (saved) w.storage.set(KEY, saved);
  w.state = {};
  w.render = () => { w.document.getElementById('main').innerHTML = w.booksView(); };
  w.fetch = async () => ({ json: async () => ({}) });
  w.confirm = () => true;
  w.open = url => { w.opened = url; };
  w.prompt = () => {};
  w.URL.createObjectURL = blob => { lastBlob = blob; return 'blob:test-' + Math.random(); };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = () => {};
  w.navigator.clipboard = { writeText: async text => { w.copied = text; } };
  w.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stopped++ }] }) };
  w.MediaRecorder = class {
    static isTypeSupported(type) { return type === 'audio/mp4'; }
    constructor(stream, options) { this.mimeType = options.mimeType; this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => { this.ondataavailable({ data: new w.Blob(['recorded audio'], { type: this.mimeType }) }); this.onstop(); });
    }
  };
  w.indexedDB = { open() {
    const request = {};
    queueMicrotask(() => {
      request.result = { transaction() {
        const tx = {};
        tx.objectStore = () => {
          const run = action => {
            const result = {};
            setTimeout(() => { if (failAudio) { tx.error = new Error('Quota'); tx.onerror(); } else { result.result = action(); tx.oncomplete(); } }, 0);
            return result;
          };
          return { get: id => run(() => clips.get(id)), put: (blob, id) => run(() => clips.set(id, blob)), delete: id => run(() => clips.delete(id)) };
        };
        return tx;
      } };
      request.onsuccess();
    });
    return request;
  } };
  w.eval(source); w.render();
  return { w, d: w.document, read: () => w.storage.get(KEY), clips, stopped: () => stopped, blob: () => lastBlob, failSave: value => { failSave = value; }, failAudio: value => { failAudio = value; }, close: () => w.close() };
}
const readBlob = (w, blob) => new Promise(resolve => { const reader = new w.FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });

(async () => {
  const f = fixture(), { w, d } = f;
  assert.equal(d.querySelector('#rc-day-0 .rc-summary'), null, 'Choose a format before writing');
  assert.equal(d.querySelectorAll('#rc-day-0 .rc-formats button').length, 3);
  w.rcFormat(0, 'text');
  w.rcSummary(0, 'My lesson');
  await w.rcShare(0);
  assert.equal(d.getElementById('rc-prev'), null, 'Required metadata prevents incomplete sharing');
  w.rcField('name', 'Test Reader'); w.rcField('book', 'Test Book'); w.rcField('author', 'Test Author'); w.rcPages(0, 12);
  await w.rcShare(0); await w.rcPreviewSend();
  const text = new URL(w.opened).searchParams.get('text');
  for (const value of ['1-kun / 15', 'Test Reader', 'Test Book', 'Test Author', '12 sahifa', 'My lesson']) assert(text.includes(value), value);
  w.rcPreviewClose();
  w.rcFormat(0, 'voice');
  assert.equal(d.querySelector('#rc-day-0 textarea'), null, 'Voice hides text fields');
  assert.equal(f.read().days[0].summary, 'My lesson', 'Switching keeps the text draft');
  await w.rcRecordStart(0);
  assert(d.getElementById('rc-voice-0').textContent.includes('Ovoz yozilmoqda'));
  w.rcFormat(0, 'poster'); assert.equal(f.read().days[0].format, 'voice', 'Cannot switch mid recording');
  w.rcRecordStop(); await wait();
  assert(f.read().days[0].voice);
  assert(f.stopped() > 0, 'Microphone tracks released');
  assert(d.querySelector('#rc-voice-0 audio'));
  const firstVoice = f.read().days[0].voice.id;
  await w.rcShare(0);
  let shared;
  w.navigator.canShare = () => true;
  w.navigator.share = async data => { shared = data; };
  await w.rcPreviewSend();
  assert.equal(shared.files[0].type, 'audio/mp4');
  assert(shared.files[0].name.endsWith('.m4a'));
  for (const value of ['Test Reader', 'Test Book', 'Test Author', '12 sahifa', '1-kun']) assert(shared.text.includes(value));
  w.navigator.share = async () => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); };
  await w.rcPreviewSend(); assert.equal(d.getElementById('rc-share-status').textContent, '', 'Cancel does not download');
  w.navigator.canShare = () => false;
  await w.rcPreviewSend();
  assert(d.querySelector('#rc-share-status a'), 'Unsupported sharing gives a Telegram attachment fallback');
  await w.rcCopyCaption(); assert(w.copied.includes('Test Author'));
  w.rcPreviewClose();

  // Re-recording failures must preserve the last successfully saved recording.
  f.failAudio(true); await w.rcRecordStart(0); w.rcRecordStop(); await wait();
  assert.equal(f.read().days[0].voice.id, firstVoice); f.failAudio(false);
  f.failSave(true); await w.rcRecordStart(0); w.rcRecordStop(); await wait(); f.failSave(false);
  assert.equal(f.read().days[0].voice.id, firstVoice);

  await w.rcExport();
  const backup = JSON.parse(await readBlob(w, f.blob()));
  assert(backup.audio[firstVoice].startsWith('data:audio/mp4;base64,'), 'Backups contain actual audio');
  const reloaded = fixture(f.read(), f.clips);
  await reloaded.w.rcVoiceListen(0);
  assert(reloaded.d.querySelector('#rc-voice-0 audio'), 'Recording plays after reload'); reloaded.close();
  const input = { files: [new w.File([JSON.stringify(backup)], 'backup.json')], value: 'backup' };
  w.rcImport(input); await wait(); await wait();
  assert.notEqual(f.read().days[0].voice.id, firstVoice);
  assert(f.clips.has(f.read().days[0].voice.id), 'Import restores audio under a fresh id');
  await w.rcVoiceDelete(0);
  assert.equal(f.read().days[0].voice, null);
  assert.equal(d.querySelector('#rc-share-0 button'), null, 'Deleted voice cannot be shared');

  let permissionResolve;
  w.navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { permissionResolve = resolve; });
  const pending = w.rcRecordStart(0); w.rcRecordStop();
  const beforeStop = f.stopped();
  permissionResolve({ getTracks: () => [{ stop: () => { w.lateTrackStopped = true; } }] });
  await pending; assert(w.lateTrackStopped, 'Late permission after cancellation releases microphone');
  assert.equal(f.stopped(), beforeStop);
  w.navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); };
  await w.rcRecordStart(0); assert(d.getElementById('rc-toast').textContent.includes('ruxsat berilmadi'));
  w.rcFormat(0, 'poster'); assert.equal(d.querySelector('#rc-day-0 .rc-summary').value, 'My lesson');
  const posterText = [];
  // Exercise the real poster DOM builder without an external canvas library/network.
  Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { get: () => true });
  w.html2canvas = async element => {
    posterText.push(element.textContent);
    return { toBlob: callback => callback(new w.Blob(['png'], { type: 'image/png' })) };
  };
  w.rcExtraAdd(0); w.rcExtra(0, 0, 'text', 'Another lesson');
  await w.rcShare(0);
  assert.equal(d.querySelectorAll('#rc-prev .rc-prev-imgs img').length, 2);
  for (const value of ['Test Reader', 'Test Book', 'Test Author', '12 sahifa', 'My lesson']) assert(posterText[0].includes(value), value);
  assert(posterText[1].includes('Another lesson'));
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(d.getElementById('rc-prev'), null, 'Escape closes preview');
  assert.equal(d.querySelector('#rc-guide').tagName, 'DETAILS', 'Instructions collapse cleanly');
  assert(d.querySelector('.rc-app > .rc-wrap > #rc-days'), 'Day grid remains outside the guide');
  // Existing poster data migrates without requiring a new selection.
  const legacy = f.read(); delete legacy.days[0].format;
  const old = fixture(legacy); assert(old.d.querySelector('#rc-day-0 [onclick="rcFormat(0,\'poster\')"]').getAttribute('aria-pressed') === 'true'); old.close();
  const completed = f.read(); completed.days.forEach((day, i) => { day.done = true; day.format = i % 2 ? 'text' : 'voice'; day.summary = i % 2 ? 'Written summary' : ''; day.voice = i % 2 ? null : { id: 'clip-test', duration: 20 }; });
  const cert = fixture(completed); assert(cert.d.getElementById('rc-certificate'), 'Mixed voice and text summaries unlock certificate'); cert.close();
  w.rcReset(); assert.equal(f.read().days[0].format, '');
  f.close();
  console.log('Reading summaries: formats, metadata, recording, persistence, permission/cancellation, failures, sharing, backup/import, legacy data and certificate PASS.');
})().catch(error => { console.error(error); process.exitCode = 1; });
