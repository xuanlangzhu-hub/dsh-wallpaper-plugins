# P1B-1二审补修交付：C1–C4队列屏障与有界QA全面落地

日期：2026-10-18\
执行者：Antigravity (Pair Programming Assistant)\
依据规范：[P1B-1二审报告](DETACHABLE_APPEARANCE_P1B1_SECOND_REVIEW_20261018.md) 与 [AGENTS.md 检查与交付守则](../AGENTS.md)

---

## 1. 交付概述与强制工程规范遵从

本轮严格对照 Codex 二审复审意见及用户关于“**禁止无返回、一直卡住等待的 QA 脚本，禁止依赖用户提醒才停止**”的明确指令，不推倒 P1A/B 架构，不扩展 P1B-2，保持滚动 A 低优先级，聚焦并完成 **C1–C4** 全部补修：

1. **C1（动作 Promise 一次性 settle 与有界重试）**：统一单次 settle（`settleItem`）；80 在途遇 stale 且 100 已排队时，将旧 80 resolver 立即落定为 `{ ok: true, superseded: true }`；断连回调遍历落定在途 `activeInFlight`（报 `disconnected`），不再依赖替身主动解决；`stale-revision` 设置硬上限（`MAX_STALE_RETRIES = 3`）且通过 `setTimeout(r, 0)` 让出宏任务，超限诚实报错退出并回滚。
2. **C2（预设动作作为有序屏障）**：将分散的 `pendingSettings` 与 `presetQueue` 合并为单一严格保序的 `actionQueue`。预设动作（save/apply/remove）作为有序屏障（barrier）；连续输入仅在同一屏障段内合并，严禁越过屏障；严格保障用户意图顺序 `set80 -> save -> set100`，杜绝后来输入覆盖先前保存。
3. **C3（在途与排队字段全量协调及错误恢复）**：实现 `hasPendingOrInFlight(key)`，同时追踪在途项与排队项；外部快照推送（如 mask60）不会冲掉正在在途的 brightness100；调参失败或断连时，调用 `revertAllControlsToAuthoritative()` 全面重置所有控件至权威快照值，聚焦输入在失焦时同样按最新确认值或在途值恢复。
4. **C4（QA 脚本严格有界与资源干净释放）**：
   - 提取并实现通用安全 QA 运行器 [`safe-qa-runner.mjs`](../.tmp/detachable-p1b1-second-repair-20261018-b8d91a22/safe-qa-runner.mjs)；
   - `createBoundedCdpClient`：封装 `open`、`error`、`close`、`timeout` 四路竞争单次 settle，彻底杜绝 close-before-open 挂起；
   - `safelyTerminateProcess`：优先核验 `exitCode !== null || signalCode !== null`，带阶段超时（1500ms）及 SIGKILL 兜底；
   - `safelyCloseServer`：带阶段超时（1500ms）；
   - `safelyRemoveProfile`：仅在子进程确认退出后清理，清理失败诚实报错，未退出保留现场证据；
   - 几何检查明确表述为 DOM 布局与包围盒非零检查，不夸大为“可点击”；
   - 核验后台任务：`task-32`（历史搜索命令，正常退出 0）与 `task-551`（历史边界测试挂死项，已彻底终止）；当前运行后台任务为 0，系统零孤儿 node/Edge 进程。

---

## 2. 核心文件指纹与修改对照

### 2.1 生产与测试文件 SHA256

| 文件路径 | 状态 | 修改后 SHA256 | 说明 |
|---|---|---|---|
| `dsh-whale-mist/src/client.js` | 保持通过 | `557B9C8CE67B9E73FA040CA33A593610BC6ACF18E988BCF31A9E08B6CD9DA769` | R2 presetTarget 下发、R4 独立动作错误反馈（二审保持） |
| `dsh-whale-mist/src/detachable-contract.js` | 保持通过 | `5E894F62BFFEE1F9640EBAD5862E12E48E8FE2251834E29EB0914993065D80AD` | 严格契约与场景门禁（二审保持） |
| `dsh-whale-mist/src/companion/companion.js` | **本轮补修** | `C62EDDED9A749BE157878BE8EB48D316B484D7B44527660C109E26CD04CC545D` | C1 单次 settle/重试上限、C2 单队列屏障保序、C3 在途保护与全量回滚 |
| `safe-qa-runner.mjs` | **本轮新增** | `2AC760B9D4DCD6B81B0C45400E16E764F61332C6726E6835DFF9E38AAD271DDF` | 四路一次性 settle CDP、带 signalCode 校验的有界进程与 Profile 清理 |
| `verify-residuals-repaired.test.mjs` | **本轮新增** | `525F090A83382809554580B26CA18291C5B55D7A1B88B20F57F3749E7823B129` | 覆盖 C1–C4 缺陷修复后的 10 项受控边界断言（10/10 通过） |
| `verify-companion-geometry.mjs` | **本轮重构** | `089A5FA1F3ECCC67045D160A9F6B178031F232BB75F7767081C323EDDF74A23E` | 接入有界 CDP/进程清理，消除 close 挂死，纠正几何非零表述 |
| `verify-react-docked-panel.mjs` | **本轮重构** | `3F220F09BB35EE46C414AA1A80F3DC8580B50AC81BAC66CAD5E6493771411640` | 接入有界 CDP/进程清理，覆盖真实 React 19.2.0 应用层与错误反馈 |

