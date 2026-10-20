# 可分离/吸附外观设置 P0 首轮复审与补修要求

2026-10-17，Codex。复审对象：[小G交付](DETACHABLE_APPEARANCE_P0_DELIVERY_20261017.md)、`src/detachable-bridge.js`、`client.js` 新增设置订阅、P0 QA及package脚本。以[原P0任务](GEMINI_NEXT_DETACHABLE_APPEARANCE_P0_20261017.md)为验收范围。

**结论：暂不通过，先补下面六组问题，再复审P0；暂不扩完整P1 UI。** Edge应用模式可保留为候选方向，`shell.overlay`吸附视图与唯一controller方向成立，但当前证明停留在Node内存模拟。没有完成浏览器/Host执行边界和失效会话、异步清理、消息时序的最低证明。

本轮只做源码/文档复核、Node模拟及独立临时profile的headless浏览器QA。未查询或操作真实DSH/WE，未启动真实伴随窗口，未安装、打包、提交、推送或清理。用户继续使用日常rc.34；工作区manifest/assets仍rc.30冻结。

## 已通过的检查及其限度

独立证据目录：`.tmp/detachable-appearance-p0-review-20261017-56e57c38`，含本轮冻结源码、QA、输入指纹和原始输出。

| 复跑 | 结果 | 限度 |
| --- | --- | --- |
| `npm run check` | 退出0 | 语法/CSS守卫，不证明浏览器能导入Node模块 |
| 冻结P0测试 `node --test .../frozen/qa/detachable-appearance-p0.test.mjs` | 10/10，退出0 | mock controller与内存transport；未覆盖下述负例 |
| 冻结 `appearance-regression.mjs` | 570，退出0 | 实际client/controller + React stub；不是实际React双视图挂载 |
| 同上 `--english-suite` | 566，退出0 | 同上 |
| 同上 `--scene-selection-only` | 退出0，正对照启动1次，改选启动0次 | 保留已有自动播放取消门禁 |

本轮没有机械复跑未受影响的配对/临时Profile套件；交付中的8/11项仍是小G自测记录。上述通过不等于当前桥安全/生命周期通过，也不等于真实开窗、跨屏和吸附验收。

补充脚本 `reproduce.mjs` 的12组**现状缺陷复现断言**全部成立，退出0，结果见 `reproduction-results.json`；这里的“通过”表示复现了缺陷，不是验收通过。`frozen/qa/p0-browser-review.mjs --p0-review-probe`检查实际controller与浏览器加载，结果见`browser-probe.log`。

## R1 [P1] 动作未绑定当前已认证连接，旧窗口仍有写权限

位置：`detachable-bridge.js:346–396`，尤其369行回调与382行入口。

`handleCompanionAction`只校验instanceId，既不验证已成功握手、当前transport/会话租约，也不检查token。握手消费一次token本身不够：旧transport注册的闭包仍然持有同一个instanceId，关闭/吸附后未撤销。

本轮复现：

- **从未弹出或握手**，传当前instanceId与错误token，亮度70→90，返回成功。
- 正常连接A→吸附→弹出并连接B；从A已关闭transport发送新动作，亮度仍被改成100。
- `null`动作在schema校验前读取`clientActionId`，直接抛TypeError，而不是受控拒绝。

这证明当前接缝本身未建立授权边界；尚无实际HTTP端点，因此不扩称已经存在外部可利用的网络漏洞。

补修：握手后发放/绑定当前实例与弹出代次的连接能力；所有动作必须经过该有效连接，关闭、断线、替换、卸载立即失效并解绑回调。不能把公开instanceId当凭据，也不能靠mockTransport自己不送消息掩盖桥的缺口。先校验载荷对象/协议字段再访问和去重；缺失/失效租约、旧连接、错误实例、空动作均需负例。真正HTTP/origin边界见R6。

## R2 [P1] 异步弹出/吸附缺少代次与资源所有权，清理失败被吞掉

位置：`detachable-bridge.js:277–340,443–477`，以及`buildEdgeAppLaunchSpec`的可选profileDir。

复现：

