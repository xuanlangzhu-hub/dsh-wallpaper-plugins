# Wallpaper 原生采集探针

独立诊断程序，使用 Windows.Graphics.Capture 采集一个明确指定的 WE 测试窗口。
它没有安装到日常插件中，也不修改官方 Desktop、WE 配置或原始壁纸资源。

## 本机构建

需要 Windows、.NET 10 SDK。首次构建会还原 Windows SDK 的 .NET 引用包和
固定的 Vortice.Direct3D11 3.8.3 诊断依赖。

```powershell
dotnet build F:\deepseekharness\dsh-whale-mist\qa\wallpaper-probe\WallpaperProbe.csproj -c Release
```

可执行文件位于 `bin\Release\net10.0-windows10.0.19041.0\WallpaperProbe.exe`。
生成的 bin/obj 不提交到 Git。

## 运行约束

先经用户确认方便，再用 WE 官方 `openWallpaper -playInWindow` 创建唯一名称以
`WhaleWallpaperProbe-` 开头的窗口。不要切换桌面壁纸。窗口 HWND 必须从当前窗口枚举获取。

参数顺序：`<HWND> <新的绝对输出目录> <秒数 1..1800> <目标采集 fps 1..30> [模式]`。
可选开关 `--echo-on-stderr` 与 `--owned-location <本轮唯一窗口名>` 可出现在任意位置。模式默认为 disk：

- disk：WinRT GPU 回读、JPEG 编码、逐帧发布最新图片。
- memory：保留相同回读和编码，只保存首末帧。
- readback：只做 WinRT GPU 回读，不编码图片。
- staging：直接 D3D11 暂存纹理回读，再按 memory 模式编码。
- frames：只取帧、记录源时间戳，不回读像素；不能用其帧数证明画面内容变化。
- pipe：WinRT 回读和 JPEG 编码后写入 stdout 二进制管道，首帧/最新帧也不落盘。
  配套预览 Host 读取标准输出；JSON 状态写 stderr，stdin 收到 stop 或关闭即退出。

捕获项只针对指定窗口：`CreateForWindow` 失败就报错退出，**不再回退到子窗口或整个显示器**，
每帧的 `captureSource` 恒为 `window`。
`--echo-on-stderr`：把原本写 stdout 的诊断改为 stderr 的 JSON 行，便于自动检查。
`--owned-location`：声明本进程拥有该名字的窗口；当父端断开（stdin EOF 或管道断开）而
JS 侧已无法清理时，由本进程用有界、带身份核验的关闭流程收尾，结果写进 `summary.json` 的
`windowClose`（`outcome`/`closed`/`waitedMs`/`safeToCleanUp`/`error`）。不传该参数时只读窗口、绝不关闭。

## 诊断与失败通道

stderr 每行是一个 JSON 对象：`{"kind":"log","level":"info|warn|error","scope":"...","message":"...","detail":"...","at":<ms>}`。
只有 `level":"error"` 表示采集失败；成功运行的 `[Desktop] OpenDesktop/SetThreadDesktop` 曾以纯文本输出，
被 Host 误判为错误，现在统一走该信封。pipe 模式下每秒状态和结束摘要分别使用
`scope":"Status"` 与 `scope":"Summary"`，message 为紧凑 JSON。

## 生命周期与身份核验辅助命令

这些命令在产生任何副作用前完成身份核验；失败时 stdout 为空、stderr 给出 error 信封、退出码 1。

- `--we-open <本轮唯一窗口名> <project.json> [宽] [高]`：官方 `openWallpaper -playInWindow`；
  所有 CreateProcess 参数都会加引号，窗口名与文件路径先做字符校验。输出启动进程 PID。
- `--we-close <本轮唯一窗口名>`：先要求当前恰好存在一个同名 `wallpaper64` 窗口，再执行
  `closeWallpaper -location <名字>`；名字前缀或字符不合格、窗口不存在或存在多个时拒绝执行。
- `--window-ensure-closed <本轮唯一窗口名> <超时毫秒> [--expect-pid <pid>]`：关闭并等待窗口消失，
  返回 `outcome` 为 `closed`/`absent`/`ambiguous`/`identity-changed`/`timeout` 之一以及 `closed` 布尔值；
  只有真正确认窗口不存在才返回 `closed:true`。
- `--window-status <本轮唯一窗口名>`：返回该窗口状态；不存在或有多个时拒绝。
- `--window-apply <HWND> <动作> [--location <本轮唯一名字>] [--pid <pid>]`：带名字时按调用方给出的
  轮次身份核验（唯一同名窗口、HWND 一致、PID 一致、所属进程为 wallpaper64），不带名字时只做前缀核验。
  动作：hide、show/restore、offscreen、offscreen-tool、onscreen、bottom。
- `--window-at <x> <y> <本轮 HWND>`：屏幕点命中测试，判断该点是否落在源窗口上。
- `--window-foreground` / `--window-screen` / `--window-onscreen <HWND>`：前台窗口、虚拟桌面范围、可见比例。
- `--window-find`：枚举 `WhaleWallpaperProbe-` 前缀窗口。
- `--self-test-lifecycle` / `--self-test-window-ops`：参数、关闭结果与身份拒绝用例自测，
  不创建、移动或关闭任何窗口。