---

## 3. 补修实现细节

### 3.1 C1：动作 Promise 一次性 settle、在途断连落定与有限重试
- **一次性落定守卫**：
  ```javascript
  function settleItem(item, result) {
    if (!item || item.settled) return;
    item.settled = true;
    if (item.resolve) item.resolve(result);
  }
  ```
- **旧 resolver 继承与落定**：在途 80 收到 `stale-revision` 且队列中已存在后续 100 时：
  ```javascript
  if (hasNewerInQueue) {
    settleItem(item, { ok: true, superseded: true, snapshot: res.snapshot });
    activeInFlight = null;
    continue;
  }
  ```
  旧 80 立即被落定为 `superseded`，不再无主悬空，100 紧接着派发。
- **断连落定在途活跃项**：
  ```javascript
  function cancelRemainingQueue(reason) {
    if (activeInFlight) {
      settleItem(activeInFlight, { ok: false, error: reason });
    }
    for (const item of actionQueue) {
      settleItem(item, { ok: false, error: reason });
    }
    actionQueue.length = 0;
  }
  ```
  Client 断连时触发，直接落定 `activeInFlight`，不再依赖底层网络替身的主动回包。
- **有限重试与宏任务让出**：
  ```javascript
  item.attempts = (item.attempts || 0) + 1;
  if (item.attempts >= MAX_STALE_RETRIES) {
    showError(`设置 ${key} 冲突次数超限，请稍后重试`);
    settleItem(item, { ok: false, error: 'max-stale-retries-exceeded', snapshot: res.snapshot });
    cancelRemainingQueue('aborted-after-failure');
    revertAllControlsToAuthoritative();
    activeInFlight = null;
    break;
  }
  await new Promise(r => setTimeout(r, 0));
  actionQueue.unshift(item);
  ```

### 3.2 C2：统一有序队列与预设屏障
- 将原有相互抢跑的 `pendingSettings` (Map) 与 `presetQueue` (Array) 合并为单一有序数组 `actionQueue`；
- 用户连续拖动滑块时，向后查找队列中最后的预设屏障（`findLastIndex(preset)`）；仅在屏障后的同一批次内进行防抖合并，合并时将旧项 settle 为 `superseded`；
- 预设动作入队作为屏障，后续新设置必须排在预设之后，严格保持 `set80 -> save-preset -> set100` 的执行次序。

### 3.3 C3：在途与排队字段保护及全量控件回退
- 实现 `hasPendingOrInFlight(key)`，同时检查当前在途 `activeInFlight` 与排队中各项；
- `applySnapshot` 在更新 DOM 控件时校验 `!hasPendingOrInFlight(key)`，外部 mask60 快照不再冲刷在途的 brightness100；
- 当调参失败、超限或连接断开时，调用 `revertAllControlsToAuthoritative()`，将所有 4 项画面参数、6 项界面定制参数及预设状态一次性对齐当前权威快照；
- `bindInputBlurRecovery` 在失焦时若无在途修改，重置为快照已确认值。

