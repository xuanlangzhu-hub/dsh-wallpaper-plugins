import { Context } from '../../.tmp/detachable-appearance-p0-seventh-review-20261017-fca7697e/new-sdk/node_modules/@deepseek-ai/cordis/lib/index.js';
import { HostConnectionService } from '../../.tmp/detachable-appearance-p0-seventh-review-20261017-fca7697e/new-sdk/node_modules/@deepseek-ai/dsh-client-connection/lib/index.js';
import * as plugin from '../src/index.js';

const root = new Context();
const routes = [];
let connection;
process.env.WM_CONTRACT_ISOLATED = '1';

const result = { sdk: 'actual extracted 0.2.1-rc.2', liveDSHUsed: false };

try {
  root.plugin({
    name: 'isolated-provider',
    apply(ctx) {
      ctx.provide('webServer', {
        host: '127.0.0.1',
        protocol: 'http:',
        register(r) {
          routes.push(r);
          return () => {};
        }
      });
      connection = new HostConnectionService(ctx, ['127.0.0.1'], {
        isAuthenticated() { return false; },
        authenticateApi() { return undefined; }
      });
    }
  });

  await new Promise(r => setTimeout(r, 30));

  root.plugin({
    name: 'isolated-whale',
    inject: plugin.inject,
    apply(ctx) {
      ctx.on('dispose', () => { result.disposeEventFired = true; });
      ctx.effect(() => () => { result.effectDisposed = true; });
      plugin.apply(ctx);
    }
  });

  await new Promise(r => setTimeout(r, 100));

  const req = { method: 'GET', url: '/whale-appearance/bootstrap', headers: { host: '127.0.0.1' } };
  result.connectionIsAuthenticatedType = typeof connection.isAuthenticated;
  result.actualRequestRejection = connection.requestRejection(req);

  const route = routes.find(r => r.path === '/whale-appearance/bootstrap');
  let status, body;
  await route.handler(req, {
    writeHead(s) { status = s; },
    end(b) { body = JSON.parse(b); }
  });

  result.anonymousBootstrapStatus = status;
  result.mainTokenDisclosed = Boolean(body?.mainToken);
} catch (e) {
  result.error = e.stack;
} finally {
  await root.fiber.dispose();
  delete process.env.WM_CONTRACT_ISOLATED;
}

await new Promise(r => setTimeout(r, 50));
result.listeningServersAfterDispose = process._getActiveHandles()
  .filter(h => h.constructor.name === 'Server')
  .map(h => ({ listening: h.listening, address: h.address() }));

console.log(JSON.stringify(result, null, 2));
process.exit(0);
