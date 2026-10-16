# C1 任务栏按钮移除 QA（隔离工具）

本目录只准备**离线可编译、可自检**的 C1 实验工具：在已出帧之后对**本轮自己的**源窗口调用一次
`ITaskbarList::DeleteTab`，保持窗口可见、样式、owner、位置与 Z 序不变。它**不**解决 Alt-Tab，
**不**承诺完全隐藏，也**不**替代实机观察。

工具由 accepted 源码生成：`build.mjs` 读取 `qa/wallpaper-probe` 的 accepted 文件，**只链接、不修改**，
把少量 QA 锚点注入一份生成副本，构建进一个全新目录，并在构建后再次核对所有 accepted 源码与资产哈希未变。
锚点必须恰好命中一次，否则构建立即停止。

## 构建

```powershell
node qa/taskbar-hide/build.mjs --output F:/dsh-wallpaper-plugins/.tmp/taskbar-hide-qa-<stamp>
```

输出目录（全部为新建，不复用、不覆盖）：

| 文件 | 内容 |
| --- | --- |
| `generated/` | 注入后的 `Program.cs`、`TaskbarQaSelfTest.cs`、`SourceWindowHelperQa.cs`、csproj；runtime直接链接QA源码 |
| `native/WallpaperProbeTaskbarQa.exe|.dll` | 隔离 QA 二进制（不是生产 helper） |
| `build-inputs.json` | 构建前每个 accepted 源码 / QA 源码 / accepted 资产的 SHA256 |
| `build.log` | 完整构建输出 |
| `build-result.json` | `acceptedUnchanged` 与输出二进制哈希 |

accepted 的原 `WallpaperProbe.exe/.dll` 不会被写入或覆盖。

## 自检（无窗口、无桌面、无 COM 调用）

三个入口都在 `Native.EnsureDefaultDesktop()`、窗口枚举与 Shell 接口**之前**返回：

```powershell
$env:WM_TASKBAR_SELFTEST_OUT = "<新目录>/selftest.json"   # 可选，写结构化结果
WallpaperProbeTaskbarQa.exe --taskbar-self-test            # 全部 109 项
WallpaperProbeTaskbarQa.exe --taskbar-self-test-options    # 只跑选项解析
WallpaperProbeTaskbarQa.exe --taskbar-self-test-com        # 只跑 COM 封装与假边界
```

`--taskbar-self-test` 用**真实策略状态机**配注入的窗口/COM/时钟假边界，覆盖：

- 无 flag 零操作；有效帧与最短运行时间两条件都满足才调用，之后不再重复；
- `HrInit` 失败不调用 `DeleteTab`；`DeleteTab` 失败只记一次且不重试；成功/异常都释放接口；
  从不调用 `AddTab`/`ActivateTab`；调用不返回时有界结束；
- 非法/重复/缺值/未知 flag、`--forever`、不产 JPEG 的模式、时长越界、缺身份参数均拒绝；
- wrong location、复用 HWND、PID 相同但 StartTime 不同、同名多窗、目标已关闭：全部无 Shell 动作；
- 不可见/最小化/cloaked：拒绝且**不还原**；
- 关闭未确认、目标身份变化时的清理归属与有界退出；
- 假边界返回 `S_OK` 时 `taskbarHidden`/`altTabHidden` 仍为 `null`。

## 实验参数（仅 QA）

`--taskbar-qa` 之后的参数由本工具自己解析，其余参数原样交给既有 `CaptureArguments`。

| 参数 | 说明 |
| --- | --- |
| `--taskbar-qa` | 启用实验。缺省时工具行为与 accepted 捕获完全一致 |
| `--taskbar-hwnd <十进制>` | 目标窗口句柄（本轮源窗口） |
| `--taskbar-pid <十进制>` | 目标进程 PID（必须是 `wallpaper64`） |
| `--taskbar-start <ISO-8601 UTC>` | 目标进程 StartTime，用于与 PID 组成完整身份 |
| `--owned-location <本轮窗口名>` | 复用既有参数；停止/到期/异常/父断开都只关闭这个名字 |
| `--taskbar-action-out <路径>` | `taskbar-action.json` 的输出路径，默认工作目录下同名文件 |
| `--taskbar-duration <1..60>` | 只用于与捕获时长比对；默认 25 秒，**必须等于**捕获的时长 |
| `--taskbar-min-seconds <1..30>` | 触发前的最短正常运行时间，默认 5 秒，且必须 ≥5 并小于捕获时长 |

**交叉校验（先做，不建任何窗口/COM）**：剩下的 argv 交给**同一个 accepted `CaptureArguments.Parse`**，
然后逐项核对：

