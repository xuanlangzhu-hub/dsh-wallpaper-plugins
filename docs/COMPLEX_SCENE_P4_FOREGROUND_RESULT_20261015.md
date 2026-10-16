# 三体 P4 原生等待前台短测结果

2026-10-15后续补充：[运动节奏不匀的新症状](MOTION_CADENCE_SYMPTOM_20261015.md)。用户与桌面原壁纸比较后，报告 rc.31 和目前 rc.28 似乎都有球运动突然加减速、呈一顿一顿的节奏；不是此前近一秒停住。下文关于等待/吞吐改善的结论保留，但不能将当时“无明显卡顿”扩大为运动均匀性已验收。只读逐帧时钟复查及后续窄观测范围已单列，尚未定位/修复。

2026-10-15，Codex。[rc.31 候选](RC31_NATIVE_WAIT_P4_CANDIDATE_20261015.md)已临时安装并完成同一轮三体的前台静止/鼠标短测。**P4 的局部等待改善已进入真实采集循环：额外等待约 0.46/0.40ms，采集周期约 33.93/33.56ms，送帧计数约 29.48/29.80 次/秒。用户反馈“好了很多，至少没出现明显卡顿”。**

本轮短测与停止清理通过；该结论限于本机、该 scene、此次短窗口。日常已按计划恢复 rc.28 及本轮原设置，用户已重开确认正常并保持停止；rc.31 归档保留，不自动转为日常。

## 条件与覆盖

- 用户确认其它助手暂停、DSH 无运行任务并正常退出；本轮新备份五份 Profile、十份关闭状态 Local Storage，未复用上午或前轮备份。
- 官方 CLI 临时安装 rc.31，28 个安装文件与候选归档逐字节一致；安装没有改动这十份关闭状态外观文件。用户随后正常打开、手动开始三体，日常模式/自动播放关闭，窗口和外观保持。
- 场景：三体实时演算 | Three-Body problem - SYKM，用户确认。
- 同 run：2026-10-15T073308-a057-we-41612c520dd4406e48dea550；capture PID 40064；location WhaleWallpaperProbe-261015073308-c2fe；1302×776，30fps 目标，pipe/forever。
- 实际启动诊断保存在 preview-final 的 diagnostics.messages[3]：backend=kernel-highres-worker，highResolution=True。
- 静止选定窗口：北京时间 15:33:51.401–15:34:12.146。
- 鼠标选定窗口：北京时间 15:35:09.872–15:35:30.619。
- 每个原始观察器约 27 秒、19 样本；每段选定 15 样本，约 20.75 秒。客户端 hidden 均为 0，36 个前端字段与 22 个原生字段齐全，读取错误 0，前端进度覆盖约 96.4%，严格相邻原生帧覆盖均为 100%，完整分析 dataReady=true。
- 两个选定窗口之间相隔 57.726 秒，不宣称鼠标是两段差异的唯一原因。前台/鼠标操作来自用户确认，不是 OS 焦点或物理屏幕采样。
- 整轮播放约 197.13 秒，包含手动操作和阶段切换等待；性能结论取上述两个选定短窗口，并非把整轮等待当成连续控制实验。

观察器只读已有日志，不驱动窗口、输入、GPU 或运行时参数。一次 PowerShell 人类可读预览因 Width/width 大小写键冲突未展开；Node 观察器及实际原始 JSON 未受影响，后续改用保留大小写的解析并从实际样本核对身份，最终分析中没有把当时的 null 展示值当数据。

## 实测

| 指标 | 前台静止 | 缓慢移动鼠标 |
| --- | ---: | ---: |
| Native 处理/送帧计数每秒 | 29.48 | 29.80 |
| 前端 received 计数每秒 | 29.45 | 29.81 |
| 同步 drawImage 完成计数每秒 | 29.45 | 28.51 |
| 成功帧起点间隔均值 | 33.93ms | 33.56ms |
| 请求 pacing 等待均值 | 17.66ms | 17.29ms |
| 实际等待/恢复均值 | 18.12ms | 17.69ms |
| 实际减请求等待 | 0.46ms | 0.40ms |
| 总工作均值（等待前） | 15.50ms | 15.54ms |
| 记录后工作均值 | 0.70ms | 0.36ms |
| 状态发布次数/每次均值 | 20 / 20.36ms | 20 / 9.87ms |
| 空帧重试增量 | 0 | 0 |
| 前端 RAF 等待均值 | 0.66ms | 1.82ms |
| 前端 JPEG 解码均值 | 7.80ms | 5.37ms |
| 同步通知 / drawImage 均值 | 0.07 / 0.03ms | 0.06 / 0.03ms |
| 待处理帧覆盖 | 0 | 26（解码时7、等待回调时19） |
| 解码失败/同步错误/绘制错误增量 | 0 / 0 / 0 | 0 / 0 / 0 |
| 严格相邻原生帧间隔 P95 / 最大 | 37 / 88ms | 37 / 41ms |
| 原生相邻帧 ≥250ms 长间隔 | 0 | 0 |
| 客户端累计帧龄高水位，窗口起→止 | 248→248ms | 273→273ms |

