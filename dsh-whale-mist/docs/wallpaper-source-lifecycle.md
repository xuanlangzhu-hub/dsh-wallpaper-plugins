# 壁纸源窗口收起与生命周期（2026-10-05）

状态：复审后仍需返工。A 的屏幕外放置有条件可行；B 的大部分路径已有处理，但建窗期间停止的竞态仍未通过。
审查清单：`wallpaper-source-lifecycle-review.md`。
本轮只做隐藏、屏幕外放置的对照实验；没有改正式主题、官方 EXE、app.asar、系统设置或 WE 全局配置。

## 1. 本轮起点与本轮改动

Git 起点：`7eca301`。工作区中 Claude 与前一位实现者的未提交改动全部保留，本轮没有 stage、commit 或回退它们：

```
 M dsh-whale-mist/README.md          （前人）
 M dsh-whale-mist/package.json       （前人）
 M dsh-whale-mist/src/client.js      （前人，生成文件）
?? NEXT_TASK.md                      （任务文件）
?? dsh-whale-mist/docs/              （前人 + 本轮新增一篇）
?? dsh-whale-mist/qa/appearance-*.js|mjs （前人）
?? dsh-whale-mist/qa/wallpaper-preview/  （前人 + 本轮修改）
?? dsh-whale-mist/qa/wallpaper-probe/    （前人 + 本轮修改）
```

本轮新增/修改（相对上述起点）：

| 文件 | 改动 |
| --- | --- |
| `qa/wallpaper-probe/ProbeJournal.cs`（新增） | stderr 诊断信封：`{"kind":"log","level","scope","message","detail","at"}`，每行一个 JSON |
| `qa/wallpaper-probe/Program.cs` | 诊断改走信封；新增 `--owned-location`、`--echo-on-stderr`、`--window-status`、`--window-ensure-closed`、`--window-foreground`、`--window-screen`、`--window-onscreen`、`--window-at`、`--self-test-lifecycle`；每帧记录 `captureSource`；`--we-open/--we-close` 输出 JSON 结果 |
| `qa/wallpaper-probe/SourceWindowHelper.cs` | 名称/路径校验、`JoinArguments` 引号处理、唯一窗口证明、`EnsureProbeWindowClosed`、命中测试、虚拟桌面范围、应用动作前 HWND 复用核验 |
| `qa/wallpaper-probe/README.md` | 新命令、诊断通道、窗口操作实测矩阵 |
| `qa/wallpaper-preview/probe-log.js`（新增） | Host 侧 stderr 分类：只有 `level:"error"` 是失败 |
| `qa/wallpaper-preview/managed-window.js`（新增） | 本轮窗口名校验、样例路径校验、唯一窗口轮询、helper 调用封装 |
| `qa/wallpaper-preview/index.js` | Host 生命周期编排：建窗 → 校验 → 采集（要求 window 捕获项）→ 移出屏幕 → 幂等停止 → 关窗；失败回滚 |
| `qa/wallpaper-preview/tests/log-journal.test.mjs`（新增） | stderr 误判回归 8 项 |
| `qa/wallpaper-preview/tests/capture-journal.test.mjs`（新增） | 真实窗口的成功运行只产生 info 诊断；pipe 模式 stdin EOF 停止 |
| `qa/wallpaper-preview/tests/lifecycle.test.mjs`（新增） | 生命周期顺序、回滚、幂等停止、身份不匹配不操作 9 项 |
| `qa/wallpaper-preview/tests/managed-session.e2e.mjs`（新增） | 真实窗口端到端：建窗→采集→移出屏幕→关闭，无残留 |
| `qa/wallpaper-preview/browser-regression.mjs` | 背景隐藏断言等待从 3 秒放宽到 5 秒（客户端需“无帧 >3 秒 + 每秒检查”，原值在负载下竞态） |
| `qa/wallpaper-preview/package.json`、`README.md` | 0.0.6、新增文件清单与生命周期说明 |
| `qa/experiment-window-modes.mjs` | 重写：唯一命名轮次、逐阶段窗口状态采样、捕获来源校验、原生关闭与清理核对 |
| `qa/experiment-window-interleaved.mjs`（新增） | 可见/屏幕外交替对照，排除机器负载漂移 |
| `qa/experiment-window-toggle.mjs`（新增） | 单个窗口操作的开/关矩阵 |

