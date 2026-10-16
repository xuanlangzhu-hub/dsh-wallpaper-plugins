# C1 任务栏按钮移除 QA 交付（DS，2026-10-12）

**当前最新：[Gemini补修最终离线复核](../../docs/TASKBAR_QA_FINAL_REVIEW_20261012.md)。**
Gemini修复R1接管时机与R3归因，Codex补Release说明边界；92自检、13生成入口假场景、1实际Create工厂假原生边界、4假worker进程场景通过。
下一步为用户方便时的C1独立短验，当前未安装/调用真实Shell/WE/推送，日常rc.24保留。下文为旧交付历史。

**最新：用户授权Codex接手第二轮复审R1–R3，修复与离线检查见[接手记录](../../docs/TASKBAR_QA_REPAIR_20261012.md)。**
外层finally、worker退出确认门禁/真实停止传播、写失败非零和共同COM流程的完整HRESULT已补。
隔离构建/88自检、8生成入口场景、4无窗口假worker进程场景通过；无真实Shell/WE操作，日常rc.24未变。
新增QA源码TaskbarWorker.cs、TaskbarQaRuntime.cs、TaskbarRuntimeSelfTest.cs及两个独立回归脚本。

以下为DS修前交付历史：其中F2清理范围、F3清理门禁及F4报告完整性的声明曾被第二轮复审反例否定，
不能按旧段落当作当前实现或通过依据；以接手记录与当前源码为准。旧原文证据快照已保留。

按 [DS_NEXT_TASKBAR_QA.md](../../docs/DS_NEXT_TASKBAR_QA.md) 准备隔离 QA 工具、编译与无窗口自检；
第二轮按 [TASKBAR_QA_FIRST_REVIEW_20261012.md](../../docs/TASKBAR_QA_FIRST_REVIEW_20261012.md) 修 F1–F4。
**未安装、未退出/重开 DSH、未调用真实 WE、未创建任何真实窗口、未调用真实 `DeleteTab`/`AddTab`、
未提交/推送、未清理 Temp。** 日常 rc.24 保留。

## 改动文件（全部为本轮新增，`qa/taskbar-hide/`）

| 文件 | 说明 |
| --- | --- |
| `build.mjs` | 从 accepted 源码生成隔离项目、注入锚点、构建、复核 accepted 未变 |
| `TaskbarQaOptions.cs` | QA 参数提取、严格校验、与 accepted 捕获请求的交叉校验 |
| `WindowIdentity.cs` | 目标身份（HWND/location/PID/StartTime/进程名）与窗口快照 |
| `TaskbarList.cs` | `ITaskbarList` 封装、worker 执行器、worker 入口、自检 |
| `TaskbarHideStrategy.cs` | 状态机：触发、身份复核、单次调用、超时契约、有界清理、报告 |
| `TaskbarHideSelfTest.cs` | 假窗口/COM/时钟边界的无窗口自检 |
| `README.md` | 参数、交叉校验、超时语义、输出 schema、边界 |

未改 `src`、accepted 原生源码、`assets`、`package.json`/版本、SDK、Profile、外观存储、活动 tgz 或历史证据。

## 构建与检查（证据目录 `.tmp/taskbar-hide-qa-20261012-140814`）

| 命令 | 结果 |
| --- | --- |
| `node qa/taskbar-hide/build.mjs --output <新目录>` | 退出码 **0**，`acceptedUnchanged: true` |
| `--taskbar-self-test` | **58/58 通过**，退出码 **0** |
| `--taskbar-self-test-options` | 通过，退出码 0 |
| `--taskbar-self-test-com` | 通过，退出码 0 |
| QA HWND 与捕获 HWND 不同（真实解析器） | 退出码 1，`--taskbar-hwnd (4242) must equal the capture HWND (9999)` |
| 无 QA 标志的 accepted forever argv | 通过捕获解析（只差窗口），**不再被 QA 拒绝** |
| `--taskbar-worker`（身份不存在） | 输出 `{"call":"Verify",...,"error":"target-closed"}`，退出码 3 |

输出二进制 SHA256：`WallpaperProbeTaskbarQa.exe` = `C8A44513C428D09F2B03096048A084832171250ED0C476FBB0C32976010B438B`
（多次重建一致）；`WallpaperProbeTaskbarQa.dll` 每次构建带构建戳，其哈希与本次证据目录的 `build-result.json` 一致，
不在文档里冻结一个会随重建变化的值。
构建前记录的 15 项 accepted/QA 源码与 accepted 资产哈希，构建后逐一复核**全部未变**。

