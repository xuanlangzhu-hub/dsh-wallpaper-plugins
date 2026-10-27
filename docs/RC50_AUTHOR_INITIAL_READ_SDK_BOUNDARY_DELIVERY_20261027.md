# rc.50 首次作者读取：SDK 边界补验交付报告

2026-10-27，Gemini（Antigravity 会话）。
依据任务文档（`docs/RC50_AUTHOR_INITIAL_READ_SDK_BOUNDARY_TASK_20261027.md`）与 Codex 复审意见（`docs/RC50_AUTHOR_INITIAL_READ_GEMINI_REPAIR_REVIEW_20261026.md`），在全新排他隔离目录 `.tmp/rc50-gemini-boundary-verification-20261027-a/` 完成 SDK 边界补验与口径修正，涵盖迟到/换代/销毁隔离、真实 bridge 断开分支、失败收尾判定门禁以及输入指纹准确归属。

---

## 一、输入指纹归属与环境核验

### 1.1 原始输入指纹与服务版本区分
本次核验证实输入指纹严格一致，并明确区分原始静态文件与运行时服务暴露：

| 文件对象 | 路径 / 来源 | 字节数 | SHA256 哈希 | 属性说明 |
| :--- | :--- | :--- | :--- | :--- |
| **原始 VM 探针** | `.tmp/rc50-author-initial-read-diagnosis-20261026-a/client-probe-test-hook.js` | 610,682 | `9F4CF267740F47F5821CA029EC59CDC0884845DCEF81F5FB0D2177431CEAD1E3` | 原始探针副本，含 VM 导出 |
| **原始诊断客户端** | `.tmp/rc50-author-initial-read-diagnosis-20261026-a/client-read-diagnostic-probe.js` | 610,490 | `A220C4CF5E7583900D7D44C19523FB7935459602E0660BF7879BEAB40B1E1AD4` | 原始诊断探针客户端 |
| **服务客户端（QA Hook）** | 内存服务替换版（插入 `window.__qaBridgeClient` 挂载点） | 610,517 | `5C3DFA4391517899C0CF95B7ED3262B0591AAA48CDF8B5F5C86877235EDCDAF8` | 仅在初始化处暴露对象指针，未改动任何逻辑 |
| **Lucy Project 声明** | `E:\SteamLibrary\steamapps\workshop\content\431960\3521337568\project.json` | 6,340 | `4E80B2729993F45B2B7B90CCBF2E7FFE502C530F0B43E7FE70520BD0B13F10BB` | 对应 `SCENES.lucy.project` 实际路径 |

此前报告曾将内存注入服务版本误标为原始客户端哈希，并误标 Lucy 声明哈希；本次核对已在 `.tmp/gemini-sha256-hang-20261027-a/input-hashes.json` 及报告中彻底纠正并独立记录。

### 1.2 真实组件与离线替身界定
- **真实实现**：
  - `createDetachableHttpHost`（`package/src/detachable-host.js`）
  - `createAuthorApplyAdapter`（`package/src/wallpaper/author-properties-apply.js`）
  - `createWallpaperLibrary`（`package/src/wallpaper/library.js`）
  - `registerWallpaperRoutes`（`package/src/wallpaper/session.js`）
  - 官方 Windows rc.3 模块前端包（`@deepseek-ai/*`）与真实 Edge Headless 浏览器。
- **离线隔离替身**：
  - 目标窗口识别替身：PID `43210`、HWND `123456`、startUtc `'2026-10-22T01:00:00.0000000Z'`、helper `'C:\\offline\\window-helper.exe'`。
  - 原生命令执行器替身：`runChild` 若被调用立即抛出错误并记录 `authorCommands` 计数。
  - 预览图库替身：内存 1x1 PNG fixture。

---

## 二、收尾错误与失败门禁判定（Task 3）

针对“收尾错误可能保持 `passed=true`”的缺陷，脚本在设计上实现了严格闭环：
1. **测试脚本（`sdk-boundary-test.mjs`）**：
   在 `finally` 阶段，对浏览器关闭、进程退出（`browserExitConfirmed`）、HTTP 服务关闭以及 Host 主会话清理（`mainSessionCleaned`）进行严格断言。若任何一项清理失败或未确认，强制设置 `report.passed = false` 并设置 `process.exitCode = 1`。
