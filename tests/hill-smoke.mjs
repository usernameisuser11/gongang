import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:8787';
mkdirSync('artifacts', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn('node', ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--ip', '127.0.0.1', '--port', '8787'], {
  stdio: ['ignore','pipe','pipe'], env: { ...process.env, CI: '1' }
});
let logs = '';
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', buf => { logs += String(buf); process.stdout.write(String(buf)); });
}
async function waitServer() {
  for (let i = 0; i < 75; i++) {
    try {
      const result = await fetch(base + '/healthz', { signal: AbortSignal.timeout(1500) });
      if (result.status === 200) return;
    } catch {}
    if (server.exitCode !== null) throw new Error('Wrangler exited before health check: ' + logs.slice(-4000));
    await sleep(500);
  }
  throw new Error('Timed out waiting for local Cloudflare Worker: ' + logs.slice(-4000));
}
const errors = [];
async function preparePage(browser, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  const socketFrames = [];
  page.on('websocket', ws => {
    if (!ws.url().includes('/presence')) return;
    ws.on('framereceived', ({ payload }) => {
      try { socketFrames.push(JSON.parse(String(payload))); }
      catch {}
    });
  });
  await page.goto(base + '/?map=hill', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#viewport[data-ready="true"]').waitFor({ state: 'attached', timeout: 45000 });
  await page.locator('[data-world]').waitFor();
  assert.equal(await page.locator('[data-world]').inputValue(), 'hill');
  return { context, page, socketFrames };
}
async function waitUntil(condition, label, timeout=20000) {
  const began=Date.now();
  while (Date.now()-began<timeout) {
    if (await condition()) return;
    await sleep(200);
  }
  throw new Error('Timed out waiting for ' + label);
}
let browser;
try {
  await waitServer();
  const response=await fetch(base+'/healthz');
  const health=await response.json();
  assert.equal(health.visits,'ready',JSON.stringify(health));
  browser=await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'] });
  const desktop=await preparePage(browser,{viewport:{width:1365,height:768}});
  await desktop.page.screenshot({path:'artifacts/hill-desktop.png',timeout:30000});
  const mobile=await preparePage(browser,{
    viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true
  });
  await mobile.page.screenshot({path:'artifacts/hill-mobile.png',timeout:30000});
  await waitUntil(()=>desktop.socketFrames.some(msg=>msg.type==='snapshot'&&msg.players.length>=2),'two-client hill presence');
  // The two connections share the hill room, and neither requires a name or account.
  await desktop.page.locator('[data-action="sit"]').click();
  await waitUntil(()=>mobile.socketFrames.some(msg=>msg.type==='snapshot' && msg.players.some(p=>p.pose==='sit')),'remote sit action');
  await desktop.page.locator('[data-action="greet"]').click();
  await waitUntil(()=>mobile.socketFrames.some(msg=>msg.type==='snapshot' && msg.players.some(p=>p.gesture>0)),'remote greeting');
  // Switching worlds should preserve the menu and isolate the new WebSocket room.
  await mobile.page.locator('[data-world]').selectOption('cliff');
  await mobile.page.waitForURL(/map=cliff/);
  await mobile.page.locator('#viewport[data-ready="true"]').waitFor({state:'attached',timeout:45000});
  await mobile.page.locator('[data-world]').waitFor();
  assert.equal(await mobile.page.locator('[data-world]').inputValue(),'cliff');
  await desktop.context.close();
  await mobile.context.close();
  assert.equal(errors.length,0,'Browser page errors: '+errors.join(' | '));
  console.log('PASS: D1, two world renders, anonymous two-client presence, sit and greet, world switching');
} catch(error) {
  console.error('FAIL:',error);
  console.error('Recent Worker output:',logs.slice(-3500));
  process.exitCode=1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
