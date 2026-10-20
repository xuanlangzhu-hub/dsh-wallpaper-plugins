# P1B-1四审补修交付：F1动作总截止与响应吸收阻断、F2工作软截止与独立进程硬监督

日期：2026-10-18\
执行者：Antigravity (Pair Programming Assistant)\
依据规范：[P1B-1四审报告](DETACHABLE_APPEARANCE_P1B1_FOURTH_REVIEW_20261018.md) 与 [AGENTS.md 检查与交付守则](../AGENTS.md)

---

## 1. 交付概述

本轮严格对照 Codex 四审复审报告意见，保留已通过的单队列顺序、旧 resolver 落定、断连通知落定、3 次 stale 上限、预设屏障阻断（E2）、清理失败非零退出与进程 error 监听（E3）等既有成果，不再返工；聚焦并闭环完成 **F1（逻辑动作总截止与迟到回包阻断）** 与 **F2（工作软截止进入 finally 与独立进程外层硬监督）** 专项补修：

1. **F1（逻辑动作绝对总截止与迟到响应吸收阻断）**：
   - **固定绝对截止点（Deadline）**：在 `companion.js` 中，逻辑动作首次执行即固定 `item.deadline = performance.now() + actionTimeoutMs`。所有 stale 重试与宏任务让出均消费此剩余预算（`remainingMs = Math.max(0, item.deadline - performance.now())`）。若剩余预算耗尽（`<= 0`）立即判定超时，重试上限（3次）依然有效，彻底杜绝每次 stale 重新分配完整超时配额（70ms 配置下实测在 75ms 内结束，仅发 2 次请求即止，不再拖长至 214ms/3次）。
   - **取消代次与 AbortSignal 直通响应接收入口**：
     - 在 `detachable-contract.js` 的 `createCompanionClient` 中，为 `dispatch`、`setSetting`、`dispatchAction`、`requestDock`、`closeWindow` 增加 `options.signal` 与 `connectionEpoch` 校验；
     - 动作执行前及网络返回后均严密核验 `if (signal?.aborted || connectionEpoch !== epoch)`；
     - 超时或被取消的动作回包**绝对不调用 `absorbSnapshot`**，不更新 `currentRevision` 与内部快照，不通知订阅者；
     - DOM 滑块、输入框与 client 版本严格保持在权威值（70 / rev 1），彻底杜绝迟到回包覆盖超时后 UI 的缺陷；
     - 独立 SSE 权威新快照推送（`transport.onSnapshot`）路径完全独立保持，正常单调推进至最新状态。
2. **F2（同进程工作软截止直通 finally 与独立进程硬时限监督）**：
   - **彻底废除原进程强退定时器**：移除两个 runner 内部直接执行 `process.exit(1)` 的伪 outerWatchdog，杜绝绕过 `try...finally` 导致资源未释放；
   - **同进程工作软截止（Soft Deadline）**：在 runner 内部将主流程包裹在 `Promise.race([doWork(), softDeadlinePromise])` 中；当工作无响应超时，抛出可捕获异常使控制流**必然进入 `finally` 块**，受控执行 `cdp.close()`、`safelyTerminateProcess(browser)`、`safelyCloseServer(server)` 与 `safelyRemoveProfile(profile)`，并如实设置 `process.exitCode = 1`；
   - **独立进程外层壁钟硬监督（Independent Hard Supervisor）**：
     - 在 [`safe-qa-runner.mjs`](../.tmp/detachable-p1b1-fourth-repair-20261018-b3917de2/safe-qa-runner.mjs) 实现 `runSupervisedScript`；
     - 两个 runner（`verify-companion-geometry.mjs` 与 `verify-react-docked-panel.mjs`）引入双模式：直接执行时作为父级 Supervisor 独立进程，设壁钟硬超时，子进程作为 Worker 执行；
     - 若子进程事件循环发生完全阻塞（如密集忙循环），父级 Supervisor 在硬时限触发，**仅定向终止自有子进程**（`safelyTerminateProcess(child)`），输出 `[SUPERVISOR HARD TIMEOUT]`，保留 profile 证据，报告清理未确认，并以退出码 1 退出；
     - 绝不调用全局 `taskkill` 或盲删数据。

---

## 2. 核心文件指纹与修改对照

### 2.1 关键文件 SHA256

