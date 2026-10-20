# P1B-1三审：保留C1–C4进展，仅补E1–E3余项

2026-10-18，Codex独立离线复审[二审补修交付](DETACHABLE_APPEARANCE_P1B1_SECOND_REPAIR_DELIVERY_20261018.md)，依据[二审要求](DETACHABLE_APPEARANCE_P1B1_SECOND_REVIEW_20261018.md)。

结论：单队列正常顺序、旧resolver落定、断连通知落定、3次stale上限、在途显示保护与取消全量恢复均已有实质进展，原负例回归通过。QA新增的CDP连接关闭前失败及进程/server阶段期限也保留。当前仍不通过，只补E1无回包动作截止、E2冲突重试跨预设屏障、E3清理失败调用方退出结果及总超时收尾，不重做架构或UI，不进P1B-2或安装。

## 输入和证据

独立目录`.tmp/detachable-p1b1-third-review-20261018-518dbe04/`，冻结158项src/qa及交付脚本到`dsh-whale-mist/`、`delivery-probes/`。结束时无源码漂移，相对二审仅companion.js变化；59项生产资产/归档保持。见`inputs.json`和`preservation.json`。

- companion.js：`C62EDDED9A749BE157878BE8EB48D316B484D7B44527660C109E26CD04CC545D`。
- safe-qa-runner.mjs：`2AC760B9D4DCD6B81B0C45400E16E764F61332C6726E6835DFF9E38AAD271DDF`。
- client.js、detachable-contract.js保持二审已过指纹，未要求返工。

本轮独立验证：check退出0；P1A5/5；本轮交付边界10/10；上轮R1–R3边界12/12。日志分别为`check.log`、`p1a.log`、`replay-unit.log`、`prior-boundaries.log`。`independent-probes.mjs/log`含两个残余负例和一个正常保序正例，3/3成功复现预期；`qa-caller-negatives.mjs/log`含两个真实finally调用方负例及一个error监听检查，3/3成功复现缺口。这些负例通过表示“缺陷已复现”，不是修复通过。

独立生产页探针运行真实冻结的companion.js和客户端，仅替换DOM/transport收发时序。QA退出探针抽取两个原始脚本的实际finally代码，替换helper返回值为失败，在自有短命Node子进程执行并读退出码，不启动Edge、不调用真实删除。每个探针有1–3秒测试期限，观察等待用80ms有界race，子进程上限1.5秒；无长测或无期限等待。

源码变更只在companion队列，实际React组件和布局未变，本轮不重复开无界面浏览器；交付中的React/几何/E2E/P0结果保留为实现者证据，不冒称本轮独立复跑。真实系统窗、吸附交互和主观验收仍未做。日常DSH/WE及安装/Profile未操作，工作区版本/生产assets未改，无提交推送或清理，定时PAUSED。

## E1：没有断连通知也没有回包时，动作仍无自身截止时间（高，C1余项）

位置：`src/companion/companion.js`的runActionQueue，直接await client.setSetting/client.dispatch；真实HTTP sendAction亦未增加本动作AbortSignal或超时。MAX_STALE_RETRIES只处理“已经返回stale”的情况，不能处理“根本不返回”。

独立复现：保持连接、发送brightness100后transport不返回，随后save；二者均持续pending且只发出第一动作。探针分别有界观察80ms，最后由测试显式disconnect才使它们落定。80ms本身不作为产品超时标准；缺陷依据是实际路径没有任何动作截止/取消机制，不能自行结束。补修交付称断连Promise已结束属实，但这不等于二审要求的“永不回包也有界结束”已实现。

补修：每个设置/预设动作应有明确有限期限及失效代次，支持测试注入短期限。总时限覆盖重试和网络/读body；超过后落定所有相关调用方、释放worker，给出超时及“服务端是否提交未确认”，不自动重放可能已提交的预设。需要时中止本动作底层请求；迟到回包不能改回已失效连接/队列的状态或恢复旧意图。不要只落定外层Promise、让worker仍卡在await中。

验收：保持connected但永无响应的set和preset均可在配置期限内结束，worker释放，后续操作有明确可恢复/需重连状态；超时后迟到成功/失败不误报当前动作、不自动重复保存；已有disconnect、3次重试和superseded正例保持。

