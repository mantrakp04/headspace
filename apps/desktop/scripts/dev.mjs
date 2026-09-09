import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { watch } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { createServer } from 'vite';

const desktop = fileURLToPath(new URL('..', import.meta.url));
const binary = resolve(
  homedir(),
  'Library/Caches/Headspace/Development/Headspace Dev.app/Contents/MacOS/Headspace',
);
let nativeApp;
let compiler;
let stopping = false;
let rebuilding = false;
let pending = false;
let timer;

async function portInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

if (process.platform !== 'darwin') {
  throw new Error(
    'Native development requires macOS. Use npm run dev:web for the browser player.',
  );
}
if (await portInUse(4382)) {
  throw new Error(
    'Quit the running Headspace app before starting native development: its Spotify callback already uses port 4382. Use npm run dev:web to keep that app running.',
  );
}
const server = await createServer({
  root: desktop,
  configFile: resolve(desktop, 'vite.config.ts'),
});
await server.listen();
server.printUrls();

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timeout);
}

async function rebuild() {
  if (rebuilding) {
    pending = true;
    return;
  }
  rebuilding = true;
  do {
    pending = false;
    await stopChild(nativeApp);
    if (stopping) break;
    console.log('Building the native development window…');
    compiler = spawn(
      'python3',
      [resolve(desktop, 'scripts/release.py'), 'build', '--hmr'],
      { stdio: 'inherit' },
    );
    const [code] = await once(compiler, 'exit');
    if (stopping) break;
    if (code === 0) {
      nativeApp = spawn(binary, [], { stdio: 'inherit' });
      nativeApp.once('error', (error) => {
        console.error(error);
        void shutdown(1);
      });
      console.log(
        'Headspace Dev is using http://127.0.0.1:4383. Frontend edits use HMR; Swift edits rebuild this window.',
      );
    } else {
      console.error(
        'Native build failed. Fix the Swift source and save to retry.',
      );
    }
  } while (pending && !stopping);
  rebuilding = false;
}

const watcher = watch(
  resolve(desktop, 'native'),
  { recursive: true },
  (_event, filename) => {
    if (!filename?.endsWith('.swift') || filename.startsWith('tests/')) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      void rebuild().catch((error) => {
        console.error(error);
        void shutdown(1);
      });
    }, 250);
  },
);

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  watcher.close();
  await Promise.all([
    stopChild(nativeApp),
    stopChild(compiler),
    server.close(),
  ]);
  process.exitCode = code;
}
process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});
await rebuild();
