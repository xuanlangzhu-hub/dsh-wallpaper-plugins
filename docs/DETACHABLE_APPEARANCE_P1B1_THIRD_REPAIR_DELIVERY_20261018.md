# P1B-1三审补修交付：E1–E3动作期限、屏障隔离与清理结果消费落地

日期：2026-10-18\
执行者：Antigravity (Pair Programming Assistant)\
依据规范：[P1B-1三审报告](DETACHABLE_APPEARANCE_P1B1_THIRD_REVIEW_20261018.md) 与 [AGENTS.md 检查与交付守则](../AGENTS.md)

---

## 1. 交付概述

本轮严格遵照 Codex 三审复审意见及用户关于“**禁止无返回、一直卡住等待的 QA 脚本，禁止依赖用户提醒才停止**”的强制工程要求，保留已通过的单队列正常顺序、旧 resolver 落定、断连通知落定、3 次 stale 上限、在途显示保护与取消全量恢复，以及 CDP close-before-open、已 signal 退出立即返回与 server 阶段时限等全部既有成果，不再返工；聚焦并最小化精准完成 **E1–E3** 补修：

1. **E1（无回包动作总截止、worker 释放与迟到回包失效）**：
   - 在 `createCompanionApp` 引入 `actionTimeoutMs`（默认 5000ms，支持测试注入短时限）；
   - 调参与预设派发均接入 `Promise.race` 动作级总截止；超时时立即落定调用方为 `{ ok: false, error: 'action-timeout', serverCommitted: 'unknown' }`，取消依赖队列并回退所有控件至权威快照；
   - 彻底释放 worker 循环，绝不卡死在 `await` 中；
   - 迟到回包因调用项已落定而安全失效，不误报调用方成功，不清除超时告警，更不自动重放或执行预设。
2. **E2（stale 恢复判定严格尊重预设屏障）**：
   - 在 `stale-revision` 恢复分支中，将 `hasNewerInQueue` 修正为同屏障段扫描：遇 `queued.kind === 'preset'` 立即 `break` 停止；
   - 彻底杜绝在 `set80 -> save -> set100` 中因跨屏障看到 100 而将 80 误标为 `superseded` 的缺陷；80 遇 stale 时在屏障前有限重试，成功后再由 save 捕获已确认的 80；若 80 冲突耗尽或失败，则整体取消依赖的 save，绝不保存 70 冒充 80；
   - 同批无屏障 `set80 -> set100` 的正常替代正例完全保持。
3. **E3（清理结果消费、失败非零退出、有界 fetch 与进程 error 监听）**：
   - 完善 [`safe-qa-runner.mjs`](../.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/safe-qa-runner.mjs)：`safelyTerminateProcess` 补齐 `proc.once('error')` 一次性落定与清理；
   - 两个实际 runner（[`verify-companion-geometry.mjs`](../.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/verify-companion-geometry.mjs)、[`verify-react-docked-panel.mjs`](../.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/verify-react-docked-panel.mjs)）的 `finally` 显式校验 `termRes.terminated`、`srvRes.closed` 与 `rmRes.cleanedUp`，任一未确认立即设置 `process.exitCode = 1`；
   - 区分工作截止与兜底看门狗：主流程异常或超时通过 `try/catch` 保证进入 `finally` 进行受控清理，外层 `unref` 看门狗仅作事件循环僵死之最终兜底；
   - 真实 DevTools 端口轮询 fetch 绑定 `AbortSignal.timeout(1000)`，阶段有界可取消。

---

## 2. 核心文件指纹与修改对照

### 2.1 关键文件 SHA256

