# 运动节奏逐帧观测与离线回放交付记录 (Codex 终审与 Gemini 候选前集中审查通过封板)

日期：2026-10-16
对应任务书：[GEMINI_NEXT_MOTION_CADENCE_TRACE_20261015.md](GEMINI_NEXT_MOTION_CADENCE_TRACE_20261015.md)
症状记录：[MOTION_CADENCE_SYMPTOM_20261015.md](MOTION_CADENCE_SYMPTOM_20261015.md)
首轮复审：[MOTION_CADENCE_TRACE_REVIEW_20261015.md](MOTION_CADENCE_TRACE_REVIEW_20261015.md)
二次复审报告：[MOTION_CADENCE_TRACE_SECOND_REVIEW_20261015.md](MOTION_CADENCE_TRACE_SECOND_REVIEW_20261015.md)
三审复审报告：[MOTION_CADENCE_TRACE_THIRD_REVIEW_20261015.md](MOTION_CADENCE_TRACE_THIRD_REVIEW_20261015.md)
四审复审报告：[MOTION_CADENCE_TRACE_FOURTH_REVIEW_20261015.md](MOTION_CADENCE_TRACE_FOURTH_REVIEW_20261015.md)
五审复审报告：[MOTION_CADENCE_TRACE_FIFTH_REVIEW_20261015.md](MOTION_CADENCE_TRACE_FIFTH_REVIEW_20261015.md)
六审复审报告：[MOTION_CADENCE_TRACE_SIXTH_REVIEW_20261016.md](MOTION_CADENCE_TRACE_SIXTH_REVIEW_20261016.md)
Gemini 扩展审查报告：[MOTION_CADENCE_TRACE_GEMINI_REVIEW_20261016.md](MOTION_CADENCE_TRACE_GEMINI_REVIEW_20261016.md)
Codex 逐条核实附评：[MOTION_CADENCE_TRACE_GEMINI_ASSESSMENT_20261016.md](MOTION_CADENCE_TRACE_GEMINI_ASSESSMENT_20261016.md)
七审复审报告：[MOTION_CADENCE_TRACE_SEVENTH_REVIEW_20261016.md](MOTION_CADENCE_TRACE_SEVENTH_REVIEW_20261016.md)
八审复审报告：[MOTION_CADENCE_TRACE_EIGHTH_REVIEW_20261016.md](MOTION_CADENCE_TRACE_EIGHTH_REVIEW_20261016.md)
Codex 收尾终审报告：[MOTION_CADENCE_TRACE_FINAL_REVIEW_20261016.md](MOTION_CADENCE_TRACE_FINAL_REVIEW_20261016.md)
Gemini 候选前集中审查报告：[MOTION_CADENCE_TRACE_PRE_CANDIDATE_REVIEW_20261016.md](MOTION_CADENCE_TRACE_PRE_CANDIDATE_REVIEW_20261016.md)

---

## 1. 任务概述与验收边界

> [!IMPORTANT]
> **本轮交付是诊断观测工具和真实调用路径的离线回放，不是播放调度修复：**
> 1. 用户反馈的“三个球突然加速、减速、再加速”视觉症状，与原先接近一秒的长停顿性质不同，平均 FPS（~30fps）或“无长停顿”无法作为运动均匀性验收标准。
> 2. 当前阶段仍缺真实小球物理位置轨迹及模拟步长，合成数值 fixture 与离线回放仅用于验证观测工具在各时钟域与调用接缝的有效性，**绝不冒充本机实测数据，亦不宣称该视觉问题已被定位或修复**。
> 3. 严格遵循不侵入原则：**不修改** RAF/timeout 调度策略、latest 帧覆盖逻辑、解码并发、背压行为、P4 等待内核计时、30fps 目标、截断/1ms 下限/空帧 2ms 规则、JPEG 尺寸/设备/主题/裁剪，以及场景与任务栏生命周期。

---

## 2. 八审实现确认与 QA-EOF 测试等待时序闭合

