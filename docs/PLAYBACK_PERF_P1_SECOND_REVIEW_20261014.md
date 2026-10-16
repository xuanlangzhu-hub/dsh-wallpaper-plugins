# P1 性能工具二次复审：采样循环回归与剩余统计缺口

2026-10-14，Codex。**本版仍不进入前台实测。** 三脚本语法、七类合成检查、上一轮独立12例全部复跑通过，7项保护文件和日常rc.28的28个安装文件一致。但普通多次采样出现回归，首轮R1–R4中的未知门禁、完整数值校验和真实覆盖仍未闭合。

本次仅复审、创建全新假文件/CLI证据和交接文档，未改Gemini实现、采样真实DSH、操作窗口、安装、修改Profile、提交或推送。日常rc.28保留。先保留已有正确路径，按F1–F4局部补修，不重写工具或重跑GPU/原生/Host全套。

## 已确认修复，应保留

- hidden=1、中途Native/Client回退、段内尺寸跳变和声明条件改变现在阻断比较。
- rendered/received均为null时保持未知；缺Preview报告正常写inconclusive报告，保留Native行。
- 负观察时间、非有限阶段边界、同序号时间戳冲突拒绝，退出3且不写分析。
- synthetic来源保留到JSON与Markdown；初始帧原始快照已保存。
- 原100ms预算/2000ms间隔反例本次121.5ms完成，已不再超时等待约2秒。这个单样本用例不能证明普通采样循环正确。

## F1：第一次等待后提前退出，无法进行正常观察

位置：dsh-whale-mist/qa/perf/watch-playback.mjs:188,312–339。

stopReason初始就是completed，新增等待后判断又把completed当已结束信号。因此第一次sleep后外层循环立即break，即使期限还没到。源码差异确认这是本次预算修补引入的回归。

实际Node CLI、完全假运行目录：--seconds 2 --interval-ms 100 --state synthetic。

请求2000ms，实际报告 **129.4ms、sampleCount=1、stopReason=completed**。一个样本无法构造后续前台静止/鼠标的两个有效区间，现在实测只会浪费用户操作。

修正与回归：

1. 用明确“是否真正到期限/停止”的条件退出；默认最终结果不能兼作运行中结束标志。保留剩余预算截断，不改大timeout。
2. 加普通多样本CLI用例，持续时间跨数个interval，断言样本数、单调时刻和实际持续时间接近请求值，不能只检查未超过上限。
3. 原100ms大interval、STOP、中断仍需通过。STOP在确认多次取样后触发，避免只验证启动附近停止。
4. 首轮R4既定的统一CLI/导出参数和有界读取要求仍适用。静态检查表明导出watchPlayback未校验seconds/interval/state，初末frames用无上限readFile；补明确、文档化的大小/记录/样本边界，不原样加载任意大文件。无需另建日志平台。

## F2：未知前台或未知身份仍被默认放行

位置：analyze-playback.mjs:417–426,547–550,572–580。

当前只排除hidden严格等于1、人工前台严格等于false、顶层session.stable严格等于false。缺失/null不等于这些值，因而默认被当作已知可见、前台且同轮稳定。人工前台记录和页面可见仍是不同证据。

三种独立CLI反例均退出0，输出 **dataReady=true、comparable=true**：

| 反例 | 唯一改变 | 应有结果 |
| --- | --- | --- |
| unknown-manual-foreground | 两段不提供userManualDshForeground | 合法不足，不能声称受控DSH前台对照 |
| unknown-client-visibility | 各client.hidden=null | 可见性未知，前台客户端指标无效 |
| unknown-run-identity | 顶层和样本childPid/location均null，stable仍true | 身份未知，不是已验证同一轮 |

修正：

- 前台比较要求明确人工DSH前台记录和客户端可见证据，unknown列原因，不默认允许。
- 用本段/两段实际身份样本核验非空runDir、已知childPid/location和一致性，不只相信顶层stable。未知或中途变化阻断同轮差值。
- Native.foreground仍是WE源窗口属性，不作为DSH前台门禁。
- 这些合法不足退出0、保留可用Native/Host行、dataReady=false，不把null当坏JSON拒绝。

## F3：时钟空值仍参与减法，非有限计数仍可就绪

位置：analyze-playback.mjs:304–339,405–407,427–463及输入校验器。

