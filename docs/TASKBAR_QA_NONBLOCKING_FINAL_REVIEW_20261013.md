# C1 非阻塞 QA 补修复审通过

2026-10-13，Codex。复核 Gemini 更新后的 `TASKBAR_QA_NONBLOCKING_20261013.md` 与当前 `qa/taskbar-hide`，独立构建及复跑通过，前次 F1–F3 已闭合。无需继续返工这一组问题。

本次是离线复审，不能据此宣布昨日真实运行中 3069ms 的接收断帧已经消除。下一步先确认用户方便，再做一次 40 秒独立 C1 短验；尚未接入日常插件。

## 修正与独立证据

- **F1：晚发布的旧帧不会被升级为动作后新帧。** 完成时保存源采集单调时间和已观察序号的界限，只有两者均严格超过界限的已发布帧才记为 `postActionFrame`。真实 Runtime 入口反例中，帧采集时间 9468721.2514ms，假 worker 调用完成时间 9468746.4379ms；这张晚发布帧保持 `postActionFrame: null`，计入 `preCompletionFramesPublishedAfter: 1`，保留 `capturedAt`。后续真正新采集的第 12 帧被正常接受。
- **F2：初始化时钟偏移不再混进完成时间。** 以触发时的捕获秒数加运行时增量计算，单独记录偏移。沿用前次 1.2 秒偏移反例，结果为触发 5 秒、偏移 1.2 秒、完成 5 秒、后续帧 5.1 秒；不再出现后续帧早于完成时间的矛盾。Runtime 回归另覆盖时钟继续推进后的 5.35 秒完成值。
- **F3：任务调度与进程启动分开记录。** `actionScheduled` 表示调度，`executorEntered` 表示进入执行器；成功启动子进程后才经回调记录 `started: true`。前置枚举被阻塞时，独立反例仍为执行次数 0、`executorEntered: false`、`started: null`，没有冒充进程事实。回归覆盖启动前取消及确认启动后的状态。
- 非阻塞帧入口、单次动作、停止传播、worker 终止与退出确认、未确认则不关闭源窗口的门禁均保留。

## 本轮复跑

所有输出使用全新目录：

`F:/dsh-wallpaper-plugins/.tmp/taskbar-nonblocking-final-review-20261013-f58cb4cc`

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 隔离构建 | 退出 0 | `build/build.log`、`build/build-inputs.json`、`build/build-result.json` |
| 自检 | 109/109，退出 0 | `selftest.json`、`selftest.log` |
| 生成入口及生命周期 | 19/19，退出 0 | `generated-check/result.json`、`generated-check/check.log` |
| 无窗口假 worker 进程 | 5/5，退出 0，迟到动作 0 | `worker-check/bin/Release/net10.0-windows/worker-check.json`、`worker-check/check.log` |
| 前次三个独立反例 | 3/3 修正，退出 0 | `counterexamples/Program.cs`、`counterexamples/check.log`、`counterexamples/bin/Release/net10.0-windows/observations.json` |
| 构建输入 | 18/18 哈希未变 | `build-inputs-after.json` |
| 生产与运行环境保护文件 | 16/16 与原基线一致 | `guards-before.json`、`guards-after.json` |

保留当前 QA 源码与 Gemini 交付快照，也保留前次反例、构建及昨日实机原始证据。复跑直接链接本轮源码；三个反例仅适配新的报告字段并添加断言，未改变原事件顺序。真实窗口、Shell 和关闭边界由假实现替代。

## 接续边界

日常安装仍为 `0.6.0-rc.24`，Profile、活动包、生产源码/原生资产、官方 DSH EXE 和原 WE EXE 的保护哈希一致。本轮未开真实窗口、调用真实 Shell/WE、安装、改全局 GPU/FPS、提交或推送。

下一次独立短验关注动作期间的连续帧、接收间隔与源帧年龄，以及任务栏/Alt-Tab、焦点和最终清理。由用户报告实际观察；不能把 HRESULT 成功或本轮离线通过当成桌面验收。若这次真实断帧问题解决，再确定正式接入范围，不重复 GPU 调查或长时性能测试。
