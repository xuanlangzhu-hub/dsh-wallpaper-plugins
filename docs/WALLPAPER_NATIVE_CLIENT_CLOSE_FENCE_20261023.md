# 原生侧栏：前端关闭协议与逐命令凭据

2026-10-23，接续[Host 启动栅栏](WALLPAPER_NATIVE_HOST_CLOSE_FENCE_20261023.md)。本轮完成前端协议底座及完整入口离线验证；**未写入 none、未接关闭按钮，canCommit 仍为 false**。日常 DSH0.2.1-rc.2／外观 rc.42／Git Bash0.1.1 未操作。

## 实际接入

engine 新增 prepareCloseFence／inspectCloseFence／retryCloseFence／activateCloseFence、稳定的 getCloseFenceSnapshot 和可释放订阅。controller 对应新增 prepareBackgroundClose／inspectBackgroundClose／retryBackgroundClose／activateBackgroundSource；readBackgroundCloseState 附带 fence 观察。

这些 API 均需显式调用；启动、打开侧栏、普通读状态、可选右栏服务重建不自动调用新协议。controller 方法绑定偏好对象、播放意图、来源修订和主题事件修订；准备关闭同时撤销旧自动播放意图。偏好、选择或主题 A→B→A 也会失效；不能只比较最终值。engine 的底层 API 供协议层和隔离 QA 使用，后续 UI／提交应使用 controller 绑定入口，不能绕过上下文。

prepare 首先显式读取实际 Host close-state，再用同轮 Host 身份和修订发送一次 prepare。旧命令未落定、已有本地清理或写未知时拒绝，不并发抢占另一准备。已有封闭票据时也不会重复 prepare；pending 只能等待新的显式 inspect，未确认清理只能显式 retry。没有自动重试、轮询、补偿 activate 或超时放行。

Host GET 成功后，本地送帧和流等待先停止；抽出原 stop 中的本地结束逻辑，原函数体逐字核对保持，普通 stop 仍按原次序使用。随后唯一的物理关闭请求是 close-fence/prepare；**不会再发普通 /stop**。准备并不提交背景来源，仍保留 wallpaper 偏好。Host ready 后本地状态可显示 stopped，但关闭来源／保存成功仍未获得许可。

prepare／retry／activate 经过原统一命令账本；inspect 是只读请求，不因一次读取失败制造写未知。每个写命令在发出时固定捕获凭据，start/restart 的迟到补偿 stop 也使用原请求的凭据，不能从新的全局状态借用新凭据。显式 activate 才接纳新凭据；它只恢复后续命令权限，不播放、不写偏好。封闭／未知时本地 start/restart 拒绝；新凭据随后随 start、restart、stop 发送。

公开状态只给固定短错误、Host 关闭观察和 attempt；不输出 fenceId、请求 UUID 或 admission。票据及凭据留在 engine 内。快照和底层 canonical Host 数据冻结，旧快照不变；新订阅可取消，卸载释放。没有拿旧 UI 的订阅计数冒充新 API 已被界面使用。

## 有界等待与未知

整个 prepare 的预读和后续 POST 共用最多 **4 秒**截止；较短调用值／hostStatusTimeoutMs 生效，较长值截断。signal 注册、超时、上下文失效和卸载都能落定等待；每次响应最多 8192 字节／8192 分块，严格 UTF-8、JSON、完整字段、类型、Host 身份、票据、请求、attempt、状态组合和修订／代次核验。底层忽略 abort 时，迟到响应仍取消消费，不覆盖当前观察。

写入一经尝试，超时、断开或损坏回包不能证明 Host 没有接到它：账本锁存 unknown，禁止重新启用和启动。即使后来用真实票据 inspect 得到健康 Host 回复，也不能洗掉写未知。明确的 409 只有符合实际有限协议错误集合才视作已拒绝；未知错误码仍保守处理。已明确拒绝的 prepare 不伪装成占有新栅栏，正常清理后可由新的显式准备再试。

回调重入同样检查：本地结束只允许本轮预期的一次 generation／epoch 增量，不能把 listener 发起的新 stop 吸收成自己的基线；发布 ready 后若 listener 改变意图，外层也返回 stale。卸载后的公开状态保持 disposed，写未知另在命令观察保留，不被迟到 catch 覆盖成可继续的实例。

全部证明仍限定当前 Host 实例与 controller 上下文，不是跨 Host／controller 重建的持久授权。未知恢复、所有权交接和 Host 替换不能默默重置或降级为旧路径；尚未实现这些恢复入口，也未开放 UI 使用。

## 负例与验证

证据：`F:\dsh-wallpaper-plugins\.tmp\native-client-close-fence-20261023-46a76ab4`。开工副本、失败、最终 client／QA、指纹和父监督记录保留。

