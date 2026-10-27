# rc.51 target.unverified 接缝离线补验交付：R1–R3 修补完成与证据闭环

日期：2026-10-27\
交付方：Gemini\
任务与复审来源：`docs/RC51_TARGET_UNVERIFIED_GEMINI_REVIEW_20261027.md`、`docs/RC51_TARGET_UNVERIFIED_GEMINI_TASK_20261027.md`\
交付目录（排他输出）：`F:\dsh-wallpaper-plugins\.tmp\rc51-gemini-target-unverified-repair-20261027-a/`\

---

## 1. 交付概况与核验结果

根据 Codex 独立复审意见，本轮交付针对前次交付中存在的调用点缺口（R1）、查询函数边界（R2）及替身清理漏判（R3）进行了针对性补修与证据闭环：
- **输入指纹核对**：通过 `verify-inputs.mjs` / `run-verify-inputs.cjs` 验证 handoff 提供的全部 13 项冻结输入，SHA-256 逐项匹配（退出 0）。
- **R1 自动读取因果链补足**：生成合法 24 字节 WHL1 帧头与有效图像包，通过 `FrameDecoder` 解析并进入 `FrameHub`（`hub.received === 1`, `hub.latest !== null`）；连接渲染器事件推进至 `playing` 并触发 `AuthorSwitches` 自动读取；追加无帧反事实对照，确证无帧不触发自动读取；从候选 `index.js` 源码文本中直接正则提取 `readTarget` 与 `readWallpaperLifecycle` 闭包并使用；更正 `session.create` 参数结构为 `{ scene: { sceneId: 'lucy', project, mode: 'daily' } }`。
- **R2 默认查询边界覆盖**：移除 `queryProcessIdentity` 高层钩子，替换底层 `execCommand` IO 替身，走通默认 `queryWindowsProcessCreationUtc` 解析与验证逻辑；完成错误回调导致 `windowStartUtc: null`（红例）与合法 PID/ISO 响应（绿例）对照，明确标明“execCommand 错误回调替身，真实定时超时未验”。
- **R3 替身收尾协议与失败门禁**：为 `MockCaptureChild` 与 `helperRun` 提供完整终结协议（`--window-ensure-closed` 返回 `{ outcome: 'closed', closed: true }`，`stdin.end()` 触发 close），断言 `session.isClosed() === true` 与 `stopRes.closed === true`，并将收尾成功纳入用例最终 `passed` 判定；使用同一脚本进行收尾故障注入，子测试确切返回退出码 1 与 `passed: false`，父监督器确认预期故障后退出 0。

### 监督执行证据汇总

| 脚本 / 验证项 | 运行时间 | 子进程退出码 | 父监督退出码 | 关键判定 | 证据文件 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **输入哈希校验** `run-verify-inputs.cjs` | 15ms | 0 | 0 | 13/13 项匹配 | `input-hashes.json` |
| **正常修补测试** `run-reproduce-normal.cjs` | 418ms | 0 | 0 | 7/7 项通过，清理全部成功 | `target-unverified-normal-run.json`<br>`target-unverified-repair-report.json` |
| **收尾故障注入** `run-reproduce-teardown-failure.cjs` | 425ms | 1 | 0 | 预期失败确认（门禁拦截有效） | `target-unverified-teardown-failure-run.json` |

---

## 2. R1 修复详情：调用点真实化与因果链闭环

### 2.1 session.create 参数签名与 mode 校验
前次调用将 `mode` 放置于顶层参数，导致被解构丢弃，session 默认降级为 `preview`。\
本次修正为实际签名结构：
```javascript
await session.create({
  scene: {
    sceneId: 'lucy',
    project: 'E:/SteamLibrary/steamapps/workshop/content/431960/3521337568/project.json',
    mode: 'daily'
  },
  helper: join(unpackedDir, 'assets/wallpaper/WallpaperProbe.exe'),
  fps: 30,
  width: 1920,
  height: 1080
});
assert.equal(session.state().config.mode, 'daily');
assert.equal(session.state().config.sceneId, 'lucy');
```

