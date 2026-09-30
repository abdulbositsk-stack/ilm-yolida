const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const source = fs.readFileSync('index.html', 'utf8');
const errors = [], messages = [], players = [];
const vc = new VirtualConsole();
vc.on('jsdomError', error => errors.push(error));
let confirmAnswer = true, downloaded;
const dom = new JSDOM(source.replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, ''), {
  url: 'http://127.0.0.1:4174', runScripts: 'dangerously', pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.HTMLMediaElement.prototype.play = () => Promise.resolve();
    w.HTMLMediaElement.prototype.pause = () => {};
    w.HTMLAnchorElement.prototype.click = () => {};
    w.alert = text => messages.push(text);
    w.confirm = () => confirmAnswer;
    w.URL.createObjectURL = blob => { downloaded = blob; return 'blob:test'; };
    w.URL.revokeObjectURL = () => {};
    w.YT = { Player: class {
      constructor(frame, options) { this.frame = frame; this.options = options; this.time = 65; players.push(this); }
      getCurrentTime() { return this.time; }
      pauseVideo() { this.paused = true; }
      destroy() { this.destroyed = true; }
    } };
  }
});
const w = dom.window, d = w.document;
w.eval(fs.readFileSync('assets/study-quiz.js', 'utf8'));
const byId = id => { const el = d.getElementById(id); assert(el, 'Missing element: ' + id); return el; };
const click = selector => { const el = d.querySelector(selector); assert(el, 'Missing control: ' + selector); el.click(); };
const type = (id, text) => { byId(id).value = text; byId(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
const read = key => JSON.parse(w.localStorage.getItem('ilm-yolida-' + key));
const checkErrors = () => assert.deepEqual(errors.map(e => e.message), []);
const wait = () => new Promise(resolve => setTimeout(resolve, 30));
const blobText = blob => new Promise((resolve, reject) => { const reader = new w.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob); });

(async () => {
  checkErrors();
  click('#welcome-1 button');
  assert(byId('welcome-2').classList.contains('active'));
  click('#welcome-2 button');
  click('#welcome-3 button');
  assert(byId('welcome-3').classList.contains('active'), 'Blank name must not advance');
  type('first-name', 'Test'); type('last-name', 'Person');
  click('#welcome-3 button');
  assert(byId('welcome-4').classList.contains('active'));
  click('#welcome-4 button');
  assert.notEqual(byId('welcome').style.display, 'none', 'Agreement is required');
  byId('agree').checked = true;
  click('#welcome-4 button');
  assert.equal(w.getComputedStyle(byId('welcome')).display, 'none');
  assert(!/\.welcome\s*\{[^}]*display\s*:\s*grid\s*!important/.test(source), 'CSS must not force onboarding visible');
  assert(byId('main').querySelector('iframe'));

  click('.podcast-picker');
  assert(byId('podcast-panel').classList.contains('mobile-open'));
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert(!byId('podcast-panel').classList.contains('mobile-open'));
  type('pod-search', 'does not exist');
  assert(byId('pod-list').textContent.includes('Hech narsa'));
  type('pod-search', '');
  click('#filter-bank');
  assert.equal(byId('pod-list').querySelectorAll('.pod').length, 1);
  click('#filter-all');
  assert.equal(byId('pod-list').querySelectorAll('.pod').length, 12);

  click('[data-mobile-nav="study"]');
  const id = 'Nc7Oe_oDC58';
  for (const url of ['https://youtu.be/'+id, 'youtube.com/watch?v='+id, 'https://m.youtube.com/watch?v='+id, 'https://youtube.com/shorts/'+id, 'https://youtube.com/live/'+id, 'https://www.youtube-nocookie.com/embed/'+id]) assert.equal(w.extractYouTubeId(url), id);
  for (const url of ['https://evilyoutube.com/watch?v='+id, 'https://youtube.com/watch?v=bad', 'javascript:alert(1)', 'https://youtube.com@evil.com/watch?v='+id, 'https://youtube.com/playlist?list=1', '']) assert.equal(w.extractYouTubeId(url), '');
  type('study-url', 'https://example.com');
  click('.study-link-form button');
  assert(byId('study-url-status').textContent.includes('to‘g‘ri'));
  assert.equal(read('study-video'), null);
  type('study-url', 'youtu.be/'+id); type('study-title', 'My <video>');
  byId('study-url').closest('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert(byId('study-video').src.includes('/embed/'+id));
  const player = players.at(-1);
  click('[onclick="openPanel(\'note\')"]');
  assert(player.paused);
  type('note2-text', 'Remember this');
  click('#main > .note .chip-btn');
  assert(byId('note2-text').value.includes('\n• '));
  const draftText = byId('note2-text').value;
  click('[onclick="openPanel(\'quote\')"]');
  type('quote-text', '<img src=x onerror=alert(1)> A quotation');
  click('#main > .note [onclick="saveQuote()"]');
  assert.equal(read('quotes')[0].timestamp, '1:05');
  assert.equal(byId('study-count').textContent, '1 ta');
  player.time = 120;
  click('[onclick="openPanel(\'note\')"]');
  assert.equal(byId('note2-text').value, draftText);
  assert(byId('main').querySelector('.note .timestamp').textContent.includes('1:05'), 'Draft retains original timestamp');
  click('#main > .note [onclick="saveNote()"]');
  assert.equal(read('notes')[0].seconds, 65);
  assert.equal(byId('study-count').textContent, '2 ta');
  player.options.events.onError({data: 150});
  assert(byId('player-notice').textContent.includes('Video ochilmadi'));
  type('note2-text', 'Keep this when saving fails');
  const originalSet = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = () => { throw new Error('Quota'); };
  click('[onclick="saveNote()"]');
  assert.equal(byId('note2-text').value, 'Keep this when saving fails');
  w.Storage.prototype.setItem = originalSet;

  click('[data-mobile-nav="insights"]');
  assert(player.destroyed);
  assert(byId('main').textContent.includes('My <video>'));
  assert.equal(byId('main').querySelectorAll('img').length, 0, 'Quote content is escaped');
  click('[onclick="setWritingTab(\'notes\')"]');
  assert(byId('main').textContent.includes('Remember this'));

  click('#nav-podcasts'); click('[onclick="openTest()"]');
  click('[onclick="submitTest()"]');
  assert(byId('main').querySelector('.question'), 'Unanswered quiz must stay open');
  const answers = w.eval('tests[state.active].questions.map(q=>q[2])');
  answers.forEach((answer, i) => click(`input[name="q${i}"][value="${answer}"]`));
  type('reflection-1', 'My first conclusion'); type('reflection-2', 'My second conclusion');
  click('[onclick="submitTest()"]');
  assert(byId('dalil-card'));
  assert.equal(read('completed')[id].score, 8);
  assert(read('completed')[id].completedAt);
  click('#nav-progress');
  assert(byId('main').textContent.includes('8/8'));
  assert.equal(w.toDayKey('30/09/2026'), '2026-09-30');
  assert.equal(w.toDayKey('01.09.2026'), '2026-09-01');
  for (const quizId of w.eval('Object.keys(tests)')) {
    w.selectPodcast(quizId); w.openTest();
    assert.equal(d.querySelectorAll('.question').length, 8);
    w.eval('tests[state.active].questions.map(q=>q[2])').forEach((answer, i) => click(`input[name="q${i}"][value="${answer}"]`));
    type('reflection-1', 'Conclusion one'); type('reflection-2', 'Conclusion two');
    click('[onclick="submitTest()"]');
    assert.equal(read('completed')[quizId].score, 8);
    assert(byId('dalil-card'));
    assert(d.querySelector('.share').href.startsWith('tg://msg_url'));
  }

  click('#nav-settings'); click('[onclick="exportData()"]');
  const backup = JSON.parse(await blobText(downloaded));
  assert.equal(backup.notes.length, 1);
  assert.equal(backup.studyVideo.id, id);
  assert.throws(() => w.validateBackup({ ...backup, notes: [null] }));
  assert.throws(() => w.validateBackup({ ...backup, completed: { [id]: { score: 90 } } }));
  assert.throws(() => w.validateBackup({ ...backup, profile: {} }));
  assert.throws(() => w.validateBackup({ ...backup, studyVideo: { id: 'bad', title: 'bad' } }));
  async function importBackup(payload) {
    const input = d.querySelector('input[onchange="importData(event)"]');
    Object.defineProperty(input, 'files', { configurable: true, value: [new w.File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' })] });
    input.dispatchEvent(new w.Event('change', { bubbles: true }));
    await wait();
  }
  confirmAnswer = false;
  await importBackup({ ...backup, notes: [] });
  assert.equal(read('notes').length, 1, 'Cancelled import preserves data');
  confirmAnswer = true;
  let rejectOnce = true;
  w.Storage.prototype.setItem = function(key, value) { if (rejectOnce && key === 'ilm-yolida-notes') { rejectOnce = false; throw new Error('Quota'); } return originalSet.call(this, key, value); };
  await importBackup({ ...backup, quotes: [], notes: [] });
  w.Storage.prototype.setItem = originalSet;
  assert.equal(read('quotes').length, 1, 'Failed import restores earlier writes');
  assert.equal(read('notes').length, 1);
  await importBackup(backup);
  assert.equal(read('notes').length, 1);
  assert(byId('podcast-video'));
  click('#nav-settings');
  await importBackup({ ...backup, notes: [null] });
  assert.equal(read('notes').length, 1, 'Invalid import preserves data');
  click('[onclick="startFreshParticipant()"]');
  assert.equal(w.getComputedStyle(byId('welcome')).display, 'grid');
  assert.equal(read('notes'), null);
  assert.equal(byId('first-name').value, '');
  assert.equal(byId('agree').checked, false);
  assert(byId('filter-all').classList.contains('active'));
  w.localStorage.setItem('ilm-yolida-notes', '[null]');
  w.localStorage.setItem('ilm-yolida-quotes', '{}');
  w.localStorage.setItem('ilm-yolida-completed', '{"x":null}');
  w.localStorage.setItem('ilm-yolida-study-video', '{"id":"invalid"}');
  for(const section of ['insights','progress','study','podcasts']) w.openSection(section);

  for (const view of ['videoView()', 'testView()', 'studyView()', 'quotePanel()', 'notePanel()', 'writingsView()', 'progressView()', 'settingsView()']) {
    const host = d.createElement('div'); host.innerHTML = w.eval(view);
    for (const el of host.querySelectorAll('*')) for (const attr of el.attributes) if (/^on/.test(attr.name)) new vm.Script('(function(event){'+attr.value+'})');
  }
  checkErrors();
  console.log('DOM integration: onboarding, menus, search, URL validation, player pause/lifecycle, drafts, notes/quotes, save failures, quizzes, progress, backup export/import, reset and all rendered handlers PASS.');
  const emptyPlayer = players.at(-1);
  emptyPlayer.getCurrentTime = undefined;
  emptyPlayer.pauseVideo = undefined;
  w.openPanel('note');
  assert(byId('main').querySelector('.note').textContent.includes('Vaqt belgisi mavjud emas'));
  type('note2-text', 'No timestamp available');
  w.saveNote();
  assert.equal(read('notes').at(-1).timestamp, null);
  checkErrors();
  for (const blocked of [false, true]) {
    const reloadErrors = [];
    const reloadConsole = new VirtualConsole();
    reloadConsole.on('jsdomError', error => reloadErrors.push(error.message));
    const reload = new JSDOM(source.replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, ''), {
      url: 'http://127.0.0.1:4174', runScripts: 'dangerously', virtualConsole: reloadConsole,
      beforeParse(win) {
        win.alert = () => {};
        win.scrollTo = () => {};
        win.HTMLMediaElement.prototype.pause = () => {};
        if (blocked) win.Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
        else {
          win.localStorage.setItem('ilm-yolida-onboarded', 'true');
          win.localStorage.setItem('ilm-yolida-profile', JSON.stringify({ first: 'Returning', last: 'User' }));
        }
      }
    });
    assert.deepEqual(reloadErrors, []);
    const welcome = reload.window.document.getElementById('welcome');
    assert.equal(reload.window.getComputedStyle(welcome).display, blocked ? 'grid' : 'none');
    reload.window.close();
  }
  console.log('Returning-user startup and blocked-storage startup: PASS.');
  dom.window.close();
})().catch(error => { console.error(error); dom.window.close(); process.exitCode = 1; });
