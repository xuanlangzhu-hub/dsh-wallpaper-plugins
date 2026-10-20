# P1B-1二审：主要补修保留，队列与QA有界退出仍需C1–C4

2026-10-18，Codex独立离线复审[补修交付](DETACHABLE_APPEARANCE_P1B1_REPAIR_DELIVERY_20261018.md)，对照[首审R1–R4](DETACHABLE_APPEARANCE_P1B1_REVIEW_20261018.md)。用户本轮另明确要求：再次检查小G无返回的测试脚本，直接告知并着重强调不再写一直卡住的脚本。

结论：保留已通过的旧revision拒绝、正常“拖完再保存”、权威presetTarget下发/消费、独立动作错误反馈。实际React及几何探针已复跑。当前仍不通过，只补下列C1–C4，不推倒P1A/B，不进入P1B-2或安装。滚动A继续低优先级。

## 冻结输入和验证范围

独立目录：`.tmp/detachable-p1b1-second-review-20261018-0d6fa281/`。158项src/qa冻结到`dsh-whale-mist/`，交付QA存`delivery-probes/`，两个原始浏览器脚本另存`original-qa/`。结束时输入无漂移，59项生产资产/归档保持；相对首审仅client.js、companion.js、detachable-contract.js三项源码变化。证据见`inputs.json`、`changed-since-first.json`、`final-preservation.json`。

| 输入 | SHA256 |
|---|---|
| client.js | 557B9C8CE67B9E73FA040CA33A593610BC6ACF18E988BCF31A9E08B6CD9DA769 |
| companion/companion.js | 6314476614A8A4064BD0D4FDA92AA3F847F653D08C889244936E8E9F04AC5CAE |
| detachable-contract.js | 5E894F62BFFEE1F9640EBAD5862E12E48E8FE2251834E29EB0914993065D80AD |

| 检查 | 本轮独立结果 |
|---|---|
| check | 退出0，check.log |
| 交付边界探针 | 12/12，replay-boundaries.log；其断连替身主动替实现解决所有在途响应，未覆盖C1真正无回包 |
| P0/P1A | 分别15/15、5/5，p0-rerun.log、p1a-rerun.log。首次合跑17/20，三项fetch的bad port错误；未改源码，独立分跑恢复通过，首次记录p0-p1a.log保留，不误报产品回归 |
| 实际React19.2.0 | replay-react.log，真实组件/controller，R4保存/应用/分离错误、关闭错误、后续成功清除及门禁通过 |
| 生产伴随页几何 | replay-geometry.log，380/720px列数与横向溢出检查通过；rect非零仅代表有尺寸，不代表可点击/未被裁剪/已连接 |
| 独立队列负例 | independent-residuals.mjs/log，6/6成功复现缺陷，约250ms；不是修复通过 |
| QA挂起负例 | qa-hang-boundaries.mjs/log，直接抽取两个原始QA的CDP连接函数，3/3成功复现局部Promise无返回，约280ms，无真实浏览器/进程 |

浏览器复跑只改独立副本的源码/输出路径，并给自有子进程退出和server.close加1.5秒review保护、保留新profile；原脚本15/20秒总watchdog保留并在触发时尝试关闭本测试创建的browser。没有把这些review保护当小GQA已修好。正常路径均数秒完成，未触发保护，不做可见系统窗、日常DSH/WE或实机验收。本轮未重跑旧双Tab11项；交付所列11项仅作为其证据，不冒称本轮独立覆盖。

## C1：动作Promise仍可能永久pending，陈旧版本重试也无上限（高）

位置：`src/companion/companion.js:422`runActionQueue，尤其435移除pending、460 stale-revision分支、831断连回调。

