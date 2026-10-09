# 离线对比工具复审：尚未通过，只补判定与报告边界

2026-10-09，基线 main@2b8249f。DS 新交 compare/check 两个脚本、README 和交付记录；
生产实现、采样器、原生资产和插件包没有修改。本轮仅离线审查，没有操作 DSH/WE、安装或采样真实进程。

## 结论与保留项

独立复跑 DS 检查 **16/16**、已有采样器 **25/25** 均通过。CPU 原始区间加权、内存按 LUID/指标、
同 PID 多角色一条记录、合成标签、有效零与 null、已有输出目录保护的方向保留。
但是现有用例没锁住差值门槛：报告状态/条件和实际差值输出脱节，仍会给不足或不可比的数据计算增量。
**不进入真实 A0→B→C→D→A1，也不提交这份实现为已审查通过。**

以下故障用独立完整合成清单逐项只改一个条件复现。DS 原源码/测试/历史证据均未编辑；
自检通过不等于协议已实现。

## F1 / P1：条件改变未禁止差值，容量/帧尺寸未进入判断

compare-phases.mjs:416–418、445–450 只看 identity/阶段覆盖，conditions 直到 648–673 才算全局状态。
条件不同会令 dataReady=false，但差值已照常输出；GPU/CPU/RAM 的“可比”标志仍 true。
machine.logicalProcessors 只检查有限，不比较不同阶段；captureFrameSize 只是原样拷出。

| 独立用例 | 当前结果 | 必须修正 |
| --- | --- | --- |
| conditions-differ：B 从交流电改电池 | dataReady=false，但 CPU 差值仍 0.15625 pp，cpuComparable=true | 保留原始值与原因，受影响 pair 的差值 null |
| different-logical-capacity：B 32→16 | dataReady=true，CPU 差值 0.15625 pp | 不同容量不能作为同一基准差值，明确原因 |
| different-frame-size：D 1302×776→1902×1071 | dataReady=true，C→D 差值仍给数值 | C/D 尺寸不同阻断同工作量可比声明与差值 |

修复先建立 **pair 的运行条件/容量/尺寸门槛**，再结合各指标有效覆盖。逐阶段条件还需与 fixedConditions
核对，不能五阶段一起偏离固定值却宣称匹配。未知条件有原因；B 无 captureFrameSize 不当错误。
不用全局一个 dataReady 把所有 pair 一起抹掉：只阻断受影响 pair，原值保留。

## F2 / P1：覆盖按全阶段合计，缺少每 PID/每指标门槛

352–365 把各 PID 的 CPU 区间/时间/工作集观察相加；445–450 用这些总数准许一个 PID 的差值。
GPU 是否可比甚至使用工作集观察数，与具体 LUID/engine 的有效 GPU 读数无关。

- sparse-pid-cpu：B 的 WE 只有 **1 区间/10 秒**，DSH 有 6 区间/60 秒；dataReady=true，
  WE 仍输出 0.15625 pp 差值，违反该 PID 的 5 区间/30 秒门槛。
- sparse-engine：B 的 3D 仅 **1 个观察值**，A0 有 6 个；工作集观察数足够，仍输出 **10 pp GPU 差值**。

分别计算 PID.cpu、workingSet、privateBytes、每个 GPU 内存指标/LUID、每个 engine key 的 coverage。
差值逐 PID/指标核对两边，而不是让其它 PID 或 RAM 观察代替它。有效零计入覆盖，null 不计。
阶段总数可作信息，不能证明单进程已测够。必需角色有身份但没有有效观察时也不能宣称资料完整。
拓扑异常下 CPU 独立评价，GPU 仍不能借 CPU 通过。

## F3 / P1：阶段、目标集合、读取边界与坏区间未正确处理

