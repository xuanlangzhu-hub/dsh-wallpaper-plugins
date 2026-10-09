# 给 DS：只做离线阶段对比工具

最新复审优先：[PERF_COMPARE_REVIEW.md](PERF_COMPARE_REVIEW.md)。首轮自检通过，但独立输入发现 F1–F4；
下一轮按该记录局部返工门槛与输出，原授权范围不变，不进入真实阶段采样。

2026-10-09。先读 [PERF_PHASE_PROTOCOL.md](PERF_PHASE_PROTOCOL.md)、
[清单模板](perf-phase-manifest.example.json)、[采样器说明](../dsh-whale-mist/qa/perf/README.md)。
上一轮采样器修复的 25 项已通过。这次任务只增加一个小型离线对比工具，交 Codex 审查；未开始实机。

## 授权范围与文件

在 `F:/dsh-wallpaper-plugins` 修改以下文件即可：

- 新建 `dsh-whale-mist/qa/perf/compare-phases.mjs`。
- 新建 `dsh-whale-mist/qa/perf/check-compare.mjs`（自身生成合成输入与新输出）。
- 在 `dsh-whale-mist/qa/perf/README.md` 补调用说明；新增简短交付记录，说明通过项和未验证项。

不要修改 sample-phase.ps1/check-sampler.mjs、src、原生 helper、SDK、package/version、Profile/外观或历史证据。
不要启动真实壁纸/DSH/浏览器，不查询实时进程/计数器，不打包/安装/自动跑五阶段，不提交/推送。
不清理 Temp/证据，也不用 PowerShell 文本替换重写大文件。两个工具直接用 Node 文件/JSON API，
不调用 shell；有问题先收窄到一项合成输入，不靠多轮更换探针绕圈。

## 输入、输出与状态

建议入口：`node qa/perf/compare-phases.mjs --manifest <清单.json> --output <全新目录>`。
template 清单必须拒绝，real/synthetic 清单需标明；synthetic 输出不能标为实机通过。
清单中报告路径相对 manifest 所在目录解析；读取已有数据，输出目录必须原子新建，已存在直接拒绝，
不清空/覆盖/删除任何文件。输出 `comparison.json` 与 `comparison.md`，包括输入文件指纹和清单状态。
不把输入路径拼成命令，不枚举整个盘/Profile 来“补齐身份”。

schemaVersion=1，顺序 A0/B/C/D/A1，samplerReport 对应实际 `report.phase`；阶段状态/测量边界/角色清单
用模板中的字段。模板的 null 是待填，不能因为 schema 大致像就当齐全。取必要字段校验，错误给清楚路径和原因。
路径/报告缺失、JSON 损坏、schema/阶段顺序错误、样本结构错误、CPU 非有限/负区间等坏输入退出非零，
不输出伪造完成报告。合法数据覆盖不足则成功生成报告，但写 `dataReady=false`、`inconclusive` 及原因；
CLI “写出了报告”和“数据足以比较”分别说明，不用 PASS 混为一件事。

以下是模板中留空字段的约定，不另发明自动发现协议：

| 字段 | real/synthetic 清单填法 |
| --- | --- |
| 根 state / phase.state | 根为 `real` 或 `synthetic`；每阶段为 `measured`。planned 不接纳为完成阶段 |
| processes | 每项 `{pid: 正整数, startTime: 报告同一启动时间字符串, path: 字符串或 null, roles: 字符串数组, evidence: 相对路径或说明}`；证据为说明时注明人工，不能冒充脚本核验 |
| 必需角色 | 各阶段 `we`、`dsh-app`；C/D 另必需 `capture`。若缺失/身份不能确认，允许记录 unresolvedRoles 并出 inconclusive，不能生成该角色可比数值 |
| 其余角色 | `dsh-host`、`dsh-client`、`dsh-gpu` 可留 unresolvedRoles；它们的成本保持 unknown。若同进程承担多个角色，用一个 processes 项的 roles 数组。若源属于其它 WE 进程，额外标 `we-source`，不要并入原 WE |
| conditions | 每阶段填写同样字段：`powerState`、`weGlobalSettingsEvidence`、`dshViewport`（width/height）、`dpi`、`foregroundEvidence`、`desktopPlaybackEvidence`、`projectSha256`、`wallpaperPropertiesSha256`。与固定条件匹配才宣称条件相同；关键值 null 说明未证。哈希类填摘要，状态类填规范化观测，不以不同证据文件名代替状态值 |
| measurement | ISO 开始/结束时间；结束严格晚于开始。报告读取区间须落在这段（允许已说明的边界采集偏差），不能截掉失效样本来抬覆盖。坏时间为坏输入；边界未覆盖报告则 inconclusive |
| sourceWindow | B/C/D 填唯一 location、hwnd、renderPid、inspectSize；A0/A1 为 null。renderPid 必须能对应清单的 we/we-source。Inspector 尺寸不当物理帧尺寸 |
| captureFrameSize | C/D 填实际稳定 `{width,height}`，未知 null；B/A 留 null。只把 C/D 两份实测值用于帧尺寸一致性判断 |
| motion | 不可得为 null；取得才填 `{nativeFramesDelta, changedFramesDelta, nativeElapsedSeconds, hostReceivedDelta, hostElapsedSeconds, clientReceivedDelta, clientRenderedDelta, clientDroppedDelta, clientDecodeErrorsDelta, clientElapsedSeconds}`，缺项可 null；每种速率用自己的秒数，禁止以 undefined 补 0 |
| evidence | 相对路径列表；给人工边界统计的出处，不强制第一版解析所有原生/Host 日志。报告注明“清单提供的计数；未独立重算”，不把元数据当成自证 |

