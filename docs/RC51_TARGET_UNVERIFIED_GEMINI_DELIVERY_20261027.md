# rc.51 target.unverified 离线接缝复现与因果定位交付报告

2026-10-27，Gemini（Antigravity 会话）。
依据任务文档（`docs/RC51_TARGET_UNVERIFIED_GEMINI_TASK_20261027.md`）要求，在全新排他隔离目录 `.tmp/rc51-gemini-target-unverified-20261027-a/` 完成了 `createPreviewSession` → `index readTarget` → `createAuthorApplyAdapter` → `createAuthorPropertiesHost` → `client createNativeAuthorSwitches` 完整真实链条的离线接缝回放与因果核验。

---

## 一、输入指纹核验与环境界定

### 1.1 13 项冻结输入核验结果
依据 `.tmp/rc51-target-unverified-handoff-20261027-a/frozen-inputs.json`，在脚本 [`verify-inputs.mjs`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-target-unverified-20261027-a/verify-inputs.mjs) 及父监督 [`run-verify-inputs.cjs`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-target-unverified-20261027-a/run-verify-inputs.cjs) 监督下（耗时 120ms，退出码 0）完成逐项比对，核验记录保存于 [`input-hashes.json`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-target-unverified-20261027-a/input-hashes.json)：
- 8 项固定 rc.51 解包源码（`index.js`、`client.js`、`session.js`、`author-properties-apply.js`、`author-properties-host.js`、`managed-window.js`、`scenes.js`、`package.json`）与原候选包 `dsh-whale-mist-0.6.0-rc.51.tgz`（SHA256: `A8AA341F560C17CB7AC85817DFB205404AE7C2765F2F29B15CF436F912313725`）逐字节一致；
- 3 项实机短验记录（`first-read-outcome.json`、`author-read-failed-status.json`、`closed-out.json`）哈希严格匹配；
- 1 项 QA 夹具（`session.test.mjs`）哈希严格匹配；
- 1 项任务文档（`RC51_TARGET_UNVERIFIED_GEMINI_TASK_20261027.md`）的冻结前副本匹配 `0751FD93...`，实机追加第 5 节后的当前任务匹配 `AC38AD66...`，符合任务文档明确说明的追加准备记录口径。

### 1.2 真实组件与底层 IO 替身边界
- **真实生产链组件（100% 沿用 rc.51 原实现）**：
  - `createPreviewSession`（`unpacked/src/wallpaper/session.js`）
  - `createAuthorApplyAdapter`（`unpacked/src/wallpaper/author-properties-apply.js`）
  - `createAuthorPropertiesHost`（`unpacked/src/wallpaper/author-properties-host.js`）
  - `createWallpaperLibrary`（`unpacked/src/wallpaper/library.js`，真实扫描已核实 Steam 创意工坊目录 `E:/SteamLibrary/steamapps/workshop/content/431960` 并成功读取 Lucy 实际配置）
  - `index.js:138–144` 原始闭包 `readTarget` 及 `readWallpaperLifecycle`
  - `createNativeAuthorSwitches`（提取自 `unpacked/src/client.js` 原生侧栏闭包 `WM_NATIVE_SIDEBAR`）
- **受控底层 IO 替身**：
  - `helperRun`：替代 Win32 原生可执行文件 `WallpaperProbe.exe` 的 `--we-open` 与 `--window-find` 返回值，返回合法的模拟窗口句柄 `7344372` 与 PID `12032`；
  - `spawnChild`：返回模拟采集子进程 `MockCaptureChild`（PID `2552`），提供可精确触发首帧的 `stdout` 流与可精确触发就绪日志的 `stderr` 流，并在 `stdin.end()` 时立即触发 `close`；
  - 本地回环 HTTP 服务：使用 Node.js 原生 `createServer(host.handler)` 与 `fetch`，保证完整的真实 HTTP 请求头、认证上下文抽取与 JSON 解码。

---

## 二、目标身份字段全生命周期映射表

针对 `author-properties-apply.js:55-58` 的内部校验函数 `target(value)`，梳理其所要求的全部 9 项条件在整条生产链中的装配与时序状态：

