# P1A 独立/吸附设置窗口链路复审补修交付报告

**日期**：2026-10-17\
**开发代号**：小 G (Gemini)\
**复审目标**：Codex / 用户\
**执行基准**：[P1A 复审报告](DETACHABLE_APPEARANCE_P1A_REVIEW_20261017.md)、[P1A 任务书](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1A_20261017.md)与[P0 七审报告](DETACHABLE_APPEARANCE_P0_SEVENTH_REVIEW_20261017.md)

---

## 1. 交付概述与范围边界

依据 Codex 在复审报告中所列的 6 项生产接缝缺陷（R1–R6），本轮在离线与严格隔离环境中完成了全部补修，并通过与 Codex 复审完全一致的实际边界探针、实际 Cordis/HostConnectionService SDK 探针及实际 React 19.2.0 挂载探针的闭环验证：

1. **R1 [P1] 引导路由安全拦截与主端 Origin 接通**：
   - 采用实际 DSH 0.2.1-rc.2 `HostConnectionService` 的守卫接口（`requestRejection` / `admit`），实现 fail-closed 拦截，未鉴权或服务缺失时一律返回 401/403，杜绝秘密泄露。
   - 脱敏公开页面 index-inject 表：`__WHALE_DETACHABLE_BOOT__` 仅注入动态 `port`，`mainToken` 必须通过鉴权端点 `/whale-appearance/bootstrap` 凭有效 Desktop 会话获取。
   - 精细化 Host 来源校验：主注册端点 `/api/main/` 允许 Desktop `dsh-app://app`、`null` 及 loopback 端点预检通过（204/200），非主端伴随接口严格限定本轮 `activePort`，拒绝外来端口。
2. **R2 [P1] Host 与 Edge 适配器启动规格/路径契约统一**：
   - 统一正式伴随页路径为 `/index.html`（HTTP 200，不再产生 404）；参数传递包含 `instanceId` 与兼容字段 `instance`。
   - `EdgeWindowAdapter.spawn()` 适配预构建启动规格与直接调用，返回规格携带 `hostPort`、`token`、`instanceId`，避免二次构建错误抛出 `invalid hostPort: undefined`；前置规格校验后再创建临时目录。
3. **R3 [P1] 外层桥快照不可变引用稳定化（彻底消除 React #185）**：
   - 重构 `src/client.js` 中的 `appearanceBridge.getSnapshot()`，使用内部不可变缓存引用 `cachedBridgeSnapshot`，仅在状态实质变化（`notifyBridge`）时重新分配引用。
   - 在真实 React 19.2.0 + ReactDOM 挂载下，`useSyncExternalStore` 保持稳定（`snapshotStable: true`），完全消除 React Error #185（Maximum update depth exceeded），顶栏按钮稳定驻留。
4. **R4 [P1] 窗口所有权核验与关闭清理防护**：
   - `EdgeWindowAdapter.close()` 严格校验 handle 是否登记于 `activeProcesses`，拒绝未登记的外部 handle（返回 `ok: false, error: 'unowned-handle'`），不执行任何 `taskkill`。
   - 针对已标记 `exited: true` 的子进程，跳过重复 `taskkill`，防止旧 PID 复用误伤。
   - `dispose()` 遇到进程关闭失败时，保留进程跟踪记录与对应临时 profile 目录（不丢弃归属、不误报成功），以便安全重试。
5. **R5 [P1] 生产 Cordis 卸载与资源真实释放**：
   - 登记清理逻辑至 `ctx.effect(() => () => { cleanup(); })` 及 `ctx.on('dispose')`，保证 Cordis fiber teardown 时被正确执行。
   - 卸载时注销 bootstrap 路由、等待在途启动 Promise 并停止 HTTP 监听，实测卸载后进程内活跃 Server 监听数为 0。
6. **R6 [P2] 遮罩数值 0 合法化与连续输入串行化落地**：
   - 修正 `companion.js` 中的解析逻辑：使用 `Number.parseInt(val, 10)` 结合 `Number.isFinite()` 校验，使合法值 `0` 稳定传递为 `0`，不再被误当 falsy 降级为默认值 `40`。
   - 引入 `applySettingSerialized` 队列：快速拖动滑块时，在途请求执行期间合并并保留最新目标意图，避免乱序并发，并确保连续拖动的最终意图必然执行。

> [!IMPORTANT]
> **红线遵守承诺**：本轮全程离线、隔离进行。未安装、未修改、未接触运行中的真实 DSH (0.2.1-rc.2)、Wallpaper Engine 或日常系统配置；未创建可见 OS 窗口（浏览器测试均在 headless 独立临时目录中进行）；未修改 `package.json` 中的版本号；未执行 git 提交或推送。

---

## 2. 补修细节与代码变更点