计数null检查补上了，但分母seconds仍直接相减，number类型也未保证有限。以下反例同正常基线相比，不改帧数或观察间隔：

| 反例 | 改动 | 本版实际结果 |
| --- | --- | --- |
| missing-client-clock | 每段首个client.seconds=null | 客户端速率从10变为1.67/1.33fps，仍可比 |
| missing-native-clock | 每段首个Native.seconds=null | 原生速率从10变为1.67/1.33fps，仍可比 |
| nonfinite-client-count | rendered用合法JSON数字1e309 | 退出0，序列化速率null，但client.valid/dataReady仍true |

修正：

1. 所有用于计数差/时间差的字段在算术前检查有限数值与合法范围，包括Native/Host/Client所用时钟。null/缺失保持unknown，不让JS转换为0。
2. 合法缺时钟写inconclusive报告；1e309等非法数字拒绝、退出3、不建分析报告，不能靠JSON.stringify把NaN/Infinity变成null来“修正”。
3. 保留合法0增量、段内重置用例。首轮既定的fresh覆盖/重复去重仍需落实：不只凭首尾秒差为正宣称全段fresh，不在去重样本不足时退回重复样本虚增分布。

## F4：相邻对之间的未观察空档被算成覆盖

位置：analyze-playback.mjs:131–148,518–519,674–679。

coverageSpanSeconds取“最早相邻对起点到最晚相邻对终点”。这只是首尾范围，包含序号跳跃和未观察空档，不能当有效覆盖。

sparse-disjoint-frame-coverage实际CLI，2秒段内仅四帧：

- 100@10.00s、101@10.05s：一个50ms相邻对。
- 119@11.90s、120@12.00s：一个100ms相邻对。
- 合计只覆盖 **150ms / 2000ms = 7.5%**，中间跳号不能算长停顿，也不能算已观察时间。
- 本版却输出coverageSpanSeconds=2、coverageRatio=1、coverageAdequate=true，Markdown称覆盖100%。

修正：

- 分开首尾范围span与有效相邻区间覆盖；覆盖率取去重后有效区间长度/本段时长，必要时取并集，不能跨缺口。
- 保留严格相邻序号和有效样本统计；稀疏分布标为样本P50/P95，覆盖不足的指标差值为null或明确不足，不能宣称完整阶段分布。
- 原生计数速率与帧间隔覆盖独立评估，不因缺帧日志一律丢弃有效计数速率。
- 加四帧断言：覆盖约7.5%、adequate=false、长停顿数0但不代表全段流畅。

## 证据与下一轮交付

本轮全新证据目录：

F:\dsh-wallpaper-plugins\.tmp\playback-perf-p1-second-review-20261014-b5915d17

- source-reviewed/、reviewed-source-hashes.json：审查输入副本/指纹。
- syntax-check.json、reported-check.log：语法与七类检查实际结果。
- counterexamples.mjs、counterexample-results.json、counterexamples/：原12例独立复跑。
- remaining-counterexamples.mjs、remaining-counterexample-results.json、remaining-counterexamples/：本次8例实际CLI输入、stdout/stderr及输出。结果文件记录实际行为与是否符合合同，脚本退出0不等于8例通过。
- protected-files.json、installed-rc28-verification.json：7保护项和28安装文件一致。

三个实现输入SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| watch-playback.mjs | 16C0AEA519E48BAD2F96906F16F843087240783437B624C97CB30D1716E3766D |
| analyze-playback.mjs | 7A63285C0D80244B770AD1AE0D6B934F553AFC917D4F1369871054C76883595D |
| check-playback.mjs | 97E23B48E17C433B646DDB625FC5301F43A7C77A78472C51443F173F477C5E3E |

复跑接缝：把counterexamples.mjs与remaining-counterexamples.mjs复制到全新目录，先运行前者生成baseline，再运行后者；二者只创建假文件并调用QA CLI。不直接在本轮目录重跑覆盖证据。

小G只按F1–F4局部补三个QA工具、必要纯函数、数值回归、README和交付记录，保留已修路径；不改生产/原生/assets/rc.28归档或日常，不实采/开窗/安装，不清旧证据，不提交/推送。至少补正常多样本采样和本轮8例，保留原七类/12例。

补后交Codex复审；通过后再协调用户约一分钟前台静止/鼠标对照，然后决定最小性能优化。当前不是播放器性能修复交付。