依据 [Codex 八审报告](MOTION_CADENCE_TRACE_EIGHTH_REVIEW_20261016.md)，七审针对 **G1-I/O**（跨真实 I/O 停止收尾）与 **G7-skip**（同连接 Host skip 身份去重）的生产实现已独立确认全数通过，生产代码无需返工。本轮仅对测试用例时序（**QA-EOF**，P3）进行补正，并如实记录测试结果：

| 分组与审查项 | 问题根因 | 补修实现与位置 | 验证用例与结果 |
| :--- | :--- | :--- | :--- |
| **测试时序补正 (P3)**<br>**QA-EOF** (自然 EOF 用例异步写盘竞争) | `session.js` 在 `runClose()` 中先赋 `cleanupResult`（使 `isClosed()` 变为 `true`），随后紧接 `await writeCadenceTrace()` 落盘。原 `check-motion-cadence.mjs` 在轮询 `isClosed()` 满足后立即调用 `readFile`，导致文件写盘尚未完成时偶发抛出 `ENOENT`（八审记录：原冻结脚本一次失败、一次通过）。 | `qa/perf/check-motion-cadence.mjs`:<br>在 Test 3.15 Sub-3b `isClosed()` 轮询之后、读取 `cadence-trace-client.json` 之前，补充 `await eofSession.stop()`。由于正在关闭时 `stop()` 直接返回并等待已有的 `cleaning` promise，该等待确保 `writeCadenceTrace()` 异步写盘与重命名彻底完成后再读取文件；不加固定 sleep、不吞掉 ENOENT、不改动生产 `isClosed()` 语义。 | `check-motion-cadence.mjs` Test 3.15 Sub-3b：<br>- 连续多次重跑均 100% 稳定通过，无偶发 `ENOENT`；<br>- 原版测试口径如实记录：原脚本存在一次失败/一次通过，正式加入 `await eofSession.stop()` 后七大类 100% 稳定全绿通过。 |
| **组 1：跨真实 I/O 收尾与终态补齐 (P2)**<br>**G1-I/O** (`stop()` 与 `/stop` 跨真实 HTTP I/O 竞争)<br>**G2** (自然流结束 EOF 尾批与 Host 导出) | 八审独立确认通过，生产代码无需返工。 | `src/client.js`, `src/wallpaper/cadence-trace.js`, `src/wallpaper/session.js`:<br>1. **客户端非阻塞触发**：移除 `client.js` 中 24 轮 `Promise.resolve()` 微任务循环，`finalizeRunCadenceTrace(targetRun)` 纯非阻塞同步触发；`connect()` 自然 EOF 与 `stop()` 均直接调用（不 `await` 网络），播放停止与 UI 状态切换绝不等待网络；<br>2. **Host 有界诊断收尾窗口**：`CadenceTraceCollector.updateClientStream` 仅当 `isStop === true && !(trailingUnsentCount > 0)` 时置 `stream.finalized = true`；新增 `waitForClientFinalize(timeoutMs = 100, issuedConnections)` 与 `notifyFinalizationWaiters()`；`createPreviewSession.runClose()` 在完成原生进程与窗口清理后、置 `isClosed()` 及写盘导出前有界等待客户端尾批确认（`registerWallpaperRoutes.closeSession()` 同样有界等待）。 | `check-motion-cadence.mjs` Test 3.15（真实 `127.0.0.1` HTTP server + 真实定时器）：<br>- Sub-3a (**G1-I/O 15ms 延迟正例**): 在途普通批次延迟 15ms 返回 204，触发 `stop()` 后尾批同样获 204，Host 导出包含完整记录且 `clientFinalized: true, state: 'available'`；<br>- Sub-3a-multi (**多切片正例**): 320 条积压分 3 批跨真实 I/O 排空后才标记 `clientFinalized: true`；<br>- Sub-3b (**G2 Host EOF 正例**): `createPreviewSession` 自然结束关闭流，客户端 EOF 尾批被 Host 完整摄取并导出 `available`；<br>- Sub-3c (**超时反例**): 200ms 慢响应逾越 100ms 窗口，Host 导出 `clientFinalized: false, state: 'degraded'`，迟到尾批返回 409。 |
| **组 2：身份/信封校验与有界流容量 (P2)**<br>**G4** (顶层 `generation` 与健康计数器 schema)<br>**G5 / L1-B-cap** (`clientStreams` 32 上限淘汰保留降级证据) | 七审已独立确认通过，保持不返工。 | `src/wallpaper/session.js` & `src/wallpaper/cadence-trace.js`:<br>1. **G4**: 严格校验顶层 `generation` 与健康计数器非负整数，校验记录与信封 `generation` 一致；<br>2. **G5 / L1-B-cap**: 保持 `clientStreams` 32 上限，优先压缩已完成健康流，被迫淘汰流状态沉淀至 `evictedUnfinalizedStreams`、`evictedTrailingUnsentCount` 等有界汇总字段。 | `check-motion-cadence.mjs` Test 4.12 (**G4**) 与 Test 4.13 (**G5 / L1-B-cap**) 保持全绿通过。 |
| **组 3：分析器与健康状态语义 (P2)**<br>**G7 / G7-skip** (跨连接与同连接多次 Host skip/write 保留)<br>**G8** (Native/Host 校验、错域间隔排除)<br>**G9** (`FlushFailed` 重试重置与分析降级) | **G7-skip**: 真实 `FrameDecoder -> FrameHub -> streamFrames` 同连接在连续背压与两次 `drain` 下，先在 `(runId, connId, seq=5)` 记录 `latest-overwritten (2->4)`，第二次 `drain` 无新帧时在同一 `(runId, connId, seq=5)` 记录 `duplicate-sequence`；原 `checkDuplicate` 仅按 `runId:connId:gen:seq:event` 去重，将第二条合法 skip 误判为重复事件（`hostDuplicateSkipCount: 0, duplicateEventCount: 1, state: 'degraded'`）。G8、G9 七审已独立通过。 | `qa/perf/analyze-motion-cadence.mjs`:<br>1. **G7-skip**: `checkDuplicate(runId, connId, gen, seq, event, extraKey = '')` 对 Host 事件纳入区分键：`host-stream-skip` 传入 `${r.reason ?? 'skip'}:${r.skippedFrom ?? ''}:${r.skippedTo ?? ''}`，`host-stream-drain` 传入 `String(r.atMonoMs)`，使同连接同序号不同原因/范围的合法 skip 完整保留并分别计入 `hostLatestSkipCount` 与 `hostDuplicateSkipCount`，同时真重复 skip 记录仍被检出并降级；<br>2. **G8 & G9**: 保持七审已通过实现不变。 | `check-motion-cadence.mjs`：<br>- Test 5.18 (**G7 & G7-skip**): 覆盖跨连接同序号 skip/backpressure 保留、真实 `FrameHub -> streamFrames` 同连接连续两次 `drain` 产生 `latest-overwritten(3)` + `duplicate-sequence` 正例（`hostLatestSkipCount=1, hostSkippedFrameCount=3, hostDuplicateSkipCount=1, duplicateEventCount=0, state='available'`），以及完全相同真重复 skip 记录反例（`duplicateEventCount=1, state='degraded'`）；<br>- Test 5.19 (**G8 & G9**) 保持通过。 |
| **组 4：低优先级资源与状态卫生 (P3)**<br>**G10** (`CadenceTrace.cs` CTS 释放)<br>**G11** (`reentrantTimer` 清理与客户端导出降级同步) | 七审已独立确认通过，保持不返工。 | 1. `qa/wallpaper-probe/CadenceTrace.cs`: `DoPublishAsync` 的 `finally` 中调用 `cts.Dispose()`；<br>2. `src/wallpaper/session.js`: 重入分支 `finally` 中 `clearTimeout(reentrantTimer)`，超时/异常同步置 `clientTrace.degraded = true`。 | 隔离编译 0 警告 0 错误；Section 4 (4.8/4.9) 慢盘超时与重入测试保持通过。 |

