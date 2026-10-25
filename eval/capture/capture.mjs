// Captures the eval screenshots from the developer's own apps running locally, with fictional data
// only and the problem injected in the browser. Usage, from the project root, with the apps
// running on their ports (scrub.mjs):
//   node eval/capture/capture.mjs            # every case → eval/images/<id>.png
//   node eval/capture/capture.mjs 004 013    # some cases
//   node eval/capture/capture.mjs --sheet    # only the contact sheet, eval/images/contact-sheet.png
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { cases } from './cases.mjs';
import { launch, sleep } from './cdp.mjs';
import { apps, scrubScript, verifyScript } from './scrub.mjs';

const OUT = 'eval/images';
const args = process.argv.slice(2);
const sheetOnly = args.includes('--sheet');
const only = args.filter((a) => /^\d{3}$/.test(a));

async function capture(page, c) {
  const app = apps[c.app];
  await page.unmock().catch(() => {});
  if (c.mock) await page.mock(c.mock.pattern, c.mock.mode);
  await page.viewport(c.mobile ? 390 : 1440, c.mobile ? 844 : 900, c.mobile);
  await page.goto(app.base + c.url, 6000);
  if (c.steps) {
    const r = await page.evaluate(`(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); ${c.steps} })()`);
    if (r?.__error) throw new Error(`steps: ${r.__error}`);
  }
  if (c.css) await page.evaluate(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(c.css)}; document.head.appendChild(s); })()`);
  if (c.inject) {
    const r = await page.evaluate(`(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); ${c.inject} })()`);
    if (r?.__error) throw new Error(`inject: ${r.__error}`);
  }
  await sleep(600);
  if (!c.skipScrub) {
    await page.evaluate(scrubScript(app));
    await sleep(300);
    await page.evaluate(scrubScript(app)); // once more: React may have re-rendered a node after the first pass
    const left = await page.evaluate(verifyScript(app));
    if (left) throw new Error(`real-looking data left on the page: ${left.join(', ')}`);
  }
  // `focus`: the problem sits further down a page whose smooth-scroll library ignores scripted
  // scrolling, so the shot is clipped around that element at the viewport's size instead.
  const png = c.focus ? await page.screenshotAround(c.focus, c.mobile ? 390 : 1440, c.mobile ? 844 : 900) : await page.screenshot();
  writeFileSync(`${OUT}/${c.id}.png`, png);
  return png.length;
}

async function contactSheet() {
  const sharp = (await import('sharp')).default;
  const cols = 4;
  const w = 320;
  const h = 300;
  const pad = 12;
  const labelH = 40;
  const tiles = [];
  for (const [i, c] of cases.entries()) {
    const file = `${OUT}/${c.id}.png`;
    if (!existsSync(file)) continue;
    const thumb = await sharp(file).resize({ width: w, height: h - labelH, fit: 'contain', background: '#ffffff' }).png().toBuffer();
    const label = Buffer.from(`<svg width="${w}" height="${labelH}"><rect width="${w}" height="${labelH}" fill="#171717"/><text x="10" y="17" font-family="Segoe UI, sans-serif" font-size="13" font-weight="700" fill="#ececec">${c.id} · ${c.category}</text><text x="10" y="33" font-family="Segoe UI, sans-serif" font-size="11" fill="#b4b4b4">${apps[c.app].name} · ${c.mobile ? '390×844' : '1440×900'}</text></svg>`);
    const tile = await sharp({ create: { width: w, height: h, channels: 3, background: '#ffffff' } })
      .composite([{ input: thumb, top: 0, left: 0 }, { input: label, top: h - labelH, left: 0 }])
      .png()
      .toBuffer();
    tiles.push({ input: tile, left: pad + (i % cols) * (w + pad), top: pad + Math.floor(i / cols) * (h + pad) });
  }
  const rows = Math.ceil(cases.length / cols);
  await sharp({ create: { width: pad + cols * (w + pad), height: pad + rows * (h + pad), channels: 3, background: '#2a2a2a' } })
    .composite(tiles)
    .png()
    .toFile(`${OUT}/contact-sheet.png`);
  console.log(`contact sheet: ${OUT}/contact-sheet.png (${tiles.length} images)`);
}

mkdirSync(OUT, { recursive: true });
if (!sheetOnly) {
  const page = await launch();
  const results = [];
  try {
    for (const c of cases) {
      if (only.length && !only.includes(c.id)) continue;
      try {
        const bytes = await capture(page, c);
        results.push(`${c.id} ok (${Math.round(bytes / 1024)} KB)`);
      } catch (error) {
        results.push(`${c.id} FAILED: ${error.message}`);
      }
    }
  } finally {
    await page.close();
  }
  console.log(results.join('\n'));
}
await contactSheet();
process.exit(0);