## E2：stale分支的hasNewerInQueue扫描越过预设屏障（中，C2余项）

位置：stale-revision处理中遍历整个actionQueue查同key的新值，遇preset未停止。

独立复现：用户set80→save→set100；set80返回stale，权威仍70。扫描找到save后面的100，于是把80标成superseded，直接执行save，保存依据仍70，再执行set100。正常无冲突顺序虽已通过，冲突路径却丢掉保存之前的输入。

补修：所有“同批新输入替代旧输入”的判断都必须尊重同一个预设屏障，包括入队合并和stale恢复。屏障前80不得被屏障后100替代，应按有限策略先确认80再保存；如无法确认则取消依赖的保存并提示，不保存70冒充刚才调节值。保持现有同批无屏障80被100替代的正例。

验收：受控真实队列中，set80→save→set100加stale负例必须保存80或明确整体失败，不能保存70；覆盖save/apply/remove屏障及跨字段情况。断言保存时权威四字段及实际派发顺序，不能只断言队列数或普通无冲突路径。

## E3：QA helper返回失败了，但两个实际脚本仍以0退出；总闹钟仍绕过清理（高，C4余项）

已保留通过：CDP open前close及时reject、已signal退出立即返回、顽固假进程有限返回、server.close有限返回。无需重做这些helper。

剩余问题：

1. 两个浏览器脚本finally将termRes/srvRes/rmRes仅打印为CLEANUP SUMMARY；即使terminated=false、server.closed=false、profile保留/删除失败也不设置非零结果。独立执行原始finally代码，三个helper全部报告失败，两个真实调用方仍自然退出0。这再次违反二审“失败必须非零，不能全成功”的要求。
2. 15/20秒总watchdog仍直接process.exit(1)，没有先取消工作并进入有期限的finally，也没有独立进程层watchdog；本地fetch仍缺阶段AbortSignal。总时限可以防常规事件循环下长等，但不足以证明资源已干净释放。
3. safelyTerminateProcess仍未监听ChildProcess error事件。对无其它error监听的子进程，异步spawn/kill错误可变成未处理事件；短替身检查确认该helper本身没有error监听。

最小补修：两个实际runner消费全部清理结果，任一必要步骤未确认时明确非零结束，保留未确认profile并输出归属/阶段，成功文案在工作和清理都确认后给出。将工作截止与最后兜底区分：先触发可取消工作、进入有限清理，另有外层watchdog处理事件循环或脚本彻底失控；不要只再添加一个process.exit定时器。真实fetch阶段可取消且有界，进程error/exit/close一次性落定。保持只处理自有对象，不全局taskkill/删除，不为了测试开顽固真实浏览器。

验收：对实际共用runner或两个实际调用方，纯替身覆盖工作超时、进程未退出、server关闭失败、删除失败及异步error；检查非零退出、阶段/路径、profile保留和一次性落定。正常短路径确认成功后再0退出。异常路径必须先测，不能只证明helper返回了一个false对象。

### 旧后台记录范围

实现者交付记录task-32已退出0、task-551已取消，并称manage_task(list)运行数0。本轮通过computer-use核对同一新对话已结束，界面未再出现此前Background Tasks计数，与“旧任务已处理”相符。未独立读取其manage_task原始返回或做全系统孤儿进程枚举，因此不替其扩大为“系统零孤儿进程”证明；后续保持按自有命令/进程归属核验，不重跑旧挂起任务。

## 下一步

小G只补E1–E3并提交`docs/DETACHABLE_APPEARANCE_P1B1_THIRD_REPAIR_DELIVERY_20261018.md`，新独立证据目录，完成等复审。单队列正常顺序/显示恢复、R2权威预设门禁、R4错误反馈及QA已过部分保持。仍不进入P1B-2、作者参数或候选，不再扩A调查。日常DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1、manifest/生产assets rc.30保持；不操作DSH/WE、不提交推送清理，定时PAUSED。

转达记录：22:42经computer-use向同一小G新对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次E1–E3；核验新用户消息、输入清空及Working/Cancel，Gemini 3.8 Flash High保持。等待补修，定时PAUSED。
