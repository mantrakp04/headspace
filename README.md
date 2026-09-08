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

The personal developer app is configured for PKCE OAuth using `http://127.0.0.1:4382/callback`. Open the library's account button to connect. The streaming scope is included. No client secret is used. Public Client ID: `05ac56334649404c8878e72b6aefac9a`.

Access and refresh tokens persist in the Mac Keychain. The browser opens Spotify authorization and returns to a server bound only to `127.0.0.1`. OAuth state and the code verifier are checked before token exchange. Do not add tokens, client secrets, or Spotify account files to this repository.

Search, albums, playlists, liked songs, recent listening, podcasts, queue, devices, private-playlist creation, and playlist additions use Spotify's public Web API. Transport, seek, and volume use the embedded player; shuffle, repeat, and track selection target Headspace's device ID. Original equalizer sliders control the decorative visualizer; they do not process Spotify audio. Balance is unavailable through Spotify's interface. Offline downloads, lyrics, the personalized Spotify Home feed, and AI DJ are not reproduced in Headspace's UI.

## Build

Requires Apple Silicon macOS 14+, Xcode command-line tools, and Node 24+.

```sh
npm install
npm run desktop:build
```

The complete signed local bundle is written to `~/Library/Caches/Headspace/Build/Headspace.app`. Cache storage avoids iCloud adding Finder metadata that invalidates signatures in the Documents folder.

With Headspace closed, install the built bundle:

```sh
mkdir -p "$HOME/Applications/Headspace.app"
rsync -a --delete "$HOME/Library/Caches/Headspace/Build/Headspace.app/" "$HOME/Applications/Headspace.app/"
xattr -cr "$HOME/Applications/Headspace.app"
codesign --force --sign - --identifier local.headspace.player "$HOME/Applications/Headspace.app"
codesign --verify --deep --strict "$HOME/Applications/Headspace.app"
```

This is a personal local bundle; it has an ad-hoc signature, not an App Store or notarized distribution build.

## Lists and verification

TanStack Table v9 owns row and column models. TanStack Virtual renders the visible rows plus five rows of overscan in tracks, collections, queue, and the playlist picker. Fixed row heights match the original skin. Panel visibility, visualization, visual effect settings, and playback volume persist locally. Rows retain unique identities for repeated songs, and arrow keys, Page Up/Down, Home, and End navigate the virtualized grid.

```sh
npm test
npm run typecheck
npm run lint
npm run desktop:build
```

The 23 tests cover OAuth/session handling, API errors, catalog parsing, playback context, paginated song lists, duplicate tracks, queue targeting, transport, repeat/shuffle state, and SDK change notifications. Spotify HTTP and SDK responses are mocked. See [Spotify queue behavior and implementation](docs/spotify-queues.md) for the analysis, API limits, and verification notes.

For a repeatable 10,000-row UI check, run `npm run desktop:dev -- --port 4383` and open `http://127.0.0.1:4383/list-benchmark.html`. At 280px height it mounts 15 rows, including overscan. End jumps to Track 10000; selecting it shows its name. Switching the dataset resets the grid to 20 rows. This fixture is excluded from the packaged production entry point.

## Artwork

Original Headspace skin © 2000 Microsoft Corporation; skin design credited to CF / Carolyn Farino. Original bitmaps were decoded from the archived [Headspace.wmz](https://w2krepo.somnolescent.net/Windows%20Media%20Player/Skins/Headspace.wmz). The original WMS/JavaScript is not executed. `desktop/scripts/import-skin.py` reproduces the documented bitmap color-key decoding.

The app preserves the original head, speakers, and drawer artwork. SVG/CSS controls reproduce the original jeweled buttons, embossed icons, ribbed grips, and metallic sliders without enlarging bitmap controls. Earlier generated artwork is archived in `desktop/artwork-studies` and is excluded from the app bundle.

The earlier Sunroom web prototype remains in the root web-app directories. The local desktop build uses `desktop/index.html` and does not publish or depend on that hosted site.

### Visualizations

The gold button opens seven choices: classic bars, liquid chrome, aurora, blank screen, hyperspace, light ribbons, and star flight. Speed, glow, color, and freeze controls persist locally. Five effects use `vgpu` and WebGPU; classic bars and the compatibility fallback use Canvas. Effects are generative: Spotify does not expose decoded audio for spectrum analysis. Reduced motion and frozen scenes stop advancing, and hidden views skip rendering.

With the desktop dev server on port 4383, `/skin-preview.html` inspects the complete skin at multiple scales/backgrounds and `/gpu-check.html` renders all five GPU effects. `node --experimental-transform-types desktop/src/visualizer-check.ts` verifies shader compilation and changing, nonblack GPU output. Both browser fixtures are excluded from the app build.