所有模式都记录耗时；status 和日志约每秒刷盘，分析时统一剔除前 3 秒预热。
通过 PowerShell `Start-Process -WindowStyle Hidden` 启动采集程序，避免出现控制台窗口。
窗口标题和所属进程名会被校验；已有 frames.jsonl/summary.json 的输出目录拒绝覆盖。

输出：

- `first.jpg` / `latest.jpg`：首帧、最新帧。WGC 当前包含窗口边框，未做聊天背景裁剪。
- `frames.jsonl`：每帧相对时间、尺寸、JPEG 哈希、是否最小化/前台、处理耗时。
- `status.json`：最新一次成功采集的数据；停止出帧时不会持续刷新，不能当作心跳。
- `summary.json`：结束原因、帧数、画面变化次数和总时间。

`encodeMs` 是历史诊断字段名，计时实际涵盖 GPU 回读、JPEG 编码与部分文件 I/O，
不是纯编码耗时。新字段 acquireMs/readbackMs/jpegMs/packHashMs/imageWriteMs 分段计时。
pipe 模式另有 pipeMs；旧 imageWriteMs 在该模式中包含管道发布耗时，不能解读为磁盘写入。
哈希不同只表示采集内容不同，不证明音频反应或鼠标交互。
发布图片遇到 Windows 读锁时有限重试，然后保留上一完整帧并统计 skippedPublications；
异常会记录并以非零码退出，避免 Windows 未处理异常弹框阻塞退出。

按 Esc、创建输出目录下的 `stop.txt`、关闭目标窗口或到达时限均可停止采集。
该程序只读目标窗口；停止后不会自动关闭 WE 窗口，实验控制方必须按唯一窗口名执行
`closeWallpaper -location <本次窗口名>`，再检查探针退出、测试窗口关闭、原 WE 进程仍在。
不要使用无目标 closeWallpaper、全局 pause/stop/mute 或结束 WE 主进程。

正常 Windows 采集指示边框保留。探针不请求关闭指示，也不请求或更改系统隐私设置。
不在 FrameArrived 回调里等待 GPU 回读；通过独立异步循环读取帧池。
每帧复制、JPEG 编码和写盘是为诊断服务的实现，不能视为正式视频传输方案。

## 源窗口状态与捕获项（2026-10-05 实测）

同一窗口、同一轮负载下逐个切换窗口操作，每段 8 秒 readback + `--require-window-item`：

| 窗口操作 | 窗口状态 | 结果 |
| --- | --- | --- |
| 屏幕内可见 | visible, exStyle 0x40100 | 171 帧，21.26 fps，captureSource=window |
| `hide`（SW_HIDE） | visible=false | 失败：CreateForWindow HR 0x80070057，0 帧 |
| 隐藏后 `show` | visible=true | 恢复：171 帧，21.31 fps |
| `offscreen`（-32000,-32000） | visible=true | 171 帧，21.36 fps，内容持续变化 |
| 屏幕外后 `onscreen` | visible=true | 171 帧，21.37 fps |
| `offscreen-tool`（WS_EX_TOOLWINDOW） | visible=true, exStyle 0x180 | 失败：CreateForWindow HR 0x80070057，0 帧 |
| 去 tool 样式后 `onscreen` | visible=true, exStyle 0x40100 | 恢复：171 帧，21.35 fps |
| `bottom` | visible=true | 171 帧，21.36 fps |

结论：Windows.Graphics.Capture 无法为目标窗口建立捕获项的情况是「不可见」和「带 WS_EX_TOOLWINDOW」，
屏幕外放置和 z-order 变化不影响。因此采集项必须在窗口仍可见时创建，再把窗口移出屏幕；
不能先隐藏、先去掉任务栏入口再采集。屏幕外窗口仍保留任务栏/Alt-Tab 入口，只是不再是完整隐藏。
`--window-apply offscreen` 会显式传入 1280x720，因此会把窗口改成该尺寸。
矩阵由返工前的二进制测出；返工后 `--window-apply` 行为未变，但 `--require-window-item` 已移除——
「只采指定窗口、失败即退出」现在是唯一行为，不存在任何回退路径。

## 验证记录

见 [初次采集报告](../../docs/wallpaper-capture-20261003.md) 和
[性能与 DSH 接入报告](../../docs/wallpaper-integration-20261003.md)，以及
[内存流报告](../../docs/wallpaper-memory-stream-20261004.md)。

分析一组输出：`node analyze.mjs <包含各次运行子目录的目录>`，生成 performance.json。
真实 Windows 文件锁回归：`WallpaperProbe.exe --self-test-publish <新的测试目录>`。
该测试创建一个拒绝删除共享的读句柄，检查发布不会破坏旧帧、解锁后能恢复发布。

API 依据：

- [Microsoft CreateForWindow](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow)
- [Microsoft 屏幕采集](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture)
- [Microsoft 软件位图与 GPU Surface](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/imaging)
