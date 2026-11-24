// Genera los PNG de la PWA a partir de public/icons/icon.svg usando Chromium (Playwright).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const maskable = svg.replace('rx="112"', 'rx="0"').replace('<g fill', '<g transform="translate(51.2 51.2) scale(0.8)" fill');
const jobs = [
  ['public/icons/icon-192.png', 192, svg],
  ['public/icons/icon-512.png', 512, svg],
  ['public/icons/maskable-512.png', 512, maskable],
  ['public/icons/apple-touch-icon.png', 180, svg.replace('rx="112"', 'rx="0"')],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [out, size, src] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('✓', out);
}
await browser.close();