| 文件路径 | 状态 | SHA256 | 说明 |
|---|---|---|---|
| `dsh-whale-mist/src/client.js` | 保持通过 | `557B9C8CE67B9E73FA040CA33A593610BC6ACF18E988BCF31A9E08B6CD9DA769` | R2 presetTarget 下发、R4 独立动作错误反馈（三审保留通过） |
| `dsh-whale-mist/src/detachable-contract.js` | 保持通过 | `5E894F62BFFEE1F9640EBAD5862E12E48E8FE2251834E29EB0914993065D80AD` | 严格契约与场景门禁（三审保留通过） |
| `dsh-whale-mist/src/companion/companion.js` | **本轮补修** | `A330C8DAC52F895AFE934C6ECDF480D65016B7E2964A1AA0DA0A27B294727AF6` | E1 动作级总截止/worker释放/迟到失效，E2 stale屏障阻断 |
| `safe-qa-runner.mjs` | **本轮完善** | `9AD6C9A738517CB701C19ECFEA8AA1A169237C261C461DF7C88A56B1235BB9BF` | E3 `safelyTerminateProcess` 补齐 `proc.once('error')` 监听与清理 |
| `verify-third-repair.test.mjs` | **本轮新增** | `F71CB4F8C207999215B19889F0C09CCBF7DAC9A8412CA594E153370A53A209B9` | 覆盖 E1/E2/E3 全部缺陷修复与正例（8/8 通过，1.1s） |
| `verify-residuals-repaired.test.mjs` | 保持通过 | `525F090A83382809554580B26CA18291C5B55D7A1B88B20F57F3749E7823B129` | 二审 C1–C4 边界回归测试（10/10 通过，807ms） |
| `verify-companion-geometry.mjs` | **本轮更新** | `91BAC186F9DC270B64522A0807C0C3CCA9DE0F98335F29EC992A6A6CF7CA4BF6` | E3 消费清理结果、有界 fetch、exitCode=1 退出守卫 |
| `verify-react-docked-panel.mjs` | **本轮更新** | `E6F1BBC0C941789C38F5D1A2DABBF37D1B919E0BFEC9A32D21DBD67CA84B1120` | E3 消费清理结果、有界 fetch、exitCode=1 退出守卫 |

---

## 3. 补修实现细节

### 3.1 E1：动作总截止、worker 释放与迟到回包失效
- **超时参数注入**：
  ```javascript
  export function createCompanionApp({
    windowObj = (typeof window !== 'undefined' ? window : null),
    documentObj = (typeof document !== 'undefined' ? document : null),
    customTransport = null,
    actionTimeoutMs = 5000,
  } = {})
  ```
- **动作执行双重竞争与超时判定**：
  ```javascript
  let res;
  let timedOut = false;
  let actionTimer = null;
  try {
    res = await Promise.race([
      client.setSetting(key, value),
      new Promise((_, reject) => {
        actionTimer = setTimeout(() => reject(new Error('action-timeout')), actionTimeoutMs);
      }),
    ]);
  } catch (err) {
    if (err.message === 'action-timeout') timedOut = true;
    res = { ok: false, error: err.message || 'action-timeout' };
  } finally {
    if (actionTimer) clearTimeout(actionTimer);
  }

  if (timedOut) {
    showError(`设置 ${key} 超时: 服务端状态未确认`);
    settleItem(item, { ok: false, error: 'action-timeout', serverCommitted: 'unknown' });
    cancelRemainingQueue('aborted-after-failure');
    revertAllControlsToAuthoritative();
    activeInFlight = null;
    break; // 立即跳出 while 循环，workerRunning 重置为 false
  }
  ```
- **迟到回包丢弃**：
  若后台网络响应在超时落定后迟到返回，因 `item.settled === true`，`settleItem` 直接略过；不改变调用方状态，不重放预设，不抹去错误告警。

### 3.2 E2：stale-revision 恢复严格尊重预设屏障
- **同屏障段扫描**：
  ```javascript
  let hasNewerInSameBatch = false;
  for (const queued of actionQueue) {
    if (queued.kind === 'preset') {
      // 遇预设屏障立即终止，屏障后的新意图绝不能替代屏障前的意图
      break;
    }
    if (queued.kind === 'setting' && queued.key === key && !queued.settled) {
      hasNewerInSameBatch = true;
      break;
    }
  }

  if (hasNewerInSameBatch) {
    settleItem(item, { ok: true, superseded: true, snapshot: res.snapshot });
    activeInFlight = null;
    continue;
  }
  ```
- 在 `set80 -> save -> set100` 中，80 遇 stale 时，因屏障阻断，80 保持重试并重新 `unshift` 到队首（位于 save 之前）；80 重试成功后，save 捕获确认的 80；若 80 失败，save 被整体取消，绝不会在 70 上盲目保存。

### 3.3 E3：清理结果消费与 runner 安全退出
- **子进程 error 监听补齐**：
  在 `safelyTerminateProcess` 中注册 `proc.once('error', onError)`，并在退出或超时 cleanup 时移除，杜绝未捕获的异步进程错误。
