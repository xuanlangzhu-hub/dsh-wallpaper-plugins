# 交付记录：离线阶段对比工具（DS，2026-10-09）

依据 [DS_NEXT_PERF_COMPARE.md](../../../docs/DS_NEXT_PERF_COMPARE.md)、
[PERF_PHASE_PROTOCOL.md](../../../docs/PERF_PHASE_PROTOCOL.md) 与
[清单模板](../../../docs/perf-phase-manifest.example.json)。
第二轮依 [PERF_COMPARE_REVIEW.md](../../../docs/PERF_COMPARE_REVIEW.md) 的 F1–F4 局部修正。

## 授权范围内改动的文件

| 文件 | 说明 |
| --- | --- |
| `qa/perf/compare-phases.mjs` | 新建：离线对比工具（不启动进程、不查计数器、不开窗口） |
| `qa/perf/check-compare.mjs` | 新建：自生成合成输入与输出的检查，第三轮共 **36 个用例** |
| `qa/perf/README.md` | 补调用说明、输出、退出码、两层可比性判定与两个检查的入口 |
| `dsh-whale-mist/docs/PERF_COMPARE_DELIVERY.md` | 本交付记录 |

未修改 `sample-phase.ps1`、`check-sampler.mjs`、`src`、原生 helper、SDK、`package.json`/版本、
Profile/外观或任何历史证据。未启动真实壁纸/DSH/浏览器，未查询实时进程或计数器，未打包/安装，
未自动跑五阶段，未提交/推送，未清理 Temp 或证据。

## F1–F4 修正（第二轮）

- **F1 条件/容量/尺寸门槛**：新增 `pairGates`，逐 pair 检查身份、目标集合、逻辑容量、
  采集帧尺寸（仅两侧都记录时要求一致）、适配器集合，以及每个条件字段"两侧都已取证且与
  `fixedConditions` 相符"。任一不满足 → 该 pair 的所有差值置 null 并写明原因，原值保留，
  该 pair 记入 `status.reasons`（因此 `dataReady=false`）。**条件五阶段一起偏离固定值也会被拦**
  （逐字段与 `fixedConditions` 比对）。B 没有 `captureFrameSize` 属正常，不当错误。
- **F2 逐 PID/逐指标门槛**：覆盖率改为每 PID、每指标计算（CPU 区间与有效秒、工作集、私有字节、
  每个 LUID 的每个 GPU 内存指标、每个 engine key），差值逐项核对两侧。
  某指标在该阶段**从未观测**视为"缺失"而非"稀疏"，不阻断；**稀疏**则该 PID/该指标被阻断，
  且不影响同阶段覆盖足够的进程。阶段总覆盖率仅作信息。
- **F3 阶段与边界**：报告 `phase` 与清单不符 → 坏输入（退出 3，不写报告）；目标集合不符 →
  合法但不足（保留值 + inconclusive + 禁止身份差值）；读取起止与 CPU 时刻全部核对窗口，
  缺失时间戳也算未覆盖；负的墙钟/工作集/私有字节区间 → 坏输入。结构检查（samples/targets 数组、
  正整数容量、唯一 PID、必需时间戳）先于计算。
- **F4 分段与参考对照**：不再只信 `summary` 的拓扑标签，改由样本自身的 `adapterLuidSet` 重算，
  并按集合输出**各段**的 PID/LUID/指标值与覆盖；跨阶段适配器集合不同 → 该 pair 不产生整阶段 GPU 差值。
  对照对补齐为双向（`B->A0`、`D->A0`、`B->A1`、`D->A1` 等），并新增 privateBytes 与
  四项 GPU 内存（按 LUID 与指标分开）的差值输出。

## R1–R4 修正（第三轮）

- **R1 全空数据**：新增 `perFamilyObserved`（CPU/内存/GPU 各自是否观测到）与 `noUsableObservation`。
  全空时写出具体原因（"no usable observation for any target"、各家族 "unavailable rather than zero"），
  `dataReady=false`，不造零。GPU 缺失不再抹掉有效 CPU：家族各自判定，互不耦合。
- **R2 逐项门槛**：`mergeMemoryDeltas` / `mergeEngineDeltas` 的**每一行**自带 `delta` / `reason` / 观测数。
  某个 LUID+指标或某个 LUID+引擎观察不足时只该行为 null 并写原因，同族其它行照常给出差值。
  适配器集合与拓扑未知改为 **GPU 专属门槛**（`gates.gpuTopology`），只阻断 GPU 行，
  不再进入 pair 公共 gates，也不影响 CPU 与内存。
