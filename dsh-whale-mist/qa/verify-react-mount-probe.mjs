import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const probeDir = 'F:\\dsh-wallpaper-plugins\\.tmp\\detachable-p1a-review-20261017-b9a9679c';
const pluginDir = 'F:\\dsh-wallpaper-plugins\\dsh-whale-mist';

let harness = await readFile(join(probeDir, 'frozen/qa/appearance-harness.js'), 'utf8');
harness = harness.slice(0, harness.indexOf('const React = {')) + 'const React=window.RealReact;\n' + harness.slice(harness.indexOf('window.__ModuleLoader__'));
harness = harness.replace('register(config, component) {', 'register(config, component) { window.reviewSlots.push({config,component});');

const sources = {};
for (const [key, file] of Object.entries({
  react: 'react/cjs/react.production.js',
  scheduler: 'scheduler/cjs/scheduler.production.js',
  'react-dom': 'react-dom/cjs/react-dom.production.js',
  client: 'react-dom/cjs/react-dom-client.production.js'
})) {
  sources[key] = await readFile(join(probeDir, 'react-deps', file), 'utf8');
}

const clientJs = await readFile(join(pluginDir, 'src/client.js'), 'utf8');

const html = `<!doctype html><html><body><div id="mount"></div><script>
window.reviewSlots=[];window.reviewErrors=[];window.addEventListener('error',e=>window.reviewErrors.push(e.message));
</script><script type="module">
const src=${JSON.stringify(sources).replaceAll('<', '\\u003c')};const cache={};
for(const key of ['react','scheduler','react-dom','client']){const module={exports:{}};new Function('module','exports','require',src[key])(module,module.exports,k=>cache[k]);cache[key]=module.exports;}
window.RealReact=cache.react;window.RealReactDOM=cache.client;
await new Promise(r=>{const s=document.createElement('script');s.src='/harness.js';s.onload=r;document.head.append(s);});
await new Promise(r=>{const s=document.createElement('script');s.src='/client.js';s.onload=r;document.head.append(s);});
fixture.boot();const slot=reviewSlots.find(s=>s.config.id==='whale-appearance-trigger');const props=slot.config.inject();
window.snapshotStable=Object.is(props.appearanceBridge.getSnapshot(),props.appearanceBridge.getSnapshot());
const rt=RealReactDOM.createRoot(document.getElementById('mount'),{onUncaughtError:e=>reviewErrors.push(e.message)});
rt.render(RealReact.createElement(slot.component,props));setTimeout(()=>window.reviewReady=true,300);
</script></body></html>`;

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html');
  if (req.url === '/harness.js') res.end(harness);
  else if (req.url === '/client.js') res.end(clientJs);
  else res.end(html);
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const profile = join(probeDir, `react-browser-profile-${Date.now()}`);
await mkdir(profile, { recursive: true });

const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  `http://127.0.0.1:${server.address().port}/`
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function createCdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  const pending = new Map();
  let id = 0;

  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const req = pending.get(msg.id);
    if (req) {
      pending.delete(msg.id);
      clearTimeout(req.timer);
      if (msg.error) req.reject(new Error(msg.error.message));
      else req.resolve(msg.result);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => {
        pending.delete(key);
        reject(new Error(`CDP Timeout: ${method}`));
      }, 20000);
      pending.set(key, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: key, method, params }));
    });

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  return { socket, send, evaluate };
}

let cdp;
try {
  let port;
  for (let i = 0; i < 80; i++) {
    try {
      port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      if (port) break;
    } catch {
      await sleep(100);
    }
  }
  if (!port) throw Error('devtools not ready');

  let tabs;
  for (let i = 0; i < 30; i++) {
    try {
      tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
      if (Array.isArray(tabs) && tabs.length > 0) break;
    } catch {
      await sleep(100);
    }
  }
  if (!tabs) throw Error('failed to get devtools tabs');

  cdp = await createCdpClient(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  for (let i = 0; i < 60; i++) {
    if (await cdp.evaluate('Boolean(window.reviewReady)')) break;
    await sleep(100);
  }
  const result = await cdp.evaluate('({reactVersion:RealReact.version,snapshotStable,errors:reviewErrors,headerPresent:!!document.getElementById("whale-appearance-header-btn"),liveDSHUsed:false})');
  console.log(JSON.stringify(result, null, 2));
  await cdp.evaluate('fixture.dispose()');
} finally {
  cdp?.socket.close();
  if (browser.exitCode === null) {
    await new Promise(r => { browser.once('exit', r); browser.kill(); });
  }
  await new Promise(r => server.close(r));
}