- **清理结果消费与非零退出**：
  在两个浏览器 runner 的 `finally` 块中增加判定：
  ```javascript
  if (workError || !termRes.terminated || !srvRes.closed || !rmRes.cleanedUp) {
    process.exitCode = 1;
  }
  ```
  任一清理项未确认（如进程未确认终止、端口未关闭、Profile 目录未删除）或主工作失败，脚本均明确以非零码（1）退出。
- **有界 fetch**：DevTools 端口探测调用绑定 `AbortSignal.timeout(1000)`。

---

## 4. 独立验证分层与证据记录

所有测试及日志均位于独立证据目录：\
[`.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/`](file:///F:/dsh-wallpaper-plugins/.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/)

### 4.1 测试分层与结果一览

| 检查层级 | 测试脚本 / 探针 | 范围与说明 | 结果 | 日志路径 |
|---|---|---|---|---|
| **代码语法与 CSS 守卫** | `npm run check` | 检查 11 个生产核心文件语法及模板字面量守卫 | 退出 0 | `.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/check.log` |
| **E1–E3 专项受控回归 (8 项)** | `verify-third-repair.test.mjs` | E1 动作超时（60ms）主动落定/取消后续/释放 worker；E1 迟到回包防误报防重放；E2 屏障阻断 stale 替代与重试确认；E2 失败取消依赖 save；E2 无屏障同批替代正例；E3 进程 error 监听；E3 两个 runner finally 清理失败非零退出 | 8/8 通过 (1.1s) | `.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/third-repair.log` |
| **C1–C4 历史边界全量回归 (10 项)** | `verify-residuals-repaired.test.mjs` | 二审 C1 stale 替代/断连在途落定/3次上限；C2 顺序保序；C3 在途保护与全量回退；C4 CDP close/signal/server 阶段期限 | 10/10 通过 (807ms) | `.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/prior-boundaries.log` |
| **伴随页几何与关键动作** | `verify-companion-geometry.mjs` | 无头 Edge 运行生产 `companion.js`；有界 CDP/fetch 与清理；380px 窄视口单列/无横向溢出与 720px 宽视口双列/全通栏预设；退出码安全守卫 | 全部通过 (2.2s) | `.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/companion-geometry.log` |
| **真实 React 19.2.0 应用层** | `verify-react-docked-panel.mjs` | 加载生产 React 19.2.0 / ReactDOM，挂载吸附面板；有界 CDP/fetch 与清理；验证参数同步(113)、R4 独立动作错误可见及清除、真实 controller 门禁；退出码安全守卫 | 全部通过 (2.3s) | `.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/react-docked-panel.log` |
| **P0 架构契约回归** | `detachable-appearance-p0.test.mjs` | 模式切换、单源快照、协议安全等全部 15 项基线 | 15/15 通过 (1.2s) | `.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/p0.log` |
| **P1A 生产链路回归** | `detachable-p1a-production.test.mjs` | 真实生命周期、适配器、生产资产等全部 5 项基线 | 5/5 通过 (803ms) | `.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/p1a.log` |
| **双 Browser 进程 E2E** | `detachable-browser-e2e.mjs` | 主渲染器与伴随页双上下文真实 HTTP/SSE 交互 11 项 | 11/11 通过 (2.4s) | `.tmp/detachable-p1b1-third-repair-20261018-c9e2b107/browser-e2e.log` |

---

## 5. 环境状态与边界守则

1. **日常环境保持纯净**：日常 DSH 0.2.1-rc.2 / 外观 rc.35 / Git Bash 0.1.1 纯净未碰；未执行打包、安装、发布操作；
2. **工作区冻结状态**：`package.json` 及清单文件维持 `rc.30`，未修改版本号；
3. **未触碰日常进程**：未操作、重启、退出或采样真实 DSH 与 Wallpaper Engine 进程，未发送 DSH 模型请求；
4. **定时任务状态**：定时任务 `g` 严格保持 `PAUSED`；
5. **代码保护**：工作区现有未暂存修改完整保留，未执行 git commit 或 git push；
6. **任务边界**：滚动 A 保持低优先级，未进入 P1B-2（壁纸库缩略图/详情页）或 GPU 三体专项。

交付完成，停下等待 Codex 复审。