新增 `qa/wallpaper-close-fence-client.test.mjs` **39 项通过**，expanded-client-fence 父监督 0.834 秒。完整 client 的真实 engine 接实际 Host 注册／路由，生命周期原生 IO 为 session 替身；其中一项走真实回环 HTTP 的准备、检查、重新启用及携凭据停止，另一项验证真实整体截止时间。没有启动真实 WE 窗口或采集。

首轮 30 项通过后继续补负例，实际复现并修正三点：重入停止仍多发准备、已拒绝的准备错误保留 owned、卸载写请求的 catch 把 disposed 覆盖成 unknown。最初重入夹具在赋值前递归调用自身；改为先设置一次性标志后，保留的正确负例仍复现多发 prepare，再修产品。失败没有删除或扩大超时。之后补充实际票据读取不能洗掉未知、未知 409、损坏凭据、修订回退、真实截止与回环 HTTP。

完整既有 42 阶段 **752 项通过**；加新 39 项，共 **791 项**。含原命令／关闭读取、作者与原生侧栏各功能、生成同步、语法及 CSS 检查。P2 和 Motion Cadence 纯离线检查分别 1.053／11.070 秒通过，不是性能或屏幕流畅度实测。

| 实际官方 SDK／完整 client | 流程 | 父监督时间 | 作者 IO 替身 | 普通播放请求 | 新 Host 请求 |
| --- | --- | --- | --- | --- | --- |
| existing-sdk | 原 111 项 | 27.456 秒 | 60 次 | 3 次既有合成播放请求 | 0 |
| fence-sdk | 新 7 项 | 2.413 秒 | 0 | 0 | 1 次实际 GET、8 次实际栅栏 POST |

合计 **118 项 SDK 流程通过**。新组经过实际 React／ThemeRuntime／session／原生右栏／dockkit、完整 Whale apply、真实 controller 和实际 Host 栅栏 handler；文件存在性为底层替身，sessionFactory 若被调用即失败，真实原生运行 0。覆盖打开不请求、显式准备／检查不写偏好或普通停止、偏好／选择／实际主题往返撤销许可、右栏服务重建保留同一 controller、重新启用不播放／持久化，以及整插件卸载取消挂起 inspect。

两组最终页面异常及未知 HTTP 错误为 0；settings/status/library／preset 订阅、refs/pins、远端监听、DOM、stream、活动 Blob URL 归零。自有 headless Edge 正常退出，服务关闭确认，没有强杀。原 111 组 8 个 URL 创建／释放相等；新组均为 0。保留原精确 401 与作者负例 409，cleanLog:false，未扩大允许列表。新 API 订阅取消／卸载另由新单测验证。

原生参数 15 项因缺测试 EXE 的历史未通过，及此前 20 秒合并超时仍保留；本轮不重复相同输入、不构建原生 EXE 或生产资产，不以这次相关检查抵消它们。新测试保留单阶段 20／25 秒、总 60 秒、SDK 45／51 秒父监督，全部自有任务已确认退出，没有等待用户提醒才停止的任务。

## 输入与下一小步

271 项旧输入仅 client.js 变化，**270 项保持**，新增 39 项 QA。Host session／close-fence 模块、旧 QA、生成器与两个生成块、作者执行器、manifest／生产 assets、官方冻结 SDK 输入保持。审计另核对 run-context、送帧／消费／连接、本地库解析、cadence finalize、原 Host schema 与有界 GET 全段保持。client 变化限定 engine 协议／凭据／本地结束抽取，以及 controller 的绑定入口和观察字段。

- client：`DBF158DAE5850336EEB197A0722A29710B4DEB0EC7CB3E9D26BA168F6F28104E`
- 新 QA：`0BB188AD9F0DEBD28097480D4ABEF75F1B215625BC4AC2569D7F416AA2DC2A9F`
- Host session 保持：`9BEE5F07A6B311B917696BCDB45A90DB0167C126BFF23E68C9756CA44CD89038`
- Host 栅栏保持：`2977C6500FDF09508E43836008E9F9CC442AB1920E7767F91F60F79FC6A7B4C9`

下一小步直接做**controller 专用同步提交**：只消费本 controller 当前、未消费的封闭证明，只将 background 改成 none；保留其余外观、壁纸选择和作者设置，不走旧 setter／普通 stop。严格检查存储结果，区分写前失败、写后异常／未确认以及投影失败，报告实际值，不伪造成功或回滚覆盖新设置。偏好／选择／主题往返、取消／卸载及旧 controller 不得复用许可。开启来源也要和显式 activate 对齐，不能在旧 set 或自动播放中静默重新启用。先完成这些离线路径，再接最小 UI，不继续叠加新的只读层。

本轮没有提交来源、按钮、导入／reset 迁移、候选打包／安装／发布、日常 DSH／WE／Profile／版本／生产 assets 操作、提交推送清理、外部助手消息或定时恢复。源码／替身／SDK 验证不代替实机、视觉和长期验收。
