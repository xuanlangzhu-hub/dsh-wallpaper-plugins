# P1 性能工具复审：先补统计门禁，再做实测

2026-10-14，Codex。**暂不进入前台实测。** 三个脚本语法检查和原六类合成检查复跑通过，7项保护指纹一致，日常rc.28的28个安装文件与归档一致。但独立实际CLI反例确认：部分不可信数据会被标成 `dataReady=true`，还有缺数据崩溃和观察时限问题。先按下列R1–R4局部补QA工具与回归，再交Codex复审。

本轮只审查和使用全新目录的离线假文件，没有修改Gemini实现、运行真实壁纸采样、重启/安装或改日常配置。原6类检查通过不等于统计边界完整；也不是壁纸性能已改善。

## 已通过、应保留的部分

- 只读工具没有进程/窗口控制或硬件计数器查询，符合P1范围。
- 正常fixture的区间增量计算、hidden=1时前端数值置null、严格相邻帧过滤、encode层级说明与累计延迟标注、已有输出拒绝和STOP退出均有通过路径。
- 无需重做这套结构或重写五阶段/GPU平台。修补集中在输入校验、逐样本可靠性、可比性与观察预算。

## R1：总体可比性没有落实已声明的条件

位置：`qa/perf/analyze-playback.mjs:243–245,360,382–396,578`。

当前段内尺寸只取最后一个有效status；比较只检查顶层 `session.stable !== false` 和两个末尾尺寸。client失效的原因不影响段 `valid` 或全局 `dataReady`，人工前台/其它固定条件也未参与门禁。

实际CLI结果：

- `hidden-background-readiness`：全部client.hidden=1，前端数值正确置null，但仍 `dataReady=true/comparable=true/reasons=[]`，报告还称受控前台对比。
- `changed-manual-conditions`：第二段人工标注DSH非前台，采集上限从30改成60，仍可比。
- `interior-size-change`：第一段中间尺寸变1920×1080，随后回1280×720，只看末尾而放行。

修正要求：

1. 在整个区间内验证同轮身份/尺寸和声明的固定条件；未知身份、变化或与声明矛盾不能当作已知稳定。
2. 将前台比较所需数据的可用性落实到全局状态。保留有效的原生/Host行，但前台条件不成立或客户端信息不足时，整体前台对照inconclusive并列原因，不以一个泛化true掩盖缺口。
3. 允许**预定独立变量**（静止/鼠标动作）不同，不能将它也纳入固定条件相等判断。其它可比条件的规范和unknown口径写入schema/README。
4. 保留 `client.hidden=0` 仅表示页面可见、人工DSH前台记录是manual、Native.foreground属于源窗口的区分。

## R2：空值被算成0，段内重置和陈旧覆盖会漏检

位置：`analyze-playback.mjs:211–241,250–320,347–351`。

当前计算仅看有效样本首尾。JavaScript的 `null - null` 变成0；client只要末尾seconds比开头大，就被视为fresh。重复状态也会重复进入耗时分布。

实际CLI结果：

- `missing-client-counts`：rendered/received都为null，输出 `valid=true/renderRateFps=0/receivedRateFps=0`，不是unknown。
- `interior-client-reset`：中间client从110/11秒退到1/1秒，末尾恢复120/12秒，仍算10fps并可比。
- `interior-native-reset`：原生中间计数/seconds回退，同样漏检并标就绪。

修正要求：

1. 算术前检查所需字段为合法有限数值；null/缺失保持未知。计数重置、倒退要遍历段内变化，不能只对末尾减开头。
2. 将重复报告、合法零增量与陈旧数据分开。利用记录的时钟/mtime/实际推进量判断覆盖，不能仅凭首尾seconds差为正就宣称整个区间fresh。
3. 去除重复状态对样本数/分布的虚增；报告有效样本数、实际时段和覆盖。存在缺口时保留可用数值及限制，不假装完整阶段分布。

## R3：输入校验及缺数据分支不完整

位置：`analyze-playback.mjs:132–179,338–358,398–402,556–578`。

实际CLI结果：

