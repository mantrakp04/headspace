import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const site = fileURLToPath(new URL('.', import.meta.url));
const desktop = fileURLToPath(new URL('../desktop/', import.meta.url));

export function playerBuild(): Plugin {
  let pending = Promise.resolve();
  let initial: Promise<void> | undefined;
  function rebuild() {
    pending = pending
      .catch(() => {})
      .then(async () => {
        await cp(`${desktop}assets/skin`, `${site}public/skin`, {
          recursive: true,
        });
        await build({
          configFile: false,
          root: site,
          base: '/embedded-player/',
          publicDir: false,
          resolve: {
            alias: [
              { find: /^\/skin\//, replacement: `${desktop}assets/skin/` },
            ],
          },
          plugins: [react()],
          logLevel: 'warn',
          build: {
            outDir: `${site}public/embedded-player`,
            emptyOutDir: true,
            rolldownOptions: { input: `${site}player/index.html` },
          },
        });
      });
    return pending;
  }
  return {
    name: 'headspace-player',
    buildStart() {
      return (initial ??= rebuild());
    },
    configureServer(server) {
      const source = `${desktop}src/`;
      server.watcher.add([source, `${desktop}assets/skin`, `${site}player/`]);
      let timer: ReturnType<typeof setTimeout>;
      const changed = (path: string) => {
        if (
          !path.startsWith(source) &&
          !path.startsWith(`${desktop}assets/skin/`) &&
          !path.startsWith(`${site}player/`)
        )
          return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          void rebuild()
            .then(() => server.ws.send({ type: 'full-reload' }))
            .catch((error: unknown) => {
              server.config.logger.error(String(error));
            });
        }, 100);
      };
      server.watcher.on('all', (_event, path) => changed(path));
      server.httpServer?.once('close', () => clearTimeout(timer));
    },
  };
}