| 校验字段 | 校验规则（`target()` 约束） | 数据来源与装配路径（`index.js:readTarget`） | 首帧到达当刻（`stdout` 触发 `playing`）状态 | 因果分析与影响 |
| :--- | :--- | :--- | :--- | :--- |
| **`wallpaperId`** | `isSceneId(id)` | `session.config.sceneId` | **有效**（`'lucy'`） | 启动配置在 `create()` 时已固化，无竞态 |
| **`generation`** | 非负安全整数 | `wallpaper.generation()` | **有效**（`1`） | 会话代次已递增，无竞态 |
| **`location`** | 格式为 `WhaleWallpaperProbe-...` | `session.location` | **有效**（格式合法） | 会话创建前已通过 `newLocation()` 生成 |
| **`hwnd`** | 正整数窗口句柄 | `state.config.window` | **有效**（`7344372`） | 窗口发现阶段已写入配置 |
| **`pid`** | 正整数进程 ID | `state.windowPid` | **有效**（`12032`） | 窗口发现阶段已写入状态 |
| **`startUtc`** | 合法 ISO 8601 UTC 字符串 | `state.windowStartUtc` | **条件相关**：<br>1. 若进程启动时间查询成功，则有效；<br>2. 若查询失败/超时，则为 `null` | **Hypothesis 2 触发点**：若查询失败，`startUtc` 为 `null`，导致门禁常闭；但在真实 Lucy 运行中查询成功时有效 |
| **`helper`** | 以 `.exe` 结尾的绝对路径字符串 | `state.config.helper` | **有效** | 启动配置传入真实打包路径 |
| **`stopping`** | 必须为 `false` | `state.stopRequested` | **有效**（`false`） | 正在启动阶段，未请求停止 |
| **`captureStarted`**| **必须为 `true`** | `state.captureStarted` | **【核心缺口】初始为 `false`** | **Hypothesis 1 竞态根因**：`captureStarted` 仅在子进程 `stderr` 的 `Status` 日志解析出 `captureSource === 'window'` 时置为 `true`；而前端在 `stdout` 首帧到达时即置 `playing` 并触发 `ensureLoaded()`，导致在 `stderr` 状态到达前发起读取，门禁必被判定为 `false`！ |

---

## 三、确定性接缝回放实验（5 项用例）

