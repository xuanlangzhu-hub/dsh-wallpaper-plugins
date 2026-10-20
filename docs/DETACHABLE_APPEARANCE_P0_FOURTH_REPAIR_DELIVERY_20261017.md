# 可分离/吸附外观设置 P0 四审补修交付报告

2026-10-17，小G。对应复审：[四审复审文档](DETACHABLE_APPEARANCE_P0_FOURTH_REVIEW_20261017.md)；接续：[NEXT_TASK.md](../NEXT_TASK.md)。

---

## 一、交付结论与原则对照

- **结论**：本轮已全面完成 **F1 / F2 / F3** 全部三项核心缺陷的补修与统一。消除平行协议与双重执行器，确立**唯一权威动作执行器**与**唯一窗口所有者**；补齐所有负例验证，真实双浏览器（Headless Microsoft Edge）E2E 与单元测试套件全部通过（13/13 单元测试 + 11/11 浏览器 E2E 检查项）。
- **执行原则保持**：
  1. **不提交、不推送 Git**，工作区变动保持未暂存状态。
  2. **不操作真实 DSH / WE 进程**，用户日常 `rc.34` 试用、5 Profile / 11 字段存储及既有资产保持冻结不变。
  3. **生产路径标明拟接入/待验证**：本轮验证的 loopback HTTP 服务（`createDetachableHttpHost`）为独立 Node.js 宿主服务，`ctx.webServer` 路由挂载、静态页打包及生产注入仍标记为**拟接入/待验证**，不谎称已并入生产插件运行。
  4. **保护清单保持**：180 个受保护的源码、QA、package 与归档文件未受破坏；既有外观回归逐字节一致。

---

## 二、架构拓扑与所有权收敛

```mermaid
flowchart TD
  subgraph BrowserContext1["主渲染端 (Browser Context 1: Main DSH Renderer)"]
    Controller["WhaleAppearanceController\n(唯一业务状态真理源)"]
    MainClient["createMainRendererBridgeClient\n- 权威动作执行器 (executeAuthoritativeAction)\n- 多源状态订阅 (settings, presets, wallpaper)\n- pagehide / 销毁生命周期钩子"]
  end

  subgraph NodeHost["Node.js 宿主 (detachable-host.js)"]
    HostState["唯一窗口所有者 (Window Owner)\n- 互斥过渡队列 (transitionMutex)\n- 模式状态机 (DOCKED / DETACHING / DETACHED / DOCKING)\n- 窗口生命周期 (spawn / close via windowAdapter)\n- 实例与代次隔离 (instanceId / generation)"]
    SSE_Actions["/api/main/actions (长连接通道 / 心跳保活)"]
  end

  subgraph BrowserContext2["独立伴随端 (Browser Context 2: Companion Window)"]
    CompClient["createCompanionClient + createHttpCompanionTransport\n(100% 浏览器原生 Web 代码，零 Node 依赖)"]
  end

  Controller <-->|同步调用| MainClient
  MainClient <-->|SSE 事件推行动作 / HTTP 回执| SSE_Actions
  HostState <-->|HTTP REST / SSE 推送| CompClient
  HostState -->|进程管理 (spawn / close)| BrowserContext2
```

### 1. 唯一动作执行器与冲突规则（F1）
- **统一定义**：在 `detachable-contract.js` 中抽离 `executeAuthoritativeAction`，供本地测试 Bridge 与远端 `createMainRendererBridgeClient` 共同调用，杜绝平行实现。
- **严格版本核对**：强制 `action.expectedRevision === currentRevision`；迟到或超前版本均拒绝，返回 `stale-revision` 并在回执中附带最新快照供伴随端自动吸收自愈。
- **动作去重与载荷指纹**：基于 `clientActionId` 建立指纹哈希（SHA-256 / 结构化指纹）。同 ID 重复请求返回已缓存的原确认结果；同 ID 篡改载荷立即拒绝。
- **预设业务异常透传**：`controller.presets.apply/save/remove` 返回的真实错误（如 `preset-missing`、`storage-failed`）完整透传为外层 `ok: false`，不误报为成功。
- **窗口动作闭环**：`request-dock` 与 `close-window` 由窗口所有者执行，关闭完成后返回真实 `ok: true, mode: 'docked'`，并通过 SSE 同步主端与伴随端。
- **多维度状态订阅**：主端客户端完整监听 `controller.subscribeSettings`、`controller.presets.subscribe` 和 `controller.wallpaper.subscribeStatus`，消除内部二次递增。

