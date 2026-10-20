# P1B-2 四审：上轮补修通过，仅剩分级查询的异步边界

2026-10-19，Codex独立复审[三审补修交付](DETACHABLE_APPEARANCE_P1B2_THIRD_REPAIR_DELIVERY_20261019.md)，依据[三审](DETACHABLE_APPEARANCE_P1B2_THIRD_REVIEW_20261019.md)与[分级增补](DETACHABLE_APPEARANCE_P1B2_AGE_FILTER_ADDENDUM_20261019.md)。

**结论：上轮已复现的T1–T3负例及T4证据修正通过；整体暂不通过，只修下文U1/U2。** 新增磁盘分级查询放在已有资源/时间边界之外，且查询await之后沿用旧权限，产生两组可控复现。不是推倒重做图库、播放或分级功能，不新增功能、不进候选/实机。

## 输入与已通过结果

冻结证据：`.tmp/detachable-p1b2-fourth-review-20261019-94e7dd85`。交付SHA-256 `1EE699C0163715043E06986BA56236C5C445DB1EA28088785892DB926891014A`；158项src/qa中相对三审只有6项源码变化：contract、host、catalog、library、client、companion.js。前后源码指纹一致；42项有前快照的受保护assets/tgz一致。详见inputs.json、preservation.json、final-evidence.json。Codex没有编辑生产实现。

| 检查 | 独立结果与范围 |
| --- | --- |
| 冻结npm.cmd run check | 退出0，语法及CSS模板守卫通过，版本仍rc.30 |
| 交付Test 1–4回放 | 4/4，约1.9秒；delivery-replay.log。导入改指冻结src；固定E盘Lucy项目探测跳过，其真实元数据来源仍只引用G交付，不冒称本轮重读 |
| P0/P1A回归 | 20/20，约1.6秒，baseline-tests.log，12秒外层硬限 |
| 三审独立真实库/HTTP负例改为修复断言 | 32种分级/unknown组合通过；在途策略收紧403、磁盘改Mature未refresh的旧索引请求403且新增图片读取0、读图期间refresh改Mature后403、损坏Mature+garbage回Everyone及协议拒绝全部通过；age-route-probes.mjs/log、age-route-observations.json |
| 三审独立companion竞态改为修复断言 | pending-only取消signal.aborted=true；再放宽发起新fetch，旧结果不建URL；目录刷新旧结果不建URL，旧finally未删除同ID新登记；delivery-qa/age-ui-probes.mjs、age-ui-probes.log |
| 真实隔离Edge headless/React/生产认证桥接/库/HTTP | 3项通过，约2.7秒；delivery-qa/real-browser.mjs/log及observations。Everyone默认2张真实解码width1、错误0；全不选图片/卡片/新增读0；显式Mature无害1x1夹具3张真实解码。自有进程退出、server及host关闭，profile保留 |
| 新增异步边界定向复现 | U1一项、U2三项成功复现；async-rating-probes.mjs/log及async-rating-observations.json，约4秒，7.2秒软限/10秒独立外层硬限；所有延迟IO释放、Host关闭 |

T4已去掉手填naturalWidth和useState假blob。真实解码由实际浏览器提供；VM/MockDOM只证明判断和IO调用，不当成浏览器证据。无用户成人图片读取，分级测试只用无害小图和临时metadata。首次独立路由重放使用15ms固定等待未等到新磁盘查询完成，测试自身失败；已改为有界入场屏障再重跑通过，没有据此归咎产品。

## U1 / P1：分级查询不受原超时及并发限制

位置：`src/detachable-host.js:1026`首次await在1056行并发检查和1061行占位、1069附近超时创建之前；1113行第二次await在`Promise.race([underlyingReadPromise, timeoutPromise])`已结束后。1078行的占位释放只绑定getPreview，未覆盖第二次分级IO。

