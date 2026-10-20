# P1A 独立/吸附设置窗口链路二审补修交付报告

**日期**：2026-10-17\
**开发代号**：小 G (Gemini)\
**复审目标**：Codex / 用户\
**执行基准**：[P1A 二审报告](DETACHABLE_APPEARANCE_P1A_SECOND_REVIEW_20261017.md)、[首审报告](DETACHABLE_APPEARANCE_P1A_REVIEW_20261017.md)与[P1A 任务书](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1A_20261017.md)

---

## 1. 交付概述与范围边界

依据 Codex 在二审报告中所列的三组余项（R1 / R4 / R6），本轮在离线与严格隔离环境中完成了全部针对性收敛补修，保留已通过的首审及二审既有成果（R1 匿名拦截、R2 规格/页面统一、R3 React 缓存快照稳定、R5 普通卸载无端口监听），并通过二审新设立的探针进行完整闭环验证：

1. **R1 余项：来源放行范围精准收紧（杜绝任意 null 与非本轮 loopback 端口）**：
   - 区分主通道与伴随通道：`/api/main/*` 拒绝 `null`（返回 403），仅放行官方主端 `dsh-app://app` 与显式配置的 `allowedOrigins`（如 Desktop webserver origin）；
   - 伴随通道（`/api/action`、`/api/snapshot` 等）严格限定伴随窗口自身的独立 Origin（`http://127.0.0.1:${activePort}`），拒绝 `null`（403）、拒绝 `dsh-app://app`（403）、拒绝任意外部端口（403）。
2. **R4 余项：临时目录归属、进程退出确认与失败传递**：
   - **R4-A 目录归属与唯一命名**：`buildEdgeAppLaunchSpec` 增加唯一后缀 `whale-companion-profile-${instanceId}-${uuid}`；`EdgeWindowAdapter.spawn()` 严密识别位于 `tmpdir()` 且带专用前缀的目录并登记到 `ownedProfileDirs`，实现无论是否预构建规格均能正确计入归属并在吸附时彻底销毁。
   - **R4-B 退出确认与防误删**：`close()` 在 `taskkill` 后必须通过 `waitForExit` 确认子进程确实触发 exit；若退出未被观测（模拟存活/僵尸），拒绝清空追踪、拒绝删除临时 profile，返回 `{ ok: false, error: 'exit-not-confirmed' }`。
   - **R4-C 失败留痕与异步清理传递**：Host `performWindowCleanup()` 正确检查 adapter 返回的 `ok: false`，关闭失败时保留 `activeOwnedHandle`、维持 docking 状态、置 `unconfirmedCleanup: true`，并在主端 `requestDock()` 向上返回失败；`stop()` 与 `src/index.js` 正确传递并返回异步清理 Promise。
3. **R6 余项：统一在途调度队列（同值不卡死、跨字段保全最新意图）**：
   - 将独立 per-field worker 重构为全局串行调度队列，通过微任务交让确保异步状态管理不产生完成态 Promise 残留，彻底解决同值调用导致队列永久冻结问题。
   - 共享全局 revision 调度：跨字段（亮度与遮罩）并发调用时按序串行执行并递增 expectedRevision；如遇 `stale-revision` 自动吸收最新快照并按最新用户意图重试，确保并发操作下最新意图 100% 落地。

> [!IMPORTANT]
> **红线遵守承诺**：本轮全程离线、隔离进行。未改动 `package.json` 中的版本号；未安装、未修改、未接触运行中的真实 DSH (0.2.1-rc.2)、Wallpaper Engine 或日常系统配置；未创建可见 OS 窗口（浏览器探针均在 headless 独立临时目录中进行）；未执行 git 提交或推送。

---

## 2. 补修细节与代码变更

### 2.1 R1: 精准 Origin 栅栏 (`src/detachable-host.js`)

在 `src/detachable-host.js` 中重写来源校验，消除无条件放行与任意 null 漏洞：
```javascript
// Origin verification
const isAllowedOrigin = (orig) => {
  if (!orig || typeof orig !== 'string') return false;
  if (orig === 'null') return false; // 严禁任意放行 null

  // 显式允许来源（如外部注入的 Desktop webServer origin）
  if (allowedOrigins.includes(orig)) return true;

  if (pathname.startsWith('/api/main/')) {
    // 主端通信端点：仅允许官方主渲染器承载 dsh-app://app 及显式 allowedOrigins
    if (orig === 'dsh-app://app') return true;
    return false;
  }

  // 伴随端通信端点（/api/action 等）：严格限定伴随页自身加载来源
  const myOrigin = activePort ? `http://127.0.0.1:${activePort}` : null;
  const myLocalhost = activePort ? `http://localhost:${activePort}` : null;
  if (orig === myOrigin || orig === myLocalhost) return true;

  return false;
};
```

### 2.2 R4-A: Profile 唯一归属与生命周期回收 (`src/detachable-edge-adapter.js`, `src/detachable-contract.js`)

1. **唯一启动命名**（`src/detachable-contract.js`）：
   ```javascript
   const uniqueSuffix = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
   const resolvedProfileDir =
     profileDir && typeof profileDir === 'string'
       ? profileDir
       : `${defaultTempDir}\\whale-companion-profile-${instanceId}-${uniqueSuffix}`;
   ```
2. **所有权识别登记**（`src/detachable-edge-adapter.js`）：
   ```javascript
   const resolvedProfile = resolve(dedicatedProfileDir);
   const resolvedTmp = resolve(tmpdir());
   const isDedicatedTemp =
     resolvedProfile.startsWith(resolvedTmp) &&
     basename(resolvedProfile).startsWith(PROFILE_DIR_PREFIX);

   await fsPromises.mkdir(dedicatedProfileDir, { recursive: true });
   if (isDedicatedTemp) {
     ownedProfileDirs.add(resolvedProfile);
   }
   ```

### 2.3 R4-B: 真实进程退出确认 (`src/detachable-edge-adapter.js`)

```javascript
// Phase 2: If still running and not yet exited, issue strict PID-specific taskkill on Windows
if (!terminated) {
  // ... 执行 taskkill 或 SIGKILL ...

  // 关键：taskkill 回调成功不等于子进程已经终止退出，必须等待 exit 事件确认
  if (!terminated && child) {
    terminated = await waitForExit(child, processRecord, gracefulTimeoutMs);
  }
}

