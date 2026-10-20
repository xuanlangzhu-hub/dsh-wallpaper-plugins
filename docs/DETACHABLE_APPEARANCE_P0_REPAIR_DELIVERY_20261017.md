# 可分离/吸附外观设置 P0 首轮复审补修交付报告

2026-10-17，小G。根据 [首轮复审与补修要求](DETACHABLE_APPEARANCE_P0_REVIEW_20261017.md)，完成了 R1–R6 六组问题的全部补修与测试覆盖，现提交补修交付报告以供复审。

---

## 一、R1–R6 补修要点与实现明细

### R1 [P1] 动作绑定已认证连接能力租约，旧连接与未握手请求立即失效
- **问题根因**：原 `handleCompanionAction` 仅校验公开的 `instanceId`，未对连接能力（lease）、握手状态与代次建立有效性守卫；旧 transport 闭包持有相同 `instanceId`，关闭/吸附后仍能改写状态；`null` 动作在校验前读取属性导致抛出未捕获 TypeError。
- **补修实现**：
  1. 握手认证通过后，由 Bridge 生成唯一的 `leaseId`，并将 `{ leaseId, generation, transport, actionCache, closed: false }` 绑定为当前 `activeSession`。
  2. Transport 注册的 `onAction` 闭包与该 `leaseId` 及当前代次 `generation` 紧密绑定；动作入口先做防御性对象校验（`null`/非对象直接返回受控 `{ ok: false, error: 'action-invalid-object' }`，绝不抛出异常）。
  3. 严格核对 `capability.leaseId === activeSession.leaseId` 且 `capability.generation === activeSession.generation`；任何未握手、旧通道、已关闭租约或错误代次请求均受控拒绝并返回 `{ ok: false, error: 'unauthorized-session-expired' }`。
  4. 吸附、断开、替换或销毁时立即置 `activeSession.closed = true` 并清空引用。

### R2 [P1] 异步弹出/吸附代次与资源所有权，串行化互斥与清理失败透传
- **问题根因**：`requestDock` 与 `requestDetach` 缺乏状态机互斥与代次所有权，导致旧窗口异步 `close` 期间启动新 detach 会被旧 close 完成时的回调回退为 docked 并丢失新 Token；旧 disconnect 迟到会取消新一轮；`adapter.close` 抛错被吞掉仍报成功；`dispose` 期间完成的 spawn 产生孤儿且未捕获异步拒绝；启动 spec 缺 `--user-data-dir`。
- **补修实现**：
  1. **互斥锁与代次串行化**：引入 `executeTransition` 队列互斥锁，所有 `requestDetach` 与 `requestDock` 严格串行执行；每轮操作递增 `currentGeneration`。
  2. **异步完成代次校验**：`spawn` 或 `close` 返回后核对 `currentGeneration === targetGeneration && !disposed`；若在等待期间发生销毁或取消，立即对本轮生成的资源执行定向 `close` 清理并返回 `{ ok: false, error: 'disposed' }`。
  3. **清理异常真实透传**：`windowAdapter.close()` 失败时，捕获异常并返回 `{ ok: false, error: 'window-close-failed: ...', mode }`，不再虚假报告成功。
  4. **旧 disconnect 隔离**：`handleCompanionDisconnect` 校验 `transport === activeSession.transport && disconnectGen === activeSession.generation`，迟到的旧会话断开回调被直接丢弃，不影响新一轮 detaching/detached 状态与 Token。
  5. **强制独立临时 Profile**：`buildEdgeAppLaunchSpec` 强制生成并包含 `--user-data-dir`（默认指向专用的 `whale-companion-profile-${instanceId}`），建立独立进程归属与生命周期边界。
  6. **Safe Dispose**：`dispose()` 清理所有订阅与活动租约，并返回捕获了所有潜在异步拒绝的 Promise，无未处理 rejection。

### R3 [P1] 单调严格 Revision 规则与客户端快照防倒序，会话动作去重
- **问题根因**：原 `expectedRevision < revision - 5` 规则允许落后版本或超前版本写值，缺失/非整数可绕过；客户端对迟到快照无过滤导致快照版本倒退；去重为全局且吞并了失败结果。
- **补修实现**：
  1. **严格版本匹配**：动作必须提供正整数 `expectedRevision`，并严格执行 `expectedRevision === currentRevision`；落后版本返回 `{ ok: false, error: 'stale-revision', latestRevision, snapshot }`，未来版本同样受控拒绝，彻底杜绝倒序覆盖。
  2. **客户端单调快照门禁**：`createCompanionClient` 维护 `currentRevision`；收到新快照时，仅当 `newSnapshot.revision > currentRevision` 时才接受并通知 UI；小于或等于当前版本的迟到快照一律丢弃，杜绝倒序回退。
  3. **带指纹与结果的会话去重**：去重缓存作用于当前活动会话（`activeSession.actionCache`），记录 `{ fingerprint, result }`。相同 ID 重复提交时返回原始真实结果（原失败则重试仍为原失败，并附带 `duplicate: true`）；相同 ID 但负载指纹篡改时返回 `{ ok: false, error: 'action-payload-mismatch' }`。

