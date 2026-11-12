// The original mark's extra sizes (founder, 12 Nov 2026): rendered from assets/brand/favicon-dark.svg UNCHANGED (bright
// green T on the black square), with the Inter the SVG names (assets/fonts/inter-latin.woff2), offline.
//   node tools/brand/render_original_icons.js        (from the repository root; PLAYWRIGHT_CORE may name playwright-core)
// Writes the 16 and 32 px frames for /favicon.ico to the temp folder (tolvyn-favicon-16.png, -32.png; the caller
// assembles the .ico from them), and assets/brand/favicon-192.png and favicon-512.png. The SVG, favicon-32.png, apple-touch-icon.png and og-image.png are
// not touched.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/home/voleado/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const R = process.cwd();
const svg = fs.readFileSync(path.join(R, 'assets/brand/favicon-dark.svg'), 'utf8');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.route(/^(?!file:)/, r => r.abort());
  const out = [];
  for (const [n, name] of [[16, 'favicon-16-src.png'], [32, 'favicon-32-src.png'], [192, 'favicon-192.png'], [512, 'favicon-512.png']]) {
    const hf = path.join(os.tmpdir(), 'tolvyn-original-icon.html');
    fs.writeFileSync(hf, `<!doctype html><style>@font-face{font-family:"Inter";font-weight:100 900;src:url(file://${R}/assets/fonts/inter-latin.woff2) format("woff2")}
html,body{margin:0;background:transparent} svg{display:block;width:${n}px;height:${n}px}</style>${svg}`);
    await p.setViewportSize({ width: n, height: n });
    await p.goto('file://' + hf);
    await p.evaluate(() => document.fonts.ready);
    if (!(await p.evaluate(() => [...document.fonts].some(f => f.family === 'Inter' && f.status === 'loaded')))) throw new Error('Inter not loaded');
    const dest = name.endsWith('-src.png') ? path.join(os.tmpdir(), 'tolvyn-' + name.replace('-src', '')) : path.join(R, 'assets/brand', name);
    await p.screenshot({ path: dest, omitBackground: true, clip: { x: 0, y: 0, width: n, height: n } });
    out.push(name);
  }
  await b.close();
  console.log('rendered from favicon-dark.svg with Inter:', out.join(', '));
})();
