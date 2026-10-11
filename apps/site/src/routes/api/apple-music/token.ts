import { createFileRoute } from '@tanstack/react-router';

// The desktop app's bundled origin and the local development player. Keep in
// sync with localOrigin and rendererOrigin in apps/desktop/native/Headspace.swift.
const appOrigins = ['http://127.0.0.1:4382', 'http://127.0.0.1:4383'];
// MusicKit keeps the token it was configured with for the whole app session,
// so every token handed out has at least 30 days left.
const renewBefore = 60 * 60 * 24 * 30;
let cached: { token: string; expires: number } | null = null;

function headers(origin: string | null) {
  const result = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  });
  if (origin && appOrigins.includes(origin))
    result.set('Access-Control-Allow-Origin', origin);
  return result;
}

export const Route = createFileRoute('/api/apple-music/token')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { maximumLifetime, readDeveloperKey, signDeveloperToken } =
          await import('@headspace/apple-music/token');
        const origin = request.headers.get('Origin');
        const key = readDeveloperKey(process.env);
        if (!key)
          return new Response(
            JSON.stringify({ error: 'Apple Music is not configured.' }),
            { status: 503, headers: headers(origin) },
          );
        const now = Math.floor(Date.now() / 1000);
        if (!cached || cached.expires - now < renewBefore)
          cached = {
            token: signDeveloperToken(key, appOrigins, maximumLifetime, now),
            expires: now + maximumLifetime,
          };
        return new Response(JSON.stringify({ token: cached.token }), {
          headers: headers(origin),
        });
      },
    },
  },
});
