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

## Deploy

Netlify uses the included configuration:

- Build command: `npm run build`
- Publish directory: `public`

Pushes to the `main` branch automatically deploy the latest version to Netlify.

## Checks

Run `npm test` and `npm run build` before deploying.
