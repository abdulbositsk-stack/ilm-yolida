const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8').replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, '');
const script = fs.readFileSync('assets/study-quiz.js', 'utf8');
const jobId = '9f8c3a1a-b45d-4dd3-9fe3-b4c102ab3242';
const otherId = 'nHhKFBYJJm0';
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const ok = data => ({ ok: true, status: 200, json: async () => data });

(async () => {
  const { storedQuiz, transcript, videoId } = await import('./quiz-fixture.mjs');
  const errors = [], alerts = [], calls = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  let fetcher = () => { throw new Error('Unexpected network request'); }, downloaded;
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:4174', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = () => {};
      w.HTMLMediaElement.prototype.pause = () => {};
      w.HTMLMediaElement.prototype.play = () => Promise.resolve();
      w.HTMLAnchorElement.prototype.click = () => {};
      w.alert = text => alerts.push(text); w.confirm = () => true;
      w.URL.createObjectURL = blob => { downloaded = blob; return 'blob:test'; };
      w.URL.revokeObjectURL = () => {};
      w.fetch = async (url, options) => { calls.push({url,options}); return fetcher(url, options); };
      w.YT = { Player: class { destroy() {} pauseVideo() {} getCurrentTime() { return 30; } } };
      w.localStorage.setItem('ilm-yolida-onboarded', 'true');
      w.localStorage.setItem('ilm-yolida-profile', JSON.stringify({first:'Quiz',last:'Tester'}));
      w.localStorage.setItem('ilm-yolida-study-video', JSON.stringify({id:videoId,title:'Test video'}));
    }
  });
  const w = dom.window, d = w.document;
  const read = key => JSON.parse(w.localStorage.getItem('ilm-yolida-' + key));
  const get = id => { const el=d.getElementById(id); assert(el,'Missing '+id); return el; };
  const input = (id,text) => { get(id).value=text;get(id).dispatchEvent(new w.Event('input',{bubbles:true})); };
  const sourceButton = mode => d.querySelector(`[onclick="requestStudyQuiz('${mode}')"]`);
  const completed = (quiz=storedQuiz()) => ok({id:jobId,videoId:quiz.videoId,status:'completed',quiz});
  const showVideo = id => {w.localStorage.setItem('ilm-yolida-study-video',JSON.stringify({id,title:'Test video'}));w.openSection('study');};
  const blobText = blob => new Promise(resolve => {const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});
  try {
    w.eval(script);w.openSection('study');
    assert(sourceButton('auto'));assert(sourceButton('text'));
    input('quiz-source-text','Too short');sourceButton('text').click();
    assert.equal(calls.length,0);assert(get('quiz-text-details').open);assert(d.querySelector('.quiz-error'));

    let gets=0;
    fetcher=async(url,options)=>options?.method==='POST'?ok({id:jobId}):++gets===1?ok({videoId,status:'running',stage:'audio'}):completed();
    sourceButton('auto').click();await tick();
    assert(sourceButton('auto').disabled);assert(d.querySelector('.quiz-job-status').textContent.includes('audiosi'));
    assert.equal(JSON.parse(calls[0].options.body).mode,'auto');
    w.pauseStudyQuizPoll();assert(!sourceButton('auto').disabled);
    w.resumeStudyQuizPoll();await tick();
    assert.equal(d.querySelectorAll('#study-quiz-form .question').length,8);
    assert.equal(d.querySelectorAll('#study-quiz-form .reflection').length,2);
    assert.equal(d.querySelectorAll('.quiz-feedback').length,0,'Answers hidden before submission');
    assert.equal(read('study-quizzes')[videoId].quiz.questions.length,8);
    assert.equal(Object.keys(read('quiz-jobs')).length,0);
    get('study-quiz-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    assert(get('study-answer-status').textContent.includes('Barcha'));
    d.querySelector('input[name="ai-q0"][value="0"]').click();
    input('ai-reflection-0','My <first> thought');
    w.openSection('insights');w.openSection('study');
    assert(d.querySelector('input[name="ai-q0"][value="0"]').checked);
    assert.equal(get('ai-reflection-0').value,'My <first> thought');
    storedQuiz().questions.forEach((q,i)=>d.querySelector(`input[name="ai-q${i}"][value="${i===0?1:q.answer}"]`).click());
    input('ai-reflection-1','A practical example');w.submitStudyQuiz();
    assert(d.querySelector('.result').textContent.includes('7/8'));
    assert.equal(d.querySelectorAll('.quiz-feedback').length,8);
    assert.equal(read('study-quizzes')[videoId].attempt.reflections[0],'My <first> thought');
    assert.equal(get('ai-reflection-0').readOnly,true);
    w.openSection('settings');w.exportData();
    const backup=JSON.parse(await blobText(downloaded));
    assert(backup.studyQuizzes[videoId].attempt);w.validateBackup(backup);
    const legacy={...backup};delete legacy.studyQuizzes;w.validateBackup(legacy);
    assert.throws(()=>w.validateBackup({...backup,studyQuizzes:{[videoId]:{quiz:{}}}}));
    const fileInput=d.querySelector('input[onchange="importData(event)"]');
    Object.defineProperty(fileInput,'files',{value:[new w.File([JSON.stringify(backup)],'backup.json')]});
    fileInput.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
    assert.equal(read('study-quizzes')[videoId].attempt.answers.length,8);
    w.openSection('study');w.retryStudyQuiz();
    assert(!read('study-quizzes')[videoId].attempt);assert.equal(d.querySelectorAll('input[name^="ai-q"]:checked').length,0);

    // Errors preserve old quizzes and pasted source; manual fallback then succeeds.
    input('quiz-source-text',transcript);
    fetcher=async()=>({ok:false,status:503,json:async()=>({error:'AI test xizmati hali ulanmagan.'})});
    sourceButton('auto').click();await tick();assert(get('quiz-text-details').open);
    assert.equal(get('quiz-source-text').value,transcript);assert(read('study-quizzes')[videoId]);
    fetcher=async(url,options)=>options?.method==='POST'?ok({id:jobId}):completed();
    sourceButton('text').click();await tick();
    const lastPost=calls.filter(c=>c.options?.method==='POST').at(-1);
    assert.equal(JSON.parse(lastPost.options.body).text,transcript);assert.equal(JSON.parse(lastPost.options.body).mode,'text');
    assert.equal(d.querySelectorAll('#study-quiz-form .question').length,8);

    // Ignore a stale poll after navigating to a different video, then resume it.
    let finishPoll;
    fetcher=async(url,options)=>options?.method==='POST'?ok({id:jobId}):new Promise(resolve=>{finishPoll=resolve;});
    sourceButton('auto').click();await tick();showVideo(otherId);finishPoll(completed());await tick();
    assert.equal(get('study-quiz-body').querySelectorAll('.question').length,0);
    fetcher=async()=>completed();showVideo(videoId);await tick();
    assert.equal(Object.keys(read('quiz-jobs')).length,0);
    assert(get('study-quiz-form'));

    // A pending POST can finish while navigating; it remains attached to its video.
    let finishCreate;
    fetcher=async(url,options)=>options?.method==='POST'?new Promise(resolve=>{finishCreate=resolve;}):completed();
    sourceButton('auto').click();w.openSection('insights');w.openSection('study');
    assert(sourceButton('auto').disabled);finishCreate(ok({id:jobId}));await tick();
    assert(!sourceButton('auto').disabled);assert(get('study-quiz-form'));

    // HTML output is escaped and every rendered inline handler compiles.
    const unsafe=storedQuiz();unsafe.questions[0].question='<img src=x onerror=alert(1)>';
    w.localStorage.setItem('ilm-yolida-study-quizzes',JSON.stringify({[videoId]:{quiz:unsafe},[otherId]:{quiz:{...storedQuiz(),videoId:otherId}}}));
    w.openSection('study');assert.equal(d.querySelectorAll('#study-quiz-body img').length,0);
    for(const el of get('study-quiz-body').querySelectorAll('*'))for(const attr of el.attributes)if(/^on/.test(attr.name))new vm.Script('(function(event){'+attr.value+'})');
    w.clearStudyVideo();assert(d.querySelector('.quiz-library'));w.openSavedStudyQuiz(videoId);assert(get('study-quiz-form'));

    // The CDN can send a non-JSON rate-limit response.
    fetcher=async()=>({ok:false,status:429,json:async()=>{throw new Error('Not JSON');}});
    sourceButton('auto').click();await tick();assert(d.querySelector('.quiz-error').textContent.includes('Bir daqiqadan'));

    // Reset/import must invalidate in-flight create calls, not resurrect old data.
    fetcher=async()=>new Promise(resolve=>{finishCreate=resolve;});
    sourceButton('auto').click();w.startFreshParticipant();finishCreate(ok({id:jobId}));await tick();
    assert.equal(read('study-quizzes'),null);assert.equal(read('quiz-jobs'),null);
    assert.equal(read('draft-quiz-source-'+videoId),null);
    assert.deepEqual(errors,[]);
    console.log('AI quiz UI: 8+2 rendering, grade/feedback, drafts, manual fallback, errors, source escaping, backup/legacy restore, navigation races, resume and reset PASS (simulated providers).');
  } finally {dom.window.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
