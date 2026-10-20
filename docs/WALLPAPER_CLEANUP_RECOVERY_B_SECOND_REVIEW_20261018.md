# 日常壁纸清理恢复 B 二审：原负例已修，R2仍需补齐

日期：2026-10-18。输入为[首轮补修交付](WALLPAPER_CLEANUP_RECOVERY_B_REPAIR_DELIVERY_20261018.md)、[首审R1–R4](WALLPAPER_CLEANUP_RECOVERY_B_REVIEW_20261018.md)及实际源码。**本轮暂不通过；只补下面W1–W3和对应QA，不转滚动A、不返工P1A。**

已确认的进展：原3项损坏查询、6项危险放行、合法恢复/拒绝对照全部符合首审预期；无日志不再等于未启动。rc.35现在确有独立可运行的对应整合，原12项基底与冻结安装输入一致，修复版相对基底仅session.js变化。这些已闭合部分保留。

## 冻结输入及检查

证据：`.tmp/wallpaper-cleanup-b-second-review-20261018-4989b33a`，含冻结源码/QA、交付报告、rc.35暂存副本、`inputs.json`及独立探针。先核对到小G已完成本轮、Send按钮禁用且无Working，再冻结复核；未与实现者同时改源码。

- 工作区session.js：`69384D568D25A5BAAFAC7D0165248E191834AD4F646C752EE227CE27185D5BA5`。
- 对应rc.35修复session.js：`504FE868E66774378B626CEC4F3B3DD87008D64704A0372C51042B7AE3C8AB73`。
- `npm run check`通过，见`check.log`。Host JS108/108通过，见`host-js-tests.log`；仅在隔离QA副本调整F:\out到本轮目录，外部系统查询被offline-guard阻断，不宣称原生CLI整套实测。
- 首审独立12项探针（3解析、6旧危险放行、1合法、2拒绝对照）按修复后预期复跑通过，见`old-probes-recheck.mjs/.log`及`review-probes.json`。
- rc.35事故数据离线回放通过，见`rc35-replay.log`；12项基底无差异、仅session.js整合，见`rc35-comparison.json`。仍是helper/采集IO替身，未关闭真实源窗。
- 额外8项探针在工作区及对应rc.35各跑一次，见`additional-probes.mjs`、`additional-probes.json`、`additional-rc35-probes.mjs`及`additional-rc35/additional-probes.json`。退出0表示**下述现有缺陷被复现**，补修后须反转危险用例预期。
- P1A十审161项输入仅session.js变化，59项生产资产/归档保持，见`preservation.json`；未重跑无关P1A浏览器矩阵。

## W1（P1，原R2未闭合）：expectedStartUtc在生产路径始终丢失

`session.js`新增`windowStartUtc = window.startUtc || window.StartUtc || null`，再传给核验器。但`window`来自`waitForWindow()`，该函数总是调用`managed-window.js`的`normalizeWindow()`；后者只返回hwnd/pid/title/visible/left/top，**不保留任何startUtc字段**。此外真实`SourceWindowHelper.cs`的`WindowState`本来就没有进程创建时间。故只在session里增加该变量并未接通身份来源。

独立探针给window-find替身明确的真实创建时间`2026-10-17T09:20:20.6092543+00:00`，动作文件的requestedIdentity和beforeIdentity同时改成另一个**过去**时间`2026-10-17T09:20:21.6092543+00:00`，二次stop仍关窗1次、closed=true。`normalizeWindow-drops-startUtc`直接记录归一化后的字段丢失。改成2099年会被拒绝，仅证明未来值检查有效，不能证明创建身份已绑定。同一旧文件内部两个时间一致也不是独立身份来源。

补修：从实际可用的可信接口取得并绑定本轮必要创建身份，贯通默认IO、归一化、session及恢复核验；不能从待验action文件自身生成期望值。接口无字段则保留未知，或补充隔离协议/实现并明确原生二进制尚未整合，不得假装rc.35已提供该字段。要覆盖缺基线、当前身份缺失/损坏、同PID/HWND但创建时间不同（含合法过去值）、一致正例和合理等值表示。不要只再添加更多未来日期黑名单或仅保留一个不可达的可选比较分支。

额外协议问题：仅用Date.parse会接受`October 17, 2026`，与交付声称的“合法ISO时间串”不符；将requestedIdentity/beforeIdentity同时置该字符串，当前也会关窗释锁。按真实接口制定格式/精度与规范化契约，避免把日期字符串可解析当身份有效。

## W2（P1，原R2未闭合）：终结标志仍接受格式损坏或缺失

