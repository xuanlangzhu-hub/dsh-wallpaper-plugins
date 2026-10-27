# rc.50 首次作者读取：SDK 边界补验复审项（R1/R2）补修交付报告

2026-10-27，Gemini（Antigravity 会话）。
依据 Codex 复审意见（`docs/RC50_AUTHOR_INITIAL_READ_SDK_BOUNDARY_REVIEW_20261027.md`），在全新排他隔离目录 `.tmp/rc50-gemini-boundary-repair-20261027-a/` 完成 R1（收尾失败验证契约与真实门禁复用）及 R2（完整协议有效包络与迟到隔离深度断言）的专项补修与独立验证。

---

## 结论摘要

1. **R1 修复通过**：
   - 修复了验证契约：子测试在模拟收尾未确认时，子报告记录 `passed: false`、`cleanupSuccessful: false`，子进程非零退出（`code: 1`）；父监督验证器（`run-teardown-failure-gate.cjs`）断言上述失败事实后确认预期失败成立（`expectedFailureConfirmed: true`），验证器自身以 `code: 0` 成功退出。
   - 摒弃了独立的自证布尔表达式，直接复用同一 `sdk-boundary-test.mjs` 中的真实 SDK 收尾门禁，通过环境变量 `QA_INJECT_TEARDOWN_FAILURE=true` 在真实资源释放完毕后注入收尾未确认状态，验证了生产/QA公用门禁的故障拦截路径。
   - 保留正常与故障双路证明，所有报告与运行记录均改用排他写入模式 `{ flag: 'wx' }`。
2. **R2 修复通过**：
   - 构造了符合真实协议完整包络的 Lucy 响应数据（含 `schemaVersion: 1`、`fingerprint`、`type: 'bool'`、`supported: true`、`label`、`draft` 及 `application`），在 VM 对照实验（`payload-control.mjs`）中完成正负对照：正例成功进入 `ready` 态且 `values.particles: false`，负例被精准拦截为 `validation.shape`。
   - 在 SDK 测试中，旧请求在途保持至新代次确已 `ready`；释放带有可辨认旧值（`particles: false`）的有效旧响应后，经过 60ms 定时延时等待进行 DOM 终态采样检查，明确断言新代次 DOM 终态保持 `checked === true`（未被旧值覆写）；销毁例在 SDK 层面验证根节点清空（`rootChildren: 0`）、0 次写及 0 未处理异常。实际控制器 physical Promise 物理完成与销毁后零通知边界由 Codex 独立 4 项 VM 确定性回放补齐，形成分层组合核验。
   - `RequestLatch` 显式记录路由交割状态（`outcome: 'fulfilled'`），不吞掉异常；销毁用例同样使用完整有效包络，断言 0 次作者写、0 次原生命令及 0 个页面未处理异常。
3. **现场状态客观声明**：
   - 本轮仅针对离线 SDK 边界与 QA 探针进行补验，**未修改共享源码（`dsh-whale-mist/`）**，未触碰日常 DSH 0.2.1-rc.3 / WE / Git Bash 0.1.2 / Profile / assets / 版本号。
   - 真实生产环境下“加载 23 张图库后首次作者读取失败”的现场根因仍未定，不把测试转绿称为现场已修复。

---

## 一、R1：收尾失败门禁与验证契约修复

### 1.1 根因与修复说明
此前 `sdk-cleanup-failure-stub.mjs` 仅在本地维护布尔值而未序列化入 JSON，导致父监督脚本读取 `childReport.cleanupSuccessful` 为 `undefined`，进而判定 `expectedFailureConfirmed: false` 退出 1。同时该 stub 为独立合成表达式，未测试主测试脚本实际的收尾判定逻辑。

