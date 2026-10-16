# 逐帧观测八审：七审实现通过，只余EOF测试等待时机

日期：2026-10-16。Codex 对照[七审](MOTION_CADENCE_TRACE_SEVENTH_REVIEW_20261016.md)、[最新交付](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)及[作者记录](MOTION_CADENCE_TRACE_GEMINI_REVIEW_20261016.md)独立复核。

**结论：七审 G1-I/O、G7-skip 的具体实现问题已闭合，生产实现无需继续返工。仅余 QA-EOF 一处测试时序小修（P3）：原七类脚本一次失败、一次通过，不能将偶然重跑通过作为可靠门禁。** 让3.8只补测试等待与交付记录，再Codex复核；候选前再按用户安排集中做Argon/Codex终审。

本轮固定33份输入，运行隔离构建/离线回放并写文档；未改生产实现、生产QA原文件、版本、assets、Profile或作者交付。没有安装或操作DSH/WE、打包、提交推送或自动消息。loopback测试的临时服务器结束时均已关闭；没有进行视觉实测，球运动根因仍未定位。

## 1. 七审两项已通过

证据目录：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-eighth-review-20261016-104112-6e5a07d0`。

| 独立控制 | 修后结果 |
| --- | --- |
| 七审真实HTTP、普通ACK延15ms | 原批与最终批均204；落盘序号[1,2,3]，finalized=true、available。测试替身stop请求约34ms返回，不作为本机DSH停止耗时承诺 |
| 200ms慢响应/截止耗尽 | stop约115ms返回；仍只落盘[1,2]，finalized=false、degraded；显式迟到最终批409，没有无限等待 |
| 真实FrameDecoder→FrameHub→streamFrames，同连接两次drain | 写出[1,5]；latest=1、skipped=3、duplicateSkip=1，duplicateEventCount=0、available |
| 完全相同skip记录再摄取 | duplicateEventCount=1、degraded，真重复检测保留 |

当前客户端已移除24轮微任务等待，停止/UI清除不等待网络；Host实际session在原生资源释放后提供100ms诊断接收窗口，再完成最终导出。多切片带trailing>0时不提前finalize。作者真实loopback的320条三切片、自然EOF/实际session导出、截止耗尽控制，在原脚本重跑及下节等待对照中通过。

G7按原因/跳过范围区分合法Host skip，七审实际背压反例不再误去重。保留这些实现，不改播放调度或frame-hub来隐藏事件。

## 2. QA-EOF（P3）：isClosed不是“导出完成”，用例偶发ENOENT

位置：`dsh-whale-mist/qa/perf/check-motion-cadence.mjs:1474–1478`；对应生产语义为`src/wallpaper/session.js:153,402–404`。

EOF用例轮询`eofSession.isClosed()`后立即读取`cadence-trace-client.json`。但isClosed定义为窗口已证明关闭；生产代码先赋`cleanupResult = nextCleanupResult`，再`await writeCadenceTrace()`。所以轮询可以在异步写盘/rename完成之前结束。

本轮原冻结脚本：

- `author-suite.log`：在EOF的readFile失败，`ENOENT cadence-trace-client.json`，退出1。
- `author-suite-rerun.log`：同一冻结源码，另一个新证据目录，七类全过，退出0。
- `author-await-close-control.log`：临时副本仅在读取前加`await eofSession.stop()`，等待已有closing/export promise；所有原断言不变，七类全过，退出0。修改差异在`await-close-control.patch`。

最小修正位置如下，供3.8补入生产QA原文件：

```js
// 原有 isClosed 轮询之后，读取导出文件之前：
await eofSession.stop(); // 取得并等待已有关闭/导出任务，不启动新的播放或实机操作
```

当前stop在关闭进行中会返回同一个cleaning promise，适合该测试；也可显式保留并等待本次自然关闭任务。**不要加任意固定sleep、吞掉ENOENT、删除断言，或改变生产isClosed语义来配合测试。** 源码先标记窗口安全关闭再完成诊断导出的顺序，不据此重开G1实现。

修正后将交付记录改为准确结果：原版一次失败/一次通过，临时等待对照通过，最终正式QA修后再核验。不能把临时对照当作原脚本已经修改。

## 3. 回归、范围与保护

| 证据 | 结果 |
| --- | --- |
| `author-suite.log`、`author-suite-rerun.log`、`author-await-close-control.log` | 如上保留一失败、原版重跑成功和仅等待任务对照成功，不覆盖原失败证据 |
| `check.log`、`host.log`、`p2.log`、`p3.log` | check、Host106、P2十类、P3五类通过；P3只适配导入/本轮隔离helper路径及证据保留，patch同目录 |
| 冻结`source/.tmp/motion-cadence-check-*`及作者日志 | 当前原生隔离构建0警告/错误、等待54项、P3快照22键、trace正常自测通过 |
| `closure-io-fast/slow.json/log`、`host-skip-controls.*` | 本轮两个原反例的正例及截止耗尽/真重复反例 |
| `assess-controls.*`、`finalization-controls.*`、`network-stage-controls.*` | 前轮信封/非法及错域记录/健康标志、容量与被迫淘汰未知、ACK/连接代次、挂起取消/409和L2统计控制保持通过 |
| `export-faults.*` | 当前Host慢write/rename、重试真实pending=1、迟到清理、两collector均降级保持通过 |
| `before.json`、`after.json` | 33输入复审期间零变化；临时QA等待对照另存新文件，不覆盖冻结输入 |

相对七审仅5份实现/QA及2份作者文档改变；原生CadenceTrace.cs和P4四核心、Program/CaptureArguments、AtomicFile、frame-hub均未再改变，不重复运行已闭合的原生故障实验。旧54保护50份匹配，另4份为此前获准修改的观测接入文件。12份工作区原生运行资产、rc.28/29/30/31四归档、五Profile与日常rc.28的28安装文件保持，工作区rc.30。

本报告及接续文档已完成空白检查。下一步只交3.8补QA-EOF及交付记录，Codex复核后结束常规返工；Argon保留到候选前集中联审。当前不准备候选/安装或操作DSH、WE/改设置调度/打包/提交推送/自动消息，不重跑GPU长测，不宣称小球运动已修复。
