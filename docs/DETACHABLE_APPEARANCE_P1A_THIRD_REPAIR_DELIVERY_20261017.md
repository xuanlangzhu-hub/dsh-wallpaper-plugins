# P1A 独立/吸附设置窗口链路三审补修交付报告

**日期**：2026-10-17\
**开发代号**：小 G (Gemini)\
**复审目标**：Codex / 用户\
**执行基准**：[P1A 三审报告](DETACHABLE_APPEARANCE_P1A_THIRD_REVIEW_20261017.md)、[二审报告](DETACHABLE_APPEARANCE_P1A_SECOND_REVIEW_20261017.md)与[P1A 任务书](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1A_20261017.md)

---

## 1. 交付概述与范围界定

依据 Codex 在[三审报告](DETACHABLE_APPEARANCE_P1A_THIRD_REVIEW_20261017.md)中所列的剩余余项（集中在生产配置下的 **R1** 来源隔离以及 **R4** 目录归属与失败重试），本轮在离线与严格隔离环境中完成了全部针对性收敛补修。

既有已闭合项完整保持，未做破坏或返工：
- **R6 原失败完全闭合**：输入队列同值调度不卡死（70→95 确认 95）、跨字段并发（brightness 95 / mask 0）使用最新递增 revision 且最终确认 95/0；
- **R2 / R3 / R5 成果保持**：统一 `/index.html` 页面地址与参数规格；真实 React 19.2.0 + ReactDOM 缓存稳定快照、顶栏按钮稳定留存；新版 Cordis 引导鉴权 401、无 mainToken 泄露、普通卸载后监听端口为 0；
- **P0 七审成果与双浏览器测试保持**：15 项专项及 11 项双浏览器 E2E 测试均正常退出（启动与关闭均为 3 次）。

针对三审提出的两组余项，实施了精准修复：
1. **R1: 生产配置下主端来源严密拦截于伴随端栅栏外**（`src/index.js`, `src/detachable-host.js`）：
   - 将主端白名单（`mainAllowedOrigins`，包含 `dsh-app://app` 及 Desktop webServer origin）严格限定在 `/api/main/*` 路由内生效；
   - 伴随端路由（`/api/action`、`/api/snapshot` 等）严格仅放行伴随窗口自身来源（`http://127.0.0.1:${activePort}`），彻底拒绝 `dsh-app://app`（403）、拒绝 Desktop origin（403）、拒绝 `null`（403）及任意未配置端口（403）。
2. **R4-A: 目录归属改由独占创建取得，杜绝误认领与误删已有资产**（`src/detachable-edge-adapter.js`）：
   - 不再依赖字符串命名前缀判断归属；
   - 专属临时目录改由 `fsPromises.mkdtemp` 或非递归 `mkdir({ recursive: false })` 独占创建，只有独占创建成功的目录才登记进 `ownedProfileDirs`；
   - 显式传入已存在的同前缀目录明确作为不可清理的外部资源，不认领、不覆盖、不递归删除；
   - 删除严格以内部 `processRecord.profileDir` 为准，不再信任外部传入的 `handle.profileDir`；
   - 使用 `isDirectoryAncestor`（基于 `path.relative` 与真实路径 `realpathSync`）校验物理祖先关系，彻底消除 `startsWith(tmpdir)` 的同名兄弟路径与软链接逃逸漏洞。
3. **R4-C: 解耦通信 Server 关闭与原生资源清理，支持失败后有边界重试**（`src/detachable-host.js`, `src/index.js`）：
   - 通信 Server 关闭与原生资源清理状态分离；即使 `server == null`，只要存在未确认清理（`activeOwnedHandle != null || unconfirmedCleanup`），再次调用 `host.stop()` 仍会重试调用 `windowAdapter.close()` 与 `dispose()`；
   - 只有全部资源确认清理完成后才清除所有权句柄并返回 `{ ok: true }`，成功后重复调用具备幂等性；清理持续失败则如实返回失败；
   - `src/index.js` 的 `cleanup()` 在清理失败时不缓存失败 Promise，允许上层在修复条件后再次重试并返回真实结果。

