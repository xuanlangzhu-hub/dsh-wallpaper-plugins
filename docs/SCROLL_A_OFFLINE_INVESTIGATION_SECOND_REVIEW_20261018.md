# 滚动A二审：提取与正常执行已修，补齐测量和取证边界后交接

2026-10-18，审查[首审补修交付](SCROLL_A_OFFLINE_INVESTIGATION_REPAIR_DELIVERY_20261018.md)。**首审R1的错误归因撤回、R2的六项漏提取已修；仍有下列Q1–Q3，调查交付暂不全部通过。** 不据此改生产布局。A在本轮隔离模型中未复现用户截图，真实根因仍未知。

## 已确认的成果与证据

冻结目录：`.tmp/scroll-a-second-review-20261018-a4890924`，见`inputs.json`。仅复制交付顶层文件，不复制或删除小G的浏览器profile。

- 独立`audit.mjs`从官方冻结源重新解析、核对全部9个CSS模块的字节、SHA256和聚合文本，均一致；旧的转义引号提取失败已修，见`audit-result.json`。
- 复制runner后只加入隐藏测试窗口参数和自有临时profile删除边界检查，未改测试逻辑。独立复跑退出0、约6.5秒，本轮正常路径没有再次永久等待，见`replay.log`。不要沿用报告“完整批量均在2.2秒内”的说法。
- 两种视口、各6状态的滚到底部采样均未出现报告原先的285px悬空或状态落到卡片下方；1080p卡片920–1048，另一视口1074–1202，均距视口底32px。这个结论只针对所列模型与采样，不能写成实机排除。
- 比对P1A十审161项输入，仅既有B专项managed-window.js/session.js不同；B六审session哈希仍为`DE7C5A9DA5AE3A892D5D9B39BAF36E95B0A2A6596C936E98F8001AC9FD18CB8A`，59项资产归档保持。原交付未漂移，见`preservation.json`。本轮未改实现、安装/Profile/版本号，未操作日常DSH/WE、发模型请求或提交推送。
- 历史挂起Node PID33492本轮只读核对已不存在；这不是全部历史测试进程均清理完成的证明，不复用此PID作任何操作。

## Q1：测量与报告仍有不一致，简化模型不能排除真实瞬态

两份视口结果的`streamCompletedRunningHidden`实际均为false，报告却说隐藏通过。原因是getElementSnapshot对`display:none`仍返回对象，而runner用“对象存在”判断是否隐藏。需要按computed display/visibility/client rect等测量可见性，并断言：运行时可见、结束后隐藏、恢复可见。不要改DOM成“删除节点”只为迎合错误断言。

所谓sameFrame是在状态变更通过一条CDP调用完成后，再发另一条调用测量；`setBackgroundState`内部还同步measureHistory。当前控制器没有生产rc.35的MutationObserver、ResizeObserver、atHistoryEnd保持和完整history clip路径。fixture也覆盖了running排版等样式。因此它是有限的静态/简化模型，不能用它声称“已排除流式/观察器/第一帧竞态”。无需为此重建完整宿主；明确简化和未覆盖项、撤回过强结论即可。若保留某项动态保证，就在正确测量边界下验证它。

工具列表“外层没动”是当前一次输入的观察；`hasOverflowHiddenAncestor:true`和原因在runner里直接写死，没有对父层overflow做单变量对照，也没记录中间祖先实际滚动。把“必然由overflow:hidden阻断”降为假设，或给反事实证据。滚动链与DOM事件冒泡不要混作同一机制。

## Q2：准备给实机用的取证脚本选择器错误

在小G自己的修补fixture上原样运行交付报告的Console脚本，独立结果见`delivery/collector-result.json`：

- card、todoPanel、statsDock均为null，但真实对应节点都存在；
- runningStatus选到`.WW4l1q_root`折叠过程组，而非`.xz4KEq_running`；
- scrollBody能找到，但scrollState另用不存在的`#main-scroll-body`，结果为空；
- reserve读html/body，而变量实际设在本轮scroll节点上。

请将取证脚本独立为可复用文件，并以源码核对的`[data-conversation-scroll]`、`[data-composer-seat] .RlGAzG_card`、`[data-chat-running]`（必要时注明`.xz4KEq_running`回退）、`.aSus8q_root`、`.RlGAzG_dock`等为基础，先定位唯一可见活动会话，再在同一scope查找，避免多会话/隐藏节点混入。记录查询数量与ambiguity，缺失或不唯一必须明示，不能随便取第一个。变量、滚动数据从同一个scroll节点取。区分隐藏与不存在，不读取聊天正文。

至少在隔离页验证正常可见、结束隐藏、目标缺失/多个候选的诚实输出；不能用缺失字段当正常。真实日常取证仍待用户另行安排，不为验证这个脚本擅自操作DSH。

## Q3：CDP连接在open前close时仍可永久等待

整数ID、请求pending Map/8s超时、Runtime异常处理的正常路径已修。但两个RobustCdpClient的connect里，`onclose`清掉连接超时，只rejectAll已发送请求，**没有reject尚未完成的connect Promise**。

独立`cdp-close-probe.mjs`提取原类，注入仅在open前触发close的假WebSocket，无网络/浏览器。配置25ms连接超时，100ms后仍pending，见`cdp-close-result.json`。这是新代码的确定异常边界，不必再跑真实15分钟任务。

最小补修：连接成功/失败统一一次性落定；open前close/error/timeout均reject并关闭自有socket，请求级错误/close/timeout保留。补这几种纯替身负例，不必重构整个通信框架。清理也需等待自有浏览器退出且有界；进程已经退出时不能再无条件等待新的exit事件。超时/失败如实记录，不用“无孤儿”代替逐项证据。

## 下一份交付与交接

只做以上调查/QA/文档的小修，交`docs/SCROLL_A_OFFLINE_INVESTIGATION_SECOND_REPAIR_DELIVERY_20261018.md`，使用新输出目录保留旧证据。无需重做B/P1A或继续盲找必须出现的根因；可诚实以“有限模型未复现，真实现场待用户安排”收尾。

用户准备换小G新对话。本轮不再向旧超长对话发任务，不自行创建/发送新会话；先准备[新对话交接](GEMINI_NEW_CONVERSATION_HANDOFF_20261018.md)，用户确认新对话后再转达。定时任务保持PAUSED。
