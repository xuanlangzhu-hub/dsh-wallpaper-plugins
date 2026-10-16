# 给 Gemini：复杂壁纸性能测量工具，第一步

2026-10-14已完成：[P1前台实测结果](COMPLEX_SCENE_P1_FOREGROUND_RESULT_20261014.md)。P1工具无需继续返工或重复采样；当前下一步为[前端P2实际接缝观测](GEMINI_NEXT_FRONTEND_PERF_P2_20261014.md)。日常rc.28保留，以下“下一步短测”是此前历史；不要按旧后台样本直接改回读/JPEG或重跑GPU矩阵。

2026-10-14最新接续：[P1最终复审已通过](PLAYBACK_PERF_P1_FINAL_REVIEW_20261014.md)。三语法/九类检查、28组独立反例/控制及额外3个正常边界均通过，生产/日常rc.28保留。Gemini无需继续返工本轮工具；下一步Codex协调用户方便做短前台静止/鼠标对照，审核可比数据后再定最小优化，当前未实采/安装。[首轮R1–R4](PLAYBACK_PERF_P1_REVIEW_20261014.md)、[二次F1–F4](PLAYBACK_PERF_P1_SECOND_REVIEW_20261014.md)、[三次G1–G3](PLAYBACK_PERF_P1_THIRD_REVIEW_20261014.md)为历史，下文保留原任务和保护指纹，不能机械按旧阻塞项继续返工。

2026-10-14。用户已选择继续推进复杂壁纸性能问题。本轮由 Codex 定范围，Gemini 编码，交 Codex 复审；复审后再由 Codex 配合用户做短的前台静止/鼠标移动对照，然后确定最小优化。**这一轮先把测量做准确，不修改日常播放实现。**

## 目标与基线

日常版本是 **0.6.0-rc.28**，用户正在试用。周期停顿已修复，但「三体实时演算 | Three-Body problem - SYKM」等复杂场景仍有整体低帧率和鼠标联动不顺。先读 `AGENTS.md`、`NEXT_TASK.md`、`docs/PROJECT_STATUS.md`，以及：

- `docs/COMPLEX_SCENE_PERFORMANCE_NOTES_20261014.md`：后台约20秒快照送帧10.55fps，回读/等待62.26ms、JPEG20.99ms；client.hidden=1，不能当前台帧率或鼠标根因。
- `docs/RC28_PERIODIC_STUTTER_REPAIR_20261014.md`：周期状态不能执行进程/窗口枚举，最终清理仍强核验。
- `dsh-whale-mist/qa/perf/README.md`：已有工具的只读、证据与输出习惯。无需改旧CPU/GPU采样器或五阶段比较器。

现有上限30fps；正式链路为WGC → SoftwareBitmap回读 → 每帧JPEG → WHL1 → DSH解码绘制。本机后台数据支持优先检查回读/等待，但尚未完成可比的前台测量。原生桌面源FPS、实际屏幕呈现帧率、鼠标动作的额外代价仍未知。

本轮交付：一个只读观察器、一个离线阶段分析器、对应有数值断言的检查和使用说明。先用当前日志结构解决这一步；如果某项确需生产埋点才能测，写明缺口，留到下一小步，不为补未知值扩大修改范围。

## 1. 只读观察器

建议新增 `dsh-whale-mist/qa/perf/watch-playback.mjs`，从插件目录调用：

```powershell
node qa/perf/watch-playback.mjs --run-dir <本轮明确的播放日志目录> --output <全新目录> --seconds 90
```

只读明确指定目录中的 `status.json`、`preview-status.json`、`frames.jsonl`，不自动发现/创建/启动/停止播放，不查询CPU/GPU计数器、进程或窗口。该工具不会调用正式 helper，也不修改配置。禁止机器固定路径和复用示例PID。

