import { HexclaveClientApp } from '@hexclave/js';

export const analytics = new HexclaveClientApp({
  projectId:
    import.meta.env.VITE_HEXCLAVE_PROJECT_ID ||
    'e9d6159c-8a5c-4c2e-8a87-930b204e14ec',
  publishableClientKey:
    import.meta.env.VITE_HEXCLAVE_PUBLISHABLE_CLIENT_KEY ||
    '__stack_public_client__',
  baseUrl: 'https://api.hexclave.com',
  tokenStore: 'cookie',
  devTool: false,
  analytics: { replays: { enabled: false } },
});

void analytics.getUser({ or: 'anonymous' }).catch((error: unknown) => {
  console.error('Could not initialize the analytics session', error);
});