未改动：正式主题 `src/client.js`、图标程序、旧 Tauri/WSL、官方 EXE、app.asar、Desktop Profile、
WE `wallpaperconfig`/`general.user`、桌面壁纸与原始 scene.pkg。

## 2. 两项修复

### 2.1 成功的 stderr 日志被误判为错误

现象：native 在成功启动时向 stderr 写 `[Desktop] OpenDesktop: 752, SetThreadDesktop: True, err: 0`，
原 Host 把「任何非 JSON 的 stderr 行」都记成 `failure`，一次健康的采集会立刻被判失败。

归因更正（审查意见）：9:24 那一轮隐藏实验四个阶段全部 0 帧，**不能**归因于这个 Host 误判——
那次对照脚本直接运行采集程序，不经过 preview Host。那次是现场采集没有产生帧的独立失败
（9:24:13–16 建目录、9:24:26 改写脚本、9:29 写出全 0 结果，阶段目录为空）。
stderr 误判是同期发现的另一个缺陷，两者互为独立证据，报告中不再互相引用。

修复：native 的错误/诊断统一为带 `level` 的 JSON 信封；Host 只把 `level:"error"` 当失败，
info/warn 进入 `report().diagnostics`，`scope:"Status"` 的状态行仍解析进 `report().native`。
兼容旧 helper：纯文本 `[Desktop]` 视为 info、`[Capture]` 视为 warn；无法解析的行仍是有界失败（不静默）。
本轮自查时还发现并修掉了同一类误判的第二处：probe 自己回显的 JSON 诊断对象也必须算 info，
否则真实窗口测试仍会误报（见 `probe-log.js` 的 `parseLogLine` 与 `tests/log-journal.test.mjs`）。

证据：`tests/capture-journal.test.mjs` 用真实 WE 窗口跑 30 fps 采集，成功运行时
`journal.errorCount === 0`，且存在 `[Desktop] SetThreadDesktop` info 行；pipe 模式下父端 `stdin.end('stop')`
得到 `reason=parent-stop`、退出码 0、error 0。

### 2.2 关闭壁纸接口缺少唯一窗口名校验与参数处理

修复前：`--we-close <名字>` 直接把名字拼进 CreateProcess 命令行，不校验、不查窗口是否存在；
`openWallpaper` 的窗口名同样未加引号。现在：

- `RequireProbeLocation`：必须 `WhaleWallpaperProbe-` 前缀，长度 1..120，只允许可打印 ASCII，
  拒绝 `" \ / ; & | ^ %` 与控制字符（引号、注入、路径分隔符全部拒绝）。
- `RequireProjectFile`：必须是绝对 `.json` 路径，拒绝引号/分号。
- `JoinArguments`：所有 CreateProcess 参数按 Windows 规则加引号，名字含空格也不会被拆开。
- `CloseWallpaper`：副作用之前要求「当前恰好一个同名 `wallpaper64` 窗口」（0 个拒绝、多个拒绝），
  再发官方 `-control closeWallpaper -location <本轮名字>`；不使用无目标 closeWallpaper，
  不结束 wallpaper64 进程，不发全局 pause/stop/mute。
- `EnsureProbeWindowClosed`：关闭后按 250 ms 间隔有界等待窗口消失，返回 `closed`、`waitedMs`、`hwnd`。
- `ApplyAction`：动作前除了标题前缀与进程名，还要求枚举出的唯一窗口 HWND 与调用方 HWND 一致（防 HWND 复用）。

自动证据（`WallpaperProbe.exe --self-test-lifecycle`，12 项、0 mismatch、不创建/移动/关闭任何窗口）：
空名字、错前缀、`WhaleWallpaperProbe-x" -control pause` 注入、含 `/`、超长、非 json 样例、文件名含引号
全部被拒；合法样例与合法轮次名通过；无效 HWND、不存在的名字、未知动作被拒。
实际命令也验证：`--we-close NotOurWindow`、`--we-close <不存在的合法名字>`、`--window-status <不存在>`
均 exit 1 且 stderr 给出 error 信封，未触碰任何窗口。