- 默认约1秒取一次状态，最长120秒，记录观察器单调时钟 elapsedMs、UTC时刻、读耗时及文件mtime。初末保存有界帧日志快照；可低频保存中间快照以改善覆盖，但不要每秒复制完整历史或保存JPEG。
- 每个样本保留分析所用的原始字段：Native帧计数/seconds、阶段耗时和尺寸；Host received/sourceSequence；client全部已有计数、seconds、hidden和延迟统计；childPid、window.location、running/failure。字段缺失保留unknown/null，不能填0或合成一帧。
- 注意 Host `updatedAt` 是画面到达时间，不是客户端指标上报时间；文件mtime、client.seconds/计数是否推进需分别记录。原生每秒报Status，Host每秒写report，前端目前每500ms报metrics，不能假设这三个文件是同一瞬间的原子快照。
- 原子替换期间的暂时缺文件/不完整JSON、重复读到同一报告、源结束或身份变化都写明，不无界重试。run目录+window.location+childPid用于区分本轮；同一WE PID可承载多轮，不能单凭PID认定同一轮。
- 只写新的证据目录，已有输出拒绝且不动哨兵文件；文件和样本数均有界。支持输出目录内 `STOP` 或 Ctrl-C 结束观察，结束的是观察器，绝不停止壁纸。保留partial/cancelled及原因，不清理别人的目录。

输出结构和schema可自行简化，但需版本字段、原始样本、帧快照和最终观察报告。声明real/synthetic来源；没有亲自实采的数据不能标real。用Node文件API，不需要再写PowerShell多行替换脚本。

## 2. 离线阶段分析器

建议新增 `qa/perf/analyze-playback.mjs`：

```powershell
node qa/perf/analyze-playback.mjs --input <观察目录> --segments <阶段清单.json> --output <全新目录>
```

阶段清单只需两个可明确定位的观察区间，例如idle/mouse，起止用观察器elapsedMs或样本索引；记录场景、尺寸、采集上限、外观保持一致及用户对DSH前台/鼠标动作的人工记录。清单是数据，不执行其中的指令。不要自动移动鼠标、强制前台或编造动作时间。

报告输出JSON与便于审核的Markdown，至少区分：

| 指标 | 正确口径 |
| --- | --- |
| 原生处理/送帧计数速率 | 同轮计数增量/同轮原生seconds增量，名称明确，不称WE渲染FPS |
| Host接收速率 | 同段Host计数增量/对应有效时间，保留取样/边界误差 |
| 前端接收/绘制报告速率 | fresh client计数增量/client.seconds增量，只在可比、可见区间解释；rendered不是实际合成器呈现时间 |
| 原生耗时分布 | acquire/readback/jpeg/pack/pipe/encode的mean、P50、P95、max，说明各项含义和是否重叠 |
| 帧间隔与长间隔 | 只用严格相邻sequence，给相邻对数和覆盖范围；稀疏历史不算断帧 |
| 延迟 | 既有累计mean/max仅作累计参考；第一版不冒充阶段P95、阶段最大或鼠标到屏幕响应时间 |

Native `encodeMs` 已包含回读、JPEG等步骤，不能再次把它们加进总时间。`sourceAgeMs`与等待有不同语义，也不能随意相加。采集帧时间戳包含采样/漏帧，不能反推出WE真实源FPS。

前端已有latest-only待绘制帧和背压丢旧帧；dropped既可能来自主动后台停绘也可能来自跟不上，不能单凭计数定因。Native的foreground是**壁纸源窗口**状态，不是DSH前台状态。client.hidden=0只证明页面报告可见；DSH前台和鼠标行为的证据明确标manual，不冒充系统检测。

必须处理的分析边界：

- 计数/seconds倒退、run身份改变、尺寸/条件不一致：分段或拒绝比较，不跨重启直接相减。
- client不存在、hidden=1、指标陈旧或时间分母无效：前台指标/比较为unknown，保留仍有效的原生数据。
- 状态重复不新增观察，也不把陈旧计数算作真实零帧；能证明报告新鲜、计数为零增量时，0可合法保留。这个区别要有数值例子。
- 帧日志有界/稀疏：写明样本数、相邻覆盖时间与阶段覆盖不足。可展示样本分布，不宣称它是完整阶段的P95。
- 缺数据不等于坏输入：合法但不足仍可写报告并标inconclusive及原因；坏schema、非法区间、非有限/负时间和冲突的重复帧拒绝，不输出貌似完成的分析。输出已存在就拒绝。

