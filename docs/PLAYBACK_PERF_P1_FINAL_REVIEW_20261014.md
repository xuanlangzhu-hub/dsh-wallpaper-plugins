# P1 性能测量工具最终复审：可进入短前台对照

2026-10-14，Codex。**本轮P1工具复审通过，可进入用户配合的短前台静止/鼠标对照。** 小G的G1–G3补修通过当前源码、实际Node CLI反例及正常控制例复核。无需继续返工本轮工具；日常rc.28与生产实现保留。

本轮仅离线复审、保存全新假文件/CLI证据和更新交接文档。未修改小G实现、采样正在运行的DSH、操作窗口、安装、修改Profile、提交/推送或清理历史。工具正确性通过不代表复杂壁纸低帧率已改善。

## 通过范围

- 三个脚本语法检查、九类合成检查全部通过。
- 独立复跑首轮12例、二次8例、三次7组，另复跑正常1秒取样节奏的42样本陈旧client反例；共28个独立用例/用例组按原预期通过。
- 额外三个正常边界控制通过：周期性重复client报告但首尾覆盖充足、源窗口合法负坐标、0秒相对时钟起点，均保持10fps计算和有效比较。
- 五种导出参数错误在输出创建前拒绝；普通多次采样和多次取样后的STOP退出通过。没有真实helper或窗口参与。
- 7项保护文件及日常rc.28的28个安装文件与原归档一致。

## G1–G3核验

| 项目 | 独立实际结果 |
| --- | --- |
| G1，20秒窗口内client仅10ms推进 | 全局dataReady=false、comparable=false、差值null；局部100fps可保留，但明确标为局部速率、valid=false/覆盖不足，不作为整个前台阶段FPS |
| G1，42个1秒取样样本 | 两个20秒段均阻断，Host文件时间戳新鲜没有替代client推进证据 |
| G1，client时钟跨段正常推进但计数未增长 | 合法0fps仍有效，不误判为陈旧 |
| G1，client报告周期性重复但覆盖完整 | 两段distinctReportCount=2，仍正确10fps、可比 |
| G2，一份独立status加两份重复读 | observedSamples=1、encodeMs.count=1、duplicateSamplesIgnored=2，不再回退重复统计 |
| G3，负Native/Client相对秒数 | CLI退出3，没有分析报告 |
| G3，缺时钟/非有限值旧反例 | 缺值保持unknown；1e309拒绝，原通过行为保留 |
| G3，合法负坐标和0秒起点 | 未被相对时钟校验一并拒绝 |

补修范围符合P1：观察器未改，分析器、对应检查及README/交付有局部改动；生产/原生/归档指纹未变。

## 证据与输入指纹

本轮全新目录：

F:\dsh-wallpaper-plugins\.tmp\playback-perf-p1-fourth-review-20261014-46617a62

- source-reviewed/、reviewed-source-hashes.json：审查输入副本与SHA-256。
- syntax-check.json、reported-check.log：三语法与九类检查。
- counterexample-results.json、remaining-counterexample-results.json、freshness-and-domain-results.json：前三轮独立复跑。
- scant-client-progress-1s-sampling/result.json：42样本覆盖反例。
- normal-boundary-control-results.json及normal-boundary-controls/：三个正常边界控制和实际CLI输入/输出。
- protected-files.json、installed-rc28-verification.json：7保护项和28安装文件一致。
- review-summary.json：最终机器可读状态。

| 文件 | SHA-256 |
| --- | --- |
| watch-playback.mjs | 93ED2A9F2A2A979C3AC063B00EC9B6C82959B14D28D83748440CC166836097B9 |
| analyze-playback.mjs | 3FA29DC6375FBBBF37F96D7F108B327A06452B852A3F6EAD7DCF8CCB4F191A94 |
| check-playback.mjs | 76EE632D8FE70CEA9FBE5A24C29F1AC18D735495EACD32568F075F04752FDCC9 |

历史R1–R4、F1–F4、G1–G3报告和各轮证据继续保留。新验证不在这些目录重跑覆盖文件。

## 实测边界

- 当前client推进充分的门槛是观察时长的50%，已写README。这是工具判定约定，不是客户端/Host时钟同步或物理呈现的证明。短实测还需人工审核progressRatio、实际区间、独立报告数与边界；优先取接近完整覆盖的稳定数据，不只看dataReady。
- client.rendered是前端canvas绘制计数；不是WE真实源FPS或DWM屏幕呈现帧率。Native.foreground仍只描述源窗口。
- 原生耗时、帧间隔分布保留样本来源与覆盖；稀疏帧不能声称全阶段P95或0长停顿即流畅。
- 既有累计mean/max不是阶段P95、最大延迟或鼠标到屏幕的物理响应时间。工具不新增生产埋点，也未锁定唯一瓶颈。

## 下一步：短前台静止/鼠标对照

1. 先协调用户方便、暂停其它助手并确认DSH无运行任务。保留日常rc.28，不安装新包；优先复用用户当前复杂场景，若已结束或换场景则由用户确认并手动选择/开始。
2. 保持同一播放run、同一会话、窗口大小/外观/采集上限不变，取约20–30秒前台静止和约20–30秒鼠标移动。用户操作界面，观察器只读明确指定run目录。
3. 保存人工动作与前台区间。切回Codex回复/准备下一段的时段不混入有效区间；client.hidden、实际推进覆盖和身份核验仍需满足。
4. 用全新目录离线分析，并核对Native阶段耗时、Host/Client区间速率和帧覆盖。若数据不足就保留inconclusive，不强凑性能结论。
5. 据可比结果再选最小优化。GPU矩阵、长测、硬件视频链路、60fps、主题设置和选择器不属于本轮；不自动操作窗口、改全局设置或提交/推送。
