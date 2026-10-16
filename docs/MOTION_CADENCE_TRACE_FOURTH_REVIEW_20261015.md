# 逐帧观测四审：三审反例已闭合，仅余请求收尾与阶段统计两项

日期：2026-10-15。Codex 对照 [三审](MOTION_CADENCE_TRACE_THIRD_REVIEW_20261015.md)、[任务书](GEMINI_NEXT_MOTION_CADENCE_TRACE_20261015.md)与最新 [Gemini交付](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)独立复核。

**结论：暂不准备候选；只补下面 L1、L2。** 三审明确举出的409无限续发、旧轮ACK触发新轮、Host write/client accept间隔混流、客户端健康字段未摄取、空签发集/错误可选字段，以及真实I/O门禁与迟到文件清理反例，已通过本轮独立回放。保留这些修复，不再按旧F1–F4整体返工。余下两项仍属原任务要求：请求本身的截止与终态证据，以及多连接下完整阶段统计。

本轮只在新的仓库 `.tmp` 固定输入、离线构建/回放、写审查文档。未修改生产源码、版本、assets、Profile、安装或系统设置，未操作DSH/WE、打包、提交推送或自动消息。球忽快忽慢的根因仍未定位，离线通过不代表视觉修复。

## 1. 已通过的具体控制