| 文件路径 | 状态 | SHA256 | 说明 |
|---|---|---|---|
| `dsh-whale-mist/src/client.js` | 保持通过 | `557B9C8CE67B9E73FA040CA33A593610BC6ACF18E988BCF31A9E08B6CD9DA769` | R2 presetTarget、R4 独立动作错误反馈（四审保持通过） |
| `dsh-whale-mist/src/detachable-contract.js` | **本轮补修** | `E572AB18034DBEC3E4E8733D57913FFBACDC80DFB22294CCE5E73C141315FF7B` | F1 `dispatch` / `sendAction` 支持 `signal`，阻断过期动作吸收 |
| `dsh-whale-mist/src/companion/companion.js` | **本轮补修** | `28FC29BC6D4A1E1607F5F0428B1F314F847479693F05FD8893249CC216F1E1AC` | F1 固定动作 deadline、剩余预算消费、超时 abort 绑定 |
| `safe-qa-runner.mjs` | **本轮完善** | `8390E46C018E49113F5D002E0D880D3F844590546899E3E1F9703548FC3C6D94` | F2 新增 `runSupervisedScript` 独立进程硬壁钟监督 |
| `verify-companion-geometry.mjs` | **本轮更新** | `1F3D69FAC70132D0A28F5C87EDCE8592994E299848EE9DF1E96FD10A14BC4D0D` | F2 接入软截止 + 独立 Supervisor，移除原进程 process.exit 定时器 |
| `verify-react-docked-panel.mjs` | **本轮更新** | `4CC0CA83189D732C30EEDA11FE78F396E882A2A880492A08DF0A257F0346CCA4` | F2 接入软截止 + 独立 Supervisor，移除原进程 process.exit 定时器 |
| `verify-fourth-repair.test.mjs` | **本轮新增** | `BCC14A7DEEF05DD491754C077194847FB66A5219F3AC9676EBD0E1ADAC424B4B` | 8 项全覆盖 F1/F2 全部缺陷与边界（8/8 通过，764ms） |
| `verify-residuals-repaired.test.mjs` | 保持通过 | `525F090A83382809554580B26CA18291C5B55D7A1B88B20F57F3749E7823B129` | 历史 10 项边界与回归测试（10/10 通过） |

---

## 3. 补修实现细节

### 3.1 F1：绝对 Deadline 与 AbortSignal 拦截

#### 3.1.1 `dsh-whale-mist/src/companion/companion.js`
- 逻辑动作首次出队执行时固定绝对 deadline，后续重试仅获取剩余预算：
  ```javascript
  if (!item.deadline) {
    item.deadline = performance.now() + actionTimeoutMs;
  }
  const remainingMs = Math.max(0, item.deadline - performance.now());
  if (remainingMs <= 0) {
    showError(`设置 ${key} 超时: 服务端状态未确认`);
    settleItem(item, { ok: false, error: 'action-timeout', serverCommitted: 'unknown' });
    cancelRemainingQueue('aborted-after-failure');
    revertAllControlsToAuthoritative();
    activeInFlight = null;
    break;
  }
  ```
- 为每个动作绑定 `AbortController`，并在超时时触发 `abortController.abort()`：
  ```javascript
  const abortController = new AbortController();
  item.abortController = abortController;
  try {
    res = await Promise.race([
      client.setSetting(key, value, { signal: abortController.signal }),
      new Promise((_, reject) => {
        actionTimer = setTimeout(() => {
          abortController.abort();
          reject(new Error('action-timeout'));
        }, remainingMs);
      }),
    ]);
  } catch (err) {
    if (err.message === 'action-timeout' || abortController.signal.aborted) {
      timedOut = true;
    }
    res = { ok: false, error: err.message || 'action-timeout' };
  }
  ```

#### 3.1.2 `dsh-whale-mist/src/detachable-contract.js`
- `createCompanionClient.dispatch` 消费 `options.signal` 与 `connectionEpoch`，双重拦截过期快照吸收：
  ```javascript
  async dispatch(actionType, payload = {}, options = {}) {
    if (!connected) return { ok: false, error: 'not-connected' };
    const epoch = connectionEpoch;
    const signal = options?.signal;
    if (signal?.aborted) return { ok: false, error: 'action-aborted' };

    const action = { type: actionType, clientActionId: generateUuid(), expectedRevision: currentRevision || 1, ...payload };
    let res;
    try {
      res = await transport.sendAction(action, options);
    } catch (err) {
      if (signal?.aborted) return { ok: false, error: 'action-aborted' };
      return { ok: false, error: `action-failed: ${err.message}` };
    }
    if (signal?.aborted || connectionEpoch !== epoch) return { ok: false, error: 'action-aborted' };

    // 仅在动作未被取消/超时且连接代次一致时，才吸收快照
    if (!signal?.aborted && connectionEpoch === epoch) {
      if (res && typeof res === 'object' && res.snapshot) {
        absorbSnapshot(res.snapshot);
      }
    }
    return res;
  }
  ```

---

### 3.2 F2：工作软截止与独立进程硬壁钟监督

#### 3.2.1 软截止直通 finally（Worker 模式）
两个 runner 内部使用 `Promise.race` 包装业务测试与软超时（8s / 12s）：
```javascript
try {
  await Promise.race([
    (async () => { /* 真实 CDP 与页面测试 */ })(),
    softDeadlinePromise,
  ]);
} catch (err) {
  workError = err;
  console.error('[QA WORK ERROR]', err.message);
} finally {
  if (softTimer) clearTimeout(softTimer);
  cdp?.close();
  const termRes = await safelyTerminateProcess(browser, 1500);
  const srvRes = await safelyCloseServer(server, 1500);
  const rmRes = await safelyRemoveProfile(profile, termRes.terminated);
  console.log('CLEANUP SUMMARY:', JSON.stringify({ process: termRes, server: srvRes, profile: rmRes }));
  if (workError || !termRes.terminated || !srvRes.closed || !rmRes.cleanedUp) {
    process.exitCode = 1;
  }
}
```

