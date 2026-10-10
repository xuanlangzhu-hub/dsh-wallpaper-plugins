# 给 DS：只读核查启动链与默认捕获设备

调查已交付，最新以 [Codex 修订记录](CAPTURE_DEVICE_STATIC_REVIEWED.md) 为准。DS 暂无需继续编码或重写报告；
下一步控制器由 Codex 准备，另约用户窗口验证。以下为原调查任务。

2026-10-10，先读 [同路径验证结果](CAPTURE_GPU_ALIGNMENT_20261010.md)。本机同 helper 路径/EXE/DLL，
C 从 PowerShell 启动 memory 选择 Intel，D 从正式 Host 启动 pipe 选择 NVIDIA。父环境与模式还未拆开。

这次只交一份简短静态调查，不继续写代码。允许新建 `dsh-whale-mist/docs/CAPTURE_DEVICE_STATIC_REVIEW.md`；
不要修改 src/原生 helper/QA 工具/package/Profile/系统注册表或历史证据，不启动真实进程/壁纸/浏览器，
不安装/打包/提交/推送。使用现有源码和已保存日志；核对 API 语义时只查 Microsoft/官方文档。

按下面四项完成，别扩大为 GPU 优化框架：

1. 列出 `src/wallpaper/session.js` 中实际 spawn 参数/选项、默认继承环境的证据；
   `src/index.js` / Host 的已知启动条件只按代码/记录说明，不假设未读取的进程环境值。
2. 对 `Program.cs` 比较 memory 与 pipe 在设备创建**之前**的不同初始化，以及之后的处理链差异。
   核对 `Native.CreateDevice`、WinRT/WGC 绑定和 `StagingReadback.DescribeDevice` 返回设备的含义。
3. 区分已证事实、合理假设与 unknown。默认设备选择可能受何种启动信息影响，必须有明确来源；
   不以“父 PID 不同”直接断言某个 NVIDIA/Windows 参数造成差异。
4. 给出最多两个后续最小验证建议，每项说明只改变什么、保持什么、什么输出能证伪假设、
   如何保留 stdin/背压/退出归属与清理。优先同一路径/父启动方式仅切 memory/pipe 的单因素方案。
   若要模拟 pipe 消费者，明确仅用于设备选择调查，不当正式 DSH 成本或实机通过。

如果源码不足以确定机制，就明确写 unknown 和最少还需哪些观测，别猜 GPU 绑定接口、改驱动或请求全局提权。
输出文件/行号、简短启动链、证据与两个以内建议即可；不重写过去报告，不做长篇自我反省。
完成后交 Codex 审查，再由用户确认是否进行下一次窗口测试。
