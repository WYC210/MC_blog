import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/', import.meta.url);
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const report = [];
try {
  const studio = await browser.newPage({ viewport: { width: 1080, height: 650 }, deviceScaleFactor: 1 });
  await studio.route('**/__scholar-preview', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head><meta charset="utf-8">
    <script type="importmap">{"imports":{"three":"/vendor/three/three.module.min.js"}}</script>
    <style>body{margin:0;background:#e8e8dd;color:#32464c;font-family:system-ui,sans-serif}header{position:absolute;left:38px;top:25px}h1{margin:0;font-size:27px}p{margin:8px 0;font-size:14px}canvas{display:block}footer{position:absolute;bottom:24px;left:38px;font-size:13px}</style>
    </head><body><header><h1>Wyc · 青衫书生</h1><p>墨发束髻 / 米白交领 / 玉坠腰封 / 布靴</p></header><footer>64 × 64 PNG · Classic 4px arms · Original pixel skin</footer>
    <script type="module">
      import * as THREE from 'three';
      import { createAvatar } from '/engine/world/avatar.js';
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#e8e8dd');
      const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(1); document.body.append(renderer.domElement);
      const camera = new THREE.OrthographicCamera(-3.1,3.1,1.87,-1.87,0.1,30); camera.position.set(0,2.5,9); camera.lookAt(0,1,0);
      scene.add(new THREE.HemisphereLight(0xf9f8ef,0x667579,2.5));
      const sun = new THREE.DirectionalLight(0xffefdb,2); sun.position.set(-3,7,5); scene.add(sun);
      const actors = [-1.9,0,1.9].map((horizontal,index)=>{const avatar=createAvatar('/assets/me.png'); avatar.root.position.x=horizontal; avatar.root.rotation.y=[-0.34,0.7,Math.PI+0.4][index]; avatar.update(0,{speed:0,fly:-1}); scene.add(avatar.root); return avatar;});
      window.__scholarStudio={actors,render:()=>renderer.render(scene,camera)}; renderer.setAnimationLoop(()=>renderer.render(scene,camera));
    </script></body></html>` }));
  await studio.goto(new URL('/__scholar-preview', base).href);
  await studio.waitForFunction(() => window.__scholarStudio?.actors.every(avatar => {
    const pixel = avatar.material.map.image.getContext('2d').getImageData(8, 8, 1, 1).data;
    return pixel[0] === 32 && pixel[1] === 41 && pixel[2] === 49;
  }));
  await studio.screenshot({ path: fileURLToPath(new URL('scholar-skin-studio.png', output)) });
  await studio.close();

  for (const view of [
    { name: 'desktop', viewport: { width: 1280, height: 800 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [], originalSkinRequests = [];
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
      route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('terry-skin.png')) originalSkinRequests.push(request.url()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.extras?.resident || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    await page.waitForFunction(() => [__home.avatar, __home.extras.resident.avatar].every(avatar => {
      const pixel = avatar.material.map.image.getContext('2d').getImageData(8, 8, 1, 1).data;
      return pixel[0] === 32 && pixel[1] === 41 && pixel[2] === 49;
    }));
    const checked = await page.evaluate(async () => {
      const { config } = await import('/engine/config.js');
      const { boxRegions } = await import('/engine/world/skin.js');
      const { icon } = await import('/engine/ui/icons.js');
      const png = new Image(); png.src = '/assets/me.png'; await png.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
      const paint = canvas.getContext('2d'); paint.drawImage(png,0,0);
      const skin = canvas.toDataURL(), pixels = paint.getImageData(0,0,64,64).data;
      const parts = [[0,0,8,8,8],[16,16,8,12,4],[40,16,4,12,4],[32,48,4,12,4],[0,16,4,12,4],[16,48,4,12,4]];
      const opaque = parts.every(part => boxRegions(...part).every(([left,top,width,height]) => {
        for(let row=top;row<top+height;row++)for(let column=left;column<left+width;column++)if(pixels[(row*64+column)*4+3]!==255)return false;
        return true;
      }));
      const home = __home, resident = home.extras.resident;
      home.weather.dispose(); home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      resident.update = () => {};
      home.player.teleport(0.5,18,{look:[0.5,23],floor:0});
      home.rig.skipIntro(); home.rig.showcase([2.8,2.3,21.8],[0.5,0.95,18]);
      for(let frame=0;frame<180;frame++)home.rig.update(1/60,home.player);
      return { configured:config.skin,opaque,player:home.avatar.material.map.image.toDataURL()===skin,
        resident:resident.avatar.material.map.image.toDataURL()===skin,phone:document.querySelector('#phone .who img').src===icon('about').url,
        name:document.querySelector('.resident-greeting b').textContent,hatAlpha:pixels[(10*64+46)*4+3] };
    });
    assert.equal(checked.configured,'assets/me.png');
    assert.ok(checked.opaque && checked.player && checked.resident && checked.phone,JSON.stringify(checked));
    assert.equal(checked.hatAlpha,0,'The face must remain visible through the head overlay');
    assert.deepEqual(originalSkinRequests,[]);
    await page.waitForTimeout(500);
    await page.screenshot({ path:fileURLToPath(new URL(`scholar-skin-${view.name}.png`,output)) });
    const stats=await page.evaluate(()=>__home.stats());
    assert.ok(stats.calls<=60 && stats.triangles<=200000 && stats.lights<=2,JSON.stringify(stats));
    assert.deepEqual(errors,[]);
    report.push({view:view.name,checked,stats});
    console.log(`${view.name}: standard skin, opaque UV faces, owner/player/phone sync, no Terry texture requests and render budget passed`);
    await context.close();
  }
  writeFileSync(new URL('scholar-skin-report.json',output),JSON.stringify(report,null,2));
} finally { await browser.close(); }