### 2.2 协议合法 24 字节 WHL1 帧生成与 FrameHub 验收
前次脚本仅发送 10 字节 JPEG 前缀，未满足 `FrameDecoder` 的 24 字节头要求。本次实现协议级合法帧构建：
```javascript
function createValidWhl1Packet(sequence = 1, width = 1920, height = 1080) {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9]);
  const header = Buffer.alloc(24);
  header.writeUInt32BE(0x57484c31, 0); // WHL1
  header.writeUInt32LE(sequence, 4);   // 序列号
  header.writeUInt32LE(jpeg.length, 8); // 载荷长度
  header.writeBigInt64LE(BigInt(Date.now()), 12); // 时间戳
  header.writeUInt16LE(width, 20);     // 宽度
  header.writeUInt16LE(height, 22);    // 高度
  return Buffer.concat([header, jpeg]);
}
```
运行断言确证：
- `session.hub.received === 1`
- `session.hub.latest !== null`
- `session.hub.latest.sequence === 1`

### 2.3 渲染器状态推进与 AuthorSwitches 自动触发接缝
不再人工调用 `await author.ensureLoaded()` 冒充触发，而是连接实际事件接缝：
1. `session.hub` 收到有效帧后发出 `'frame'` 事件；
2. 客户端接缝监听到帧后将状态切至 `state = 'playing'`；
3. 对应 `client.js:9044` 与 `8866` 中 `AuthorSwitches` 组件由 `autoEligible: view.state === 'playing'` 触发的 `useEffect`，自动调用 `author.ensureLoaded()`；
4. 设立独立反事实用例（Case 3）：在不发射帧的情况下，Hub 接收 0 帧，渲染器保持 `starting`，`autoReadTriggered === false`，控制器 `phase` 保持 `idle`。确证帧到达是自动读取触发的充分必要因果源。

### 2.4 index.js 闭包文本提取与 readContext 替身声明
- `readTarget` 与 `readWallpaperLifecycle` 不再手抄，改为直接自 `candidate/unpacked/src/index.js` 源码文本中正则匹配并以 `new Function('wallpaper', ...)` 实例化，确保与固定包完全等同。
- `readContext` 明确标示为模拟主会话授权（`authorized: true, owner: 'main:1'`）的环境替身，未走主渲染器跨域认证与主桥接通信。

---

## 3. R2 修复详情：默认 queryWindowsProcessCreationUtc 边界

移除 `queryProcessIdentity` 自定义钩子，保留 `session.js` 默认的 `queryWindowsProcessCreationUtc` 实现，仅注入底层的 `execCommand` 回调替身：
1. **负例（Case 4）**：
   - `execCommand` 触发错误回调：`cb(new Error('powershell query failed'), '')`；
   - 默认查询函数捕获并返回 `{ ok: false, error: '...', startUtc: null }`；
   - `session.state().windowStartUtc` 赋值为 `null`；
   - 首次自动读取及随后的用户手动重试均被 `target.unverified` 阻断。
   - **覆盖声明**：“execCommand 错误回调替身，真实定时超时未验”。
2. **正例（Case 5）**：
   - `execCommand` 触发正常回调：`cb(null, JSON.stringify({ ProcessId: 12032, CreationDate: '2026-10-27T02:31:28.0194820Z' }))`；
   - 默认查询函数成功解析 PID 与 ISO 8601 时间戳；
   - `session.state().windowStartUtc` 填充为有效字符串；
   - 自动读取直接进入 `ready` 并装载 6 项参数。

---

## 4. R3 修复详情：收尾协议对齐、验收门禁与故障注入

### 4.1 协议对齐与双重关闭断言
修正替身收尾行为：
1. `MockCaptureChild` 在 `stdin.end('stop\n')` 时发送 `this.emit('close', 0, null)`；
2. `helperRun` 在 `args[0] === '--window-ensure-closed'` 时返回 `{ outcome: 'closed', closed: true }`；
3. `env.WM_WALLPAPER_TASKBAR_HIDE: '0'` 确保无任务栏隐藏残留状态；
4. 每个用例 `finally` 块中显式执行并断言：
   - `const stopRes = await session.stop();`
   - `assert.equal(session.isClosed(), true);`
   - `assert.equal(stopRes.closed, true);`
   - `server.close()` 带 3000ms 截止超时。
5. 用例成功条件绑定收尾状态：`result.passed = result.cleanupSuccessful === true`。

### 4.2 预期故障注入比对（Dual-Run Verification）
- **正常运行（`run-reproduce-normal.cjs`）**：
  7 项用例全部成功，清理全部成功，子进程退出 0，父监督记录 `passed: true` 并退出 0（418ms）。
