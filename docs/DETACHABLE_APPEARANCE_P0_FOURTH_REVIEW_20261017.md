# 可分离/吸附外观设置 P0 四审：统一实际三方路径的协议、资源与会话所有权

2026-10-17，Codex。对象：[三审补修交付](DETACHABLE_APPEARANCE_P0_THIRD_REPAIR_DELIVERY_20261017.md)、新增Main Renderer客户端、两种Host分支、专项QA及浏览器E2E；对照[三审](DETACHABLE_APPEARANCE_P0_THIRD_REVIEW_20261017.md)。

**结论：暂不通过。双浏览器真实往返已经成立，但新remote路径另写了动作执行器和窗口状态管理，绕开原bridge已复审的约束，导致同类问题在实际三方路径复发。下一轮集中统一这条实际路径，不继续扩P1 UI或新增平行协议。**

本轮不改生产源码/QA，不操作真实DSH/WE/伴随窗口，不安装或升级。用户日常rc.34与暂缓DSH 0.2.1-rc.1的决定保持；UI库/详情方向仍是后续任务。

## 本轮确认的进展与验证范围

独立证据：`.tmp/detachable-appearance-p0-fourth-review-20261017-1040be41`，冻结源码/QA/package/交付，含原始日志与输入保护清单。

| 检查 | Codex结果 |
| --- | --- |
| `npm run check` | 退出0 |
| 冻结P0专项 | 12/12，退出0 |
| 冻结`qa/detachable-browser-e2e.mjs` | 退出0，实际client/controller所在主Tab→Node Host→伴随Tab，双向数值往返/SSE成立 |
| `remote-path-fourth-review.mjs` | 实际双浏览器/实际controller，7项当前remote路径缺陷复现成立 |
| `remote-session-probes.mjs` | 隔离HTTP服务，5项主端/伴随会话边界缺陷复现成立 |
| `main-loss-fourth-review.mjs` | 导航离开本轮主测试Tab，复现非正常失联未失效 |
| 既有主题回归 | client.js、appearance-regression.mjs、appearance-harness.js与上轮逐字节相同；沿用570/566/场景选择，不机械重复 |

补充脚本退出0表示其“缺陷复现断言”成立，不是新路径验收通过。原始E2E末尾的PASSED仅覆盖原有正例。其spawnCount=1、closeCount=0也显示它没有证明窗口清理；Test4是在Test3已断开伴随端之后才注销主端，不能证明仍连接的伴随端会因主端突然失联而禁写。

已有改善保留：本地bridge的迟到句柄登记、清理失败保留、transport断开定向清理；Host读取鉴权、JSON null守卫、强制loopback/启动错误、安全随机数及SSE正向更新。**下面问题主要位于新增remote Main Renderer路径，不应只在旧bridge分支继续补测试。**

## F1 [P1] 实际主renderer动作执行器绕开了版本、去重、业务确认与窗口动作

位置：`src/detachable-contract.js:526–702`，尤其`executeActionLocally`（612行起）；`src/detachable-host.js`的remote action转发分支（458行起）。

本轮使用小GE2E相同的实际controller与双Tab，增加负例：

| 操作 | 实际结果 |
| --- | --- |
| 主端已把亮度更新为110，伴随传expectedRevision=1写60 | 返回ok=true，实际controller变60；校验仅检查revision格式，没有检查是否等于当前版本 |
| 同clientActionId先写80，再换载荷写90 | 两次都ok，最终90；没有原bridge的会话去重/载荷指纹规则 |
| 实际controller删除不存在的Lucy预设 | 直接调用返回preset-missing；经过remote客户端却返回ok=true |
| 伴随client.requestDock() | 返回unknown-action，closeCount=0；实际执行器根本未处理request-dock/close-window |

代码还只订阅settings：预设保存/删除、播放状态没有同等自动推送；部分动作自身递增revision，controller订阅又递增一次。异常也可能直接结束action stream。此前单元测试中的strict revision、失败去重、播放订阅和关闭回执，主要验证createDetachableBridge，而三方E2E使用另一个执行器，不能互相代替。

补修：提取/复用同一受限动作确认与冲突规则，让实际renderer执行路径保留唯一controller，同时兑现已审的版本匹配、同会话动作去重/指纹/原结果、预设失败/异常透传、所有必要状态订阅、同值稳定等语义。窗口动作交给唯一窗口所有者并等待真实结果。不要为复用旧Node对象而把controller搬到Host或复制apply。允许按运行边界拆模块，但不能维护两套行为不同的状态机。

验收：把上述负例、预设transition/mismatch/storage-failed、settings/presets/wallpaper订阅、request-dock/close-window成功/失败/重复，**同时跑在真实双浏览器remote路径**；每次动作只执行一次，失败不报已应用，旧值不覆盖新值。

## F2 [P1] 新Host窗口路径未复用资源门禁，重复启动和断开清理问题复发

位置：`src/detachable-host.js:197–251,325–389,stop()`；`src/detachable-contract.js`的main requestDetach/requestDock/dispose。

