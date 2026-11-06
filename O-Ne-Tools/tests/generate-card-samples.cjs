'use strict';
/* Regenerates the homepage card samples from each tool's own canvas, so nothing is redrawn.
 * Run from the repo root: node O-Ne-Tools/tests/generate-card-samples.cjs
 * Needs the dev dependencies and Chromium from Playwright. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'O-Ne-Tools/assets/card-samples');
const registry = require(path.join(root, 'O-Ne-Tools/one-tools-registry-v1.json'));
const base = 'http://127.0.0.1:4173/O-Ne-Tools/';
const maxWidth = 560;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base + 'index.html')).ok) return; } catch (error) { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('workspace QA server did not start');
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const server = spawn(process.execPath, ['O-Ne-Tools/tests/workspace-qa-server.cjs'], { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch();
    for (const tool of registry.tools.filter(item => item.status === 'ready')) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, locale: 'zh-TW' });
      await page.goto(base + tool.href.replace(/^\.\//, ''));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      const dataUrl = await page.evaluate(maxW => {
        const source = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
        const pixels = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
        let left = source.width, top = source.height, right = -1, bottom = -1;
        for (let y = 0; y < source.height; y++) {
          for (let x = 0; x < source.width; x++) {
            if (pixels[(y * source.width + x) * 4 + 3] > 8) {
              if (x < left) left = x;
              if (x > right) right = x;
              if (y < top) top = y;
              if (y > bottom) bottom = y;
            }
          }
        }
        const width = right - left + 1, height = bottom - top + 1;
        const scale = Math.min(1, maxW / width);
        const out = document.createElement('canvas');
        out.width = Math.round(width * scale);
        out.height = Math.round(height * scale);
        const context = out.getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, left, top, width, height, 0, 0, out.width, out.height);
        return out.toDataURL('image/webp', 0.86);
      }, maxWidth);
      const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
      fs.writeFileSync(path.join(outDir, tool.id + '.webp'), bytes);
      console.log(tool.id, bytes.length);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