2. **父监督脚本（`run-sdk-boundary.cjs`）**：
   父监督在判定通过时，强制要求 `exitConfirmed && !timedOut && code === 0 && childReport?.passed === true`，任何清理异常导致的非零退出均使父监督置为 `passed: false`。
3. **预期失败替身验证（`sdk-cleanup-failure-stub.mjs` + `run-cleanup-failure-stub.cjs`）**：
   - 构造合成用例：业务用例全部通过，注入模拟收尾故障（`browserExitConfirmed: false`，`browserCloseError`）。
   - **验证结果**：
     - 子进程详细报告：`passed: false`
     - 子进程退出码：`code: 1`
     - 父监督运行记录：`passed: false`，`expectedFailureConfirmed: true`
     - 独立证据已保存于：`cleanup-failure-report.json` 与 `cleanup-failure-stub-run.json`。

---

## 三、真实请求拦截信号与边界迟到隔离（Task 1）

使用基于 Promise 的可等待信号门禁类 `RequestLatch`，彻底摒弃 `60ms/100ms` 固定等待猜测。

### 3.1 验证场景与断言明细

| 场景名称 | 触发机制与阶段信号 | 关键断言与观测事实 | 结论 |
| :--- | :--- | :--- | :--- |
| **`healthy-initial-read`** | 正常播放 Lucy，打开侧栏壁纸页 | 自动发起恰好 1 次 schema GET 请求，0 次写请求，0 次原生命令；`particle().isEnabled() === true`；DOM 无诊断方括号；明确 6 控件计数归属 R1 断言 | **通过** |
| **`hidden-view-late-response`** | 发起读取，`latch.waitIntercepted()` 拦截在途请求；切换至“界面”页；释放 500 迟到错误并 `waitSettled()`；切回“壁纸”页 | 1. 界面页无任何 alert 渲染；<br>2. 切回壁纸页，旧 500 错误与 payload 严格未泄露到 DOM；<br>3. 保留视图隐藏取消标记 `[controller.cancelled]`；<br>4. 重返视图总请求数恰为 1（即离开前发起的该次请求，**零额外自动重试循环**）；<br>5. 0 次写请求，0 次原生命令；<br>6. 手动重试后完全恢复为 ready 态，粒子可用，alert 清空 | **通过** |
| **`generation-change-late-success`** | 发起读取，`latch.waitIntercepted()` 拦截旧代请求；`stop()` 停止并 `playing()` 启动新代次；新代次就绪后，释放**有效结构且属于同 Lucy**的旧成功响应，`waitSettled()` | 1. 释放的旧成功响应具有合法结构与字段；<br>2. 新代次状态与 DOM 绝不被旧代响应覆盖，当前代次粒子开关保持 enabled；<br>3. 0 次写请求，0 次原生命令，无错误 alert | **通过** |
| **`generation-change-late-error`** | 发起读取，`latch.waitIntercepted()` 拦截旧代请求；停止并启动新代次；新代次就绪后，释放旧代 403 错误响应，`waitSettled()` | 1. 旧代 403 错误被直接丢弃，未闪烁或注入到当前状态/DOM；<br>2. 新代次粒子开关保持 enabled，0 次 alert；<br>3. 0 次写请求，0 次原生命令 | **通过** |
| **`view-destroyed-late-response`** | 发起读取，`latch.waitIntercepted()` 拦截在途请求；调用 `window.qaUnmount()` 销毁根视图；释放有效 Lucy 响应，`waitSettled()` | 1. 根节点子元素完全清空（`rootChildren === 0`）；<br>2. 销毁后 0 次写请求，0 次原生命令；<br>3. 页面捕获 0 个未处理异常（`pageErrors.length === 0`） | **通过** |

---

## 四、真实 Bridge 链路断开验证（Task 2）

