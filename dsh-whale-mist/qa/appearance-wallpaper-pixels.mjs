// Isolated browser reproduction. Loads the real client and recorded official CSS;
// uses the host's sticky composer / scrolling sibling view hierarchy. No Desktop/WE.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { createProfile, removeProfile, createRunDirectory, evidencePath, verifyPersisted } from './temp-profile.mjs';
const qa = process.env.WM_QA_ROOT || dirname(fileURLToPath(import.meta.url));
const files = {
  '/client.js': await readFile(process.env.WM_CLIENT_SOURCE || join(qa, '../src/client.js')),
  '/harness.js': await readFile(join(qa, 'appearance-harness.js')),
  '/fixture.js': await readFile(join(qa, 'appearance-wallpaper-fixture.js')),
  '/host.css': await readFile(process.env.WM_OFFICIAL_CSS || join(qa,'fixtures/conversation-host-rc2.css')),
};
const server = createServer((req,res)=>{
  if(files[req.url]){res.writeHead(200,{'content-type':req.url.endsWith('.css')?'text/css':'text/javascript','cache-control':'no-store'});res.end(files[req.url]);return;}
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  res.end(`<!doctype html><html data-windows-titlebar><head><link rel="stylesheet" href="/host.css"><style>
  html,body{margin:0;width:100%;height:100%} html{--dsh-windows-titlebar-height:32px} #root{position:fixed!important;inset:0}
  .BynINW_frame{height:100%;width:100%;box-sizing:border-box}
  .BynINW_sidebarCol{position:absolute;left:0;top:32px;bottom:0;width:160px}
  .BynINW_centerCol{position:absolute;left:160px;right:0;top:32px;bottom:0}
  .Dc7zOa_root{height:100%}.Dc7zOa_header{height:60px;min-height:60px}
  .Dc7zOa_body{flex:1;min-height:0;display:flex;flex-direction:column}
  [data-slot="conversation.session"]{display:contents}
  .history{height:2200px;flex:none;color:yellow;font:20px/24px monospace;
    background:repeating-linear-gradient(yellow 0px,yellow 8px,transparent 8px,transparent 16px)}
  .RlGAzG_card{width:72%;height:120px;box-sizing:border-box;border-radius:20px;align-self:center}
  .composer-toolbar{height:24px;flex:none}.composer-footer{height:28px;flex:none}
  #wm-backdrop{background:magenta!important}.wm-backdrop-media{visibility:hidden!important}
  .wm-backdrop-mask{background:transparent!important} *{transition:none!important;animation:none!important}
  </style></head><body><main id="root"><div class="BynINW_frame">
  <div class="BynINW_sidebarCol"></div><div class="BynINW_centerCol"><div class="Dc7zOa_root" data-phase="active">
  <div class="Dc7zOa_header"></div><div class="Dc7zOa_body" data-content-phase="active" data-conversation-content>
  <div class="Dc7zOa_scrollBody" data-conversation-scroll><div data-slot="conversation.session"><div class="Dc7zOa_viewArea">
  <div class="history">LONG CHAT HISTORY<br>TEXT MUST DISAPPEAR AT INPUT AREA</div></div></div>
  <div class="Dc7zOa_composerSeat" data-composer-seat data-conversation-region="composer">
  <div class="composer-toolbar"></div><div class="RlGAzG_card"><textarea style="width:85%;height:60%;color:white;background:transparent" aria-label="draft"></textarea><button id="menu">Menu</button></div>
  <div class="composer-footer"></div></div></div></div></div></div></div></main>
  <script src="/harness.js"></script><script src="/fixture.js"></script><script src="/client.js"></script></body></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await createProfile('wm-history-pixels-');
const runDir = await createRunDirectory('wm-history-pixels');
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=spawn(process.env.WHALE_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
 ['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--disable-sync','--disable-background-networking','--no-proxy-server',url],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let socket; let id=0;const pending=new Map();const reports=[];
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
 assert.ok(port,'isolated browser launched');
 const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
 const page=pages.find(p=>p.type==='page'&&p.url===url); assert.ok(page,'isolated test page');
 socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{pending.delete(key);reject(Error(method+' timeout'));},15000);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await cdp('Emulation.setDeviceMetricsOverride',{width:900,height:700,deviceScaleFactor:1,mobile:false});
 for(let i=0;i<50&&!await evaluate('Boolean(window.fixture?.boot && window.whaleModule)');i++)await sleep(100);
 await evaluate(`(async()=>{const history=document.querySelector('.history');history.replaceChildren(...Array.from({length:100},(_,i)=>{const row=document.createElement('div');row.style.cssText='height:22px;line-height:22px';row.textContent='MESSAGE '+i+' — text scrolling through the input area';return row;}));fixture.wallpaperHost();localStorage.setItem('dsh-whale-mist.appearance.v1',JSON.stringify({theme:'abyss',palette:'ocean',canvas:'clear',background:'wallpaper',wallpaperMode:'daily',surface:40}));fixture.boot();await fixture.controller.wallpaper.start('lucy');await fixture.wait(()=>document.body.dataset.wmBackdrop==='wallpaper');return true;})()`);
 const snapshot=async(hidden)=>{
  await evaluate(`document.querySelector('.history').style.visibility=${JSON.stringify(hidden?'hidden':'visible')};true`);
  await sleep(80);
  const shot=await cdp('Page.captureScreenshot',{format:'png'});
  return evaluate(`(async()=>{const img=new Image();img.src=${JSON.stringify('data:image/png;base64,'+shot.data)};await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const scale=img.width/window.innerWidth;const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};const card=rect(document.querySelector('.RlGAzG_card'));const seat=rect(document.querySelector('[data-composer-seat]'));const view=rect(document.querySelector('.Dc7zOa_viewArea'));const scroll=rect(document.querySelector('[data-conversation-scroll]'));const content=rect(document.querySelector('[data-conversation-content]'));const at=(a,b)=>Array.from(x.getImageData(Math.round(a*scale),Math.round(b*scale),1,1).data);const samples=[],above=[];for(let y=Math.ceil(card.top);y<content.bottom-1;y++){samples.push(at(scroll.left+12,y),at(scroll.right-28,y));if(y>card.bottom+3)samples.push(at((card.left+card.right)/2,y));}for(let y=Math.ceil(card.top)-64;y<card.top-32;y++){above.push(at(scroll.left+12,y));}return {card,seat,view,scroll,samples,above,scale,background:document.body.dataset.wmBackdrop,surface:fixture.controller.read().surface,cardPixel:at(card.left+8,card.top+40),below:at((card.left+card.right)/2,card.bottom+8),strip:at(450,12),clip:getComputedStyle(document.querySelector('.Dc7zOa_viewArea')).clipPath,mask:getComputedStyle(document.querySelector('.Dc7zOa_viewArea')).maskImage};})()`);
 };
 const runCase=async(label)=>{
  const hidden=await snapshot(true),painted=await snapshot(false);
  const delta=(a,b)=>a.slice(0,3).reduce((n,v,i)=>n+Math.abs(v-b[i]),0);
  const leaks=painted.samples.filter((p,i)=>delta(p,hidden.samples[i])>3).length;
  const wallpaper=p=>p[0]-p[1]>60&&p[2]-p[1]>60;
  const aboveVisible=painted.above.some((p,i)=>delta(p,hidden.above[i])>20);
  const result={label,leaks,aboveVisible,wallpaperOutside:hidden.samples.every(wallpaper),...painted};delete result.samples;delete result.above;reports.push(result);
  const out=await evidencePath('WM_PIXEL_OUTPUT',runDir,'result.json');await writeFile(out,JSON.stringify({isolated:true,reports},null,2));await verifyPersisted(out);
  console.log(JSON.stringify(result));
  assert.ok(wallpaper(hidden.below),label+': wallpaper below card must remain visible');
  assert.ok(result.wallpaperOutside,label+': wallpaper beside card must remain visible');
  assert.ok(painted.samples.length>100,label+': scan the full area around and below the card, not an empty shortened scrollport');
  assert.equal(leaks,0,label+': old messages must be fully hidden beside/below card');
  assert.ok(!wallpaper(painted.cardPixel),label+': input card opaque');
  assert.ok(!wallpaper(painted.strip),label+': titlebar opaque');
  assert.ok(aboveVisible,label+': history visible above boundary');
 };
 const mutants={unclipped:'#root [data-wm-history-clip]{clip-path:none!important} #root [data-wm-message-port]{margin-bottom:0!important}',solidSeat:'#root .Dc7zOa_composerSeat{background:rgb(8,11,20)!important}',solidFrame:'#root .BynINW_frame{background:rgb(8,11,20)!important}'};
 if(process.env.WM_PIXEL_MUTANT){assert.ok(mutants[process.env.WM_PIXEL_MUTANT],'known negative control');await evaluate(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(mutants[process.env.WM_PIXEL_MUTANT])};document.head.append(s);return true;})()`);}
 await runCase('long-history-scroll-0');
 await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop=1e6;true`);await sleep(100);await runCase('native-scroll-end');
 assert.equal(await evaluate(`(()=>{const s=document.querySelector('[data-conversation-scroll]');const last=document.querySelector('.history').lastElementChild;const r=last.getBoundingClientRect();return s.scrollTop>0&&r.bottom<=document.querySelector('.RlGAzG_card').getBoundingClientRect().top+1&&r.bottom>s.getBoundingClientRect().top;})()`),true,'last message remains reachable at native scroll end');
 await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop=440;true`);await sleep(100);await runCase('scrolled-440');
 await evaluate(`document.querySelector('.RlGAzG_card').style.height='280px';true`);await sleep(100);await runCase('multiline-280');
 await evaluate(`document.querySelector('.RlGAzG_card').style.height='120px';true`);await sleep(100);await runCase('draft-shrunk-120');
 await evaluate(`(()=>{const v=document.querySelector('.history');const row=document.createElement('div');row.style.height='22px';row.textContent='NEW FINAL MESSAGE';v.append(row);v.style.height='2300px';document.querySelector('[data-conversation-scroll]').scrollTop=1e6;return true;})()`);await sleep(100);await runCase('appended-message-scroll-end');
 assert.equal(await evaluate(`(()=>{const r=document.querySelector('.history').lastElementChild.getBoundingClientRect();return r.bottom<=document.querySelector('.RlGAzG_card').getBoundingClientRect().top+1;})()`),true,'appended message remains above the input boundary at scroll end');
 await cdp('Emulation.setDeviceMetricsOverride',{width:560,height:850,deviceScaleFactor:1,mobile:false});await sleep(100);await runCase('narrow-tall');
 await evaluate(`(()=>{const view=document.querySelector('.Dc7zOa_viewArea');const replacement=view.cloneNode(true);replacement.removeAttribute('data-wm-history-clip');replacement.style.removeProperty('--wm-history-clip-bottom');view.replaceWith(replacement);return true;})()`);await sleep(100);await runCase('session-view-replaced');
 await evaluate(`fixture.controller.set('surface',100);true`);await sleep(100);await runCase('surface-100');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1000,height:800,deviceScaleFactor:1.5,mobile:false});await sleep(100);await runCase('dpi-150-percent');
 await evaluate(`(()=>{const input=document.querySelector('textarea');input.focus();input.value='draft selection';input.setSelectionRange(0,5);return true;})()`);
 assert.equal(await evaluate(`document.activeElement===document.querySelector('textarea')&&document.querySelector('textarea').selectionEnd===5`),true,'input and selection outside clipped view');
 await evaluate(`(()=>{const button=document.createElement('button');button.id='port-menu-test';button.style.cssText='position:fixed;left:300px;bottom:50px;width:120px;height:30px;z-index:9999';button.textContent='menu';button.onclick=()=>button.dataset.clicked='yes';document.body.append(button);return true;})()`);
 assert.equal(await evaluate(`(()=>{const b=document.getElementById('port-menu-test');const r=b.getBoundingClientRect();const target=document.elementFromPoint(r.left+5,r.top+5);target.click();return target===b&&b.dataset.clicked==='yes';})()`),true,'portal menu remains visible and clickable near the input');
 await evaluate(`document.getElementById('port-menu-test').remove();document.querySelector('[data-conversation-content]').dataset.contentPhase='hero';true`);await sleep(100);
 assert.equal(await evaluate(`document.querySelectorAll('[data-wm-message-port], [data-wm-fixed-composer]').length`),0,'leaving active chat restores the host layout');
 await evaluate(`document.querySelector('[data-conversation-content]').dataset.contentPhase='active';true`);await sleep(100);await runCase('active-chat-returned');
 await evaluate(`(()=>{const history=document.querySelector('.history');window.__savedHistory=history.innerHTML;window.__savedHeight=history.style.height;history.innerHTML='<div style="height:22px">SHORT MESSAGE</div>';history.style.height='22px';return true;})()`);await sleep(100);
 assert.equal(await evaluate(`(()=>{const s=document.querySelector('[data-conversation-scroll]');const card=document.querySelector('.RlGAzG_card').getBoundingClientRect();return Math.abs(s.getBoundingClientRect().bottom-card.top)<=1&&s.scrollTop===0&&card.bottom<innerHeight;})()`),true,'short chat keeps the card docked and does not create a spurious scroll range');
 await evaluate(`(()=>{const h=document.querySelector('.history');h.innerHTML=window.__savedHistory;h.style.height=window.__savedHeight;return true;})()`);await sleep(100);await runCase('long-chat-restored');
 const geometry=await evaluate(`(()=>{const v=document.querySelector('.Dc7zOa_viewArea');const card=document.querySelector('.RlGAzG_card');return {viewBottom:v.getBoundingClientRect().bottom,cardTop:card.getBoundingClientRect().top,clip:parseFloat(v.style.getPropertyValue('--wm-history-clip-bottom')),frames:fixture.preview.frames};})()`);
 assert.ok(Math.abs(geometry.viewBottom-geometry.clip-geometry.cardTop)<=1,'clip boundary aligned with card top');
 await sleep(200);
 assert.equal(await evaluate(`document.querySelector('[data-wm-history-clip]').style.getPropertyValue('--wm-history-clip-bottom')`),geometry.clip+'px','later frames preserve measurement');
 await evaluate(`(async()=>{await fixture.controller.wallpaper.stop();return true;})()`);await sleep(100);
 const cleanup=await evaluate(`({attrs:document.querySelectorAll('[data-wm-history-clip]').length,clip:getComputedStyle(document.querySelector('.Dc7zOa_viewArea')).clipPath,bodyFade:document.body.style.getPropertyValue('--wm-history-fade')})`);
 assert.equal(cleanup.attrs,0,'stop removes owned attributes');assert.equal(cleanup.clip,'none','stop restores host clipping');assert.equal(cleanup.bodyFade,'','no legacy variable');
 assert.equal(await evaluate(`document.querySelectorAll('[data-wm-message-port], [data-wm-fixed-composer]').length`),0,'stop restores the native host layout');
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-composer-seat]')).position`),'sticky','stop restores sticky composer');
 await evaluate(`(async()=>{await fixture.controller.importMedia('image',await fixture.makeImage());fixture.controller.set('surface',40);await fixture.wait(()=>document.body.dataset.wmBackdrop==='image');return true;})()`);await sleep(100);await runCase('image-shared-rule');
 await evaluate(`(async()=>{await fixture.controller.importMedia('video',await fixture.makeVideo());await fixture.wait(()=>document.body.dataset.wmBackdrop==='video');return true;})()`);await sleep(100);await runCase('video-shared-rule');
 await evaluate(`(async()=>{fixture.controller.set('background','wallpaper');await fixture.controller.wallpaper.start('lucy');await fixture.wait(()=>document.body.dataset.wmBackdrop==='wallpaper');const before=window.fetch;window.fetch=async(...args)=>{const response=await before(...args);if(String(args[0]).includes('/whale-wallpaper/stop'))await new Promise(r=>setTimeout(r,450));return response;};fixture.controller.set('background','image');await fixture.wait(()=>document.body.dataset.wmBackdrop==='image');return true;})()`);await sleep(600);await runCase('late-wallpaper-stop-does-not-unclip-image');
 await evaluate(`fixture.controller.set('background','none');true`);await sleep(100);
 assert.equal(await evaluate(`document.querySelectorAll('[data-wm-history-clip]').length`),0,'none restores message layer');
 await evaluate(`(async()=>{fixture.controller.set('background','wallpaper');await fixture.controller.wallpaper.start('lucy');await fixture.wait(()=>document.querySelector('[data-wm-history-clip]'));fixture.dispose();return true;})()`);await sleep(100);
 await evaluate(`document.querySelector('[data-conversation-scroll]').scrollTop+=40;document.querySelector('.RlGAzG_card').style.height='150px';true`);await sleep(100);
 assert.equal(await evaluate(`document.querySelectorAll('[data-wm-history-clip]').length`),0,'disposed observers never recreate clipping');
 assert.equal(await evaluate(`document.querySelectorAll('[data-wm-message-port], [data-wm-fixed-composer]').length`),0,'disposed observers never recreate dock layout');
 console.log('history pixel checks passed; stop cleanup verified');
}finally{socket?.close();for(const p of pending.values())clearTimeout(p.timer);browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));await removeProfile(profile);}