## 3. A：窗口收起方式的对照实验

样本：Lucy 场景 `E:\SteamLibrary\steamapps\workshop\content\431960\3521337568\project.json`，
WE 路径核对为 `E:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe`（一致）。
每一轮用唯一窗口名新建独立窗口，采集 `memory` 模式、30 fps 上限，结束后用官方 closeWallpaper 关闭本轮窗口；
用户原来的 wallpaper64（PID 33272，9:44 启动）全程保留。所有桌面操作在用户确认「方便，现在开始」后执行。

### 3.1 失败过的方法

| 方法 | 实测结果 | 限制 |
| --- | --- | --- |
| `SW_HIDE` 真隐藏 | 0 帧。`CreateForWindow` 返回 HR 0x80070057（窗口不可见） | WGC 无法为不可见窗口建立捕获项；隐藏后 `show` 能恢复（21.31 fps），所以是方法不可用而非进程损坏 |
| 屏幕外 + `WS_EX_TOOLWINDOW`（去任务栏/Alt-Tab 入口） | 0 帧，同样 HR 0x80070057（窗口 visible=true 但 exStyle=0x180） | tool 样式直接破坏捕获；去掉样式后恢复 21.35 fps |
| 只去掉边框/只改 z-order | 未采用 | z-order `bottom` 实测 21.36 fps 正常，但它不解决遮挡与入口问题，不作为收起方案 |

首次对照运行（`.tmp/.../WhaleWallpaperProbe-20261005-ctl-021135`）还暴露出一个实验设计缺陷：
`offscreen-tool` 与 `onscreen` 阶段拿到了 1902×1071 的整屏帧，而基线是 1284×767。
当时 probe 在 `CreateForWindow` 失败后会静默回退到 `CreateForMonitor`，帧数与哈希变化来自整个桌面，
不能证明源窗口在出画。该现象只在 9:24 那轮（未加校验）出现；本轮已删除全部回退路径，并给每帧加 `captureSource` 字段，
后续所有阶段都确认 `captureSource=window`。

### 3.2 选用方法：不激活的屏幕外放置

流程：先按唯一名字创建窗口并等它出现 → 在窗口可见时建立 WGC 捕获项 → 确认帧确实来自该窗口
→ `SetWindowPos(-32000, -32000, 1280×720, SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_SHOWWINDOW)`
（不激活、不改其它样式）。屏幕外窗口仍是普通任务栏窗口，因此不能先隐藏或先去任务栏入口。

单个操作开关矩阵（同一窗口、同一轮负载、每段 8 秒 readback；当时用 `--require-window-item` 表达「只采指定窗口」，
返工后该开关已删除、只采指定窗口成为唯一行为。证据：
`.tmp/.../WhaleWallpaperProbe-20261005-tgl-021834/toggle-results.json`）：

| 步骤 | 窗口状态 | 帧数 | fps | captureSource | 退出码 |
| --- | --- | --- | --- | --- | --- |
| 屏幕内基线 | visible, exStyle 0x40100 | 171 | 21.26 | window | 0 |
| `hide` | visible=false | 0 | — | — | 1 |
| 隐藏后 `show` | visible=true | 171 | 21.31 | window | 0 |
| `offscreen` | visible=true, (-32000,-32000) | 171 | 21.36 | window | 0 |
| 回屏幕 | visible=true, (100,100) | 172 | 21.37 | window | 0 |
| `offscreen-tool` | visible=true, exStyle 0x180 | 0 | — | — | 1 |
| 去 tool 样式回屏幕 | visible=true, exStyle 0x40100 | 171 | 21.35 | window | 0 |
| `bottom` | visible=true | 171 | 21.36 | window | 0 |

这组数据回答了两个问题：哪些操作会破坏捕获（隐藏、tool 样式），以及屏幕外放置本身是否掉帧（不掉）。
清场：`--window-ensure-closed` 报告 `closed=true, waitedMs=593`，剩余 probe 窗口 0。

### 3.3 可见/屏幕外交替对照（排除负载漂移）