## F1–F4 修正

- **F1 参数绑定实际捕获**：QA 参数先提取，剩下的 argv 交给**同一个 accepted `CaptureArguments.Parse`**，
  再逐项核对：HWND 必须相同；模式必须是 `memory`/`pipe`；捕获时长 ≤60 秒且**等于** `--taskbar-duration`
  （捕获值为唯一权威，不允许报告与执行不同）；`min-seconds` ≥5 且小于捕获时长；报告只能写成捕获输出目录里的
  `taskbar-action.json`，已存在则拒绝。全部校验在建立窗口/COM 边界之前完成。
  QA 专用禁止条件只在启用 QA 时生效，**无标志的 accepted argv（forever/pipe/owned-location）原样通过**。
- **F2 清理覆盖真实的资源阶段**：不再声称"外层 try 覆盖 CreateItem 之前"。实际可达路径是捕获级 `finally`——
  内层 try 在 `CreateDevice()` 之前开始，因此设备/捕获项/帧池/会话创建失败与循环失败都汇到**同一条** QA 清理；
  运行在取得任何资源之前失败时，报告写"未取资源、无需清理"，不冒充已清理。清理与
  `EnsureProbeWindowClosed` 之间仍复核 HWND/PID/StartTime/location，并传 expected PID；目标已消失算已结束。
- **F3 超时不再放任后台动作**：Shell 调用移入**独立 QA worker 子进程**；主进程超时先终止 worker 并确认其退出，
  报告用 `timedOut`/`terminated`/`cleanupSafe` 区分"等待超时"与"动作已终止"，只有 `cleanupSafe` 才继续清理，
  否则记 `action-unconfirmed`。身份与停止状态在**执行侧**复核（worker 内、以及 `HrInit` 之后），
  不再把早先验证过的裸 HWND 送进队列。COM 创建/调用/释放仍在同一 STA 线程。
- **F4 时点与取证**：触发改到**有效 JPEG 完成发布之后**（pipe 写回或磁盘发布未跳过），用该帧自己的
  sequence/hash/sourceTimestamp；动作前再读一次停止状态。`firstFrame`、`trigger`、`location` 分开记录，
  `hrInit` 与 `deleteTab` 各自保留 HRESULT；视觉字段继续 `null`。报告固定写入本轮新输出目录并拒绝已存在文件；
  写入失败会非零退出并记 `report-missing`，不静默吞证据。

## 自检覆盖面（新增/加强部分）

- F1：一致的请求通过；HWND 不同、时长不同、捕获超过 60 秒、非 JPEG 模式、`min-seconds` 过低均拒绝；
  无 QA 标志的 accepted forever argv 原样通过。
- F2：清理归属（身份匹配/已消失/身份变化）、创建前失败的"无需清理"记录。
- F3：超时且已终止 → `cleanupSafe`；超时但未能确认终止 → 不清理并记 `action-unconfirmed`。
- F4：未发布的帧不触发；停止待决不触发；trigger 记的是**当前帧**序号；`firstFrame` 单独保存；
  `location` 精确；`hrInit`/`deleteTab` 分开。
- 既有：无 flag 零操作、5 秒门槛、单次尝试、HrInit 失败不删除、`AddTab`/`ActivateTab` 从不调用、
  不可见/最小化/cloaked 拒绝且不还原、wrong location/复用 HWND/StartTime 不同/同名多窗/目标关闭零动作、
  假边界返回 `S_OK` 时视觉字段仍 unknown。

## 已知不足

- **仍无实机证据**：任务栏按钮是否真的消失、Alt-Tab 是否仍有入口、是否闪窗/抢焦点全部**未观察**；
  `taskbarHidden`/`altTabHidden` 恒为 `null`。
- 按钮被 WE 重新登记或 Explorer 重启后重现不在本轮处理（不加 Shell 钩子、不做事件循环、不加 owner/TOOLWINDOW）。
- worker 的执行路径已在自检里用假边界覆盖，但**真实 worker 只验证了入口与拒绝路径**（身份不存在）；
  真正调用 `DeleteTab` 的路径要等实机。
- 自检不代表真实 Shell、官方 Desktop 布局或 WGC 行为。

## 后续（最多一条）

交 Codex 复审后，与用户协作做约一分钟人工观察：任务栏按钮是否消失、Alt-Tab 是否仍有入口、
窗口是否闪出/抢焦点、桌面是否正常；C1 通过再谈正式 Host 接入与更长生命周期检查。
未获新授权不自行进入下一阶段。