global fixedConditions.sourceRenderFps 取得才填写，否则 null；captureFpsCap 与请求窗口尺寸来自配置。
采样报告的目标集合与清单不同、必需角色 unresolved 是**合法但不足的资料**，保留警告并出 inconclusive，
不要为了凑齐协议去补查询。schema、字段类型或坏时间/区间则是坏输入。

## 第一版只做这些计算

1. 对清单内唯一 PID+StartTime 核对 report.targets；角色数组去重，同 PID 多角色只出一条进程数值。
   同阶段重复 PID（即使不同 StartTime）拒绝；别把 report 中其它 PID 自动归角色。目标集合不符或身份变化
   给该阶段 inconclusive 并保留可读原值，禁止跨身份差值；不为死掉的 helper 拼接其它同名进程。
2. 从原始 samples 重算各 PID 的有效 CPU delta/time 和整机逻辑容量百分比，列有效区间数/累计时间。
   不能只复制 summary 的均值。CPU 缺失保持 null；区间有效性和阶段目标存活/identityChanged 一起检查。
3. 工作集、私有字节及四项 GPU 内存分别算有效观察均值/数；GPU 内存按 LUID 分开。
   有效值含 0，缺失 null 不参与分母，不合并四指标/不同 LUID。
4. 读取每样本 processGpu.engines，按 PID+LUID+engineType 汇总每样本 maxUtilizationPercent 的观察均值、
   最大值、有效数和 instanceNames 集合。不得把 summary.engineMaxByType.maxPercent 当均值，
   不得把不同 LUID/引擎百分比相加成整卡 GPU。拓扑 unknown/变化时展示各段，GPU 整阶段差值留 null。
5. 达到协议的 5 个观察/CPU 30 秒等门槛才为该指标生成跨阶段差值；其它指标仍可独立展示。
   要展示基线 A0/A1 的差值与范围、负数、单位和覆盖，CPU 差值是**百分点**。共享 WE 须同身份才可对比。
   capture 在 A/B 不存在时，不为其制造“实测 0”；展示 C/D helper 自身读数，新的 PID 不做同一进程恢复判定。
6. 清单给出的尺寸/运行条件不同、原 WE/DSH 身份不一致、工作量不可确认等情况给原因；
   native/client FPS 与变化帧只使用清单边界内增量及时间（取得才展示），不得把 captureFpsCap 当 measured/source FPS。
   B 天然没有 captureFrames，不把它误报坏输入。源 FPS unknown 时明确“同渲染率未证”，不承诺严格因果分离。

不用第一版做自动 PID 发现、窗口控制、精密统计检验、功耗采集、每编码步骤独立 profiling，
也不用实现一个通用 benchmark 框架。已知拓扑的判定可核对样本 adapterLuidSet 与报告段；
有 unknown 段不能照旧 largestSegmentSamples 冒充覆盖了整阶段。

## 合成验收要求

每例都有明确数值/状态断言，启动或输出失败不能当负例通过。至少覆盖：

- CPU 不等间隔的加权结果；有效 idle=0 与全 null 的区别；覆盖不足。
- 同一 PID 多角色只算一次；42/420；身份变化；清单缺必需角色。
- GPU Dedicated 缺失/Shared 有效；两个 LUID；阶段 max 与观察均值不同。
- A→B→A 拓扑及 unknown 段；分段展示、整阶段 GPU 差值为空。
- A0/A1 基线漂移保留；负差值不截零；不同逻辑容量/尺寸/前台等条件不做可比声明。
- B 无采集数据正常；采集 cap=30/实际 FPS 未知不生成源 30 FPS；合成标签保留。
- template、坏 JSON、错误阶段、已存在输出目录拒绝且原哨兵文件不变；目标集合不符给 inconclusive。

新检查写 `.tmp/perf/compare-check-<unique>/`，保留每例输入/输出/结果，不删除失败证据。
运行一次已有 sampler 25 项和新的对比检查；生产代码没改，不为文档重跑真实窗口或全套视觉回归。
交付写文件清单、命令、通过数、证据目录、仍 unknown 的项。实际数据由后续 Codex/用户协作取得；
本轮不能说“性能已降低”“真实五阶段通过”。
