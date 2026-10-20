# 可分离/吸附外观设置 P0 补修复审（二审）

2026-10-17，Codex。审查[首轮补修交付](DETACHABLE_APPEARANCE_P0_REPAIR_DELIVERY_20261017.md)及其源码/QA，对照[首审R1–R6](DETACHABLE_APPEARANCE_P0_REVIEW_20261017.md)。

**结论：有实质改善，但暂不通过。R1内存桥会话撤权与R5本轮核对项已修；R2、R3、R4、R6仍未闭合。先补余项，再审P0，不扩完整P1 UI。** 本次不重开已确认的旧连接/范围/同值问题，也不要求完整设置界面或真实开窗来代替离线接缝。

本轮未查询/操作真实DSH/WE、未打开真实伴随窗口、未安装/打包/提交/推送/清理。用户继续使用日常rc.34，manifest/生产assets仍rc.30冻结。

## 已确认的改善和复跑结果

独立证据：`.tmp/detachable-appearance-p0-second-review-20261017-810bb141`，冻结本轮源码/QA/package及两份交付报告；见`protected-before.json`、各log与`probe-results.json`。

| 检查 | Codex本轮结果 |
| --- | --- |
| `npm run check` | 退出0 |
| 冻结P0 QA | 11/11，退出0 |
| 实际client外观/英文fixture | 570/566，退出0 |
| 场景选择 | 正对照启动1次，改选0次，退出0 |
| headless独立profile，实际controller同值探针 | 通知0，引用不变，有界同值回写通知0 |
| 实际controller范围/scene | blur规范到24、surface规范到40，非法scene拒绝 |
| 浏览器HTTP导入冻结bridge及其contract依赖 | 成功，退出0 |
| 补充Node探针 | 1组正向综合核对成立，8组剩余缺陷复现成立，退出0 |

正向探针确认：未握手/旧已关闭通道拒绝，落后一版/未来revision拒绝，预设失败及重复失败保持，状态事件更新快照、schema修正。这些改善保留。11项QA中所谓“Real Controller”仍使用mock；本轮真实controller证据来自独立浏览器探针，不把二者混称。

配对8/8与Profile边界11/11仍引用小G自测，本轮未重复跑未受影响套件。现有React stub不是实际React双视图验收，浏览器import成功也不代表已实现跨进程通信。

## R2 [P1，未闭合] 队列未解决重复弹出、未知清理后的新建和卸载完成边界

位置：`src/detachable-bridge.js:216–260,265–314,527–564`。

已修：旧disconnect不能取消新代次；旧close与新detach按队列顺序执行；直接requestDock能看到close错误。

仍可复现：

1. 第一次requestDetach完成spawn后、尚未握手，第二次requestDetach会再次spawn：**两次启动、两个不同token，第一token失效**。216行只把已连接的detached视为已弹出，遗漏detaching。串行执行不等于同一弹出意图去重。
2. adapter.close抛`still-open`后，直接requestDock返回失败、停在docking；紧接requestDetach却成功再spawn。**旧窗口/进程退出未知时，没有阻止新建。** 默认profile按instanceId复用，目录参数本身也不能证明两轮资源已分开或上一轮已退出。
3. 用`started`屏障确认spawn确已进入等待，再调用并await dispose：**dispose先结束，spawn仍在进行**。后来spawn成功才由requestDetach补close。它最终可能清掉，但dispose完成不代表资源已清理；调用方可能已卸载Host。现有QA第8项的dispose在transition微任务开始前调用，根本未保证spawn已开始，不能证明这一场景。
4. dispose遇到close失败仍resolve undefined并置docked，清理失败继续被吞。重复dispose也返回新的已完成Promise，不能取得同一在途清理结果。禁止未处理rejection做到了，可确认资源退出尚未做到。

补修：detaching复用/拒绝重复意图；未确认清理保持可见且阻止新建，只允许针对本轮资源重试。adapter应返回明确owned handle并按该handle关闭，不用无参数全局close表达代次归属。dispose返回同一个可等待结果，覆盖已启动spawn、排队操作及迟到资源的定向清理；失败/未知显式返回。补“spawn已开始”的屏障、重复弹出、失败后重开、重复卸载的测试。仍不启动真实窗口。

## R3 [P1，未闭合] 已连接态快照单调，但连接/断开时序和拒绝恢复仍缺失

位置：`src/detachable-contract.js:196–226,239–261`。

