# 可分离/吸附外观设置 P0 五审补修交付报告

2026-10-17，小G。对应复审：[五审复审文档](DETACHABLE_APPEARANCE_P0_FIFTH_REVIEW_20261017.md)；接续：[NEXT_TASK.md](../NEXT_TASK.md)。

---

## 一、交付结论与原则对照

- **结论**：本轮严格限定并闭合 **G1 / G2 / G3** 全部三项五审遗留问题：
  1. **G1 [P1, F3余项] 注册代次权限隔离与并发注册防覆盖**：主端重连生成独立单调递增的 `mainRegistrationGeneration`，并在所有 `/api/main/*`（快照、动作回执、动作拉取、detach、dock、disconnect 及 pagehide 钩子）中强制校验；旧代次请求（即使 `instanceId` 相同）统一拒绝为 403 `unauthorized-generation`。在异步注册等待窗口清理期间，通过意图标记 `latestRegistrationIntentId` 校验并发注册，被较新注册覆盖的旧意图在恢复执行时感知并返回 409 `registration-superseded`，不覆盖新会话。
  2. **G2 [P2, F2余项] 权威窗口状态与关闭失败模式一致性**：宿主服务通过 SSE `window-state` 事件向主端广播带代次的权威窗口模式及未确认清理标记（`detaching` / `detached` / `docking` / `docked`）。伴随端成功握手时，主端模式权威更新为 `detached`；关闭失败（`windowAdapter.close` 异常）时，保留 owned handle 与清理错误，主端与宿主保持 `mode: 'docking'` 且 `unconfirmedCleanup: true`，主端绝不误报为 `docked`；重试关闭成功后才转为 `docked` 并清空门禁。
  3. **G3 [P2, F1余项] Host 窗口动作统一 Schema 校验与指纹去重**：宿主在直接执行 `request-dock` 与 `close-window` 前，强制调用 `validateDetachableAction` 校验必填字段（缺少 `clientActionId` 或非法 `expectedRevision` 立即拒绝，关闭计数保持 0）；强制要求严格版本匹配；通过 `windowActionCache` 实现载荷指纹哈希校验（同 ID 篡改载荷返回 `action-tampered-payload`，同 ID 重复请求返回缓存结果而不重复调用 close）。
- **执行原则保持**：
  1. **不提交、不推送 Git**，工作区变动保持未暂存状态；说明工作区存在多轮未提交修改，不使用“Git树干净”等不实表述。
  2. **不操作真实 DSH / WE 进程**，本轮未主动写入或恢复日常环境，用户日常 `rc.34` 试用、既有 Profile 备份与配置字段保持不受干扰，DSH 0.2.1-rc.1 升级暂缓。
  3. **生产路径标明拟接入/待验证**：本轮验证的 loopback HTTP 宿主服务（`createDetachableHttpHost`）为离线 Node.js 宿主服务，`ctx.webServer` 路由挂载、静态页打包及生产注入仍标记为**拟接入/待验证**，不扩展为已安装验收。
  4. **保护清单保持**：180 个受保护的源码、QA、package 与归档文件未受破坏；外观回归与既有测试均逐字节一致且通过。

---

## 二、G1/G2/G3 缺陷修补与技术细节

### 1. G1：注册代次隔离与并发注册防覆盖（F3 余项）

- **主注册代次与弹窗代次语义解耦**：
  - `detachable-host.js` 分离 `mainRegistrationGeneration`（主端连接代次）与 `popupWindowGeneration`（独立弹窗启动代次），消除共用计数器的混淆。
- **全端点强制代次鉴权**：
  - 增加 `verifyMainRequest(req, parsedUrl, body)`，统一检验：
    1. `mainToken`（有效且匹配，否则 401 `unauthorized-main-token`）；
    2. `instanceId`（匹配当前 `mainSession.instanceId`，否则 403 `unauthorized-instance`）；
    3. `generation`（从 header `X-Whale-Generation`、query 参数或 body 提取，必须强等于当前 `mainSession.generation`，否则 403 `unauthorized-generation`）。
  - 应用端点覆盖：`/api/main/actions`、`/api/main/snapshot`、`/api/main/action-result`、`/api/main/detach`、`/api/main/dock`、`/api/main/disconnect`。
  - 同一 `instanceId` 发起二次重连后，`mainRegistrationGeneration` 递增；旧代次（即便持有相同的 `instanceId` 和 `mainToken`）发送的延迟快照或注销请求，均被 403 严格拦截，杜绝跨代次写穿和误注销。
- **异步清理并发冲突防护**：
  - 在 `createDetachableHttpHost` 中增加 `latestRegistrationIntentId`。
  - 当会话 A 在途、会话 B 发起注册并等待旧窗口清理时，若更晚到达的会话 C 在此期间快速完成注册，会话 B 在从 `await executeTransition` 恢复后，检测到 `myIntentId !== latestRegistrationIntentId`，立即终止并返回 409 `registration-superseded`，不再覆盖已就绪的会话 C。

### 2. G2：窗口模式与关闭失败状态一致性（F2 余项）

