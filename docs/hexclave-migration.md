# Hexclave migration

## Deployment

- Project: Headspace, `e9d6159c-8a5c-4c2e-8a87-930b204e14ec`, owned by Mantra's Team.
- Public site: https://hxc-p-53-si-870a3bb506b56ed0c0.fly.dev
- Verified deployment: `460c97ac-920e-4869-aafb-bd590a3043f5`, September 8, 2026 Pacific time.
- Service: `site`, deployment group `headspace`, public HTTP on port 3000, scales to zero.
- Remote build: Node 24, npm workspaces, Nitro `node-server`, runtime contains only `.output` and runs as the `node` user.
- CLI: `@hexclave/cli@1.0.114`. SDK types: `@hexclave/js@1.0.113`, compatible with the local package release-age policy.

`npm run deploy` uploads the current checkout, including uncommitted source that is not ignored, and waits for the remote deployment result. The initial cloud config was pulled before enabling Deploy. Normal deploys do not push project configuration. Use `hexclave config pull` and compare before a deliberate config push.

The GitHub Actions workflow and `apps/site/vercel.json` are local changes until committed and pushed. Together they move Git deployments from Vercel to Hexclave. The GitHub repository secret `HEXCLAVE_SECRET_SERVER_KEY` is already configured. Its key expires September 9, 2027; replace the GitHub secret before then. No secret value is written to this repository.

The old Vercel project is `prj_Hf2rNLCwI0Z24A12zACwBla1qigq`, with production alias `headspace-theta.vercel.app`. Its existing deployment remains available. GitHub Releases continues hosting the notarized DMG and signed Sparkle feed; the native app does not load its interface from the landing-page host.

## Spotify OAuth finding

Hexclave supports Spotify sign-in and connected-account access tokens, including automatic provider-token refresh. However, [connected accounts cannot use shared OAuth keys](https://docs.hexclave.com/guides/apps/authentication/connected-accounts). Shared Spotify login therefore cannot provide the Web API and streaming tokens Headspace requires.

The existing Spotify developer application is **Headspace Local**, client ID `05ac56334649404c8878e72b6aefac9a`, in development mode. Its configured callback was verified as `http://127.0.0.1:4382/callback`.

Moving desktop OAuth to Hexclave requires configuring that app's client ID and client secret in Hexclave, adding `https://api.hexclave.com/api/v1/auth/oauth/callback/spotify` to Spotify's allowed callbacks, enabling connected accounts, and requesting the player's Spotify scopes. See the [Spotify provider setup](https://docs.hexclave.com/guides/apps/authentication/auth-providers/spotify).

The user has been asked whether to use those existing custom credentials through Hexclave or retain direct Spotify login. Until that choice is made, desktop authentication remains direct PKCE with Keychain persistence. No Spotify client secret has been read, copied, or stored in Hexclave. Spotify developer-mode account restrictions still apply to a custom provider.

## Verification

- Hexclave CLI reported the site deployed with no deployment error.
- Public landing page and embedded-player HTML returned successfully.
- The live browser rendered the landing page, skin assets, controls, and download link. Toggling the equalizer drawer changed it from open to closed.
- All 32 existing Spotify and desktop tests passed.
- Application TypeScript checks and the new Hexclave config TypeScript check passed.
- The full lint run reported two errors in concurrently edited landing-theme files: a button with `role="radio"` in `theme-picker.tsx` and synchronous effect state in `routes/index.tsx`. These are outside the deployment changes and must pass before GitHub Actions deploys.
- Desktop Hexclave sign-in, token renewal, and playback have not been implemented or tested.

The deployment workflow follows the installed CLI and the [Deploy skill](https://skill.hexclave.com/deployments). The general `/ask` answer returned obsolete deployment syntax, so its commands were checked against the actual CLI and deployment types before use.
