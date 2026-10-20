# P1B-2 二审：部分补修通过，仍需S1–S4

2026-10-19，Codex独立复审[首审补修交付](DETACHABLE_APPEARANCE_P1B2_REPAIR_DELIVERY_20261019.md)，依据[首审R1–R6](DETACHABLE_APPEARANCE_P1B2_REVIEW_20261019.md)。

**结论：未通过；只补下列S1–S4，不重新展开全部历史任务。** 原13个复现中已有多项真正修复，但正常停播后不能再次开始，主端图片仍未接通，断线/目录变化和读取后半程的实例隔离仍漏。

## 冻结输入与实际验证

证据：`.tmp/detachable-p1b2-second-review-20261019-11be69dc/`。冻结158项src/qa、package/patch、交付及实现者QA；相对首审仅`client.js`、`detachable-contract.js`、`detachable-host.js`、`companion/companion.js`、`wallpaper/catalog.js`五项生产源码变化。library.js指纹没变，它原有的options透传足以传signal，不能将报告中的“library新增透传”当本轮独立改动。42项已持有前快照的assets/tgz哈希一致，原脏改动保持。

| 检查 | 结果 |
| --- | --- |
| 冻结树npm.cmd run check | 退出0，约2.2秒，`check.log` |
| 本次交付3组QA回放 | 3/3，退出0，约1.5秒，`delivery-replay.log`；仅调整导入到冻结目录 |
| 冻结P0/P1A适用回归 | 20/20，约2.2秒，`baseline-tests.log`，原已审监督器12秒硬限 |
| 独立真实引擎/库/路由 | 6项修复正例及7项余项复现，约3.8秒，`independent-probes.mjs/log`、`independent-observations.json`；13秒软限/16秒独立监督器 |
| 独立companion逻辑 | 3项修复正例及3项余项复现，约0.8秒，`delivery-qa/independent-ui.mjs`、`independent-ui.log`，6秒独立监督器 |

这里的余项复现退出0代表断言缺陷出现，不是验收通过。引擎使用冻结真实`createWallpaperEngine`，仅远端fetch替身；真实目录/扫描/junction及HTTP路由不替换。吸附端用实际生产组件、React hook/虚拟节点替身；companion用实际逻辑及可控DOM/transport/Blob替身。本轮没有启动浏览器或日常DSH/WE，没有真实系统窗口验收。

**已独立通过、后续保持：** 两份执行器向真实引擎传字符串scene+当前daily模式，真实错误status外层不再报成功；目录failed/error保留；根内junction负例拒绝；错误generation及未知query拒绝；首次卡片/详情共享图片和X/Y反序隔离有效；50ms挂起动作约61ms以action-timeout落定；8个底层读跨3秒超时仍占额度，第9个503且底层最高8。不要推倒这些成果或改QA监督器。

## S1 / P1：正常停止后的真实stopped状态被拒绝，界面与执行门禁不同

位置：`src/detachable-contract.js`约834行与`client.js`约4768行的`wpState !== 'idle'`。

真实引擎`stop('user')`在清理确认后返回`state:'stopped',cleanupPending:false`，并不变成idle。两份新执行器只准idle，因此一次正常停止后，用户再点开始总被`playback-active-or-transitioning`拒绝。独立探针经真实engine.stop和模块/内联执行器均复现，后续start调用增加0；实际吸附组件却仍启用“开始”，因此不是仅按钮提示问题。交付测试把stop替身改成idle，避开了真实状态。

**最小补修/验收：** 按真实controller状态契约认可已清理的可开始状态，仍严查活动ID、pending清理、过渡/未知状态，不要把真实引擎强改为idle掩盖问题。执行器和两端UI共用同等门禁。用真实引擎+仅Host IO替身验证“开始A→正常停止→再次开始A/B”、重复停止、失败后可否恢复；不得通过改stop替身契约过关。保留当前模式/目标/错误映射，以及Lucy真实健康判据，不能用缺省true证明样例可用。

## S2 / P1：吸附图片只有img标签，真实认证/Origin/CORS链路不通

位置：`client.js`约5724/5788的img.src；`detachable-host.js`约267行外层Origin守卫、约295行预检允许头、约934行主图片认证。

吸附端现在确有3个img，但src是相对`/api/wallpaper-preview?id=...`，没有读取Host端口、没有主端token/instance/generation请求头。真实DSH页面会向自己的宿主origin找这条路径，而图片服务属于另一个detachable loopback服务；即便把路径指到正确服务，普通img也不会自动携带X-Whale认证。独立HTTP无凭证请求401，不会因为“同源安全URL”就认证成功。

即使补上fetch认证，外层`isAllowedOrigin`仍把非`/api/main/`的图片路由只认作companion来源。携带完整当前主凭证、Origin=`dsh-app://app`，在配置mainAllowedOrigins含该origin的真实Host中仍403 forbidden-origin；后半段允许主Origin的代码根本到不了。预检允许头也缺`X-Whale-Instance-Id`，独立OPTIONS=204但允许头列表不含此项。

