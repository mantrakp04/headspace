# Sunroom

A Headspace-inspired personal Spotify player built with React, Vinext, and Spotify's Web Playback SDK. The app uses original artwork and its own name.

## Run locally

Use Node 24 or newer for the native TypeScript tests.

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 4382
```

Open `http://127.0.0.1:4382/`. The app redirects `localhost` to the numeric loopback address Spotify permits.

## Connect Spotify

1. Create an app at https://developer.spotify.com/dashboard with Web API and Web Playback SDK enabled.
2. Register the exact redirect shown in Sunroom's Connect Spotify panel. For local use this is `http://127.0.0.1:4382/`. For the private deployment it is `https://sunroom-listening.barrellube.chatgpt.site/`.
3. Add your Spotify account to the app's allowed users when required. A Spotify Premium subscription is required for full playback.
4. Paste the public Client ID into Sunroom and continue through Spotify's authorization screen. No client secret is needed.

OAuth uses PKCE with a random state and ten-minute sign-in expiry. The Client ID is saved in local storage. Access and refresh tokens stay in session storage for the current tab and are cleared on disconnect. Requests go directly from the browser to Spotify. The server stores no Spotify credentials.

Browser playback uses Spotify's DRM-enabled SDK. If an embedded browser does not support it, use a supported full browser such as Chrome or Safari, or choose an existing Spotify Connect device from Devices. Connecting alone does not transfer or start playback.

## Included

- Search songs, albums, artists, playlists, and podcasts.
- Browse saved playlists, albums, followed artists, shows, liked songs, and recent listening with pagination.
- Open album tracks, artist albums, podcast episodes, and accessible playlist items.
- Full-track playback, pause, skip, seek, shuffle, repeat, volume, and device selection.
- Create private playlists, add tracks, like or unlike songs, and add to the Spotify queue.
- Sleep timer while the browser tab remains open.
- Responsive layouts, keyboard-operable controls, loading states, request errors, and quota backoff.

## Spotify limitations

This is a personal client, not a complete replacement for Spotify's official app. The public APIs do not provide its personalized Home feed, lyrics, AI DJ, or offline downloads. Development-mode access and allowed endpoints can vary by app. Some playlist contents are visible only to owners and collaborators. djay has its own Spotify integration; installing djay does not provide this app with Spotify API access.

Uses the 2026 library URI endpoints and playlist `/items` endpoints. Search uses Spotify's current ten-item page limit.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Tests exercise OAuth PKCE, mismatched or expired sign-in state, refresh coalescing, disconnect races, API authentication retry, quota backoff, response parsing, empty playback responses, and selection past the first 100 tracks. Spotify network responses are mocked. Signed-in audio and browser interaction require a real Spotify account and have not been verified by these tests.

Lint targets application code. The unmodified generated Shadcn catalog and generated `use-mobile` hook are excluded because the starter has existing lint violations. TypeScript still checks them.

The generated dependency tree reported 11 npm audit findings at setup. No forced dependency upgrades were applied.