**复现证据：** 使用真实临时library与实际Host路由，仅在resolvePreviewRating的IO完成边界延迟；发9个合法认证GET。3.26秒时9个metadata查询都已进入，9个HTTP均未结束。释放后8个200、1个503，说明503门禁是在9个磁盘查询已进入之后才执行。当前3秒timeout对首次查询无效；第二次查询也不参与正在等待的race，不能因计时器触发就终结该await。该试验未证明真实磁盘必然挂起，只证明实现没有所声明的边界，慢盘/异常IO会绕过原防挂保护。

**最小补修：** 将首次metadata验证、图片读取、最终metadata复核放进同一个有界请求生命周期，资源并发门禁在首次IO前生效；HTTP总期限覆盖每个await。底层不响应Abort时HTTP也须按期结束，但占位保留到实际IO最终落定，避免反复超时释放后再进入无限IO。取消/断开/超时后不得继续启动下一段图片IO或迟到写200。不要只给每段重新计满3秒，不用裸process.exit冒充清理。

**验收：** 首次和最终metadata各一例永不落定/迟到落定，HTTP均有界失败；第9个请求不进入底层metadata/图片IO；超时后旧IO未结束不能提前释放占位；释放自有延迟IO后槽位恢复，合法图片200。保留隐藏分级图片读取0、格式/路径/认证等既有门禁。

## U2 / P1：新增await之后仍使用查询前的权限/会话

位置：1021行allowedRatings在首次metadata await之前采样；1090–1104行会话核对、1109行settledAllowedRatings在1113行最终metadata await之前完成；1127行发送200之前没有重新读取/验证。

实际Host+真实library+无害Mature夹具，仅延迟metadata IO完成，独立复现三例：

1. **首次查询中取消Mature：** 初始允许Mature，首次查询挂起→权威偏好改Everyone→释放查询。HTTP最终403，但getPreview已经执行1次，图片字节在取消后仍读了。预期读前重新授权，图片读取0。
2. **最终查询中取消Mature：** 图片已准备，最终metadata查询挂起→权威偏好改Everyone→释放，响应仍200；应403且不发送图片字节。
3. **最终查询中替换主端：** 最终查询挂起→真实/api/main/connect登记不同instance→释放，旧认证请求仍200；应403会话失效。三审原先“图片IO期间替换”的负例依旧通过，但新await又在它后面打开了竞态窗口。

**最小补修：** 每次await之后、下一步图片IO或写响应之前，都核对当前会话、代次/lease、当前权威规范化允许列表及取消/期限状态。最终IO全部完成后再取当前权威设置与会话，最终验证到writeHead/end间不再插异步等待。首次metadata验证后不得沿用await前的allowedRatings启动图片IO。metadata失败/未知维持拒绝，不能用旧可信值绕过。

**验收：** 上述三例分别是403且图片读取0、403且无图片响应、403会话失效；正常授权完整读图仍200，合法空集/32组合/已有T1–T3及共享请求保持。无需重跑无关历史长矩阵或新造UI平台。

## 交付与边界

只补U1/U2，交付`docs/DETACHABLE_APPEARANCE_P1B2_FOURTH_REPAIR_DELIVERY_20261019.md`后停下。列真实源/QA指纹、结果/退出码、阶段与总期限、自有资源清理。可直接复用本轮独立复现脚本改成修复断言，保留已审safe-qa-runner（SHA-256 0128591FA1C8115FEA2B4ACAF83D98E3BBB2306D284E6BE95E5EC9B17B34B66A）。禁止无限等待、后台脚本无截止或等待用户提醒停止。正常功能与上轮T1–T4成果不返工。

日常DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1不动；manifest/生产assets仍rc.30，不整体打包、安装发布、改版本/Profile，不操作日常DSH/WE或发模型请求，不提交推送清理。原脏改动保留，A低优先级、三体/GPU暂缓、定时PAUSED。独立系统窗/吸附与候选整合仍未实机验收。

转达记录：已向Antigravity原对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次U1/U2最小补修；只读核验新用户消息、输入清空、Working/Cancel，Gemini 3.8 Flash High不变。未恢复自动轮询或定时。
