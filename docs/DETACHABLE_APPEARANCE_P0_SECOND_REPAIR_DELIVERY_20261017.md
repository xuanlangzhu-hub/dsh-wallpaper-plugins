# 可分离与吸附外观设置 P0 二审补修交付报告

2026-10-17，小G。根据 [可分离/吸附外观设置 P0 补修复审（二审）](DETACHABLE_APPEARANCE_P0_SECOND_REVIEW_20261017.md)，完成了对 R2、R3、R4、R6 剩余缺陷的逐项补修，补充了独立 Loopback HTTP 假 Host 与端点级安全鉴权，并完成了全量回归与勘误更新。

---

## 一、二审补修逐项对照与实现说明

| 审查项 | 二审缺陷与要求 | 本轮补修实现 | 对应测试 |
| --- | --- | --- | --- |
| **R2 生命周期与并发边界** | 1. 弹出中尚未握手时重复 requestDetach 导致重复 spawn 与 Token 失效<br>2. adapter.close 失败后未阻止新建窗口<br>3. dispose 先于在途 spawn 结束，未能确认退出<br>4. dispose close 失败被吞、重复 dispose 未能等待同一在途清理 | • 在 `requestDetach` 检查 `mode === DETACHED \|\| mode === DETACHING`，去重并复用在途 Token 与 generation，不重复 spawn<br>• 追踪 `unconfirmedCleanup` 与 `lastCleanupError`，关闭失败时阻止新窗口生成（返回 `previous-window-still-open`），保留所属 `ownedHandle`<br>• `dispose` 显式屏障等待 `inFlightOperation`（在途 spawn），随后携带 `ownedHandle` 执行定向 close<br>• `dispose` 失败时显式返回 `{ ok: false, error }`，不谎报 `docked`；多次调用返回同一个 `disposePromise` | `qa/detachable-appearance-p0.test.mjs` 测试 8 |
| **R3 客户端连接与恢复契约** | 1. connect 过程中调用 disconnect，迟到握手成功会错误复活客户端<br>2. connect 期间到达的新快照被一概丢弃，旧握手快照落后<br>3. 收到 `stale-revision` 拒绝后客户端未吸收附带快照，后续动作持续失败 | • `createCompanionClient` 引入 `connectionEpoch`，断开即递增代次，迟到握手结果直接丢弃且不修改 `connected`<br>• 引入统一 `absorbSnapshot` 门禁，连接期间暂存/吸收最新快照，握手完成时不降级覆盖新快照<br>• 在 `client.dispatch` 的拒绝响应中自动吸收权威快照，客户端 revision 自动同步并可在后续操作中直接恢复 | `qa/detachable-appearance-p0.test.mjs` 测试 6 |
| **R4 伴随端吸附/关闭回执** | 伴随端发送 `request-dock` 与 `close-window` 动作未等待 transition 完成，close 抛错时仍提前报 `{ ok: true }`，重复动作缓存提前成功 | • `handleCompanionAction` 针对 `REQUEST_DOCK` 与 `CLOSE_WINDOW` 严格 `await bridge.requestDock()`，等待真实关闭结果<br>• adapter.close 失败时向伴随端回执真实 `{ ok: false, error: ... }`<br>• 捕获操作前的 session 并在动作缓存中记录真实结果（非提前成功） | `qa/detachable-appearance-p0.test.mjs` 测试 9 |
| **R6 假 Host 通信与端点鉴权** | 1. 缺少主 renderer唯一controller → 假 Host → 独立客户端往返<br>2. 缺少端点级 Origin 拒绝、缺认证拒绝、旧租约拒绝与主实例失联禁写证明<br>3. 启动参数需受控、绝对 profile、owned handle 关闭<br>4. 勘误原交付报告中的 API 与未实测表述 | • 新增 `src/detachable-host.js`（Node 端独立 Loopback HTTP 宿主）与 `src/detachable-contract.js` 中的 `createHttpCompanionTransport`（纯浏览器 `fetch`，0 Node 依赖）<br>• 端点级安全：Origin 校验（非白名单 Origin 返回 403 `forbidden-origin`）；Token 一次性消费鉴权（`/api/connect` 校验失败返回 401）；Capability Lease 鉴权（`/api/action` 校验 `X-Whale-Lease`，无效返回 401）；主端断开/注销后返回 503 `main-instance-disconnected`<br>• 适配器使用 owned handle 管理，启动参数包含 `--app` 与独立受控 profile 目录<br>• 已在 [原交付报告](DETACHABLE_APPEARANCE_P0_DELIVERY_20261017.md) 顶部添加显式勘误标记（修正为 `acquire/release/onOpenRequested`、`usage` 与 `top-up`，标明内存与 DPI 为待实测有条件候选） | `qa/detachable-appearance-p0.test.mjs` 测试 11、12 |

