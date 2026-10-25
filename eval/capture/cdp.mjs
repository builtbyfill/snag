// A small driver for the Chrome already on the machine, over the DevTools protocol. No package to
// install: Node's own WebSocket talks to `chrome --headless --remote-debugging-port`.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch(port = 9370) {
  const profile = mkdtempSync(join(tmpdir(), 'snag-capture-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  if (!target) { chrome.kill(); throw new Error(`Chrome did not start (${CHROME}). Set CHROME_PATH.`); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method && listeners.has(m.method)) listeners.get(m.method)(m.params);
  };
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const on = (method, fn) => listeners.set(method, fn);

  const page = {
    send,
    on,
    /** Runs an expression in the page (top-level await is fine inside an async IIFE); returns its value or the error text. */
    async evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text };
      return r.result?.result?.value;
    },
    async viewport(width, height, mobile) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile, screenWidth: width, screenHeight: height });
      if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    },
    async goto(url, wait = 5000) {
      await send('Page.navigate', { url });
      await sleep(wait);
    },
    /** Real mouse click at the centre of the element the expression returns. */
    async click(expression) {
      const box = await page.evaluate(`(() => { const el = ${expression}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (!box) throw new Error(`click: nothing matched ${expression.slice(0, 80)}`);
      for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
      await sleep(400);
    },
    /** Fails or hangs every request whose URL matches the pattern (Fetch domain). */
    async mock(pattern, mode) {
      await send('Fetch.enable', { patterns: [{ urlPattern: pattern, requestStage: 'Request' }] });
      on('Fetch.requestPaused', (params) => {
        if (mode === 'fail') send('Fetch.failRequest', { requestId: params.requestId, errorReason: 'ConnectionFailed' });
        // 'hang': never answered, so the page waits for ever.
      });
    },
    async unmock() {
      await send('Fetch.disable');
      listeners.delete('Fetch.requestPaused');
    },
    async screenshot() {
      return Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
    },
    /** A viewport-sized shot of the document clipped so the element the expression returns is near the top third. */
    async screenshotAround(expression, width, height) {
      // Scroll the element into view first, so scroll-reveal animations have fired; if the page
      // refused to scroll (a smooth-scroll library), clip the document around it instead.
      const r0 = await page.evaluate(`(() => { const el = ${expression}; if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); return true; })()`);
      if (r0 === null) throw new Error(`focus: nothing matched ${expression.slice(0, 80)}`);
      await sleep(1500);
      const rect = await page.evaluate(`(() => { const r = (${expression}).getBoundingClientRect(); return { top: r.top, docTop: r.top + window.scrollY }; })()`);
      if (rect.top >= 0 && rect.top < height - 40) return page.screenshot();
      const top = Math.max(0, Math.round(rect.docTop - height / 3));
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: top, width, height, scale: 1 } });
      return Buffer.from(r.result.data, 'base64');
    },
    async close() {
      ws.close();
      chrome.kill();
      await sleep(300);
      rmSync(profile, { recursive: true, force: true });
    },
  };
  await send('Page.enable');
  return page;
}
