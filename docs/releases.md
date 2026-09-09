# Direct macOS releases

Headspace ships as a Developer ID signed, Apple-notarized DMG on GitHub Releases. It is not submitted to the Mac App Store. It requires Apple silicon, macOS 14+, Spotify Premium, and access to the configured Spotify developer app.

## Publish a release

1. Update `version` and increment `build` in `desktop/release.json`. Both must increase after each public release.
2. Add `desktop/release-notes/<version>.md` and commit the source.
3. On the signing Mac, run `npm run release`.

The command checks the source, builds the app, signs Sparkle's helpers and the app, notarizes and staples both app and DMG, signs the update feed, verifies every artifact, and uploads all assets to a draft before publishing it. Failures stop publication. A release requires a clean checkout and the same source commit throughout preparation and publishing. Existing versions cannot be overwritten.

To inspect the artifacts first, run `npm run release:prepare`, review `~/Library/Caches/Headspace/Releases/<version>/`, then run `npm run release:publish`. If a network failure leaves a GitHub draft, inspect and recover that draft before retrying; the command refuses to replace it automatically.

The default notarization profile is `headspace-notary`. Override it with `--notary-profile NAME` or `HEADSPACE_NOTARY_PROFILE`. The Apple signing key and the `headspace` Sparkle private key stay in this Mac's Keychain. An Apple API key backup is stored outside the repository in `~/.config/headspace/` with restricted permissions. No private keys are sent to GitHub Actions.

On a replacement Mac, restore the matching Developer ID certificate/private key and Sparkle key. Do not generate a new Sparkle key for an existing update stream. Store the Apple API credential using:

```sh
xcrun notarytool store-credentials headspace-notary \
  --key /secure/location/AuthKey_KEYID.p8 \
  --key-id KEYID --issuer ISSUER_ID
```

## Updates and installation

The stable download is [Headspace.dmg](https://github.com/mantrakp04/headspace/releases/latest/download/Headspace.dmg). Open it and drag Headspace into Applications. The DMG contains the app and an Applications shortcut.

Sparkle checks the [signed feed](https://github.com/mantrakp04/headspace/releases/latest/download/appcast.xml) daily. Each feed points to an immutable, version-specific DMG. It verifies both feed and archive signatures before installing an update. The Headspace menu offers a manual check and automatic checking/downloading preferences.

Local builds from before Sparkle was added need one manual installation of the first release. Later releases can update in the app. Broad distribution of the DMG does not remove Spotify developer-app account restrictions.

## Verification

- `npm run desktop:build` builds and signs with Developer ID; it does not publish or notarize by itself.
- `npm run desktop:build -- --development` creates an explicit ad-hoc build for contributors and CI, with automatic update defaults disabled.
- `npm run test:release` checks appcast rejection for wrong URLs, versions, lengths, or signature shapes. The release command separately verifies real cryptographic signatures with Sparkle.
- `python3 desktop/scripts/verify-download.py /path/to/downloads` checks the downloaded DMG's checksum, signing team, notarization tickets, mounted app, and installation shortcut.

GitHub Actions verifies source on pushes and pull requests, and independently verifies the published DMG on a fresh macOS runner after each release. Release signing and publishing run on the signing Mac with `npm run release`.

References: [Sparkle setup](https://sparkle-project.org/documentation/) and [Apple Developer ID](https://developer.apple.com/developer-id/).
