# C1 非阻塞独立短验通过：入口消失，原动作断帧未重现

本文件保留为同轮补充记录。统一接续入口为 [C1 非阻塞任务栏入口隐藏验收](C1_TASKBAR_NONBLOCKING_SHORT_TEST_20261013.md)，两份文档引用同一次 14:06–14:07 实机及同一证据目录，没有重复测试或两轮独立通过。以下保留原始收尾说明和采样定义。

2026-10-13，Codex。用户确认方便、助手已暂停后，执行一次 Lucy 独立 40 秒短验。
**本轮入口隐藏成功，动作等待期间采集持续推进，昨日约 3 秒的接收断帧未重现。**
日常 rc.24 保持不变；未安装、修改 Profile/生产资产、提交或推送。本轮仍是独立源与捕获流验收，尚未接入 DSH 正式播放生命周期。

## 方法与证据

证据根：`F:/dsh-wallpaper-plugins/.tmp/taskbar-c1-nonblocking-live-20261013-140628-3a3039`。

使用 [非阻塞补修复审](TASKBAR_QA_NONBLOCKING_FINAL_REVIEW_20261013.md) 中已构建的 QA 二进制，启动前核对 18 个输入与 2 个输出哈希。仅创建本轮唯一 `WhaleWallpaperProbe-C1-NB-20261013-140628-3a3039`，Lucy 项目、正坐标屏幕外源、同一 WGC 捕获会话、pipe 模式、40 秒、至少 10 秒基线后单次 DeleteTab。

没有改 owner/APPWINDOW/TOOLWINDOW、最小化或激活源，没有调用 AddTab 或重启 Explorer；末尾自动关闭本轮源。复用昨日监督控制器并换成本轮身份和新目录，所有原始报告保留。

原始证据为 `baseline.json`、`invocation.json`、`result.json`、`received-frames.json`、`capture/frames.jsonl`、`capture/summary.json`、`capture/taskbar-action.json`。分析在 `timing-analysis.json`、`decoded-pixel-analysis.json`，人工观察在 `human-observation.json`，保护与清理核验在 `postflight.json`。

## 结果

| 项目 | 本轮事实 |
| --- | --- |
| 用户观察 | 任务栏入口消失且未重现；Alt-Tab 未见条目；无闪窗/抢焦点；原桌面与 DSH 均正常 |
| 捕获 | 40.044 秒，duration 结束，857 帧，退出 0，未跳过发布 |
| 动作 | 第 214 帧触发，10.036 秒；完成 13.009 秒，等待约 2.973 秒 |
| 动作期间采集 | 继续推进 64 帧；最大接收间隔 53ms，最大源时间间隔约 50.11ms，最大帧年龄 59ms |
| 全程接收 | 中位间隔 47ms，P95 51ms，最大 88ms；末帧年龄 50ms |
| 取证时序 | 第 279 帧采集于完成界限之前，晚发布后正确单列旧帧；第 280 帧确实在完成界限后采到，作为 postActionFrame |
| 原生调用 | HrInit、DeleteTab 均 0x00000000，单次动作；worker started/exited=true，无超时或强制终止 |
| 窗口属性 | 调用前后可见、未最小化/未 cloaked；位置、尺寸、style/exStyle、owner/parent 和 Z 序读数保持一致 |
| 清理 | 原生源关闭成功，等待 916ms；监督确认本轮源不存在，QA 主/worker 剩余 0 |
| 保留 | 原 WE PID 11936、StartTime、路径不变；16 个保护文件哈希一致，安装仍 0.6.0-rc.24 |

全程源时间最大间隔约 150.08ms，接收帧年龄最大 159ms，均按原始记录保留；不把本轮结果表述为所有间隔恒定或零延迟。

昨日同步路径在动作处接收间隔 3069ms、旧帧年龄 3072ms；本轮动作本身仍花约 3 秒，但主采集不再等待它返回。在本机 Lucy 的这一次相同方法短验中，原阻塞现象未重现，不扩展为所有环境、壁纸或长期运行均已验证。

## 动态证据与边界

查看动作前后 JPEG 样本均为正常 Lucy 场景，无白条或黑屏。对动作完成后的第 325/646 帧解码，间隔约 15 秒，排除时钟区域后抽样 2445 点；25.6% 的点 RGB 平均差大于 5，整体平均绝对差 8.321。结合逐帧时间和内容变化，确认调用后继续输出动态画面，不只依赖 JPEG 哈希或元数据。

人工观察单独保存，原生报告中的 taskbarHidden/altTabHidden 仍为 null。Alt-Tab 未见仅代表用户本轮观察，不承诺 DeleteTab 在所有系统版本中都排除 Alt-Tab，也不承诺启动时入口从未出现。

收尾脚本第一次把 PowerShell 自动解析的 DateTime 和原始字符串比较，误报 WE 身份不一致；以 UTC ticks 复核后完全相同。初始核验文件另存，真实测试未重做，原 WE 未改动。网络中断发生在真实测试和清理完成之后，仅继续补文档。

下一步可以准备正式 Host 的 C1 接入范围：后台单次动作、继续出帧、停止传播、worker 退出确认、精确源身份和原 WE 保护沿用本次已验证方案；再另取新候选做启动/重启/停止生命周期短验。当前没有安装新候选，也不自动扩展 owner/样式矩阵、GPU 调查或长时性能测试。