### 2. 唯一窗口所有者与资源生命周期（F2）
- **集中管理**：Node.js 宿主服务（`createDetachableHttpHost`）为窗口进程的唯一所有者，所有独立窗口的 `spawn` 与 `close` 均经由 `windowAdapter` 并通过 `transitionMutex` 串行化。
- **幂等弹出**：若窗口处于 `DETACHING` 或 `DETACHED` 状态，重复调用 `requestDetach()` 保持原 `spawnCount` 与句柄不变，返回既有凭据，不重复启动窗口进程。
- **清理全路径收束**：
  1. 伴随端主动调用 `/api/action` 发起 `request-dock` -> 宿主调用 `windowAdapter.close()`，状态转为 `docked`，主端与伴随端均收到同步通知。
  2. 伴随端调用 `/api/disconnect` -> 宿主释放租约并关闭窗口句柄。
  3. 主端页面卸载 / 导航（`pagehide` / `beforeunload`）或主端长连接中断（`res-close` / `req-close`） -> 宿主检测到主端断开，立即终止伴随会话、关闭窗口句柄，并使后续快照读取返回 503。
  4. 宿主停机（`host.stop()`） -> 自动收束所有存活窗口。
- **在途动作受控中断**：主端失联时，遍历其 `pendingActions` 字典，以 `main-instance-disconnected` 显式 reject，不挂起请求，也不漏传给后续新实例。

### 3. 实例代次绑定与会话隔离（F3）
- **无默认认证后门**：移除 `default-main-token` 默认回退；未配置 `mainToken` 时在启动时生成不可预测的安全随机 UUID，杜绝未授权主端接入。
- **实例核对与代次单调递增**：
  - `/api/main/*` 端点严格校验 `instanceId === mainSession.instanceId`，拒绝跨实例串读串写（返回 403）。
  - `/api/connect` 伴随握手校验 `instanceId === activeTokenInstanceId`，若传错 `wrong-instance` 立即以 401 拒绝。
- **新主端连接撤权与重置**：新主端注册成功后，立即终止旧伴随租约（旧 lease 读写返回 401）、清理旧在途请求，并收束旧窗口资源。
- **快照与注销隔离**：旧主端发送的迟到快照或注销请求，因 `instanceId` 不匹配均被 403 拒绝，无法覆盖新主端的数据或导致新主端失联。

---

## 三、修改源码文件与关键改动

| 文件路径 | 关键改动说明 |
| --- | --- |
| `src/detachable-contract.js` | 1. 抽离并在浏览器端导出 `executeAuthoritativeAction`，统一版本校验、指纹去重、业务结果透传与吸附处理。<br>2. `createMainRendererBridgeClient` 接入 `executeAuthoritativeAction`，消除内部 `executeActionLocally`。<br>3. 补齐 `controller.presets.subscribe` 与 `controller.wallpaper.subscribeStatus` 订阅。<br>4. 增加 `pagehide` / `beforeunload` 无 CORS 预检的失联即时通知钩子，并在 `dispose()` 中规范解绑。 |
| `src/detachable-bridge.js` | 1. 引入并委托 `executeAuthoritativeAction` 处理伴随端动作。<br>2. 重新导出 `STANDARD_EDGE_PATHS`、`findEdgeExecutable` 与 `buildEdgeAppLaunchSpec`。 |
| `src/detachable-host.js` | 1. 移除 `default-main-token`，强制使用安全随机 UUID 或显式注入密钥。<br>2. 建立统一窗口状态机（`hostMode`、`transitionMutex`、`activeOwnedHandle`、`performWindowCleanup`）。<br>3. 所有 `/api/main/*` 与 `/api/connect` 端点增加严格 `instanceId` 与代次核对。<br>4. 增加 `terminateCompanionSession` 与 `terminateMainSession`，主端失联时受控清理在途请求。<br>5. 完善心跳探测与多事件连接关闭钩子（`req.on('close')`, `res.on('close')`, `socket.on('close')`）。 |
| `qa/detachable-appearance-p0.test.mjs` | 增加 **Test 13**，直接覆盖 Codex 复审提出的全部 5 项实例代次隔离（F3）负例探针，测试总数达到 13 项。 |
| `qa/detachable-browser-e2e.mjs` | 真实 Headless Edge 双浏览器 E2E 测试脚本，完整覆盖 F1（版本拒绝、去重、预设透传、吸附）、F2（幂等弹出、伴随断开清理、吸附清理、主端失联清理）全量断言。 |

