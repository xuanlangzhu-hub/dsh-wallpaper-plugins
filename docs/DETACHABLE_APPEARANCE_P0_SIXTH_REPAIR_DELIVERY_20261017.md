# 可分离/吸附外观设置P0六审补修交付：H1与H2排队执行前核对闭合

交付日期：2026-10-17。
对应审查依据：[可分离/吸附外观设置P0六审](DETACHABLE_APPEARANCE_P0_SIXTH_REVIEW_20261017.md)。
实现范围：严格限于 H1（主端注销排队执行前代次核对）与 H2（伴随窗口动作排队执行前租约、弹窗代次与版本核对）。G2 权威模式与关闭失败重试保持闭合，不改动已通过的 14 项专项及 11 项双浏览器主流程。

---

## 1. 缺陷定位与修复设计

### H1 [P1, G1余项] 主端 `/api/main/disconnect` 队列出队时注销新注册主端

#### 问题根因
在 `dsh-whale-mist/src/detachable-host.js` 中，`/api/main/disconnect` 入队前通过 `verifyMainRequest` 校验了当前 generation。但当请求进入 `executeTransition` 队列并在出队执行时，原代码直接读取当时的全局 `mainSession` 执行注销清理：
```javascript
// 修复前：直接读取当时的全局 mainSession
if (mainSession) {
  // 注销了刚刚完成注册的新主端 C
}
```
当主端 A 发出 disconnect 后被前序耗时（如 `adapter.spawn`）排队挂起，在此期间若主端 B 尝试并发注册（使 A 进入关闭等待）并随后新主端 C 注册成功（`mainSession.generation = 2`），当 A 的 disconnect 出队时，出队逻辑未校验当前全局 `mainSession` 是否仍是发出该请求的原会话，从而直接注销了新注册的 C，导致 C 意外被踢下线。

#### 修复实施
在 `dsh-whale-mist/src/detachable-host.js` 的 `/api/main/disconnect` 处理中：
1. **捕获发起会话身份**：在入队前捕获 `targetMainGen = mainSession.generation` 和 `targetInstanceId = mainSession.instanceId`。
2. **出队执行前重新核对**：在 `executeTransition` 内部执行任何状态变更前，复核当前主会话：
   ```javascript
   const targetMainGen = mainSession ? mainSession.generation : null;
   const targetInstanceId = mainSession ? mainSession.instanceId : null;
   return await executeTransition(async () => {
     if (!mainSession || mainSession.generation !== targetMainGen || mainSession.instanceId !== targetInstanceId) {
       return {
         status: 409,
         body: { ok: false, error: 'transition-superseded' },
       };
     }
     // 确认为同一主端代次后才执行正常清理与注销
     ...
   });
   ```
3. **隔离效果**：旧 A 的 disconnect 出队后检测到代次不匹配，立即返回 409 / `transition-superseded`，不产生任何会话清理或关闭副作用，新主端 C 保持正常有效连接。

---

### H2 [P1, G3余项] 旧伴随窗口动作出队时关闭新弹窗与版本漂移

#### 问题根因
在 `dsh-whale-mist/src/detachable-host.js` 的 `/api/action` 中，伴随窗口发出的 `REQUEST_DOCK` 和 `CLOSE_WINDOW` 动作：
1. 原出队核对仅检查了主端代次（`mainSession.generation !== capturedGeneration`），没有绑定并核对出队时的伴随端租约 `leaseId` 与弹窗代次 `popupWindowGeneration`。
2. 当窗口 1 请求关闭被挂起排队，主端随后再次执行 detach 成功拉起窗口 2（`popupWindowGeneration` 递增），旧窗口 1 的 `request-dock` 出队执行时，因主端代次未变，误将窗口 2 关闭（产生多余的 `closeCount`）。
3. 排队等待期间若版本发生变化（revision drift），出队时未能根据入队时捕获的版本进行校验拦截。

#### 修复实施
在 `dsh-whale-mist/src/detachable-host.js` 的窗口动作处理逻辑中：
1. **多重代次与租约绑定**：在进入 `executeTransition` 前捕获发起上下文：
   ```javascript
   const capturedMainGen = mainSession ? mainSession.generation : null;
   const capturedPopupGen = popupWindowGeneration;
   const capturedLeaseId = (auth && auth.type === 'companion') ? auth.leaseId : null;
   const capturedExpectedRevision = (typeof payload.expectedRevision === 'number')
     ? payload.expectedRevision
     : null;
   ```
2. **执行前全面校验**：在 `executeTransition` 内部：
   - 校验窗口代次：若 `popupWindowGeneration !== capturedPopupGen`，说明窗口已被后续操作关闭或替换，直接返回 `{ ok: true, status: 'window-already-closed' }`，严禁操作新窗口。
   - 校验租约归属：若伴随端动作对应的租约不是当前活跃租约或弹窗代次不符，返回 `{ ok: false, error: 'session-superseded' }`。
   - 校验版本一致性：若捕获了 `expectedRevision`，在出队实际执行前核对 `currentRevision !== capturedExpectedRevision`，发生漂移则返回 `{ ok: false, error: 'stale-revision' }`。
