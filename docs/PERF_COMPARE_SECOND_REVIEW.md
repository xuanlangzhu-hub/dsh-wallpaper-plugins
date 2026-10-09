# 离线对比第二轮复审：旧反例修正，独立边界仍未通过

2026-10-09，main@8e4047d；DS 源码仍是未提交交付。生产候选 rc.23，日常 rc.1 未动。
本轮只离线审查，没有启动 WE/DSH/浏览器或查询真实进程/计数器。

## 这轮已经修好的内容

- DS 的 **27/27** 自检独立复跑通过。
- 上轮独立证据的 **9 个故障用例 + 1 个正常控制组，10/10** 验证通过：不同条件/逻辑容量/帧尺寸、
  稀疏 PID/engine、错误阶段、额外 target、GPU 读取结束越界、负墙钟区间都已阻断或拒绝。
- 原始 CPU 重算、角色去重、负差值保留、补 private/GPU 内存输出、基线参考 pair 的方向保留。

因此不重做上一轮那些已经通过的实现。下列独立边界是未完整落实的逐指标判断、未知值、时间和连续分段，
不是要求新增真实采样或通用框架。**当前仍不能作为已验收工具进入实机。**

## R1 / P1：全空数据仍标为 ready

compare-phases.mjs:430–478 把“完全没有观察值”视作不适用；各指标 appears=false 时 allMet=true。
最终 reasons 为空，dataReady=true；这不能证明必需进程测到了任何资源。

独立 `all-values-missing`：五阶段所有目标的 CPU/工作集/私有字节为 null，GPU 数组全空，身份/条件正常。
结果 **dataReady=true、reasons=[]**，全部 CPU 差值却为 null。

必须区别“角色按设计不存在”（B 没有 capture）与“在场必需角色完全不可读”。后者保持合法输入/原值，
但需 inconclusive 和具体缺失原因；不造零。至少不能在没有任何可用指标时称数据足以比较。
各指标自己用 coverage，不能依赖某个 allMet 一次性证明所有族可用。Optional GPU 缺失也不应抹掉有效 CPU。

## R2 / P1：仍按整个 GPU 族阻断，且 GPU 不确定会拖累 CPU

446–448 使用所有内存项/所有 engine key 的 every；700–708 再用整个 gpuMemory.met/gpuEngine.met
禁止整族输出。618 把 adapterSetsMatch 放在 pair 的公共 gates，gateFor 又用于全部指标。

| 独立输入 | 当前结果 | 应有结果 |
| --- | --- | --- |
| one-memory-metric-missing：Dedicated=null，Shared 两边各 6 个有效观察，200→400 | gpuMemory.rows=[]，Shared 没有差值 | Dedicated null；Shared +200 bytes 及有效数正常，其余指标独立 |
| one-engine-sparse-other-valid：3D 1 个，Copy 6 个，10→30 | 整个 gpuEngines.delta=null，Copy 也丢失 | 3D null；Copy +20 pp 正常并保留各自覆盖 |
| gpu-topology-unknown-cpu-valid：B 全部 adapterLuidSet=null，CPU 两边各 6 区间/60 秒 | CPU delta=null，理由竟是适配器集合未知 | GPU 不可比/总体资料不足；有效 CPU 差值仍可独立展示 |

修复采用两个层次：共同运行条件/身份门槛与 **GPU 专属拓扑门槛** 分开；最后每 PID+LUID+metric、
每 PID+LUID+engineType 分别查两侧有效数。mergeMemoryDeltas/mergeEngineDeltas 的每一行带自己的
delta/null/reason，不能把缺一项等同整族不合格。阶段的概括/完整度标志不能再次耦合 CPU、RAM 和 GPU。
两次明确不同的硬件/运行配置仍要提示条件变化；上述反例是查询未知，不能等同已证实的 CPU 条件改变。

## R3 / P1：时间字段仍漏查；两侧未知帧尺寸仍当正常

- 422–426 只查 readStartedAt/gpuReadFinishedAt，未检查 cpuReadAt/gpuReadAt。
  `cpu-timestamp-outside` 把 B 的一个 cpuReadAt 放到窗口之外，仍 **dataReady=true、CPU delta=0**。
- readsWithoutTime 只统计 start 缺失。`gpu-end-missing` 删除 B 全部 gpuReadFinishedAt，
  readEnds 过滤为空但不计缺失，仍 **dataReady=true、CPU delta=0**。
- 591–599 对 C/D 两个 captureFrameSize 都 null 时没有任何阻断。
  `both-capture-sizes-unknown` 仍 **dataReady=true、C→D CPU delta=0**，实际同像素工作量未证。

读取区间校验覆盖四个现有时间字段及合法顺序；缺必需字段/不可解析时间按坏结构处理，越界按合法不足
标原因/禁止相应比较，不 filter 掉就忘记。有效 CPU 区间的时间边界也要解释，不用不存在的时间证明窗口内。
C/D 对比要求两边实测稳定帧尺寸都已知且匹配；两边 null 不是相等的尺寸。
A/B 天然没有采集帧尺寸，仍不应误报错误。保留 phase 原值，不要求工具去采帧补元数据。

## R4 / P2：A→B→A 被按集合合并为两段

370–415 的 bySet Map 按集合归组，非连续 A 段被合并。独立 `a-b-a-segments` 的 6 个顺序样本是
A,A,B,B,A,A，输出却是 **A=4、B=2 两组**，无法表达各连续区间的时间/数值。

按采样顺序建立连续段：A 2、B 2、A 2，标各段起止/有效数，分别算 PID/LUID/metric 数值；
unknown 段如实记录。不能用按集合聚合代替时间段。按样本统计 unknownTopologySamples，
目前代码还从旧 summary/声明取计数，可能与已经核对出的 raw null 集合不一致。

现有名字叫 “true A to B to A” 的自检实际是 **A0/B/C/D/A1 各阶段内部均稳定**，
只检查阶段间集合不同、segments.length>=1，没有检验一个阶段内部的连续三段。
请加真正的上述六样本断言，不能只换测试名字或把期望写成当前实现。

## 下一轮仅做 R1–R4

授权文件仍是 compare-phases.mjs/check-compare.mjs、QA README 和交付记录。
不改原采样器、生产、原生资产、SDK 或版本，不实机/打包/安装/提交推送，不删旧证据。

先加入上述输入的明确断言，再做局部修正。包括全部 null、必需角色无有效读数、GPU 单项缺失仍保留其它项、
同族稀疏 key 不拖累有效 key、GPU 未知不抹掉 CPU、CPU/GPU 时间遗漏/越界、C/D 两边尺寸未知、
真正连续 A→B→A 三段。正常控制组和旧 9 项阻断仍须通过，B 无 capture 正常。
不要增加任务框架或无关探针；重点是每行 delta/null/reason 和 dataReady 是否一致。

## 证据与边界

- DS 检查：`F:/dsh-wallpaper-plugins/dsh-whale-mist/.tmp/perf/compare-check-20261009114925-15080`，27/27。
- 本轮独立入口：`F:/dsh-wallpaper-plugins/.tmp/perf-compare-rereview-20261009/reproduce.mjs`。
- 独立结果：同目录 `cases-ZO3p4Z`，保留输入、各完整 result、observations.json。
- 旧反例入口：同目录 `verify-old.mjs`；结果 `cases-ZO3p4Z/old-counterexample-checks.json`，10/10。
- DS 原代码/输入/历史输出未编辑；本輪核对采样器与生产没有 git 改动，未为未改代码重复真实验证。

这一轮确认旧九类故障已改好，同时上述边界仍失败；不是性能测量结果，也不证明插件性能改善。