---

## 3. 既有已确认闭合控制项回顾

Codex 四审、五审、六审与七审报告已独立确认下列项全部闭合，本轮保持完好：
1. **L1-A 停止确认 ACK 时机与尾批闭合（六审/七审确认通过）**：仅实际携带 `isStop === true` 且队列排空的成功 ACK 认证终态；ACK 先于/晚于 stop 均可靠补发空尾批。
2. **L1-B 多流终态与未发量隔离（六审/七审确认通过）**：逐流独立维护 `finalized` 与 `trailingUnsentCount`，A 完成不掩盖 B 未发，旧代次不认证新代次。
3. **G4 / G5 (L1-B-cap) / G8 / G9 / G10 / G11（七审确认通过）**：顶层信封与记录 generation 一致性、32 流有界优先压缩与淘汰摘要、Native/Host schema 与错域排除、`flushFailed` 重置与降级、原生/Host 慢盘门禁及 CTS/timer 清理全部通过。
4. **L1 挂起取消与截止（四审闭合）**：每个 trace 请求配置 `AbortController` 与超时；`finalizeRunCadenceTrace` 注入 100ms 取消 deadline，挂起请求在 stop 后 100% 结清，pending 归零。
5. **L2 多连接完整阶段统计与失败保留（四审闭合）**：每帧保留全量逐流事件数组，聚合计算联合均值与分位数；任一流失败不被成功流覆盖，准确降级。
6. **F1 空签发集合与强类型校验（三审闭合）**：空集合拒绝未知连接，可选字段严格类型检查。
7. **F3 重试有界与批次配额（三审闭合）**：单批 `<= 150`，最大 4 次停止重发预算，旧轮迟到回调不污染新轮。
8. **F2 间隔逐流隔离（三审闭合）**：Host write 与 client accept 按连接/代次独立分组计算间隔。
9. **F4 真实 I/O 门禁与迟到清理（三审闭合）**：超时后不堆叠新任务，解除后 unlink 目标文件，绝不迟到发布。

