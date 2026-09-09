# Headspace for macOS

A personal local Spotify player based on the original lime-green **Headspace Windows Media Player skin**. The app uses a borderless transparent Cocoa window, the original skin geometry, original bitmap artwork, and a React interface rendered by WKWebView.

## Open

The installed app is `~/Applications/Headspace.app`.

- Purple controls: previous, play/pause, stop, next, visualization.
- Speaker arrows: open or close the sliding panels.
- Button below the seek bar: full music library.
- **View → Original Size / 150% / 200%**: change window size.
- Drag the forehead to move the window. **View → Always on Top** pins it above other windows.

Audio streams inside the app through Spotify's Web Playback SDK and macOS WebKit/FairPlay. No Spotify application, copied client, Apple Events permission, or separate browser player is used. A Spotify Premium account and internet connection are required. The SDK registers a Spotify Connect device named **Headspace**. Playback starts when you choose a track; opening Headspace does not take over another device automatically.

## Spotify connection

Headspace signs in through Hexclave using the existing **Headspace Local** Spotify developer app. Hexclave receives Spotify's callback at `https://api.hexclave.com/api/v1/auth/oauth/callback/spotify`, manages its refresh tokens, and returns a separate PKCE-protected Headspace session through `http://127.0.0.1:4382/callback`.

The Mac Keychain stores the Hexclave session refresh token and a cached Spotify access token. The desktop bundle contains only public project configuration. Spotify's client secret and the Hexclave server key live in the ignored repository-root `.env.local` and Hexclave's server-side configuration. Vite loads `.env.local` from the workspace root and exposes only the `VITE_` public keys. `.env.example` lists the required names without secrets.

Open the library's account button and choose **Reconnect Spotify** to migrate an existing direct-PKCE session. Existing saved sessions remain usable until reconnection. Spotify Premium and developer-app account restrictions still apply; switching the token manager does not remove Spotify's access restrictions.

Search, albums, playlists, liked songs, recent listening, podcasts, queue, devices, private-playlist creation, and playlist additions use Spotify's public Web API. Transport, seek, and volume use the embedded player; shuffle, repeat, and track selection target Headspace's device ID. Original equalizer sliders adjust the spectrum display gain. They do not process Spotify audio. Balance is unavailable through Spotify's interface. Offline downloads, lyrics, the personalized Spotify Home feed, and AI DJ are not reproduced in Headspace's UI.

## Development

This is an npm-workspaces Turborepo. Use Node 24 and run from the repository root:

```sh
npm ci
npm run dev
```

`npm run dev` launches **Headspace Dev** and both Vite servers:

- Player in the native window and browser: `http://127.0.0.1:4383/`
- Landing page: `http://127.0.0.1:4390/`
- Native Spotify callback: `http://127.0.0.1:4382/callback`

Quit the normal Headspace app first because it also owns the Spotify callback port. The launcher detects a conflict and exits without killing another process. React and CSS edits update through Vite HMR in both the native window and browser. Saving Swift source rebuilds and restarts the development window. Ctrl-C stops the processes owned by the launcher.

Use `npm run dev:web` for both browser interfaces without launching a native window, `npm run dev:desktop` for native/player development only, or `npm run dev:site` for the landing page only.

The development app has its own bundle identifier, disabled update menus, and Web Inspector support. Release builds embed the compiled player and accept native bridge calls only from the bundled localhost origin. Development bundles and Sparkle dependencies live under `~/Library/Caches/Headspace/`.

The browser player uses the same components, with native window controls disabled. Mac audio capture and Keychain storage require the native app. Browser Spotify sign-in uses a separate Hexclave session. Hexclave's project allows localhost callbacks, so no additional Spotify redirect URI is needed. Browser tokens stay in session storage. No native credentials are served over HTTP.

## Landing page deployment

