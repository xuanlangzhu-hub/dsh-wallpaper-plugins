# 可分离/吸附外观设置P0七审：H1/H2闭合，离线补修通过

2026-10-17，Codex。复审[六审补修交付](DETACHABLE_APPEARANCE_P0_SIXTH_REPAIR_DELIVERY_20261017.md)，对照[六审H1/H2](DETACHABLE_APPEARANCE_P0_SIXTH_REVIEW_20261017.md)。

**结论：本轮H1/H2补修通过，六审遗留项闭合。** 保留此前G2已通过的权威模式/关闭失败重试和统一执行器、窗口所有者；本轮未发现新增阻塞项。此为通信骨架和离线接缝补修通过，**正式ctx路由/静态页/生产加载及真实DSH独立窗口仍未完成**。后续按用户顺序，先[升级兼容候选及宿主短验](DSH_021_RC2_COMPAT_CANDIDATE_REVIEW_20261017.md)，完整设置P1/UI后排。

## 证据与范围

本轮独立目录：`.tmp/detachable-appearance-p0-seventh-review-20261017-fca7697e`，冻结当轮src/QA/scripts/package及两份交付报告，未修改小G实现。

- `npm run check`：退出0。
- P0专项：15/15，退出0，新增Test15通过。
- 实际headless Edge双Tab：11项主流程通过，退出0，spawn=3、close=3。
- 直接复跑六审原`queue-boundary-probes.mjs`，不是只看新增测试名称：H1旧disconnect返回409/transition-superseded，C保持instanceId=C/generation=2；B返回409/registration-superseded；H2旧lease动作明确失败/window-already-closed，spawn=2而close仍1，窗口2保持detaching。
- 独立`queued-revision-check.mjs`把窗口队列实际阻塞，在动作以revision10入队后推送revision11，再放行；动作返回stale-revision，关闭计数保持0，原窗口保持detached。补足Test15末段“先变版本再发动作”对真实排队漂移覆盖不足的证据。
- client.js、既有外观harness/QA与六审输入一致，沿用570/566/场景选择等既有回归，不机械重跑完整外观矩阵。

## H1闭合

`src/detachable-host.js`的主端disconnect入队前捕获注册generation与instanceId，在队列内部、终止任何会话前重新核对；失效请求返回409，不再读取并注销替代它的新主端。原先A在途→旧注销排队→B等待→C成功的顺序已通过。

## H2闭合

窗口动作入队时绑定主注册generation、popup generation、leaseId和expectedRevision；执行前重新核对。失效窗口/租约请求明确失败，revision漂移拒绝，均不关闭新窗口。窗口动作缓存也增加lease与popup归属，避免跨窗口命中旧缓存。

交付报告中的伪代码曾写`{ok:true,status:'window-already-closed'}`；**实际代码和本轮结果为`ok:false,error:'window-already-closed'`**，符合六审“失效请求明确失败”的要求，本文以实际实现为准，不把伪代码描述当作产品缺陷。

## 保护与接续

本轮仅新增隔离检查、证据及文档；209项源码/QA/资产/两仓库原归档与新候选保护清单见`protected-before.json`及`verification.json`。日常rc.34及官方安装不变，未写活动Profile/存储、操作真实DSH/WE/伴随窗口、安装、提交推送或清理。

P0补修暂告收尾，不因本报告自动启动正式独立窗接入或扩大UI范围。由用户转交，不跨会话消息。
