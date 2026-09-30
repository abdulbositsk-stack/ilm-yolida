import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuiz, validateInput, validateQuiz, QuizError } from '../server/quiz-service.mjs';
import { memoryStore, startJob, runJob, getJob, readJobInput, signJob, validSignature, cleanupJobs } from '../server/quiz-jobs.mjs';
import { transcript, videoId, fixtureQuiz } from './quiz-fixture.mjs';
const env = { OPENAI_API_KEY: 'test-openai', SUPADATA_API_KEY: 'test-transcript' };
const textInput = { mode: 'text', videoId, title: 'Sample', text: transcript };
const response = (data, status = 200) => Response.json(data, { status });
const modelResponse = quiz => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(quiz) }] }] });

test('pasted text produces validated 8+2 quiz, private structured request and correct shuffled mapping', async () => {
  const calls = [];
  const quiz = await generateQuiz(textInput, { env, fetcher: async (url, options) => { calls.push({url, body:JSON.parse(options.body)}); return response(modelResponse(fixtureQuiz())); } });
  assert.equal(calls.length, 1); assert(calls[0].url.includes('api.openai.com'));
  assert.equal(calls[0].body.store, false); assert.equal(calls[0].body.text.format.strict, true);
  assert(calls[0].body.instructions.includes('Uzbek')); assert(calls[0].body.input[0].content.includes(transcript));
  assert.equal(quiz.questions.length, 8); assert.equal(quiz.reflections.length, 2); assert.equal(quiz.source, 'text');
  quiz.questions.forEach(q => assert.equal(q.options[q.answer], 'Bilimni mustahkamlashga'));
});
test('existing transcript does not request audio generation', async () => {
  const urls = [], stages = [];
  const quiz = await generateQuiz({mode:'auto',videoId}, {env, onStage:async s=>stages.push(s), fetcher:async url=>{urls.push(url);return url.includes('supadata')?response({content:transcript}):response(modelResponse(fixtureQuiz()));}});
  assert.equal(urls.length, 2); assert(urls[0].includes('mode=native')); assert.equal(quiz.source,'transcript'); assert.deepEqual(stages,['transcript','questions']);
});
test('missing captions automatically falls back to audio and polls async transcript job', async () => {
  const stages = [], calls = [];
  const quiz = await generateQuiz({mode:'auto',videoId}, {env, sleep:async()=>{}, onStage:async s=>stages.push(s), fetcher:async url=>{
    calls.push(url);
    if(url.includes('mode=native'))return response({error:'not-found'},404);
    if(url.includes('mode=generate'))return response({jobId:'audio-job'},202);
    if(url.endsWith('/audio-job'))return response({status:'completed',result:{content:[{text:transcript}]}});
    return response(modelResponse(fixtureQuiz()));
  }});
  assert.equal(quiz.source,'audio');assert.equal(calls.length,4);assert.deepEqual(stages,['transcript','audio','questions']);
});
test('silent video, failed audio, malformed model output, refusal and weak source report failures', async () => {
  await assert.rejects(generateQuiz({mode:'auto',videoId},{env,fetcher:async()=>response({content:[]})}),{code:'transcript_unavailable'});
  await assert.rejects(generateQuiz(textInput,{env,fetcher:async()=>response({status:'incomplete'})}),{code:'incomplete'});
  await assert.rejects(generateQuiz(textInput,{env,fetcher:async()=>response({status:'completed',output:[{content:[{type:'refusal'}]}]})}),{code:'refused'});
  await assert.rejects(generateQuiz(textInput,{env,fetcher:async()=>response(modelResponse({usable:false}))}),{code:'insufficient_content'});
  const bad = fixtureQuiz(); bad.questions[0].evidence='An invented quote that does not occur in the source.';
  assert.throws(()=>validateQuiz(bad,transcript),{code:'invalid_quiz'});
  const short = fixtureQuiz(); short.questions.pop();assert.throws(()=>validateQuiz(short,transcript),{code:'invalid_quiz'});
  assert.throws(()=>validateInput({...textInput,text:'Short'}),{code:'too_short'});
  assert.throws(()=>validateInput({...textInput,videoId:'http://127.0.0.1'}),{code:'invalid_input'});
});
test('missing keys fail before contacting services', async () => {
  let calls=0;
  await assert.rejects(generateQuiz(textInput,{env:{},fetcher:async()=>{calls++;}}),{code:'not_configured'});
  assert.equal(calls,0);
});
test('public create endpoint validates origin, size, type and payload', async () => {
  const req = new Request('https://test.netlify.app/api/quiz',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://test.netlify.app'},body:JSON.stringify(textInput)});
  assert.equal((await readJobInput(req)).videoId,videoId);
  await assert.rejects(readJobInput(new Request('https://test.netlify.app/api/quiz',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.test'},body:'{}'})),{code:'origin'});
  await assert.rejects(readJobInput(new Request('https://test.netlify.app/api/quiz',{method:'POST',body:'{}'})),{code:'content_type'});
  await assert.rejects(readJobInput(new Request('https://test.netlify.app/api/quiz')),{code:'method'});
  await assert.rejects(readJobInput(new Request('https://test.netlify.app/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'})),{code:'invalid_input'});
  await assert.rejects(readJobInput(new Request('https://test.netlify.app/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(450001)})),{code:'too_large'});
  assert.throws(()=>validateInput({...textInput,text:transcript.repeat(200)}),{code:'too_long'});
});
test('provider limits do not trigger extra paid audio requests; asynchronous audio failure/timeout are reported', async () => {
  for (const status of [401,402,403,429]) {
    let calls=0;
    await assert.rejects(generateQuiz({mode:'auto',videoId},{env,fetcher:async()=>{calls++;return response({error:'limited'},status);}}),{code:'service_unavailable'});
    assert.equal(calls,1);
  }
  const fetcher=async url=>url.includes('mode=native')?response({},404):url.includes('mode=generate')?response({jobId:'test-job'},202):response({status:'failed'});
  await assert.rejects(generateQuiz({mode:'auto',videoId},{env,fetcher,sleep:async()=>{}}),{code:'transcript_unavailable'});
  let time=0;
  await assert.rejects(generateQuiz({mode:'auto',videoId},{env,now:()=>time,sleep:async()=>{time+=12*60000;},fetcher:async url=>url.includes('mode=native')?response({},404):url.includes('mode=generate')?response({jobId:'test-job'},202):response({status:'active'})}),{code:'transcription_timeout'});
});
test('background jobs preserve state, discard source, prevent duplicate charges and expire', async () => {
  const store=memoryStore();let launched, calls=0, time=100;
  const job=await startJob(textInput,{store,env,now:()=>time,launch:async(id,sig)=>{launched={id,sig};}});
  assert(validSignature(job.id,launched.sig,env.OPENAI_API_KEY));assert(!validSignature(job.id,'bad',env.OPENAI_API_KEY));
  assert(!validSignature(job.id,signJob(job.id,'other-key'),env.OPENAI_API_KEY));
  assert.equal((await getJob(job.id,{store,now:()=>time})).input,undefined);
  const generate=async(input,{onStage})=>{calls++;assert.equal(input.text,transcript);await onStage('questions');return {...fixtureQuiz(),videoId};};
  await Promise.all([runJob(job.id,{store,env,generate,now:()=>time}),runJob(job.id,{store,env,generate,now:()=>time})]);
  assert.equal(calls,1);assert.equal((await getJob(job.id,{store,now:()=>time})).status,'completed');
  assert.equal((await store.get('job/'+job.id)).input,undefined);
  time+=3600001;await cleanupJobs(store,()=>time);await assert.rejects(getJob(job.id,{store,now:()=>time}),{code:'expired'});
});
test('worker failure is visible with manual fallback and no transcript disclosure', async () => {
  const store=memoryStore(), job=await startJob(textInput,{store,env,launch:async()=>{}});
  await runJob(job.id,{store,env,generate:async()=>{throw new QuizError('unavailable','Matnni joylang.',422);}});
  const result=await getJob(job.id,{store});assert.equal(result.status,'failed');assert.equal(result.error,'Matnni joylang.');assert.equal(result.input,undefined);
});