### 4.1 真实链路断开机制
不使用任何 monkey-patch 或手工抛出伪造异常：
1. 直接终止 Host 侧主会话的真实 SSE actions 响应流：`actualHost.getMainSession().actionsSseRes.end()`。
2. 客户端原生 `startActionStream()` 在流结束时触发 `finally { authorConnected = false; notify(); }`。
3. 等待 `window.__qaBridgeClient.authorConnected === false` 确认断开。
4. 调用未修改的原版 `bridgeClientInstance.requestAuthor('schema', { wallpaperId: 'lucy' })`。
5. **观测事实**：
   - 原版 `requestAuthor` 直接进入内部第 5925 行原生断开分支，抛出 `Error: author-disconnected`，并附带封闭阶段码 `{ stage: 'bridge', reason: 'disconnected', status: undefined }`。
   - 侧栏感知到连接断开并自动安全退避撤出（`sidebarTotalCount: 0`, `sidebarVisibleCount: 0`）。
   - 全程 0 次写请求，0 次原生命令。
6. 调用 `connect()` 重新建立 SSE actions 连接，确认 `authorConnected === true`，重新打开侧栏并恢复正常就绪状态。

---

## 五、验证产物清单与指纹

所有产物输出于排他目录 `F:\dsh-wallpaper-plugins\.tmp\rc50-gemini-boundary-verification-20261027-a/`：

| 文件名 | 大小 (字节) | SHA256 哈希 | 作用说明 |
| :--- | :--- | :--- | :--- |
| `sdk-cleanup-failure-stub.mjs` | 1,205 | `877B6178510FABD104C08154913D9B65B018F46EBD0C689E484BC458BEBE314F` | 收尾失败验证测试脚本 |
| `run-cleanup-failure-stub.cjs` | 2,584 | `642DBD0DD8C6FEE5CAA20CC00EE35309050FEB07A47DA650DADA4680E33E58AB` | 收尾失败验证父监督脚本 |
| `cleanup-failure-report.json` | 417 | `03E9E00E27DF07A03FCC585CEC2454ADDDB6B2CFEC0B5730E9F0C15F79EC9458` | 收尾失败子进程报告（`passed: false`） |
| `cleanup-failure-stub-run.json` | 205 | `30E01DA52719182FA87779364C19388D96AE2532F34BDF51D6E73BE3AEA82D1C` | 收尾失败父监督记录（`code: 1, expectedFailureConfirmed: true`） |
| `sdk-boundary-test.mjs` | 28,920 | `C7AB3FC14595839D2190DCB8563B8C88C8DB9A055B83F5940620ED9F1CFB9A33` | 完整 SDK 边界与真实链路测试用例（6项） |
| `run-sdk-boundary.cjs` | 2,163 | `3DA8FD4559ECB5A709B47217BFEFAFD9FFFE83B8E0BF0583C92E1E693A5E0F20` | 完整 SDK 边界测试父监督脚本 |
| `sdk-boundary-report.json` | 3,293 | `A7B9009BB948744374CFCCA8CECF9E7D6363C2CB3B871A05D432C5D11CD797B7` | 完整 SDK 详细报告（6项全绿，`passed: true`） |
| `sdk-boundary-run.json` | 189 | `CFABCC23256CB5F679B8874C748A7C55CAEC24EA2680C1EC4443B8A416D5C0A1` | 父监督运行记录（**4,267ms，退出码 0，`passed: true`**） |

---

## 六、客观定性与仍未知的现场边界

1. **诊断探针验证不等于现场已修复**：
   本次边界验证在官方 Windows rc.3 SDK 隔离环境中，严格证实了封闭阶段码、信号拦截、代次隔离与收尾门禁在各种边界条件下的确定性行为。
2. **现场首个失败阶段仍属未知**：
   在加载 23 张图库后播放的真实 DSH 0.2.1-rc.3 / Whale rc.50 实机现场中，首次读取作者参数报错“未能读取设置，请重试”的真正原因（是真实 bridge 瞬断、snapshot 403/超时、schema 409、抑或是 target 校验时序问题），仍缺乏当时的原始网络请求与响应证据，本轮未在离线阶段武断定因，亦未触碰生产源码。
3. **日常环境与工作区完整保留**：
   日常 DSH 0.2.1-rc.3 / Whale rc.48 / Git Bash 0.1.2 保持不动；工作区原有 206 项未提交脏改动完整保留，未进行任何打包、安装、全局 kill 或生产分支修改。