---

## 二、测试证据与全量回归命令

### 1. P0 契约与安全综合套件（12/12 全部通过）

执行命令：
```powershell
npm --prefix F:\dsh-wallpaper-plugins\dsh-whale-mist run test:detachable-p0
```

测试输出：
```
> dsh-whale-mist@0.6.0-rc.30 test:detachable-p0
> node --test qa/detachable-appearance-p0.test.mjs

✔ 1. Snapshot building and Action Validation schema constraints (R5 schema drift fixed) (2.9583ms)
✔ 2. Single Source of Truth: Dual subscription, confirmed snapshot, and action deduplication (R3 deduplication) (3.4935ms)
✔ 3. Mode Transition (Docked <-> Detached) preserves wallpaper playback with ZERO interruptions (0.3962ms)
✔ 4. Security & Connection Boundaries (R1): Token single-use, capability lease binding, old channel rejection (0.3682ms)
✔ 5. Edge App Launch Spec Generator verifies secure Chromium arguments, mandatory profile, and absence of shell escape (0.3564ms)
✔ 6. Stale & Future Revision Defense & Recovery (R3) (0.5091ms)
✔ 7. Injection & Disallowed Payload Defense: Arbitrary paths, commands, code strings are refused (0.2468ms)
✔ 8. Lifecycle & Concurrency Resilience (R2): Mutex transition serialization, repeat detach, close error visibility, barrier dispose (2.3496ms)
✔ 9. Transparent Business Results & Preset Operations (R4): Missing preset or failure returns outer ok: false, dock awaits completion (0.5649ms)
✔ 10. Real Controller Contract & Live Status Subscriptions (R5) (0.2541ms)
✔ 11. Browser Loadability & Zero-Node-Dependency Verification (R6) (10.4805ms)
✔ 12. Loopback HTTP Host & Endpoint Security (R6) (107.8798ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 315.6355
```

### 2. 代码静态与语法检查

```powershell
npm --prefix F:\dsh-wallpaper-plugins\dsh-whale-mist run check
```
结果：退出码 0，全模块静态检查通过，CSS 模板守卫无异常。

### 3. 全量外观功能与多语言回归

| 测试套件 | 命令 | 检查项 / 结果 |
| --- | --- | --- |
| 外观全量回归 | `npm run test:appearance` | 570 项通过，退出码 0 |
| 英文外观套件 | `node qa/appearance-regression.mjs --english-suite` | 566 项通过，退出码 0 |
| 场景选择正反例 | `npm run test:appearance-selection` | 正对照启动 1 次，改选 0 次，退出码 0 |
| 时钟与时序配对 | `npm run test:check-pairing` | 8/8 通过，退出码 0 |
| 临时 Profile 目录边界 | `npm run test:temp-profile-boundaries` | 11/11 通过，退出码 0 |

---

## 三、真实边界与待验项清单（不提前宣布“彻底闭合”）

对照二审要求，明确当前已交付接缝与后续真实环境的界限：
1. **本轮为离线协议与假 Host 鉴权验证**：已实现真实 Loopback HTTP 通信与端点级鉴权（Origin/Token/Lease/503），但**未启动真实 Edge 操作系统窗口**，未测试多屏拖拽与 DPI 真实物理渲染。
2. **内存与系统开销待真机实测**：报告中 Edge 伴随窗口的内存（预估 30–50MB）与任务栏图标归属仍作为“有条件候选”，待后续实装阶段在 Windows 真机下取证。
3. **主界面与 React 视图待后续阶段实装**：当前验证了 Controller、Bridge、假 Host 与纯浏览器 Client 的契约接缝；主端 `shell.overlay` 吸附面板与伴随窗口内部的完整 React 界面尚待推进。

---

## 四、现场保护状态

- 日常使用的 `0.6.0-rc.34` 保持未修改，无任何写入。
- 本地开发工作区 manifest 与 assets 保持冻结在 `0.6.0-rc.30`。
- 未进行 git commit，未进行 git push。
- 未操作真实 DSH/WE 运行时进程。
- 未向其他会话发送消息。