- `--taskbar-hwnd` 必须等于捕获解析出的 HWND（否则动作可能指向并非正在采集的窗口）；
- 捕获模式必须是 `memory` 或 `pipe`（触发条件是"真的完成了一次 JPEG 编码并发布"）；
- 捕获时长必须 ≤60 秒且等于 `--taskbar-duration`：**捕获解析出的时长是唯一权威**，不允许报告与执行不同；
- `--taskbar-min-seconds` ≥5 且小于捕获时长（保证动作后仍有帧）；
- `--taskbar-action-out` 只能是捕获输出目录，报告固定写成其中的 `taskbar-action.json`；该文件已存在则拒绝，
  不覆盖上一轮证据。

QA 专用禁止条件**只在启用 QA 时生效**：`--taskbar-add-tab`、`--taskbar-activate`、
`--taskbar-set-active-alt`、`--forever`、`frames`/`readback`/`staging` 模式、重复参数、未知
`--taskbar-*` 参数都会被拒绝；**不带 QA 标志时，accepted 的合法 argv（含 forever/pipe/owned-location）
原样通过**，包括 `--owned-location```--echo-on-stderr` 出现在后面的情况。
**恢复一律靠结束采集并关闭本轮 location，不调用 `AddTab`。**

## 动作执行与超时

Shell 调用不跑在主采集帧循环线程上：满足触发条件后，`AfterFrame` 通过非阻塞 `OnFrameAsync` 在后台启动最多一次**独立的 QA worker 子进程**（同一个可执行文件的
`--taskbar-worker <hwnd> <pid> <startUtc> <location> <stopFile>`），使主采集循环无需等待动作前/后的窗口枚举、子进程启动或 COM 返回即可继续抓帧、编码与发布。
worker 在自己的 STA 线程里完成 `HrInit → 复核身份与停止状态 → DeleteTab → 释放`，只有结果 JSON 回到主进程。

- 动作在飞期间，阶段记为 `action-pending`（`pending: true, actionScheduled: true, succeeded: false, completedAtSeconds: null, postActionFrame: null`）；在执行器启动子进程前，`started` 与 `exited` 记为 `null`（未知），绝不把“后台任务已调度”冒充为“worker 子进程已启动”；子进程真正启动后更新为 `executorEntered: true, started: true, exited: false`。
- 在飞期间到达的帧记入 `framesWhilePending`；动作完成时记录单调采集时间界限 `completedAfterSourceTimestampMs` 与 `completedAfterFrameSequence`。若某帧在动作完成前已由 WGC 采下、但在动作完成后才编码发布，则归入 `preCompletionFramesPublishedAfter` / `lastPreCompletionFrameAfter`（返回 `pre-action-frame`），绝不升级为 `postActionFrame`；只有采集时间与帧序号均严格晚于完成界限且已发布的帧，才写入 `postActionFrame`。
- `triggeredAtSeconds`、`completedAtSeconds` 与 `postActionFrame.elapsedSeconds` 统一锚定在捕获时钟同一原点，并单独记录 `runtimeClockOffsetSeconds`，避免混入 Runtime 创建至捕获会话启动之间的初始化耗时。
- 主进程等待与 `Finish()` 收尾均有有界上限；停止/到期/异常或超时先**向在飞 worker 传播停止信号、终止 worker 并确认其退出**，才允许开始关闭源窗口。
- 报告把"等待超时"与"动作已终止"分开：`started` / `exited` / `timedOut` / `cancelled` / `terminationRequested` / `terminated` / `cleanupSafe`。
  只有 `cleanupSafe` 为真才继续清理；否则记 `action-unconfirmed` 并不清理。
- **身份与停止状态在执行侧复核**（worker 内部、以及 `HrInit` 之后），不是把一个早先验证过的裸 HWND
  送进队列。

## 输出

主采集的stdin停止/断开、stop.txt、Esc由真实停止回调送到worker监视器；停止/异常/超时均终止本轮worker并确认退出。
worker侧最后复核读取stop.txt与Esc，而非恒false。父进程以子进程为截止边界；worker不使用抛弃STA线程的超时。
`HrInit`与`DeleteTab`由共同执行流程记录，完整经过worker JSON协议；未调用或结果未知的字段为null。

额外离线回归（显式全新输出目录）：

```powershell
node qa/taskbar-hide/check-generated.mjs --build <本轮构建目录> --output <全新目录>
node qa/taskbar-hide/check-worker.mjs --output <另一全新目录>
```

前者检查生成入口、实际生成帧循环（`AfterFrame`）与外层 catch/finally，并在同一 scope 注入初始化失败、在飞多帧继续通过、在途旧帧过滤、初始化时钟偏移、前置枚举阻塞取消、在飞到期/取消/异常收尾与未确认拒绝关闭；后者只启动无窗口控制台假 worker，
验证真实进程/管道的成功、坏协议、超时、取消与后台在飞多帧推进，确认子进程退出和无迟到标记。不调用真实 Shell/WE。

`taskbar-action.json`（camelCase）：

```jsonc
{
  "schemaVersion": 1,
  "enabled": true,
  "stage": "armed|observing|action-pending|action-done|action-failed|action-unconfirmed|blocked|stopped-before-action",
  "requestedIdentity": { "hwnd": 0, "pid": 0, "startUtc": "", "minSeconds": 5, "durationSeconds": 25 },
  "beforeIdentity": { "hwnd": 0, "pid": 0, "process": "wallpaper64", "visible": true, "iconic": false,
                      "cloaked": false, "left": 0, "top": 0, "width": 0, "height": 0,
                      "style": "0x…", "exStyle": "0x…", "owner": 0, "parent": 0, "zOrderIndex": 0,
                      "startUtc": "" },
  "afterIdentity": { },
  "taskbarHidden": null,   // 没有人工观察时永远是 null，不由 HRESULT 或样式推断
  "altTabHidden": null,
  "location": "WhaleWallpaperProbe-…",
  "firstFrame": { "sequence": 0, "elapsedSeconds": 0, "hash": "", "sourceTimestampMs": 0, "capturedAt": 0, "published": true, "stopRequested": false },
  "trigger": { "sequence": 0, "elapsedSeconds": 0, "triggeredAtSeconds": 0, "runtimeClockOffsetSeconds": 0, "hash": "", "sourceTimestampMs": 0, "capturedAt": 0, "minSeconds": 5 },
  "action": {
    "call": "DeleteTab", "hresult": "0x00000000", "succeeded": true, "pending": false,
    "actionScheduled": true, "executorEntered": true, "error": null,
    "hrInit": { "hresult": "0x00000000", "succeeded": true, "error": null },
    "deleteTab": { "hresult": "0x00000000", "succeeded": true, "error": null },
    "timedOut": false, "terminated": false, "cleanupSafe": true,
    "started": true, "exited": true, "cancelled": false, "terminationRequested": false,
    "triggeredAtSeconds": 0, "runtimeClockOffsetSeconds": 0, "completedAtSeconds": 0,
    "completedAfterFrameSequence": 0, "completedAfterSourceTimestampMs": 0, "completedAtUnixMs": 0,
    "framesWhilePending": 0, "preCompletionFramesPublishedAfter": 0, "lastPreCompletionFrameAfter": null,
    "postActionFrame": null
  },
  "blocked": { "reason": "", "when": "" },
  "failure": { "stage": "", "message": "", "hresult": "" },
  "cleanup": { "outcome": "closed", "closed": true },
  "notes": []
}
```

触发发生在**有效 JPEG 编码并发布之后**（pipe 写回或磁盘发布未跳过），用的是**该帧自己的**
sequence/hash/sourceTimestamp；动作前会再读一次停止状态。`firstFrame` 与 `trigger` 分开保存，
不会再出现"把前一帧算成动作后的画面"。报告写入失败会让退出码非零并记 `report-write-failed`，
不会静默吞掉证据。

标准 pipe 的 stdout 仍然只有帧协议；QA 诊断走 stderr/独立文件。采集的 `frames.jsonl` 与
`summary.json` 语义不变：动作成功不算播放通过，也不把调用前的旧帧算成调用后的动态帧。

## 边界

- 源窗口的创建与关闭仍由受监督的控制方执行，使用本轮唯一 `WhaleWallpaperProbe-…` 名字；
  本工具只接受显式 HWND/PID/StartTime/location，不接受只匹配标题前缀。
- 目标已最小化/不可见/cloaked 时拒绝动作并记录，不自动还原或显示它；尺寸与位置按当前原样保存。
- 结束采集只关闭本轮 location；目标身份变化或无法确认时不关闭别人的窗口，写 cleanup 未确认并以非零退出。
- 清理是一条路径：正常结束、停止、stdin 断开、WGC 初始化/发布异常都汇到**同一个**有界关闭；
  `CreateDevice`/`CreateItem`/帧池/会话创建失败也落到最外层 finally；已接管的源始终清理一次。
  尚未接管时，报告写`not-owned`与`closed: null`，不冒充已清理。
- 关闭调用传 expected PID，并在清理前重新复核 HWND/PID/StartTime/location；目标已消失算已结束，
  不会因为名字后来重现而关闭新窗口。
- 不结束原 Wallpaper Engine 进程，也不拿其它同前缀窗口代替本轮目标。
