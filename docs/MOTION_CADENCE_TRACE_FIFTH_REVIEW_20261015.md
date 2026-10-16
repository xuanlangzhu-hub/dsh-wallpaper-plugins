# 逐帧观测五审：取消与阶段统计通过，仅余停止确认的两个边界

日期：2026-10-15。Codex 对照[四审](MOTION_CADENCE_TRACE_FOURTH_REVIEW_20261015.md)、[任务书](GEMINI_NEXT_MOTION_CADENCE_TRACE_20261015.md)及[最新交付](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)独立复核。

**结论：L2 已闭合，L1 的挂起请求取消与单连接未确认降级已通过；只剩 L1-A、L1-B 两处终态确认问题，暂不准备候选。用户要求今天到这里，本轮写完文档即停止，后续待用户重新接续。** 不再按旧 R1–R5、F1–F4 或四审 L2 整体返工。

本轮仅冻结输入、隔离构建/离线回放、写复审及接续文档；没有修生产源码、版本、assets 或 Profile，没有安装或操作 DSH/WE、改设置、打包、提交推送或自动发消息。三体小球忽快忽慢的视觉根因仍未定位；以下问题是诊断数据完整性的边界，不等于播放故障根因。

## 1. 已闭合，保留不返工

证据目录：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-fifth-review-20261015-200533-bdc15d36`。冻结 32 份输入后，在冻结副本执行作者七类检查，并独立重放四审原反例。

| 项目 | 本轮独立结果 |
| --- | --- |
| L1 挂起请求 | 两轮 start→trace fetch 挂起→stop，两个请求均带 AbortSignal；假网络真实响应 abort 并 reject，300ms 时 pending=0、aborted=2，原来的跨 run 累积已消除 |
| L1 单连接终态不明 | 实际摄取路由先 204 保留 seq1/2，再 Host 关闭、尾批 seq3 得到 409；Host 虽仍只有早期健康 0，但 clientFinalized=false，分析 degraded、clientUnfinalized=1，不再误报 available |
| L2 多连接阶段 | 同 run/seq，A 解码10ms/绘制2ms/RAF，B 解码50ms/绘制8ms/timeout：decode count=2、mean=30ms；draw count=2、mean=5ms；RAF=1、timeout=1 |
| L2 失败不被覆盖 | A 解码失败、B 成功：decodeFailCount=1，state=degraded |
| 健康终态正例 | 单连接实际路由收到空 isStop 尾批后，clientFinalized=true、trailing=0、state=available |
| 客户端正常无在途停止 | 真实 client 先送普通批次，完成 ACK 后停止，确实补发 records=[]、isStop=true 的尾批，Host 收到最终确认 |

独立请求测试使用遵守 AbortSignal 的受控网络，不声称可以撤销已经抵达服务端的工作。F1 schema、F4 Host/native 真正在途门禁及迟到清理维持四审通过结论；原生 collector、Program、CaptureArguments 和 frame-hub 本轮相对四审均未再变，不重复运行已闭合的独立慢盘/native 故障实验。

## 2. L1-A（P2）：普通 ACK 在 stop 后到达，会被误当最终确认，漏发空尾批

位置：`dsh-whale-mist/src/client.js:617–619` 的成功响应分支，以及 `:558` 的空批次提前返回。

成功响应目前以 `isStop || r.stopped` 设置 `cadenceTraceStopConfirmed=true`。`r.stopped` 是响应到达时的状态，不能证明被 ACK 的请求携带了 `isStop:true`。

独立控制 `finalization-controls.mjs` 对真实客户端构造以下时序，trace POST 经真实生产 Host 路由：

1. 发出普通批次，含两个 draw 事件，payload 为 `isStop:false`；Host 已摄取，暂扣成功响应。
2. 调用 client stop，当前普通请求仍在途，设置 StopPending。
3. 在取消期限前释放该普通批次的 204 响应，两个已 ACK 事件被清空。
4. 回调因 `r.stopped` 将 StopConfirmed 置 true；finally 虽尝试补空停止批次，入口立即提前返回。

实际结果：总共只有 **1 个 POST，isStop=false**；本地缓冲 0、Host 记录 2 条、Host clientFinalized=false，分析为 degraded/clientUnfinalized=1。对照正例只改变 ACK 时机，先完成 ACK 再 stop 就会得到 **普通批次 + 空 isStop 尾批**。

这里 stop 命令响应为受控替身，故意保持 Host 诊断摄取窗口开放，排除 Host 关闭后的正常 409；证明的是客户端本可以送确认却自行跳过。它造成假“不完整”，并非又一次静默误报完整，也没有证明本机播放卡顿。

**最小补修与验收：** 只有实际发送了停止确认的请求得到成功 ACK，才可以设置最终确认；普通批次在 stop 后收到 204，仍应在现有次数/超时预算内补发停止确认。保留当前 AbortSignal、截止、旧 run 隔离、150 条切片和失败终止行为。补真实客户端的 ACK-before-stop、ACK-after-stop 两个正例；若 Host 确已关闭，继续如实降级，不要求为诊断阻塞播放停止。

## 3. L1-B（P2）：终态与未发量为全局标量，A 的确认可掩盖 B 的未发记录

位置：`dsh-whale-mist/src/wallpaper/session.js:1161–1171`；collector 的 `clientFinalized`/`clientTrailingUnsentCount` 导出及分析器 `clientUnfinalized` 判断。

路由将任意一个连接的 `isStop:true` 写成全局 `clientFinalized=true`，并用当前请求的 trailingUnsentCount 覆盖全局值。它没有按 connectionId/generation 保存终态归属；A 的 0 不代表 B 的 0。

`finalization-controls.mjs` 使用实际生产路由、collector 和 analyzer，同一 run 签发 A、B 两个连接：

1. A 普通批次送两条 draw；B 普通批次送两条 draw，并明确报告 `trailingUnsentCount=3`。
2. 此时真实 snapshot：finalized=false、trailing=3、records=4；分析 degraded。
3. **只有 A** 发送空 `isStop:true, trailingUnsentCount=0`，B 未发送终态。
4. 真实 snapshot 变成 finalized=true、trailing=0；分析转为 **available，clientUnfinalized=0**，B 已知的 3 条未发被掩盖。

这属于四审 L1 最终健康证明的剩余漏洞，**不是重开已经修好的 L2 阶段事件统计**。同 run 多连接/重连接缝本来就在任务范围内；无需实际打开第二个 DSH 或做 GPU 测试来修它。

**最小补修与验收：** 对实际参与 trace 的连接/代次维护健康与终态，最终汇总不得由其他连接的 0 或单个 isStop 清除未确认/未发状态。只签发但没有参与采样的连接如何处理，应明确规则，不能简单要求所有历史签发 ID 永久确认。保留有界存储，限制诊断元数据增长；不要以无限 Map 替代原环形边界。补上上述 A/B 反例，以及全部相关流分别完成后可正常 available 的正例，并验证旧连接/旧代次确认不能认证新流。无需扩展到播放调度或协议改造。

## 4. 回归与证据范围

| 日志/文件 | 结果与用途 |
| --- | --- |
| `author-suite.log`、冻结 `source/.tmp/motion-cadence-check-1792066076543/` | 作者原七类全通过；当前 C# 隔离构建 0 警告/错误，trace 正常环形自测、P4 等待54项、P3快照22键通过 |
| `check.log`、`host.log`、`p2.log`、`p3.log` | check、Host106项、P2十类、P3五类均通过；P3 使用本轮实际构建 helper，仅适配导入/路径及保留证据，patch 同目录 |
| `prepare-controls.py`、`network-stage-controls.mjs/json/log` | 四审挂起、迟到409及双连接阶段原反例按修后预期通过；挂起网络遵守 abort |
| `finalization-controls.mjs/json/log` | 两个健康正例，以及 L1-A、L1-B 独立具体反例；断言退出0表示结果与记录一致，不能解释为这两项实现已通过 |
| `audit.py`、`before.json`、`after.json` | 开始/收尾指纹、归档/Profile/日常安装字节比对 |

上述为离线受控回放。客户端实际 WHL1/decode/canvas 接缝与 native/Host 的合成阶段数值仍须分别描述，不能宣称完整真实捕获链、物理呈现/运动已验收。交付现在已明确区分正常原生自测与四审 Codex 独立假 Publish 故障注入，保留这一口径；将“L1、L2 已全数闭合”改为本轮实际状态即可。

## 5. 保护与今天的停止点

开始/收尾审计确认：32 输入在复审期间零变化；相对四审仅 client、Host collector/session、analyzer、QA 五份实现/测试与一份交付文档改变。旧54保护50份匹配，另4份仍是获准修改的观测接入文件；12份工作区原生运行资产保持，工作区版本 rc.30，rc.28/29/30/31 四归档、五份 Profile 和日常 rc.28 的28个安装文件均保持。P4四个核心等待/停止文件及 WHL1 framing 保持。

审查及接续文档已完成空白检查。历史报告与证据全部保留，作者原交付不由 Codex 代改。

**今天到这里，不执行下一步。** 后续用户重新接续时，可由用户将本报告交小G，只补 L1-A/L1-B、对应正反例和交付口径，再由 Codex 复核。当前不准备候选、不打包安装或操作 DSH/WE、不改 Profile/系统设置、调度/FPS/RAF/latest/尺寸，不提交推送或自动消息，不重跑 GPU/长测。球运动均匀性仍需在工具通过后另行决定针对性实机验证。
