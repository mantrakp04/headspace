"""Build and publish Developer ID signed, notarized Sparkle releases from this Mac."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[3]
CACHE = Path.home() / 'Library/Caches/Headspace'
VENDOR = CACHE / 'Dependencies/Sparkle'
CONFIG = ROOT / 'apps/desktop/release.json'
SPARKLE_NS = 'http://www.andymatuschak.org/xml-namespaces/sparkle'


def run(*args, capture=False, **kwargs):
    result = subprocess.run([str(arg) for arg in args], cwd=ROOT, check=True,
                            text=True, stdout=subprocess.PIPE if capture else None, **kwargs)
    return result.stdout.strip() if capture else None


def config():
    data = json.loads(CONFIG.read_text())
    if not re.fullmatch(r'\d+\.\d+\.\d+', data['version']):
        raise ValueError('Release version must be major.minor.patch.')
    if type(data['build']) is not int or data['build'] < 1:
        raise ValueError('Build must be a positive integer that increases for every release.')
    if len(base64.b64decode(data['sparkle_public_key'], validate=True)) != 32:
        raise ValueError('Invalid Sparkle public key.')
    if not data['signing_identity'].startswith('Developer ID Application:'):
        raise ValueError('Distribution requires a Developer ID Application identity.')
    return data


def ensure_sparkle(cfg):
    marker = VENDOR / '.verified-sha256'
    if marker.exists() and marker.read_text().strip() == cfg['sparkle_sha256']:
        return
    VENDOR.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='headspace-sparkle-') as tmp:
        archive = Path(tmp) / 'sparkle.tar.xz'
        version = cfg['sparkle_version']
        run('curl', '--fail', '--location', '--retry', '3',
            f'https://github.com/sparkle-project/Sparkle/releases/download/{version}/Sparkle-{version}.tar.xz',
            '--output', archive)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != cfg['sparkle_sha256']:
            raise ValueError('Sparkle download checksum mismatch.')
        if VENDOR.exists():
            shutil.rmtree(VENDOR)
        VENDOR.mkdir()
        run('tar', '-xJf', archive, '-C', VENDOR)
        marker.write_text(cfg['sparkle_sha256'] + '\n')


def bundle_info(cfg, development=False, hmr=False):
    return {
        'CFBundleExecutable': 'Headspace', 'CFBundleIdentifier': cfg['bundle_id'] + ('.dev' if hmr else ''),
        'CFBundleName': 'Headspace', 'CFBundleDisplayName': 'Headspace Dev' if hmr else 'Headspace',
        'CFBundleIconFile': 'Headspace', 'CFBundlePackageType': 'APPL',
        'CFBundleShortVersionString': cfg['version'], 'CFBundleVersion': str(cfg['build']),
        'LSMinimumSystemVersion': cfg['minimum_macos'], 'NSHighResolutionCapable': True,
        'NSAppTransportSecurity': {'NSAllowsLocalNetworking': True},
        'NSAudioCaptureUsageDescription': 'Headspace uses this Mac’s audio output to animate the visualizer and speaker cones. Audio is analyzed locally, never recorded or sent anywhere.',
        'SUFeedURL': f"https://github.com/{cfg['repository']}/releases/latest/download/appcast.xml",
        'SUPublicEDKey': cfg['sparkle_public_key'], 'SURequireSignedFeed': True,
        'SUVerifyUpdateBeforeExtraction': True, 'SUEnableAutomaticChecks': not development,
        'SUAutomaticallyUpdate': not development, 'SUScheduledCheckInterval': 86400,
    }


def sign(path, cfg, development=False, preserve=False):
    args = ['codesign', '--force', '--sign', '-' if development else cfg['signing_identity']]
    if not development:
        args += ['--options', 'runtime', '--timestamp']
    if preserve:
        args += ['--preserve-metadata=entitlements']
    run(*args, path)


def build(cfg, development=False, destination=None, hmr=False):
    ensure_sparkle(cfg)
    bundle = destination or CACHE / ('Development/Headspace Dev.app' if hmr else 'Build/Headspace.app')
    bundle.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='headspace-build-', dir=bundle.parent) as tmp:
        staging = Path(tmp) / 'Headspace.app'
        contents = staging / 'Contents'
        for name in ['MacOS', 'Resources', 'Frameworks']:
            (contents / name).mkdir(parents=True)
        if not hmr:
            run('npm', 'run', 'build', '--workspace=@headspace/desktop')
        sdk = run('xcrun', '--sdk', 'macosx', '--show-sdk-path', capture=True)
        run('xcrun', '--sdk', 'macosx', 'swiftc', *(['-D', 'HEADSPACE_HMR'] if hmr else []), '-sdk', sdk, '-O', '-target', f"arm64-apple-macos{cfg['minimum_macos']}",
            ROOT / 'apps/desktop/native/Headspace.swift', ROOT / 'apps/desktop/native/AudioAnalysis.swift',
            ROOT / 'apps/desktop/native/SystemAudioCapture.swift', '-F', VENDOR,
            '-framework', 'Sparkle', '-framework', 'Cocoa', '-framework', 'WebKit',
            '-framework', 'Network', '-framework', 'Security', '-framework', 'CoreAudio', '-framework', 'Accelerate',
            '-Xlinker', '-rpath', '-Xlinker', '@executable_path/../Frameworks',
            '-o', contents / 'MacOS/Headspace')
        if not hmr:
            shutil.copytree(ROOT / 'apps/desktop/dist', contents / 'Resources/web')
        shutil.copy2(ROOT / 'apps/desktop/assets/Headspace.icns', contents / 'Resources')
        framework = contents / 'Frameworks/Sparkle.framework'
        shutil.copytree(VENDOR / 'Sparkle.framework', framework, symlinks=True)
        (contents / 'Info.plist').write_bytes(plistlib.dumps(bundle_info(cfg, development, hmr)))
        run('xattr', '-cr', staging)
        for nested in ['Autoupdate', 'XPCServices/Downloader.xpc', 'XPCServices/Installer.xpc', 'Updater.app']:
            sign(framework / 'Versions/B' / nested, cfg, development, preserve=True)
        sign(framework, cfg, development)
        sign(staging, cfg, development)
        run('codesign', '--verify', '--deep', '--strict', staging)
        if not development:
            verify_identity(staging, cfg)
        if bundle.exists():
            shutil.rmtree(bundle)
        staging.rename(bundle)
    print(f'Built {bundle}', flush=True)
    return bundle


def verify_identity(path, cfg):
    result = subprocess.run(['codesign', '-d', '--verbose=4', str(path)],
                            text=True, capture_output=True, check=True)
    details = result.stderr
    if f"TeamIdentifier={cfg['team_id']}" not in details or f"Authority={cfg['signing_identity']}" not in details:
        raise ValueError('Code signature is not from the configured Apple developer account.')
    if 'runtime' not in details or 'Timestamp=' not in details:
        raise ValueError('Distribution requires hardened runtime and a secure timestamp.')


def clean_head():
    if run('git', 'status', '--porcelain', capture=True):
        raise ValueError('Commit the release source first; release builds must come from a clean checkout.')
    return run('git', 'rev-parse', 'HEAD', capture=True)


def assert_new_release(cfg):
    releases = json.loads(run('gh', 'api', f"repos/{cfg['repository']}/releases", capture=True))
    tag = 'v' + cfg['version']
    if any(release['tag_name'] == tag for release in releases):
        raise ValueError(f'{tag} already exists. Bump version and build instead of replacing a release.')
    stable = [release for release in releases if not release['draft'] and not release['prerelease']]
    if stable:
        latest = stable[0]
        feed = next((a for a in latest['assets'] if a['name'] == 'appcast.xml'), None)
        if feed is None:
            raise ValueError('The previous release has no appcast; resolve it before publishing another.')
        with tempfile.TemporaryDirectory(prefix='headspace-prior-feed-') as tmp:
            run('gh', 'release', 'download', latest['tag_name'], '--repo', cfg['repository'],
                '--pattern', 'appcast.xml', '--dir', tmp)
            doc = ET.parse(Path(tmp) / 'appcast.xml')
            builds = [int(node.text) for node in doc.findall(f'.//{{{SPARKLE_NS}}}version')]
            if not builds or cfg['build'] <= max(builds):
                raise ValueError('Build must increase beyond the last published appcast version.')
        prior = latest['tag_name'].removeprefix('v')
        if tuple(map(int, cfg['version'].split('.'))) <= tuple(map(int, prior.split('.'))):
            raise ValueError('Release version must increase beyond the last public release.')


def prepare(cfg, profile):
    sha = clean_head()
    ensure_sparkle(cfg)
    public_key = run(VENDOR / 'bin/generate_keys', '--account', cfg['sparkle_key_account'], '-p', capture=True)
    if public_key != cfg['sparkle_public_key']:
        raise ValueError('The update signing key in Keychain does not match apps/desktop/release.json.')
    assert_new_release(cfg)
    run('xcrun', 'notarytool', 'history', '--keychain-profile', profile, '--output-format', 'json', capture=True)
    run('npm', 'test')
    run('npm', 'run', 'typecheck')
    run('npm', 'run', 'lint')
    run('python3', '-m', 'unittest', 'discover', '-s', 'apps/desktop/scripts', '-p', 'test_*.py')
    output = CACHE / 'Releases' / cfg['version']
    output.mkdir(parents=True, exist_ok=True)
    bundle = build(cfg, destination=output / 'Headspace.app')
    submission = output / 'notarization.zip'
    run('ditto', '-c', '-k', '--keepParent', bundle, submission)
    run('xcrun', 'notarytool', 'submit', submission, '--keychain-profile', profile,
        '--wait', '--output-format', 'json')
    run('xcrun', 'stapler', 'staple', bundle)
    run('xcrun', 'stapler', 'validate', bundle)
    run('spctl', '--assess', '--type', 'execute', '--verbose=2', bundle)
    with tempfile.TemporaryDirectory(prefix='headspace-dmg-') as tmp:
        run('ditto', bundle, Path(tmp) / 'Headspace.app')
        (Path(tmp) / 'Applications').symlink_to('/Applications')
        dmg = output / 'Headspace.dmg'
        run('hdiutil', 'create', '-volname', 'Headspace', '-srcfolder', tmp,
            '-format', 'UDZO', '-ov', dmg)
    run('codesign', '--force', '--sign', cfg['signing_identity'], '--timestamp', dmg)
    run('xcrun', 'notarytool', 'submit', dmg, '--keychain-profile', profile, '--wait', '--output-format', 'json')
    run('xcrun', 'stapler', 'staple', dmg)
    run('xcrun', 'stapler', 'validate', dmg)
    submission.unlink()
    with tempfile.TemporaryDirectory(prefix='headspace-appcast-') as tmp:
        archive_dir = Path(tmp)
        shutil.copy2(dmg, archive_dir / dmg.name)
        notes = ROOT / 'apps/desktop/release-notes' / f"{cfg['version']}.md"
        shutil.copy2(notes, archive_dir / 'Headspace.md')
        run(VENDOR / 'bin/generate_appcast', '--account', cfg['sparkle_key_account'],
            '--download-url-prefix', f"https://github.com/{cfg['repository']}/releases/download/v{cfg['version']}/",
            '--embed-release-notes', '--maximum-deltas', '0', archive_dir)
        shutil.copy2(archive_dir / 'appcast.xml', output / 'appcast.xml')
    checksum = hashlib.sha256(dmg.read_bytes()).hexdigest()
    (output / 'SHA256SUMS').write_text(f'{checksum}  Headspace.dmg\n')
    record = {'commit': sha, 'version': cfg['version'], 'build': cfg['build'], 'sha256': checksum}
    (output / 'release.json').write_text(json.dumps(record, indent=2) + '\n')
    verify_release(output, cfg)
    print(f'Notarized release ready at {output}', flush=True)
    return output


def verify_release(output, cfg):
    bundle = output / 'Headspace.app'
    run('codesign', '--verify', '--deep', '--strict', bundle)
    verify_identity(bundle, cfg)
    run('xcrun', 'stapler', 'validate', bundle)
    run('spctl', '--assess', '--type', 'execute', bundle)
    dmg = output / 'Headspace.dmg'
    run('codesign', '--verify', '--strict', dmg)
    run('xcrun', 'stapler', 'validate', dmg)
    record = json.loads((output / 'release.json').read_text())
    if record['version'] != cfg['version'] or record['build'] != cfg['build']:
        raise ValueError('Prepared release does not match the current version.')
    if hashlib.sha256(dmg.read_bytes()).hexdigest() != record['sha256']:
        raise ValueError('Release archive changed after preparation.')
    feed = output / 'appcast.xml'
    run(VENDOR / 'bin/sign_update', '--account', cfg['sparkle_key_account'], '--verify', feed)
    signature = validate_appcast(feed, dmg, cfg)
    run(VENDOR / 'bin/sign_update', '--account', cfg['sparkle_key_account'], '--verify', dmg, signature)


def validate_appcast(feed, archive, cfg):
    doc = ET.parse(feed)
    items = doc.findall('./channel/item')
    if len(items) != 1:
        raise ValueError('Expected exactly one full release in the appcast.')
    enclosure = items[0].find('enclosure')
    expected = f"https://github.com/{cfg['repository']}/releases/download/v{cfg['version']}/Headspace.dmg"
    if enclosure is None or enclosure.get('url') != expected:
        raise ValueError('Appcast must point to this immutable release asset.')
    if int(enclosure.get('length', '0')) != archive.stat().st_size:
        raise ValueError('Appcast archive length mismatch.')
    signature = enclosure.get(f'{{{SPARKLE_NS}}}edSignature', '')
    if len(base64.b64decode(signature, validate=True)) != 64:
        raise ValueError('Appcast is missing a valid Ed25519 archive signature.')
    if items[0].findtext(f'{{{SPARKLE_NS}}}version') != str(cfg['build']):
        raise ValueError('Appcast build mismatch.')
    return signature



def publish(cfg):
    sha = clean_head()
    output = CACHE / 'Releases' / cfg['version']
    ensure_sparkle(cfg)
    verify_release(output, cfg)
    if json.loads((output / 'release.json').read_text())['commit'] != sha:
        raise ValueError('Source changed since release preparation. Prepare this commit again.')
    assert_new_release(cfg)
    tag = 'v' + cfg['version']
    run('git', 'push', 'origin', 'HEAD:main')
    run('gh', 'release', 'create', tag, '--repo', cfg['repository'], '--target', sha, '--draft',
        '--title', f"Headspace {cfg['version']}", '--notes-file',
        ROOT / 'apps/desktop/release-notes' / f"{cfg['version']}.md",
        output / 'Headspace.dmg', output / 'appcast.xml', output / 'SHA256SUMS', output / 'release.json')
    run('gh', 'release', 'edit', tag, '--repo', cfg['repository'], '--draft=false', '--latest')
    print(f"Published https://github.com/{cfg['repository']}/releases/tag/{tag}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'prepare', 'publish', 'release'])
    parser.add_argument('--development', action='store_true', help='Ad-hoc local build, never publishable.')
    parser.add_argument('--hmr', action='store_true', help='Development window connected to Vite on 127.0.0.1:4383; never publishable.')
    parser.add_argument('--notary-profile', default=os.environ.get('HEADSPACE_NOTARY_PROFILE', 'headspace-notary'))
    args = parser.parse_args()
    cfg = config()
    if (args.development or args.hmr) and args.command != 'build':
        parser.error('--development and --hmr are only valid for local builds.')
    if args.command == 'build':
        build(cfg, args.development or args.hmr, hmr=args.hmr)
    else:
        if args.command in ['prepare', 'release']:
            prepare(cfg, args.notary_profile)
        if args.command in ['publish', 'release']:
            publish(cfg)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error)) from error
