# 三体复杂场景 P1：前台静止与鼠标移动结果

2026-10-14，Codex。用户确认其它助手暂停、DSH 没有运行任务，当前播放「三体实时演算 | Three-Body problem - SYKM」。用户控制前台和鼠标，观察器只读既有日志。本轮测量已完成，日常仍是 **0.6.0-rc.28**；没有修改播放实现或完成性能优化。

## 当前结论

本轮原生处理/送帧和 Host 接收在两段均约 **22.3fps**；前端的解码后计数速率从静止时 **22.31fps** 降到鼠标段 **18.98fps**，鼠标段新增 **64 次待处理旧帧覆盖**。优先补前端等待回调、解码和画布调用的分段计时，再选择最小优化。

这是两次同一运行的短样本，选定窗口约相隔 **7 分 12 秒**，不能据此认定鼠标是唯一原因。原生为什么未达到 30fps 采集上限也尚未解释。没有测 WE 源渲染 FPS、DWM 呈现 FPS 或端到端鼠标延迟。

## 条件、身份与覆盖

- 日常 rc.28、同一会话/窗口/外观参数由用户保持；没有修改供电或系统图形设置。电源、温度和源场景随时间变化未独立监测。
- 运行目录：`C:\Users\HP\AppData\Local\Whale Appearance\wallpaper-preview\2026-10-14T081957-e1fe-we-41612c520dd4406e48dea550`。
- helper PID `44780`；源标识 `WhaleWallpaperProbe-261014081957-f61f`；原 WE PID `12056`；采集尺寸 **1302×776**。
- 采样后的定向只读命令行核对确认：采集上限 **30fps**、`pipe` 模式。该定向核对不属于观察器的采样循环；观察器没有枚举窗口、进程或硬件计数器。
- 两段各 18 个选定状态样本，所有 `client.hidden=0`，身份和尺寸相同，status/preview 读取错误均为 0。DSH 前台与鼠标动作来自用户确认；源窗口的 `foreground=false` 不表示 DSH 不在前台。

| 项目 | 前台静止 | 前台缓慢移动鼠标 |
| --- | ---: | ---: |
| 选定窗口（Asia/Shanghai） | 16:30:59.989–16:31:20.576 | 16:38:11.954–16:38:32.476 |
| 观察时间跨度 | 20.587s | 20.522s |
| client 有效时钟跨度 | 19.990s | 19.498s |
| client 时钟覆盖比 | 97.1% | 95.0% |
| 不同 client 报告数 | 18 | 18 |

原计划在同一观察器内接续两段，但网络/工具接续延迟使首个观察器运行完 120 秒后才收到下一段操作。实际使用静止观察器早期约 20.6 秒与独立鼠标观察器约 20.5 秒；没有用全段累计数据替代它们。两个观察器之间有约 **5 分 12 秒未采样空档**，没有插值，也没有称为连续对照。两段内的原始单调时间保持不变；UTC 偏移只用于合并时间轴展示。

`idle-middle-frames.jsonl` 实际复制于静止观察器开始约 179 秒后，不属于选定静止窗口，未用于分析。两段之后均已提示用户结束指定动作；两个 Node 观察器已经退出，没有遗留新的观察任务。

## 数值结果

| 指标 | 静止 | 鼠标移动 | 鼠标减静止 |
| --- | ---: | ---: | ---: |
| Native 处理/送帧计数速率 | 22.34fps | 22.31fps | -0.03fps |
| Host 接收计数速率 | 22.38fps | 22.32fps | -0.06fps |
| client 接收报告速率 | 22.31fps | 22.31fps | 0.00fps |
| client 解码后 `rendered` 计数速率 | 22.31fps | 18.98fps | -3.33fps |
| client 接收 / rendered 增量 | 446 / 446 | 435 / 370 | — |
| client `dropped` 增量 | 0 | 64 | +64 |
| client `decodeErrors` 增量 | 0 | 0 | 0 |
| acquireMs 状态样本均值 | 0.02ms | 0.02ms | 0.00ms |
| readbackMs 状态样本均值 | 8.49ms | 8.57ms | +0.08ms |
| jpegMs 状态样本均值 | 5.13ms | 6.73ms | +1.60ms |
| packHashMs 状态样本均值 | 0.14ms | 0.21ms | +0.07ms |
| pipeMs 状态样本均值 | 0.20ms | 0.12ms | -0.08ms |
| encodeMs 状态样本均值 | 14.26ms | 16.21ms | +1.95ms |