### 1.2 修复措施
1. **真实收尾门禁直接注入**：
   在 `sdk-boundary-test.mjs` 的真实 `finally` 块中加入受控注入点：
   ```javascript
   if (injectTeardownFailure) {
     report.cleanup.browserExitConfirmed = false;
     report.cleanup.browserCloseError = 'QA_INJECTED_TEARDOWN_FAILURE: simulated browser exit unconfirmed';
   }
   const allCleanupsOk = !report.cleanup.browserCloseError &&
                         !report.cleanup.serverCloseError &&
                         !report.cleanup.hostStopError &&
                         report.cleanup.browserExitConfirmed === true &&
                         report.cleanup.mainSessionCleaned === true;
   report.cleanupSuccessful = allCleanupsOk;
   report.passed = report.cases.length > 0 && report.cases.every(c => c.passed) && allCleanupsOk;
   ```
2. **契约与退出码区分**：
   - 子进程（受测目标）：注入故障时，`childReport.cleanupSuccessful === false`，`childReport.passed === false`，进程以 `exitCode = 1` 退出。
   - 父监督（`run-teardown-failure-gate.cjs`）：断言子进程退出码为 1 且报告中清理失败标记成立，设置 `expectedFailureConfirmed = true`，父监督进程以 `exitCode = 0` 退出。
3. **排他写盘保护**：所有生成报告与运行记录均采用 `{ flag: 'wx' }`，杜绝覆盖风险。

### 1.3 运行结果双路对照
- **故障注入路（`run-teardown-failure-gate.cjs`）**：
  - 运行耗时：`5,627ms`
  - 子进程退出码：`1`
  - 子报告 `passed`: `false`，`cleanupSuccessful`: `false`，`browserExitConfirmed`: `false`
  - 预期失败确认：`expectedFailureConfirmed: true`
  - 验证器退出码：`0`（通过）
  - 记录文件：`sdk-teardown-failure-report.json`、`teardown-failure-run.json`
- **正常收尾路（`run-sdk-boundary.cjs`）**：
  - 运行耗时：`4,881ms`
  - 子进程退出码：`0`
  - 子报告 `passed`: `true`，`cleanupSuccessful`: `true`，`browserExitConfirmed`: `true`，`mainSessionCleaned`: `true`
  - 验证器退出码：`0`（通过，6 个测试用例全部通过）
  - 记录文件：`sdk-boundary-report.json`、`sdk-boundary-run.json`

---

## 二、R2：完整协议有效包络与迟到隔离深度断言

### 2.1 完整协议包络规范
此前旧成功测试 payload 缺少协议包络字段且 `type` 误写为 `'boolean'`，导致在前端控制器 `accept` 阶段即被当做 `validation.shape` 拒绝。
本轮脚本实际构造符合真实契约的完整 Lucy 响应包络（注：此前交付文档示例曾将 schema 字段误写在顶层且缺 wallpaperId，此处更正为与 `sdk-boundary-test.mjs` 实际执行代码完全一致的完整包络）：
```javascript
const createValidLucyPayload = ({ particles = true, revision = 0 } = {}) => ({
  ok: true,
  application: { available: true, targetActive: true },
  schema: {
    wallpaperId: 'lucy',
    schemaVersion: 1,
    fingerprint: 'a'.repeat(64),
    fields: [
      { key: 'particles', type: 'bool', supported: true, label: 'Particles' }
    ]
  },
  draft: {
    revision,
    stale: false,
    dirtyKeys: [],
    values: { particles }
  }
});
```

### 2.2 VM 正负对照（`payload-control.mjs`）
使用真实作者控制器在 VM 中对同一上下文进行单测验证：
1. **负对照（旧残缺 payload）**：
   - 结果：`ok: false`，`phase: 'blocked'`，`message: '未能读取设置，请重试 [validation.shape]'`，`failures: ['response-invalid']`。
2. **正对照（修复后有效 payload，`particles: false`）**：
   - 结果：`ok: true`，`phase: 'ready'`，`fields: 1`，`values.particles: false`，`failures: []`。
   - 充分证明：修复后 payload 满足真实协议规范，能被正常消费并呈现出指定的可辨认数据。