3. **动作去重缓存绑定**：在 `windowActionCache` 中记录与验证 `cached.leaseId` 和 `cached.popupGeneration`，防止跨会话/跨窗口的重放攻击。

---

## 2. 自动化测试与验证证据

### 专项测试 15 验证设计
在 `dsh-whale-mist/qa/detachable-appearance-p0.test.mjs` 中新增 **Test 15: Sixth Review H1/H2: Queue Boundaries, Stale Disconnect, and Obsolete Window Action Isolation**：
1. **H1 验证**：模拟主端 A 发起 disconnect 并排在模拟闸门后，期间注销 A 并注册新主端 C（generation=2）。释放闸门后，旧 disconnect 出队返回 409 / `transition-superseded`，当前主端 C 保持未断开。
2. **H2 验证**：主端 1 处于 detached，窗口 1 发送 requestDock 进入排队，期间窗口 1 关闭并重新 detach 产生窗口 2（popupWindowGeneration 递增）。释放排队后，旧窗口 1 的 requestDock 出队返回 `window-already-closed`，窗口 2 仍然保持打开状态，`closeCount` 不增加。同时验证排队期间版本发生漂移时，旧版本动作被拦截返回 `stale-revision`。

### 运行证据

#### 1. 语法与模板守卫检查 (`npm run check`)
```
> dsh-whale-mist@0.6.0-rc.30 check
> node --check src/index.js && node --check src/client.js && node --check src/detachable-contract.js && node --check src/detachable-bridge.js && node --check src/detachable-host.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs

css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
```
**退出码：0**

#### 2. P0 专项测试 (`npm run test:detachable-p0`)
```
> dsh-whale-mist@0.6.0-rc.30 test:detachable-p0
> node --test qa/detachable-appearance-p0.test.mjs

✔ 1. Snapshot building and Action Validation schema constraints (R5 schema drift fixed) (2.1764ms)
✔ 2. Single Source of Truth: Dual subscription, confirmed snapshot, and action deduplication (R3 deduplication) (2.2557ms)
✔ 3. Mode Transition (Docked <-> Detached) preserves wallpaper playback with ZERO interruptions (0.6314ms)
✔ 4. Security & Connection Boundaries (R1): Token single-use, capability lease binding, old channel rejection (0.6108ms)
✔ 5. Edge App Launch Spec Generator verifies secure Chromium arguments, mandatory profile, and absence of shell escape (1.3117ms)
✔ 6. Stale & Future Revision Defense & Recovery (R3) (1.0937ms)
✔ 7. Injection & Disallowed Payload Defense: Arbitrary paths, commands, code strings are refused (0.2752ms)
✔ 8. Lifecycle & Concurrency Resilience (R2): Mutex transition serialization, repeat detach, close error visibility, barrier dispose (1.704ms)
✔ 9. Transparent Business Results & Preset Operations (R4): Missing preset or failure returns outer ok: false, dock awaits completion (0.6884ms)
✔ 10. Real Controller Contract & Live Status Subscriptions (R5) (0.5614ms)
✔ 11. Browser Loadability & Zero-Node-Dependency Verification (R6) (8.6502ms)
✔ 12. Loopback HTTP Host & Endpoint Security (R6) (364.5604ms)
✔ 13. Remote Instance & Generation Isolation (F3 Session Probes) (140.0089ms)
✔ 14. Fifth Review G1/G2/G3: Registration Generations, Close Failure Consistency, and Action Schema (404.0368ms)
✔ 15. Sixth Review H1/H2: Queue Boundaries, Stale Disconnect, and Obsolete Window Action Isolation (185.3859ms)
ℹ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1286.3888
```
**测试结果：15/15 全部通过，退出码：0**

#### 3. 真实 Headless Edge 双 Tab 端到端测试 (`node qa/detachable-browser-e2e.mjs`)
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
  "browserProfile": "C:\\Users\\HP\\AppData\\Local\\Temp\\whale-detachable-browser-gcrIPm"
}
```
**测试结果：11 项主流程全部通过，spawnCount=3，closeCount=3，退出码：0**

---

## 3. 修改文件与影响边界

| 文件 | 变更内容 | 影响范围 |
| --- | --- | --- |
| `dsh-whale-mist/src/detachable-host.js` | 补全 H1 主端 disconnect 执行前代次核对；补全 H2 伴随窗口动作执行前 popup 代次、租约及版本核对 | 仅影响 Host 排队状态转换与窗口动作执行路径 |
| `dsh-whale-mist/qa/detachable-appearance-p0.test.mjs` | 新增 Test 15 验证排队出队边界负例 | 仅测试代码 |

- **保护边界**：
  - 日常环境仍保持 `rc.34` 原包，未动任何日常安装或生产数据。
  - P0 代码严禁混入升级兼容包 U1/U2。
  - 未安装/启动/重启真实 DSH 进程，未改动用户 Profile。
