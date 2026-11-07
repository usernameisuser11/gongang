import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Verify the complete walk is traversable before launching the expensive browser.
const routeCode=readFileSync(new URL('../public/hill-route.js',import.meta.url),'utf8');
const checkpointMatch=routeCode.match(/export const HILL_CHECKPOINTS = Object\.freeze\((\[[\s\S]*?\])\);/);
assert.ok(checkpointMatch,'commute checkpoint list missing');
const checkpoints=new Function('return '+checkpointMatch[1])();
assert.deepEqual(checkpoints.map(p=>p.id),['start','entrance','elementary','school-turn','lower-slope','steep-shops','yungane','budaetong','university']);
assert.equal(checkpoints[0].z,285,'default spawn must begin on the longer downhill approach');
assert.ok(checkpoints.every((p,i)=>i===0 || checkpoints[i-1].z>p.z),'landmark order');
const hillCode=readFileSync(new URL('../public/hill.js',import.meta.url),'utf8');
const routeLogic=hillCode.slice(hillCode.indexOf('const clampRoute ='),hillCode.indexOf('const c ='));
assert.ok(routeLogic.includes('function canWalk'),'walkability logic missing');
const {center,canWalk,straightFork,schoolFork,sidePoint,climb,closestRouteZ}=new Function(routeLogic+';return {center,canWalk,straightFork,schoolFork,sidePoint,climb,closestRouteZ};')();
// Start on a calm lower straight, then clearly take the LEFT uphill branch.
assert.ok(Math.abs(center(285)-center(177))<6,'extended lower road must remain nearly straight');
assert.ok(center(168)-center(146)>18,'first LEFT branch must bend before the school');
assert.ok(Math.abs(center(168)-straightFork(168))<5,'left branch and through street meet');
assert.ok(straightFork(130)-center(130)>20,'straight road must separate to the right');
assert.ok(center(139)-center(105)>22,'SECOND left turn must begin immediately after school');
assert.ok(Math.abs(center(78)-center(54))<7,'restaurant lane should straighten after school turn');
assert.ok(schoolFork(90)-center(90)>20,'school exit needs a visibly separate straight road');
assert.equal(canWalk(schoolFork(90),90),false,'guided travellers must take the LEFT uphill street');
assert.ok(routeCode.includes('function schoolStraightStreet'),'the second school junction must be rendered');
assert.ok(routeCode.includes("name:'7016"),'final 7016 stop must have a visible sign');
// Enforce actual geometry, not just a changed label: the starting road
// should be more than twice as long and almost twice as steep.
function routeLength(from,to){
  let total=0;
  for(let z=from;z>to;z-=.25){
    const next=Math.max(to,z-.25);
    total+=Math.hypot(center(z)-center(next),z-next);
  }
  return total;
}
const newSchoolDistance=routeLength(285,158);
const originalSchoolDistance=routeLength(215,158);
assert.ok(newSchoolDistance>originalSchoolDistance*2,'start-to-school must be >2x longer');
assert.ok(newSchoolDistance>120,'new hill must add actual road geometry');
const bottomGrade=(climb(255)-climb(285))/30;
const elementaryGrade=(climb(158)-climb(177))/19;
const schoolApproachGrade=(climb(151)-climb(178))/27;
const restaurantGrade=(climb(96)-climb(123))/27;
const arrivalGrade=(climb(-90)-climb(-70))/20;
assert.ok(bottomGrade>.38 && bottomGrade<.46,'new road starts steeply');
assert.ok(elementaryGrade>.38 && elementaryGrade<.46,'school approach stays steep');
assert.ok(restaurantGrade>schoolApproachGrade*1.12,'steeper restaurant climb after school');
assert.ok(restaurantGrade>arrivalGrade*1.55,'slope eases at bus stop');
// Prevent sharply folded sidewalks when grade and route length change.
let minCurveRadius=Infinity;
for(let z=95;z<=285;z+=.25){
  const h=.05,d=(center(z+h)-center(z-h))/(2*h);
  const dd=(center(z+h)-2*center(z)+center(z-h))/(h*h);
  minCurveRadius=Math.min(minCurveRadius,(1+d*d)**1.5/Math.max(Math.abs(dd),1e-8));
}
assert.ok(minCurveRadius>9.5,'curve too tight for two sidewalks');
assert.ok(hillCode.includes('const edgeA = -112, edgeB = 335'),'terrain must reach new lower start');
assert.ok(hillCode.includes('const lowerEnd=318'),'full road and sidewalks extend downhill');
assert.ok(Math.abs(closestRouteZ(center(44),44)-44)<.15,'route projection must remain continuous');
// The inside sidewalk must never fold back on itself at the school bend.
// Exercise normal walking speed, rather than relying only on static checkpoints.
let probe=sidePoint(158,-5.35);
for(let i=0;i<500;i++){
  const routeZ=closestRouteZ(probe.x,probe.z);
  if(routeZ<106)break;
  const target=sidePoint(Math.max(104,routeZ-2.2),-5.35);
  const distance=Math.hypot(target.x-probe.x,target.z-probe.z);
  const ratio=distance>.0001?Math.min(1,3.65*.055/distance):0;
  const x=probe.x+(target.x-probe.x)*ratio,z=probe.z+(target.z-probe.z)*ratio;
  assert.ok(canWalk(x,z),'guided walker hit blocked terrain on school turn');
  probe={x,z};
}
assert.ok(closestRouteZ(probe.x,probe.z)<106,'school turn must remain passable at normal walk speed');
const approachCode=readFileSync(new URL('../public/hill-approach.js',import.meta.url),'utf8');
assert.ok(approachCode.includes('function straightContinuation'),'forked street missing');
assert.ok(approachCode.includes('z<=306'),'lower railing must reach beyond start');
assert.ok(approachCode.includes('z1=295'),'retaining wall must cover lower approach');
assert.ok(approachCode.includes('const taper=t=>'),'fork street must taper: no overlapping sidewalk wedges');
assert.ok(approachCode.includes('raisedStrip(scene,C,H,104,149'),'fork sidewalks should stop short of intersection');
assert.ok(routeCode.includes('const z=98,x=C(z)-15.6'),'restaurant block must be on steep climb');
assert.ok(!approachCode.includes('parkedCar(scene,center,heightAt,194'),'start must remain free of cars');
for(let z=checkpoints[0].z;z>=-73;z-=.5){
  for(const side of [-1,1]){
    const p=sidePoint(z,side*5.35);
    assert.ok(canWalk(p.x,p.z),'sidewalk blocked after bend at z='+z+' side='+side);
  }
}
assert.ok(hillCode.includes('addLowerHillApproach'),'lower approach must be rendered');
console.log('PASS: longer steep lower hill, post-school climb, smooth junctions and sidewalks');

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
async function preparePage(browser, options, stop = '', smokeWalk = false) {
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
  const url = base + '/?map=hill' + (stop ? '&stop=' + encodeURIComponent(stop) : '') + (smokeWalk ? '&smokeWalk=1' : '');
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
  assert.match(await previewDesktop.page.locator('[data-journey-label]').innerText(),/1\/9.*언덕 맨 아래/);
  assert.equal(parseFloat(await previewDesktop.page.locator('[data-journey-fill]').evaluate(node=>node.style.width)),0);
  const journeyToggle = previewDesktop.page.locator('[data-journey-toggle]');
  const walkButton = previewDesktop.page.locator('[data-journey-walk]');
  assert.equal(await journeyToggle.getAttribute('aria-expanded'),'false','journey panel starts minimized');
  assert.equal(await walkButton.isVisible(),false,'walk controls should not obscure the view');
  await journeyToggle.click();
  assert.equal(await journeyToggle.getAttribute('aria-expanded'),'true','journey detail expands on tap');
  assert.equal(await walkButton.isVisible(), true, 'guided hill walking button visible when expanded');
  await walkButton.click();
  assert.equal(await journeyToggle.getAttribute('aria-expanded'),'false','journey auto-collapses after walking starts');
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
  // Phone screenshot must show the compact one-line progress pill, not
  // the oversized location card that previously covered the streetscape.
  const mobileJourney=previewMobile.page.locator('[data-journey]');
  const mobileBox=await mobileJourney.boundingBox();
  assert.ok(mobileBox && mobileBox.height<70 && mobileBox.width<210,
    'default mobile journey must be a small pill: '+JSON.stringify(mobileBox));
  assert.equal(await previewMobile.page.locator('[data-journey-walk]').isVisible(),false);
  await previewMobile.page.screenshot({path:'artifacts/hill-mobile.png',timeout:30000});
  await previewMobile.context.close();

  // Capture the real route's landmark views separately. All stops share the
  // same continuous world; the stop URL is a preview/deep-link spawn only.
  for(const id of ['entrance','lower-slope','elementary','school-turn','steep-shops','yungane','budaetong','university']){
    const item=await preparePage(browser,{viewport:{width:1200,height:740}},id);
    await item.page.screenshot({path:'artifacts/stop-'+id+'.png',timeout:30000});
    await item.context.close();
  }

  // From the school, the guided walker must actually curve left and enter the
  // steep shop lane without stopping or walking into the straight side street.
  const schoolGuide=await preparePage(browser,{viewport:{width:1100,height:680}},'elementary',true);
  const guideButton=schoolGuide.page.locator('[data-journey-walk]');
  const schoolToggle=schoolGuide.page.locator('[data-journey-toggle]');
  await schoolToggle.click();
  await guideButton.click();
  await waitUntil(async()=>await guideButton.getAttribute('aria-pressed')==='true',
    'guided school walk activation',25000);
  let diagnostics=0;
  await waitUntil(async()=>{
    const pct=parseFloat(await schoolGuide.page.locator('[data-journey-fill]').evaluate(n=>n.style.width));
    const active=await guideButton.getAttribute('aria-pressed');
    if(++diagnostics%20===1)console.log('school turn progress',pct,'active',active);
    if(active==='false' && pct<25)throw new Error('Guided walk stopped before left turn: progress '+pct+'%');
    return pct>25;
  },'guided left turn immediately after elementary school',60000);
  await waitUntil(async()=>await guideButton.getAttribute('aria-pressed')==='false',
    'finish the school junction guided stage',35000);
  await schoolToggle.click();
  await guideButton.click(); // Continue from the junction onto the shop climb.
  await waitUntil(async()=>await guideButton.getAttribute('aria-pressed')==='true',
    'guided restaurant stage activation',25000);
  await waitUntil(async()=>parseFloat(await schoolGuide.page.locator('[data-journey-fill]').evaluate(n=>n.style.width))>29.2,
    'guided arrival on the steeper restaurant road',60000);
  await schoolGuide.page.screenshot({path:'artifacts/after-school-guided-turn.png',timeout:30000});
  await schoolGuide.context.close();

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
