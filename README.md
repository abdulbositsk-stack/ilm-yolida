# Ilm Yo‘lida

The app is a static site. Deploy `index.html` and `assets/` together.

## Local preview

With Node.js installed, run `npm start` from the project directory, then open
http://127.0.0.1:4174 in your browser. Keep the terminal running while testing.
This server serves the images and audio with their correct content types.
YouTube playback needs an internet connection and a video that allows embedding.

## Checks

Run `npm ci`, then `npm test`. The checks parse every inline script and use
jsdom to click through onboarding, navigation, note and quote editing, every
available quiz, and backup export/import. Player pause and errors are tested with
a simulated YouTube API. These checks do not verify real YouTube playback,
native Telegram sharing, or the visual layout in a browser.

Saved data belongs to the current browser and site address. Switching between
localhost, a file URL, and a deployed site uses different storage. Use Settings
to export and restore a backup when moving between them.
