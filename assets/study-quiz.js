/* AI quizzes are kept separate from the curated podcast assessments. */
const studyQuizUI = { token: 0, timer: null, busy: false, error: '', stage: '', videoId: null, requests: {} };
const studyQuizLabels = { queued: 'Navbatda…', transcript: 'YouTube transkripti qidirilmoqda…', audio: 'Transkript topilmadi. Video audiosi matnga aylantirilmoqda…', questions: '8 ta test va 2 ta xulosa savoli o‘zbek tilida tayyorlanmoqda…' };
function quizMap(key) { const value = storage.get(key, {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function validStudyQuiz(quiz) {
  return quiz && /^[A-Za-z0-9_-]{11}$/.test(quiz.videoId || '') && typeof quiz.title === 'string' && typeof quiz.videoTitle === 'string' && typeof quiz.generatedAt === 'string' && ['text','transcript','audio'].includes(quiz.source) && Array.isArray(quiz.questions) && quiz.questions.length === 8 && quiz.questions.every(q => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string') && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4 && typeof q.explanation === 'string' && typeof q.evidence === 'string') && Array.isArray(quiz.reflections) && quiz.reflections.length === 2 && quiz.reflections.every(r => r && typeof r.question === 'string' && typeof r.guidance === 'string');
}
function validStudyAttempt(attempt) {
  return attempt && Array.isArray(attempt.answers) && attempt.answers.length === 8 && attempt.answers.every(a => Number.isInteger(a) && a >= 0 && a <= 3) && Array.isArray(attempt.reflections) && attempt.reflections.length === 2 && attempt.reflections.every(r => typeof r === 'string') && typeof attempt.finishedAt === 'string';
}
function validStudyRecords(records) {
  return records && typeof records === 'object' && !Array.isArray(records) && Object.entries(records).every(([id, r]) => r && validStudyQuiz(r.quiz) && r.quiz.videoId === id && (r.attempt == null || validStudyAttempt(r.attempt)));
}
function studyQuizRecords() { const records = quizMap('ilm-yolida-study-quizzes'); return Object.fromEntries(Object.entries(records).filter(([id,r]) => r && validStudyQuiz(r.quiz) && r.quiz.videoId === id && (!r.attempt || validStudyAttempt(r.attempt)))); }
function currentStudyRecord() { return studyQuizRecords()[studyVideo()?.id] || null; }
function studyQuizPanel() {
  if (!studyVideo()) return studyQuizLibrary('');
  return `<section class="card study-quiz-card" aria-labelledby="study-quiz-heading"><div class="eyebrow">Tushunganingizni tekshiring</div><h2 id="study-quiz-heading">Video asosida test</h2><p class="sub">8 ta variantli savol + 2 ta ochiq xulosa savoli. Barchasi o‘zbek tilida.</p><div id="study-quiz-body"></div></section>`;
}
function cancelStudyQuizPoll() {
  studyQuizUI.token++; clearTimeout(studyQuizUI.timer); studyQuizUI.timer = null; studyQuizUI.busy = false;
}
function resetStudyQuizRequests() { cancelStudyQuizPoll(); studyQuizUI.requests = {}; }
function mountStudyQuiz() {
  if (!document.getElementById('study-quiz-body') || !studyVideo()) return;
  studyQuizUI.videoId = studyVideo().id; studyQuizUI.error = ''; studyQuizUI.stage = '';
  const pending = quizMap('ilm-yolida-quiz-jobs')[studyVideo().id];
  const creating = studyQuizUI.requests[studyVideo().id];
  if (creating) creating.watch = true;
  studyQuizUI.busy = Boolean(pending || creating);
  paintStudyQuiz();
  if (pending && !creating) pollStudyQuiz(pending, studyQuizUI.token, studyVideo().id);
}
function paintStudyQuiz() {
  const host = document.getElementById('study-quiz-body'), video = studyVideo();
  if (!host || !video || video.id !== studyQuizUI.videoId) return;
  const record = currentStudyRecord();
  const pending = quizMap('ilm-yolida-quiz-jobs')[video.id];
  host.innerHTML = `<div class="tools"><button class="primary" type="button" onclick="requestStudyQuiz('auto')" ${studyQuizUI.busy?'disabled':''}>${record?'Yangi test yaratish':'Avtomatik test yaratish'}</button>${pending&&!studyQuizUI.busy?'<button class="ghost" type="button" onclick="resumeStudyQuizPoll()">Natijani tekshirish</button>':''}</div>
    <p class="settings-note">Avval tayyor transkript tekshiriladi. U bo‘lmasa, audio asosida matn olinadi. Uzoq videolar bir necha daqiqa vaqt olishi mumkin.</p>
    <p class="quiz-job-status" role="status" aria-live="polite">${esc(studyQuizUI.busy?(studyQuizLabels[studyQuizUI.stage]||studyQuizLabels.queued):'')}</p>
    ${studyQuizUI.error?`<p class="quiz-error" role="alert">${esc(studyQuizUI.error)}</p>`:''}
    ${studyQuizUI.busy?'<button class="chip-btn" type="button" onclick="pauseStudyQuizPoll()">Kutishni to‘xtatish</button>':''}
    <details id="quiz-text-details" ${studyQuizUI.error?'open':''}><summary>Matnni o‘zim joylayman</summary><label class="quiz-text-label" for="quiz-source-text">Video transkripti yoki nutq matni</label><textarea id="quiz-source-text" class="quiz-source-text" maxlength="100000" placeholder="Video matnini shu yerga joylang (kamida 80 so‘z va 400 belgi)…" oninput="saveStudySource(this.value)"></textarea><p class="settings-note">Matn istalgan tilda bo‘lishi mumkin. Savollar o‘zbek tilida yaratiladi. 100 000 belgigacha; uzunroq video uchun kerakli bo‘limni tanlang.</p><button class="ghost" type="button" onclick="requestStudyQuiz('text')" ${studyQuizUI.busy?'disabled':''}>Matndan test yaratish</button></details>
    <p class="settings-note">Test yaratishda video havolasi Supadata xizmatiga, transkript yoki joylangan matn esa OpenAI xizmatiga yuboriladi. AI savollarida xato bo‘lishi mumkin.</p>
    ${record?studyQuizForm(record):''}${studyQuizLibrary(video.id)}`;
  const source = storage.get('ilm-yolida-draft-quiz-source-'+video.id, '');
  document.getElementById('quiz-source-text').value = typeof source === 'string' ? source : '';
  restoreStudyAnswers(record);
}
function studyQuizLibrary(active) {
  const records = Object.values(studyQuizRecords()).filter(r=>r.quiz.videoId!==active);
  return records.length?`<details class="quiz-library"><summary>Saqlangan boshqa testlar (${records.length})</summary>${records.map(r=>`<button class="pod" type="button" onclick="openSavedStudyQuiz('${r.quiz.videoId}')">${esc(r.quiz.videoTitle)}${r.attempt?' · Yakunlangan':''}</button>`).join('')}</details>`:'';
}
function openSavedStudyQuiz(id) {
  const record = studyQuizRecords()[id]; if(!record)return;
  if(storage.set('ilm-yolida-study-video',{id,title:record.quiz.videoTitle,url:'https://www.youtube.com/watch?v='+id}))openSection('study');
}
function saveStudySource(text) {
  try { localStorage.setItem('ilm-yolida-draft-quiz-source-'+studyVideo().id, JSON.stringify(text)); } catch {}
}
function quizFetchMessage(status) {
  return status===429?'Juda ko‘p so‘rov yuborildi. Bir daqiqadan so‘ng qayta urinib ko‘ring.':'Test xizmatiga ulanish imkoni bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.';
}
async function quizApi(url, options = {}) {
  const controller = new AbortController(), timeout = setTimeout(()=>controller.abort(),30000);
  try {
    const response = await fetch(url,{...options,signal:controller.signal});
    let data; try { data = await response.json(); } catch { throw new Error(response.status===429?quizFetchMessage(429):'Test xizmati bu manzilda mavjud emas. Saytni server orqali oching yoki administratorga murojaat qiling.'); }
    if(!response.ok)throw new Error(data.error||quizFetchMessage(response.status));
    return data;
  } catch(error) { if(error.name==='AbortError'||error.name==='TypeError')throw new Error('Ulanish uzildi. Keyinroq natijani tekshiring yoki qayta urinib ko‘ring.');throw error; }
  finally {clearTimeout(timeout);}
}
async function requestStudyQuiz(mode) {
  const video = studyVideo(); if(!video||studyQuizUI.busy)return;
  const text = document.getElementById('quiz-source-text')?.value.trim()||'';
  saveStudySource(text);
  if(mode==='text'&&(text.length<400||text.split(/\s+/).length<80)){studyQuizUI.error='Kamida 80 so‘z va 400 belgidan iborat video matnini kiriting.';paintStudyQuiz();return;}
  if(currentStudyRecord()&&!confirm('Yangi test tayyor bo‘lgach, shu videoning avvalgi testi va natijasi almashtiriladi. Davom etasizmi?'))return;
  if(location.protocol==='file:'){studyQuizUI.error='AI test uchun dasturni server yoki jonli sayt orqali oching.';paintStudyQuiz();return;}
  cancelStudyQuizPoll();
  const request = { watch: true }; studyQuizUI.requests[video.id] = request;
  const watching = () => request.watch && studyQuizUI.videoId === video.id && document.getElementById('study-quiz-body');
  studyQuizUI.busy=true;studyQuizUI.error='';studyQuizUI.stage=mode==='auto'?'transcript':'questions';paintStudyQuiz();
  try{
    const data=await quizApi('/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({videoId:video.id,title:video.title,mode,text:mode==='text'?text:''})});
    if(studyQuizUI.requests[video.id]!==request)return;
    if(typeof data.id!=='string'||!/^[a-f0-9-]{36}$/.test(data.id))throw new Error('Test xizmati noto‘g‘ri javob berdi.');
    const pending=quizMap('ilm-yolida-quiz-jobs');pending[video.id]={id:data.id,startedAt:Date.now()};storage.set('ilm-yolida-quiz-jobs',pending);
    delete studyQuizUI.requests[video.id];
    if(watching())pollStudyQuiz(pending[video.id],studyQuizUI.token,video.id);
    else paintStudyQuiz();
  }catch(error){if(studyQuizUI.requests[video.id]===request){delete studyQuizUI.requests[video.id];if(watching()){studyQuizUI.busy=false;studyQuizUI.error=error.message;paintStudyQuiz();}}}
}
function forgetStudyJob(videoId) {const jobs=quizMap('ilm-yolida-quiz-jobs');delete jobs[videoId];storage.set('ilm-yolida-quiz-jobs',jobs);}
async function pollStudyQuiz(job,token,videoId) {
  if(token!==studyQuizUI.token)return;
  if(!job||typeof job.id!=='string'||!Number.isFinite(job.startedAt)){forgetStudyJob(videoId);studyQuizUI.busy=false;paintStudyQuiz();return;}
  if(Date.now()-job.startedAt>3600000){forgetStudyJob(videoId);studyQuizUI.busy=false;studyQuizUI.error='So‘rov muddati tugadi. Yangi test yarating.';paintStudyQuiz();return;}
  try{
    const data=await quizApi('/api/quiz/'+encodeURIComponent(job.id));
    if(token!==studyQuizUI.token)return;
    if(data.videoId!==videoId)throw new Error('Test boshqa videoga tegishli. Qayta urinib ko‘ring.');
    if(data.status==='completed'){
      if(!validStudyQuiz(data.quiz)||data.quiz.videoId!==videoId)throw new Error('Test formati noto‘g‘ri. Qayta urinib ko‘ring.');
      const records=studyQuizRecords();records[videoId]={quiz:data.quiz};
      if(!storage.set('ilm-yolida-study-quizzes',records)){studyQuizUI.busy=false;studyQuizUI.error='Testni saqlab bo‘lmadi. Brauzer xotirasini tekshirib, natijani qayta oling.';paintStudyQuiz();return;}
      try{localStorage.removeItem('ilm-yolida-draft-quiz-answers-'+videoId)}catch{}
      forgetStudyJob(videoId);studyQuizUI.busy=false;studyQuizUI.error='';paintStudyQuiz();return;
    }
    if(data.status==='failed'){forgetStudyJob(videoId);studyQuizUI.busy=false;studyQuizUI.error=data.error||'Test yaratilmadi. Video matnini joylang.';paintStudyQuiz();return;}
    if(!['queued','running'].includes(data.status))throw new Error('Test holatini aniqlab bo‘lmadi.');
    studyQuizUI.stage=data.stage;
    const status=document.querySelector('.quiz-job-status');if(status)status.textContent=studyQuizLabels[data.stage]||studyQuizLabels.queued;
    studyQuizUI.timer=setTimeout(()=>pollStudyQuiz(job,token,videoId),3000);
  }catch(error){if(token===studyQuizUI.token){studyQuizUI.busy=false;studyQuizUI.error=error.message;paintStudyQuiz();}}
}
function pauseStudyQuizPoll(){const request=studyQuizUI.requests[studyVideo()?.id];if(request)request.watch=false;cancelStudyQuizPoll();studyQuizUI.error='Kuzatish to‘xtatildi. Test serverda tayyorlanishda davom etishi mumkin. Natijani keyin tekshiring yoki matndan yangi test yarating.';paintStudyQuiz();}
function resumeStudyQuizPoll(){const video=studyVideo(),job=quizMap('ilm-yolida-quiz-jobs')[video?.id];if(!job)return;cancelStudyQuizPoll();studyQuizUI.busy=true;studyQuizUI.error='';paintStudyQuiz();pollStudyQuiz(job,studyQuizUI.token,video.id);}
function studyQuizForm(record) {
  const quiz=record.quiz,done=record.attempt,score=done?quiz.questions.filter((q,i)=>q.answer===done.answers[i]).length:0;
  return `<div class="study-generated-test"><h3>${esc(quiz.title)}</h3><p class="settings-note">Manba: ${quiz.source==='audio'?'audio transkripsiyasi':quiz.source==='text'?'siz joylagan matn':'YouTube transkripti'} · AI yaratgan test</p>${done?`<div class="result"><h3>Natija: ${score}/8</h3><p>2 ta ochiq javob saqlandi. Shaxsiy xulosalar avtomatik baholanmaydi.</p></div>`:''}<form id="study-quiz-form" onsubmit="event.preventDefault();submitStudyQuiz()" oninput="saveStudyAnswers()" onchange="saveStudyAnswers()">${quiz.questions.map((q,i)=>`<article class="question"><div class="question-number">${i+1}-savol</div><h3>${esc(q.question)}</h3><div class="options">${q.options.map((o,j)=>`<label class="option"><input type="radio" name="ai-q${i}" value="${j}" ${done?'disabled':''} ${done?.answers[i]===j?'checked':''}><span>${'ABCD'[j]}. ${esc(o)}</span></label>`).join('')}</div>${done?`<div class="quiz-feedback ${done.answers[i]===q.answer?'correct':'incorrect'}"><b>${done.answers[i]===q.answer?'To‘g‘ri':'Noto‘g‘ri'}. To‘g‘ri javob: ${'ABCD'[q.answer]}</b><p>${esc(q.explanation)}</p><details><summary>Manbadan dalil</summary><blockquote>${esc(q.evidence)}</blockquote></details></div>`:''}</article>`).join('')}${quiz.reflections.map((r,i)=>`<article class="reflection"><div class="question-number">${i+9}-savol · Ochiq savol</div><label for="ai-reflection-${i}">${esc(r.question)}</label><textarea id="ai-reflection-${i}" ${done?'readonly':''} placeholder="O‘z fikringizni misol bilan tushuntiring…">${esc(done?.reflections[i]||'')}</textarea>${done?`<p class="settings-note">Fikrlash uchun yo‘nalish: ${esc(r.guidance)}</p>`:''}</article>`).join('')}<p id="study-answer-status" role="status"></p>${done?'<button class="ghost" type="button" onclick="retryStudyQuiz()">Qayta ishlash</button>':'<button class="primary" type="submit">Javoblarni tekshirish</button>'}</form></div>`;
}
function studyAnswers() {return {answers:Array.from({length:8},(_,i)=>{const el=document.querySelector('input[name="ai-q'+i+'"]:checked');return el?Number(el.value):null;}),reflections:[0,1].map(i=>document.getElementById('ai-reflection-'+i)?.value||'')};}
function saveStudyAnswers(){const video=studyVideo();if(!video||currentStudyRecord()?.attempt)return;try{localStorage.setItem('ilm-yolida-draft-quiz-answers-'+video.id,JSON.stringify(studyAnswers()))}catch{}}
function restoreStudyAnswers(record){if(!record||record.attempt)return;const draft=storage.get('ilm-yolida-draft-quiz-answers-'+studyVideo().id,null);if(!draft||!Array.isArray(draft.answers)||!Array.isArray(draft.reflections))return;draft.answers.forEach((answer,i)=>{if(Number.isInteger(answer)&&answer>=0&&answer<4){const el=document.querySelector('input[name="ai-q'+i+'"][value="'+answer+'"]');if(el)el.checked=true;}});draft.reflections.forEach((text,i)=>{const el=document.getElementById('ai-reflection-'+i);if(el&&typeof text==='string')el.value=text;});}
function submitStudyQuiz(){const record=currentStudyRecord();if(!record||record.attempt)return;const answers=studyAnswers(),status=document.getElementById('study-answer-status');if(answers.answers.some(a=>a===null)||answers.reflections.some(r=>!r.trim())){status.textContent='Barcha 8 ta savolga javob bering va 2 ta xulosani yozing.';return;}const records=studyQuizRecords();records[studyVideo().id]={...record,attempt:{...answers,finishedAt:new Date().toISOString()}};if(storage.set('ilm-yolida-study-quizzes',records)){try{localStorage.removeItem('ilm-yolida-draft-quiz-answers-'+studyVideo().id)}catch{}paintStudyQuiz();}}
function retryStudyQuiz(){if(!confirm('Shu testning avvalgi javoblarini almashtirib, qayta ishlaysizmi?'))return;const records=studyQuizRecords(),id=studyVideo().id;if(records[id]){delete records[id].attempt;if(storage.set('ilm-yolida-study-quizzes',records))paintStudyQuiz();}}
