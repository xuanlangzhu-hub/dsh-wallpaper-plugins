# rc.50 作者参数：对 Gemini 定因与修复建议的复核

2026-10-26。用户提供了 Gemini 的分析和 `mermaid-diagram.svg`，要求判断是否正确。已按待审查材料处理，未把其中的修复建议当作实施指令。

**结论：测试缺口和错误归一化批评有价值；A、B 能对应真实失败条件，但“已找到本次根本原因”证据不足，A 的具体启动因果链还漏了实际前置条件。修复建议不能直接照一行修改实施。** 当前依然只有现场通用文案，没有该次 schema／snapshot 的原始响应或连接失败阶段。

## 接受的内容

- 之前 `await library.refresh()` 与 `canApply:()=>true` 的正例只证明“目录与目标已就绪时可以读”，不验证真实冷启动／目标验证路径。不能拿这些正例排除时序问题。原诊断中的目标未验证／ownership busy 负例也仍使用替身，真实整合需要补验。
- `snapshot===null` 时真实 library 会抛 `author_library_unavailable`；`targetActive:false` 的干净读取会触发 target-unavailable；不同错误的确会映射为同一句中文。上述路径均存在，本轮已用真实 ApplyAdapter／实际 library 独立复核。
- 若产品未来要在目标未就绪时先显示只读结构，应明确分离“结构可读”与“可编辑下发”状态。这是可以讨论的设计方向，不等于现有一行删除即可实现。

## A 的三个遗漏

1. 实际 rc.50 不会仅因选中 Lucy 就发首次读取。原生视图还要求可见、合法 authorContext，effect 的 autoEligible 来自 `view.state==='playing'`。authorContext 还检查相同选中／活动目标、目录 ready、有效 generation、无 gate busy／draining／unknown 和无 pending cleanup。因此“点击后 starting 立即无等待读”不符合该调用条件。
2. 正常 start 路由在 settle 的 finally 释放 ownership 后才发送成功响应，客户端先 await start 命令成功再进入帧流播放路径。异步身份查询发生在创建捕获之前。这个普通顺序必须纳入推理；它不证明所有异常／并发路径都没有竞态，但也不能略过后直接把普通启动期认定为现场触发点。
3. 原 index 将同一个 ownership 同时映射为 readTarget 的空目标和 readWallpaperLifecycle.busy。Host 的 author context 首先拒绝 busy，返回 author_cleanup_pending，早于 canApply／构造 schema 成功响应。**ownership 正持锁时“返回200但targetActive=false”的链条不能直接成立。** 目标未验证且生命周期不 busy 时，才可能走200／targetActive=false的另一条路径，不能混为一个条件。

对应实际包接缝：`package/src/index.js` 的 readTarget／readWallpaperLifecycle，`package/src/wallpaper/author-properties-host.js` 的 context，`package/src/wallpaper/session.js` 的 settle／start 响应顺序，`package/src/client.js` 的 authorContext、AuthorSwitches 与 start。

## B 与本次现场不相符的部分

冷库失败是真实可复现的接口条件。Lucy 的固定播放路径也能不依赖普通目录条目，因此“未知目录下直接调用作者接口”应单独覆盖。

但本轮实际顺序是：打开侧栏，进入仅 Everyone 的 23 张图库，翻到第二页再回第一页，选 Lucy，展开播放选项后才开始播放。index 将同一个 library 传入播放目录路由和作者 Host；正常这条路径已产生目录 snapshot。不能跳过该证据，直接把 snapshot=null 当成本次原因。若认为存在目录实例分叉、被重建或取消后误报 ready，需要另给出证据，这份静态分析没有提供。

因此不否定冷态健壮性事项，但它与“这次已定因”是两件事。

## “永久卡死”与自动恢复建议

同一上下文失败后不再自动 ensureLoaded 是事实；这是避免未知错误重读／重放的既有设计。显式 load／重读在 blocked 且 canRead 时仍可用，目标就绪后可以读成功；上下文变更也会重置阶段。因此“不会自动恢复”准确，“彻底自毁、永久无法恢复”不准确。本次实机没有点重试，不能说用户已经验证手动恢复。

`/api/main/actions` 主要是控制动作及窗口状态流，并不是现成的“作者目标已就绪”事件合同。若要加一次就绪触发，应定义就绪信号、代次绑定、取消与去重，只对可确认的过渡状态考虑恢复；不能把所有403／409／网络错误均自动重试。

## 一行放宽的反例

在固定包的隔离测试变体里，只移除 Gemini 指出的 targetActive 检查，保留真实 ApplyAdapter，令目标尚未验证：

- schema 返回200、targetActive=false；
- load 成功，phase=ready，**canEdit=true**；
- 点击模拟参数开关后，实际 Host 收到 draft POST 并接受本机草稿；
- 后续 target 检查阻止 apply，真实原生命令为0。

因此仅移除检查不会得到“先只读展示、控件禁用”。当前 canEdit 不额外跟随 targetActive；新方案须加入完整的只读／就绪状态和有效代次判断。原 Host 最后的 apply 门禁应继续保持，不能为了读展示而放宽写入。

Host 自动 refresh 或已知 Lucy 单项读取也需要保持 approved roots、分级／类型、新鲜文件校验、取消和现有读取预算；不能直接读取固定路径后声称继承完整目录授权，也不能让一次小 schema 请求无界触发全目录扫描。本轮不实施这项策略改变。

## 新增独立检查

证据：`F:\dsh-wallpaper-plugins\.tmp\rc50-gemini-author-review-20261026-a`，读取上一诊断冻结的实际 rc.50 包。使用**真实 createAuthorApplyAdapter、真实作者 HTTP Host 和真实 library**；原生 readTarget 的窗口状态为明确替身，禁止 runChild。没有运行日常 DSH／WE，未修改共享实现。

| 场景 | 观察结果 |
| --- | --- |
| 真实 library 未 refresh＋真实 adapter | 409 author_library_unavailable；canApply未调用 |
| 同库 refresh 后＋真实 adapter | 200、targetActive=true，读出6控件 |
| 同 index 语义的 ownership busy | 409 author_cleanup_pending；canApply调用数0 |
| 目标 captureStarted=false，但 lifecycle不busy | 200、targetActive=false，原始控制器阻断读取 |
| 上项就绪后显式手动读 | ready；总共两次GET，无自动重读 |
| 仅删除一行的建议变体 | canEdit=true，产生draft；未发apply，真实原生命令0 |

六项检查通过预期；负例通过表示成功复现和断言，不是问题已经修复。相同首次读取错误文案有多个已复现原因，仍不能从这六项替代现场那次分段证据。子进程有20秒父监督，正常退出；六个Host／连接／控制器清理完成。325保护输入保持，原包／生产安装／Profile／资产未改。

`review-vtwo-report.json`、`validation-summary.json`、`review-vtwo-run.json` 和供审阅的单行删除测试变体均保留。SVG仅解析文字并记录哈希，没有执行其远程字体或脚本，也没有改用户原文件。

## 接续决定

采纳：补真实门禁覆盖、保留明确错误阶段、调查只读展示与可编辑状态的分离。

暂不采纳：把A／B写为本次已证实根因、直接删检查、所有失败自动重试、无条件refresh／固定路径兜底。先完成窄诊断在实际SDK中的复核，必要时准备新鲜授权的一次现场阶段码取证，再按已证实原因做最小补修。

“▶ 播放”仍按用户要求后排；不混入参数定位。不打包安装，不操作日常，不提交推送、清理或派发新任务。
