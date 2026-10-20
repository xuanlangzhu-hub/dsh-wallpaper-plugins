# P1B-1五审补修交付：QA监督器汇总竞态G1闭合与硬限单次落定

日期：2026-10-18\
执行者：Antigravity (Pair Programming Assistant)\
依据规范：[P1B-1五审报告](DETACHABLE_APPEARANCE_P1B1_FIFTH_REVIEW_20261018.md) 与 [AGENTS.md 检查与交付守则](../AGENTS.md)

---

## 1. 交付概述

本轮严格对照 Codex 五审复审报告意见，**生产源码（companion.js、detachable-contract.js、client.js、UI组件及P1A/B链路）完全零修改、零返工，保持上一轮已过指纹**；聚焦并彻底闭合 **QA G1 汇总竞态缺陷**：

1. **G1 缺陷成因**：
   - 在上一轮 `safe-qa-runner.mjs` 的 `runSupervisedScript` 中，`timeoutPromise` 在硬超时触发后先 `await safelyTerminateProcess(child, 1500)`；
   - 强杀动作在子进程触发 `exit` 事件，而 `exitPromise` 监听 `child.once('exit')` 同步 resolve 并抢跑了 `Promise.race([exitPromise, timeoutPromise])`；
   - 导致真实 Node 超时被误标为 `timedOut: false` 且丢失 `termRes`；若子进程在被杀时触发 `exit(0)`，甚至会导致测试入口将硬超时误判为成功（False Success）。
2. **G1 最小闭环修补**：
   - 彻底废除 `Promise.race([exitPromise, timeoutPromise])` 竞态结构，改为状态受控的单次落定机制（Single Settle）；
   - **硬截止同步锁定**：`hardTimer` 触发时，第一行立即同步设置 `timedOut = true`；
   - **退出/错误事件防抢跑**：`onExit` 与 `onError` 检查 `if (timedOut) return;`，一旦硬超时被触发，任何后续的 `exit` 或 `error` 事件均被严格屏蔽，绝不覆写超时事实；
   - **有界终止消费与完整 provenance 返回**：等待 `await safelyTerminateProcess(child, 1500)` 完成并消费实际 `termRes` 后，再一次性 resolve，必须返回 `timedOut: true`、`code: 1` 及包含终止确认状态的 `termRes`；
   - 正常 `exit(0)` 或业务错误退出在超时前发生时，正常清除定时器并返回 `timedOut: false` 与原退出码。

---

## 2. 核心文件指纹与修改对照

### 2.1 关键文件 SHA256

| 文件路径 | 状态 | SHA256 | 说明 |
|---|---|---|---|
| `dsh-whale-mist/src/client.js` | 保持通过（零改动） | `557B9C8CE67B9E73FA040CA33A593610BC6ACF18E988BCF31A9E08B6CD9DA769` | 四审/五审确认通过 |
| `dsh-whale-mist/src/detachable-contract.js` | 保持通过（零改动） | `E572AB18034DBEC3E4E8733D57913FFBACDC80DFB22294CCE5E73C141315FF7B` | F1 AbortSignal 拦截（五审确认通过） |
| `dsh-whale-mist/src/companion/companion.js` | 保持通过（零改动） | `28FC29BC6D4A1E1607F5F0428B1F314F847479693F05FD8893249CC216F1E1AC` | F1 固定动作 deadline（五审确认通过） |
| `safe-qa-runner.mjs` | **本轮补修** | `0128591FA1C8115FEA2B4ACAF83D98E3BBB2306D284E6BE95E5EC9B17B34B66A` | G1 彻底消除监督器竞态，锁定超时单次落定 |
| `verify-companion-geometry.mjs` | 路径适配 | `5F9BB4998D438BD66D24CDBD8DD425A8028A6AED0BE44FB2C804607166C00046` | 指向第五轮独立目录，软截止+Supervisor |
| `verify-react-docked-panel.mjs` | 路径适配 | `530E82915723CB9A0D390242725240109D4AC44D6D059BC1AD092BDB073BAD4D` | 指向第五轮独立目录，软截止+Supervisor |
| `verify-fifth-repair.test.mjs` | **本轮新增** | `9D6FEE64D22548E09794BD6229901593A5712B0594F15150113BDFFFB8766A27` | G1 六项专项 + F1 三项回归（9/9 PASS，1.2s） |
| `verify-residuals-repaired.test.mjs` | 保持通过 | `525F090A83382809554580B26CA18291C5B55D7A1B88B20F57F3749E7823B129` | 历史 10 项边界与回归测试（10/10 PASS） |

---

## 3. 补修实现细节（`safe-qa-runner.mjs`）

