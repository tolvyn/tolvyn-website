// Renders the ledger brand images from their sources, offline (Playwright's Chromium; fonts from fonts/).
//   node tools/brand/render.js            (from the repository root; PLAYWRIGHT_CORE may name playwright-core)
// og-ledger.html -> assets/brand/og-ledger.png (1200x630); favicon-ledger.svg -> favicon-ledger-32.png and
// apple-touch-icon-ledger.png (180). Every request that is not a local file is aborted.
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/home/voleado/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');
const R = process.cwd();
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.route(/^(?!file:)/, r => r.abort());
  await p.goto('file://' + path.join(R, 'tools/brand/og-ledger.html'));
  await p.evaluate(() => document.fonts.ready);
  const fams = await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family));
  if (fams.length < 3) throw new Error('fonts not loaded: ' + fams.join(', '));
  await p.screenshot({ path: path.join(R, 'assets/brand/og-ledger.png') });
  for (const [size, out] of [[32, 'favicon-ledger-32.png'], [180, 'apple-touch-icon-ledger.png']]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent('<html><body style="margin:0"><img src="file://' + path.join(R, 'assets/brand/favicon-ledger.svg') +
      '" width="' + size + '" height="' + size + '"></body></html>');
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(R, 'assets/brand', out), clip: { x: 0, y: 0, width: size, height: size } });
  }
  await b.close();
  console.log('rendered: og-ledger.png, favicon-ledger-32.png, apple-touch-icon-ledger.png (fonts: ' + fams.join(', ') + ')');
})();