这些是软件边界计数和耗时，不是 Wallpaper Engine 源渲染 FPS 或物理屏幕呈现 FPS。状态发布已包含在记录后工作，记录后工作与 encode 包含在总工作，不能重复相加；表中的累计帧龄高水位不是本段帧龄 P95，也不是实际冻结时长。

本轮等待实际值包含原生等待、线程调度、异步 continuation 至恢复后读时钟的全过程。空帧累计最大值虽非零，但两个选定窗口内 retry 增量为零，不把运行早期空帧等待算进本段。

## 判断与边界

历史 rc.30 同三体记录约 46.4ms 周期、实际等待额外约 13.2ms、送帧计数约 21.5 次/秒；本轮约 33.6–33.9ms、额外 0.4–0.46ms、29.5–29.8 次/秒，方向与局部等待隔离结果一致。结合实际 kernel-highres-worker 诊断，可确认等待接入在真实播放循环中生效。

rc.30 与 rc.31 不同 run、不同时间，历史数据仅为参考，不能把全部数值变化归为严格同条件 A/B 的净收益，不推断功耗、GPU/游戏收益或长期稳定性。目标仍为 30fps，没有通过提高上限或更改全局计时器取得本轮数字。

用户本轮明确反馈“好了很多，至少没出现明显卡顿”，原始完整回复保存在 manual-context.json。本轮未再看到之前接近一秒的明显卡顿体感；这可作为本轮视觉体验改善的人工确认。鼠标段仍有 26 次覆盖、draw 计数低于 received，不能由一次短测宣布所有源响应/前端排队问题永久消除，也不应再以仅有原生日志否定用户体感。

P4 复审、候选准备和本机短测可以收尾，小 G 无需继续返工该等待方案，也无需机械重跑 GPU/P2/长测。后续按用户的实际使用需求决定是否将已保留的 rc.31 改作日常；若未来复现联动停顿，再独立调查具体源响应或传输/前端排队。

## 停止、恢复与当前状态

- 用户点击停止并正常退出。Native Summary reason=parent-stop，owned window outcome=closed、closed=true，taskbarHide.cleanupSafe=true、stage=action-done。
- Host 最终 running=false、failure=null，窗口清理再次确认 absent/closed；全轮 Native frames=5792、changed=5792。
- 停止后及恢复后只读源窗口枚举均为空，capture/worker=0；原 Wallpaper Engine PID 10344、UTC StartTime 2026-10-15T00:46:54.4044782Z 保留。
- 保存本轮测试后 Profile 与完整 Local Storage，再通过官方 CLI 恢复活动 rc.28 归档；28 个安装文件一致，五份 Profile 和十份关闭状态外观文件恢复到本轮备份，未套用旧外观。
- 用户已重开确认“重开正常，已保持停止”。当前日常是 rc.28，不是 rc.31。
- 官方 DSH EXE、app.asar、原 WE EXE 哈希保持；26 复审输入、54 工作区保护文件及 rc.28/29/30/31 归档保持。工作区版本/assets 仍为 rc.30 基线，rc.31 由独立暂存目录打包。
- 未修改实现、设备/全局计时器/FPS/主题策略，未提交或推送。

## 证据

候选：F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.31.tgz

候选 SHA256：F1C5B2A3ADCD2BA9B67CC3D432CDB8637B140ADDEDFD520D19CA0BB1B11965DB。

本轮目录：F:\dsh-wallpaper-plugins\.tmp\rc31-desktop-20261015-153043-258f8402。

备份目录：C:\Users\HP\.dsh\backups\official-desktop-before-p4-rc31-20261015-153043-258f8402。

- baseline.json、backup-closed-confirmed.json、installed-rc31.json：本轮当时设置与安装核验。
- idle-observation/、mouse-observation/：原始观察样本和日志快照。
- idle-selected-audit.json、mouse-selected-audit.json、selected-window-audit.json：字段、覆盖、同 run 和时间边界。
- combined-observation.json、segments.json、analysis/、interpreted-results.json：完整分析和正确的本轮解释。
- backend-evidence.json：实际后端诊断。
- manual-context.json、reopened-daily-confirmed.json：人工条件、原始体感与恢复后确认。
- stopped-run-evidence/：停止后的原始 Native/Host/帧日志。
- cleanup-before-restore.json、window-find-after-stop.json、final-window-find.json、capture-count-final.json：停止/恢复后的退出与源窗口核验。
- restored-before-reopen.json、rc28-installed-restored.json、final-protection.json：恢复与保护凭据。

解释脚本从上轮复用时曾带入旧的人工反馈/时段标签，已在本轮证据目录修正；初次衍生解释另存为 interpreted-results-initial-stale-labels.invalid.json，明确无效，不作为结论依据。原始样本与 analyzer 结果未修改，当前 interpreted-results.json 使用本轮人工反馈、实际 57.726 秒间隔与 P4 已实施状态。