报告明确区分reportWritten与dataReady，不用一句PASS代表性能改善。只在同条件、同轮且有足够覆盖的两段之间给差值；否则差值null并列原因。原生数据可用于确定优先排查方向，不能直接宣布回读、JPEG、鼠标或显卡已是唯一根因。

## 3. 检查与范围

建议新增 `qa/perf/check-playback.mjs`。用少量可算出答案的fixture验证实际文件读取/CLI与分析路径，至少覆盖：

1. 同轮前台两段正常计数，按区间增量计算而非累计总时长；端到端新目录调用成功。
2. hidden/stale/缺client不会生成前台FPS；重复读、真正0增量与陈旧未知区别正确。
3. 序号1→2→30的稀疏帧，只有1→2可计算间隔；有界覆盖标明，不能算出虚假的长停顿。
4. 重启/计数回退、尺寸或条件变化禁止比较；原生foreground=false不会被误判成DSH失去前台。
5. encode包含readback/JPEG的已知数值，不重复计总；累计max不当阶段max，未知延迟不伪造。
6. 缺失/暂时不完整文件、非法时间/schema/冲突帧、已有输出哨兵、STOP或中断均有清楚结果。检查中不创建真实应用或读取实时硬件。

允许修改：上述QA文件、必要的QA共用纯函数、`qa/perf/README.md`、本轮交付文档。不必改package scripts，直接Node命令即可。不要建立新的五阶段平台、重写现有采样器、加入常驻server或诊断UI。

本轮 `src`、原生生产源码、`assets/wallpaper`、版本rc.28和归档保持原样。不给日常加持续计数器，不修改Profile/外观/WE项目/系统设置，不安装或开真实窗口，不提交/推送或清Temp/旧证据。实机由Codex复审后另协调用户方便。

重点保护指纹（2026-10-14写任务时；现有未提交改动均保留）：

| 文件 | SHA256 |
| --- | --- |
| `dsh-whale-mist/package.json` | `A0D2D83A3B7F14CB3A5180975D4C67FF9BB6B0AA7A6A1D3B98940A67B58E52D2` |
| `dsh-whale-mist/src/client.js` | `4BD16FB8DBB4D3D135EFF8300EE71F0B25C6078174AC6846BAF325EFA4422182` |
| `dsh-whale-mist/src/wallpaper/session.js` | `EA5829583129E2917B6718402B1CADBE2E8B480DF23C7DA8B0F2B70EF3821E5C` |
| `dsh-whale-mist/qa/wallpaper-probe/Program.cs` | `D8FAA6B764D7559319ACD52E3194000073CCE0717C43F7C8767507781793AC7A` |
| `dsh-whale-mist/qa/wallpaper-probe/TaskbarHideRuntime.cs` | `A0E1FD3130C3DD041017A82BAD727FF453FB62D9665AAF21566AE6633E79A34F` |
| `dsh-whale-mist/qa/wallpaper-probe/TaskbarHideStrategy.cs` | `27EF741D6358FB55F0D008C65A8D11822D6218E77FF1431685E3A1D2585EEA25` |
| `release/plugins/dsh-whale-mist-0.6.0-rc.28.tgz` | `58F5B6233882D269083D7E478B8ED920E690675A22F868B4BC0E4DD618B9F2FC` |

## 4. 交付

新增 `docs/PLAYBACK_PERF_P1_DELIVERY_20261014.md`：列实际改动、数据schema/字段口径、命令/退出行为、数值检查、证据路径、保护文件前后哈希和仍未知项。只记录关键错误及影响，不写反复自我反省或把试错过程冒充验证。

运行新增工具的语法检查与上述fixture检查，证据放全新`.tmp`目录。未改生产代码时无需重跑原生/Host/GPU/窗口全套；有真实依赖接缝变更再说明并运行相应检查。先交可审查成果，不自行实采日常或声称FPS改善。

Codex收到后会先审工具与反例，再协调用户保持DSH前台进行约20–30秒静止及约20–30秒鼠标移动的短对照。优先复用正在运行的三体；该轮若已结束就另约，不擅自重开。拿到可比数据后才写第二步最小优化；硬件视频、60fps、主题设置和选择器留到有依据的后续范围。
