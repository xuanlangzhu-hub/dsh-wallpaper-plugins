# 运动节奏逐帧观测与离线回放候选前集中审查报告 (Gemini Argon)

日期：2026-10-16
审查模型：Gemini (Argon)
对应任务书：[GEMINI_NEXT_MOTION_CADENCE_TRACE_20261015.md](GEMINI_NEXT_MOTION_CADENCE_TRACE_20261015.md)
对应交付文档：[MOTION_CADENCE_TRACE_DELIVERY_20261015.md](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)
对应 Codex 收尾复审：[MOTION_CADENCE_TRACE_FINAL_REVIEW_20261016.md](MOTION_CADENCE_TRACE_FINAL_REVIEW_20261016.md)
前期关联文档：[七审报告](MOTION_CADENCE_TRACE_SEVENTH_REVIEW_20261016.md)、[八审报告](MOTION_CADENCE_TRACE_EIGHTH_REVIEW_20261016.md)、[Gemini 扩展审查报告](MOTION_CADENCE_TRACE_GEMINI_REVIEW_20261016.md)、[Codex 独立附评](MOTION_CADENCE_TRACE_GEMINI_ASSESSMENT_20261016.md)

---

## 1. 审查范围与总体结论

依据 [`AGENTS.md`](../AGENTS.md)、[`NEXT_TASK.md`](../NEXT_TASK.md) 与 [`MOTION_CADENCE_TRACE_FINAL_REVIEW_20261016.md`](MOTION_CADENCE_TRACE_FINAL_REVIEW_20261016.md) 第 6 节指引，本次候选前集中审查对运动节奏逐帧观测工具（Native / Host / Client 三层）、离线对齐与统计分析器、QA 回归验证套件及交付文档进行了端到端全文件代码级独立走查。审查过程严格遵守**只审查/写文档、不修改任何生产代码与 QA 脚本、不触碰 DSH/WE/版本/资产**的边界。

### 总体判定

- **新增可达真问题：`0` 项**。
- **候选前集中审查结论：通过（`Motion Cadence Trace` 运动节奏逐帧观测与离线回放实现与文档可正式封板）**。
- 历轮审查（一至八审及 Codex 终审）收敛的全部控制项（`F1`–`F4`、`L1`/`L2`、`L1-A`/`L1-B`、`G1-I/O`、`G2`、`G4`、`G5/L1-B-cap`、`G7/G7-skip`、`G8`–`G11`、`QA-EOF`）在当前代码树中均已闭环且互不冲突；未发现新的可达越界、状态竞争、静默丢数、跨时钟域污染或生命周期泄漏。

---

## 2. 全链路逐层代码级核查明细

### 2.1 原生探针层 (`qa/wallpaper-probe/CadenceTrace.cs`, `Program.cs`, `CaptureArguments.cs`)

| 核查维度 | 核查代码位置 | 独立核查结果 | 判定 |
| :--- | :--- | :--- | :--- |
| **默认关闭与零开销** | `CadenceTrace.cs:31-39, 49, 95` | `Enabled = false` 时仅分配空数组 `[]`，`Record()` 与 `FlushAsync()` 首行直接返回，对常规采集与 P3/P4 计时零侵入。 | **PASS** |
| **CLI 参数解析兼容** | `CaptureArguments.cs:19-45, 86-88` | `--cadence-trace` 列入非位置型 `OptionFlags` 先行剥离，不挤占 `--forever`（槽位 2）或 `fps`/`pipe` 位置参数角色。 | **PASS** |
| **帧序号与阶段一致性** | `Program.cs:228-267` | `frames++`（第 254 行）前以 `checked((uint)(frames + 1))` 记录 `native-source`、`native-read`、`native-encode`，`frames++` 后以 `checked((uint)frames)` 写入管道并记录 `native-pipe-write` / `native-pipe-write-error`，同一物理帧在四类原生事件及 `WHL1` 帧头中的 `sequence` 严格一致。 | **PASS** |
| **有界环形缓冲与溢出统计** | `CadenceTrace.cs:49-89` | 容量 `8192`，`lock (_ring)` 保护下按 `_writeIndex = (_writeIndex + 1) % _capacity` 覆盖最旧项并递增 `_overflowCount`，`Snapshot()` 按时间正序导出。 | **PASS** |
| **单飞落盘门禁、重试重置与资源卫生 (`F4` / `G9` / `G10`)** | `CadenceTrace.cs:95-162`, `Program.cs:334-338, 377` | `_publishLock` + `_activePublishTask` 保证慢盘超时后不并发堆叠新落盘任务；`DoPublishAsync` 在生成 `Snapshot()` 前重置 `FlushFailed = false`，避免前次失败污染成功重试的 JSON 快照；超时取消后若 `AtomicFile.Publish` 迟到完成，立即清理目标文件与 `.tmp` 临时文件；`finally` 释放 `cts.Dispose()`；`summary.json` 汇总 `flushFailed = !cadenceOk || cadenceTrace.FlushFailed`。 | **PASS** |

