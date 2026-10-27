# 原生侧栏：关闭WE背景的顺序与证明核对

2026-10-23，接续[四字段手动预设](WALLPAPER_NATIVE_PRESETS_20261023.md)。本轮是现有路由调查与下一步设计，**没有新增关闭按钮，也没有修改产品源码**。

## 结论

不能把原 `controller.set('background','none')` 直接搬入新侧栏，也不能简单包装为“await stop，再set none”。旧setter在清理回包之前就保存none；而先停再set会多发一次stop。普通停止与关闭背景是两个动作：前者应保留wallpaper来源，后者才提交none。

新增入口先补同一engine/controller的只读关闭状态与命令台账，再接有条件的来源提交；先不扩展图片／视频导入、全局reset或独立窗迁移。完整组合关闭暂不实现，不假称现有公开状态已提供充分证明。

## 完整client／实际SDK现状核对

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-sidebar-close-plan-20261023-73de8ab4`。`close-route-sdk`使用完整client、实际官方React／ThemeRuntime／会话／右侧栏／dockkit、真实controller／引擎和回环HTTP。播放Host端响应、源状态与stream是下层IO夹具，**不是真实WE播放Host生命周期**；伴随Host为实际实现。空stream没有解码帧或物理画面。

9个现状断言完成，包含初始准入与最终字段保护；关键观测如下。它们刻意断言旧行为，不能作为新关闭功能的通过用例。

| 路径 | 观测 | 对新增入口的约束 |
| --- | --- | --- |
| idle直接set none，扣住stop回包 | 偏好和存储已经none，cleanupPending仍true；1次stop | 不可提前承诺关闭完成 |
| 已经none再次set none | 偏好没变仍发1次stop | 不能用重复set驱动清理或完成反馈 |
| await stop后set none | 2次stop | 来源提交不能再触发旧setter的stop分支 |
| 活动Lucy直接set none，清理失败 | 状态cleanup-failed、活动ID仍Lucy、closed:false，偏好仍none | 失败时保留wallpaper来源及明确停止／重试入口 |
| 普通Stop | 偏好保留wallpaper、closed:true、1次stop | 停止不能隐式关闭来源 |
| ok回包缺少cleanup证明 | 旧引擎state stopped、lastCleanup null，旧开始门禁可用 | stopped／cleanupPending false不等于严格关闭许可 |
| 旧start回包扣住时直接set none | 首次stop已closed:true，旧start仍悬挂 | 首个stop成功也不能独立证明全部请求已结清 |
| 放回旧start | 触发代次补偿stop，最终源为空，共2次stop | 此第二次stop是必要补偿，不能按重复命令删除 |

本组15次合成播放HTTP请求为4次start、11次stop，作者命令0，真实WE命令0。没有修改引擎、setter或用fake结果覆盖真实controller。

## Host协议的实际边界

另以产品 `registerWallpaperRoutes` 直接调用真实handler／ownership／取消代次，只有请求体、response和文件存在性为替身，sessionFactory一旦调用即失败。`host-contract-report.json`的3项通过，父监督0.127秒退出确认：

1. 全新Host没有会话时stop正常返回200、stopped:true、cleanup:null、pending:false。这是合法无会话结果，**不能把缺cleanup一概定为损坏或清理失败**，也不能填造closed:true。
2. start正在等待请求体时，stop也返回active:false、session:null、cleanup:null、pending:false；但内部ownership仍为start。此pending只表达特定已开始／准备阶段，不是所有请求的总门禁。
3. 放回旧请求体后，原有取消代次使start返回409，session创建0，最终ownership为空。原Host取消逻辑在该路径有效；没有证据证明它创建了漏关窗口。

这组未启动HTTP监听、浏览器、原生helper、采集或WE；最终两个effect注销、路由与ownership清空。不能把它扩称完整开始／清理或窗口验收。

对应源码：`client.js`的command／stop／set(background)与backdrop reconcile；`wallpaper/session.js`的statusPayload／closeSession／stopNow／start ownership。现有前端command不带AbortSignal或自己的截止时间；原生播放UI有12秒显示期限与draining任务集合，但只覆盖它自己发起的动作，旧页／controller直调不在同一集合中。不得声称UI超时已终止Host工作，不能仅凭busy或Promise已reject认定安全。

## 下一小步与验收条件

先补**只读关闭状态接口和统一命令台账**，暂不放关闭按钮，不改原Stop含义、不全局收紧旧兼容判据。接口读取不可发stop／start、不得写偏好；实际发生的开始／重启／停止及迟到补偿都由同一engine记录。必须表达等待、未知、当前同轮关闭已证和无会话已证的区别，不能把未知折成idle。

关闭许可至少绑定本次controller／宿主会话、来源、用户意图修订、代次与实际关闭响应；新动作、旧动作迟到、连接替换或不能确认的结果撤销许可。所有原生／旧页／controller路径共用台账，不能只追加一个UI锁。跨网络超时后的Host执行状态和当前公开协议缺少总ownership证明的问题，先设计并锁定测试，再决定是否加最小Host只读字段；不以本报告替代协议设计。

后续来源提交要在同一同步核验段重读当前上下文，只提交none且不再发停止命令。正常无竞态关闭只发一次明确stop；失败／超时／被新来源取代时不提交none、不反向重置新偏好、不自动重试。迟到start的必要补偿保持。四字段、主题／透明度、作者参数、分级、自动播放及已存预设都不得被关闭动作改写。

最小入口可先只允许**明确停止且同轮证明有效、无未结命令**时关闭；播放中仍先用既有停止动作，组合动作另拆。初始从未播放的来源不能永久锁死：需要真实Host的当前无会话／无ownership证明，不能单凭cleanup:null或历史closed结果放行。

离线矩阵必须包含：真实Host无会话、扣住请求体、准备中start、重复stop、清理失败、缺字段／损坏回包、旧成功证明、迟到成功／失败、超时后迟到Host动作、旧页与原生并发、服务重建／视图隐藏、替换来源、提交期间投影／存储失败，以及正常提交额外播放命令为0。台账或协议未闭合时不接按钮。测试浏览器有界正常退出也要恢复为独立门禁。

## 本轮测试运行的失败边界

`close-route-sdk-report.json`的9个case为true、pageErrors为0，但整组 **passed:false**。父监督8.485秒正常收到退出码1、无总超时；失败是收尾 `owned Edge close deadline`，4秒正常关闭期限内未结束。仅对本次自有browserServer执行其kill兜底，ownedBrowserExitConfirmed:true；未触及日常Edge／DSH／WE。不得把有兜底退出写为正常关闭通过。

页面settings／status／library／preset订阅、refs／pins、远端监听、commands、DOM与Blob URL归零，stream最终0；两个服务正常关闭。实际失败报告、输入脚本／fixture快照、stdout／stderr和父监督结果保留，没有延长期限或反复重跑求绿。

静态看到夹具先关context／browser／browserServer、后结束stream与关闭HTTP连接；这只是可能影响收尾的顺序线索，**没有实验确认因果，不在产品里改超时**。本轮调查可以引用已完成的具体观测，但后续功能验收不能沿用此次失败SDK作全绿依据。

HTTP仅原精确匹配的首次可选snapshot401及disconnect401，cleanLog:false，无额外400、未知HTTP错误或原始命令泄漏。历史stale-revision 400仍未定因。本轮未改产品，未机械重复前轮674项／245流程全量验证，也不把历史通过当成本轮关闭功能通过。

## 输入与现场保护

开工冻结266项输入；最终`change-audit.json`确认**266项全部未变**，包括client、侧栏、旧QA、Host／作者执行器、manifest／生产assets及官方冻结输入。本轮只新增证据／本报告并更新接续文档，前轮apply通知finally与减少透明度修补保持。

client仍为 `18B1F1BE7615A00302953BA16FD3045B74DD0644638D11594437F783040EE523`；侧栏仍为 `012AA0D369AB40BB2C1DD5C286E6D4BBBE589B88EDD6BE39253BFBE0142DD0B0`。

日常DSH0.2.1-rc.2／外观rc.42／Git Bash0.1.1未操作；开发manifest／生产assets仍rc.30。本轮未构建打包、安装发布、改Profile、实机采样、提交推送清理、联系其它助手或恢复定时。


## 后续接续：只读命令状态完成

见[统一播放命令记录与只读关闭状态](WALLPAPER_NATIVE_CLOSE_COMMAND_STATE_20261023.md)。实际command统一记录已进入开发client，提供engine快照／订阅与controller只读读取，未知保持锁存；本地closed观察始终不授予提交许可。694项测试、125项完整SDK及P2／节奏离线检查通过，旧QA／Host／侧栏／资产保持。先补Host生命周期／总ownership证明及旧请求边界，再接最小关闭按钮；本报告的旧路由风险、SDK收尾失败和协议缺口仍保留为历史证据，不以本轮通过消除其未定因部分。
