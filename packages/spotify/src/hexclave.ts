import { decodeResponseJson, object, string, type JsonValue } from './json.ts';

export type HexclaveConnection = {
  projectId: string;
  publishableClientKey: string;
};

export const hexclaveAPI = 'https://api.hexclave.com/api/v1';

export function parseHexclaveConnection(
  value: JsonValue | undefined,
): HexclaveConnection | null {
  const record = object(value);
  const projectId = string(record.projectId);
  const publishableClientKey = string(record.publishableClientKey);
  if (!/^[a-f0-9-]{36}$/i.test(projectId) || !publishableClientKey) return null;
  return { projectId, publishableClientKey };
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
  const token = string(object(await decodeResponseJson(response)).access_token);
  if (!response.ok || !token) {
    throw new Error(
      'Hexclave could not access your Spotify account. Connect Spotify again to grant playback and library access.',
    );
  }
  return token;
}