if (!terminated) {
  return {
    ok: false,
    error: 'exit-not-confirmed',
    pid,
  };
}

// 只有真正确认退出，才释放跟踪记录与删除目录
activeProcesses.delete(pid);
```

### 2.4 R4-C: Host 失败留痕与异步清理传递 (`src/detachable-host.js`, `src/index.js`)

1. **`performWindowCleanup`**：
   ```javascript
   const res = await resolvedWindowAdapter.close(handleToClose);
   if (res && res.ok === false) {
     unconfirmedCleanup = true;
     lastCleanupError = res.error || 'window-close-failed';
     closeResult = { ok: false, error: lastCleanupError, handle: handleToClose };
   } else {
     activeOwnedHandle = null;
     unconfirmedCleanup = false;
     lastCleanupError = null;
     closeResult = { ok: true, ...(res || {}) };
   }
   ```
2. **`host.stop()`** 向上返回未闭合的失败，不抹盖异常。
3. **`src/index.js`**：`cleanup()` 返回去重的清理 Promise，并在 `ctx.effect(() => () => cleanup())` 中向 Cordis 导出该 Promise。

### 2.5 R6: 全局串行调度队列与跨字段意图保全 (`src/companion/companion.js`)

```javascript
const pendingSettings = new Map();
let activeDispatchPromise = null;