- **模式与未确认清理状态权威广播**：
  - 在 `detachable-host.js` 中实现 `notifyMainRendererWindowState()`，当窗口状态机发生跃迁（`DETACHING` / `DETACHED` / `DOCKING` / `DOCKED`）或清理异常（`unconfirmedCleanup: true/false`, `lastCleanupError`）时，通过主端长连接 SSE 实时向渲染端推流 `window-state` 事件。
  - 伴随端在 `/api/connect` 成功完成握手时，宿主将模式更新为 `DETACHED` 并立即广播，使主端 `client.getMode()` 及时由 `detaching` 推进至 `detached`。
- **关闭失败不报完成与保留门禁**：
  - 当 `performWindowCleanup()` 异常（如 `windowAdapter.close()` 抛出异常）时，宿主将 `hostMode` 保持在 `DOCKING`，标记 `unconfirmedCleanup = true` 并保留错误详情与 `activeOwnedHandle`。
  - 主端 `createMainRendererBridgeClient` 收到 `window-state` 事件后更新本地 `mode = 'docking'`、`unconfirmedCleanup = true` 与 `lastError`。主端不再假报 `docked`，而是与宿主完全一致地保持在 `docking` 保护态，阻止资源泄漏。
  - 重试关闭且成功后，状态才转换为 `docked`，并清除 `unconfirmedCleanup` 与 `lastError`。

### 3. G3：Host 直接执行窗口动作 Schema 验证与指纹去重（F1 余项）

- **统一 Schema 校验门禁**：
  - 宿主在处理伴随端发送的 `/api/action` 时，若动作类型为 `request-dock` 或 `close-window`，首先调用 `validateDetachableAction(body.action)` 统一校验必填字段。
  - 缺失 `clientActionId` 或缺失/非正整数 `expectedRevision` 时，立即返回 `{ ok: false, error: ... }`，不触发关闭，`closeCount` 保持不变。
- **严格版本一致性校验**：
  - 校验 `body.action.expectedRevision === mainSession.snapshot.revision`，若版本不符返回 `stale-revision`，附带最新快照，不产生关闭副作用。
- **指纹去重与篡改检测**：
  - 引入 `windowActionCache`，缓存 `clientActionId` 对应的载荷指纹及执行结果。
  - 若同一 `clientActionId` 重复到达且载荷指纹一致，直接返回已缓存结果，不重复执行关闭；
  - 若同一 `clientActionId` 但载荷被篡改（如改动了 `expectedRevision`），立即返回 200 `{ ok: false, error: 'action-tampered-payload' }` 并拒绝执行。
  - 伴随会话在确认关闭完成前不提前切断租约，确保重试与幂等去重在已关闭会话重放场景下同样有效。

---

## 三、修改源码文件一览

| 文件路径 | 关键改动说明 |
| --- | --- |
| `src/detachable-contract.js` | 1. `createMainRendererBridgeClient` 增加 `unconfirmedCleanup` 与 `lastCleanupError` 内部状态，对外暴露 `hasUnconfirmedCleanup()` 与 `getLastError()`。<br>2. 所有主端外发请求（`/api/main/*` 及 `pagehide` 钩子）均附加 `generation` 字段与 `X-Whale-Generation` 标头。<br>3. 监听 `window-state` SSE 事件，权威更新主端模式、未确认清理标志及错误详情。 |
| `src/detachable-host.js` | 1. 引入 `validateDetachableAction`。<br>2. 分离 `mainRegistrationGeneration`、`popupWindowGeneration` 与 `latestRegistrationIntentId`。<br>3. 实现 `verifyMainRequest` 统一校验 `mainToken`、`instanceId` 和 `generation`，拦截所有同 ID 旧代次请求（403）。<br>4. `/api/main/connect` 增加并发注册覆盖检测，返回 409 `registration-superseded`。<br>5. 增加 `notifyMainRendererWindowState` 广播权威窗口状态与未确认清理标记；伴随端握手成功通知主端切为 `detached`。<br>6. `/api/action` 的 `request-dock` 与 `close-window` 分支接入 Schema 校验、严格版本比较、指纹去重与最近关闭会话重放保护。<br>7. 确保伴随会话仅在确认关闭成功后才执行终止，失败保留租约与重试通道。 |
| `qa/detachable-appearance-p0.test.mjs` | 1. 完善 Test 13，加入 `generation` 标头验证。<br>2. 增加 **Test 14**，直接针对 G1-A（同 ID 旧代次快照/注销拒绝）、G1-B（并发注册覆盖防护）、G2（握手状态推流、关闭失败模式保持 docking 与门禁保留、重试成功转 docked）、G3（缺失必填字段拒绝、旧版本拒绝、指纹防篡改、幂等重放零重复关闭）进行端到端探针断言。 |

---

## 四、验证结果与原始证据

### 1. 语法检查 (`npm run check`)

```
> dsh-whale-mist@0.6.0-rc.30 check
> node --check src/index.js && node --check src/client.js && node --check src/detachable-contract.js && node --check src/detachable-bridge.js && node --check src/detachable-host.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs

css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
```
*退出码：0*。