第一屏运行里同一窗口状态出现过 12.75 fps 与 9.54 fps，说明机器负载在漂移，逐状态长阶段无法归因。
于是做交替对照（`.tmp/.../WhaleWallpaperProbe-20261005-int-021550/interleaved-results.json`），
每段 12 秒、剔除前 2 秒预热：

| 阶段 | 状态 | 帧数 | 稳态 fps | 最大帧间隔 | readback P50 |
| --- | --- | --- | --- | --- | --- |
| 01a | 屏幕内 | 255 | 21.47 | 132 ms | 10.75 ms |
| 01b | 屏幕外 | 166 | 12.49 | 142 ms | 20.63 ms |
| 02a | 屏幕内 | 158 | 11.69 | 149 ms | 48.61 ms |
| 02b | 屏幕外 | 157 | 11.57 | 147 ms | 50.58 ms |
| 03a | 屏幕内 | 159 | 11.70 | 171 ms | 49.01 ms |
| 03b | 屏幕外 | 158 | 11.70 | 177 ms | 46.14 ms |
| 04 | 屏幕内→6 秒时移出屏幕 | 225 | 10.21 | 157 ms | 64.32 ms |
| 05 | 屏幕内 | 156 | 11.42 | 141 ms | 55.03 ms |

所有阶段 `captureSource=window`、尺寸 1902×1071（1280×720 窗口在 150% DPI 下的物理像素含边框），
所以这些数字是同一目标的同口径比较。吞吐与 `readbackMs` 同步变化（10.75 ms → 21.5 fps；48 ms → 11.7 fps），
提示差异来自 GPU/机器负载。02/03 两对是唯一"同状态、紧邻、负载一致"的配对：

- 屏幕内 11.69 / 11.70 fps，平均 11.70
- 屏幕外 11.57 / 11.70 fps，平均 11.63
- 屏幕外 / 屏幕内 = 99.5%

但审查指出：这是**挑选出来的两对**，第一对 21.47 → 12.49 fps 与 04 阶段切换后的下降仍在，
位置因素并未被排除。因此本节只作"位置不是唯一因素"的观察，**不作为性能门槛通过的结论**。

04 阶段在一次运行内 6 秒处移出屏幕：移出前 18.68 fps（readback P50 12.5 ms），
移出后 8.27 fps（readback P50 66.1 ms）。这个下降与机器负载台阶同时发生（17 秒后的 05 阶段同样只有 11.42 fps），
因此不能归因于屏幕外放置；要严格区分需要空闲机器上的重复测量，本轮不具备该条件，如实记录。

### 3.3.1 审查要求的同分辨率补测

`qa/wallpaper-preview/tests/redo-60s.mjs`：一次运行内先把窗口固定为同一尺寸，再录三段，
逐帧要求 `captureSource=window`。这是本轮唯一满足"同分辨率 + 明确 window 来源 + 连续 60 秒"的记录。

| 段 | 时长 | 帧数 | window 来源帧 | 尺寸 | 稳态 fps | 最大帧间隔 | readback P50 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 可见基线 | 60 秒 | 566 | 566 | 1902×1071 | 8.54 | 2251 ms（47.3 s） | 66.29 ms |
| 屏幕外 | 60 秒 | 646 | 646 | 1902×1071 | 9.96 | 188 ms | 66.25 ms |
| 恢复可见 | 20 秒 | 1285 | 1285 | 1902×1071 | 21.46 | 86 ms | 11.33 ms |

屏幕外段 645/646 个帧哈希不同、646 个源时间戳不同，无 >3 秒冻结。
但 116.6% 的比例**不能**读作"屏幕外更快"：逐秒帧数显示两段都在 21–22 fps 与 8–9 fps 两个台阶之间切换
（可见基线前 4 秒 21–22 → 8–9 → 47 秒停滞 2251 ms → 48–60 秒 1–11；屏幕外 19–22 → 8–9 → 最后 8 秒回到 21–22），
差异来自测量窗口落在不同台阶。三段都受同一机器负载影响，足以说明"位置可用"，
不足以给出稳定的性能比值。

### 3.4 通过要求逐条判定

