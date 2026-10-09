# 源渲染性能：采样接口调查报告与本轮产出

> 历史 DS 交付快照。最新以 [Codex 修复记录](../../docs/PERF_SAMPLER_REPAIR.md) 和
> [采样器说明](../qa/perf/README.md) 为准。下文旧 health/summary 字段、自动发现新进程、
> CPU 管道已一致等结论已被初次复审纠正；selftest12 原始 delta=0，不能作为增量正确的证据。
> `selftest9` 不可读 CPU 被旧脚本写成零，不能据此声称缺失值已正确保持 null。
> `.tmp/perf-rc24` 是仓库根下的历史证据，硬件/速度/权限不代表本轮重新验证。

2026-10-09。依据 [NEXT_SOURCE_PERFORMANCE.md](../../../docs/NEXT_SOURCE_PERFORMANCE.md)（基线 rc.23，日常 rc.1）。
**本轮不启动真实壁纸窗口、不安装插件、不改生产行为。** 只做采样工具与接口调查，交 Codex 审查。

本轮没有改动 `src/client.js`，没有改动任何包，没有触碰 Profile、官方 EXE 或原 WE 进程。

## 产出

| 文件 | 作用 |
| --- | --- |
| `qa/perf/sample-phase.ps1` | 分阶段采样器：`-Phase X -Output <新文件> [-Seconds] [-IntervalMs] [-ProcessIds] [-NameFilter]` |
| `.tmp/perf-rc24/probe-interfaces.ps1` | 接口调查脚本（只读，写一份 JSON 报告） |
| `.tmp/perf-rc24/interfaces.json` | 本机能力实测结果 |

采样器只读：不启动/停止任何进程，不改任何设置，只写自己那一个 JSON。输出文件已存在时会拒绝，
避免覆盖上一阶段的测量。

## 接口调查结果（实测，非假定）

### 这台机器（用于换算 CPU 百分比）

- 逻辑处理器 **32**，物理核 28，插槽 1，物理内存 16077 MiB。
- 两个适配器：**Intel UHD Graphics**（驱动 31.0.101.4502）与 **NVIDIA RTX 4060 Laptop GPU**（驱动 32.0.16.1714）。
  `Win32_VideoController.AdapterRAM` 分别读到 1024 MiB 与 4095 MiB —— 后者是 32 位字段的上限，
  **不能当作真实显存**。显存只能按进程/适配器计数器取。

### 可用的计数器集

| 计数器集 | 实例数 | 用途 |
| --- | --- | --- |
| `GPU Engine` | 1079 | 按 pid/适配器/引擎类型的使用率 |
| `GPU Process Memory` | 70（pid 实例） | 按 pid+适配器 的显存，**四个计数器** |
| `GPU Adapter Memory` | 3 | 按适配器的显存占用 |
| `GPU Local / Non Local Adapter Memory` | 3 / 1 | 本机/非本机适配器内存 |
| `Process` | 153 | 进程 CPU（本机可用） |
| `Process V2` | — | **本机取不到数据**（"没有要返回的数据"），不能作为主路径 |
| `Energy Meter` / `Power Meter` | 5 / 2 | 存在，但本轮未验证其语义，**未纳入采样** |

`GPU Process Memory` 的四个计数器：`Dedicated Usage`、`Shared Usage`、`Non Local Usage`、`Total Committed`。

### 关键实测：只取专属显存会误报

`wallpaper64`（pid 12312）空闲态实测：

| 指标 | 值 |
| --- | --- |
| Dedicated | **0.0 MB** |
| Shared | **198.3 MB** |
| Non Local | 0.0 MB |
| Total Committed | **212.9 MB** |

只读 `Dedicated Usage` 会得出"该进程不用显存"的错误结论。四个必须一起取。

### 关键实测：全量通配符查询慢 5–10 倍

| 查询 | 耗时 | 实例数 |
| --- | --- | --- |
| `\GPU Engine(*)\Utilization Percentage` | **8542–15540 ms** | 1079 |
| `\GPU Engine(pid_<某个 pid>*)\Utilization Percentage` | **1609 ms** | 60 |
| `\GPU Process Memory(*)\*`（单个计数器） | 约 1035 ms | 70 |
| `\GPU Adapter Memory(*)\Dedicated Usage` | 约 1024 ms | 3 |

