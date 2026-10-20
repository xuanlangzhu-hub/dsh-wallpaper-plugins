# 可分离与吸附外观设置 P0 三审补修交付报告

2026-10-17，小G。根据 [可分离/吸附外观设置 P0 三审报告](DETACHABLE_APPEARANCE_P0_THIRD_REVIEW_20261017.md)，完成了对 R2（迟到资源清理与窗口所有权边界）、R6-A（HTTP 双向即时推送与会话注销）、R6-B（端点安全、Origin 门禁与 JSON 健壮性）以及 R6-C（三方架构与独立真实浏览器 E2E 验证）的针对性补修与实测。

---

## 一、三审缺陷与补修实现对照

| 审查项 | 三审缺陷与要求 | 本轮补修实现 | 对应验证证据 |
| --- | --- | --- | --- |
| **R2 迟到资源清理与所有权生命周期** | 1. 迟到 spawn 成功后 close 抛错被吞，dispose 调用 close(null) 误报成功，丢句柄且 unconfirmedCleanup 为 false<br>2. transport 断开直接置 docked，未关闭窗口且 activeOwnedHandle 残留，导致二次 spawn 覆盖旧窗口 | • `windowAdapter.spawn` 成功时立即登记所有权 `activeOwnedHandle = handle`；取消/卸载分支若 close 抛错，保留句柄并标记 `unconfirmedCleanup = true`；`dispose` 显式检测取消分支失败，返回真实 `{ ok: false, error: ... }`，不调用 `close(null)`<br>• transport 断开时独立撤销写权限（清空 `activeSession`），并通过 transition 调度 `windowAdapter.close(activeOwnedHandle)`；若关闭失败或未知，进入 `unconfirmedCleanup` 门禁，阻止后续 `requestDetach` | `qa/detachable-appearance-p0.test.mjs` 测试 8；独立探针 Case 1、Case 2 通过 |
| **R6-A HTTP 双向推送与会话生命周期** | 1. HTTP 握手后主端改值未推送到伴随端，缺少实时同步链路<br>2. 伴随端断开后未注销租约，持旧 lease 仍能写入<br>3. 主端 dispose 后，伴随端虽收到 503 但客户端仍保持 isConnected=true | • 在 Node Host 建立 Server-Sent Events (SSE) 事件通道 `/api/events`；主端改值通过 `sendSnapshot` 实时推送至伴随端，伴随端 `onSnapshot` 自动吸收更新<br>• 伴随端 `close()` 时向 Host 发送 `POST /api/disconnect`，Host 立即注销 `activeSession` 并关闭 SSE，旧 lease 立即失效，重放操作返回 401<br>• 伴随客户端在收到 503 或 SSE 断开时，自动置 `connected = false` 并禁用派发 | `qa/detachable-appearance-p0.test.mjs` 测试 12；`qa/detachable-browser-e2e.mjs` 测试 1、3、4 |
| **R6-B 端点安全防御与健壮性** | 1. `/api/snapshot` 缺少凭据要求，跨端口本地 origin 可任意读取<br>2. POST `/api/connect` 传入合法 JSON `null` 触发未处理 Promise rejection<br>3. 允许任意 host 监听，端口占用未处理，缺乏体积限制，使用了 `Math.random` 降级 | • `/api/snapshot` 强制要求校验 `X-Whale-Lease`（未认证返回 401）；Origin 严格按配置的 `allowedOrigins` 精确匹配，非法 Origin 返回 403，禁用 `*` 通配<br>• 请求体解析加入 64KB 上限与 JSON 结构守卫，`null` 或非对象结构受控返回 400 Bad Request，彻底消除未处理 rejection<br>• 强制锁定 `127.0.0.1` 监听，端口冲突通过 `server.once('error')` 受控拒绝；Token 与 Lease 强制使用 `crypto.randomUUID()`，彻底移除 `Math.random` | `qa/detachable-appearance-p0.test.mjs` 测试 12；独立探针 Case 4、Case 7 通过 |
| **R6-C 三方架构与浏览器 E2E 验证** | 缺乏主 Renderer 实际 Controller → Node 假 Host → 独立伴随端浏览器的真实端到端证明，未写明在正式 DSH `0.2.0-rc.2` 下的接缝路径 | • 实现三方架构：主端在浏览器独立上下文运行实际 Controller 与 `createMainRendererBridgeClient`；Node 担任独立 Host 运行 `createDetachableHttpHost` 与窗口适配器；伴随端在另一独立浏览器窗口运行 `createCompanionClient`<br>• 新增 `qa/detachable-browser-e2e.mjs`，通过真实 headless Edge 双 Tab 实测全链路双向往返<br>• 明确正式 DSH 接缝：Node Host 挂载于 `ctx.webServer`（路由 `/api/whale-companion/*`）；Main Renderer 注入 Controller 并与 Loopback 接口通信 | `qa/detachable-browser-e2e.mjs` 全部通过 |

