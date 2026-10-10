import { createPrivateKey, sign } from 'node:crypto';

export type DeveloperKey = {
  teamId: string;
  keyId: string;
  // Contents of the MusicKit .p8 file. Escaped "\n" sequences are accepted so
  // the key fits in a single-line environment variable.
  privateKey: string;
};

// Apple accepts developer tokens for up to six months.
export const maximumLifetime = 15777000;

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

export function readDeveloperKey(
  environment: NodeJS.ProcessEnv,
): DeveloperKey | null {
  const teamId = environment.APPLE_MUSIC_TEAM_ID?.trim() ?? '';
  const keyId = environment.APPLE_MUSIC_KEY_ID?.trim() ?? '';
  const privateKey = (environment.APPLE_MUSIC_PRIVATE_KEY ?? '')
    .replace(/\\n/g, '\n')
    .trim();
  if (
    !/^[A-Z0-9]{10}$/.test(teamId) ||
    !/^[A-Z0-9]{10}$/.test(keyId) ||
    !privateKey.includes('PRIVATE KEY')
  )
    return null;
  return { teamId, keyId, privateKey };
}

export function signDeveloperToken(
  key: DeveloperKey,
  origins: readonly string[],
  lifetime: number,
  now = Math.floor(Date.now() / 1000),
): string {
  if (
    !Number.isInteger(lifetime) ||
    lifetime < 60 ||
    lifetime > maximumLifetime
  )
    throw new Error(
      'Developer token lifetime must be between one minute and six months.',
    );
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: key.keyId }));
  const payload = base64url(
    JSON.stringify({
      iss: key.teamId,
      iat: now,
      exp: now + lifetime,
      origin: origins,
    }),
  );
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey(key.privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  return `${header}.${payload}.${base64url(signature)}`;
}