- **R3 时间字段**：校验扩展到 `readStartedAt` / `cpuReadAt` / `gpuReadAt` / `gpuReadFinishedAt` 四个字段，
  逐样本检查缺失、不可解析、越界与顺序（start ≤ cpu ≤ gpu ≤ end），结果写入 `phase.timing`；
  C/D 两侧帧尺寸都未知不再视为相等；A/B 天然无采集帧尺寸仍不算错。
- **R4 连续分段**：段按**采样顺序**切分（相邻集合相同才算同段），不再按集合归组；
  每段带自己的起止时间与逐 PID/LUID/指标值；未知集合自成一段；
  `unknownTopologySamples` 由样本自身统计，而非沿用报告标签。

## 命令

```
node qa/perf/compare-phases.mjs --manifest <清单.json> --output <全新目录>
node qa/perf/check-sampler.mjs      # 已有，25/25
node qa/perf/check-compare.mjs      # 新增，36/36
```

退出码：`0` 写出了报告；`2` 调用方式错误；`3` 输入被拒且**没有**写出任何报告。

## 通过项

**工具行为**

- 清单：`schemaVersion=1`、`state` 为 `real`/`synthetic`（`template` 直接拒绝）、相位必须恰好
  `A0,B,C,D,A1` 且 `state="measured"`、`sampledReport` 相对清单目录解析、`minimumCoverage` 数值校验、
  每阶段 PID 不得重复、角色必须在已知集合内且不得重复、`evidence` 必填。
- 输出：`comparison.json` + `comparison.md`，输出目录必须不存在，用 `wx` 写入；已存在则拒绝且
  不动其中任何文件；输入被拒时不创建输出目录。
- 报告区分"写出了报告"（`status.reportWritten`）与"数据足以比较"（`status.dataReady` /
  `status.inconclusive`），并列出原因。
- 每个输入都记录 sha256 指纹；条件逐字段做跨阶段对比（`conditionComparison`），
  未取证（null）与不相等都会让 `dataReady=false`。

**计算（均由原始 samples 重算）**

- CPU：总 delta / 总有效时间，按整机逻辑容量换算为百分点；不等间隔用例验证了加权结果与
  "逐样本百分比的简单平均"不相等；有效 idle=0 与全 null 严格区分；覆盖不足不产生差值。
- 内存：工作集/私有字节取有效观察均值与有效数；四项 GPU 内存按 PID+LUID 分开，
  单项缺失保持 null 且不影响同一 LUID 的其它项。
- GPU 引擎：按 PID+LUID+engineType 给出观察均值、阶段最大值与有效数，并保留 instanceNames；
  明确不等于整卡比例，也不把不同引擎相加。
- 差值：仅同 PID 且同 StartTime 才计算；身份不符或必需角色未解析不产生差值；负差值保留不截零；
  拓扑未知/变化时 GPU 整阶段差值为 null，CPU 覆盖仍独立评价。
- 清单与报告目标集合不一致、报告含清单未列 PID：合法但不足，保留警告并出 inconclusive。

**合成检查 36/36**（证据在 `.tmp/perf/compare-check-<unique>/`，每例保留输入、输出与结果）

CPU 不等间隔加权；idle=0 与全 null 的区别；覆盖不足；同 PID 多角色只算一次；42/420 前缀；
身份（StartTime）不符；缺必需角色；GPU 单项缺失/LUID 分离/均值≠阶段最大值；拓扑未知段与
整阶段 GPU 差值为 null；基线漂移与负差值；条件不一致；B 无采集不造数；帧率上限不被当成实测源 FPS；
template/坏 JSON/错误相位/已存在输出目录（含哨兵文件不变）；目标集合未解析仍保留可读数值。

## 未验证 / 仍 unknown

- **没有真实五阶段数据。** 全部数值来自合成输入，`state=synthetic` 保留在报告与清单中；
  本记录不声称性能降低或实机通过。
- **未做**：自动 PID 发现、窗口控制、统计显著性检验、功耗采集、每编码步骤 profiling。
- `motion` / `captureFrameSize` / 帧率类字段只按清单展示，报告明确标注"清单提供的计数；未独立重算"。
- `sourceRenderFps` 未测得即为 null；本工具不会用 `captureFpsCap` 代替它。
- 工具不解析原生/Host 日志，只检查 `evidence` 里指名的文件是否存在；人工说明会被标为 manual。
- `dsh-host` / `dsh-client` / `dsh-gpu` 允许留 `unresolvedRoles`，其成本保持 unknown。