所以采样器**先按目标 PID 解析出固定路径列表再用**，并且每采样若干次才重新解析（`-RediscoverEvery`，默认 12），
以便中途新出现的进程仍能被抓到。另外每次 `Get-Counter` 都要等提供程序的 1 秒采样窗口，
因此 `-Seconds 45` 大约得到 15–25 条样本，**不是 45 条**。这一点写在报告里，免得被当成掉帧。

### 权限限制

`TotalProcessorTime` 对受保护的系统进程返回空：`dwm`、`lsass` 实测为 NULL（`explorer`、`wallpaper64` 正常）。
本轮目标（wallpaper64 / 各 helper / Node / renderer）都能读到，但**不能拿 dwm 之类做对照目标**。
采样器把这种情况记为 `alive=true` 且读数为 null，不当作 0。

## 采样器记录什么

每个样本包含：

- `processes`：每进程 CPU（占**本机全部逻辑处理器**的比例，同时保留 `cpuSecondsDelta` 与
  `wallClockSecondsDelta` 以便复算）、工作集、私有字节、线程、句柄；
- `processGpu`：按 pid + 适配器 LUID + 引擎类型的最大使用率与实例数；
- `processVram`：按 pid + LUID 的四个显存指标；
- `adapters`：该样本的适配器 LUID 集合与占用；
- `health`：本样本是否真的测到了东西（`phaseLooksMeasured`）、无效实例数、适配器集是否稳定。

阶段汇总 `summary` 只对**适配器集未变化的样本**求均值（计划要求：实例变化时该记录无效、不当零），
并给出 `samplesExcludedForAdapterChange`；若整个阶段什么都没测到，写出 `warning`，
不让它看起来"很省"。

## 自检结果（对已在运行的进程，未启动任何新窗口）

证据文件在 `.tmp/perf-rc24/`：

| 文件 | 内容 |
| --- | --- |
| `interfaces.json` | 接口调查的完整输出 |
| `selftest8.json` | `wallpaper64` 空闲态 7 条样本：四计数器证明 shared 198.3 MB |
| `selftest9.json` | `dwm` 对照 6 条样本 + 阶段汇总：3D 引擎均值 3.0% |
| `selftest12.json` | `explorer` CPU 管道 5 条样本 |

| 目标 | 结果 |
| --- | --- |
| `wallpaper64`（空闲） | 7 条样本、0 计数器错误；健康度显示有显存读数、无引擎读数（该进程此刻确实空闲） |
| `dwm`（持续渲染，对照） | 6 条样本；3D 引擎均值 3.0%；显存跨 3 个适配器（638.6 / 25.1 / 229.2 MB committed） |
| `explorer`（CPU 管道验证） | 第 5 条 `delta 0.0156 s / 窗口 2.37 s / 32 逻辑处理器 = 0.0206%`，与手算一致 |

CPU 时间在 Windows 上按 15.6 ms 跳变，因此相邻样本的 delta 常为 0，**均值才有意义** ——
这是采样器的行为，不是缺陷。

## 已知限制（请复审时一并评估）

1. `-Seconds` 是墙钟预算，不是样本数承诺；想拿够样本应给足时间。
2. 没有 GPU 时钟/功耗：`Energy Meter`/`Power Meter` 存在但语义未验证，**本轮不写入报告数据**。
3. 没有整卡 GPU 百分比：只有按 pid/引擎的计数；汇总里也写明了这一点，避免被读成整卡占用。
4. `Process V2` 在本机不可用，CPU 走 `Process` 计数器 + `TotalProcessorTime` 差分。
5. 阶段之间需要一个统一的"阶段清单"驱动（A→B→C→D→A），**本轮未实现**：
   尚未确认四段各自的进程集合由谁提供（helper 名前缀？端口文件？），也没有把阶段结果并排比较的脚本。
   这是下一轮动手前需要先定的接口问题。

## 下一步（等用户确认范围后再做）

按计划：A 原桌面 → B 仅独立源 → C 源+采集 → D 完整 DSH → A，每段 30–60 秒，
记录当前唯一名字/PID/启动身份、变化帧与实际尺寸。动手前需要先确定：

- 每阶段的进程集合如何唯一识别（计划要求"当前唯一名字/PID/启动身份"）；
- 阶段清单与并排比较的输出位置；
- 是否需要 GPU 时钟/功耗（若要，需先验证 `Energy Meter`/`Power Meter` 语义）。
