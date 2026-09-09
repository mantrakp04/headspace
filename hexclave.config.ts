import type { HexclaveConfig } from '@hexclave/js';

export const config: HexclaveConfig = {
  apps: { installed: { deploy: { enabled: true } } },
  auth: {
    allowSignUp: true,
    oauth: {
      providers: {
        spotify: {
          type: 'spotify',
          allowSignIn: true,
          allowConnectedAccounts: true,
        },
      },
    },
  },
};