---

### 2.2 Host 收集器与会话生命周期 (`src/wallpaper/cadence-trace.js`, `frame-hub.js`, `session.js`)

| 核查维度 | 核查代码位置 | 独立核查结果 | 判定 |
| :--- | :--- | :--- | :--- |
| **未启用零开销** | `frame-hub.js:49-83`, `session.js:449-510, 1143-1166` | `cadenceTrace.enabled` 为 `false` 时，`FrameHub` 与 `streamFrames` 不产生任何对象分配或额外计时调用，且不向 `WallpaperProbe` 传递 `--cadence-trace`。 | **PASS** |
| **摄取鉴权与信封一致性 (`F1` / `G4`)** | `session.js:261-396`, `cadence-trace.js:272-369` | `POST /whale-wallpaper/cadence-trace` 严格校验：活跃会话（`!session.isClosed()`，否则返回 `409`）、请求体上限 `262144`、`runId === activeLocation`、`clockDomain === 'client-mono'`、非空 `issuedConnections` 包含 `connectionId`、顶层 `generation`（非负安全整数，空尾批必填）与每条记录 `generation` 严格相等、健康计数器（`trailingUnsentCount`、`overflowCount`、`droppedCount`）为非负安全整数。非法载荷一律 `400` 拒绝并递增 `schemaViolationCount`。 | **PASS** |
| **32 流上限安全压缩与淘汰降级保留 (`L1-B` / `G5`)** | `cadence-trace.js:163-270` | `clientStreams` 维持 32 上限；满额时优先压缩已完成健康流（`finalized && trailingUnsentCount === 0`）；若被迫淘汰未完成或带未发余量的流，将其状态沉淀至 `evictedUnfinalizedStreams`、`evictedTrailingUnsentCount`、`evictedOverflowCount`、`evictedDroppedCount`，`isAllFinalized()` 与导出快照持久保留降级证据，绝不因淘汰而静默恢复 `available`。 | **PASS** |
| **跨真实 I/O 收尾窗口与非阻塞导出 (`G1-I/O` / `G2` / `G11`)** | `session.js:162-173, 1185-1256`, `cadence-trace.js:116-143` | `createPreviewSession.runClose()` 先完成 `hub.close()`、子进程退出与原生窗口关闭，再调用 `await clientTrace.waitForClientFinalize(100, issuedConnections)`（`closeSession()` 同样支持有界等待），随后才设置 `cleanupResult`（令 `isClosed()` 变 `true`）并执行 `await writeCadenceTrace()`；尾批全部确认时立即唤醒，慢请求有界截止在 100ms 内；`writeCadenceTrace` 重入分支在 `finally` 中 `clearTimeout(reentrantTimer)`，超时/异常同步设置 `clientTrace.degraded = true`。 | **PASS** |

---

### 2.3 客户端采集与收尾状态机 (`src/client.js`)

| 核查维度 | 核查代码位置 | 独立核查结果 | 判定 |
| :--- | :--- | :--- | :--- |
| **严格门控与播放行为零改动** | `client.js:558-598, 763-887, 907-1046, 1165` | 所有采集点均受 `run.cadenceTraceEnabled` 门控；开启时完全复用生产 `paintWallpaper`（包裹真实 `ctx.drawImage`，并在 `no-layer` / `not-running` / `no-canvas` 跳过及异常 `finally` 中确保 `bitmap.close()`）与 `schedulePaint`，不改动 RAF/timeout 调度、解码并发或 `latestFrame` 覆盖语义。 | **PASS** |
| **环形缓冲回绕安全与批次配额 (`F3`)** | `client.js:601-695` | 单批上限 `<= 150`；ACK 返回时按 `item.sequence > ackedUpToSeq` 过滤而非按长度截取，避免在途期间缓冲回绕误删新记录；`400` 计入 `cadenceTraceDroppedCount`，`409` 或超出 4 次停止重发配额立即终止。 | **PASS** |
| **同步非阻塞收尾触发与尾批确认 (`L1` / `L1-A` / `G1-I/O` / `G2`)** | `client.js:697-725, 1218-1220, 1508` | `finalizeRunCadenceTrace(targetRun)` 为纯同步非阻塞调用，在显式 `stop()` 与自然流结束 `!failed` 均即时触发；为在途请求挂载 100ms 取消定时器并置 `cadenceTraceStopPending = true`；仅当实际携带 `isStop === true` 的请求获 `204` 且缓冲队列已排空时置 `cadenceTraceStopSent = true`，在途普通批次无论先于或晚于 `stop()` 返回均可靠补发 `isStop: true` 尾批。 | **PASS** |

