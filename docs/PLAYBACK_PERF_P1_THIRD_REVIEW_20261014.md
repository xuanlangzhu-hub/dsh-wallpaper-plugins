# P1 性能工具三次复审：保留已修四项，补客户端新鲜度与统计边界

2026-10-14，Codex。**暂不进入真实前台/鼠标对照。** 三脚本语法、八类合成检查、首轮12例和二次8例独立复跑均通过；7项保护文件、日常rc.28的28个安装文件一致。上次F1–F4的具体反例已修复，普通2秒采样实际2013.2ms、17个样本。仍有首轮R2与二次F3第三条要求的新鲜度/重复统计未落实，以及负数相对时钟未拒绝。

本轮只复审、保存全新离线假文件与CLI证据、更新交接文档。没有改Gemini实现、读取正在播放的DSH日志、操作窗口/安装/配置、提交/推送或清旧目录。日常rc.28保留。后续只局部补分析器、相关QA回归与说明，观察器已有正确循环无需返工。

## 已通过，保留

- 普通多次采样、大interval的短预算、五种导出入口坏参数均正确处理；坏参数在创建输出前拒绝。
- STOP在开始多次采样后仍正常结束：本轮4个样本、495.4ms、sentinel、partial=true。结束的是Node观察器，不操作壁纸。
- 未知人工前台、未知client.hidden、完全未知run身份阻断前台比较。
- Native/Client的null时钟保持未知，非有限数字拒绝、退出3、没有分析报告。
- 四帧两相邻对正确报告0.15秒有效覆盖/2秒=7.5%，覆盖不足的帧间隔差值为null。
- Native/Host、client.hidden与源窗口foreground区分、encode层级、累计延迟说明及输出独占保护保留。
- 新鲜client时钟正常推进且帧计数不增长，正确保留有效0fps；不能为拒绝陈旧数据而一并拒绝合法零增量。

## G1：客户端只轻微推进，却被判为整段新鲜

位置：dsh-whale-mist/qa/perf/analyze-playback.mjs:546–565。

当前还是仅凭首尾client.seconds差为正就valid=true，没有把客户端真实推进时长与观察区间/报告覆盖联系起来。Host文件mtime或updatedAt推进只证明Host报告/帧到达新鲜，不能替代client上报新鲜度。

实际CLI反例scant-client-progress-1s-sampling：

- 按正常1秒间隔构造42个样本；两个选定区间各20秒，Native/Host正常每秒推进，人工前台、尺寸、身份和固定条件全部已知一致。
- 每段client.seconds长时间重复，仅最后从10.00到10.01、11.00到11.01；各只增加1帧。
- client只覆盖10ms，本版却输出 **100fps / 100fps、dataReady=true、comparable=true**，声称受控前台阶段对照。
- 这是首轮R2第2/3条、二次F3第3条已写明的缺口，不是新加生产埋点或新的性能范围。另保留较稀疏取样的同类反例，结论相同。

局部修正：

1. 给client指标记录独立有效报告数、client实际推进时长、观察跨度和重复/未推进覆盖；区分可观察的子区间速率与整个人工阶段的有效性。
2. 用明确、文档化的小范围容差处理500ms客户端上报、1秒Host写报告与读取边界，不能严格要求所有时钟相等；20秒对10ms这种不足必须阻断完整阶段比较并列原因。
3. 不把Host mtime、Host updatedAt或Native.foreground当client前台新鲜度。无需改生产协议；现有证据确实不足的部分标unknown。
4. 保留Native/Host有效行，合法不足仍退出0；可保留有标签的局部速率，但整体前台dataReady=false、相关差值null。
5. 加正常完整推进、合法0fps、周期性重复但足够覆盖、持续陈旧/只略动的数值对照，避免一刀切拒绝所有重复读取。

## G2：去重后不足两个样本，又回退到重复样本

位置：analyze-playback.mjs:600–614。

timingSource中的回退分支在nonDuplicateStatus.length<2时重新使用validStatusSamples，刚剔除的重复数据又进入耗时分布。

实际CLI反例duplicate-only-one-unique-status：