### 2.3 SDK 测试场景与终态断言（端到端）
在 `sdk-boundary-test.mjs` 中执行 6 项场景化测试：
1. **`generation-change-late-success`**：
   - 发起读取请求，通过 `activeLatch.waitIntercepted()` 将旧代请求挂起在途；
   - 执行 `stop()` 并重新 `playing()` 启动新代次 Lucy，等待新代次读取成功并进入 `ready`（新代次默认值为 `checked === true`）；
   - 此时释放旧代请求，响应体为携带 `particles: false` 的完整有效 Lucy 包络；
   - 等待 `activeLatch.waitSettled()` 完成交割，并经过 `60ms` 定时延时等待后进行 DOM 终态采样检查（注：此 60ms 属定时延时采样，非底层微任务队列完全清空或异步网络作业确定性完成信号，所测为终态呈现，不声称中间过程绝无闪烁）；
   - **终态断言**：
     - 新代次 DOM 控件在 60ms 终态保持 `checked === true`，严格未被旧代响应（`particles: false`）覆写；
     - 新代次 DOM 保持 `enabled === true`；
     - DOM 中 0 个错误告警；
     - 全程 0 次作者写请求，0 次原生命令；
     - 记录交割结果：`latchOutcome: "fulfilled"`。
2. **`hidden-view-late-response`**：
   - 请求挂起后切换至“界面”栏；
   - 释放 500 错误，`latchOutcome: "fulfilled"`；
   - 切回“壁纸”栏，验证旧 500 状态与 payload 未泄露进 DOM，保留 `[controller.cancelled]`；
   - 重返视图仅发起离开前那 1 次请求，**零额外自动重试循环**；0 次写请求，0 次原生命令；
   - 手动重试后完全恢复为 ready 态。
3. **`generation-change-late-error`**：
   - 请求挂起后换代，释放 403 错误，`latchOutcome: "fulfilled"`；
   - 新代次在 60ms 终态采样保持 `checked === true`、`enabled === true`，旧 403 错误未闪烁入 DOM 终态；
   - 0 次写请求，0 次原生命令。
4. **`view-destroyed-late-response`**：
   - 请求挂起后执行 `window.qaUnmount()` 卸载根视图；
   - 释放完整有效 Lucy 响应，`latchOutcome: "fulfilled"`；
   - SDK 层面断言仅覆盖视图卸载事实（`rootChildren: 0`）、卸载后 0 次作者写请求、0 次原生命令及 0 个未处理页面异常（`pageErrors.length === 0`），未直接断言销毁后旧控制器内部通知。
5. **`phase-code-bridge-disconnected`**：
   - 真实终止 Host 会话 SSE 流；
   - 观测到原生 `requestAuthor` 进入内部断开分支并抛出封闭阶段码 `{ stage: 'bridge', reason: 'disconnected' }`；
   - 侧栏感知断开并自动安全退避；0 次写，0 次原生命令；重新连接后恢复正常。

### 2.4 Codex 独立补齐的确定性控制器回放证据（VM 级）
针对 SDK 依赖 60ms 定时等待及销毁后内部通知证据不足的局限，Codex 在独立排他目录 `.tmp/rc50-author-sdk-boundary-repair-review-20261027-a/` 补充了 4 项确定性控制器回放（详见 `deterministic-controller-boundaries-v2.mjs` 与 `deterministic-controller-boundaries-report-v2.json`）。该测试使用真实诊断作者控制器在 VM 中运行，request IO 刻意忽略 `AbortSignal` 模拟不配合取消的真实迟到网络，精确等待底层 physical Promise 完成：
1. **上下文切换迟到有效成功（`context-late-valid-success`）**：旧请求物理完成后，旧控制器仅触发 1 次 busy 清理通知（资源收尾，不含旧值或旧错误），无旧值进入当前状态，新读恢复为 `ready` 且 `particles: true`，0 次写请求；
2. **上下文切换迟到错误（`context-late-error`）**：旧错误物理完成后无旧错误污染，新读恢复为 `ready` 且 `particles: true`，0 次写请求；
3. **销毁后迟到有效成功（`dispose-and-new-provider-late-valid-success`）**：旧控制器 dispose 且新 provider 已 ready，释放迟到旧成功，物理完成后旧控制器与新 provider 的通知增量均为 0，旧 fields/values 清空且 `canEdit: false`，新 provider 保持 `ready` 且 `particles: true`，0 次写请求；
4. **销毁后迟到错误（`dispose-and-new-provider-late-error`）**：旧控制器销毁后释放旧错误，物理完成后通知增量均为 0，新 provider 保持 `ready`，0 次写请求。