---

## 四、验证结果与原始证据

### 1. 语法与环境检查 (`npm run check`)
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

✔ 1. Snapshot building and Action Validation schema constraints (R5 schema drift fixed) (2.4528ms)
✔ 2. Single Source of Truth: Dual subscription, confirmed snapshot, and action deduplication (R3 deduplication) (2.5009ms)
✔ 3. Mode Transition (Docked <-> Detached) preserves wallpaper playback with ZERO interruptions (0.5523ms)
✔ 4. Security & Connection Boundaries (R1): Token single-use, capability lease binding, old channel rejection (0.8282ms)
✔ 5. Edge App Launch Spec Generator verifies secure Chromium arguments, mandatory profile, and absence of shell escape (0.5373ms)
✔ 6. Stale & Future Revision Defense & Recovery (R3) (2.1827ms)
✔ 7. Injection & Disallowed Payload Defense: Arbitrary paths, commands, code strings are refused (0.2816ms)
✔ 8. Lifecycle & Concurrency Resilience (R2): Mutex transition serialization, repeat detach, close error visibility, barrier dispose (2.0536ms)
✔ 9. Transparent Business Results & Preset Operations (R4): Missing preset or failure returns outer ok: false, dock awaits completion (0.8724ms)
✔ 10. Real Controller Contract & Live Status Subscriptions (R5) (0.4147ms)
✔ 11. Browser Loadability & Zero-Node-Dependency Verification (R6) (10.406ms)
✔ 12. Loopback HTTP Host & Endpoint Security (R6) (390.1578ms)
✔ 13. Remote Instance & Generation Isolation (F3 Session Probes) (138.042ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 735.3092
```
*13/13 项全部通过，退出码：0*。

### 3. 真实 Headless Microsoft Edge 双浏览器 E2E (`node qa/detachable-browser-e2e.mjs`)
在隔离的真实 Headless Edge 双 Tab 环境中，针对真实主渲染端与独立伴随端全链路执行：
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
  "browserProfile": "C:\\Users\\HP\\AppData\\Local\\Temp\\whale-detachable-browser-4duu9T"
}
```
*所有 11 个真实浏览器端到端断言全部通过，`spawnCount === 3` 且 `closeCount === 3`，退出码：0*。

---

## 五、状态同步与下一步

1. **工作区状态**：
   - 生产环境 `rc.34` 试用保持，无任何生产代码受到影响。
   - Git 树保持干净无提交、无暂存、无推送。
2. **文档同步**：
   - 本交付报告已写入 `docs/DETACHABLE_APPEARANCE_P0_FOURTH_REPAIR_DELIVERY_20261017.md`。
   - `NEXT_TASK.md` 与 `docs/PROJECT_STATUS.md` 已同步本次补修结论。
3. **后续建议**：
   - 请 Codex 针对四审补修进行复审（P0 阶段）。
   - 复审通过后，再行推进独立窗口 UI 方向（[预览图壁纸库/详情及作者参数](DETACHABLE_APPEARANCE_UI_DIRECTION_20261017.md)），不扩大非必要的 P1 编码。