### R4 [P1] 业务拒绝真实透传与异常受控捕获
- **问题根因**：`controller.presets.apply` 返回 `{ ok: false, error: 'preset-missing' }` 时，Bridge 外层错误包装为 `{ ok: true, result: { ok: false, ... } }`；缺少 try/catch 导致控制器异常逃逸。
- **补修实现**：
  1. **统一动作确认协议**：业务操作执行后，若结果中存在 `ok: false`，Bridge 外层直接返回 `{ ok: false, error: res.error || 'operation-failed', details: res, snapshot }`，确保前端与测试直接通过外层 `ok` 明确获知失败。
  2. **控制器异常安全防护**：所有控制器调用全部包裹在 `try / catch` 中，异常统一转化为 `{ ok: false, error: 'controller-error: ...', snapshot }`。
  3. **去重返回真实结果**：去重重试返回最初的完整错误响应对象并标注 `duplicate: true`。

### R5 [P2] 快照稳定性与真实 Controller 契约对齐
- **问题根因**：`client.js` 中 `set` 同值时仍重新分配 `settingsSnapshot` 引用并触发订阅广播，导致循环探针连续回弹；`wallpaper.subscribeStatus` 未被 Bridge 监听；Bridge 校验规则对 `blur`（误为 30，实为 24）、`surface`（误为 0，实为 40）和 `weScene`（误为宽松正则，实为 hex24 位）存在规则漂移。
- **补修实现**：
  1. **有效值变更比对**：在 `client.js` 的 `controller.set` 与 `presets.apply` 中，规范化后通过 `hasChanges` 对比新旧值；同值写入时不重新分配 `settingsSnapshot`，不触发 `notifySettingsListeners()`，彻底消除无谓更新与循环广播；同时保留 `weScene` 意图计数语义，不破坏自动播放取消门禁。
  2. **壁纸播放状态订阅**：Bridge 订阅 `controller.wallpaper.subscribeStatus`，当底层状态转为 `cleanup-failed` 或 `cleanupPending` 时自动递增 `revision` 并广播最新快照。
  3. **规则严格统一**：将规范全部同步到 `src/detachable-contract.js`，`blur` 范围 `[0, 24]`，`surface` 范围 `[40, 100]`，`weScene` 严格限制为 `'lucy'` 或 `/^we-[0-9a-f]{24}$/`。

### R6 [P1] 模块分离解耦、无 Node 依赖与真实 Headless Edge 加载验证
- **问题根因**：原模块顶层 `import { randomUUID } from 'node:crypto'` 导致浏览器环境（DSH Renderer 及 Edge 伴随窗口）无法动态加载；package.json `files` 缺少新文件；前期交付报告中存在未实测的绝对化断言。
- **补修实现**：
  1. **拆分契约模块**：新建 `src/detachable-contract.js`，纯标准 Web ES Module，0 个 Node.js 专属 import。UUID 使用通用 `generateUuid()`（优先使用 `globalThis.crypto.randomUUID()`，并自带 RFC4122 兼容兜底），完全兼容现代浏览器与 Node.js。
  2. **Bridge 模块解耦**：`src/detachable-bridge.js` 统一从 `detachable-contract.js` 导入与重导出，本身亦不含 `node:` 协议头，同样支持浏览器端直接导入。
  3. **包清单与检查更新**：`package.json` 的 `files` 数组正式加入 `src/detachable-contract.js` 与 `src/detachable-bridge.js`；`npm run check` 脚本加入两者的语法检查。
  4. **真实 Headless Edge 浏览器验证**：使用本地 HTTP 服务结合真实 `msedge.exe --headless=new` 执行 CDP 原生动态加载探测：
     - `import('/detachable-contract.js')`：**`{ ok: true }`**
     - `import('/detachable-bridge.js')`：**`{ ok: true }`**
     - 控制器同值写入：`notifications: 0`, `referenceChanged: false`, `boundedSameValueEchoNotifications: 0`
     - 真实控制器边界：`blur: 24`, `surface: 40`, `invalidSceneAccepted: false`。
  5. **文档勘误与断言修正**：
     - 勘误：官方主产品页 `setWindowOpenHandler` 确定 deny，但不扩称所有 WebContentsView 一概如此；Preload 桌面 API 为 `browser.acquire`、`browser.release`、`browser.onOpenRequested`，而非 `browser.open`；`PLATFORM_IPC.open` 仅允许 `usage` 与 `top-up`，而非 `/top_up`。
     - 断言修正：移除“额外30–50MB内存”、“100%界面复用保障”、“完整DPI已成立”等断言，降级为“待实机测量的设计目标”，保持工程严谨性。

---

## 二、测试验证全景