| 要求 | 判定 | 依据 |
| --- | --- | --- |
| 源窗口内确有动态画面、无 >3 秒冻结 | 通过（仅采集侧） | 补测屏幕外 60 秒：646 帧、645 个不同哈希、最大帧间隔 188 ms；此前 ctl 运行因缺 `captureSource` 只作方法初筛 |
| 源窗口不盖住 DSH、不抢焦点、不拦聊天 | 通过 | 窗口在 (-32000,-32000)；屏幕点 (860,480) 命中测试 rootHwnd 是前台应用窗口，不是源窗口；采样中源窗口从未成为前台（`probeWasForeground=false`） |
| 任务栏/Alt-Tab 入口 | **仍存在** | 屏幕外窗口 exStyle 0x40100（含 WS_EX_APPWINDOW），是普通可见窗口；去掉入口的 `WS_EX_TOOLWINDOW` 会停帧 |
| 稳态帧率 ≥ 同轮基线 80% | **未严格判定** | 负载混杂：同轮可见段 8.54 fps、屏幕外段 9.96 fps，但恢复段又回到 21.46 fps，说明比值由负载台阶决定；不宣布达标 |
| 可撤销、能关掉本轮窗口 | 通过 | 恢复段 21.46 fps；`--window-ensure-closed` 关闭本轮窗口且原 wallpaper64 保留 |
| DSH 内持续动态显示 | **本轮未验收** | 采集侧数据不能等同于官方 Desktop 界面内的显示；需要一次安装后的会话 |

结论：**屏幕外放置有条件可用（临时方案），不能记作「完全隐藏」，性能门槛未严格通过**——
与任务书对该情况的定义一致。真正隐藏（SW_HIDE）与去任务栏入口（WS_EX_TOOLWINDOW）在本机被 WGC 直接拒绝，
是本次的负结论。

## 4. B：生命周期

负责组件：实验插件 Host（`qa/wallpaper-preview/index.js` 的 `createWallpaperBridge`）负责编排，
原生 `WallpaperProbe.exe` 负责窗口管理、身份核验与采集，Host 不直接调 user32。

| 阶段 | 动作 | 归属 / 失败回滚 |
| --- | --- | --- |
| 开始 | 校验本地配置 → 生成/校验本轮唯一窗口名与样例路径 → `--we-open` | 建窗前无副作用；名字或路径不合格直接失败 |
| 校验 | 建窗调用与身份轮询并行；真实采集只等轮询结果，teardown 等"有界裁决" | 建窗报错 → 裁决**先**跑完有界轮询再上报失败，因此报错后晚到的窗口仍会被观察到并关闭；窗口始终不出现 → 回滚并报有界错误 |
| 采集 | 启动采集并带 `--owned-location <本轮名字>`；捕获项在窗口仍可见时建立 | 指定窗口的捕获项失败即退出；不存在子窗口或整屏回退，不会把整屏帧当成源窗口 |
| 收起 | 确认帧来自该窗口后 `--window-apply <HWND> offscreen --location <本轮名字> --pid <进程>` | 动作前核验唯一窗口、HWND、PID 与所属进程；失败记入 `failure`，不静默 |
| 停止（按钮/Esc/HTTP stop） | 幂等：采集 stdin `end('stop')` → 2.5 秒兜底只杀自己的子进程 → 等窗口裁决 → `--window-ensure-closed <本轮名字>` | 重复停止复用同一个 promise；裁决有界（建窗挂起时宽限后仍会继续观察），晚到窗口同样被关闭 |
| 停用插件/正常退出 Host | `ctx.effect` 的 disposer 调用同一个 `stop()` | 与手动停止同一条路径 |
| 采集进程意外退出 / 源窗口被手动关闭 | `close` 事件或 stderr error 信封 → `stop()` → 关窗 → 前端恢复普通主题 | 不重启、不循环；失败原因写进 `bridge-final.json` |
| 父 Host 断开 | 原生按 `--owned-location` 关闭本轮窗口，结果写进 `summary.json` 的 `windowClose` | 见 `tests/capture-journal.test.mjs` 的 `parent disconnect leaves no source window behind`（测试自己不关窗） |
| Host 与原生同时被强杀 | 无人清理，窗口名留待人工 | 明确边界，不声称可自动恢复 |