彻底重构 `runSupervisedScript` 的落定控制流：
```javascript
export function runSupervisedScript(scriptPath, { hardTimeoutMs = 15000, env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: { ...process.env, ...env, QA_WORKER_MODE: '1' },
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', d => { const s = d.toString('utf8'); stdout += s; process.stdout.write(s); });
    child.stderr?.on('data', d => { const s = d.toString('utf8'); stderr += s; process.stderr.write(s); });

    let settled = false;
    let timedOut = false;
    let hardTimer = null;

    const cleanup = () => {
      if (hardTimer) { clearTimeout(hardTimer); hardTimer = null; }
      child.removeListener('exit', onExit);
      child.removeListener('error', onError);
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ...result, stdout, stderr, pid: child.pid });
    };

    const onExit = (code, signal) => {
      // 若已触发硬超时，由超时分支全权负责落定，严禁被 exit 事件覆盖
      if (timedOut) return;
      finish({ timedOut: false, code: code ?? (signal ? 1 : 0), signal });
    };

    const onError = (err) => {
      if (timedOut) return;
      finish({ timedOut: false, error: err.message, code: 1, signal: null });
    };

    child.once('exit', onExit);
    child.once('error', onError);

    hardTimer = setTimeout(async () => {
      // 1. 同步锁定超时状态，彻底阻断任何后续 exit/error 抢跑
      timedOut = true;
      console.error(`[SUPERVISOR HARD TIMEOUT] Child worker PID ${child.pid} exceeded hard deadline ${hardTimeoutMs}ms`);

      // 2. 有界终止子进程并完整获取退出证据
      const termRes = await safelyTerminateProcess(child, 1500);
      console.error(`[SUPERVISOR CLEANUP] Child worker terminated: ${JSON.stringify(termRes)}. Internal browser/profile unconfirmed; evidence preserved.`);

      // 3. 唯一定向单次落定，保证 timedOut: true，code: 1，携带 termRes
      finish({
        timedOut: true,
        code: 1,
        signal: termRes.signalCode || (child.signalCode || null),
        termRes,
      });
    }, hardTimeoutMs);
  });
}
```

---

## 4. 验证与回归结果

### 4.1 五审专项测试（`verify-fifth-repair.test.mjs`）
测试耗时：**1.23s**，全部通过（**9/9 PASS**）：
1. `G1.1: actual runSupervisedScript - normal exit 0 settles cleanly with code 0`（**PASS**，timedOut=false，code=0，termRes=undefined）；
2. `G1.2: actual runSupervisedScript - work error non-zero settles cleanly with code 42`（**PASS**，timedOut=false，code=42，termRes=undefined）；
3. `G1.3: actual runSupervisedScript - hard deadline triggers and captures timeout provenance`（**PASS**，真实自有 Node 忙循环 60ms 硬限触发，timedOut=true，code=1，termRes.terminated=true）；
4. `G1.4: actual runSupervisedScript - hard deadline followed by zero-exit does NOT report false success`（**PASS**，纯 IO 替身复现 kill 触发 exit(0)，严格返回 timedOut=true，code=1，绝不报假成功）；
5. `G1.5: actual runSupervisedScript - timeout/exit/error race settles exactly once`（**PASS**，kill 同时触发 exit 与 error，单次确定落定，timedOut=true，code=1）；
6. `G1.6: actual runSupervisedScript - termination unconfirmed returns failure and preserves evidence`（**PASS**，子进程拒绝退出时 phase timer 有界返回 terminated=false，证据目录保留）；
7. `F1.1: Stale retries consume remaining budget and strictly observe total action deadline`（**PASS**，77.6ms 内结束，守住 70ms 预算）；
8. `F1.2: Timed out action blocks late response from absorbing into client/app/DOM`（**PASS**，迟到回包丢弃，DOM/版本维持 70/rev 1）；
9. `F1.3: Independent SSE push continues to update client and app normally after timeout`（**PASS**，独立推送正常吸收更新为 85/rev 2）。

### 4.2 历史回归与基线测试
- **历史残余 10 项回归**（`verify-residuals-repaired.test.mjs`）：**10/10 PASS**（5.2s）；
- **代码静态语法检查**：`npm run check`（0 error，纯净通过）；
- **P1A 正式生产接入用例**：`npm run test:detachable-p1a`（**5/5 PASS**，769ms）；
- **P0 核心契约与安全用例**：`npm run test:detachable-p0`（**15/15 PASS**，1.27s）。

### 4.3 真实浏览器短路径探针实跑
1. **伴随页几何探针（`verify-companion-geometry.mjs`）**：
   - 耗时：~2.1s；退出码：`0`；
   - 窄视口 380px 1 列 / 宽视口 720px 2 列全通过；
   - 清理日志：`{"process":{"terminated":true,"exitCode":null,"signalCode":"SIGTERM"},"server":{"closed":true},"profile":{"cleanedUp":true}}`。
2. **React 19.2.0 应用层探针（`verify-react-docked-panel.mjs`）**：
   - 耗时：~3.5s；退出码：`0`；
   - React 挂载、双向同步、R4 错误卡片（Save/Dismiss/Apply/Delete/Detach）全通过；
   - 清理日志：`{"process":{"terminated":true,"exitCode":null,"signalCode":"SIGTERM"},"server":{"closed":true},"profile":{"cleanedUp":true}}`。

---

## 5. 进程安全与环境基线检查

- **后台活跃任务**：`manage_task(list)` 检查确认 **0 项任务**；
- **系统孤儿进程**：查询 `Get-CimInstance Win32_Process` 确认 **0 个孤儿 `msedge.exe` / `node.exe`**；
- **环境安全约束严格履行**：
  - 生产源码（companion.js / detachable-contract.js / client.js）零修改；
  - 日常 DSH 0.2.1-rc.2 / 鲸系外观 rc.35 / Git Bash 0.1.1 纯净运行未碰；
  - 定时任务 `g` 保持 `PAUSED`；
  - `package.json` 及生产 assets 维持 rc.30 冻结；
  - 未执行 `git commit` 或 `git push`，全部未暂存改动完整保护；
  - 未推进 P1B-2（壁纸库/详情）或 GPU 三体专项，滚动 A 继续低优先级挂起。

交付完毕，完全停下等待 Codex 复审。