- `requestDock()`等待旧窗口close时，又允许`requestDetach()`：产生第二次spawn与新token；旧close随后完成，把新一轮清成docked/token=null。
- A关闭后，新一轮正在detaching且尚未连接，此时A的迟到disconnect仍可清掉新token并切回docked（444行在active transport为空时放过旧回调）。
- adapter.close抛错，仍返回`{ok:true,mode:'docked'}`。
- spawn尚未完成时dispose；spawn后来完成，requestDetach仍返回ok。当前dispose也没有等待/处理异步close的Promise rejection（同步try/catch抓不到），不能据此声称无孤儿残留。
- 默认启动spec没有`--user-data-dir`。未强制独立profile，不能建立“本轮伴随窗口/进程”的隔离与关闭契约；不能日后按msedge进程名盲关。

补修：为每轮窗口/连接建立明确generation及owned handle，串行化或明确取消切换；每个await返回后核对当前意图/代次/是否disposed。迟到spawn成功也必须清理它自己拥有的资源；旧回调不得作用新一轮。清理异常/未知要可见、可重试，不先声称已吸附清理完。dispose给出可等待清理结果并处理所有异步拒绝。启动前强制独立且归属明确的临时profile，正常关闭仅作用本轮资源。用deferred adapter覆盖启动中取消、关闭中再弹出、双击、失败、卸载及旧disconnect，仍不得启动真实窗口。

## R3 [P1] revision规则仍允许旧写覆盖新值，客户端接受倒序快照

位置：`detachable-bridge.js:388–408,500–519,532–543`。

复现：主端把亮度改为110、revision=2后，客户端携带expectedRevision=1写60，仍成功覆盖；expectedRevision=999999也成功。缺失或非整数revision同样绕过检查。`revision-5`阈值不是可靠冲突判定。伴随端依次收到revision4、2后，当前快照退回2；connect的迟到结果和disconnect后的回调也没有代次守卫。

补修：明确冲突策略（严格匹配，或有证据的按字段/动作合并），不能笼统允许旧五个版本覆盖；缺失/非法/未来revision受控拒绝并返回最新确认快照。伴随端按实例/连接代次及单调revision接收，失联后禁写，迟到握手/快照不能复活旧连接。拒绝时能同步最新权威状态。去重需绑定有效会话，缓存动作指纹及原结果；同ID不同载荷拒绝，不能把以前失败的动作重试返回“成功重复”。补落后一版、未来、缺失、倒序、重连和结果重放的负例。

## R4 [P1] 业务拒绝被包装成成功，关闭动作也未等待结果

位置：`detachable-bridge.js:411–437`。

复现：controller.presets.apply返回`{ok:false,error:'preset-missing'}`，桥却返回`{ok:true,result:{ok:false,...}}`。实际controller还会因transition、cleanup-failed、mismatch、scene-unconfirmed、storage-failed等拒绝；这些已有R1/R2门禁不能被新UI用外层ok误判。optional chaining造成方法缺失也可报告成功；controller抛错则直接逃出。request-dock/close-window发起async操作便立即ok，与R2清理失败叠加。

补修：统一动作确认协议，区分受理/完成与失败，不把业务失败扁平化为成功；异常、缺失能力和持久化失败均有受控结果。去重返回同一次真实结果，异步吸附/关闭最终状态可确认。用真实controller补预设门禁负例，断言配置/预设没变、UI不会报“已应用”。不要放宽原有预设/清理门禁以让桥测试通过。

## R5 [P2] 设置/播放快照与schema仍不符合真实controller契约

位置：`client.js:4559–4567,4757`；`detachable-bridge.js:31–65,142–152,243–258`。

| 问题 | 本轮证据与影响 |
| --- | --- |
| 同值仍重新分配快照/通知 | 实际controller同值set发出1次通知且对象引用变化；订阅者回写同值的有界探针连续触发4次。现有“稳定”仅保证两次读取间无写调用，未满足P0同值不循环要求 |
| 播放状态不订阅 | 模拟controller通过正式subscribeStatus事件从playing切到cleanup-failed/cleanupPending=true，桥仍缓存playing/false。会让视图状态与预设按钮门禁信息过时；实际执行业务门禁应继续保留 |
| 范围/scene规则漂移 | 桥接受blur30、surface0、`we-`后25个z；实际controller分别规范到24、40，拒绝该scene。真实ID规则为小写hex24位，不是大小写不敏感a-z0-9的24–32位 |
| 所谓“全字段往返”不全 | 桥白名单缺canvas/sidebar/glass/motion/opaqueSidebar，现有10项测试使用无生产规范化的mock，不足以证明原控件迁移 |

