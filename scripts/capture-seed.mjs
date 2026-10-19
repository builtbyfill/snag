// node scripts/capture-seed.mjs — renders seed/demo-page/index.html as three phone screenshots in
// seed/images/. Drives the Chrome already on the machine over the DevTools protocol (Node's own
// WebSocket), so no browser library is installed for a one-off capture. CHROME_PATH overrides
// where Chrome lives. The output is synthetic and committed; run this only to change the images.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE = pathToFileURL(resolve('seed/demo-page/index.html')).href;
const SCREENS = ['details', 'calendar', 'payment'];
const PORT = 9350;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'snag-capture-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  if (!target) throw new Error(`Chrome did not start (${CHROME}). Set CHROME_PATH.`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

  await send('Page.enable');
  // An iPhone-sized screen at 2x, like the screenshots clients send.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  for (const screen of SCREENS) {
    await send('Page.navigate', { url: `${PAGE}#${screen}` });
    await sleep(600);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = `seed/images/synthetic-booking-${screen}.png`;
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    console.log(`Wrote ${file}`);
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
process.exit(0);
