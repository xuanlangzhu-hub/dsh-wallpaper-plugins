# Temporary Wallpaper Engine preview

机器本地、需人工监督的记忆流实验包：验证「原生采集 → Host 路由 → Desktop 客户端」这条链路。
它不是 Whale Appearance 的发布版本。

0.0.7 修复了与 Whale 配色/清晰画布的 CSS 优先级冲突，并提高实验背景可见度。
透明度覆盖只在实验正在显示画面时生效，停止后恢复原主题；输入框和菜单仍保持原有不透明度。
0.0.5 修复了返工轮发现的问题（启动竞态、父端断开后的清理、关闭结果核对、整屏回退、动作身份绑定）；
0.0.2 使用原生 stdout 管道和 DSH 认证响应流。画面不写盘，
原生采集仍会在本轮新建的输出目录里写有界的运行元数据用于测量。

安装前由受监督实验写出 `%TEMP%\whale-wallpaper-probe-live.json`，包含 `helper`
（WallpaperProbe.exe 绝对路径）、`output`（新的绝对输出目录）、`seconds`（1..600）、
`fps`（1..30），另加以下二选一：

- 受管模式：`location`（可省略，省略时自动生成本轮唯一的 `WhaleWallpaperProbe-…` 名字）、
  `file`（绝对 `.json` 工程路径），以及可选的 `width`/`height`；
- `hwnd` 模式：由操作者已经创建好的窗口句柄。

目标窗口的身份由 Host 通过原生程序自行核验；没有任何 HTTP 端点接受路径或命令。
停止/停用实验会关闭原生 stdin；兜底结束只针对它自己的子进程。

## 受管生命周期

1. 校验本轮窗口名与样例路径，通过原生 `openWallpaper -playInWindow` 建窗，轮询到「恰好一个同名窗口」为止。
   建窗调用与身份轮询分开跟踪：如果停止发生在建窗还没返回时，清理会等这次建窗有了结论，
   再决定要不要关窗，所以晚到的窗口也会被关掉；建窗失败但没有留下窗口时不会进入采集。
2. 用 `--owned-location <本轮名字>` 启动采集，原生因此成为该窗口的存活归属者。
   捕获项必须在窗口仍然可见时建立，因为 Windows.Graphics.Capture 拒绝隐藏窗口和带
   `WS_EX_TOOLWINDOW` 的窗口；现在没有任何子窗口或整屏回退，失败即退出。
3. 只有确认帧确实来自该窗口（`captureSource: "window"`）之后，才用不激活的方式把它移到
   `-32000,-32000`；`--window-apply` 会带上本轮名字与 PID 供原生核对，失败会记入 `failure`。
4. 停止是幂等的：先结束采集 stdin，再 `closeWallpaper -location <本轮名字>` 并有界等待。
   原生返回 `outcome`（`closed`/`absent`/`ambiguous`/`identity-changed`/`timeout`）与 `closed`，
   Host 只在 `closed === true` 时才算清理成功，否则把原因写进 `failure` 与 `report().window.cleanup`。
5. 父 Host 异常退出时不会执行 JS 清理，此时由原生在 stdin EOF/管道断开后按 `--owned-location`
   关闭本轮窗口，结果写进 `summary.json` 的 `windowClose`。若 Host 与原生同时被强杀，
   则没有存活清理者，窗口名只能人工处理。

WHL1 协议：24 字节头 + JPEG；magic（4 字节）、sequence u32、length u32、
UTC 采集时间 i64 毫秒、宽/高 u16，数值小端。JPEG 上限 8 MiB。采集时间戳由 WGC 单调时间戳估算，
不是硬件端到端延迟测量。

Host 与浏览器都只保留最新待处理帧。HTTP 排空施加背压并丢弃被顶替的帧。浏览器用
createImageBitmap 与 canvas 解码绘制，报告实际绘制帧和延迟，绘制后释放位图，不会在内存里
累积整段视频。

点击预览的停止按钮或按 Esc 可移除临时背景。停用/移除本插件会一并移除它的 DOM、样式、请求、
Host 路由，并关闭本轮窗口。采集连续失败时自动恢复普通主题。

## 诊断

原生程序在 stderr 每行写一个 JSON 对象：
`{"kind":"log","level":"info|warn|error","scope":"...","message":"...","detail":"...","at":<ms>}`。
只有 `level: "error"` 代表采集失败。成功运行时那行
`[Desktop] OpenDesktop … SetThreadDesktop: True` 过去会被报成错误，现在算信息。
旧版 helper 的纯文本 `[Desktop]`/`[Capture]` 行仍会被分类；无法解析的行按有界失败处理，不会静默丢弃。

构建/检查：`npm run build`、`npm run check`、`npm test`（需先构建原生程序）、
`npm run regression`（单元测试加独立的无头浏览器）、`npm run test:e2e-lifecycle`
（受监督：会创建并关闭一个真实 WE 窗口）。
打包的 client.js 由 client-main.js 加同一份在 Node 中测试过的 frame-protocol.js 生成。

安装版本化 tgz 之前先备份 Desktop Profile。保留每一个被引用的 tgz。
受监督测试结束后移除实验包。不要替换已安装的 Whale Appearance 包，也不要改动官方 EXE/app.asar 资源。

## 限制

窗口只是被移到屏幕外，不是真正隐藏：它仍保留任务栏与 Alt-Tab 入口，而一旦隐藏或设置
`WS_EX_TOOLWINDOW`，WGC 就无法再采集。停用插件只有在 Host 还活着、能执行清理钩子时才会移除窗口；
Host 与 helper 同时被强杀时，窗口名只能人工清理。JPEG 编码/GPU 回读、音频、输入转发和正式集成
仍属另外的工作。