#### 3.2.2 独立进程硬监督（Supervisor 模式）
- 在 `safe-qa-runner.mjs` 中提供 `runSupervisedScript`：
  - 启动子进程并传入 `QA_WORKER_MODE=1`；
  - 父进程持有独立壁钟硬超时（15s / 20s）；
  - 若子进程由于死锁或 CPU 密集忙循环无法响应，父进程硬定时器触发，**精准定向杀除该子进程 PID**；
  - 打印 unconfirmed cleanup 警报并保留 profile 证据，返回 `exitCode = 1`。

---

## 4. 验证与回归结果

### 4.1 四审专项测试（`verify-fourth-repair.test.mjs`）
测试耗时：**764ms**，全部通过（**8/8 PASS**）：
1. `F1.1: Stale retries consume remaining budget and strictly observe total action deadline`（**75.1ms PASS**，70ms 预算内发 2 次后超时落定，严守总截止）；
2. `F1.2: Timed out action blocks late response from absorbing into client/app/DOM`（**46.6ms PASS**，超时后迟到响应被丢弃，client rev=1、app brightness=70、DOM=70 保持不变）；
3. `F1.3: Independent SSE push continues to update client and app normally after timeout`（**45.6ms PASS**，独立 SSE 权威推送正常吸收更新为 85 / rev 2）；
4. `F1.4: Preset action respects absolute deadline, aborts in-flight, and subsequent actions succeed`（**47.7ms PASS**，预设超时释放 worker，后续掩码设置成功）；
5. `F2.1: In-process soft deadline catches hanging work and cleanly executes finally`（**182.8ms PASS**，软截止直通 finally，CLEANUP_REACHED 确认，exitCode=1）；
6. `F2.2: Independent process supervisor terminates CPU-blocked child worker at hard deadline`（**236.8ms PASS**，独立进程硬壁钟精准终止死循环子进程，exitCode=1）；
7. `F2.3: Process termination failure preserves profile directory evidence and exits non-zero`（**3.1ms PASS**，退出未确认时保留证据目录，exitCode=1）；
8. `F2.4: SafelyTerminateProcess settles cleanly when child process already exited or signals`（**0.4ms PASS**，纯替身一次性落定）。

### 4.2 历史回归与基线测试
- **历史残余 10 项回归**（`verify-residuals-repaired.test.mjs`）：**10/10 PASS**
- **代码静态语法检查**：`npm run check`（0 error，纯净通过）
- **P1A 正式生产接入用例**：`npm run test:detachable-p1a`（**5/5 PASS**，720ms）
- **P0 核心契约与安全用例**：`npm run test:detachable-p0`（**15/15 PASS**，1.26s）
- **浏览器 E2E 隔离用例**：`npm run test:detachable-e2e`（**11/11 PASS**，spawn=3, close=3）

### 4.3 真实浏览器短路径探针实跑
1. **伴随页几何探针（`verify-companion-geometry.mjs`）**：
   - 耗时：~2.1s；退出码：`0`；
   - 窄视口 380px 1 列 / 宽视口 720px 2 列全通过；
   - 清理日志：`{"process":{"terminated":true,"exitCode":null,"signalCode":"SIGTERM"},"server":{"closed":true},"profile":{"cleanedUp":true}}`。
2. **React 19.2.0 应用层探针（`verify-react-docked-panel.mjs`）**：
   - 耗时：~3.6s；退出码：`0`；
   - React 挂载、双向同步、R4 错误卡片（Save/Dismiss/Apply/Delete/Detach）全通过；
   - 清理日志：`{"process":{"terminated":true,"exitCode":null,"signalCode":"SIGTERM"},"server":{"closed":true},"profile":{"cleanedUp":true}}`。

---

## 5. 进程安全与环境基线检查

- **后台活跃任务**：`manage_task(list)` 检查确认 **0 项任务**；
- **系统孤儿进程**：查询 `Get-CimInstance Win32_Process` 确认 **0 个孤儿 `msedge.exe` / `node.exe`**；
- **环境安全约束严格履行**：
  - 日常 DSH 0.2.1-rc.2 / 鲸系外观 rc.35 / Git Bash 0.1.1 纯净运行未碰；
  - 定时任务 `g` 保持 `PAUSED`；
  - `package.json` 及生产 assets 维持 rc.30 冻结；
  - 未执行 `git commit` 或 `git push`，全部未暂存改动完整保护；
  - 未推进 P1B-2（壁纸库/详情）或 GPU 三体专项，滚动 A 继续低优先级挂起。

交付完毕，完全停下等待 Codex 复审。