- `missing-preview-reports`：Native数据仍有效、Host/client报告暂缺，触发 `Cannot read properties of null (reading 'receivedRateFps')`，退出1。属于合法不足，应写inconclusive报告并保留Native行。
- `negative-observer-time`：样本elapsedMs=-1被过滤掉，CLI退出0并写就绪报告，未拒绝坏输入。
- `nonfinite-segment-bound`：合法JSON数字 `1e309` 被解析为Infinity，阶段终点仍获接受，报告就绪。
- `conflicting-frame-records`：同序号101有两个不同时间戳，排序后择一个算间隔而不拒绝，报告就绪。
- 正常输入声明state=synthetic，分析JSON/Markdown没有保留这个来源分类。合成结果应一直有醒目标识，不留给后续读者猜。

修正要求：

1. CLI在写输出前做schema与数字/时间范围校验，包括样本/阶段边界、索引、计数类型与冲突帧。合法缺失字段仍可null，不把unknown当坏输入；不合法的负/非有限相对时间等拒绝，退出3且无分析报告。
2. 相同帧的完全一致重复可以明确去重；同序号冲突拒绝。不要用排序/丢记录掩盖冲突。
3. 所有可选指标分支用明确可用性检查，避免 `undefined !== null` 放行后直接解引用null。坏输入、合法不足、观察被取消分别有结果。
4. 传递real/synthetic来源到分析JSON和Markdown；不要由synthetic输入生成无来源说明的就绪结论。

## R4：观察等待未受总时限约束，快照/覆盖证据需补齐

位置：`qa/perf/watch-playback.mjs:167–183,309–326,332–359`，以及分析器的帧覆盖报告。

实际CLI：假运行目录，`--seconds 0.1 --interval-ms 2000 --state synthetic`，请求100ms却记录 **2181.2ms** 后才completed。每次等待只检查STOP，不检查剩余总时限；大interval可让最长120秒承诺失效。

此外初始帧只保留计数元信息，实际records/raw只保存终末帧；报告没有给出完整的相邻覆盖时间、阶段占比或不足标记。长时间运行时，终末dense-tail可能已不含早期idle段，不能据少量Status样本宣称完整阶段P95。

修正要求：

1. 验证并统一CLI/导出入口参数；等待截断到剩余预算，或拒绝不合理采样参数。保留STOP/中断快速响应，不通过延长时限解决。
2. 保存真正有界的初始/终末快照（文件或等价记录），明确读时刻和失败原因；读取大小、样本和记录数有边界，不原样加载任意大文件。
3. 报告帧对数、覆盖时间/范围、数据来源和不足；原生计数速率可与帧间隔样本覆盖独立评估，不把无数据写为0长停顿证明。

## 复现与后续交付

证据根：`F:/dsh-wallpaper-plugins/.tmp/playback-perf-p1-review-20261014-02174ee8`。

- `source-reviewed/`、`reviewed-source-hashes.json`：本次实际审查的五份输入快照及指纹。
- `reported-check.log`：原六类检查全通过。
- `counterexamples.mjs`、`counterexample-results.json`、`counterexamples.log`：实际CLI反例；共12个场景，包括正常基线、10个分析边界反例和1个观察时限反例。
- `counterexamples/<case>/`：每例输入、原始CLI输出和实际生成的分析；9个分析反例错误就绪，缺preview报告例退出1。
- `protected-files.json`、`installed-rc28-verification.json`：7保护输入与日常28文件核验。

不要在原证据目录重跑/覆盖。可以从每例输入构造新的端到端回归，或把独立复现脚本复制到新的`.tmp`目录；脚本记录实际结果，不等于断言每个结果符合合同。若新时限参数选择拒绝，回归按相应退出/无输出行为断言，不继续假设必有observation.json。

Gemini只局部修改三个QA工具、必要纯函数/README与交付文档。原6类检查保留并补实际缺口，新增反例必须走真实读文件/CLI接缝；不要通过删除旧断言、弱化dataReady含义或只改报告文字让它们看似通过。

生产src/原生/assets、rc.28版本与日常/归档保护保持。仍不新开真实窗口、安装、实采日常、重跑GPU矩阵/长测、提交/推送或清历史目录。补修交付记录注明R1–R4结果、未知项与新证据，再由Codex复审。通过后才协调约一分钟前台静止/鼠标短对照。