本轮双浏览器复现：原本已经弹出并连接后，再调用两次主端requestDetach，**spawn从1变3、生成两个新token**；没有幂等/切换队列，前两次owned handle会被后来的handle覆盖。伴随disconnect后、主端dispose后，**closeCount始终0**。

原因：新增`/api/main/detach`又自己生成token和调用spawn；`/api/disconnect`及SSE断线只在bridge分支调用原清理，remote分支仅清activeSession；`/api/main/disconnect`清mainSession但不关闭owned窗口；Host.stop也未收束窗口资源。requestDock另有close逻辑，不代表断开/卸载已经清理。新spawn适配器仅收到hostPort/token，不是旧buildEdgeAppLaunchSpec那套受控启动spec。

另一次真实浏览器探针保持伴随连接，让主Tab导航到about:blank（没有调用正常dispose）：主SSE断开只清actionsSseRes；之后快照仍200、伴随仍connected、closeCount=0。200ms是本次观测点，不是新增验收超时要求；代码中没有相应主session失效/有界租约超时机制，不能声称突然失联已清理。后续写入可能得到503，不等于先前连接/资源状态已正确失效。

补修：窗口所有权/代次/队列与清理结果在真实Node窗口所有者处统一管理，所有入口共享同一规则；正常吸附、伴随关闭/断线、主端退出/失联、Host停止、启动中取消都必须收束本轮handle。未确认退出阻止新建、错误可见；启动参数与返回handle契约在此实际适配器执行，不只在未走到的函数里存在。

补充断开时解决该session的在途动作：当前mainSession被置null后，旧pendingActions的超时回调仍查全局mainSession，可能不再resolve旧请求。旧请求应受控失败，不挂起、不交给新实例继续处理。

验收以每个实际返回的H逐项核对关闭/退出结果，加入重复弹出、spawn/close延迟和失败、断流/崩溃、主端退出、Host停止及旧结果迟到。不要仅断言某个close计数大于0或服务端返回503。

## F3 [P1] 主端与伴随端会话没有实例代次绑定，可串到新实例

位置：`src/detachable-host.js:66,120–194,325–345`及main注销路由。

隔离HTTP复现：

1. 未提供mainToken配置时，公开默认值`default-main-token`被接受，可注册主端并取得弹出token。这是可预测认证默认值，不是安全随机秘密。
2. 已知合法弹出token，但在伴随握手中传`wrong-instance`，仍成功连接main-A。remote分支没有核对instanceId，generation固定为1。
3. main-A连接并生成伴随lease后，再注册main-B，旧A伴随lease仍可读取B的快照。
4. main-B revision10后，旧main-A携原主端凭据发送snapshot revision1，被接受并覆盖B；旧A再发disconnect，直接使B失联（读取变503）。body.instanceId并未用作所有权检查。

这些证明新Host分支又失去了旧bridge已审的实例隔离。当前是未接入日常的隔离开发模块，本报告不声称已影响用户正在使用的DSH或开放到公网。

补修：主端凭据安全生成/明确受信注入，无公开默认回退；bootstrap认证与注册后当前连接能力分离，主端所有更新/动作回执/窗口操作/注销绑定当前instance及注册代次。新主端替换需先收束旧连接、在途请求与owned资源。伴随token/lease同时绑定当前主代次与弹出代次，核对instanceId、generation和有效性；重新注册时旧token/lease立即失效。快照需按当前实例/单调revision接收，旧回调或注销不能操作新实例。

验收必须包含上述5个端点负例，以及旧主action-result、旧SSE关闭回调和同ID在新实例的迟到结果。不要只把错误foreign Origin测试再跑一次；Origin门禁不替代实例能力认证。

## 下一轮范围：收敛一套协议与所有权，不再新增平行实现

建议先画清/写清当前真实路径由谁唯一执行动作、谁唯一拥有窗口、如何传递认证能力与确认结果，再合并重复实现。保留已成立的双Tab/SSE正例，给同一实际路径加本报告负例；单元层和remote E2E对同一规则给一致结果。

报告应把`ctx.webServer`的`/api/whale-companion/*`、静态页面及生产加载写成**拟接入/待验证**：本轮Node服务是独立HTTP监听器，现有index.js尚未把它注册成正式插件路由。这不要求本轮安装真实DSH，但不能将方案说明写成生产路径已经接入。物理独立窗/图标/DPI/跨屏和UI布局仍另阶段。

补修交付按F1/F2/F3给出实际调用路径、对应源码与原始负例结果；不用“12/12+E2E passed”代替全部协议/清理/实例隔离闭合。新证据另开目录，保留本次原始失败复现。client/QA旧回归输入未变，无须为本报告重做壁纸实机或完整570/566。

本轮保护清单180个源码/QA/package/资产/归档文件保持不变。Codex仅写文档和独立证据；日常rc.34、旧包/备份及DSH宿主保持。不提交推送、不安装/升级、不跨会话发消息。本文由用户转交，补后再复审P0。
