const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(match => !/\bsrc=/.test(match[1]));
for (const [index, match] of scripts.entries()) {
  new vm.Script(match[2], { filename: `inline-script-${index + 1}.js` });
}
console.log(`All ${scripts.length} inline scripts parse successfully.`);

// Run the real page scripts with a small DOM substitute; no network or user data.
const nodes = new Map();
function element(id) {
  if (!nodes.has(id)) {
    const classes = new Set();
    nodes.set(id, {
      value: '', checked: false, files: [], innerHTML: '', textContent: '',
      style: { setProperty() {} }, dataset: {},
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
      setAttribute() {}, appendChild() {}, focus() {},
      play: () => Promise.resolve(), pause() {},
      querySelector: selector => element(selector)
    });
  }
  return nodes.get(id);
}
const data = new Map();
const alerts = [];
const context = vm.createContext({
  console, URL, Date, setTimeout,
  location: { protocol: 'http:', origin: 'http://localhost:4173' },
  localStorage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) },
  alert: message => alerts.push(message),
  innerWidth: 1280, innerHeight: 800, scrollTo() {}, addEventListener() {},
  document: {
    getElementById: element,
    querySelector: element,
    querySelectorAll: selector => selector === '.step' ? [1, 2, 3, 4].map(n => element('welcome-' + n)) : [],
    createElement: () => element('created'),
    head: element('head'), body: element('body'), documentElement: element('root')
  }
});
context.window = context;
for (const match of scripts) vm.runInContext(match[2], context);
const run = source => vm.runInContext(source, context);
assert.equal(typeof context.showWelcome, 'function');
run('showWelcome(2)');
assert(element('welcome-2').classList.contains('active'));
run('showWelcome(3)');
assert(element('welcome-3').classList.contains('active'));
element('first-name').value = 'Test';
element('last-name').value = 'User';
run('showWelcome(4)');
assert(element('welcome-4').classList.contains('active'));
element('agree').checked = true;
run('enterApp()');
assert.equal(element('welcome').style.display, 'none');
assert(element('main').innerHTML.includes('podcast-video'));
run("openSection('study')");
assert(element('main').innerHTML.includes('study-url'));
element('study-url').value = 'https://youtu.be/Nc7Oe_oDC58';
element('study-title').value = 'Test video';
run('loadStudyVideo()');
assert(element('main').innerHTML.includes('/embed/Nc7Oe_oDC58'));
run('state.panelTime = 65');
element('note2-text').value = 'A saved thought';
run('saveNote()');
assert.equal(JSON.parse(data.get('ilm-yolida-notes'))[0].timestamp, '1:05');
element('quote-text').value = 'A saved quote';
element('quote-font').value = 'Georgia';
run('saveQuote()');
run("openSection('insights')");
assert(element('main').innerHTML.includes('A saved quote'));
run("setWritingTab('notes')");
assert(element('main').innerHTML.includes('A saved thought'));
assert(element('main').innerHTML.includes('Test video'));
assert.equal(alerts.length, 0);
console.log('Welcome steps, app entry, navigation, YouTube loading and saved writings: PASS (DOM substitute).');

// Inline event handlers must also compile after template strings are rendered.
for (const view of ['quotePanel()', 'notePanel()', 'studyView()', 'writingsView()']) {
  for (const match of run(view).matchAll(/\bon\w+="([^"]*)"/g)) {
    new vm.Script('(function(event){' + match[1] + '})', { filename: view + '-handler' });
  }
}
console.log('Rendered writing and study button handlers: PASS.');