1. **旧resolver丢失**：80请求在途，100排队；80返回stale-revision，分支把100保回Map却不resolve旧80的item。100成功后，旧80的Promise仍pending。独立探针有界观察40ms，结合该分支无剩余resolve持有者，确认不是单纯慢回包。
2. **断连不落定在途项**：disconnect仅遍历pendingSettings和presetQueue，在途项此前已delete；若sendAction无回包，活跃动作仍pending。交付测试的transport.disconnect主动把所有pending网络响应resolve成失败，掩盖了这个实现缺口。真实HTTP action fetch也未绑定断连取消或本动作时限，不能把替身主动落定当生产保证。
3. **无上限重试**：每次stale-revision都重新塞回并继续while(true)，没有次数/截止时间。短负例连续送6次stale，收到第7次自动请求；由探针显式送probe-stop才退出，不在真实环境等待它自然挂住。立即响应还会持续占用微任务队列，单靠setTimeout总闹钟不足。

最小补修：明确active项及其一次性settle归属；成功、替代、失败、断连、超时、队列清除每条路径都必须且只能落定一次，迟到结果不能恢复失效意图。stale重试次数与总动作时限均有界，冲突耗尽诚实显示失败/待用户重试。无回包取消本动作并让队列可恢复，必要时给底层本动作AbortSignal；不得把超时等同服务端从未执行，也不得自动重放可能已提交的预设。保持P1A协议身份/能力门禁。

验收：纯受控transport覆盖stale+新输入替代、断连且无响应、连续stale、永不返回、迟到成功/失败；所有调用方Promise有明确结果，队列不永久占用，重试有上限、不吞异常、不无人值守反复发送。

## C2：设置优先排空不等于用户操作顺序（中）

位置：runActionQueue的“Drain pending settings first”及独立presetQueue。

独立复现用户顺序set80→save→set100，实际发出set80→set100→save。后来的输入越过已经点下的保存，使预设捕获100。当前仅修了“设置在前、预设在后”的单方向，尚未实现首审要求的确定用户操作顺序。

最小补修：预设动作作为有顺序的屏障，连续同字段输入可在屏障前的同一批内合并，不能把屏障后的输入搬到之前；save必须针对其前面已确认的四字段。apply/remove与后续设置同样保持明确顺序，场景/连接变化仍再校验并取消陈旧意图。不要只把UI按钮一直禁用来掩盖已接受的操作。

验收：用真实companion动作队列覆set80→save→set100、apply→set、set→remove→set和跨字段输入；断言实际派发顺序及最终预设四字段，不能只数动作条数。保持简单“拖完再保存”正例。

## C3：pending Map不包含在途项，推送/失败后仍显示未确认值（中）

位置：applySnapshot中的pendingSettings.has保护，以及失败/断连清除路径。

独立复现两种情况：

- brightness100在途、已从Map删除；收到另一端mask60的新快照（brightness仍70），滑块被拉回70。旧revision门禁正确，新revision的跨字段推送仍会覆盖本字段在途编辑。
- brightness100在途，mask66排队；brightness失败后mask动作被aborted-after-failure，但只恢复currKey，mask控件仍66、权威快照为45。看起来修改成功，实际未发送。

最小补修：把当前在途意图与等待意图一起纳入显示协调；其它字段的新快照继续及时显示。取消、失败或断连时恢复所有被取消字段的确认值，聚焦输入的草稿/失焦也有明确恢复路径，不保留伪已确认值。

验收：在途单字段+另一端更新、跨字段失败、聚焦数字输入+断连/失败、队列取消，最终显示与确认快照一致。成功时不得因为保护而永久不接收外部值。

## C4：用户明确要求，QA必须有界落定，不能用强退冒充干净释放（高）

本次现场只读观察：Antigravity同一新对话的Background Tasks保留两条记录，名称是`Run repaired-boundaries unit tests`和更早的`Search RobustCdpClient in repair directory`。UI计数不等于两个进程仍活着；按本轮脚本名称/目录限定的node.exe查询为空。未终止任何用户/助手进程，也未证明任务服务全部清空。需小G核对这两条的命令ID、退出结果及遗留归属，不能仅以新脚本测试通过回答旧后台记录。