---

## 4. 证据口径与合成域如实声明

为确保审查透明性与证据严谨性，所有测试与验证材料的口径说明如下：

1. **合成域（Synthetic Fixture）与反例测试**：
   - **Section 6**：速率掩盖效应测试明确为固定构造的数值 fixture（33.333ms 均值下 Steady 34ms P95 与 Burst 80ms P95），用于数学证明单凭平均帧率无法发现局部卡顿；
   - **Section 5 极限边界反例**：包括外来时钟域注入、缺失 WGC 时间戳、真重复事件 주입、负间隔隔离、Native/Host schema 违规与 `flushFailed` 降级等，均为受控离线合成反例，用于断言分析器规则健全性，**绝不冒充端到端实测**。

2. **真实受控完整链证据**：
   - **Section 2 & 5.18**：真实 `FrameDecoder -> FrameHub -> streamFrames`，验证背压、按连接隔离分发、同连接连续两次 `drain` 下的 `latest-overwritten` 与 `duplicate-sequence` 跳过（G7-skip）；
   - **Section 3**：真实客户端身份协商、真实 WHL1 解码、挂载 Canvas 驱动生产 `paintWallpaper` 执行真实 `ctx.drawImage`，以及基于真实 `127.0.0.1` HTTP server 与真实定时器的 15ms 延迟 ACK 收尾、320 条多切片尾批排空、Host 自然 EOF 终态导出与超 100ms 截止耗尽 409 降级验证（G1-I/O & G2）；
   - **Section 4**：真实生产 `POST /whale-wallpaper/cadence-trace` 路由摄取与信封/generation 校验（G4），会话停止 409 拦截、32 流有界压缩与未完成淘汰降级保留（G5 / L1-B-cap）、多流终态独立追踪与非阻塞原子导出（G11）；
   - **Section 5 (5.1-5.2)**：Section 3 真实回放生成的 trace JSON 直接直通 `alignCadenceTrace` 与 `analyzeCadenceTimeline` 进行对齐与统计（Steady 14 间隔，均值 33.302ms，代理比率 1.0）。