执行脚本 [`reproduce-target-unverified.mjs`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-target-unverified-20261027-a/reproduce-target-unverified.mjs)，由 [`run-reproduce-target-unverified.cjs`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-target-unverified-20261027-a/run-reproduce-target-unverified.cjs) 实施硬截止监督，在 **410ms** 内以退出码 0 顺利完成，详细结果记录于 [`target-unverified-report.json`](file:///F:/dsh-wallpaper-plugins/.tmp/rc51-gemini-target-unverified-20261027-a/target-unverified-report.json)：

```
[Case PASS] hypothesis1-race-first-frame-before-stderr-capture-started
[Case PASS] hypothesis1-control-stderr-capture-started-before-first-frame
[Case PASS] hypothesis2-creation-utc-query-failure
[Case PASS] hypothesis3a-adapter-unavailable
[Case PASS] hypothesis3b-lifecycle-busy
All 5 deterministic seam cases completed.
```

### 3.1 场景 1：假设 1 真实红例（首帧到达先于 stderr 就绪状态）
- **时序与动作**：
  1. `session.create()` 完成窗口创建与进程时间查询（`windowStartUtc: '2026-10-27T02:31:28.0194820Z'`），此时 `captureStarted` 为 `false`；
  2. 子进程 `stdout` 吐出首个视频帧，前端模拟 `emitFrame` 触发 `view.state = 'playing'`；
  3. `AuthorSwitches` 监听 `autoEligible: view.state === 'playing'` 触发，立刻发起 `ensureLoaded()` → `GET /api/author-properties/schema?wallpaperId=lucy`；
  4. 此时子进程 `stderr` 尚未推送 `captureSource: 'window'`；
  5. Host 内部调用 `applyAdapter.canApply('lucy', 1)`，`target()` 检查到 `captureStarted === false`，抛出 `author_target_unverified`，`canApply` 返回 `false`；
  6. Host 返回 HTTP 200，但载荷为 `application: { available: true, targetActive: false }`；
  7. 前端 `load()` 检查 `if (!next.dirtyKeys.length && reply.application?.targetActive !== true) throw Error('target-unavailable');`；
  8. **首读呈现事实**：`phase: 'blocked'`, `message: '未能读取设置，请重试 [target.unverified]'`，**与 rc.51 实机现场呈现 100% 吻合**！
- **稍后状态推进与手动重读恢复**：
  1. 子进程 `stderr` 推送 `{"captureSource":"window","fps":30}\n`，`session.js` 解析并将 `state.captureStarted` 置为 `true`；
  2. 调用 `author.load()` 模拟用户点击“重试读取作者参数”；
  3. 此时 `canApply` 返回 `true`，读取瞬间成功，恢复为 `phase: 'ready'`, `message: null`，并成功加载 Lucy 实际工坊全部 6 项参数（`newproperty`, `particles`, `newproperty10`, `newproperty1`, `newproperty3`, `hidemarketingwords`）。

### 3.2 场景 2：假设 1 绿例对照（stderr 就绪状态先于/伴随首帧到达）
- **时序与动作**：
  - 唯一变量改变：在首帧触发读取前，子进程 `stderr` 先吐出 `captureSource: 'window'`；
  - `session.state().captureStarted` 在首帧到达时已为 `true`；
  - **首读呈现事实**：首次自动读取即顺利进入 `phase: 'ready'`, `message: null`，6 项参数一次性加载完毕，0 次告警。

### 3.3 场景 3：假设 2 红例（进程创建时间查询失败/超时）
- **时序与动作**：
  - 模拟底层 PowerShell 查询 `queryWindowsProcessCreationUtc` 发生超时或错误，`state.windowStartUtc` 保持为 `null`；
  - 即使 `captureStarted === true`，`target()` 仍因 `!parseIsoStartUtc(value.startUtc)` 抛出 `author_target_unverified`；
  - **首读呈现事实**：`phase: 'blocked'`, `message: '未能读取设置，请重试 [target.unverified]'`；
  - **与假设 1 的本质区别**：由于 `windowStartUtc` 在整个 session 生命周期内不可变且无法自行恢复，随后的手动重试依然失败（`secondReadSnapshot.phase === 'blocked'`）。

### 3.4 场景 4：假设 3a（`applyAdapter` 为 null）
- **观测事实**：当未传递适配器时，Host 返回 `application: { available: false, targetActive: false }`，前端同样抛出 `target.unverified`。该例证实 `application.available` 与 `targetActive` 两个独立门禁任何一个失败均会被压为同一错误码。

### 3.5 场景 5：假设 3b（锁冲突与 `ownership` busy 反例）
- **观测事实**：当 `wallpaper.ownership()` 处于 busy 时，`readWallpaperLifecycle` 上报 `busy: true`，Host 的 `context()` 校验直接抛出 `author_cleanup_pending`，HTTP 状态码为 **409**。前端捕获后显示 `[schema.http.409]`，**绝不会产生 HTTP 200 下的 `target.unverified`**。该反例彻底排除了“锁竞争导致 target.unverified”的假设。

---

## 四、离线可达原因与实机现场证据边界

1. **离线已确证的因果机制（Hypothesis 1）**：
   - 前端触发首次自动读取的触发源是 `view.state === 'playing'`（依赖于解码出的第 1 个视频帧，源自 `child.stdout`）；
   - 后端判定 `targetActive === true` 的必要条件是 `session.state().captureStarted === true`（依赖于 `child.stderr` 的 `Status` 诊断日志解析）；
   - `stdout` 与 `stderr` 作为两个独立的操作系统管道，在 native 进程启动瞬间不具备严格时序绑定。首帧先于日志解析到达是天然存在的时序竞态缺口，能 100% 重复产生实机现场捕获的 `target.unverified` 阶段码，且能完美解释“首读失败后，稍后查询快照时 `captureStarted` 已经为 `true`”的现场事实。
2. **实机现场仍缺的证据（不能宣称现场已直接证实）**：
   - rc.51 实机短验中，首读失败瞬间仅记录了 UI 的阶段码 `[target.unverified]`，未保留原始 HTTP 响应报文（无法直接区分是 `application.available === false` 还是 `targetActive === false`）；
   - 稍后记录的快照只读出了 `session.captureStarted: true`，未打出首读当刻微秒级的时间戳；且快照未暴露 `windowStartUtc`；
   - 因此，**“首帧早于状态日志的到达竞态”已在离线证实为可达因果链，但现场是否确由此引起或受启动时间查询延迟影响，在未加微观取证日志前仍属高概率候选而非绝对已定事实**。

---

## 五、产物清单与指纹

所有产物输出于排他隔离目录 `F:\dsh-wallpaper-plugins\.tmp\rc51-gemini-target-unverified-20261027-a/`：

| 文件名 | 大小 (字节) | SHA256 哈希 | 作用说明 |
| :--- | :--- | :--- | :--- |
| `verify-inputs.mjs` | 2,137 | `12E865F8902AD9B64438244BB2DEA0413BE79FF7C1E931F8925587E0CFAC0FBC` | 13 项冻结输入核验脚本 |
| `run-verify-inputs.cjs` | 496 | `4045D941704166201780270744C79213F2C71972E2EAD8EDBAFF95ECCB5EB251` | 输入核验父监督脚本 |
| `input-hashes.json` | 3,822 | `63D4FF6C6FBD431E6419A58DF51148B9A7C991C023D49337B12FF148576A0904` | 输入核验详细记录（13项全通过） |
| `reproduce-target-unverified.mjs` | 17,215 | `23658C5B61A434182E6FCEACC3CAD11300DB4F844F2E3DD213183DC8CA46FE17` | 5 项真实链条接缝回放与因果对照脚本 |
| `run-reproduce-target-unverified.cjs` | 1,460 | `4D538137B389DD2AB0F4704E7B4DFB9D916FD05AB531EC2643CEDF5B50629150` | 回放测试父监督脚本（有界硬截止） |
| `target-unverified-report.json` | 9,738 | `C0872E919DE00F98F0FBEB8EE46739349A84458F977F26A4F18A752768454CBA` | 回放详细报告（5项全通过，含 Lucy 真实参数） |
| `target-unverified-run.json` | 449 | `968E8B9D25DC032CA36ACD6E44462FC641C4DB946933662B5BECB071D7545729` | 父监督运行记录（**410ms，退出码 0，`passed: true`**） |

---

## 六、收尾与接续

- **环境状态**：日常 DSH 0.2.1-rc.3 / Whale rc.48 / Git Bash 0.1.2 保持静止；生产源码（`dsh-whale-mist/`）未作任何修改；无打包安装、无日常操作或外部网络调用；既有工作区未提交改动完整保留。
- **移交建议**：本报告移交 Codex 进行独立复审重放。在 Codex 复审确认因果关系前，不盲目提升代码或开辟新阶段。