| 独立用例 | 当前结果 | 预期 |
| --- | --- | --- |
| wrong-report-phase：B/sample.json 的 report.phase=A0 | reportPhaseMismatch=A0，却 dataReady=true | 错误阶段是坏输入，退出非零且不写报告 |
| extra-report-target：报告多一个 PID 420 | 只有 warnings，dataReady=true，仍计算差值 | 集合不同是合法但不足：inconclusive，禁止该阶段相关身份差值 |
| read-finishes-outside-window：GPU 读取结束超过测量窗口 | 只检查 readStartedAt，dataReady=true | 核对读取起止/CPU 时刻；边界覆盖不足给原因及不可比标记 |
| negative-wall-interval：wallClockSecondsDelta=-1 | 不拒绝，只丢 1 区间；dataReady=true | 非法负区间是坏输入，不是 null 缺口 |

CLI 独立复现 wrong-report-phase 与 negative-wall-interval 均实际退出 0、写报告并打印“data sufficient=yes”。
坏 JSON/缺 samples/坏时间等也需要明确结构/类型检查，不能 silently 默认 [] 或过滤掉坏时间。
正整数逻辑容量、必需数组/唯一 PID、真实阶段名、完整读取时间边界先验证；null 区间仍是合法缺失。
extra target/未解析角色按协议保留原值并 inconclusive，不混成坏输入。同步修正 README/退出码说明的矛盾。

## F4 / P2：分段与参考对照仍缺输出（静态检查）

- 337–343 信任 summary 的 topology 标签；未核对 samples.adapterLuidSet。当前未知/变化时虽然关掉 GPU
  差值，computeTargetMetrics 仍把所有段混在一起求 GPU 均值，只展示段元数据，没有各段的指标数值。
  核对原始拓扑一致性，给每段的 PID/LUID/metric 值与覆盖，整阶段不可比值明确不作为比较输入。
- 637 的 pair 只有 A0→B、B→C、C→D、D→A1、A0→A1。协议要求 B/D 分别相对 A0/A1 展示参考差值；
  补对应 pair，保留方向/负数，不能让用户手算出完整链路相对开始基线的变化。
- 对比目前只有 CPU、工作集、engine；privateBytes/GPU 四项内存虽有每阶段值，未提供相应差值。
  按同身份、LUID/指标门槛分别输出，不相加。“新增 capture PID”仍展示绝对值，另一边不补测量零。

这项是补齐原任务，不做新 benchmark 框架、自动 profiling 或真实操作。

## 下一轮 DS 最小返工

继续只改 compare-phases.mjs/check-compare.mjs、QA README 和交付记录，保留原采样器和生产文件。
先加 F1–F3 独立失败输入的具体断言，再修门槛；F4 按现有结构补分段/参考与逐指标输出。
每次一处局部修改，不整体重写、不新增真实采样或探针。条件用例不仅断言 dataReady=false，
还断言受影响差值为 null/原因正确；覆盖用例检查具体 PID/具体指标，禁止用全局总量。
新增不同逻辑容量、不同 C/D 尺寸、固定条件偏离、阶段错标、额外 PID、负墙钟区间、
读取结束越界、GPU A→B→A 分段的回归；现在“changed adapter set”用例实为一个 unknown 段，未验真切换。
同时验证相同条件/足够覆盖仍能出正确差值，B 的无采集数据正常，CLI 的拒绝/合法不足/新目录写出分别检查。
失败原图/目录不删；不用为此重跑真实窗口或全套视觉检查。完成后交 Codex，不自行提交/推送实现。

## 本轮证据

- DS 对比复跑：`F:/dsh-wallpaper-plugins/dsh-whale-mist/.tmp/perf/compare-check-20261009112243-50896`。
- 采样器复跑：`F:/dsh-wallpaper-plugins/dsh-whale-mist/.tmp/perf/sampler-check-ZHT1Hz`。
- 独立反例：`F:/dsh-wallpaper-plugins/.tmp/perf-compare-review-20261009/cases-JotdyS`，
  含控制组、九项单变量输入、完整结果、findings.json 和 DS 源码指纹。
- 独立入口：同父目录 `reproduce.mjs`；前一份保留输入与 CLI 输出在 `cases-VFT5FB`，不覆盖。

日常仍 rc.1，生产候选 rc.23；本轮未安装/打包/操作真实窗口，未宣称性能优化或五阶段通过。