证据目录：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-fourth-review-20261015-193301-d6ce5e55`。

| 项目 | 本轮独立结果 |
| --- | --- |
| 正常签发与核心/可选字段 | 空集合400、外来连接400、缺核心字段400、字符串success/负duration400，合法记录204；不再补假零或转成成功 |
| 原ACK覆盖误删 | seq1..150在途期间发生覆盖，ACK后队列头151、保留8192条 |
| 成功停止尾批 | 350条全部提交，缓冲归零；150条切片保持 |
| 409终态 | 只发1次，清空并结清；测试第9次保护未被触发 |
| 旧轮迟到ACK | 新轮仍running，旧轮回调未提交新轮isStop尾批 |
| Host write/client accept/draw间隔 | 原多连接反例分别为33ms，不再是1033ms |
| 健康字段 | 实际POST摄取150覆盖/10丢弃/200未发后，分析为degraded并保留数目 |
| 大尾批 | 分片150条，正常draw-end样本约34KB；1000条输入最多4次，预算之外的数据不再无限续发 |
| Host tmp write/rename故障与重试 | 底层pending保持1，不再叠加2；解除挂起后无host/client最终文件残留，pending归零且degraded |
| 原样C# collector + 假Publish | 首次20ms超时后pending1，第二调用仍pending1；解除后pending0、两目标文件均不存在、FlushFailed=true |

Host/native这里通过的是“有界返回、在途管理、迟到清理”，不是操作系统I/O被即时撤销。20ms为原生离线控制预算，生产默认500ms未改；没有打开WGC/WE。

## 2. L1：挂起请求没有截止/取消，失败终态没有进入Host导出（P2，原F3剩余）

位置：`dsh-whale-mist/src/client.js` 的 `flushCadenceTrace`、`stop`，以及 `src/wallpaper/session.js` 的客户端trace摄取/停止导出。

### 2.1 次数上限没有覆盖永不返回的请求

`MAX_STOP_FLUSH_ATTEMPTS=4` 限制的是能走到完成回调的发送次数。trace fetch没有自己的AbortSignal或请求deadline；运行阶段已经在途的请求在stop时只设置StopPending，仍等待原请求，无法进入后续终止分支。

独立执行当前生产engine：两轮各记录1条，flush请求分别挂起，再正常stop。两次stop均返回，但300ms观察点仍有 **2个trace请求** 挂起，两个请求都没有AbortSignal。300ms只是观察点，不是建议的产品超时；从代码也没有配置任何后续截止。测试最后主动响应409才将它们结清。反复开始/停止可以跨run积累挂起请求，单run单在途和四次上限不能替代总资源边界。

### 2.2 终态“未发”仍只在客户端私有对象里

409/网络失败/预算耗尽会累加 `cadenceTraceTrailingUnsentCount` 并清空记录，但payload发送的是发送前的 `records.length - batch.length`，没有发送终止后的累计终态。清空后flush入口还会直接返回；Host会话关闭后普通trace POST也拒绝接收。没有单独的最终健康确认或“未收到终态”的降级规则。

独立接通真实Host路由的控制输入：

```text
seq1/2成功draw记录 → POST 204，Host保留2条，健康计数均0
seq3成功draw记录在途 → stop并确认Host会话关闭
迟到请求经真实路由返回409 → 客户端清空队列
Host导出仍仅seq1/2，clientTrailingUnsent=0、clientDropped=0
analyze仍state=available、unknown=false
```

已有两条记录的间隔本身可以计算；问题是导出无法说明第三条在停止时未送达、该run未完整收尾。三审的健康字段摄取已经修好，但只摄取此前成功请求中的字段，不能证明终态已经传播。

**只补：** 给每轮trace请求（包括stop前已在途的请求）明确deadline/可取消句柄和整体收尾预算，保证停止或换轮后能结清其请求引用；不拖延原采集/源清理。将最终drop/unsent/complete状态与正确旧run、连接、代次关联；Host没收到最终确认时应明确unknown/incomplete/degraded，不能把早期健康0当作最终0。具体可选受限最终健康消息或Host侧缺终态规则，但不允许迟到数据落入新run，也不扩写旧22/36指标。增加pending不返回、停止后409、最终网络失败及预算耗尽的实际client→Host导出→analyzer控制；保留本轮修好的终态次数上限、run绑定和稳定batchId。

## 3. L2：间隔已隔离，耗时/调度/失败仍被同序号另一连接覆盖（P2，原F2剩余）

位置：`dsh-whale-mist/qa/perf/analyze-motion-cadence.mjs` 的getFrame、client event赋值、decodeDurations/drawDurations与anomalies累计。

本轮Host write、client accept及draw间隔已经使用连接/代次事件列表，保留。但是decode-end、schedule-fire及draw耗时/结果仍落在 `(runId, sequence)` 的单个标量上，统计仍只读取最后一次值。存在clientDraws数组不等于drawDurations统计已经使用该数组。

独立输入同一run/seq的两个合法连接，所有字段均有效：

| 输入 | 当前输出 |
| --- | --- |
| A：RAF、decode10ms、draw2ms；B：timeout、decode50ms、draw8ms | state=available；decode count=1/mean50、draw count=1/mean8；RAF=0、timeout=1。A的阶段事件全部消失 |
| A：decode失败；B：同帧decode成功并draw | state=available、decodeFailCount=0，A的真实失败被成功覆盖 |

这不是原33ms间隔反例回归，而是三审明确要求的schedule/decode/draw阶段及失败统计尚未全部使用逐流记录。它会妨碍判断某个客户端的解码波动或失败是否造成不匀。

**只补：** 对每个连接/generation保留schedule、decode成功/失败、draw成功/失败/未执行及耗时事件；各域/流先独立统计，若输出合并统计也必须包含每个有效事件，不能由最后标量代表全部连接。重复事件仍保留原始异常与限制结论，不重复计数。增加上述双连接成功/失败控制，保持已经正确的Host/accept/draw间隔和代理；不改播放调度、并发、P4或旧指标。

## 4. 交付与证据口径

当前作者七类套件、构建与既有回归均通过；新增409/旧轮ACK、rename重试及间隔/健康反例确有价值。不要再宣称所有失败与有界收尾已经闭合，L1的pending状态并未被这些完成响应测试覆盖，L2也不能只用draw间隔的33ms断言替代。

原生collector自测源码仍是正常写盘成功控制，不能写成自测本身已覆盖挂起、并发门禁与迟到清理。本轮Codex用原样collector配假Publish独立验证并通过了这些边界，证据可直接引用，无需为闭合项重复跑一套原生实验。部分native/Host数值仍为synthetic fixture，应与真实客户端调用回放分开描述；不是本机捕获/物理运动实测。这里属于交付表述更正，不再另列实现阻塞项。

## 5. 执行结果与保护

| 检查/证据 | 本轮结果 |
| --- | --- |
| `before.json`、`source/` | 固定32输入；相对三审6份实现/QA与1份交付变化，frame-hub、Program/CaptureArguments未再改变 |
| `author-suite.log` | 冻结副本原七类全通过，当前helper隔离编译0警告/错误、trace自测、P4等待54项、P3实际快照22键通过 |
| `check.log`、`host.log`、`p2.log`、`p3.log` | check、Host106、P2十类、P3五类全通过；P3仍使用当前构建helper，仅适配导入/路径/证据保留，patch在同目录 |
| `controls.mjs/json/log`、`prepare-controls.py` | 三审具体反例按修复后的预期独立重放，断言通过；没有修改生产代码 |
| `network-stage-controls.mjs/json/log` | pending跨run、实际路由409后终态缺失，以及双连接阶段覆盖的独立反例 |
| `export-faults.mjs/json/log` | Host慢write、rename和stop重试实际session控制，证明门禁及迟到清理闭合 |
| `native-fault/`、`native-fault-build.log`、`native-fault.log` | 原样C# collector + 假Publish，编译0警告/错误；pending保持1、释放后文件清除与失败状态通过 |

开头与收尾after.json已确认：32输入在复审期间零变化；工作区仍rc.30，12份原生运行资产、rc.28/29/30/31四归档、五份Profile和日常rc.28的28安装文件保持。旧54保护50份匹配，另外4份仍为获准修改的观测接入文件；原P4四核心文件与WHL1 framing保持。审查与接续文档空白检查通过。

**下一步只交小G补L1、L2和交付表述，再由Codex复审。** F1校验与F4在途/迟到清理已闭合，不再机械返工或重跑。暂不准备候选、不安装或操作DSH/WE、不改Profile/系统设置、FPS/RAF/latest/尺寸、不打包/提交推送或自动消息，不重跑GPU/长测。运动均匀性的本机根因仍未定位。
