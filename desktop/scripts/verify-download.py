"""Verify a public DMG exactly as downloaded, including its mounted app."""
import hashlib
from pathlib import Path
import plistlib
import subprocess
import sys
from release import config, run, verify_identity


def verify(folder):
    cfg = config()
    dmg = folder / 'Headspace.dmg'
    expected = (folder / 'SHA256SUMS').read_text().split()
    if len(expected) != 2 or expected[1] != 'Headspace.dmg':
        raise ValueError('Unexpected checksum manifest.')
    if hashlib.sha256(dmg.read_bytes()).hexdigest() != expected[0]:
        raise ValueError('Downloaded DMG checksum mismatch.')
    run('codesign', '--verify', '--strict', dmg)
    details = subprocess.run(['codesign', '-d', '--verbose=4', str(dmg)],
                             check=True, capture_output=True, text=True).stderr
    if f"TeamIdentifier={cfg['team_id']}" not in details:
        raise ValueError('DMG was signed by an unexpected Apple developer.')
    run('xcrun', 'stapler', 'validate', dmg)
    result = subprocess.run(['hdiutil', 'attach', '-readonly', '-nobrowse', '-plist', str(dmg)],
                            check=True, capture_output=True)
    mounts = [Path(item['mount-point']) for item in plistlib.loads(result.stdout)['system-entities'] if 'mount-point' in item]
    if len(mounts) != 1:
        for mount in mounts:
            run('hdiutil', 'detach', mount)
        raise ValueError('Expected a single DMG volume.')
    mount = mounts[0]
    try:
        app = mount / 'Headspace.app'
        if not (mount / 'Applications').is_symlink() or (mount / 'Applications').readlink() != Path('/Applications'):
            raise ValueError('DMG is missing its Applications installation shortcut.')
        run('codesign', '--verify', '--deep', '--strict', app)
        verify_identity(app, cfg)
        run('xcrun', 'stapler', 'validate', app)
        run('spctl', '--assess', '--type', 'execute', '--verbose=2', app)
    finally:
        run('hdiutil', 'detach', mount)
    print('Downloaded DMG passed signature, notarization, checksum, and installation checks.')


if __name__ == '__main__':
    verify(Path(sys.argv[1]).resolve())
