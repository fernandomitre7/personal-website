// Prints each page to the PDF that its Download CV link serves: node tools/build-cv.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../public');
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9335;
const pages = [
  ['index.html', 'cv/Fernando-Mitre-CV.pdf'],
  ['es/index.html', 'cv/Fernando-Mitre-CV-ES.pdf'],
];

const profile = mkdtempSync(join(tmpdir(), 'build-cv-'));
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
      return await res.json();
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error('Chrome did not start');
}

try {
  const ws = new WebSocket((await connect()).webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  let onLoad = () => {};
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Page.loadEventFired') onLoad();
    if (!pending.has(msg.id)) return;
    if (msg.error) throw new Error(msg.error.message);
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  };
  const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

  await send('Page.enable');
  mkdirSync(join(root, 'cv'), { recursive: true });
  for (const [page, pdf] of pages) {
    const loaded = new Promise(r => (onLoad = r));
    await send('Page.navigate', { url: pathToFileURL(join(root, page)).href });
    await loaded;
    await send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => {})',
      awaitPromise: true,
    });
    const { data } = await send('Page.printToPDF', { preferCSSPageSize: true, printBackground: false });
    writeFileSync(join(root, pdf), Buffer.from(data, 'base64'));
    console.log(pdf);
  }
} finally {
  browser.kill();
  setTimeout(() => rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }), 500);
}
