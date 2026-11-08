import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';

const port = 8796;
const origin = 'http://127.0.0.1:' + port;
const server = spawn(process.execPath, ['server.mjs'], {
  env: { ...process.env, PORT: String(port), BARAMUI_DB_PATH: '/tmp/gongang-visual-visits.sqlite' },
  stdio: 'inherit',
});
let browser;

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error('Preview server exited before startup');
    try {
      const res = await fetch(origin + '/healthz');
      if (res.ok) return;
    } catch { /* Still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not start');
}

try {
  await waitForServer();
  await mkdir('artifacts/beach-preview', { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !/favicon/i.test(message.text())) errors.push(message.text());
  });
  await page.goto(origin + '/?map=beach', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#viewport')?.dataset.ready === 'true', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'artifacts/beach-preview/sunset.png' });

  // Use the app's own time slider rather than modifying render uniforms.
  await page.locator('.beach-timeline input[type="range"]').evaluate(input => {
    input.value = '100';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/beach-preview/night.png' });
  for (const file of ['sunset.png','night.png']) {
    const size = (await stat('artifacts/beach-preview/' + file)).size;
    if (size < 12000) throw new Error('Unexpectedly small screenshot ' + file + ': ' + size + ' bytes');
    console.log(file + ': ' + size + ' bytes');
  }
  if (errors.length) throw new Error('WebGL/browser console errors: ' + errors.join('\n'));
  console.log('Beach visual smoke passed');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
