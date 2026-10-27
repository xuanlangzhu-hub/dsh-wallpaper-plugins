# 原生侧栏：专用关闭提交与保存结果

2026-10-23，接续[前端关闭协议](WALLPAPER_NATIVE_CLIENT_CLOSE_FENCE_20261023.md)。本轮已实现 controller 的专用同步 `commitBackgroundClose(permit)`，只改背景来源、不额外停止；**尚未接侧栏按钮或启用新交互，未构建候选**。日常 DSH0.2.1-rc.2／外观 rc.42／Git Bash0.1.1 保持。

## 证明、提交和保存

绑定 controller 的 prepare／inspect／retry 返回当前 ready 时，且来源仍是 wallpaper，才附带一个冻结的不透明 permit。对象身份属于该 controller；复制字段、JSON 往返、别的 controller、旧请求或已经消费的对象都不能提交。只读观察的 canCommit 仍为 false，不把一个布尔值当授权。

permit 同时绑定实际 engine 关闭快照、偏好对象、播放意图、来源修订、主题事件、调用方 signal 和最新协议调用。偏好／选择／主题 A→B→A、取消、卸载、较新协议动作都会撤销旧许可；旧异步完成不能在新调用后重新装回 permit。

engine 新增同步 consumeCloseFence，核对快照对象身份、当前封闭 owner、Host 证明、无 pending／写未知／活动／清理以及未消费，再直接标记消费。核验和标记之间没有通知、回调、异步或 IO。controller 的专用提交随后同步执行，**不走旧 set background、普通 stop、prepare 或 activate**。失败也消耗这次许可；再次保存必须由新的明确检查取得新许可。

提交先读取实际存储，严格解析并核对已保存偏好与当前 controller；发现已知字段变化或损坏内容便拒绝，不覆盖其它写入。序列化时在原保存对象上只补 background:none，保留其它已知设置和未知扩展字段。内存只改变同一个字段，预设、作者参数及其它存储键不动。

使用实际 setItem 和精确回读确认，绕开旧 persistSettings 的吞错行为。固定结果含 ok、stage、value、applied、persisted；value 来自当前内存，persisted 描述本轮观察。错误不携带原异常、存储原文或路径。

| 情况 | 内存／持久化处理 | 返回 |
| --- | --- | --- |
| 写前失败，回读仍为原值 | 保留 wallpaper | 失败，applied:false，persisted:unchanged |
| 已写入后抛错，回读精确为目标 | 发布实际 none，不假装没有写入 | 失败，applied:true，persisted:confirmed |
| 写后无法回读 | 不推测成功，不回写旧值 | 失败，内存保留，persisted:unknown |
| 保存确认后投影失败 | 保留已保存的 none，仍通知实际设置 | 失败，applied:true，persisted:confirmed |
| 回调中出现新设置 | 保留新的当前设置，不回滚覆盖 | stale／superseded，返回当前 value |
| 明确重查后的本次未知保存恢复 | 精确确认自己的原目标后采用实际 none | recovered；不重复写入或停止 |

未知保存只保留本 controller 当时尝试的目标和上下文。新的显式 inspect 与新 permit 之后，若存储恰好是这个目标、原偏好对象和上下文仍有效，可恢复确认，不重写。没有本轮证据的外部 none、其它数据或较新设置不能冒充恢复。网络写未知仍由前一层锁存，这个存储恢复不会清除它。

保存／投影发生异常仍同步发布真实当前设置；通知中若有新用户选择，返回 superseded，不将旧目标再投影或回滚。存储比对和同步提交针对当前 controller 与已观察的数据，未实现跨独立 renderer 的分布式 CAS。Host 证明仍属于本轮 Host 实例，不扩称跨进程重建的持久授权。