3. **原生 WallpaperProbe 证据归属说明**：
   - **代码内置正常自测**：`qa/wallpaper-probe/` 源码自测覆盖 `--self-test-native-wait`（54 项）、`--self-test-native-pacing`（22 键）、`--self-test-cadence-trace`（32 条环形缓冲截断与溢出统计）；
   - **Codex 独立故障注入验证**：Codex 四审与七审报告记录的使用原样 C# collector 搭配假 Publish 注入慢盘、取消、成功重试与迟到清理，已由 Codex 独立验证通过，本交付直接引用其结论。

---

## 5. 全套门禁与回归执行结果

自动化验证脚本 `dsh-whale-mist/qa/perf/check-motion-cadence.mjs` 执行结果为 **7 大项全绿通过**：

```text
=== Starting Motion Cadence Trace & Offline Replay Suite ===
Evidence Directory: F:\dsh-wallpaper-plugins\.tmp\motion-cadence-check-1792117946890
--- Section 1: Native WallpaperProbe Build, Self-Tests, & CLI ---
  [PASS] Assets immutability check against rc.30 baseline passed.
  Compiling WallpaperProbe to isolated dir: F:\dsh-wallpaper-plugins\.tmp\motion-cadence-check-1792117946890\isolated-probe-bin
  [PASS] Isolated WallpaperProbe compiled with 0 warnings and 0 errors.
  [PASS] Native CLI argument parsing correctly detects --cadence-trace.
  [PASS] Native CadenceTrace.SelfTest ring buffer wrap & overflow verified.
  [PASS] Native P3 pacing self-test preserved (22 fields, 0 mismatches).
  [PASS] Native P4 wait self-test preserved (54 checks passed).
--- Section 2: Host FrameHub & streamFrames Real Replay ---
  [PASS] FrameDecoder -> FrameHub records host-hub-received events.
  [PASS] Host latest-overwritten skip correctly recorded (skipped 7..8, count=2).
  [PASS] streamFrames backpressure, drain, latest-overwritten skip, and connection isolation verified.
--- Section 3: Client Pipeline Real Replay & Off vs On Parity ---
  [PASS] Cadence A (Steady) Off vs On Parity: draws=15, rendered=15, sequences=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
  [PASS] Cadence B (Burst) Off vs On Parity: draws=11, dropped=4, sequences=[1,2,3,5,6,8,9,11,12,14,15]
  [PASS] Cadence C (Jitter) Off vs On Parity: draws=11, dropped=4, sequences=[1,2,3,5,6,8,10,11,12,14,15]
  [PASS] Edge case: real paintWallpaper handles missing canvas, records skip & closes bitmap.
  [PASS] Edge case: canvas draw error recorded and bitmap closed in finally.
  [PASS] Edge case: stale generation decode safely discarded and closed.
  [PASS] Edge case: pending schedule cancelled on stop.
  [PASS] Client flush: bounded batch slicing (<=150), 400 drop accounting, and 204 removal verified.
  [PASS] F3 verified: ACK ring race prevents dropping newer records after buffer wrap.
  [PASS] F3 verified: stop tail batch safely flushes remaining records with isStop=true.
  [PASS] F3 verified: 409 on stop terminates without infinite retry storm.
  [PASS] F3 verified: old run late ACK does NOT trigger stop tail flush on new activeRun.
  [PASS] L1 verified: hanging in-flight requests carry AbortSignal and abort within deadline without accumulating.
  [PASS] L1-A verified: ACK-before-stop and ACK-after-stop positive timing both send isStop tail batch.
  [PASS] G1-I/O & G2 verified: real HTTP 15ms ACK drain, multi-slice drain, natural EOF Host export, and deadline exhaustion 409 degradation.
--- Section 4: Host Session Cadence Trace Routes & Ingestion Security ---
  [PASS] GET /whale-wallpaper/cadence-trace returns valid status & schema.
  [PASS] POST /whale-wallpaper/cadence-trace ingests valid batch.
  [PASS] F1 verified: foreign connectionId rejected with 400.
  [PASS] F1 verified: incomplete record schema violations rejected with 400.
  [PASS] F1 verified: empty issued connections set rejects unknown connectionId.
  [PASS] F1 verified: invalid optional field types rejected with 400.
  [PASS] Missing or mismatched runId rejected with 400.
  [PASS] Forged foreign clock domain rejected with 400.
  [PASS] Non-blocking session.stop() completed in 7ms with atomic trace publish.
  [PASS] F4 verified: hanging write timed out, marked degraded, and late release did NOT publish file.
  [PASS] F4 verified: hanging rename timed out, retry avoided duplicate task, and late rename unlinked destination.
  [PASS] L1 verified: missing stop confirmation (e.g. 409 late batch) records clientFinalized: false and degrades analyzer state.
  [PASS] L1-B verified: multi-stream finalization & unsent isolation, all-stream positive completion, and generational non-certification.
  [PASS] G4 verified: envelope generation/counter schema violations and record-to-envelope mismatches rejected with 400.
  [PASS] G5 / L1-B-cap verified: 32-stream capacity compacts completed streams first and retains evicted unfinalized/unsent summaries.
--- Section 5: Cadence Analyzer Pipeline Alignment & Statistics ---
  [PASS] Real Steady replay trace aligned and analyzed: state=available, draws=14, meanInterval=33.302ms, proxyRatio=1
  [PASS] Real session exported files aligned and analyzed.
  [PASS] Counterexample 1 verified: intermediate frame missing WGC suppresses false proxy ratio.
  [PASS] Counterexample 2 verified: multi-run isolated without negative intervals.
  [PASS] Counterexample 3 verified: multi-connection backpressure preserved.
  [PASS] F2 Counterexample 4 verified: foreign clock domain degrades state to degraded.
  [PASS] F2 Counterexample 5 verified: multi-connection stream intervals computed per connection (33ms).
  [PASS] F2 Counterexample 6 verified: generation reset isolated without negative intervals.
  [PASS] F2 Counterexample 7 verified: duplicate events diagnosed and degraded, interval=33ms.
  [PASS] F2 Counterexample 8 verified: missing timestamp degrades state.
  [PASS] F2 Counterexample 9 verified: host-only trace yields unavailable & unknown=true.
  [PASS] F2 Counterexample 10 verified: sparse skipped draw proxy ratio = 1.0 (count=1).
  [PASS] Empty trace correctly diagnosed as state=unavailable, unknown=true.
  [PASS] Overflow trace correctly diagnosed as state=degraded.
  [PASS] F2 verified: Host write & client accept intervals strictly isolated per connection (33ms).
  [PASS] F2 verified: Real collector health fields degrade state and export anomaly counts.
  [PASS] L2 verified: multi-connection stage durations & schedule sources preserved across all connections.
  [PASS] L2 verified: decode failure on one connection is preserved and degrades state, not masked by another connection.
  [PASS] G7 & G7-skip verified: Multi-connection and same-connection Host skip/backpressure events preserved; true duplicate skip still degrades.
  [PASS] G8 & G9 verified: native/Host schema & clockDomain filtering and flushFailed degradation semantics.
--- Section 6: Synthetic Fixture & Rate Masking Demonstration ---
  [PASS] Synthetic fixture demonstrates rate masking:
         Steady Mean=33.333ms, P95=34ms
         Burst  Mean=33.333ms, P95=80ms
--- Section 7: Resource Ceiling & Disabled Trace Safety ---
  [PASS] Bounded ring buffer ceiling, 8192 capacity, and lazy disabled allocation verified.

=============================================================
ALL 7 MOTION CADENCE VERIFICATION TESTS PASSED SUCCESSFULLY.
=============================================================
```