---

### 2.4 离线对齐与统计分析器 (`qa/perf/analyze-motion-cadence.mjs`)

| 核查维度 | 核查代码位置 | 独立核查结果 | 判定 |
| :--- | :--- | :--- | :--- |
| **分域校验与错域间隔排除 (`F2` / `G8`)** | `analyze-motion-cadence.mjs:142-485` | Native（`native-mono`）、Host（`host-mono`）、Client（`client-mono`）三域独立校验必填与可选字段类型；外来 `clockDomain` 记录计入 `clockDomainMismatchCount` 并排除出对应间隔序列，防止跨时钟域减法污染分位数；全部 6 条间隔序列均检测负间隔并剔除异常值。 | **PASS** |
| **逐流隔离与阶段统计完整保留 (`F2` / `L2`)** | `analyze-motion-cadence.mjs:238-496, 558-634` | `hostWriteIntervals` 按 `(runId, connectionId)` 隔离，`clientAcceptIntervals` 与 `clientDrawIntervals` 按 `(runId, connectionId, generation)` 隔离；每帧解码与绘制耗时/失败保留全量多流事件数组，任一连接失败均计入 `decodeFailureCount` / `drawFailureCount` 并触发降级，不被其他成功连接覆盖。 | **PASS** |
| **同连接合法 Host skip 保留与真重复检出 (`G7` / `G7-skip`)** | `analyze-motion-cadence.mjs:279-307, 514-530` | `host-stream-skip` 去重键纳入 `${r.reason ?? 'skip'}:${r.skippedFrom ?? ''}:${r.skippedTo ?? ''}`，`host-stream-drain` 纳入 `String(r.atMonoMs)`；同连接同序号下先发生 `latest-overwritten` 再发生 `duplicate-sequence` 完整保留并分别计入 `hostLatestSkipCount` 与 `hostDuplicateSkipCount`，完全相同的真重复记录仍触发 `duplicateEventCount > 0` 与 `state: 'degraded'`。 | **PASS** |
| **代理比率与健康状态三态语义** | `analyze-motion-cadence.mjs:499-509, 636-688` | `sourceToDrawProxyRatio` 仅在同 `(runId, connectionId, generation)` 连续绘制帧且中间帧无缺失 `wgcTimestampMs` 时计算；`state` 严格区分 `available`、`degraded`（任一溢出/丢弃/重复/缺时戳/负间隔/错域/阶段失败/管道错误/未确认尾批/未发残留/收集器降级/原生落盘失败/schema 违规/未完成流淘汰）与 `unavailable`（无绘制帧）。 | **PASS** |

---

### 2.5 QA 验证套件与交付文档 (`qa/perf/check-motion-cadence.mjs`, `docs/MOTION_CADENCE_TRACE_DELIVERY_20261015.md`)

1. **`QA-EOF` 测试等待闭环**：[`check-motion-cadence.mjs:1478`](../dsh-whale-mist/qa/perf/check-motion-cadence.mjs#L1478) 在自然 EOF 子用例 `isClosed()` 轮询后调用 `await eofSession.stop()`，等待已有的 `cleaning` Promise（含 `writeCadenceTrace()` 异步写盘与重命名）完成后再读取 `cadence-trace-client.json`，消除了写盘完成前读取文件的偶发 `ENOENT`，未修改生产 `isClosed()` 语义、未加固定 `sleep`、未吞异常。
2. **真实路径回放与合成 fixture 边界清晰**：交付文档明确区分了受控真实调用路径回放（Section 2/3/4/5）与合成数值 fixture（Section 6 速率掩盖对照及 Section 5 边界注入反例），如实记录了测试修复前后的表现。
3. **视觉症状边界诚实声明**：交付文档明确声明本轮交付为**运动节奏诊断观测基础设施**，绝不冒充“三个球突然加速、减速、再加速”视觉症状的根因定位或播放修复。

---

## 3. 封板与后续建议

1. **当前阶段封板**：`Motion Cadence Trace`（运动节奏逐帧观测与离线回放）生产实现、原生探针、离线分析器、回归测试套件与交付文档已通过 Codex 收尾复审与本次 Gemini (Argon) 候选前集中审查，**0 项遗留或新增缺陷，正式封板**。
2. **后续安排边界**：按照用户与项目规约，当前不自动准备候选包、不触碰日常 `rc.28` 安装或 `rc.30` 工作区版本/资产、不自动启动 DSH/WE；后续何时打包隔离候选并进行针对性实机短测采证，由用户另行安排。
