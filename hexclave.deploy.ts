import type { HexclaveDeploymentConfig } from '@hexclave/js';

export const deploymentGroupId = 'headspace';

export const deploy: HexclaveDeploymentConfig = ({ secret }) => ({
  services: {
    site: {
      type: 'serverless',
      public: true,
      ports: { 3000: { protocol: 'http' } },
      rootDirectory: '.',
      dockerfilePath: 'apps/site/Dockerfile',
      devCommand: 'npm run dev:site',
      minInstances: 1,
      maxInstances: 1,
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '3000',
        // MusicKit key for signing Apple Music developer tokens. Set the key ID
        // and .p8 contents under Project Settings → Secrets. Until then the
        // token endpoint answers 503 and Apple Music sign-in explains why.
        APPLE_MUSIC_TEAM_ID: 'U5L5T3NGVV',
        APPLE_MUSIC_KEY_ID: secret('APPLE_MUSIC_KEY_ID', ''),
        APPLE_MUSIC_PRIVATE_KEY: secret('APPLE_MUSIC_PRIVATE_KEY', ''),
      },
    },
  },
});