### 3.4 C4：QA 有界落定、安全释放与后台历史记录核验
- **四路单 settle CDP 连接器**：`createBoundedCdpClient` 封装 `open` / `error` / `close` / `timeout` 互斥落定；`close-before-open` 立即 reject，绝不挂起；
- **带退出状态核验的进程终结器**：`safelyTerminateProcess` 先行判定 `proc.exitCode !== null || proc.signalCode !== null`（处理已信号退出的进程），设置 1500ms 阶段时限与 SIGKILL 兜底；
- **真实清理与证据保留**：`safelyRemoveProfile` 校验终结状态，未终结保留 Profile 证据并输出警告，删除失败输出异常信息，绝不吞错虚报；
- **后台任务核对**：
  - `task-32`（19:35 启动之 `RobustCdpClient` 搜索）：命令已正常退出 0；
  - `task-551`（21:42 启动之 `repaired-boundaries.test.mjs`）：因原脚本替身在断连测试时悬空导致挂死，已通过 `manage_task(kill)` 彻底取消；
  - 经 `manage_task(list)` 验证当前处于运行态的任务数为 0；
  - 经系统进程查询确认，当前无任何遗留的 `node.exe` 或 `msedge.exe` 孤儿测试进程。

---

## 4. 独立验证分层与证据记录

所有测试及日志全部存放于独立新建目录：
`.tmp/detachable-p1b1-second-repair-20261018-b8d91a22/`

### 4.1 测试分层与结果一览

| 检查层级 | 测试脚本 / 探针 | 范围与说明 | 结果 | 日志路径 |
|---|---|---|---|---|
| **代码语法与 CSS 守卫** | `npm run check` | 检查 11 个生产核心文件语法及模板字面量守卫 | 退出 0 | `.tmp/detachable-p1b1-second-repair-20261018-b8d91a22/check.log` |
| **C1–C4 受控边界回归 (10 项)** | `verify-residuals-repaired.test.mjs` | 纯受控测试：C1 stale 替代结算、断连在途结算、重试上限 3 次；C2 `set80 -> save -> set100` 屏障保序；C3 在途保护与全量回退；C4 close-before-open 即退、已退出进程即返、stub 进程有界超时、server 挂起有界退出 | 10/10 通过 (806ms) | `.tmp/detachable-p1b1-second-repair-20261018-b8d91a22/residuals-repaired.log` |
| **伴随页几何与关键动作** | `verify-companion-geometry.mjs` | 无头 Edge 运行生产 `companion.js`；有界 CDP 与清理；验证 380px 窄视口单列/无横向溢出与 720px 宽视口双列/全通栏预设；包围盒非零几何断言 | 全部通过 (2.1s) | `.tmp/detachable-p1b1-second-repair-20261018-b8d91a22/companion-geometry.log` |
| **真实 React 19.2.0 应用层** | `verify-react-docked-panel.mjs` | 加载生产 React 19.2.0 / ReactDOM，挂载吸附面板；有界 CDP 与清理；验证参数同步(113)、R4 保存/应用/分离错误独立可见及清除；验证真实 controller 门禁 | 全部通过 (2.3s) | `.tmp/detachable-p1b1-second-repair-20261018-b8d91a22/react-docked-panel.log` |
| **P0 架构契约回归** | `detachable-appearance-p0.test.mjs` | 模式切换、单源快照、协议安全等全部 15 项基线 | 15/15 通过 (1.2s) | `.tmp/detachable-p1b1-second-repair-20261018-b8d91a22/p0.log` |
| **P1A 生产链路回归** | `detachable-p1a-production.test.mjs` | 真实生命周期、适配器、生产资产等全部 5 项基线 | 5/5 通过 (725ms) | `.tmp/detachable-p1b1-second-repair-20261018-b8d91a22/p1a.log` |
| **双 Browser 进程 E2E** | `detachable-browser-e2e.mjs` | 主渲染器与伴随页双上下文真实 HTTP/SSE 交互 11 项 | 11/11 通过 (2.4s) | `.tmp/detachable-p1b1-second-repair-20261018-b8d91a22/browser-e2e.log` |

---

## 5. 环境状态与边界守则

1. **日常环境保持纯净**：日常 DSH 0.2.1-rc.2 / 外观 rc.35 / Git Bash 0.1.1 纯净未碰；未执行安装、发布、打包操作；
2. **工作区冻结状态**：`package.json` 及清单文件维持 `rc.30`，未修改版本号；
3. **未触碰日常进程**：未操作、重启、退出或采样真实 DSH 与 Wallpaper Engine 进程，未发送 DSH 模型请求；
4. **定时任务状态**：定时任务 `g` 严格保持 `PAUSED`；
5. **代码保护**：工作区现有未暂存修改完整保留，未执行 git commit 或 git push；
6. **任务边界**：滚动 A 保持低优先级未增补无界测试，未进入 P1B-2（缩略图壁纸库/详情页）或 GPU 三体专项。

交付完成，停下等待 Codex 复审。