当前对cleanupSafe/exited要求严格true，方向正确；但pending、timedOut、terminated只检查`=== true`，非布尔值或缺省会被当作安全。独立完整session分别注入：

| action变体 | 二次stop实际结果 | 要求 |
| --- | --- | --- |
| pending为字符串`"true"` | closed=true，关窗1次 | 未知/损坏，不关窗不释锁 |
| 删除pending | closed=true，关窗1次 | 按真实已启动终结分支的必需字段拒绝 |
| timedOut为字符串`"true"` | closed=true，关窗1次 | 未知/损坏，不关窗不释锁 |

补修：针对原生真实分支验证必要字段**存在、类型及组合一致性**，不能以“不等于布尔true”代替明确非pending/未超时证明。将pending/timedOut/terminated/started等字段缺失、null、数字、字符串与冲突组合纳入底层IO贯通负例，保留真实合法动作正例。哪些字段在从未启动分支可能为null应独立规定，不能为通过负例改成全分支同一schema。

## W3（P2，原R2明确要求的未启动分支）：合法未启动终结被一刀切拒绝

原生`TaskbarHideStrategy.SettlePending()`在尚未attempt且原stage为armed/observing时，设置`stopped-before-action`；此时`_actionResult`可以为null，`WriteLocked()`确实将其写为action:null。首审已明确要求分别证明“从未启动”与“已启动且终结”，不要给所有分支机械要求exited。

独立协议形状探针提供`stopped-before-action`、action:null、trigger/before/after为空；当前一律返回`taskbar-action missing action object`，没有任何合法恢复分支。它是基于真实源码协议形状的IO替身测试，不称真实原生终结实测。此分支若缺最终Summary，后续重试不会凭空生成exited:true，因此仍可能无法解除锁。

补修：先说明这种真实原生分支的独立、可信未启动终结证明与身份绑定，再实现有界恢复；不足则保持未知并明确兼容限制，不可直接允许任意armed/observing旧文件。分别覆盖“确实未启动且已终结”的合法恢复、“仅早期armed/observing/attempted=false日志”的拒绝、“缺字段/缺身份”的拒绝和“已启动后不得冒充未启动”。如现协议不足就补隔离协议，不伪造现有二进制字段。

## 回放QA与交付覆盖的校正

rc.35对应整合本身已成立。但`verify-b-review-probes.mjs`及`verify-rc35-probes.mjs`的PART3并发/PART4迟到测试，没有给session注入execCommand/queryProcesses，会调用默认真实PowerShell查询，和报告“全部经替身、未真实扫描”的表述不一致。独立副本开启offline-guard后，原rc.35探针在PART3第222行失败（实际保留未知）；保存于`rc35-original-probes-offline.log`。

只在新的QA副本补底层execCommand空集替身后，原12项、并发stop和旧child监听器测试均通过，见`rc35-io-injected-probes.log`。这是对测试环境边界的修正，未修改生产源码；请同步修正式QA，确保离线脚本不会意外扫描日常进程。测试输出/清理只允许本次独立目录，不覆盖旧证据。

另外PART4目前仅对同一个已关闭session的旧child发迟到字节并断言监听器为0，未启动新一轮、未断言新轮status不受影响，也没有timer计数断言。补齐原任务要求的跨轮路由状态/定时器覆盖，或把报告覆盖范围收窄后补测；不要继续宣称“新轮不污染、零定时器泄漏100%验证”。

## 下一步与边界

只处理W1–W3、必要的协议/QA及对应rc.35整合说明，已通过的旧负例、正常Summary路径、无日志未知保护、并发单次关窗保持。不扩大三体/性能/P1B或滚动A。交`docs/WALLPAPER_CLEANUP_RECOVERY_B_SECOND_REPAIR_DELIVERY_20261018.md`，分别列出真实默认解析、底层替身、原生源码/二进制和未实机范围，以及所有关键输入输出哈希。

日常DSH0.2.1-rc.2 / 外观rc.35 / Git Bash0.1.1保持；不操作、安装、退出、重开或采样DSH/WE，不改安装目录/Profile/生产assets/版本号，不提交推送或清理。若需要新原生能力，先在独立bin/obj离线验证并标明候选仍未整合，不能热换生产资产。第一次断流原因仍未知。用户已授权本自动巡检直接向小G转达本次离线补修。

转达记录：二审W1–W3及QA余项已发送至Antigravity原“DeepSeek Harness 插件项目交接”对话；复核新用户消息、输入框清空、Working/Cancel。等待第二轮补修交付，未转滚动A。
