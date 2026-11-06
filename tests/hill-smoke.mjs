import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Verify the complete walk is traversable before launching the expensive browser.
const routeCode=readFileSync(new URL('../public/hill-route.js',import.meta.url),'utf8');
const checkpointMatch=routeCode.match(/export const HILL_CHECKPOINTS = Object\.freeze\((\[[\s\S]*?\])\);/);
assert.ok(checkpointMatch,'commute checkpoint list missing');
const checkpoints=new Function('return '+checkpointMatch[1])();
assert.deepEqual(checkpoints.map(p=>p.id),['start','entrance','lower-slope','elementary','school-turn','steep-shops','yungane','budaetong','university']);
assert.equal(checkpoints[0].z,215,'default spawn must start at the true bottom of the extended hill');
assert.ok(checkpoints.every((p,i)=>i===0 || checkpoints[i-1].z>p.z),'landmark order');
const hillCode=readFileSync(new URL('../public/hill.js',import.meta.url),'utf8');
const routeLogic=hillCode.slice(hillCode.indexOf('const center ='),hillCode.indexOf('const c ='));
assert.ok(routeLogic.includes('function canWalk'),'walkability logic missing');
const {center,canWalk,straightFork,sidePoint,climb,closestRouteZ}=new Function(routeLogic+';return {center,canWalk,straightFork,sidePoint,climb,closestRouteZ};')();
// Start on a calm lower straight, then clearly take the LEFT uphill branch.
assert.ok(Math.abs(center(215)-center(177))<6,'lower road must begin nearly straight');
assert.ok(center(160)-center(102)>24,'commute must turn left after the fork');
assert.ok(Math.abs(center(160)-straightFork(160))<4,'left branch and through street meet');
assert.ok(straightFork(104)-center(104)>20,'straight road must separate to the right');
assert.ok(center(56)-center(30)>20,'a SECOND left turn must follow the primary school');
assert.ok(Math.abs(center(28)-center(5))<6,'restaurant lane should straighten after school turn');
const gentleGrade=(climb(150)-climb(175))/25;
const restaurantGrade=(climb(10)-climb(34))/24;
const arrivalGrade=(climb(-70)-climb(-90))/20;
assert.ok(restaurantGrade>gentleGrade*1.7,'shop street must be substantially steeper than lower approach');
assert.ok(restaurantGrade>arrivalGrade*1.55,'grade must ease before the 7016 bus stop');
assert.ok(Math.abs(closestRouteZ(center(44),44)-44)<.15,'route projection must remain continuous');
const approachCode=readFileSync(new URL('../public/hill-approach.js',import.meta.url),'utf8');
assert.ok(approachCode.includes('function straightContinuation'),'forked street missing');
assert.ok(!approachCode.includes('parkedCar(scene,center,heightAt,194'),'start must remain free of cars');
for(let z=checkpoints[0].z;z>=-73;z-=.5){
  for(const side of [-1,1]){
    const p=sidePoint(z,side*5.35);
    assert.ok(canWalk(p.x,p.z),'sidewalk blocked after bend at z='+z+' side='+side);
  }
}
assert.ok(hillCode.includes('addLowerHillApproach'),'lower approach must be rendered');
console.log('PASS: nine landmarks, second left turn, steep shop climb, 7016 arrival and both sidewalks');

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
async function preparePage(browser, options, stop = '') {
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
  // WebGL setup may run synchronously before DOMContentLoaded on shared CI GPUs.
  const url = base + '/?map=hill' + (stop ? '&stop=' + encodeURIComponent(stop) : '');
  await page.goto(url, { waitUntil: 'commit', timeout: 45000 });
  await page.locator('#viewport[data-ready="true"]').waitFor({ state: 'attached', timeout: 45000 });
  await page.locator('[data-world]').waitFor();
  assert.equal(await page.locator('[data-world]').inputValue(), 'hill');
  await page.locator('[data-journey]').waitFor({state:'visible'});
  assert.match(await page.locator('[data-journey]').innerText(),/등굣길|언덕 맨 아래|진입 삼거리|초등학교|윤가네|부대통령|정류장/);
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
  // Capture screenshots one at a time to avoid two expensive WebGL canvases
  // fighting over a software-rendered GPU on GitHub-hosted CI runners.
  const previewDesktop=await preparePage(browser,{viewport:{width:1365,height:768}});
  await previewDesktop.page.screenshot({path:'artifacts/hill-desktop.png',timeout:30000});
  assert.match(await previewDesktop.page.locator('[data-journey-label]').innerText(),/1\/7.*언덕 맨 아래/);
  assert.equal(parseFloat(await previewDesktop.page.locator('[data-journey-fill]').evaluate(node=>node.style.width)),0);
  const walkButton = previewDesktop.page.locator('[data-journey-walk]');
  assert.equal(await walkButton.isVisible(), true, 'guided hill walking button visible');
  await walkButton.click();
  await waitUntil(async () => parseFloat(await previewDesktop.page.locator('[data-journey-fill]').evaluate(node => node.style.width)) > .5, 'guided uphill travel');
  assert.equal(await walkButton.getAttribute('aria-pressed'), 'true');
  // A manual WASD input must immediately cancel the optional route assistant.
  await previewDesktop.page.keyboard.down('KeyW');
  await waitUntil(async () => (await walkButton.getAttribute('aria-pressed')) === 'false', 'manual walk override');
  await previewDesktop.page.keyboard.up('KeyW');
  await previewDesktop.context.close();
  const previewMobile=await preparePage(browser,{
    viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true
  });
  await previewMobile.page.screenshot({path:'artifacts/hill-mobile.png',timeout:30000});
  await previewMobile.context.close();

  // Capture the real route's landmark views separately. All stops share the
  // same continuous world; the stop URL is a preview/deep-link spawn only.
  for(const id of ['entrance','lower-slope','elementary','yungane','budaetong','university']){
    const item=await preparePage(browser,{viewport:{width:1200,height:740}},id);
    await item.page.screenshot({path:'artifacts/stop-'+id+'.png',timeout:30000});
    await item.context.close();
  }

  // Lightweight, simultaneous companion clients exercise WebSocket state changes
  // without conflating multiplayer latency with full-size software WebGL rendering.
  const companionA=await preparePage(browser,{viewport:{width:480,height:300}});
  const companionB=await preparePage(browser,{viewport:{width:480,height:300}});
  await waitUntil(()=>companionA.socketFrames.some(msg=>msg.type==='snapshot'&&msg.players.length>=2),'two-client hill presence');
  // The two connections share the hill room, and neither requires a name or account.
  await companionA.page.locator('[data-action="sit"]').click();
  await waitUntil(()=>companionB.socketFrames.some(msg=>msg.type==='snapshot' && msg.players.some(p=>p.pose==='sit')),'remote sit action');
  await companionA.page.locator('[data-action="greet"]').click();
  await waitUntil(()=>companionB.socketFrames.some(msg=>msg.type==='snapshot' && msg.players.some(p=>p.gesture>0)),'remote greeting');
  // Switching worlds should preserve the menu and isolate the new WebSocket room.
  await companionB.page.locator('[data-world]').selectOption('cliff');
  await companionB.page.waitForURL(/map=cliff/);
  await companionB.page.locator('#viewport[data-ready="true"]').waitFor({state:'attached',timeout:45000});
  await companionB.page.locator('[data-world]').waitFor();
  assert.equal(await companionB.page.locator('[data-world]').inputValue(),'cliff');
  await companionA.context.close();
  await companionB.context.close();
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
