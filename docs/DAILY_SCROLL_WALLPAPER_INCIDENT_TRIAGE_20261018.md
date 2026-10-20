# 日常故障记录：升级后会话滚动异常与壁纸清理锁

2026-10-18，Codex。用户反馈两项昨晚升级后的日常问题，提供会话截图与壁纸设置截图。用户补充：**当时DSH正在做任务，没有锁屏/睡眠、切桌面或关闭/重开WE等其它动作；今天询问时已无任务。**

这不是正在进行的P1A独立设置窗口测试，也不是Edge伴随窗口的W1/W3；日常仍是DSH0.2.1-rc.2、外观rc.35，已只读核对安装manifest。没有安装、编辑安装目录、停止/重启进程、切换壁纸或修改设置。源码中正在进行的小G补修未动。

## 2026-10-18用户最新排期

滚动A设为低优先级，暂不扩展复现或作为插件开发前置。用户自行未能稳定复现，观察似乎仅在DSH执行任务时出现；仅记复现条件线索，不能据此定因。已有取证/QA补修保留待审，不等同已通过；优先[独立设置P1B-1](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B1_20261018.md)，未来再现且用户安排时再取现场。

## 当前结果

- **壁纸重试锁：已找到日志并用实际安装版Host代码隔离复现。** 采集退出但缺少最终worker证明时，连续重试都在同一门禁返回，无法走后续窗口核验。初次壁纸断流原因仍未定位，不把这个收尾缺口说成断流根因。
- **会话滚动：用户现象已记录，尚未复现/定因。** 截图显示运行过程条目、输入框及其下方状态提示的位置异常；截图不能确定实际滚轮命中了哪个容器，也不能证明状态文字的位置使整片区域成为“思考内容”。
- **今天当前现场已无清理锁。** 11:27左右只读检查：新DSH主进程本日11:19启动；宿主PID8232实际监听127.0.0.1:13012。仅GET `/whale-wallpaper/status`返回200、active=false、failed=false、error为空、lastCleanup=null；没有WallpaperProbe进程。当前WE是本日11:14启动的新进程，与昨晚日志的PID/身份不同。此为当前观察，不证明昨晚所有资源是如何退出的，也不保证故障不再发生。

证据目录：[`.tmp/daily-incidents-20261018-ede83704`](../.tmp/daily-incidents-20261018-ede83704)。含两张用户原图、12项安装源码/manifest冻结副本与哈希、原运行日志副本、独立回放及当前只读状态。未读取用户会话正文、认证文件或修改日常Profile。

## B：壁纸消失后重试清理无效（优先修复）

### 用户可见现象

画面突然没有壁纸，选择项仍为三体；“当前播放：未播放”，“开始播放/重新开始”被禁用。重试清理后仍显示：

```text
Window cleanup incomplete (worker-unconfirmed): worker exit could not be confirmed
```

该文案表示**缺少退出确认**，并非已经确认壁纸或worker还活着。阻止未确认资源与新运行重叠的门禁有必要，但目前缺少可靠的恢复路径。

### 对应历史日志

目录：`C:\Users\HP\AppData\Local\Whale Appearance\wallpaper-preview\2026-10-17T125421-e8fd-we-41612c520dd4406e48dea550`。

本轮身份是location `WhaleWallpaperProbe-261017125421-b995`、采集PID16784、源窗口HWND921968、源WE PID11708；**仅是昨晚身份，不能用于今天关窗/杀进程。**

冻结的`preview-final.json`/`preview-status.json`有：

- running=false，stopping=true，window.cleanup为worker-unconfirmed/closed=false。
- failure保留初次的`capture process force-killed; worker exit could not be confirmed`；后续cleanup.error已变成较短的`worker exit could not be confirmed`，与反复重试路径相符。这里只报告Host记录的强制退出分支，不补造OS退出码。
- 最后帧接收时间为2026-10-17 23:09:30.067 +08:00。文件写入时间在其后，不能把文件mtime当最后采集时间。
- native周期taskbarHide为action-done，workerCleanupSafe=true，但cleanupSafe=null。保留的200条诊断消息里没有Summary，最后一条为`[Lifecycle] parent lost (parent-stop); owned window close outcome=closed closed=True`。
- `taskbar-action.json`记载当时任务栏动作成功、action.exited=true、action.cleanupSafe=true；但这是动作记录，不能直接冒充当前完整终结证明。原生日志声称本轮源窗已关，也不能替代今天的身份核验。