两个新浏览器QA确实新增了15/20秒总watchdog，这比完全没有上限好；但交付“所有脚本严格有界且干净释放”仍过度：

- createCdpClient仅监听open/error，缺close-before-open落定与本连接超时。直接抽取原始函数，用FakeSocket先close，两个Promise都不返回。
- `await new Promise(r => { browser.once('exit', r); browser.kill(); })`无阶段期限。signal退出时exitCode可能仍null，旧exit事件已过，再等不会返回；纯EventEmitter负例已复现。
- server.close/本地fetch没有各自期限；process.exit总闹钟绕过finally，可能留下自有browser/profile。rm失败全吞也不能称已清理。单线程总计时器还防不了微任务持续重试。
- 边界测试中只有最后一项声明timeout；不能靠Promise本身或执行器默认等待。几何的saveClickable只检查尺寸，未验证disabled/hit-test/裁剪；文档应称几何检查，避免“可点”过称。

**必须执行的后续规则**：

1. 每次启动前说明本轮预计耗时和总截止时间；短单元探针秒级、浏览器探针通常十几秒内，超过预算就失败并输出卡在哪一步，禁止无状态后台等几分钟、重复轮询旧任务或靠用户提醒停止。
2. CDP connect覆盖open/error/close/timeout一次性落定；request在socket断开时及时reject所有在途项；fetch带可取消时限。不要继续复制没有这些保护的旧工具函数。
3. 对自有进程检查exitCode和signalCode，监听error/exit/close及有界等待；仅按本轮句柄/PID/启动时间处理自有进程。退出未确认则保留profile/证据，记录失败，不能盲删或宣称干净。严禁全局taskkill node/Edge及触碰DSH/WE。
4. 总超时负责中止工作并进入有期限的清理；另有外层watchdog处理事件循环卡死。先记录阶段/归属/失败，再最终非零退出。单独加process.exit(1)不算完成资源归属处理。
5. 先用纯替身覆盖close-before-open、error、timeout、无回包、已信号退出、退出未确认、删除失败，再跑一遍正常短路径；不启动顽固浏览器长测。不盲目重跑旧后台脚本。
6. 完成前核对本轮后台命令结果和测试资源，报告仍未知的记录。后台仅有历史条目应明确“历史失败/取消记录”，不假称仍运行，也不为清空UI删除历史证据。

把规则写入AGENTS以约束后续QA。仅修当前P1B-1三个新QA及它们实际共用的安全工具，不重开A专项或改所有历史脚本。报告明确原始脚本与review保护副本的区别。

## 最小接续

小G补C1–C4，交`docs/DETACHABLE_APPEARANCE_P1B1_SECOND_REPAIR_DELIVERY_20261018.md`及新独立证据目录，完成停下等复审。已过R2权威路径、R4错误反馈和旧版本拒绝保持，不为本轮再扩UI/新功能。fallback缺完整目录信息不能宣称与真实controller百分百等效，文档如实限界即可；实际生产以presetTarget为准。

日常仍DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1；manifest/生产assets仍rc.30。禁止整体打包/安装发布/改日常安装Profile生产assets版本号；不操作退出重开采样DSH/WE、不发DSH模型请求、不杀原WE、不提交推送或清理。定时g保持PAUSED。

后台补充观察：打开Run repaired-boundaries记录后，原对话URL明确为bgtask task-551；Background Task Output命令是node --test .tmp/detachable-p1b1-repair-20261018-b2e1f409/repaired-boundaries.test.mjs，仅显示前11项通过，止于target change用例，未见第12项断连测试及最终汇总。与当前交付磁盘日志12项完整结果不同。此旧任务记录需单独核对结束状态，不凭后来重跑通过认定已结束；未据此宣称当前仍有活进程。

转达记录：22:07已通过computer-use向同一小G新对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次；首段重点转达用户禁止无返回脚本的明确要求及AGENTS新规则，核验新用户消息、输入清空及Working/Cancel，模型保持Gemini 3.8 Flash High。等待C1–C4交付，定时PAUSED。