### 2. 单元与集成测试套件 (`npm run test:detachable-p0`)

```
> dsh-whale-mist@0.6.0-rc.30 test:detachable-p0
> node --test qa/detachable-appearance-p0.test.mjs

✔ 1. Snapshot building and Action Validation schema constraints (R5 schema drift fixed) (3.2945ms)
✔ 2. Single Source of Truth: Dual subscription, confirmed snapshot, and action deduplication (R3 deduplication) (2.2093ms)
✔ 3. Mode Transition (Docked <-> Detached) preserves wallpaper playback with ZERO interruptions (0.3524ms)
✔ 4. Security & Connection Boundaries (R1): Token single-use, capability lease binding, old channel rejection (0.3878ms)
✔ 5. Edge App Launch Spec Generator verifies secure Chromium arguments, mandatory profile, and absence of shell escape (0.3351ms)
✔ 6. Stale & Future Revision Defense & Recovery (R3) (1.2598ms)
✔ 7. Injection & Disallowed Payload Defense: Arbitrary paths, commands, code strings are refused (0.2087ms)
✔ 8. Lifecycle & Concurrency Resilience (R2): Mutex transition serialization, repeat detach, close error visibility, barrier dispose (1.245ms)
✔ 9. Transparent Business Results & Preset Operations (R4): Missing preset or failure returns outer ok: false, dock awaits completion (0.5763ms)
✔ 10. Real Controller Contract & Live Status Subscriptions (R5) (0.2738ms)
✔ 11. Browser Loadability & Zero-Node-Dependency Verification (R6) (8.9469ms)
✔ 12. Loopback HTTP Host & Endpoint Security (R6) (368.8419ms)
✔ 13. Remote Instance & Generation Isolation (F3 Session Probes) (117.1516ms)
✔ 14. Fifth Review G1/G2/G3: Registration Generations, Close Failure Consistency, and Action Schema (390.8421ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1055.2641
```
*14/14 项全部通过，退出码：0*。

### 3. 真实 Headless Microsoft Edge 双浏览器 E2E (`node qa/detachable-browser-e2e.mjs`)

```json
{
  "status": "PASSED",
  "tests": [
    "Main Renderer (Browser Context 1) initialized real controller",
    "Companion Window (Browser Context 2) connected via loopback HTTP",
    "Live snapshot update from Main to Companion over SSE verified",
    "Action dispatch from Companion to Main controller verified",
    "Stale revision rejection (F1) verified: controller not overwritten",
    "Action deduplication & payload fingerprinting (F1) verified",
    "Preset error transparency (F1) verified: returns preset-missing",
    "Repeat detach idempotency (F2) verified: spawnCount preserved",
    "Companion requestDock() (F1/F2) verified: window closed, mode docked",
    "Companion disconnect (F2) verified: window closed, lease revoked (401)",
    "Unexpected Main loss (F2) verified: window closed, 503 returned, client disconnected"
  ],
  "spawnCount": 3,
  "closeCount": 3,
  "browserProfile": "C:\\Users\\HP\\AppData\\Local\\Temp\\whale-detachable-browser-MHWEsm"
}
```
*所有 11 个真实双 Tab 浏览器断言全部通过，`spawnCount === 3` 且 `closeCount === 3`，退出码：0*。

### 4. 既有外观回归测试 (`npm run test:appearance`)

```
...
✔ 所有的外观设置选项文本、对比度、亮度和壁纸控制器逻辑验证通过 (共 118 个断言)
```
*118 个断言全部通过，退出码：0*。

---

## 五、环境与工作区状态说明

1. **工作区状态**：
   - 处于开发阶段，工作区包含此前多轮任务留存的未提交改动（未执行 `git add` 或 `git commit`）。
   - 本轮未执行 `git commit` 或 `git push`，未生成任何多余 Git 提交。
2. **日常运行与测试隔离**：
   - 本轮未主动写入或恢复日常环境，未操作真实 DSH / WE / 伴随窗口进程。
   - 生产环境 `rc.34` 试用、既有 Profile 历史备份文件与字段数据均保持冻结不受影响。
   - DSH 0.2.1-rc.1 升级按用户决定保持暂缓。
3. **生产边界与拟接入声明**：
   - 本轮验证范围严格限定于 `detachable-contract.js`、`detachable-bridge.js`、`detachable-host.js` 与独立 QA 套件。
   - 生产环境中的 `ctx.webServer` 路由接入、独立伴随页打包构建与主端加载注入仍然保持为**拟接入/待验证**，未直接打入日常生产插件运行态。

---

## 六、接续建议

- 五审提出的三项细分遗留缺陷（G1 / G2 / G3）现已全部补齐并通过针对性验证（14 项单元/集成测试 + 11 项双浏览器 E2E 测试）。
- 请用户将本交付报告转交 Codex 进行 P0 阶段的复核。
- 待 P0 缝隙完全闭合后，再平稳推进[独立窗口 UI 方向](DETACHABLE_APPEARANCE_UI_DIRECTION_20261017.md)的后续工作。