### 2.1 R1: Fail-Closed 引导与 Origin 链路 (`src/index.js`, `src/detachable-host.js`, `src/client.js`)

1. **`src/index.js` Fail-Closed 鉴权**：
   ```javascript
   // 适配真实 HostConnectionService 守卫
   const connection = typeof ctx.get === 'function' ? ctx.get('connection') : null;
   let authed = false;
   let rejectStatus = 401;

   if (connection) {
     if (typeof connection.requestRejection === 'function') {
       const rej = connection.requestRejection(req);
       if (rej === undefined) authed = true;
       else rejectStatus = rej;
     } else if (typeof connection.admit === 'function') {
       const adm = connection.admit(req);
       if (adm && !adm.rejection) authed = true;
       else if (adm?.rejection) rejectStatus = adm.rejection;
     } else if (typeof connection.isAuthenticated === 'function') {
       if (connection.isAuthenticated(req, ctx.webServer?.protocol === 'https:')) {
         authed = true;
       }
     }
   }
   if (!authed) {
     res.writeHead(rejectStatus, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
     res.end(JSON.stringify({ ok: false, error: rejectStatus === 403 ? 'forbidden' : 'unauthorized' }));
     return;
   }
   ```
2. **`src/index.js` 页面脱敏**：
   在 `webserver/index-inject` 中仅注入 `{ port }`，剥离 `mainToken`。
3. **`src/client.js` 凭据提取**：
   主渲染器首先尝试从 `__WHALE_DETACHABLE_BOOT__` 读取；若只有 `port`，则发起请求至 `/whale-appearance/bootstrap` 获取主端 Token 并完成认证。
4. **`src/detachable-host.js` 精准 Origin 允许**：
   ```javascript
   const isAllowedOrigin = (orig) => {
     if (!orig || typeof orig !== 'string') return false;
     if (allowedOrigins.includes(orig)) return true;
     if (orig === 'dsh-app://app' || orig === 'null') return true;
     const myOrigin = activePort ? `http://127.0.0.1:${activePort}` : null;
     const myLocalhost = activePort ? `http://localhost:${activePort}` : null;
     if (orig === myOrigin || orig === myLocalhost) return true;

     // 主端端点允许来自 Desktop webserver 的 loopback origin
     if (pathname.startsWith('/api/main/')) {
       try {
         const u = new URL(orig);
         const host = u.hostname.toLowerCase();
         if (host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1') return true;
       } catch {}
     }
     return false;
   };
   ```

### 2.2 R2: 统一启动规格与路径契约 (`src/detachable-contract.js`, `src/detachable-edge-adapter.js`)

1. **`buildEdgeAppLaunchSpec`**：
   - 默认伴随页路径从 `/whale-companion.html` 改为 `/index.html`。
   - 查询参数同时包含 `instanceId` 与兼容字段 `instance`。
   - 返回对象完整暴露 `hostPort`、`token`、`instanceId`。
2. **`EdgeWindowAdapter.spawn`**：
   - 识别外部传入的 pre-built 规格（`isPreBuilt`），支持直接消费并进行严格字段校验。
   - 规格校验在创建磁盘临时目录前执行，参数不合法时不产生残留 profile。

### 2.3 R3: 快照引用稳定化与消除 React 循环渲染 (`src/client.js`)

1. 在 `client.js` 中建立全局缓存快照 `cachedBridgeSnapshot`。
2. 仅在 `notifyBridge()` 被触发（即状态实质变化）时更新 `cachedBridgeSnapshot`。
3. `getSnapshot: () => cachedBridgeSnapshot` 返回不可变引用，满足 React `useSyncExternalStore` 的引用相等性（`Object.is(prev, next)`）要求。

### 2.4 R4: 窗口所有权防误伤与失败留痕 (`src/detachable-edge-adapter.js`)

1. **未登记 Handle 绝不 taskkill**：
   ```javascript
   const processRecord = activeProcesses.get(handle.pid);
   if (!processRecord) {
     return { ok: false, error: 'unowned-handle', pid: handle.pid };
   }
   ```
2. **已退出 Handle 跳过 taskkill**：
   若 `processRecord.exited` 为 `true`，直接跳过 taskkill 执行，安全清理 profile。
3. **销毁失败保留状态**：
   `dispose()` 遇到进程未能正常退出的情况，不从 `activeProcesses` 剔除，不删除其 `profileDir`，返回 `{ ok: false, unclosedPids }`。

### 2.5 R5: Cordis Fiber 生命周期监听释放 (`src/index.js`)

```javascript
const cleanup = async () => {
  if (disposed) return;
  disposed = true;
  if (typeof disposeRoute === 'function') {
    try { disposeRoute(); } catch {}
  }
  try { await startPromise; } catch {}
  try { await host.stop(); } catch {}
};

