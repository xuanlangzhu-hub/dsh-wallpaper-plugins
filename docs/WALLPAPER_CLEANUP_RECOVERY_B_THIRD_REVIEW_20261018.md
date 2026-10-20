# 日常壁纸清理恢复B三审：默认恢复入口仍未接通

日期：2026-10-18。审查[二审补修交付](WALLPAPER_CLEANUP_RECOVERY_B_SECOND_REPAIR_DELIVERY_20261018.md)及实际源码。**暂不通过；只补T1–T3及必要QA，再审B，暂不转滚动A。**

已经闭合的部分保持：normalizeWindow不再丢弃已有的startUtc；已启动动作分支的六个布尔字段严格检查；早期无日志不再自动放行；正常Summary及多数恢复保护路径通过。新增缺基线保护是正确的安全边界，但不能替代实际可用的恢复入口。

## 独立证据与检查

本轮证据目录：`.tmp/wallpaper-cleanup-b-third-review-20261018-bdace015`。核实小G本轮已结束、输入为空且无Working后冻结源码/QA/报告及rc.35副本，指纹见`inputs.json`。未修改实现，全部进程/helper动作均为底层IO替身，未运行真实PowerShell或日常应用操作。

- 工作区session.js：`001356F3287372A68E85FB0AF43E38B1914F6613309EECEA52042C4086996933`；managed-window.js：`703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A`。
- 对应rc.35修复session.js：`1969D4A166D6F62F6D8078B0AF028F965C7FD96D366630DC40768924A6484688`。
- `npm run check`、Host JS108/108通过。冻结QA副本仅调整硬编码F:\out到本轮目录，外部查询由offline-guard阻断，未跑原生CLI整套实机检查。
- 小G工作区探针、对应rc.35探针及两种事故数据回放均在offline-guard下通过，见`delivery-probes.log`、`rc35-probes.log`、`rc35-replay.log`。这些通过只覆盖替身实际提供的协议。
- `third-probes.mjs/json`分别对工作区与对应rc.35各跑12项，共24项：3项时间比较、9项完整session。退出0表示当前缺口及保护对照均被复现，补修验收须反转危险预期。
- 对照P1A十审161项原输入，仅managed-window.js/session.js变化；59项生产资产/归档保持，见`preservation.json`。不重跑无关P1A界面矩阵。

## T1（P1，原W1功能仍未完成）：当前真实rc.35仍没有任何可用的创建身份来源

`normalizeWindow`现在能保留传入字段，但真实`SourceWindowHelper.WindowState`仍不提供startUtc，源码也没有其它默认基线取得入口。于是`windowStartUtc`仍为null，重试总是得到`missing expected creation identity baseline for window`。报告已诚实声明“若未来引入提供StartUtc的helper”，但**原任务是实现缺Summary后的可信恢复，不是把所有真实恢复永久拒绝**。

独立`real-native-window-shape`按现有真实window-find形状返回hwnd/pid/title/visible，不虚构startUtc；提供正确的本轮action、查询确认没有capture/worker存活后，二次和三次stop仍closed=false、源窗核验0次。对照`valid-extended-helper-control`仅给替身增加startUtc即能closed=true。工作区和rc.35整合版结果一致，证明成功路径依赖未交付接口。

补修：完成一个**默认实际可调用**的可信本轮创建身份取得/绑定入口，再贯通session、独立核验及路由恢复。不要求现在安装或实机操作；可以使用有界的只读进程身份接口（在实际取得windowPid后绑定本轮身份，底层IO可注入），也可在隔离目录实现必要原生协议并编译/自测；若需要新原生能力，必须交付源码与离线产物/协议证据，明确二进制尚未进入生产assets。不能继续只在fixture的window-find中增加真实helper没有的字段。

缺身份时继续保留锁正确；同时必须证明真实默认协议对应的合法条件恢复后能完成关窗确认、路由status清错、释放session并允许新start。若选择新helper方案，说明旧rc.35不支持，以及将来独立整合的准确输入，不把当前rc.35替身回放写成已具备该能力。

## T2（P1，原W1时间契约）：小数秒缺省仍会放行不同创建身份