### 既有门禁全数通过表格

| 回归测试命令 | 涉及范围与目的 | 结果与耗时 |
| :--- | :--- | :--- |
| `node qa/perf/check-motion-cadence.mjs` | 本轮 7 大核验类、三审反例、四审 L1/L2、五审 L1-A/L1-B、六审 L1-B-cap、Gemini 核实项与七审 G1-I/O、G7-skip 断言 | **PASS** (7 大项全绿通过) |
| `npm run check` | 生产文件语法与 CSS 模板字面量守卫 | **PASS** (0 错误, 2 template literals verified) |
| `npm run test:wallpaper-host` | Host 会话、路由、库目录、参数解析等全部单测 | **PASS** (106 项通过, 0 失败, 耗时 6.8s) |
| `node qa/perf/check-frontend-stages.mjs` | P2 前端管线阶段时序、丢帧分类、R1-R4 反例 | **PASS** (10 项全绿通过, 耗时 1.9s) |
| `node qa/perf/check-native-pacing.mjs` | P3 原生等待与实际 22 键分析接缝、隔离构建 | **PASS** (5 项全绿通过, 耗时 2.1s) |
| `dotnet build qa/wallpaper-probe -c Release` | 原生 C# WallpaperProbe 隔离编译 | **PASS** (0 警告, 0 错误) |
| `WallpaperProbe.exe --self-test-native-wait` | 原生高精度内核等待 54 项控制检查 | **PASS** (54 checks passed) |
| `WallpaperProbe.exe --self-test-native-pacing` | 原生 Pacing 跟踪自测 | **PASS** (ok: true, mismatches: 0, snapshotFields: 22) |
| `WallpaperProbe.exe --self-test-cadence-trace` | 原生环形缓冲容量与溢出截断自测 | **PASS** (ok: true, retained: 32, overflowCount: 18) |