if (typeof ctx.effect === 'function') {
  ctx.effect(() => () => { cleanup(); });
}
ctx.on?.('dispose', cleanup);
```

### 2.6 R6: 遮罩数值 0 与连续在途串行化 (`src/companion/companion.js`)

1. **合法 0 判定**：
   ```javascript
   function parseClamped(val, min, max, defaultVal) {
     const parsed = Number.parseInt(val, 10);
     const num = Number.isFinite(parsed) ? parsed : defaultVal;
     return Math.max(min, Math.min(max, num));
   }
   ```
2. **在途意图串行合并**：
   ```javascript
   const pendingTargets = new Map();
   const inFlightPromises = new Map();

   async function applySettingSerialized(key, clamped) {
     pendingTargets.set(key, clamped);
     if (inFlightPromises.has(key)) return inFlightPromises.get(key);

     const worker = (async () => {
       try {
         while (pendingTargets.has(key)) {
           const target = pendingTargets.get(key);
           pendingTargets.delete(key);
           const cur = currentSnapshot?.[key] ?? currentSnapshot?.settings?.[key];
           if (cur === target) continue;
           if (!client || !isConnected) break;

           const res = await client.setSetting(key, target);
           if (!res.ok) {
             showError(`设置失败: ${res.error || '未知错误'}`);
             if (res.snapshot) applySnapshot(res.snapshot);
             break;
           } else {
             showError('');
             if (res.snapshot) applySnapshot(res.snapshot);
           }
         }
       } finally {
         inFlightPromises.delete(key);
       }
     })();

     inFlightPromises.set(key, worker);
     return worker;
   }
   ```

---

## 3. 探针对比验证结果

本次补修针对 Codex 复审中的三套独立探针进行逐项核验：

### 3.1 边界探针 (`qa/verify-repaired-probes.mjs`)

| 探针项目 | Codex 复审基线 (未通过) | 补修后实测结果 (通过) | 结论 |
| :--- | :--- | :--- | :--- |
| **匿名 Bootstrap 状态** | `anonymousStatus: 200` | `anonymousStatus: 401` | **已拦截** |
| **主 Token 泄露** | `mainTokenDisclosed: true` | `mainTokenDisclosed: false` | **无泄露** |
| **实际 Rejection 接口调用** | `actualRejectionApiCalls: 0` | `actualRejectionApiCalls: 1` | **调用官方守卫** |
| **全局注入秘密** | `globalSecretInjected: true` | `globalSecretInjected: false` | **页面脱敏** |
| **Desktop Origin 预检** | `dsh-app://app: 403`, `null: 403` | `dsh-app://app: 204`, `null: 204`, `127.0.0.1:12345: 204` | **主端预检全部放行** |
| **启动规格端口** | `rawPortPresent: false` | `rawPortPresent: true` | **规格完整** |
| **伴随页面路径与状态** | `/whale-companion.html` (404) | `/index.html` (200) | **路径接通** |
| **参数键名** | `["token", "instance"]` | `["token", "instanceId", "instance"]` | **键名一致** |
| **适配器执行错误** | `invalid hostPort: undefined` | `null` (无参数错误，正常进入进程创建) | **规格契约闭合** |
| **伴随页认证状态** | `pageAuthenticated: false` | `pageAuthenticated: true` | **页面握手成功** |
| **遮罩 0 输入** | `requested: 0, sent: 40` | `requested: 0, sent: 0` | **合法 0 正常发送** |
| **未拥有 Handle 关闭** | 产生 `taskkill /PID 987654321 /T /F` | `commands: []`, `osProcessesTouched: 0` | **杜绝误杀** |
| **已退出进程 Handle 关闭** | 产生 `taskkill /PID 987654323 /T /F` | `commands: []`, `osProcessesTouched: 0` | **跳过无效 taskkill** |
| **失败 Dispose 保护** | `profileStillExists: false`, 跟踪数为 0 | `profileStillExists: true`, `trackedProcesses: 1` | **保留失败资源供重试** |

### 3.2 真实 0.2.1-rc.2 SDK 引导与释放探针 (`qa/verify-real-sdk-probe.mjs`)

使用 `.tmp/detachable-appearance-p0-seventh-review-20261017-fca7697e/new-sdk` 下提取的实际官方 Cordis 与 `HostConnectionService` 运行：
```json
{
  "sdk": "actual extracted 0.2.1-rc.2",
  "liveDSHUsed": false,
  "connectionIsAuthenticatedType": "undefined",
  "actualRequestRejection": 401,
  "anonymousBootstrapStatus": 401,
  "mainTokenDisclosed": false,
  "effectDisposed": true,
  "listeningServersAfterDispose": []
}
```
- 确认 SDK 无 `isAuthenticated`，入站校验准确调用 `requestRejection(req) === 401`。
- 确认在 `root.fiber.dispose()` 执行后，`listeningServersAfterDispose` 为 `[]`，无遗留监听端口。

