import type { HexclaveDeploymentConfig } from '@hexclave/js';

export const deploymentGroupId = 'headspace';

export const deploy: HexclaveDeploymentConfig = () => ({
  services: {
    site: {
      type: 'serverless',
      public: true,
      ports: { 3000: { protocol: 'http' } },
      rootDirectory: '.',
      dockerfilePath: 'apps/site/Dockerfile',
      devCommand: 'npm run dev:site',
      minInstances: 0,
      maxInstances: 1,
      env: { NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '3000' },
    },
  },
});