function applySettingSerialized(key, clamped) {
  pendingSettings.set(key, clamped);

  if (activeDispatchPromise) {
    return activeDispatchPromise;
  }

  const worker = (async () => {
    // 微任务出让，保证 activeDispatchPromise 赋值立即完成，同值 no-op 退出后不会留下死 Promise
    await Promise.resolve();

    try {
      while (pendingSettings.size > 0) {
        const entry = pendingSettings.entries().next().value;
        if (!entry) break;
        const [currKey, targetVal] = entry;
        pendingSettings.delete(currKey);

        const cur = currentSnapshot?.[currKey] ?? currentSnapshot?.settings?.[currKey];
        if (cur === targetVal) {
          continue; // 同值跳过，但不阻塞后续新值
        }
        if (!client || !isConnected) break;

        const res = await client.setSetting(currKey, targetVal);

        if (!res.ok) {
          if (res.error === 'stale-revision' && res.snapshot) {
            applySnapshot(res.snapshot);
            // 吸收最新快照，若用户最新意图仍与当前不一致，自动重新入队执行
            const latestDesired = pendingSettings.has(currKey) ? pendingSettings.get(currKey) : targetVal;
            const newCur = res.snapshot[currKey] ?? res.snapshot.settings?.[currKey];
            if (latestDesired !== newCur) {
              pendingSettings.set(currKey, latestDesired);
            }
          } else {
            showError(`设置失败: ${res.error || '未知错误'}`);
            if (res.snapshot) applySnapshot(res.snapshot);
            break;
          }
        } else {
          showError('');
          if (res.snapshot) applySnapshot(res.snapshot);
        }
      }
    } finally {
      activeDispatchPromise = null;
    }
  })();

  activeDispatchPromise = worker;
  return activeDispatchPromise;
}
```

---

## 3. 探针对比验证结果 (`qa/verify-second-review-probes.mjs`)

使用与 Codex 二审 `remaining-probes.mjs` 逻辑完全对齐的探针脚本运行于现行代码：

| 探针项目 | Codex 二审基线 (未通过) | 补修后实测 (全部通过) | 结论 |
| :--- | :--- | :--- | :--- |
| **R4-A Prebuilt Profile 登记** | `ownedCountAfterSpawn: 0` | `ownedCountAfterSpawn: 1` | **成功登记专属归属** |
| **R4-A 吸附后目录物理存在** | `profileExistsAfterDock: true` | `profileExistsAfterDock: false` | **已确认安全销毁** |
| **R4-A 吸附后跟踪进程数** | `trackedAfterDock: 0` | `trackedAfterDock: 0` | **进程跟踪归零** |
| **R1 `/api/main/connect` null** | `status: 204` | `status: 403` | **严厉拦截 null** |
| **R1 `/api/main/connect` dsh-app**| `status: 204` | `status: 204` | **主渲染器正常放行** |
| **R1 `/api/main/connect` 外来端口**| `status: 204` | `status: 403` | **未配置端口拦截** |
| **R1 `/api/action` null** | `status: 204` | `status: 403` | **伴随端拦截 null** |
| **R1 `/api/action` dsh-app** | `status: 204` | `status: 403` | **伴随端拦截主端 origin** |
| **R1 `/api/action` 外来端口** | `status: 403` | `status: 403` | **伴随端拦截外来端口** |
| **R4-B 存活子进程关闭结果** | `closeOk: true` | `closeOk: false` | **未确认退出不报成功** |
| **R4-B 存活子进程跟踪记录** | `trackedProcesses: 0` | `trackedProcesses: 1` | **保留句柄供重试** |
| **R4-B 存活子进程 Profile** | `profileExists: false` (误删) | `profileExists: true` | **保留目录防数据损坏** |
| **R4-C 失败关闭 dock 结果** | `dockOk: true` | `dockOk: false` | **明确返回失败** |
| **R4-C 失败关闭模式与归属** | `mode: "docked"`, `ownerRetained: false` | `mode: "docking"`, `ownerRetained: true` | **保留所有权，防状态漂移** |
| **R4-C 未确认标记** | `unconfirmedCleanup: false` | `unconfirmedCleanup: true` | **明确置位标记** |
| **R6-A 同值后新值输入** | `sentValues: []`, `confirmedBrightness: 70` | `sentValues: [95]`, `confirmedBrightness: 95` | **同值后队列不卡死** |
| **R6-B 跨字段并发调度** | mask=0 丢失, `confirmedSettings: {95, 55}` | 依次递增 revision, `confirmedSettings: {95, 0}` | **跨字段意图 100% 达成** |

---

## 4. 全量回归测试汇总

| 命令 | 范围 | 退出码 | 结果与断言计数 |
| :--- | :--- | :--- | :--- |
| `npm run check` | 静态语法与 CSS 模板安全卫士 | 0 | 通过（2 个模板字面量，无非法字符） |
| `npm run test:detachable-p0` | P0 七审 15 项核心协议套件 | 0 | **15/15 passed** |
| `npm run test:detachable-e2e` | 双浏览器并发 E2E 同步套件 | 0 | **11/11 passed** (spawn=3, close=3) |
| `npm run test:detachable-p1a` | P1A 生产链路集成套件 | 0 | **5/5 passed** |
| `node qa/verify-second-review-probes.mjs` | R1/R4/R6 二审余项综合探针 | 0 | **所有项目 100% 修复** |
| `node qa/verify-production-page-probe.mjs` | 生产伴随页完整 Headless Edge 调参 | 0 | 真实 Controller (95, 0) 双向同步成功 |
| `node qa/verify-real-sdk-probe.mjs` | 官方 DSH 0.2.1-rc.2 SDK 引导与释放 | 0 | 401 拦截有效，0 端口遗留 |
| `node qa/verify-react-mount-probe.mjs` | 真实 React 19.2.0 + Headless Edge 挂载 | 0 | 稳定挂载，0 错误，按钮稳定驻留 |
| `npm run test:appearance-selection` | 壁纸选择行为回归套件 | 0 | 通过 |
| `npm run test:appearance` | 外观与全量多语言回归套件 | 0 | **570 checks passed**，0 失败 |

---

## 5. 变更文件与环境保护

### 5.1 修改文件
- [`src/detachable-host.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-host.js): 严格限定主端与伴随端 Origin 栅栏（拒绝 null）；`performWindowCleanup` 与 `stop` 捕获并向上传递失败，保留所有权。
- [`src/detachable-edge-adapter.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-edge-adapter.js): 准确识别并登记专属临时 profile 归属；`close` 校验真实退出，退出未确认不释放跟踪、不删除 profile。
- [`src/detachable-contract.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-contract.js): 生成唯一 per-launch profile 目录名称。
- [`src/companion/companion.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/companion/companion.js): 全局串行调度队列，微任务交让防死锁，自动重试吸收 stale-revision。
- [`src/index.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/index.js): 注入 Desktop 来源，`cleanup()` 返回 de-duplicated Promise 给 `ctx.effect`。

### 5.2 状态核实
- `git diff --check` 退出 0。
- `package.json` 版本号 `0.6.0-rc.30` 保持未变。
- 无任何未结束后台任务（`manage_task(list)` 确认 0 running tasks）。
- 日常 DSH 0.2.1-rc.2 / 鲸系外观 rc.35 / Git Bash 0.1.1 保持不变。

---

## 6. 后续交接建议

R1/R4/R6 二审余项均已完全闭合并经验证，建议交由 Codex 进行二审复查。复审通过后再整合独立候选并做最短实机核对，随后开启 P1B 阶段。