- 每段3次读取只有1份原生状态；另外2次内容、时钟、mtime完全一致并标duplicate=true，无逐帧记录。
- 本版报告 **observedSamples=3、encodeMs.count=3，同时duplicateSamplesIgnored=2**。
- 忽略了2个样本却又统计3个，样本数和分布声明自相矛盾。该例原生速率本就不足，dataReady=false不能掩盖耗时统计错误。

局部修正：

- 不论去重后剩0、1或多条，都不能把已认定重复的样本加回来。
- 只有1份时可保留单样本值/明确不足，不冒充完整阶段P50/P95；observedSamples、各指标count和ignored必须互相一致。
- 保留已有正常多样本、缺帧日志退回状态采样路径，补本例精确断言。

## G3：有限但为负的相对时钟仍获接受

位置：analyze-playback.mjs:187–229及Native/Client算术入口。

递归有限数检查拒绝Infinity/NaN，但没有校验Native.seconds/client.seconds的非负语义。单调递增的负值仍能直接算出速率并被标可比。

两个实际CLI反例：

| 反例 | 改动 | 当前结果 |
| --- | --- | --- |
| negative-client-relative-clock | client.seconds为-20,-19,…,-15，计数和其它字段正常 | 退出0，client为10fps，dataReady=true |
| negative-native-relative-clock | Native.seconds为-20,-19,…,-15，其它字段正常 | 退出0，Native为10fps，dataReady=true |

局部修正：

- 写报告前定向校验分析所用的相对时钟及计数合法范围；负的Native/Host/Client相对seconds不是合法缺失，应BadInput退出3、不创建分析报告。
- null/缺失仍是合法未知，0秒起点及合法0增量仍可用；不退回将缺值算0。
- 不递归拒绝所有负数：源窗口屏幕外坐标、阶段差值可以合法为负。保持原来的非有限校验和其它通过分支。

## 独立证据

全新目录：

F:\dsh-wallpaper-plugins\.tmp\playback-perf-p1-third-review-20261014-4084b3a2

- source-reviewed/、reviewed-source-hashes.json：本次工具/README/交付输入副本。
- syntax-check.json、reported-check.log：三语法/八类检查。
- counterexamples.mjs与counterexamples/：首轮12例；remaining-counterexamples.mjs与remaining-counterexamples/：二次8例，全按原预期通过。
- freshness-and-domain-cases.mjs、freshness-and-domain-results.json、freshness-and-domain-cases/：三个遗漏类别（负时钟有两例）和正常0fps、导出参数、多样本STOP控制例。结果明确分开matchesExpected；脚本退出0不代表所有反例通过。
- scant-client-progress-1s-sampling.mjs与同名目录：与正常1秒取样节奏一致的42样本反例、输入、CLI输出、JSON/Markdown。
- protected-files.json、installed-rc28-verification.json：保护项与日常28文件一致。
- freshness-and-domain-initial-launch.log仅为独立脚本首次Windows ESM路径导入错误；修正为本地file URL后才产生上述测试数据，未改被审实现。

本轮输入SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| watch-playback.mjs | 93ED2A9F2A2A979C3AC063B00EC9B6C82959B14D28D83748440CC166836097B9 |
| analyze-playback.mjs | E14B9223015C03296126A5A8D930C3B3DF4093FD9AA59DB057D125BF9D767F3C |
| check-playback.mjs | 2116EDBF6D2F20225C10C3E55BE72BEE89CBF1C34B87E7814AD4D6A7154C661F |

复跑需复制counterexamples.mjs、remaining-counterexamples.mjs、freshness-and-domain-cases.mjs和scant-client-progress-1s-sampling.mjs到全新目录；先运行counterexamples生成baseline，再依次运行其余。不能直接在旧证据目录重跑覆盖文件。

## 下一步

Gemini只补G1–G3：分析器、相关QA数值回归、README/交付记录。保留已通过观察器、原八类检查和20例；旧CPU/GPU工具、生产src/原生/assets、rc.28归档/日常仍不动。不实采/开窗/安装，不清历史，不提交/推送。

补后Codex复审，通过后才协调约一分钟前台静止/鼠标对照。当前测量工具通过的部分不代表复杂场景低帧率已经改善。