这些信息支持“存在断流/停止后清理状态未收敛”的判断；不能据此确定第一次断流是资源竞争、采集异常、父管道还是退出竞态。也不能断言当前仍有孤儿worker。

### 已复现的重试缺口

使用**安装版rc.35**的`src/wallpaper/session.js`及依赖冻结副本，底层helper/spawn全替身，没有执行真实EXE。见`retry-lock-replay.mjs`、`retry-lock-result.json`与日志。

两条独立路径各连续stop三次：

1. 首次等待超时后走强制结束，child退出；后续不再有新终结消息。
2. child正常退出码0，但只给周期Status和Lifecycle，没有最终Summary。

两例三次均worker-unconfirmed/closed=false，isClosed=false；`--window-ensure-closed`调用次数均0。回放退出0表示这些复现断言成立，不是问题修复通过。

安装代码只在stderr的Summary分支设置`terminalTaskbarHide`；stop在其缺失、非零退出或强制结束时提前返回。之后stop虽然重新执行，却没有独立取得worker/窗口最终身份状态的路径；已退出child不可能再产生缺失的Summary，所以重复点击没有新的证据来源。路由保留失败session、前端禁用开始/重启，形成用户看到的清理锁。

### 修复边界与验收

保留未知状态阻止新运行的原则；**不能把周期workerCleanupSafe=true、旧action.json或源窗口已不可见直接改成“清理成功”。**

- 为首次停止和后续重试提供受限的终结核验：绑定本轮location、源身份、capture/worker PID及创建身份，能区分存活、已退出、身份复用、查询失败；补齐足够的持久证明字段/协议。只处理本轮资源，原WE主进程不终止。
- 原child已退且流不会再输出时，不无限等待旧Summary；通过独立、可信的当前核验决定继续保留还是收尾。旧证据只作线索。证据不足继续失败，并让错误说明实际缺失项。
- 重新获得终结证明后，成功清理、释放session、恢复开始/切换；重试需幂等、有界，不忽略身份不符或系统查询错误。
- 排查首次断流另建时间线：最后帧、stdin stop触发者、child close/exitCode/signal、stderr终结、worker核验及源窗关闭分别记录。当前证据不能用“任务重”或“三体特殊”代替根因。
- 原生finally与Host等待预算需要对齐检查：源码中存在源窗关闭后才发Summary、单步窗口等待可达15秒，而Host默认等child为12秒的线索；此处尚未做实际二进制调用链验证或延迟复现，**不是已证明的本次触发原因**。不要只放大超时当作恢复闭环。

验收：正常停止保持；强制/异常退出且缺Summary→重试仍未知保留→当前核验确认本轮资源已退→成功收尾→可以重新选择/开始；同时覆盖顽固worker、PID复用、身份信息缺失和核验错误负例。先离线回放，再独立候选审计；真实安装/长时重现另约，不在当前日常直接改源码。

## A：滚动思考/过程内容时整个会话跟随滚动（待复现）

用户截图保存在`scroll-user.png`：当时会话正在运行，过程条目延伸到任务栏/输入框附近，“深度探索中”在输入框和统计行下方。用户怀疑状态文字移位导致整个区域都成为思考内容。这里记录为用户猜测，不作为实现根因。

当前只读代码发现：

- rc.35外观确实会改会话几何：`createBackdrop`的prepareHistoryPort/measureHistory针对`data-conversation-scroll`和composer seat添加标记；样式把scroll设为static、composer改成absolute，并根据卡片位置预留空间。背景出现/停流/卸载会切换这些规则，故需检查失效与恢复链路。
- 已提取的新官方conversation代码仍有这些data属性、Dc7zOa视图和composer结构。因此不能简单说“新版改了class所以失效”；需测具体结构及几何关系。
- 用户描述也可能涉及思考内部/过程组滚动与外层会话滚动的区别。需要分清内部尚可滚动时外层就动、到边界后传给外层、以及整个输入框/底部状态被错误排版三种情况。
- 没有获取当时DOM、wheel命中目标及scrollTop变化，未启动模型任务重现、未禁用任何正在使用的插件；未证明故障来自外观、宿主或其它插件。

