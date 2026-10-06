// Contract check against the installed official Cordis SDK.
//
// The rc.2 review found that the theme read `ctx.webServer` without declaring the
// service, so the real Context threw `cannot get property "webServer" without inject`
// and the routes were never registered. This loads the theme module from THIS checkout
// and checks the declaration with the real Context, not with a plain object stand-in.
//
// It runs with WM_CONTRACT_ISOLATED=1, so `apply` skips the desktop icon helper and any
// window work: a contract check must not touch the running Desktop.
//
// Run through qa/wallpaper/sdk-contract.cmd (needs the Desktop node runtime).
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Resolve the theme from this checkout, never from a hard-coded historical path.
const theme = pathToFileURL(resolve(here, '../../src/index.js')).href;
const sdk = process.env.WM_CONTRACT_SDK
  ?? 'file:///C:/Users/HP/AppData/Local/Programs/DeepSeek%20Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/cordis/lib/index.js';
const out = process.env.WM_CONTRACT_OUT ?? join(here, 'sdk-contract-result.json');
process.env.WM_CONTRACT_ISOLATED = '1';

const result = { themeModule: theme, sdkModule: sdk, isolated: true };
try {
  const { Context } = await import(sdk);
  const module = await import(theme);
  result.declaredInject = module.inject;
  result.hasApply = typeof module.apply === 'function';

  const root = new Context();
  const registered = [];
  const routes = [];
  root.plugin({
    name: 'wm-contract-provider',
    apply(ctx) { ctx.provide('webServer', { register(route) { registered.push(route.path); routes.push(route); return () => {}; } }); },
  });
  await new Promise(resolve => setTimeout(resolve, 20));

  root.plugin({ name: 'wm-contract-theme', inject: module.inject, apply: module.apply });
  await new Promise(resolve => setTimeout(resolve, 120));

  result.registeredRoutes = registered;
  result.routesRegistered = registered.includes('/whale-wallpaper');

  // Exercise the composed route through the real Context: this is the contract the rc.2
  // review found broken (the declaration existed nowhere, so the route was never there).
  const route = routes.find(entry => entry.path === '/whale-wallpaper');
  if (route) {
    const call = async (method, url, body) => {
      const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
      const req = { method, url, async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; } };
      const response = { status: 0, payload: null, setHeader() {}, writeHead(code) { this.status = code; }, end(value) { this.payload = value; } };
      await route.handler(req, response);
      return { status: response.status, body: response.payload ? JSON.parse(response.payload) : null };
    };
    const status = await call('GET', '/whale-wallpaper/status');
    result.statusResponse = { status: status.status, available: status.body?.available, reason: status.body?.unavailableReason };
    result.statusReplyOk = status.status === 200 && typeof status.body?.available === 'boolean';
    // Only constrained actions exist: an unknown scene is refused without touching the
    // helper, so this check never creates a real window.
    const start = await call('POST', '/whale-wallpaper/start', { scene: '../../etc/passwd' });
    result.startWithUnknownScene = { status: start.status, error: start.body?.error };
    result.startRefused = start.status === 409 && /unknown scene/.test(String(start.body?.error));
    // The mode must be a constrained enum: an unknown mode is refused before any work.
    const badMode = await call('POST', '/whale-wallpaper/start', { scene: 'lucy', mode: 'forever-more' });
    result.unknownModeRefused = badMode.status === 409 && /unknown mode/.test(String(badMode.body?.error));
    result.badModeResponse = { status: badMode.status, error: badMode.body?.error };
    const metrics = await call('POST', '/whale-wallpaper/metrics', { rendered: 3, seconds: 1, bogus: 'x' });
    result.metricsAccepted = metrics.status === 204;
  } else {
    result.noInjectError = 'the theme did not register its routes';
  }
  await root.fiber.dispose();
} catch (error) {
  result.error = error.stack ?? String(error);
}
await writeFile(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.routesRegistered || !result.statusReplyOk || !result.startRefused || !result.unknownModeRefused
    || !result.metricsAccepted || result.error) process.exitCode = 1;
