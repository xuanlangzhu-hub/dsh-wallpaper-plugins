# 可分离/吸附外观设置P0六审：G2闭合，保留两处排队执行前核对余项

2026-10-17，Codex。对照[五审](DETACHABLE_APPEARANCE_P0_FIFTH_REVIEW_20261017.md)，复审[五审补修交付](DETACHABLE_APPEARANCE_P0_FIFTH_REPAIR_DELIVERY_20261017.md)。

**结论：暂不通过，只补H1/H2两个排队边界。** 同ID旧代次的直接请求拒绝、B注册不再覆盖C、窗口动作必填字段校验，以及G2权威模式/失败重试均有进展，不重做已通过部分。升级准备已独立进行，见[DSH rc.2升级准备](DSH_021_RC2_UPGRADE_PREPARATION_20261017.md)；当前日常rc.34不含开发P0。

## 本轮证据与通过范围

独立目录：`.tmp/detachable-appearance-p0-sixth-review-20261017-a7fc57b6`。冻结当轮src/QA/scripts/package和交付，检查在冻结副本运行：

- `npm run check`：退出0。
- P0专项：14/14，退出0，包含新增Test14。
- 实际headless Edge双Tab：11项主流程，退出0，spawn=3、close=3。
- `frozen/qa/close-failure-sixth-review.mjs`：实际浏览器、真实外观controller、HTTP/SSE；握手后主端为detached；close抛错后主端与Host均为docking，主端保留unconfirmed/error；关闭重试成功才转docked、清空门禁和错误。G2本轮闭合。详见`close-failure-browser.log`。
- client.js及外观harness/QA与五审输入一致，见`prior-regression-input-comparison.json`；沿用570/566/场景选择等既有证据。未把交付摘要的“118项”当作新一轮完整外观验收计数，也未机械重跑外观矩阵。
- `queue-boundary-probes.mjs`、日志及`queue-boundary-results.json`记录下述两处HTTP复现。退出0表示探针执行完成，不表示两处缺陷通过。

## H1 [P1，G1余项] 主端disconnect入队前合法，出队时会注销新注册主端

位置：`dsh-whale-mist/src/detachable-host.js:569`。`verifyMainRequest`在入队前校验generation；`executeTransition`内部直接操作当时的全局mainSession，没有捕获并复核请求原主端的注册代次。

确定性顺序：

1. A注册，开始detach；adapter.spawn由探针闸门暂缓。
2. A的合法disconnect进入窗口队列，等待spawn结束。
3. B注册使A注销并等待清理；随后C注册成功，generation=2，当前主端确认为C。
4. 释放A的spawn；**旧A的disconnect出队后注销C，返回200/ok，最终mainSession=null**。
5. B此时正确返回409/registration-superseded。B不覆盖C已修，但不能代替所有已入队旧请求的隔离。

补修：disconnect进入队列时捕获注册能力/代次，执行前重新核对当前有效主会话；失效则返回明确失败，不终止新主端或新伴随会话。核对所有会改变会话/窗口的排队入口，保持detach/dock已有执行前校验。

验收：上述顺序中C仍有效，旧disconnect返回失效/已替代错误，旧资源清理与B的409仍成立；补真正等待过窗口队列的负例。不要仅再次测试“重连后才发出的旧请求”，后者已通过。

## H2 [P1，G3余项] 旧伴随窗口动作排队后只认main generation，会关闭新弹窗

位置：`dsh-whale-mist/src/detachable-host.js:870`的窗口动作分支，尤其`capturedGeneration`及其队列回调（924–954）。请求入队前查lease/schema/revision，出队时只复核主注册generation，没有复核原companion lease、popup generation及当前revision。

本轮复现，同一个主注册generation=1、revision=10：

1. 弹出并连接窗口1；主端requestDock开始关闭，adapter.close由闸门暂缓。
2. 主端再requestDetach，排在关闭后；随后旧窗口1的合法request-dock也进入队列，排在新detach后。
3. 释放关闭；窗口1正常关闭，新detach成功创建窗口2（popupGeneration=2）。
4. **旧窗口1的request-dock出队仍返回ok，关闭窗口2。** 最终spawn=2、close=2、mode=docked；其请求原lease已经失效。

补修：入队时绑定原主注册代次、companion lease与popup代次，执行前核对仍有效且确实属于待关闭窗口；版本也在实际执行前核对。失效请求无窗口/模式/新租约副作用。保留现有Node唯一窗口所有者、schema校验、最终结果和去重语义，不把关闭移回renderer。

验收：上述顺序中窗口2保留，旧请求明确失败，closeCount停在1；增加排队期间revision变化的负例，确认不会根据入队时旧版本关闭。去重缓存应与动作所属会话/窗口绑定，不能借重放影响新窗口。正常吸附、关闭失败重试及旧lease拒绝仍需保持。

## 接续与保护

仅补H1/H2后复审，保留G2闭合及14项/11项主流程，不扩P1、整体TS迁移或三体专项。正式ctx路由/静态页/生产加载仍待接入，离线浏览器不等于真实DSH独立窗验收。

源码/QA/package/assets及原归档的181项保护清单见`protected-before.json`和`verification.json`；本轮只增加隔离证据及文档。未安装、启动、退出、重启、采样或操作真实DSH/WE/伴随窗，未修改活动Profile或外观存储，未提交推送清理。只读核对了日常插件清单及官方安装文件；不能称正在使用的Profile已冻结。由用户转交小G，未跨会话发消息。
