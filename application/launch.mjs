import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const url = 'http://127.0.0.1:5173/';
const root = fileURLToPath(new URL('.', import.meta.url));

function openBrowser() {
  const child = spawn('/usr/bin/open', [url], { stdio: 'ignore' });
  child.on('error', () => console.log(`Open ${url} in your browser.`));
}

async function alreadyRunning() {
  try {
    const response = await fetch(`${url}__mta_exit_project_launcher`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok && await response.text() === root;
  } catch {
    return false;
  }
}

try {
  if (await alreadyRunning()) {
    openBrowser();
    console.log('MTA Exit Project is already running. Opening your browser.');
  } else {
    const { createServer } = await import('vite');
    const server = await createServer({
      root,
      server: { host: '127.0.0.1', port: 5173, strictPort: true },
      plugins: [{
        name: 'local-launcher-status',
        configureServer(vite) {
          vite.middlewares.use('/__mta_exit_project_launcher', (_request, response) => {
            response.setHeader('Content-Type', 'text/plain');
            response.end(root);
          });
        },
      }],
    });
    await server.listen();
    console.log(`MTA Exit Project is ready at ${url}`);
    console.log('Keep this window open while using the site. Press Control+C to stop.');
    openBrowser();
    const stop = async () => { await server.close(); process.exit(0); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
} catch (error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('Dependencies are missing. In the application folder, run pnpm install.');
  } else {
    console.error(`Could not start MTA Exit Project: ${error.message}`);
    console.error('If port 5173 is in use, stop the earlier server and try again.');
  }
  process.exitCode = 1;
}
