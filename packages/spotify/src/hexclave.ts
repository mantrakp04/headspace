export type HexclaveConnection = {
  projectId: string;
  publishableClientKey: string;
};

export const hexclaveAPI = 'https://api.hexclave.com/api/v1';

export function parseHexclaveConnection(
  value: unknown,
): HexclaveConnection | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('projectId' in value) ||
    typeof value.projectId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(value.projectId) ||
    !('publishableClientKey' in value) ||
    typeof value.publishableClientKey !== 'string' ||
    !value.publishableClientKey
  )
    return null;
  return {
    projectId: value.projectId,
    publishableClientKey: value.publishableClientKey,
  };
}

export async function connectedSpotifyToken(
  connection: HexclaveConnection,
  accessToken: string,
  scope: string,
): Promise<string> {
  const response = await fetch(
    `${hexclaveAPI}/connected-accounts/me/spotify/access-token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hexclave-access-type': 'client',
        'x-hexclave-project-id': connection.projectId,
        'x-hexclave-publishable-client-key': connection.publishableClientKey,
        'x-hexclave-access-token': accessToken,
      },
      body: JSON.stringify({ scope }),
    },
  );
  const value: unknown = await response.json();
  if (
    !response.ok ||
    typeof value !== 'object' ||
    value === null ||
    !('access_token' in value) ||
    typeof value.access_token !== 'string' ||
    !value.access_token
  ) {
    throw new Error(
      'Hexclave could not access your Spotify account. Connect Spotify again to grant playback and library access.',
    );
  }
  return value.access_token;
}
