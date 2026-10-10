import { createFileRoute } from '@tanstack/react-router';

// The desktop app's bundled origin and the local development player.
const appOrigins = ['http://127.0.0.1:4382', 'http://127.0.0.1:4383'];
const lifetime = 60 * 60 * 24 * 30;
// Re-sign once fewer than seven days remain so a long app session keeps a
// working token.
const renewBefore = 60 * 60 * 24 * 7;
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
        const { readDeveloperKey, signDeveloperToken } =
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
            token: signDeveloperToken(key, appOrigins, lifetime, now),
            expires: now + lifetime,
          };
        return new Response(JSON.stringify({ token: cached.token }), {
          headers: headers(origin),
        });
      },
    },
  },
});