The site runs on [Hexclave Deployments](https://hxc-p-53-si-870a3bb506b56ed0c0.fly.dev), in the **Headspace** project owned by **Mantra's Team**. Project ID: `e9d6159c-8a5c-4c2e-8a87-930b204e14ec`.

`hexclave.deploy.ts` defines the public `site` service. Hexclave builds `apps/site/Dockerfile` from the workspace root. The image uses Node 24 and Nitro's `node-server` preset, includes the embedded player, and listens on port 3000. No Xcode or Apple signing credentials are needed by the site build. Run `npm run deploy` with an authenticated Hexclave CLI to publish the current checkout and wait for the deployment result.

`.github/workflows/deploy-site.yml` deploys pushes to `main` after tests, TypeScript, and lint pass. The repository's `HEXCLAVE_SECRET_SERVER_KEY` secret is configured and expires on September 9, 2027. The workflow becomes active when committed and pushed. `apps/site/vercel.json` disables Vercel Git deployments at the same time. Existing Vercel URLs are retained for rollback. Public Mac downloads and signed Sparkle updates remain on GitHub Releases.

## Build

Requires Apple Silicon macOS 14+, Xcode command-line tools, and Node 24+.

```sh
npm ci
npm run desktop:build
```

The Developer ID signed local bundle is written to `~/Library/Caches/Headspace/Build/Headspace.app`. Cache storage avoids iCloud adding Finder metadata that invalidates signatures in the Documents folder.

With Headspace closed, install the built bundle:

```sh
mkdir -p "$HOME/Applications/Headspace.app"
rsync -a --delete "$HOME/Library/Caches/Headspace/Build/Headspace.app/" "$HOME/Applications/Headspace.app/"
xattr -cr "$HOME/Applications/Headspace.app"
codesign --verify --deep --strict "$HOME/Applications/Headspace.app"
```

Builds use the configured Developer ID Application certificate. Public downloads are notarized DMGs with Sparkle updates. On the signing Mac, `npm run release` notarizes the app and DMG, signs the Sparkle feed, and publishes GitHub Release assets. Contributors can use `npm run desktop:build -- --development` for an explicit ad-hoc local build.

## Lists and verification

TanStack Table v9 owns row and column models. TanStack Virtual renders the visible rows plus five rows of overscan in tracks, collections, queue, and the playlist picker. Fixed row heights match the original skin. Panel visibility, visualization, visual effect settings, and playback volume persist locally. Rows retain unique identities for repeated songs, and arrow keys, Page Up/Down, Home, and End navigate the virtualized grid.

```sh
npm test
npm run typecheck
npm run lint
npm run desktop:build
```

The tests cover OAuth/session handling, API errors, catalog parsing, playback context, paginated song lists, duplicate tracks, queue targeting, transport, repeat/shuffle state, and SDK change notifications. Spotify HTTP and SDK responses are mocked. See [Spotify queue behavior and implementation](docs/spotify-queues.md) for the analysis, API limits, and verification notes.

For a repeatable 10,000-row UI check, run `npm run dev:web` and open `http://127.0.0.1:4383/list-benchmark.html`. At 280px height it mounts 15 rows, including overscan. End jumps to Track 10000; selecting it shows its name. Switching the dataset resets the grid to 20 rows. This fixture is excluded from the packaged production entry point.

## Artwork

Original Headspace skin © 2000 Microsoft Corporation; skin design credited to CF / Carolyn Farino. Original bitmaps were decoded from the archived [Headspace.wmz](https://w2krepo.somnolescent.net/Windows%20Media%20Player/Skins/Headspace.wmz). The original WMS/JavaScript is not executed. `apps/desktop/scripts/import-skin.py` reproduces the documented bitmap color-key decoding.

The app preserves the original head, speakers, and drawer artwork. SVG/CSS controls reproduce the original jeweled buttons, embossed icons, ribbed grips, and metallic sliders without enlarging bitmap controls. Earlier generated artwork is preserved in commit `01081d5`.

The landing page is its own TanStack Start app in `apps/site`, deployed to Hexclave. The desktop player uses TanStack Router and Vite in `apps/desktop`. Its packaged resources do not depend on the hosted landing page. Shared Spotify API, OAuth, and playback-selection code lives in `packages/spotify`.

### Visualizations

The gold button opens ten choices, including Spectral bloom, Oscilloscope, and Spectrogram. Speed, glow, color, and freeze controls persist locally. Five effects use `vgpu` and WebGPU. Spectrum modes and the compatibility fallback use Canvas.

On macOS 14.2 or later, **React to Mac audio** connects a private Core Audio tap to the Mac's output. Allow Headspace's system audio request when macOS prompts. Capture includes other apps playing locally. Playback on a remote Spotify Connect device cannot be analyzed by this Mac. Audio is analyzed in memory and is never saved or uploaded. You can turn capture off in the visualization chooser.

The analyzer supplies 64 logarithmic frequency bins, 128 waveform samples, and separate bass, mid, and treble levels at 40 frames per second. Each channel is analyzed separately before combining power, preserving phase-opposed stereo content. The original speaker cone textures flex inside their fixed rims with measured bass. Silent or interrupted capture settles to rest. Reduced motion and freeze stop animation, and hidden views skip rendering.

If capture is unavailable, the chooser shows the failure and offers a retry. macOS audio access is managed in **System Settings → Privacy & Security → Screen & System Audio Recording**. Versions before macOS 14.2 keep the player usable with static visualizations.

With the desktop dev server on port 4383, `/skin-preview.html` inspects the complete skin at multiple scales/backgrounds and `/gpu-check.html` renders all five GPU effects. `node --experimental-transform-types apps/desktop/src/visualizer-check.ts` verifies that each GPU effect responds independently to bass, mids, and treble, then returns to its silent image. Both browser fixtures are excluded from the app build.

Run the native analyzer checks with `xcrun swiftc -O apps/desktop/native/AudioAnalysis.swift apps/desktop/native/tests/AudioAnalysisTests.swift -framework Accelerate -o /tmp/headspace-audio-analysis-tests && /tmp/headspace-audio-analysis-tests`. They verify frequency separation, silence, stereo phase opposition, and bounded output. Launch the built executable with `--audio-diagnostics` to print local capture counters and signal levels to stderr. This optional check does not log audio samples.

## Analytics

Hexclave Analytics captures page views and clicks on the site and in the desktop app. Session replay is disabled. Analytics uses an anonymous cookie session; Spotify credentials stay in the existing Keychain flow. Native callbacks are exchanged without placing OAuth codes in the page URL.