> [!IMPORTANT]
> **红线遵守承诺**：本轮全程离线、隔离进行。未改动 `package.json` 中的版本号（维持 `0.6.0-rc.30`）；未安装、未修改、未接触运行中的真实 DSH (0.2.1-rc.2)、Wallpaper Engine 或日常系统配置；未创建可见 OS 窗口；未执行 git 提交或推送。

---

## 2. 补修关键代码变更

### 2.1 R1: 区分路由的严密 Origin 栅栏 (`src/detachable-host.js`, `src/index.js`)

在 `src/detachable-host.js` 中将主端来源与伴随端来源彻底拆开：

```javascript
// Origin verification
const isAllowedOrigin = (orig) => {
  if (!orig || typeof orig !== 'string') return false;
  if (orig === 'null') return false; // Reject null unconditionally

  if (pathname.startsWith('/api/main/')) {
    // Main renderer endpoint: only official Desktop app origin or configured main allowed origins
    if (orig === 'dsh-app://app') return true;
    if (resolvedMainOrigins.includes(orig)) return true;
    return false;
  }

  // Companion window endpoints: strictly companion's own origin or explicit companionAllowedOrigins
  const myOrigin = activePort ? `http://127.0.0.1:${activePort}` : null;
  const myLocalhost = activePort ? `http://localhost:${activePort}` : null;
  if (myOrigin && orig === myOrigin) return true;
  if (myLocalhost && orig === myLocalhost) return true;
  if (resolvedCompanionOrigins.includes(orig)) return true;

  return false;
};
```

在 `src/index.js` 中显式指定 `mainAllowedOrigins: allowedOrigins`：
```javascript
const host = createDetachableHttpHost({
  windowAdapter,
  allowedOrigins,
  mainAllowedOrigins: allowedOrigins,
});
```

### 2.2 R4-A: 独占创建与目录物理祖先校验 (`src/detachable-edge-adapter.js`)

1. **物理祖先关系与规范路径校验**：
```javascript
function isDirectoryAncestor(parentDir, targetDir) {
  try {
    const resolvedParent = resolve(parentDir);
    const resolvedTarget = resolve(targetDir);
    const rel = relative(resolvedParent, resolvedTarget);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
      return false;
    }
    if (existsSync(resolvedParent) && existsSync(resolvedTarget)) {
      const realParent = realpathSync(resolvedParent);
      const realTarget = realpathSync(resolvedTarget);
      const realRel = relative(realParent, realTarget);
      if (!realRel || realRel.startsWith('..') || isAbsolute(realRel)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
```

2. **独占创建登记归属，外来/已有目录绝不认领与删除**：
```javascript
let dedicatedProfileDir = (spec && spec.profileDir) || profileDir;
let isDedicatedTemp = false;
let createdAnew = false;

const resolvedTmp = resolve(tmpdir());

if (!dedicatedProfileDir) {
  // Exclusively create a brand new temporary profile directory via mkdtemp
  dedicatedProfileDir = await fsPromises.mkdtemp(join(resolvedTmp, PROFILE_DIR_PREFIX));
  const resolvedNew = resolve(dedicatedProfileDir);
  ownedProfileDirs.add(resolvedNew);
  isDedicatedTemp = true;
  createdAnew = true;
} else {
  const resolvedProfile = resolve(dedicatedProfileDir);
  const existedBefore = existsSync(resolvedProfile);

  if (existedBefore) {
    // Pre-existing external directory: NEVER claim, NEVER overwrite, NEVER delete on close
    isDedicatedTemp = false;
    createdAnew = false;
  } else {
    const isUnderTemp = isDirectoryAncestor(resolvedTmp, resolvedProfile);
    const matchesPrefix = basename(resolvedProfile).startsWith(PROFILE_DIR_PREFIX);

    if (isUnderTemp && matchesPrefix) {
      try {
        await fsPromises.mkdir(resolvedProfile, { recursive: false });
        ownedProfileDirs.add(resolvedProfile);
        isDedicatedTemp = true;
        createdAnew = true;
      } catch {
        isDedicatedTemp = false;
        createdAnew = false;
      }
    }
  }
}
```

3. **关闭时强制使用内部追踪记录，防伪造 handle 路径**：
```javascript
// Strict requirement: deletion MUST ONLY use the record tracked at spawn, NEVER trust caller's handle.profileDir!
const targetProfileDir = processRecord.isDedicatedTemp ? processRecord.profileDir : null;
```

### 2.3 R4-C: 资源清理与通信 Server 分离，支持失败后重试 (`src/detachable-host.js`, `src/index.js`)

在 `src/detachable-host.js` 中：
```javascript
async stop() {
  terminateCompanionSession('disconnect');
  terminateMainSession('host-stopped');

  let cleanupRes = { ok: true };
  if (activeOwnedHandle != null || unconfirmedCleanup) {
    cleanupRes = await executeTransition(() => performWindowCleanup());
  }

  let disposeRes = { ok: true };
  if (resolvedWindowAdapter && typeof resolvedWindowAdapter.dispose === 'function') {
    try {
      disposeRes = (await resolvedWindowAdapter.dispose()) || { ok: true };
    } catch (err) {
      disposeRes = { ok: false, error: err.message };
    }
  }

  if (server) {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    started = false;
    server = null;
  }

  if (cleanupRes && cleanupRes.ok === false) return cleanupRes;
  if (disposeRes && disposeRes.ok === false) return disposeRes;
  if (activeOwnedHandle != null || unconfirmedCleanup) {
    return { ok: false, error: lastCleanupError || 'unconfirmed-cleanup-remaining' };
  }
  return { ok: true };
}
```

在 `src/index.js` 中：
```javascript
let cleanupPromise = null;
const cleanup = () => {
  if (cleanupPromise) return cleanupPromise;
  disposed = true;
  const promise = (async () => {
    if (typeof disposeRoute === 'function') {
      try { disposeRoute(); } catch {}
    }
    try {
      await startPromise;
    } catch {}
    try {
      const res = await host.stop();
      if (res && res.ok === false) {
        console.warn('[Whale detachable host] stop unconfirmed cleanup:', res.error);
        cleanupPromise = null; // allow bounded retry on unconfirmed cleanup
        return res;
      }
      return res || { ok: true };
    } catch (err) {
      console.warn('[Whale detachable host] stop error:', err.message);
      cleanupPromise = null; // allow bounded retry on failure
      throw err;
    }
  })();
  cleanupPromise = promise;
  return promise;
};
```

---

## 3. R4-B 生产机制说明与验收边界

关于原任务要求的“正常系统窗口关闭、进程/窗口强身份及 Edge 多进程资源集合确认”，在此明确生产机制、当前测试实现及未实测的验收边界，以供 Codex 复核：

### 3.1 生产运行环境机制
1. **多进程架构特征**：Microsoft Edge 基于 Chromium 架构启动后，会派生 Browser Broker 根进程、Renderer 渲染器进程、Utility/Audio 进程、GPU 进程以及 Crashpad Handler 等。各进程均通过 `--user-data-dir` 锁定和访问同一 Profile 目录；
2. **两阶段终止序列**：
   - **阶段一（正常窗口优雅关闭）**：优先通过 `child.kill()` 发送标准退出信号，并设置优雅等待窗口；
   - **阶段二（进程树强制终结）**：在 Windows 平台通过 `taskkill.exe /PID <pid> /T /F`，其中 `/T` 参数强制遍历并终止由该 PID 衍生的整棵子进程树，杜绝孤儿 Renderer/GPU 进程驻留；
3. **退出演变确认与 Profile 延迟释放处理**：
   - 必须等待根进程的 `exit` 事件确认后才允许进入 Phase 3（目录清理）；
   - 由于 Chromium 进程在完全脱离时释放文件锁存在系统级延迟（可能引发 Windows `EBUSY`/`EPERM`），在 `cleanupProfileDir` 中配置了指数退避重试（`maxRetries: 3, retryDelay: 200`），确保安全回收。

### 3.2 离线测试替身与实测边界说明
- **测试替身验证范围**：在单元与专项测试中，采用隔离的 `EventEmitter` 模拟 child 进程以及模拟 `taskkill` 回调。此举验证了“未收到 child exit 坚决不报成功”、“失败时维持 docking 状态与 unconfirmedCleanup”、“不触碰未经 adapter 登记的非本轮 PID”；
- **真实浏览器验证范围**：在 `qa/detachable-browser-e2e.mjs` 中，通过 headless Microsoft Edge（带真实独立临时 profile）验证了完整的启动、多 Tab 通信、吸附关窗与断开清理，实测启动 3 次、关闭 3 次，无进程残留；
- **未实测边界**：由于遵循“不得操作日常运行中 DSH / 宿主桌面 / 可见窗口”的红线要求，**带原生系统标题栏的可见 OS 顶层窗口的手动点击关闭、以及系统级 Job Object 强绑定的测试**未在当前阶段对真实日常桌面执行，留待离线验收全部通过后的专门约定阶段。

---

## 4. 探针验证与测试矩阵

编写了专门验证三审所有关注点的探针脚本 `qa/verify-third-review-probes.mjs`，并在隔离环境中对全部测试套件执行了回归测试：

```
node qa/verify-third-review-probes.mjs
--- Running Third Review Verification Probes ---
[PASS] Probe 1: Production Origin Fence verified successfully.
[PASS] Probe 2: Pre-existing profile preservation verified successfully.
[PASS] Probe 3: Normal profile exclusive creation and cleanup verified.
[PASS] Probe 4: Stop retry on unconfirmed cleanup verified successfully.
[PASS] Probe 5: Persistent failure continues reporting unconfirmed cleanup.
--- ALL THIRD REVIEW VERIFICATION PROBES PASSED! ---
```

### 4.1 详细结果对照表

| 检查项 | 探针测试场景 | 预期结果 | 实际执行结果 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **R1 (主端 /api/main/connect)** | 真实 `apply(ctx)` 注入 desktopOrigin 12345；请求 Origin: `null` | 403 Forbidden | `status: 403` | **PASS** |
| **R1 (主端 /api/main/connect)** | 请求 Origin: `dsh-app://app` | 204 No Content | `status: 204` | **PASS** |
| **R1 (主端 /api/main/connect)** | 请求 Origin: `http://127.0.0.1:12345` (桌面端) | 204 No Content | `status: 204` | **PASS** |
| **R1 (主端 /api/main/connect)** | 请求 Origin: `http://127.0.0.1:12346` (未配置端口) | 403 Forbidden | `status: 403` | **PASS** |
| **R1 (伴随端 /api/action)** | 请求 Origin: `dsh-app://app` | 403 Forbidden | `status: 403` | **PASS** (已闭合主端穿透) |
| **R1 (伴随端 /api/action)** | 请求 Origin: `http://127.0.0.1:12345` (桌面端) | 403 Forbidden | `status: 403` | **PASS** (已闭合主端穿透) |
| **R1 (伴随端 /api/action)** | 请求 Origin: `http://127.0.0.1:12346` (未配置端口) | 403 Forbidden | `status: 403` | **PASS** |
| **R1 (伴随端 /api/action)** | 请求 Origin: `null` | 403 Forbidden | `status: 403` | **PASS** |
| **R1 (伴随端 /api/action)** | 请求 Origin: `http://127.0.0.1:${port}` (伴随端自身) | 204 No Content | `status: 204` | **PASS** |
| **R4-A (目录已有资产保护)** | 先创建同名前缀目录及 sentinel 文件，再交付 adapter.spawn | `ownedCount: 0`, 目录与文件均保留 | `ownedCount: 0`, `sentinelRetained: true`, `directoryRetained: true` | **PASS** |
| **R4-A (正常专属目录回收)** | 未提供 profileDir 调用 spawn | `ownedCount: 1`, close 后物理删除 | `ownedCount: 1 -> 0`, `profileDirCleaned: true`, 文件系统无残留 | **PASS** |
| **R4-C (失败后重试)** | 第一次 close 失败，清除失败条件后第二次调用 host.stop() | `firstOk: false`, `secondOk: true`, `closeCalls: 2`, `ownerRetained: false`, `unconfirmedCleanup: false` | 完全匹配，成功重试并完成全部原生与 Server 清理 | **PASS** |
| **R4-C (持续失败)** | close 持续失败 | 每次 stop 均返回 false 并保留句柄与标记 | `stop1.ok: false`, `stop2.ok: false`, `closeAttempts: 2` | **PASS** |
| **R6 (在途队列)** | 同值变更 70→95 与跨字段 revision 递增并发 | 95 实际发送并确认，0 与 95 无冲突 | brightness: 95, mask: 0 | **PASS** |

### 4.2 全局测试套件矩阵

| 测试套件 | 测试命令 | 检查点数 | 结果 | 耗时 |
| :--- | :--- | :--- | :--- | :--- |
| **语法与模版门控** | `npm run check` | 11 个模块语法 + CSS 模版守卫 | **PASS (0 error)** | ~2.5s |
| **P0 专项测试** | `npm run test:detachable-p0` | 15 / 15 项 | **PASS (0 fail)** | ~1.4s |
| **P1A 生产测试** | `npm run test:detachable-p1a` | 5 / 5 项 | **PASS (0 fail)** | ~0.9s |
| **双浏览器 E2E 测试** | `npm run test:detachable-e2e` | 11 / 11 项 (spawn=3, close=3) | **PASS (0 fail)** | ~3.8s |
| **场景切换测试** | `npm run test:appearance-selection` | 2 组场景 | **PASS (0 fail)** | ~3.2s |
| **外观全回归测试** | `npm run test:appearance` | 570 / 570 个断言 | **PASS (0 fail)** | ~5.1s |
| **二审探针验证** | `node qa/verify-second-review-probes.mjs` | 7 项原探针检查 | **PASS** | ~1.0s |
| **三审探针验证** | `node qa/verify-third-review-probes.mjs` | 5 项余项与正负例检查 | **PASS** | ~1.2s |
| **React 挂载验证** | `node qa/verify-react-mount-probe.mjs` | React 19.2.0 + ReactDOM 稳定快照 | **PASS** | ~2.1s |
| **Cordis SDK 验证** | `node qa/verify-real-sdk-probe.mjs` | 401 拦截 / 无 token 泄露 / 卸载无监听 | **PASS** | ~1.8s |
| **生产伴随页验证** | `node qa/verify-production-page-probe.mjs` | 隔离握手 / 调参 95 与 0 确认 | **PASS** | ~2.4s |
| **Git 差异门禁** | `git diff --check` | 检查空白符与换行问题 | **PASS (0 warning)** | ~0.5s |

---

## 5. 当前代码状态与后续步骤

- 仓库状态：`F:\dsh-wallpaper-plugins\dsh-whale-mist`，全部更改位于工作区，未进行 git commit 或 push；
- 版本标识：严格保持 `0.6.0-rc.30`，未擅自升级或修改；
- 背景进程状态：0 个未停止的后台任务，无孤儿进程残留；
- 建议后续步骤：请 Codex 对照三审报告及本轮探针结果复核。复核通过后，再决定是否进入离线真机窗口联调或推进后续任务。