后续复现优先采用新版真实结构的隔离流式长会话fixture（包含过程组、任务条、输入框、统计及底部状态），比较背景正常→等待/断流→cleanup-failed→无背景，以及纯宿主/加入外观后的行为。只改一个变量，不把小G正在改的P1A代码混进日常试包。

记录实际wheel target及其祖先的clientHeight/scrollHeight/scrollTop、overflow-y、overscroll-behavior、position和输入框/状态条的矩形；确认究竟哪个容器在移动。若无法用隔离fixture复现，再约用户方便时只读检查实际会话DOM，不为复现自动发模型请求。

验收应覆盖：长思考和工具过程、运行中/结束后、背景断流/恢复、任务栏与统计显隐、窗口缩放。输入区域及状态位置按宿主原行为保持；有内部可滚动内容时滚动目标正确，不能用全局preventDefault或把body锁死来掩盖问题。此项尚无修复通过结论。

## 排期与交付

接续更新：P1A已在[十审](DETACHABLE_APPEARANCE_P1A_TENTH_REVIEW_20261018.md)通过源码离线复审，不再返工该阶段。下一步先做本记录B的异常退出后清理恢复，再做A的滚动复现归因，优先于P1B扩UI。与P1A分开保护输入及交付，不合并成整体工作区包；由用户转交，不跨会话消息。真实安装、退出、重开或采样另确认届时方便。

B第五轮补修经[六审源码离线通过](WALLPAPER_CLEANUP_RECOVERY_B_SIXTH_REVIEW_20261018.md)。S1原始PID类型与worker误过滤门禁闭合；Host JS110/110、独立38项、真实路由链路及rc.35对应回放通过，59资产归档保持。仅源码离线通过，日常rc.35未接入，首次断流根因仍未知。下一项滚动A隔离复现/归因；用户已返回，定时任务g保持PAUSED，用户随后明确授权转达，滚动A离线复现任务已发至小G原对话并确认Working，等待交付SCROLL_A_OFFLINE_INVESTIGATION_DELIVERY_20261018.md；不安装或操作日常。

滚动A首审：[调查需补证据](SCROLL_A_OFFLINE_INVESTIGATION_REVIEW_20261018.md)。原交付与独立复跑均未出现报告声称的waiting状态下方错位，六个关键官方CSS模块漏提取，动态覆盖/有效性断言不足。仅补R1–R3调查与QA，交SCROLL_A_OFFLINE_INVESTIGATION_REPAIR_DELIVERY_20261018.md，不改生产实现。B六审/P1A十审及59资产归档保持，日常rc.35未接入B修复，首次断流仍未知；定时任务PAUSED，不安装或操作日常。

最新[A二审](SCROLL_A_OFFLINE_INVESTIGATION_SECOND_REVIEW_20261018.md)：错误归因撤回与9模块CSS提取已核对；独立两尺寸六状态仍未复现截图。尚补Q1测量/模型范围、Q2取证误选、Q3连接open前close仍pending，仅QA/文档，不改生产实现。B六审/P1A十审及59资产保持，日常未安装B修复。用户准备换小G新对话，交接已写，等待用户确认发送目标；不再向旧长对话发任务，定时PAUSED。 具体接续见[新对话交接](GEMINI_NEW_CONVERSATION_HANDOFF_20261018.md)。

[A三审](SCROLL_A_OFFLINE_INVESTIGATION_THIRD_REVIEW_20261018.md)：Q1隐藏测量与模型范围、9模块CSS、连接open前close挂起已闭合。只补C1取证无唯一scope仍退回文档/首个会话、C2未确认测试进程退出仍删profile报成功，交SCROLL_A_OFFLINE_INVESTIGATION_THIRD_REPAIR_DELIVERY_20261018.md；已通过部分保持，不改生产实现。A有限模型未复现且根因未知，B/P1A及59资产保持，日常未安装B修复，定时PAUSED。小G新对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e接续。
