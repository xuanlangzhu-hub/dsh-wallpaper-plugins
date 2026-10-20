# P1B-1四审：E2与清理失败退出已过，仅补F1/F2

2026-10-18，Codex独立离线复审[三审补修交付](DETACHABLE_APPEARANCE_P1B1_THIRD_REPAIR_DELIVERY_20261018.md)，对照[三审E1–E3](DETACHABLE_APPEARANCE_P1B1_THIRD_REVIEW_20261018.md)。

结论：保存屏障在stale恢复时已正确阻断替代；两个QA调用方已消费清理失败并返回非零，进程error监听已补；单次无回包动作也能返回超时并释放worker。以上保留通过。仍有F1动作总时限/迟到响应处理，以及F2真实工作截止/外层watchdog两项余项，本轮暂不整体通过，不进入P1B-2或安装。

## 独立输入及结果

证据目录`.tmp/detachable-p1b1-fourth-review-20261018-a84f61d3/`。158项src/qa冻结，交付QA/日志单独复制，检查结束无漂移。相对三审仅companion.js变化，59项生产资产/归档保持，见`inputs.json`、`preservation.json`。

- companion.js：`A330C8DAC52F895AFE934C6ECDF480D65016B7E2964A1AA0DA0A27B294727AF6`。
- safe-qa-runner.mjs：`9AD6C9A738517CB701C19ECFEA8AA1A169237C261C461DF7C88A56B1235BB9BF`。
- client.js/contract及实际React组件保持上一轮已过指纹，不机械重跑未变的视觉/真实React/E2E。

独立复跑：check退出0；P1A5/5；本轮8项+历史10项共18/18，含E2冲突屏障与实际finally清理失败非零、error监听正例，见`check.log`、`p1a.log`、`replay-units.log`。复跑脚本只改隔离副本的导入位置，不改生产实现。

新增`independent-deadlines.mjs/log`：两个F1负例及一个预设超时/后续动作正例，3/3，约0.5秒。新增`watchdog-proof.mjs/log`：两个原始QA各2个watchdog负例，4/4，约0.9秒。负例“通过”表示缺口成功复现，不代表实现已修。

产品探针运行真实冻结companion与createCompanionClient，仅替换DOM/transport时序。watchdog探针直接抽取原始QA的outerWatchdog代码，只将15/20秒缩短至20/30ms，在自有短命Node子进程验证；父进程对每个子进程设900ms硬上限。没有启动Edge、顽固真实进程、可见系统窗或日常DSH/WE。未改安装/Profile、manifest/生产assets或版本，无提交推送清理，定时PAUSED。

## F1：Promise.race只限制每次等待，未实现动作总截止或响应失效（高，E1余项）

### 1. 时限随每次stale重试重新开始

每次while出队都重新setTimeout(actionTimeoutMs)，没有挂在item上的绝对deadline。受控负例设置70ms，前两次在时限内返回stale，第三次不返回；同一个逻辑动作约214ms才结束，共发3次。有限3次重试已有效，不能称无限重试；但这仍不是三审明确要求的“总时限覆盖重试与网络/读body”。

补修：逻辑动作首次开始即固定截止点；每次等待只用剩余预算，stale让出宏任务也计入。重试次数上限保持，不得每次重新获得完整5秒。测试可注入短期限，边界留合理调度容差。

### 2. 超时的底层请求仍继续吸收响应，app/DOM会改变

独立复现brightness100超时后，app快照/滑块已回70，调用方结果为action-timeout、serverCommitted unknown。此时给原请求返回rev2 brightness100；真实createCompanionClient.dispatch先吸收响应并通知订阅，app快照/滑块又变100。item.settled只保护调用方Promise，拦不住客户端响应通路。交付8项的迟到测试仅断言Promise结果/未重放save/错误文字未清，没有检查app/client快照或DOM，因此遗漏。

这不证明服务端错误提交：超时本来就可能已提交，新的独立权威推送仍应如实同步。问题是实现宣称“旧动作响应已失效”，实际并没有区分旧动作回包与当前同步；不能把过期回包自动吸收当成已经验证的失效机制。

补修：在真实客户端/transport响应接收入口提供本动作取消/失效代次，必要时AbortSignal，不能只在最外层race。过期动作回包不得继续走当前动作完成/快照投影路径；保持独立SSE权威新快照的正常同步。若选择以独立重新同步确认服务端真实状态，应明确这条状态恢复路径及未知提交结果，不把原动作改判成功，不自动重放预设。任何共享contract改动同步模块/嵌入版本，能力/身份/单调门禁不放宽，不重做P1A架构。

验收：set与preset均覆盖无回包、总预算内多次stale、超时后迟到成功/失败及其快照、断连/新代次；同时断言调用方结果、实际发出动作数、client/app版本、DOM与错误状态，而非只断言Promise不会二次resolve。独立正常SSE更新继续通过，实际服务端提交结果未知时诚实显示，不自动重试预设。

## F2：outerWatchdog仍只是原进程里的setTimeout，工作超时依旧跳过finally（高，E3余项）

两个浏览器脚本只有`const outerWatchdog=setTimeout(()=>process.exit(1),15000/20000)`及unref；没有单独的工作截止信号，也没有独立进程watchdog。加try/catch只捕获真实throw/reject，不能使process.exit执行finally。变量叫outerWatchdog不改变作用域。

独立短负例直接使用原始回调：

1. 缩短到30ms，受控工作Promise永不返回，保持事件循环可运行；watchdog以1退出，finally的CLEANUP_REACHED完全未执行。
2. 缩短到20ms，有限忙循环100ms后结束；同进程watchdog全程无法运行，子进程仍能退出0。忙循环有固定100ms上限，父进程900ms上限，没有无期限挂死。

本轮新增的清理失败非零、fetch阶段timeout、进程error监听均保留，不再返工。仅补总工作/最后兜底接法：

- 工作截止先触发可取消的工作失败，让控制流进入有期限的finally；所有本轮工作等待应消费这个取消信号。
- 真正外层监督应在独立进程/现有命令监督层，有独立壁钟和硬时限，记录本轮worker及browser等自有资源归属；总失败后只处理本轮对象。不得全局taskkill node/Edge或盲删profile。
- 工作与清理均确认后才给全成功；未确认退出保留profile/证据并非零。外层强制结束时如实输出清理未确认，不冒称已干净。
- 两个runner实际使用同一个受控接法即可，不重写所有历史QA，不另起A/性能专项，也不要再复制同进程process.exit定时器改名为“外层”。

验收先用纯替身/短命自有Node：工作deadline进入finally、清理失败非零、事件循环有限阻塞由外部按期判失败、遗留资源路径保留。每例有独立父级硬上限且不用真实顽固浏览器；异常检查过后仅一次正常短路径。报告区分“同进程软截止”“外层硬截止”及实际命令/退出码。

## 最小接续

小G只补F1/F2，交`docs/DETACHABLE_APPEARANCE_P1B1_FOURTH_REPAIR_DELIVERY_20261018.md`，新独立目录，完成等复审。E2屏障、E3清理失败消费及此前已过部分保持，不再加UI或扩测试矩阵。A低优先级；日常DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1与manifest/生产assets rc.30保持，不安装发布、不操作DSH/WE/发模型请求、不提交推送清理，定时PAUSED。

转达记录：22:58通过computer-use向同一小G新对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次F1/F2；核验新用户消息、输入清空及Working/Cancel，Gemini 3.8 Flash High保持。等待补修，定时PAUSED。