---

## 6. 基准与资产不可变性核对

严格核对工作区环境与不可变性资产：

1. **生产 Assets 绝对不可变性核对**：
   - `dsh-whale-mist/assets/wallpaper/WallpaperProbe.dll`: `FD69D9B9C42376A99A29DAFCFA53071CB282F21D5FBF29FC738405646581FF34` *(与 rc.30 恢复基准 100% 匹配)*
   - `dsh-whale-mist/assets/wallpaper/WallpaperProbe.exe`: `C2727F2BAD7CA64F97059BE781F4E2DE5214440BD94B704D58993FD0A1C12731` *(与 rc.30 恢复基准 100% 匹配)*
   - `dsh-whale-mist/assets/wallpaper/WallpaperProbe.deps.json`: `8356139AA4F13D3C11051CEB2DF5C22B1AC7F9A0E87CDAE003095960698EEB95` *(与 rc.30 恢复基准 100% 匹配)*
   - `qa/wallpaper-probe/AtomicFile.cs`: 源码受保护，未触碰。

2. **版本与归档保护**：
   - 日常安装保持为用户的活动包 `0.6.0-rc.28`，不触碰任何运行状态；
   - 开发工作区版本维持 `0.6.0-rc.30`；
   - `release/plugins/` 下 rc.28、rc.29、rc.30、rc.31 四份 tgz 归档完整未改；
   - 绝不执行 git commit/push，绝不启动真实 WE 或 DSH 实采。

---

## 7. 后续移交与复审边界

1. **不可定论视觉成因**：
   - 离线回放证明了各层在不同到达节奏下能如实记录时间线，但三体小球在用户屏幕上的“突发快慢”目前依然缺乏屏幕物理坐标与模拟步长跟踪。
   - WGC 源时戳仅代表帧捕获时机，不能证明源程序内部物理模拟时钟是否均匀。
   - 必须等待 Codex 独立复审通过后，在受控环境中进行针对性实测，切忌提前宣称解决。

2. **封板与移交状态**：
   - 八审与收尾终审确认：七审 G1-I/O 跨真实 I/O 停止收尾、G7-skip 同连接 Host skip 身份及八审 QA-EOF 自然流结束异步写盘等待（`await eofSession.stop()`）已全部独立验证通过，全套门禁 100% 稳定全绿；
   - [Gemini (Argon) 候选前集中审查](MOTION_CADENCE_TRACE_PRE_CANDIDATE_REVIEW_20261016.md) 已完成全链路代码级核查，新增可达真问题 0 项，`Motion Cadence Trace` 任务正式封板。
