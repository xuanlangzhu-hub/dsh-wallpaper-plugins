# 性能采样准备复审：未通过，先修工具，不做窗口实验

2026-10-09。DS 本轮仅交未提交的采样器/调查报告，生产文件和插件包未改动。守住了后台准备范围；四项内存计数、原始 CPU 时间、目标 PID 查询和错误记录的方向保留。但当前数值/归属不足以用于 A→B→C→D→A 对照。

## P1：CPU 增量和 null 被误写

sample-phase.ps1:195 先用当前 cpu 覆盖 previous，202 行再相减，因此输出 cpuSecondsDelta 永远 0。DS 的 selftest12.json 最后样本 cpuSeconds 从 30.6875→30.703125、百分比 0.020606926，但 delta=0；手算使用真实差值，与落盘原始字段并不一致。

不可读 TotalProcessorTime 在算术/Math.Round 中转成 0。报告说 dwm 为 NULL，selftest9.json 六条实际输出 cpuSeconds/百分比/delta 全 0，平均也为 0。合成缺失 CPU 用例同样复现。

先保存 oldCpu/oldTime、判断两个 CPU 读数及身份有效，再计算 delta 和 percent，最后更新缓存。缺失保留 null/原因，不建立假的基线；每进程取值失败不丢整个阶段。回归应校验 percent=100*delta/(elapsed*logical)，以及缺失→恢复的首次有效读数不计算跨缺口增量。

## P1：PID 归属和所谓固定路径不成立

Resolve-Paths:68–72 返回的是 pid_$pidValue* 通配符，未展开为实际路径。PID=42 会匹配 420，Read-Fixed 又不筛目标 PID，合成数据的 processGpu 混入 420。本机自检没有相近 PID，并不能覆盖此错误。

初始 targets/identity 之后只按数字 PID Get-Process，未复核 StartTime/路径；合成用例原进程 42 退出、另一进程复用 42 后，仍 alive=true 并计入旧目标。RediscoverEvery 也只看原 targets，不会发现新 Node/renderer；“能抓中途新进程”不准确。

查询边界改为 pid_<id>_*，发现阶段真正解析 CounterSamples.Path 后缓存精确路径；读取再次核验目标 PID。每轮复核 pid+StartTime/可读路径，身份变化要中止/使阶段无效或显式分段，不能测到替身。新目标由明确的阶段清单提供，不按名字自动跟随所有同名进程。

## P1：GPU 无效/缺失变成零，部分有效值被丢

Read-Fixed 内存字典把四项默认 0。一项无效/不存在、另几项正常时，无效项仍写 0：合成 Dedicated invalid / Shared valid 得到 dedicatedBytes=0。Get-Counter -ErrorAction Stop 遇到单项错误又会丢整组有效值，invalidInstances 反而变 0。

每个计数项初始化 null，保存实际 Status/错误/读取时间；尽量保留有效目标的部分返回。已确认成功的真零保持 0。不要混合未知与真零。

PDH 的有效状态包括 VALID_DATA 和 NEW_DATA，当前只接受 Status=0。合成 Status=1 的 Copy 值被丢。按 [Microsoft 状态文档](https://learn.microsoft.com/en-us/windows/win32/perfctrs/checking-pdh-interface-return-values) 验证/处理 0、1，其它保留原状态。同类型多个引擎可做明确命名的 max，但应保留物理/引擎实例和原值以便复算。

## P2：健康度把有效空闲当测量失败

健康度是值是否 >0 / >0.05，不能代表是否读取成功。全部有效的 idle CPU/GPU/内存=0 用例 sampleReadOk=true，却输出 measurement failure。正式 A 基线可能正是这种状态。

分开 availability/completeness 与 activity，空闲真零是有效样本。不要用是否非零决定能否求均值。

## P2：汇总和时间边界需要明确

- 总拓扑任意一次变化后，所有后续样本永久 excluded，包括回到第一套适配器；一次 adapter 查询失败产生空集也会触发。现在 summary 仍可只拿前几条算整阶段均值。选择“整阶段无效”或显式分段并写有效覆盖，不能把少量前段当完整结果；CPU/GPU 的可用性也需分开。
- 注释说跨 LUID 不相加，summary gpuCommittedMiBAvg 却相加。按适配器逐项汇总四指标，避免叫单一“显存”；不假定不同指标/适配器必然可加或必然重复。
- CPU 在前、GPU/adapter 在后，单个 at 不能代表所有读数同刻。保存各读取区间/provider timestamp；CPU 均值优先用总有效 delta/总时间，采样间隔不等时不能用简单平均替代阶段利用率。
- Output 开头 Test-Path、末尾 Set-Content，中间若另一轮写同一文件仍可覆盖。最终用 CreateNew 原子创建，并记录完整性/不足样本状态；参数范围先验证。

## 接口调查交付尚缺一项

本轮提供的是采样接口调查，尚未给出“这个独立 WE 源能否单独限制渲染率/质量”的官方接口或项目属性结论。补静态文档/本地项目声明调查，不能猜 -fps 或改全局设置。GPU 时钟/功耗的未知项保留 unknown，不必为它扩大成本。

## 下一轮仅修这些后台项

把上述故障做成可重复、无窗口的小回归：CPU 递增/null、相近 PID/复用、单项失效/部分返回/有效零/Status=1、拓扑读取失败及恢复、输出冲突。生产/Profile/官方 EXE/包不改，不启动真实壁纸窗口、不安装、不推实现。先交修正工具与合成对照；通过后 Codex 再制定阶段进程清单与协作采样，不先讨论优化代码。

本次没有运行真实采样器访问日常进程，而是替换只读提供程序，执行原脚本得到三个 3 样本用例和一个 idle 用例。DS 原文件/证据未编辑；接口调查中本机速度/硬件值视为其当时快照，本次没有重复验证。

证据：`F:/deepseekharness/.tmp/perf-review-20261009-140230`，mock-sampler.ps1、mock-idle-sampler.ps1、四份原始输出、confirmed-findings.json、DS 文件哈希。DS 自检实际位于 F:\dsh-wallpaper-plugins\.tmp\perf-rc24（不是插件目录下），旧数据保留。微软 [Get-Counter 文档](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.diagnostics/get-counter) 明确星号仍是实例通配符；此工具未实现报告所称的精确路径缓存。
