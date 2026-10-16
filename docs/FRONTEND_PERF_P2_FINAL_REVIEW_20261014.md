# P2 前端观测补修复审通过

2026-10-14，Codex。核对 [Gemini补修交付](FRONTEND_PERF_P2_DELIVERY_20261014.md#6-p2-复审局部补修记录-r1r4)，并重新执行 [首轮R1–R4反例](FRONTEND_PERF_P2_REVIEW_20261014.md)。**R1–R4已闭合，P2观测实现通过本轮离线复审。**另发现停止后内部计时继续增长的小回归，Codex已补一行归零及真实stream回归检查，并验证先失败、修后通过。

本结论是源码与观测接缝通过；尚未安装新候选或取得本轮实机阶段耗时，**不代表复杂壁纸帧率已经提高**。日常仍是既有rc.28。

## R1–R4结果

| 项目 | 独立复核结果 |
| --- | --- |
| R1 旧解码成功/失败返回 | 新run的成功/失败计数保持0；旧bitmap清理，旧paint状态不影响新run |
| R2 订阅者抛错 | bitmap正确调用close，异常分类与正常投递保持 |
| R3 RAF句柄0与旧回调 | 句柄0取消，新run的安排/计时不被旧回调操作 |
| R4 分类总和不一致 | P2阶段判invalid并带reason；P2差值抑制，合法P1数据独立保留 |

提交的第9类回归已覆盖这些交错；独立复审脚本以`--expect-fixed`验证五个问题均不再出现。正常真实stream→canvas控制及reporter→Host→文件→观察器→分析器控制继续通过。

## Codex顺手修正：停止后计时仍增长

Gemini将统计放入`activeRun`后，`snapshot().seconds`读取`activeRun.startedAt`，但stop仍只清旧的局部`startedAt`。独立相同时钟控制：

| 源码 | 播放时 | 停止后 | 再推进两秒 |
| --- | ---: | ---: | ---: |
| rc.28归档基线 | 1s | 0s | 0s |
| Gemini本轮补修，修正前 | 1s | 1s | 3s |
| Codex修正后 | 1s | 0s | 0s |

`getStatus().seconds`原本已归零，问题在内部snapshot口径；没有据此声称用户看到了界面计时异常。

修正仅在`dsh-whale-mist/src/client.js`的stop中增加`activeRun.startedAt = 0`。新建第10类检查在实际stream处理一帧后停止，确认计时归零且帧计数保留；时间继续推进仍为0，再开始则独立计时并重置帧数。先运行该检查得到`1 !== 0`，加一行后整套通过。

本轮Codex修改的实现/QA仅为：

- `dsh-whale-mist/src/client.js`：上述一行停止计时修正。
- `dsh-whale-mist/qa/perf/check-frontend-stages.mjs`：第10类停止/再次开始时钟回归。

Gemini的原交付记录与源码快照保留，不追改历史。

## 验证与保护

- `npm run check`通过，含JS语法和CSS模板守卫。
- P2专项 **10类**通过；P1专项 **9类**通过，P1输入在上述一行修正前后未变；Host **105项**通过。
- 最终源码快照上的五个独立反例全部通过，实际canvas正例通过。
- 最终正常接缝控制：**6个synthetic样本、完整非零报文669字节、P2阶段有效、fake canvas draw均值5ms**；解码20ms/等待15ms等为受控时钟输入，不能当实机成本。
- 15个资产/版本文件与活动归档一致，5项非目标保护输入一致；本机安装 **28文件与rc.28包一致**。候选版本、原生、活动tgz和Profile/外观未改，原WE与官方EXE保留。

复审过程只有上述两份源/QA文件由Codex修改；Gemini交付中其余6份输入未变化，最终8份输入哈希已固定。没有操作DSH/WE、创建壁纸窗口、安装、提交或推送。

## 证据与接续

证据目录：`F:\dsh-wallpaper-plugins\.tmp\frontend-perf-p2-second-review-20261014-9bf0aa0e`。

- `source-reviewed/`：Gemini补修输入，`fixed-counterexamples.log`、`reported-p2.log`、`p1.log`与`roundtrip.log`为首次补修复核。
- `stop-clock-repro.mjs`、`stop-clock-before.json`、`stop-clock-regression-red.log`、`p2-final.log`：内部时钟的基线/失败/修后证据。
- `check-final.log`、`host-final.log`：最终检查；`final-fingerprints.json`、`installed-rc28-verification.json`：源码和日常保护核验。
- `final-validation/source-reviewed/`与`reviewed-source-hashes.json`：Codex一行修正后的最终输入。
- `final-validation/counterexamples.log`、`counterexample-results.json`、`roundtrip-verified.log`、`roundtrip-finalretry-result.json`、`roundtrip-finalretry-observation/`：最终反例与完整离线接缝。首次控制的Windows文件替换锁冲突日志保留；仅测试目录内的writer添加有界重试，最终控制通过，未据此修改生产文件写入。

Gemini本轮无需继续返工。下一步由Codex准备带观测字段的独立测量候选并核包，再确认用户方便做一次短前台静止/鼠标对照；拿实际等待/解码/同步处理/画布数据后选择最小优化。日常rc.28保持，活动包不能同版本覆盖；不自动安装、开窗或重跑GPU/长测。