补修：规范化后比较有效设置，真正变化才更新稳定快照/通知；保留自动播放取消等手动意图计数语义，不要简单在set开头return而破坏既有门禁。订阅并卸载wallpaper.subscribeStatus，包含必要的cleanup/transition状态。单一schema或契约对照覆盖真实字段、合法枚举、规范化数值、scene语法、opaqueChat/chatBackdrop兼容关系；若有意只支持子集，明确哪些控件暂不迁移，不能称全量。用实际controller补同值/别名/边界检查；P1再做真实React双视图，不能将stub当作已挂载React证明。

## R6 [P1] 浏览器/Host接缝尚未落地，路线报告的成本和能力有未证实断言

位置：`detachable-bridge.js:17`（Node crypto import），`createDetachableBridge`与`createCompanionClient`；交付报告路线比较与P1计划。

同一模块顶层`import {randomUUID} from 'node:crypto'`，却声明同时运行在主DSH renderer和Edge伴随窗口；两者均不能直接使用Node内置模块。独立浏览器通过HTTP导入冻结模块失败（browser-probe.log）；Node语法检查与Node mock import成功不能证明浏览器可用。现有bridge只接受直接传入的controller，实际controller在renderer，Host在另一进程；尚无renderer→Host→companion的实际适配证明。新增文件也未进入package files allowlist，现状只是未接入的源码模块。

P0不要求提前交完整服务/真实开窗，但需补：

1. 拆出浏览器可加载的契约/客户端与Node专属启动部分，明确模块加载/打包方式和生产允许文件；不能加载第二套Whale apply来取得controller。
2. 依据现有正式ctx/webServer与renderer访问方式，列出具体路由/注入/消息路径、主controller唯一执行点。用假Host+实际浏览器模块做最小一次往返及主实例失联证明；无需完整UI、无需真实DSH或伴随窗口。
3. 明确DSH原origin、伴随页面origin、认证发放/一次握手/连接租约撤销、页面和写端点访问控制、仅loopback绑定及端口冲突策略；有错误origin/缺认证负例。不可拿DSH完整认证URL或账户凭据给伴随页。不能只写“SSE/WebSocket待P1”来代替边界证明。
4. 依赖探测、Edge路径与版本、缺失时降级/报错、profile/进程所有权、正常关闭及失败报告要具体；零新安装只能是本机已有依赖满足的条件结论。未实测时删除“额外30–50MB”“100%复用”“完整DPI/独立图标已经成立”等保证，列为待验/复用目标。参数数组生成不等于已证明spawn禁shell；明确调用契约shell:false、受控可执行文件，离线测试该调用边界。

官方调查文档顺手纠正：所查主产品页window.open被deny可保留，不扩称所有WebContentsView一律如此；preload是browser.acquire/release/onOpenRequested，不是browser.open；PLATFORM_IPC仅允许`usage`/`top-up`，不是`/top_up`。这几处是报告准确性问题，不能反向当作可借用的新窗接口。

## 小G本轮补修与交付边界

先修R1–R6并扩QA，更新原交付报告说明哪些已证实、哪些仍候选。继续保持唯一controller、按钮弹出/吸附、`shell.overlay`，不抢single rightbar；不恢复三体/性能专项。保留旧自测与本次失败证据，新补修证据另开目录，不覆盖固定包。

允许修改本P0相关源码/测试/文档及必要的小型假Host/browser接缝；先避免大规模完整UI迁移。不得操作真实DSH/WE、开真实伴随窗口、安装运行时、改官方文件或打整个含Trace工作区。没有新增实机授权。本报告由用户转交，不自动给其它会话发消息。

补修后再交Codex复审；P0通过才进入完整P1，再另约真实独立窗口/移动/吸附验收。本轮现有570/566与场景选择回归通过保持为证据，不能据此提前批准新桥。
