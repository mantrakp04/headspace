# Hexclave migration

## Deployment

- Project: Headspace, `e9d6159c-8a5c-4c2e-8a87-930b204e14ec`, owned by Mantra's Team.
- Public site: https://hxc-p-53-si-870a3bb506b56ed0c0.fly.dev
- Verified deployment: `709e9dbe-dcfa-4a10-aeac-b40b7a7b610b`, September 8, 2026 Pacific time.
- Service: `site`, deployment group `headspace`, public HTTP on port 3000, one running instance.
- Remote build: Node 24, npm workspaces, Nitro `node-server`, runtime contains only `.output` and runs as the `node` user.
- CLI: `@hexclave/cli@1.0.114`. SDK: `@hexclave/js@1.0.113`, compatible with the local package release-age policy.

`npm run deploy` uploads the current checkout, including uncommitted source that is not ignored, and waits for the remote deployment result. The initial cloud config was pulled before enabling Deploy. Normal deploys do not push project configuration. Use `hexclave config pull` and compare before a deliberate config push.

A live rollout with `minInstances: 0` failed readiness because the stopped instance was updated but left stopped. Runtime logs confirmed the application started normally once awakened. `minInstances: 1` keeps one instance running so future deployments can verify readiness reliably. The subsequent deployment completed successfully.

The GitHub Actions workflow and `apps/site/vercel.json` are local changes until committed and pushed. Together they move Git deployments from Vercel to Hexclave. The GitHub repository secret `HEXCLAVE_SECRET_SERVER_KEY` is already configured. Its key expires September 9, 2027; replace the GitHub secret before then. No secret value is written to this repository.

The old Vercel project is `prj_Hf2rNLCwI0Z24A12zACwBla1qigq`, with production alias `headspace-theta.vercel.app`. Its existing deployment remains available. GitHub Releases continues hosting the notarized DMG and signed Sparkle feed; the native app does not load its interface from the landing-page host.

## Spotify OAuth finding

Hexclave supports Spotify sign-in and connected-account access tokens, including automatic provider-token refresh. However, [connected accounts cannot use shared OAuth keys](https://docs.hexclave.com/guides/apps/authentication/connected-accounts). Shared Spotify login therefore cannot provide the Web API and streaming tokens Headspace requires.

The existing Spotify developer application is **Headspace Local**, client ID `05ac56334649404c8878e72b6aefac9a`, in development mode. Its configured callback was verified as `http://127.0.0.1:4382/callback`.

Moving desktop OAuth to Hexclave requires configuring that app's client ID and client secret in Hexclave, adding `https://api.hexclave.com/api/v1/auth/oauth/callback/spotify` to Spotify's allowed callbacks, enabling connected accounts, and requesting the player's Spotify scopes. See the [Spotify provider setup](https://docs.hexclave.com/guides/apps/authentication/auth-providers/spotify).

Custom Spotify OAuth is now enabled in Hexclave. The Spotify developer app has both the original loopback callback and the Hexclave callback, and declares Web API and Web Playback SDK use. Hexclave's `customCallbackUrl` is explicitly set to the Hexclave address: live testing showed its default still used `api.stack-auth.com`, which Spotify rejected.

The repository-root `.env.local` contains Spotify client credentials, Hexclave project/API settings, a publishable key, a server key, and the matching Vite public variables. The file is ignored by Git and deployment uploads and has mode `0600`. The local Hexclave key expires September 9, 2027. No private key is present in the compiled desktop web assets.

The desktop opens Hexclave's Spotify authorization endpoint externally with PKCE and validates the loopback callback and OAuth state before exchanging the code. It obtains the provider's Spotify access token separately from the Hexclave identity token. The Keychain stores the Hexclave refresh token with a tagged session, preventing it from being sent to Spotify's token endpoint. Legacy direct sessions remain readable until the user reconnects. Concurrent refresh requests share one exchange; disconnecting invalidates in-flight work.

## Analytics

Hexclave Analytics is enabled in both the checked-in project config and the cloud project. The site initializes `HexclaveClientApp` after hydration; the desktop initializes it after restoring or finishing Spotify authorization. Both establish an anonymous SDK session at startup and capture automatic page views and clicks with anonymous cookie sessions, separate from the Spotify Keychain session. Session replay is explicitly disabled.

The desktop network policy permits `https://r.hexclave.com`, the SDK's analytics ingestion host, in addition to the authentication API. Native OAuth passes the callback URL directly to the exchange function; it never puts the authorization code into browser history where automatic page-view tracking could capture it. Browser OAuth clears the callback query before analytics initializes.

## Verification

- Hexclave CLI reported the site deployed with no deployment error.
- Public landing page and embedded-player HTML returned successfully.
- The live browser rendered the landing page, skin assets, controls, and download link. Toggling the equalizer drawer changed it from open to closed.
- All 41 current tests passed, including Hexclave PKCE, callback rejection, provider-token failures, concurrent refresh, disconnect races, and the native authorization entry point.
- Application and Hexclave configuration TypeScript checks passed.
- The complete lint run passed.
- The signed native build passed strict code-signature validation and was installed in `/Applications/Headspace.app` and `~/Applications/Headspace.app`. Finder performed the system Applications replacement because macOS blocked terminal writes to the existing bundle.
- Live Spotify sign-in through Hexclave succeeded in the native app, and the Keychain session was verified as `issuer: hexclave`.
- A forced Hexclave refresh returned a valid Spotify token; profile and playlist endpoints returned HTTP 200 and the profile confirmed Premium.
- Spotify reported the `Headspace` device active with playback running; the native window's seek position advanced.
- Quitting and relaunching the installed app restored the connected account and music library from Keychain.
- Real production-site and native page-view and click events were verified in the project's Analytics query results. Native page views identify the Safari webview; production page views carry the public deployment URL. Ingestion returned HTTP 200. A fresh browser visit also created its anonymous session and sent the initial page view automatically, with HTTP 200 from both authentication and analytics ingestion. Query evidence: `a33101a1-06e3-4e1b-bae8-f8d636fbf908`.

The deployment workflow follows the installed CLI and the [Deploy skill](https://skill.hexclave.com/deployments). The general `/ask` answer returned obsolete deployment syntax, so its commands were checked against the actual CLI and deployment types before use.