> **分层归属说明**：上述 4 项确定性物理等待证据由 Codex 独立提供，与本轮 SDK 的真实 Edge 挂载/HTTP 交互/DOM 终态检查形成分层组合核验，在此准确引用，不混同为原 SDK 脚本自身断言。

---

## 三、排他验证产物清单与哈希

所有脚本与记录均位于排他目录 `F:\dsh-wallpaper-plugins\.tmp\rc50-gemini-boundary-repair-20261027-a/`：

| 文件名 | 大小 (字节) | SHA256 哈希 | 作用说明 |
| :--- | :--- | :--- | :--- |
| `payload-control.mjs` | 2,859 | `DD95ECD1DFC94ADFFC2534BF22EC6052090E090EE9BCED53F00E5B1F0F7F1578` | VM 正负对照实验脚本 |
| `payload-control-report.json` | 445 | `4FF064B58C055237F57D094451EA88286907790C5D240F31F1DE38C38F08389E` | VM 正负对照实验报告（正例 ready，负例 shape） |
| `sdk-boundary-test.mjs` | 30,966 | `6552273AE222A56B438FCB8A1AA7DA1EACF1FB9C76821EA9BE992A3094280310` | 完整 SDK 边界测试脚本（支持 `QA_INJECT_TEARDOWN_FAILURE`） |
| `run-teardown-failure-gate.cjs` | 2,217 | `B8EC757451FD089FB4AD785E8AE09B018D7A2AD2D66273ABCA3C35149948BA0E` | R1 收尾失败门禁父监督验证脚本 |
| `sdk-teardown-failure-report.json`| 3,474 | `FC848388A383036AAA14D8CA7C186B1F747C9691E0FCCB195E7C313B78039EE1` | 收尾失败子测试报告（`passed: false`, `cleanupSuccessful: false`） |
| `teardown-failure-run.json` | 510 | `69694AC312C2CC205B198D3A9E877CC76187AEF5E42074E66665F1FBF0F49B97` | R1 父监督运行记录（`expectedFailureConfirmed: true`, 退出码 0） |
| `run-sdk-boundary.cjs` | 1,889 | `39BA869D52B9038EA33449A624F69F655B05435512EB0D01B5936146F5606347` | R1/R2 SDK 边界正常运行父监督脚本 |
| `sdk-boundary-report.json` | 3,387 | `31417BE47E8F247BA4DDD03E5073708552D624D745E35A477969F128E2FC30FB` | SDK 正常运行详细报告（6 项用例全部通过） |
| `sdk-boundary-run.json` | 288 | `7091847B13D94946247CC9616F53EF7C5735C326FFECF48892AE3763490701BB` | 父监督运行记录（**4,881ms，退出码 0，`passed: true`**） |

---

## 四、交接与收尾说明

1. 本次交付彻底关闭了 Codex 复审提出的 R1 与 R2 负例，Codex 独立复审（5,812ms / 5,571ms / 155ms）及 4 项 VM 确定性控制器回放均已通过，离线诊断探针与边界补验阶段通过并闭合。
2. 保持日常环境完全纯净，未修改生产源码，保留既有 206+ 工作区未提交改动与历史证据目录。
3. 真实实机环境下“加载 23 张图库后首次作者读取失败”的现场首个失败阶段仍未知，不把离线测试通过等同于现场已修复，等待后续安排窄现场取证。