`areStartUtcsEquivalent`仅在两边frac都非空时比较小数；一边没有小数会跳过。Date.parse又只保留毫秒，导致：

| 期望值 | 动作报告值 | 实际 |
| --- | --- | --- |
| `2026-10-17T09:20:20.0005000Z` | `2026-10-17T09:20:20Z` | equivalent=true；完整session二次stop关窗1次、closed=true |
| `2026-10-17T09:20:20.0000000Z` | `2026-10-17T09:20:20Z` | equivalent=true，合法等值对照 |

前一项相差500微秒，不是表示等价。缺小数必须按零规范化并参与比较，不能当作任意小数通配符；超出协议可表示精度不能静默丢弃。不得添加时间差宽限。

还有日历有效性：`parseIsoStartUtc('2026-02-30T09:20:20Z')`当前成功，Date.parse把它归一化到3月2日；与合法`2026-03-02T09:20:20Z`判等，完整session同样关窗释锁。补修应按实际接口支持的ISO格式严格验证日期/时间/时区与精度，再比较同一物理时刻，拒绝不可能日期。保留时区等值、零补齐和合法原生7位小数正例。

## T3（P1，原W2/W3）：未启动分支重新引入缺字段及冲突放行

普通已启动分支对pending字符串等已拒绝，保持。新`stopped-before-action`分支却允许action/trigger为undefined；对action.started只拒绝布尔true，未要求明确false，也没有检查互相冲突的退出/超时/终止状态。

独立完整session证明（工作区、rc.35均一致）：

- `stage:'stopped-before-action'`，**删除action和trigger字段**：二次stop closed=true，关窗1次。
- 同stage，`action:{started:'true', exited:false, cleanupSafe:true, pending:false, timedOut:true, terminated:true}`、trigger:null：二次stop closed=true，关窗1次。
- 合法`action:null, trigger:null`对照也通过；这条合法未启动协议应保留。

补修：按真实原生协议区分“显式null、确实从未动作”和“字段缺失/损坏/启动过或状态冲突”。不要将undefined当作显式null，不要把started非true当作false。若允许另一种action对象形状，必须证明该形状确实由原生协议产生，并校验其全部必要字段/组合；不能把已启动分支坏字段藏到未启动stage后放行。身份/代次和当前资源核验仍是前置条件，早期armed/observing记录继续拒绝。

## QA与交付说明

底层IO替身遗漏已修，本轮三个交付脚本均可在offline-guard下运行。计时器/监听器现在有状态断言，是进展。但PART4仍是直接创建session1/session2，未调用`registerWallpaperRoutes`；迟到字节在第二轮创建之前发送；`rep2.diagnostics.failure ?? null`不是report真实顶层failure。报告不要称此为“跨轮路由验证”。请在T1的路由恢复用例中补上第二轮活跃期间旧轮迟到事件、正确顶层错误/当前session及generation断言，或明确收窄现有测试名称及覆盖范围。`stats()`中stdout/stderr计数应指向各自流，不能都读child.listenerCount('data')。

后续独立rc.35/协议整合证据使用新目录，不覆盖`.tmp/wallpaper-cleanup-b-repaired-rc35-20261018`的既有版本；本轮已另行冻结，仍需保持历史可追溯。

下一份报告：`docs/WALLPAPER_CLEANUP_RECOVERY_B_THIRD_REPAIR_DELIVERY_20261018.md`。先说明选定的真实默认身份来源、旧rc.35兼容性及是否需新原生能力，再做T1–T3最小补修与完整负例。不是再放宽门禁，也不是为通过检查只改替身。完成后等Codex复审，不自动转滚动A。

本轮用户授权自动巡检直接交接小G；不安装/发布/操作或重启日常DSH/WE，不改安装目录/Profile/生产assets/版本号，不提交推送或清理。P1A已通过成果保持，第一次断流原因仍未知。

转达记录：T1–T3及QA余项已发送到Antigravity原“DeepSeek Harness 插件项目交接”对话，复核新用户消息、输入框清空及Working/Cancel。等待第三轮补修报告，未转滚动A。