身份核验先于有副作用的窗口操作：`--we-close`/`--window-apply`/`--window-status` 都要求唯一同名窗口、
`wallpaper64` 进程、以及（apply 时）HWND 与 PID 与调用方给出的本轮身份一致。

自动验证：`npm test` 38 项全部通过，其中 lifecycle 18 项覆盖建窗顺序、非 window 不回退、幂等停止只关一次、
建窗中途停止必须等待裁决后再关窗、teardown 启动后晚到的窗口仍被关闭、建窗报错但有窗口时仍清理、
建窗报错且无窗口时不进入采集、唯一窗口匹配不唯一时拒绝操作、采集子进程自行退出不重启、
error 信封停止并报因、非法配置零副作用、名字路径校验、helper 非零退出错误信息。
端到端 `node tests/managed-session.e2e.mjs` 用真实窗口跑通：建窗 → `captureStarted` → 屏幕外 4 秒内
帧数持续增长 → 命中测试确认不遮挡 → 停止后 `failure=null`、`summary.reason=parent-stop`、
剩余 probe 窗口 0。

## 5. 构建、测试与实测数据

自动检查（本轮全部在 `F:\deepseekharness` 执行）：

| 命令 | 结果 |
| --- | --- |
| `dotnet build qa/wallpaper-probe/WallpaperProbe.csproj -c Release` | 0 警告 0 错误 |
| `WallpaperProbe.exe --self-test-lifecycle` | 12 例，0 mismatch，无窗口副作用 |
| `npm run build` / `npm run check`（preview） | 通过 |
| `npm test`（preview，38 项） | 38 passed / 0 failed |
| `node browser-regression.mjs`（连跑 3 次） | passed，渲染 27 帧，解码错误 0 |
| `node tests/managed-session.e2e.mjs`（真实窗口） | 通过，无残留 |

实测吞吐与分段耗时（memory 模式，30 fps 上限，采集侧口径）：

| 运行 | 帧数 | 稳态 fps | readback P50 | jpeg P50 | encode P50 | 来源 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 上一轮 pipe | 2215 | 21.55 | 9.00 ms | 6.72 ms | 16.67 ms | `wallpaper-stream-20261004-01/performance.json` |
| 恢复的可见基线（本轮开始前） | 336 | 10.14（剔除前 3 秒） | 63.28 ms | 42.77 ms | 107.27 ms | `.tmp/wallpaper-baseline-restored-20261005` |
| 本轮第一屏可见基线 | 1292 | 21.57 | 8.82 ms | 8.06 ms | 17.81 ms | `WhaleWallpaperProbe-20261005-ctl-021135` |
| 本轮第一屏屏幕外 | 1170 | 12.75 | 12.55 ms | 16.57 ms | 29.43 ms | 同上 `03-test-offscreen`（无 `captureSource` 字段，仅作方法初筛） |
| 本轮交替对照饱和配对 | 315 | 11.63 vs 11.70 | 46–51 ms | 33–42 ms | 82–98 ms | `...-int-021550` |
| 同分辨率补测：可见 60 秒 | 566 | 8.54 | 66.29 ms | 41.48 ms | 110.11 ms | `...-redo-033350/01-baseline-visible-60s` |
| 同分辨率补测：屏幕外 60 秒 | 646 | 9.96 | 66.25 ms | 42.34 ms | 110.73 ms | 同上 `02-offscreen-60s` |
| 同分辨率补测：恢复可见 20 秒 | 1285 | 21.46 | 11.33 ms | 15.43 ms | 27.59 ms | 同上 `03-restore-onscreen-20s` |

耗时数据校正（本轮最重要的数据说明）：

- 上一轮报告的 21.55 fps / 102.79 s / readback P50 9.00 ms / jpeg P50 6.72 ms 与
  `performance.json` 原始输出一致，不需要改数。