## 验证及输入保护

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-background-close-commit-20261023-8e18325f`。开工保护清单、原 client、副本／指纹、首次失败及最终输出保留。

新增 `qa/background-close-commit.test.mjs` **24 项通过**，父监督 0.748 秒。执行完整实际 ModuleLoader factory／apply，取得真实注册 controller，接实际 Host handler；DOM、存储和生命周期原生 IO 为底层替身，未替换提交、证明核验或保存方法。覆盖对象伪造／跨 controller／重复消费、单字段与扩展字段保留、零额外请求、pending／未确认拒绝、设置往返／取消／卸载、所有保存故障、投影失败、明确恢复和重入的新设置。

首轮 17 项有一项夹具断言失败：完整 apply 本来会请求 bootstrap，不能断言整个初始化没有请求。修为比较调用提交前后的请求数，确认伪造／未准备许可不新增 IO；产品未因此放宽。随后补齐更多负例；原失败记录保留，没有重复相同失败输入或增加时限。

既有 43 阶段 **791 项通过**，加本轮 24 项共 **815 项**；包含原 39 项协议专项、命令／Host 读取、作者／侧栏、生成同步、语法和 CSS 检查。engine 原消费／送帧、GET、停止／凭据、cadence 和 UI 生成块未改，本轮未重复 P2／节奏离线检查，不将历史成绩算作新增测试。

| 完整 client／实际官方 SDK | 流程 | 父监督时间 | 作者 IO 替身 | 普通播放请求 | 新实际 Host 请求 |
| --- | --- | --- | --- | --- | --- |
| existing-sdk | 原 111 项 | 24.244 秒 | 60 次 | 3 次原合成请求 | 0 |
| commit-sdk | 新 10 项 | 2.938 秒 | 0 | 0 | 1 GET、13 栅栏 POST，prepare 仅一次 |

共 **121 项 SDK 流程通过**。新组经过实际 React／ThemeRuntime／session／原生右栏／dockkit、完整 Whale apply、真实 controller、真实 localStorage 和实际 Host 栅栏。sessionFactory 若被调用即失败，文件存在性为替身，真实原生运行为 0。只在 QA 内临时替换 Storage／CSSStyleDeclaration 的底层方法制造故障，每次 finally 恢复；未替换产品提交实现。

新组验证实际背景来源保存、设置订阅同步、旧／克隆许可拒绝、写前失败与新检查重试、写后异常、回读未知的无重复写恢复、投影异常、偏好／选择／实际主题往返、真实订阅重入和整插件卸载。设置为 wallpaper 的步骤是隔离 QA 为各负例准备输入，不代表新 UI 已完成重新启用链路。整个新组 Host generation 保持为 1、普通播放请求及作者命令均为 0，故保存／恢复未借旧 setter 发额外 stop。

两组页面异常及未知 HTTP 错误为 0；保留精确既有 401 和作者负例 409，cleanLog:false。settings/status/library／preset 订阅、refs／pins、远端监听、DOM、stream、活动 URL 归零；原组 8 个 URL 创建／释放相等，新组均为 0。自有 headless Edge 正常退出，两个服务关闭确认，没有强杀。父监督仍为单阶段 20／25 秒、总 60 秒、SDK 45／51 秒，所有本轮任务已退出。

272 项旧输入中仅 client.js 变化，**271 项保持**；新增 QA 一项，最终保护清单 273 项。审计将新增的证明消费、activate 对已消费状态的拒绝，以及 controller permit／提交段逐一剥离后，与开工源码全文相等。Host、旧 QA、两个生成块、生成器、作者执行器、manifest／生产 assets 和官方冻结输入保持。

- client：`8315E085ED35B7F7C191FA3ABC6B4F9ABAD803F5F2CCBDD6AB4ED9510AF81FCE`
- 新 QA：`03BF41BDCF331584BBDDD635D9C09592656EB02FDAB03925A7804E5761232D78`
- Host session 保持：`9BEE5F07A6B311B917696BCDB45A90DB0167C126BFF23E68C9756CA44CD89038`
- Host 栅栏保持：`2977C6500FDF09508E43836008E9F9CC442AB1920E7767F91F60F79FC6A7B4C9`

历史 15 项缺原生测试 EXE 的未通过和合并超时保持；本轮未重复相同输入、构建 EXE 或用当前范围通过抵消它们。

## 下一步

接最小侧栏来源交互，使用当前 controller 返回的 permit 提交关闭；明确准备中、未确认、已保存及错误，错误时按 applied／value 显示实际来源，不能一律退回旧开关。准备后的一次检查须有界，不循环重试；未 ready 则保留来源与清理／重查入口。

**开放关闭按钮前，同时对齐重新启用**：关闭后不能继续让旧的同步 enable 直接 set wallpaper；必须由新的显式意图检查／activate，再确认来源保存，不自动播放，不在失败／超时中自动放行。旧通用 setter、import/reset 仍未迁移，不扩称所有入口已安全。下一步只整合这两个最小来源动作及反馈，不新增只读层或展开其它设置布局。

本轮未开放按钮、打包安装发布、操作日常 DSH／WE、改 Profile／版本／生产 assets、提交推送清理、联系其它助手或恢复定时。当前验证属于源码／底层 IO 替身／SDK 功能范围，不替代实机、视觉及长期验收。
