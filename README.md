# Ilm Yo‘lida

YouTube study space with timestamped notes, quotes, curated assessments, and
AI-generated video quizzes in Uzbek. The ordinary study features run in the
browser. AI quizzes additionally require the included server functions.

## Video quizzes

Open **YouTube dars**, enter a video link, and choose **Avtomatik test yaratish**.

1. The server tries the video's existing YouTube captions through Supadata.
2. If captions are missing, it asks Supadata to transcribe the video's audio.
3. If the video is inaccessible, silent, or transcription fails, use
   **Matnni o‘zim joylayman** → **Matndan test yaratish**. This option is always
   available and does not require a Supadata key.

Each successful quiz has 8 multiple-choice questions (4 options each) and 2
open-ended questions, in Latin-script Uzbek. Source text may be another language.
MCQs are scored out of 8; explanations and supporting source excerpts appear
after submission. Open answers are saved, not automatically graded.

The prompt asks for natural, content-specific questions with plausible options.
Server validation checks counts, distinct questions/options, valid answer indices,
and that supporting excerpts occur in the source. This is not a guarantee of
factual or language quality: AI can still make mistakes. Insufficient or garbled
content can be rejected instead of generating a misleading quiz.

Pasted/retrieved text must have at least 80 words and 400 characters, and at most
100,000 characters. For longer videos, paste the relevant section. Automatic
transcription depends on provider access to a public, supported video; private,
restricted, removed, live, or otherwise unsupported videos are not guaranteed.
Videos without meaningful speech cannot produce a meaningful audio-based quiz.

## Enable on Netlify

This is **not yet active without your API keys**. Never put keys in HTML, browser
JavaScript, a commit, or a chat message.

1. Create API keys for OpenAI and Supadata, and check their billing/usage limits.
2. In your Netlify project's environment variables, set `OPENAI_API_KEY` and
   `SUPADATA_API_KEY`. Include the **Functions** scope, when scope selection is
   available. Optionally set `OPENAI_QUIZ_MODEL` (default: `gpt-4.1-mini`).
3. Deploy this repository using the committed `netlify.toml`: build command
   `npm run build`, publish directory `public`, functions directory
   `netlify/functions`, Node.js 22. Redeploy after changing environment variables.
4. Confirm the deploy contains `quiz-create`, `quiz-status`, `quiz-worker`
   (background), and `quiz-cleanup` (scheduled hourly). Check the deploy log for
   both rate-limit rules. Use a Netlify plan supporting background functions and
   Blobs. Uploading only the static files, or GitHub Pages, will not enable AI.
5. Try a captioned video, a public speech video without captions, and pasted text.
   Check that each produces 8+2 sensible Uzbek questions and the expected source
   label. Check Functions logs if a request fails; do not log transcripts or keys.

Generation is asynchronous: `/api/quiz` starts a job, the signed background
worker runs it, and `/api/quiz/:id` reports progress. Netlify Blobs provides shared
job storage. Closing the page does not cancel an already submitted provider job;
return to the same video to resume checking. Quiz requests expire after an hour.
The worker allows about 11 minutes for transcription and 2 minutes for generation.

The create endpoint is limited to 4 requests/minute per IP/domain; polling is
limited to 40. Worker signatures and atomic job claims prevent ordinary duplicate
worker execution. This app has no server-side user accounts: **rate limits are
not a total spending cap or bot-proof protection**. Monitor costs, configure
available provider usage limits, and consider authenticated quotas/CAPTCHA before
opening paid generation to a large audience. Do not activate paid services until
you are comfortable with their costs.

Official integration references:
[Supadata transcript modes](https://docs.supadata.ai/get-transcript),
[OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs),
[Netlify background functions](https://docs.netlify.com/build/functions/background-functions/),
[Netlify environment variables](https://docs.netlify.com/build/functions/environment-variables/),
[Netlify rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/).

## Local preview

With Node.js 22.9+ installed, run `npm ci`, then `npm start` from the project
directory. Open http://127.0.0.1:4174 and keep the terminal running. On Windows,
use `npm.cmd` if PowerShell blocks `npm.ps1`.

For real AI generation, create a local `.env` using `.env.example` and enter your
keys there. `.env` is git-ignored and the server never serves it. Restart the
server after editing it. `npm start` supports the same quiz API and loads `.env`
automatically; local jobs are in memory and disappear when the server restarts.
Without keys, the site still works but AI buttons show a configuration message.
Opening `index.html` directly cannot run the AI backend.

YouTube playback needs an internet connection and a video that allows embedding.

## Checks

Run `npm test`, then `npm run build`. The checks parse page scripts and use
jsdom to click through onboarding, navigation, note and quote editing, every
curated quiz, and backup export/import. Backend tests simulate captions, audio
fallback, asynchronous jobs, provider failures, exact quiz shape, source evidence,
validation, signatures, deduplication, and cleanup. AI UI tests cover scoring,
drafts, saved quizzes, fallback, navigation races, reset, and backup compatibility.
Fixtures are test data, not a fallback served to real users.

All provider calls in automated tests are simulated; no keys or charges are
needed. These checks do **not** verify real provider connectivity, generated Uzbek
quality, deployed Netlify configuration, YouTube playback, native Telegram
sharing, or visual layout in a browser. Complete the live checks above after
configuring keys. The static build publishes only `index.html` and `assets/`.

## Data and privacy

Only the video URL is sent to Supadata. Retrieved/pasted text is sent to OpenAI
to generate the quiz (`store: false`; provider-side handling remains subject to
the provider's policies). Notes, quotes, profile, and learners' answers are not
sent to these AI services by this feature.

Pasted source text is temporarily queued in server job storage, then removed
when the worker loads it. Generated quizzes, including short source excerpts,
remain until expiry/cleanup. The hourly cleanup deletes expired jobs and locks;
monitor this scheduled function. Job status is accessible to anyone possessing
its random, unguessable ID; do not share IDs or paste confidential content.

Source drafts, quizzes, notes, and answers are saved in this browser's local
storage. A new quiz replaces the same video's previous quiz only on success and
after confirmation. Quizzes and submitted answers are included in Settings
backups; unsent drafts and pending jobs are not. Reset removes local quiz data,
but cannot cancel an already running server/provider task.

Saved data belongs to the current browser and site address. Switching between
localhost, a file URL, and a deployed site uses different storage. Use Settings
to export and restore a backup when moving between them.