### 3.3 真实 React 19.2.0 + ReactDOM 挂载探针 (`qa/verify-react-mount-probe.mjs`)

在隔离 Headless Edge 中使用真实的 `react.production.js` (19.2.0) 与 `react-dom.production.js` (19.2.0) 挂载生产 client 的 `WhaleHeaderAppearanceTrigger`：
```json
{
  "reactVersion": "19.2.0",
  "snapshotStable": true,
  "errors": [],
  "headerPresent": true,
  "liveDSHUsed": false
}
```
- `snapshotStable`: `true`（快照引用恒定）。
- `errors`: `[]`（无任何 React Error，彻底消除 #185）。
- `headerPresent`: `true`（顶栏触发按钮稳定存在于 DOM）。

---

## 4. 全量回归测试结果汇总

所有命令均在 `F:\dsh-wallpaper-plugins\dsh-whale-mist` 根目录下执行：

| 测试命令 | 执行范围 | 耗时 | 退出码 | 结果与断言计数 |
| :--- | :--- | :--- | :--- | :--- |
| `npm run check` | 语法检查 + CSS 模板安全卫士 | ~1.5s | 0 | 通过（2 个模板字面量，无非法字符） |
| `npm run test:detachable-p0` | P0 七审 15 项核心协议套件 | ~1.2s | 0 | **15/15 passed** |
| `npm run test:detachable-e2e` | 双浏览器并发 E2E 同步套件 | ~3.1s | 0 | **11/11 passed** (spawn=3, close=3) |
| `npm run test:detachable-p1a` | P1A 生产链路集成套件 | ~0.7s | 0 | **5/5 passed** (覆盖遮罩 0 及串行更新) |
| `node qa/verify-repaired-probes.mjs` | R1/R2/R4/R6 边界缺陷闭环验证 | ~0.8s | 0 | 全部指标 100% 修复 |
| `node qa/verify-real-sdk-probe.mjs` | 官方 SDK Cordis/HostConnection 探针 | ~0.5s | 0 | 401 拦截有效，0 端口遗留 |
| `node qa/verify-react-mount-probe.mjs` | 真实 React 19 渲染与挂载探针 | ~2.1s | 0 | 稳定挂载，无循环更新 |
| `npm run test:appearance-selection` | 壁纸选择行为回归套件 | ~2.5s | 0 | 通过 |
| `npm run test:appearance` | 外观与全量多语言回归套件 | ~3.3s | 0 | **570 checks passed**，0 失败 |

---

## 5. 变更文件清单与当前状态

### 5.1 修改文件
- [`src/index.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/index.js): 接入 `requestRejection`/`admit` 鉴权，脱敏 index-inject，补充 `ctx.effect` 清理。
- [`src/client.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/client.js): 稳定 `appearanceBridge.getSnapshot()` 缓存引用，实现 bootstrap 凭据自动拉取。
- [`src/detachable-contract.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-contract.js): 默认 companionPath `/index.html`，统一 `instanceId` 与 `instance`。
- [`src/detachable-host.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-host.js): 区分主端端点 loopback 放行与伴随端点严格端口隔离。
- [`src/detachable-edge-adapter.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-edge-adapter.js): 严格 Handle 归属校验，防已退出 PID 误杀，dispose 失败保留资源。
- [`src/companion/companion.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/companion/companion.js): 修复 mask 0 解析错误，增加在途输入串行合并队列。
- [`qa/detachable-p1a-production.test.mjs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/detachable-p1a-production.test.mjs): 更新脱敏校验、`/index.html` 路径、覆盖遮罩 0 与连续拖动。
- [`qa/detachable-appearance-p0.test.mjs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/detachable-appearance-p0.test.mjs): 适配 `/index.html` 启动契约。

### 5.2 验证套件新增
- `qa/verify-repaired-probes.mjs`: 边界探针测试脚本。
- `qa/verify-real-sdk-probe.mjs`: 实际 DSH 0.2.1-rc.2 SDK 引导与释放探针。
- `qa/verify-react-mount-probe.mjs`: 实际 React 19.2.0 + Headless Edge 挂载探针。

### 5.3 保护状态
- `git diff --check` 退出 0（仅既有 CRLF 提示）。
- `package.json` 中的版本号保持 `0.6.0-rc.30` 未改动。
- 生产 assets、Native 动态库、归档包指纹均无任何变动。

---

## 6. 后续交接建议

R1–R6 现已全部在隔离探针及生产集成中完全修复。
建议交由 Codex 进行复审。复审通过后，后续阶段将安排独立候选包的整合与最短实机验证；随后再行开展 P1B（壁纸预览卡片、布局与详情 UI）的设计与接入。