已修：正常已连接状态接收4再2，保持4；动作strict revision与失败去重成立。

仍可复现：

- connect等待响应→disconnect→旧connect成功返回：**isConnected又变true**。没有连接代次/取消守卫。
- connect等待时收到revision4，由`if (!connected) return`丢弃；旧握手响应revision3随后到达，客户端留在3。不能把连接期间的更新一概忽略后再装旧快照。
- 模拟丢一次广播，主端到revision2；客户端动作收到`stale-revision`及最新snapshot2，但dispatch只return响应、不吸收该快照，客户端仍为1；**第二次操作继续stale-revision**。需有明确自动恢复或同步接口，不能丢着权威确认状态不用。

补修：连接代次/取消令牌同时守护握手、快照、断开与动作响应；连接期间缓存/排序有效快照或握手后可靠重新同步。拒绝/确认响应中的快照通过统一的实例/协议/单调revision门禁更新，不允许旧结果复活已断开的客户端。补迟到握手、连接中更新、断线后响应及一次丢广播后的恢复测试。不要只补更多“已连接4→2”用例。

## R4 [P1，未闭合] 预设失败已修，但伴随端吸附/关闭仍提前报成功

位置：`src/detachable-bridge.js:468–475`。

代码仍是`bridge.requestDock(); executionResult={ok:true}`，没有等待也没有把失败结果返回给伴随端。本轮经已认证transport发送request-dock，adapter.close抛`still-open`：**动作响应ok=true，随后mode停在docking**。直接调用requestDock能返回false，并不能证明伴随动作链路正确。

补修：动作确认区分“已受理”与“已完成”；等待/追踪同一transition的最终结果，关闭失败不得回完成成功。若先关闭通信再完成系统窗口关闭，需定义主端可观察的最终结果/错误回执方式。重复动作订阅/返回同一在途操作及最终真实结果，不缓存提前成功。request-dock与close-window都测试成功、延迟、失败和重复；保留已修预设门禁及失败去重。

## R6 [P1，未闭合] import问题已修，假Host通信/origin证明仍未提交

已确认模块无Node import、浏览器HTTP加载成功，package files纳入两模块。**这只关闭R6的模块加载子项。**

首审明确要求的“主renderer唯一controller→假Host→独立浏览器客户端最小往返”仍不存在：当前transport仅直接调用同进程bridge；没有待核对的HTTP/消息适配器、具体正式路由/注入路径、origin/端点认证拒绝测试或主实例失联禁写证明。补修交付未列相关实现与原始证据，不能把两次import称为整个R6闭合。

按首审继续补最小接缝即可，无需完整UI/真实DSH/真正Edge应用窗口：

1. 明确controller所在renderer、Node Host、伴随browser三方各自运行的模块，以及基于当前正式ctx/webServer能力的具体消息路径。只传受限动作/确认快照，不复制apply、用户存储或播放管线。
2. 假Host仅loopback，明确端口分配/冲突；浏览器实际执行一次握手、写值、已确认回传和主实例失联禁写。提交错误origin、缺认证、旧租约/旧实例的端点级负例。仅验证内存能力对象不等于端点鉴权完成。
3. 启动适配器可继续注入，不真spawn，但明确并离线验证受控可执行文件、`shell:false`、绝对且本轮拥有的profile、owned handle关闭/退出确认；缺依赖须受控报错。当前默认路径仍带`C:\Users\HP`兜底，不能作为通用依赖/用户目录发现方案。
4. 更新原交付报告或加醒目的历史/勘误标记。原报告仍保留browser.open、/top_up、所有WebContentsView一律deny、零新依赖/100%复用/30–50MB等原句；补修报告称“已移除”与文件现状不符。未实测的图标/DPI/内存写待验，Edge保留有条件候选，不借用账号IPC或关闭安全隔离。

## 接续与现场保护

小G只补本报告剩余R2/R3/R4/R6，保留R1、R5及原预设/自动播放/清理门禁。交付报告应逐项写“已修子项/剩余项/对应测试”，不要提前在NEXT_TASK、PROJECT_STATUS写“全部闭合”或“彻底封闭”。补修证据另开目录，保留本次冻结输入/失败日志和全部旧包。

本轮生产源码、QA、package、资产、release归档保护清单178文件复核不变；Codex只新增独立证据与本报告、更新接续文档。日常rc.34不动，不打整个含Trace工作区；不提交推送、不跨会话消息、不操作真实DSH/WE或伴随窗口。由用户转交，补后再审。
