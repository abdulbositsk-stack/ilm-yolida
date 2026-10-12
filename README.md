# Ilm Yo‘lida

An Uzbek study space for watching curated podcasts and personal YouTube videos,
then saving timestamped notes and quotes.

## YouTube study library

Open **YouTube bilan o‘rganish**, paste a valid YouTube video link, and optionally
give the video a title. While watching, pause at an important moment and save a
note or quote.

Every personal YouTube video with at least one saved note or quote automatically
appears in **Mening yozuvlarim → YouTube videolarim**. Select **Videoni ochish**
there to continue watching and writing for that video.

Notes, quotes, profile data, and progress are saved only in the participant’s
browser. Participants can export a backup from **Sozlamalar** and restore it on
another browser.

## Local preview

With Node.js 22.9+ installed, run:

```sh
npm ci
npm start
```

Then open `http://127.0.0.1:4174`.

## Deploy to Vercel

Import this repository into Vercel. The included `vercel.json` sets the build
command to `npm run build`, serves `public`, configures the quiz API duration,
and schedules expired quiz cleanup.

After importing the project:

1. Create a **private Vercel Blob** store and connect it to this project. Vercel
   uses the connected store for group challenges and quiz jobs.
2. Add `OPENAI_API_KEY`, `SUPADATA_API_KEY`, and `CRON_SECRET` in the Vercel
   project's Environment Variables. `SUPADATA_API_KEY` is only needed for
   automatic transcript mode. `CRON_SECRET` should be a random secret.
3. Deploy the project. Local preview with Vercel's environment uses
   `vercel dev` after linking the project and pulling its environment variables.

The existing Netlify deployment can remain available while the Vercel version
is configured. Vercel Blob starts with empty group and quiz storage; existing
Netlify Blob records are not copied automatically. Participant notes and
progress stored in their browsers remain in those browsers.

## Checks

Run `npm test` and `npm run build` before deploying.