- **故障注入运行（`run-reproduce-teardown-failure.cjs`）**：
  注入 `QA_INJECT_TEARDOWN_FAILURE=1`，`helperRun` 在 `--window-ensure-closed` 返回 `{ outcome: 'failed', closed: false }`；
  `session.isClosed()` 返回 `false`，断言失败；
  子进程确切报告 `Case 1 FAIL`、`passedCases: 6/7`、`allPassed: false` 并以退出码 1 退出；
  父监督脚本捕获该退出码 1，断言 `expectedFailureConfirmed: true`，最终以退出码 0 退出（425ms）。
  确证收尾验收门禁真实起效，未发生验收漏判。

---

## 5. 用例矩阵与执行结果

| 用例名称 | 核心条件 | 阶段断言 | 收尾断言 | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| **Case 1 (Red)**<br>`case1-race-red-first-frame-before-stderr-capture-started` | 首帧到达并在 stderr 前触发 playing 与 auto-read | 1) `hub.received: 1`<br>2) `canApply: false`<br>3) `phase: 'blocked'`<br>4) 错误码 `target.unverified`<br>5) 重试后 `ready` (6项) | `session.isClosed(): true`<br>`stopRes.closed: true` | 证实首帧先于 stderr 状态触发时必然触发未验证门禁，稍后恢复有效 |
| **Case 2 (Green)**<br>`case2-race-green-stderr-capture-started-before-first-frame` | stderr captureSource 状态在首帧前就绪 | 1) `captureStarted: true`<br>2) 首帧触发 auto-read<br>3) 直接 `ready` (6项) | `session.isClosed(): true`<br>`stopRes.closed: true` | 对照组：状态就绪后首帧触发自动读取成功 |
| **Case 3 (Counterfactual)**<br>`case3-counterfactual-no-frames-no-autoread` | stderr 就绪但无任何帧到达 | 1) `hub.received: 0`<br>2) `renderer.state: 'starting'`<br>3) `autoReadTriggered: false`<br>4) `author.phase: 'idle'` | `session.isClosed(): true`<br>`stopRes.closed: true` | 因果对照：无帧绝不会自发进入 playing 与 auto-read |
| **Case 4 (R2 Red)**<br>`case4-exec-command-error-startutc-null-red` | `execCommand` 错误回调 | 1) `windowStartUtc: null`<br>2) auto-read 产生 `target.unverified`<br>3) 重试依然 `target.unverified` | `session.isClosed(): true`<br>`stopRes.closed: true` | 默认查询失败产生持久未验证，与 Case 1 恢复表现区分 |
| **Case 5 (R2 Green)**<br>`case5-exec-command-valid-startutc-green` | `execCommand` 返回有效 PID 与 ISO 时间戳 | 1) `windowStartUtc` 填充<br>2) auto-read 直接 `ready` (6项) | `session.isClosed(): true`<br>`stopRes.closed: true` | 默认查询成功支撑正常读取 |
| **Case 6 (Hypothesis 3a)**<br>`case6-adapter-null-gate-red` | `applyAdapter = null` | `application.available: false` -> `target.unverified` | server 正常关闭 | 适配器缺失进入未验证门禁 |
| **Case 7 (Hypothesis 3b)**<br>`case7-busy-produces-http-409` | `lifecycle.busy: true` | HTTP 409 `author_cleanup_pending`，非 `target.unverified` | server 正常关闭 | 证实 busy 上下文产生 409 而非 target.unverified |

---

## 6. 边界约束与认知收敛

1. **不修改生产代码与候选包**：本轮交付仅限于离线测试修补与证据收集，未触碰 `dsh-whale-mist/` 源码，未生成新候选包，不更改版本号与日常环境。
2. **根因定性克制**：离线证明确证了“首帧先于 stderr 到达必然触发 target.unverified，且稍后可恢复”，以及“启动时间查询失败会导致持久 target.unverified”。现场由于瞬时采集未捕获到微秒级变量，此因果机制仍定性为**高度可信的候选根因机制**，不轻率宣称现场 100% 绝对确诊或彻底排除所有并发因素。
3. **门禁语义准确性**：`helper` 门禁在 `applyAdapter` 处仅校验字符串以 `.exe` 结尾，报告不再概括为绝对路径校验。
4. **后续建议**：等待 Codex 复审确认接缝证据闭环。若接受因果模型，再评估最小生产补修策略（例如：在首次自动读取门禁处对 `captureStarted` 进行轻量短轮询/就绪等待，或在 session 侧保证首帧发射前完成 status 同步）。