- 但 21.55 fps 不是「本机稳定能力」：同一台机器同一模式、同一天内，本轮测到 21.57 fps、21.46 fps，
  也测到 8.54 fps、9.96 fps、10.14 fps。差异与 `readbackMs` 同步（约 9–11 ms ↔ 63–66 ms），
  说明瓶颈是 GPU/机器负载，因此**不能把任一次绝对 fps 当作产品结论或达标率**。
- 同分辨率补测显示负载台阶会在一次运行内切换（21–22 fps ↔ 8–9 fps），所以"屏幕外/可见"的比值
  只有在同台阶内才可比；本轮**不宣布 80% 性能门槛通过**。
- `encodeMs` 是历史字段名，实际涵盖回读 + 编码 + 部分 I/O；`pipeMs` 在 memory/disk 模式恒为 0，
  不是延迟。这两点早已在 probe README 说明，本次未发现新的误用。
- 未复测 DSH 客户端端到端路径（上一轮 69.23 ms 平均估计延迟），本轮不做前后对比；上一轮的数字仍然只是软件估计。

## 6. 安装包、备份与现场核对

- 本轮新增实验包：`release/plugins/dsh-whale-wallpaper-probe-0.0.6.tgz`
  （SHA256 `281D814FF8714C2FD2B87F144F2C096C8AA546DE2AD5AD9DB6034ECD50765D98`，11 个文件）。
  0.0.1、0.0.2 原样保留；0.0.3/0.0.4/0.0.5 都是未安装的中间产物，按「不得覆盖同版本归档」在重新出包前删除，最终交付 0.0.6（含第三轮的晚到窗口回滚修复）。
- **本轮没有安装任何插件**：本轮不重跑端到端 UI 实验，因此 Desktop Profile 未改动，也无需按安装流程做新备份
  （最近一次 Profile 备份仍是 `C:\Users\HP\.dsh\backups\official-desktop-before-memory-stream-20261004-191013`）。
  Profile `package.json` 仍只引用 pet 0.3.0、reasoning-effort 0.8.0、whale-gitbash 0.1.0、whale-mist 0.6.0-rc.1。
- 现场核对：本轮创建的 probe 窗口全部关闭（每次实验结束 `remainingProbeWindows=0`）；
  用户原有 wallpaper64（PID 33272，9:44 启动）保留；DSH 正常窗口保留；WE 配置与原始素材未被写入。
- 证据目录：`.tmp/wallpaper-window-modes-control-20261005/`
  （`round-metadata.json`、第一屏 `-ctl-`、交替对照 `-int-`、开关矩阵 `-tgl-`、同分辨率补测 `-redo-`，
  以及被作废的 9:24 旧轮次 `failed-prior-run-20261005-0924/`）。
  旧轮次证据没有删除，按「保留证据」移到本轮目录并标注为无效（四阶段 0 帧、`summary: null`）。

## 7. 未完成项

1. 屏幕外窗口仍保留任务栏/Alt-Tab 入口，**不是完全隐藏**；真正隐藏与去入口在本机被 WGC 拒绝。
2. 未安装 0.0.6、未在官方 Desktop 里跑「启动/停止连续 3 次」「停用插件/退出 DSH」「采集子进程退出」
   「源窗口手动关闭」这些人工场景；这些属于安装后的一次有记录会话，需用户在场并且（本轮未获授权）改动 Profile。
   自动侧已覆盖对应逻辑，但「桌面观察」一栏仍是空缺。
3. **性能门槛未判定**：同分辨率补测证明位置可用，但可见/屏幕外两段都受机器负载台阶影响
   （21–22 fps ↔ 8–9 fps），无法给出稳定的 80% 比值；需在空闲机器上复测。
4. Host 与原生同时被强杀时没有存活清理者，窗口名会残留，只提供人工清理路径。
5. 建窗成功但窗口在约 6 秒宽限内未出现时，本轮按「失败」回滚；如果实际环境更慢，需要放宽宽限值。
6. 采集进程与源窗口的 hwnd 模式（`hwnd` 配置）仍保留给操作者手动创建窗口的旧流程，未删除。
7. 30 fps 目标未达到；长时负载（数小时）未做。
8. 浏览器回归的 3 秒→5 秒放宽是测试竞态修复，不是客户端行为变更；若审查者认为应改客户端阈值，需另行评估。