---

## 二、测试证据与真实性界定

为避免“用测试数量代替实际效果”，明确标注各项验证的具体环境：

### 1. 真实 Headless Microsoft Edge E2E 验证（真实浏览器多上下文）

运行命令：
```powershell
node qa/detachable-browser-e2e.mjs
```

测试输出：
```json
{
  "status": "PASSED",
  "tests": [
    "Main Renderer (Browser Context 1) initialized real controller",
    "Companion Window (Browser Context 2) connected via loopback HTTP",
    "Live snapshot update from Main to Companion over SSE verified",
    "Action dispatch from Companion to Main controller verified",
    "Old lease rejected after companion disconnect (401) verified",
    "Main disconnect returns 503 verified"
  ],
  "spawnCount": 1,
  "closeCount": 0,
  "browserProfile": "C:\\Users\\HP\\AppData\\Local\\Temp\\whale-detachable-browser-Z3srpa"
}
```
**实测确认**：
- **Browser Context 1**：真实加载 `src/client.js` 与 `qa/appearance-harness.js`，运行真正的 `WhaleAppearanceController`。
- **Browser Context 2**：真实加载 `src/detachable-contract.js`，纯 Web 环境，零 Node 依赖。
- **Node.js Host**：运行 `createDetachableHttpHost`，在 `127.0.0.1` 动态端口监听，处理 Origin 鉴权与 Lease 校验。
- 主端在 Tab 1 修改亮度为 110，Tab 2 经真实 SSE 推送更新至 110；伴随端在 Tab 2 派发 84，Tab 1 实际 Controller 接收并应用为 84；Tab 2 断开后，旧 Lease 被 Host 拒收（401）；Tab 1 注销后，Tab 2 禁写并显示断开。

### 2. P0 综合契约单元与集成套件（12/12 通过）

运行命令：
```powershell
npm run test:detachable-p0
```

包含新增的迟到 spawn 句柄保留检查、transport 断开窗口清理检查、JSON `null` 守卫、未授权 snapshot 读取拦截（401/403）、SSE 实时推送与断开撤权（401）等用例，全部通过。

### 3. 代码静态检查与全量外观回归

- `npm run check`：退出码 0，全模块静态检查通过，CSS 模板守卫无异常。
- `npm run test:appearance-selection`：正对照 1 次，改选 0 次，退出码 0。
- `npm run test:check-pairing`：8/8 通过，退出码 0。
- `npm run test:temp-profile-boundaries`：11/11 通过，退出码 0。

---

## 三、正式 DSH `0.2.0-rc.2` 接缝与路由映射说明

对照三审要求，明确正式 DSH 运行时的各方职责与加载路径：
1. **Node Plugin Host (`src/index.js`)**：
   - 在插件主入口通过 `ctx.webServer` 注册伴随服务路由（如 `/api/whale-companion/*`）。
   - 托管静态伴随页面 `assets/whale-companion.html`。
   - 负责生成安全启动参数（受控 exe、`shell: false`、绝对 Profile 目录）并调用子进程启动伴随窗口。
2. **Main Renderer (`src/client.js`)**：
   - 由 DSH 客户端机制注入主界面，运行单例 `createWhaleAppearanceController`。
   - 通过 `createMainRendererBridgeClient` 连接 Node Host 的 Loopback 接口，监听伴随动作并推 authoritative 快照。
3. **Companion Window (Edge `--app` 模式)**：
   - 加载 `http://127.0.0.1:<port>/assets/whale-companion.html?token=<token>&instance=<instance>`。
   - 仅包含轻量 UI 与 `createCompanionClient`，不加载第二套存储、壁纸播放或主题注入。

---

## 四、真实边界与待验项说明（不提前宣布“全部闭合”）

1. **操作系统级物理窗口待实装**：本轮已在真实 Headless Edge 中验证了多上下文与 Loopback HTTP/SSE 往返，但**未启动可见的真机独立 OS 窗口**，未进行物理多显示器拖拽。
2. **系统资源消耗待实机测试**：Edge App 模式的实际内存与任务栏行为仍保留为有条件候选方案，待授权实机阶段实测。
3. **React 完整面板 UI 待 P1 推进**：本轮完成了全套通信、安全与生命周期接缝，UI 界面按三审要求暂不扩展，待 P0 验收后再行推进。

---

## 五、现场保护状态

- 日常使用的 `0.6.0-rc.34` 保持未修改，无任何写入。
- 本地开发工作区 manifest 与 assets 保持冻结在 `0.6.0-rc.30`。
- 未进行 git commit，未进行 git push。
- 未操作真实 DSH/WE 运行时进程。
- 未向其他会话发送消息。