### 1. Codex 复现脚本 12 组缺陷全部修复验证
针对复审报告中的 `reproduce.mjs` 12 组缺陷点，本轮验证结果如下：
| 编号 | 测试用例 | 复审时的缺陷表现 | 补修后的预期与实测结果 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | R1 无握手错 Token 动作 | 返回 ok: true，亮度改写为 90 | **受控拒绝 `ok: false`，亮度保持 70** | 已修复 |
| 2 | R1 旧已关闭通道发送动作 | 返回 ok: true，亮度改写为 100 | **受控拒绝 `ok: false`，亮度保持 70** | 已修复 |
| 3 | R3 落后1版及未来版本动作 | 返回 ok: true，覆盖最新值 110 | **全部拒绝 `stale-revision`，值保持 110** | 已修复 |
| 4 | R4 预设失败外层信封 | 外层 ok: true，内层 ok: false | **外层直接返回 `ok: false`, error: `preset-missing`** | 已修复 |
| 5 | R5 壁纸状态监听 | 状态变更后 Bridge 仍为 playing | **实时同步变更，状态更新为 `cleanup-failed`** | 已修复 |
| 6 | R2 迟到 close 影响新 detach | 迟到 close 将新一轮清为 docked | **过渡互斥串行化，新一轮 detaching 与 Token 完好** | 已修复 |
| 7 | R2 适配器 close 抛错 | 吞掉错误，仍返回 ok: true | **真实透传错误，返回 `ok: false`** | 已修复 |
| 8 | R2 dispose 期间完成 spawn | 返回 ok: true | **检查 disposed 状态，定向清理并返回 `ok: false`**| 已修复 |
| 9 | R2 旧 disconnect 迟到 | 将新一轮 detaching 清为 docked | **代次不匹配，安全忽略，保持 detaching** | 已修复 |
| 10 | R3 客户端快照倒序回退 | 依次收 4、2 后快照退回 2 | **单调门禁丢弃旧版，快照稳定保持在版本 4** | 已修复 |
| 11 | R1 null 动作传入 | 抛出 TypeError 异常 | **安全捕获，返回 `ok: false, error: action-invalid-object`**| 已修复 |
| 12 | R5 规则漂移与独立目录 | 接受 blur 30、surface 0、非法 scene | **全部拦截拒绝；默认 spec 强制包含 `--user-data-dir`** | 已修复 |

### 2. 自动化套件运行汇总
- **语法与静态守卫**：
  - `npm run check`：`exit code 0`，8 个核心模块及 CSS 模版守卫全部通过。
- **P0 离线专项测试**：
  - `npm run test:detachable-p0`：**11/11 项全部通过**（167ms）。
- **Headless Edge 浏览器探针**：
  - 动态 import 模块：`detachable-contract.js` 与 `detachable-bridge.js` 均为 `{ ok: true }`。
  - 同值写入通知：`0` 次，引用未变。
  - 边界截断：`blur` 24，`surface` 40，非法 scene 拦截成功。
- **既有外观回归测试**：
  - `npm run test:appearance`：**570/570 项通过**。
  - `node qa/appearance-regression.mjs --english-suite`：**566/566 项通过**。
  - `node qa/appearance-regression.mjs --scene-selection-only`：**通过**（正对照 1 次，改选 0 次）。
  - `npm run test:check-pairing`：**8/8 项通过**。
  - `npm run test:temp-profile-boundaries`：**11/11 项通过**。

---

## 三、现场状态与交接承诺保持

- **无真实系统窗口与进程干扰**：离线测试全程使用 Mock Window Adapter 与 Headless Edge 独立隔离 Profile（测试后已完全清理），未打开真实用户可见窗口，未操作真实 DSH / WE 运行环境。
- **版本冻结保持**：
  - 用户日常试用继续保持 `0.6.0-rc.34`。
  - 工作区 manifest 与构建资产保持 `0.6.0-rc.30` 冻结。
- **代码变动范围受控**：
  - 新增：[`src/detachable-contract.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-contract.js)
  - 修改：[`src/detachable-bridge.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/detachable-bridge.js)
  - 修改：[`src/client.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/client.js)（同值 set / apply-preset 幂等保护）
  - 修改：[`package.json`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/package.json)（加入 files 与 check 列表）
  - 修改：[`qa/detachable-appearance-p0.test.mjs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/detachable-appearance-p0.test.mjs)（覆盖 R1–R6 边界用例）
- **无 git commit 或 push**，所有改动保留在本地工作区。

---

## 四、后续建议与推进计划

本轮补修已彻底封闭会话授权、异步清理、版本单调性、业务结果穿透、快照稳定性及浏览器加载边界。
待 Codex 复审确认 P0 通过后，建议按如下次序推进 P1：
1. **静态伴随页搭建**：在插件内提供轻量 HTML 页面（`whale-companion.html`），通过标准 ES Module 加载 `detachable-contract.js` 与复用现有外观 CSS/DOM 结构。
2. **弹出/吸附按钮接入**：在 DSH 内的外观设置区增加“弹出为独立窗口”按钮，伴随窗口增加“吸附回侧边”按钮，通过已验证的 Bridge/Client 进行状态驱动。
3. **真实 Edge App 进程托管**：在插件 Host 端实现真正的 `msedge.exe --app=...` 启动、PID 监听与进程销毁，并在用户授权下进行首次端到端桌面短验。