计数速率各用其自身报告时钟计算，报告异步，因此 Native、Host、client 的小幅差值不能解释为逐帧丢失。鼠标段接收与 rendered 差 65，而 dropped 增量 64；边界仍可能有待处理/解码中的帧，不能强行补造一帧。

阶段耗时采用双方同样 **18 个固定节奏 status 样本**；这是状态抽样分布，不是每帧全覆盖分布或完整阶段 P95。`encodeMs` 已含回读、JPEG 等部分，不能重复相加。鼠标段 JPEG 变慢约 1.6ms，但 Native 吞吐仍相近，不能据此直接选 JPEG 为唯一瓶颈。

原生帧记录的覆盖不对称：静止窗口只有 15 条稀疏记录、0 个严格相邻对，间隔统计为 unknown；鼠标窗口有 460 条记录、459 个严格相邻对，间隔均值 44.83ms、P50 45ms、P95 50ms、最大 55ms、≥250ms 为 0。只能说鼠标选定窗口的原生输出未记录长间隔，不能声称静止段也没有长间隔或真实屏幕无卡顿。

## 源码核对：现有计数的实际意义

源码基线为本轮未修改的 rc.28 工作区：

- `dsh-whale-mist/src/client.js:469` 等待 `createImageBitmap`；`:471` 在有效解码后就增加 `rendered`，`:474` 才调用同步的 `emitFrame`；真实 `drawImage` 在 `:1126`。因此现有 rendered 是**解码后准备交给订阅者的计数**，不证明画布成功调用，更不证明屏幕呈现。
- `client.js:504–509` 中 `dropped` 只在新帧覆盖已有 `latest` 时增加。这 64 次表示待处理槽位被覆盖；可能发生在解码期间、等 RAF/兜底回调期间，或同步订阅者处理阻塞之后，现有字段不能区分。
- `client.js:478` 的 `decodeErrors` 捕获整个解码/订阅者 try 块，名字并非严格的解码专用错误计数。增量为 0 不证明解码便宜。
- `client.js:491–501` 已有 RAF 与 250ms 兜底；已实行 latest-only。`Program.cs:255` 已减去本轮处理时间再等待，不能把简单“扣掉编码时间”当成未实施的优化。

现有自动分析报告将 rendered 标为“前端绘制/canvas计数”，该标签比源码事实强。本报告明确纠正口径，**原始工具输出不追改**；P2 必须在工具说明/标签中同步纠正，历史字段保持兼容。

[上午后台快照](COMPLEX_SCENE_PERFORMANCE_NOTES_20261014.md)是另一轮运行且 `hidden=1`：10.55fps、回读62ms/JPEG21ms的历史事实保留。新前台样本不能当作针对上午数据的优化前后对照，也没有证明复杂场景问题已解决。

## 证据与接续

证据目录：`F:\dsh-wallpaper-plugins\.tmp\complex-scene-p1-live-20261014-1389ab83`。

- `manual-context.json`、两个 `*-manual-mark.json`：用户确认和条件。
- `observation/`、`mouse-observation/`：两个观察器原始 status、preview、帧快照与时间。
- `prepare-analysis.mjs`、`combined-observation.json`、`uniform-status-observation.json`、`segments.json`、`selected-window-audit.json`：合并过程、选定窗口与空档标注；同序号一致的重复记录去重，未制造帧。
- `frame-analysis/analysis.json` / `.md`：相邻帧覆盖和间隔；`uniform-status-analysis/analysis.json` / `.md`：公平的状态抽样耗时比较。两份均 `reportWritten=true`、`dataReady=true`，还须按本报告的覆盖/语义边界解释。
- `helper-launch-metadata.json`、`tool-hashes.json`、`protected-files-final.json`、`installed-rc28-verification.json`：限定启动参数、工具指纹、7 项生产保护输入和日常安装 28 文件核验。

7 项保护输入保持一致，安装的 28 文件与既有 rc.28 包一致。未编辑 Profile/外观、停止原 WE、改官方 EXE、重启 DSH、创建壁纸窗口、提交或推送；用户继续自行控制当前播放。

下一步按 [Gemini 前端性能 P2 范围](GEMINI_NEXT_FRONTEND_PERF_P2_20261014.md)只补必要分段观测。Codex复审后再另约短测；不重跑 GPU 矩阵、长测或已有 P1 工具返工。