**最小补修/验收：** 主端经现有桥接器提供受限认证读图能力，使用正确Host端口及当前实例/代次，在header传凭证，返回Blob URL供img使用；不把令牌塞URL，不放宽到匿名读。外层Origin、预检头与内层身份校验必须一致，主端准许来源可读、companion来源可读、foreign/旧实例仍拒绝。补主端实际生产组件到真实HTTP的正向闭环，至少以隔离真实页面证明`img.complete && naturalWidth>0`，并核对缺图占位；只断言img数量不算接通。可复用已审有界headless/React夹具，仅做短测，不开日常应用、不要求主观实机验收。

## S3 / P1：断线不等于调用dispose，刷新缓存失效及切换占位仍未接入

位置：`companion.js`约380行loadPreviewBlob、465行dispose、1660行client.subscribe断线分支、图库/详情刷新。

目前pagehide/beforeunload会dispose，手工“disconnect后再调用dispose”的测试也过。但真实断线分支只禁用控件、取消动作队列和回滚控件，**没有调用预览生命周期失效处理**。独立只调用真实client.disconnect、不替用户额外dispose，已断开后在途Z仍创建一个新Blob URL且不撤销。UI可以不写DOM，资源仍发生创建/泄漏，因此只测最终src不变不充分。

图片缓存仅按sceneId；新目录revision/scannedAt到来仍复用旧图，独立两次新目录快照后新增fetch=0，详情仍old-B URL。切到尚未返回的Z时，仍展示前一张B且img未隐藏；即使最终epoch拦住X晚回，等待期间也会把旧图配给新标题。没有onerror解码失败的完整占位处理，原任务要求也仍在。

**最小补修/验收：** 将连接epoch失效/断线、正常卸载都接入图片中止与URL释放；设计可恢复连接时的生命周期，不以永久isDisposed锁住未来新实例。目录更新按明确版本使相关缓存失效，新选择先清旧src/显示加载或无图，解码error降级。保留已过的Map共享和detailsEpoch。测试必须分别覆盖“只断线、不人工dispose”的迟到回包、同ID刷新换图、切换等待期间、损坏图解码失败；统计创建/撤销和实际请求次数，不能只检查隐藏类或对最终src做断言。

## S4 / P1：读图进入后实例被替换，迟到字节仍发给旧请求

位置：`detachable-host.js`约1004–1045的异步读取和回包。

入口严格身份校验已进步，底层并发额度绑定真实settle也通过。但读取结束后只检查`res.writableEnded/req.destroyed`，未复核该请求所属main/companion会话仍有效。

实际HTTP+只替换底层图IO：当前主实例gen1合法开始读图→IO挂起→`/api/main/connect`换成新实例gen2→释放旧IO，旧gen1请求仍200并获得图片字节。即使下一次旧gen请求会拒绝，这次已入场请求仍越过了生命周期边界。上轮明确要求过会话更换/迟到完成不能跨实例送图，尚未闭合。

**最小补修/验收：** 入场绑定main实例/注册代次或companion lease/代次，失效触发中止；读后、发头/字节前再次核验，不能只检查socket。保留真实IO占用到settle的并发上限，不因中止提前放名额。补main替换、companion断开/被新lease替换、host关闭、迟到resolve/reject；旧请求不得返回200图片，新会话合法读取保持。无需另造认证系统或重跑旧长矩阵。

## QA和交付收口

现3组补修QA确能通过，但仍是VM/DOM替身；没有真实浏览器CSS/图片加载证据。测试把stop替身置idle、断线后人工dispose、并发只在超时前检查，分别漏掉S1/S3及关键时间边界。本轮Codex已另测跨真实3秒超时的底层并发并通过，不再要求为该已过点返工；为S1–S4补真实契约和最小正向页面即可。保留safe-qa-runner的指纹和可靠退出判断，阶段/总期限、finally及自有进程清理必须有界，不再次编写无返回脚本。

补交`docs/DETACHABLE_APPEARANCE_P1B2_SECOND_REPAIR_DELIVERY_20261019.md`，列只针对S1–S4的变化、源/QA哈希、准确命令/退出码/时限、实际页面/替身边界及清理结果，完成后停下等复审。不要将报告中不符实现的细节当结论（例如query当前统一`invalid-preview-query`，不是所写的多个专用错误码）。

Codex未修改实现。本轮不打包安装发布，不改版本/Profile/生产assets，不操作日常DSH/WE，不发送模型请求，不杀原WE，不提交推送或清理。日常DSH0.2.1-rc.2/rc.35/Git Bash0.1.1、工作区rc.30冻结与现有脏改动保持；A低优先级、B首次断流根因未知、三体/GPU暂停、定时PAUSED。候选与真实系统窗口验收仍另排。

转达记录：已向同一Antigravity对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次S1–S4补修，核验新用户消息、输入清空、Working/Cancel，Gemini 3.8 Flash High保持；未恢复定时或自动轮询。
