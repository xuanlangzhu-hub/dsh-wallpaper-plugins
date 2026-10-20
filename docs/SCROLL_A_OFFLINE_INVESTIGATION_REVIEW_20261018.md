# 滚动A首审：复现数据与归因不一致，先补证据

日期：2026-10-18。复审[离线调查交付](SCROLL_A_OFFLINE_INVESTIGATION_DELIVERY_20261018.md)。**暂不通过，不按当前报告直接修生产生命周期。** 已有隔离页面和浏览器滚轮测量可保留，但还没有证明用户截图中的状态错位来自外观断流。

## 本轮独立核对

先核实Antigravity原对话已结束本轮、输入为空且没有Working/Cancel，再冻结交付目录、报告及临时profile辅助代码。证据目录：`.tmp/scroll-a-first-review-20261018-6241c6f7`，指纹见`inputs.json`。

独立副本只调整runner的temp-profile模块相对路径，保留原测试逻辑，使用全新临时profile、本地随机HTTP/CDP端口复跑，退出0；见`replay.log`。没有连接日常DSH/WE，没有模型请求。`independent-summary.json`记录复跑的几何与滚动摘要；`review-evidence.mjs`/`evidence-gates.json`核对缺失CSS与waiting布局证据。原交付未漂移。

保护核对见`preservation.json`：对照P1A十审161项输入，仅此前B专项managed-window.js/session.js变化；B六审的两文件指纹保持，59项资产归档保持。没有改小G生产实现、安装/Profile/版本号，未打包、发布、提交推送或清理。

## R1（P1）：报告声称的waiting错位没有出现在交付JSON或独立复跑中

报告3.3表格写waiting的状态位于Y928–946、约288px底部悬空，并在3.3.2把它解释为hideWallpaper导致的几何断裂；4.2又把当时发生waiting当作最可信解释。实际原交付JSON与独立复跑一致：

| 状态，滚到底部 | card top / bottom | running top / bottom | running相对卡片/统计 | 卡片底到视口底 |
| --- | --- | --- | --- | --- |
| pure-host | 939 / 1059 | 882 / 903 | ABOVE_CARD / ABOVE_DOCK | 21 |
| normal | 939 / 1059 | 918 / 939 | ABOVE_CARD / ABOVE_DOCK | 21 |
| waiting | 939 / 1059 | 882 / 903 | ABOVE_CARD / ABOVE_DOCK | 21 |
| cleanup-failed / unloaded | 939 / 1059 | 882 / 903 | ABOVE_CARD / ABOVE_DOCK | 21 |

waiting确有141px行内reserve及标记残留，但无背景后对应CSS条件失效；本页waiting最终几何与pure-host相同。**变量残留不能直接证明仍占位，更不能证明截图中的285px空白由它造成。** 截图是1921×1234，本测试是1920×1080，不能把截图坐标填作测试坐标。像素图也不能证明某片区域没有DOM。

要求：重写报告和接续结论，以数据生成表格，把未复现与假设明确写出。保留“hide未停止跟踪”这一源码观察，但撤回已定因、已复现悬空及由此得出的必须调用stopHistoryTracking结论。若继续验证该假设，应在同一有效基底下给出单变量前后数据；未复现也可如实交付，不要求为了通过硬凑现象。本轮仍不改生产实现。

## R2（P1）：声称完整官方样式对齐，实际漏提取六个关键模块

`extract-styles.mjs`使用`"([^"]+)"`匹配JS字符串，遇到CSS内的转义双引号就匹配失败，并静默跳过。聚合文件实际仅有旧conversation-host-rc2.css子集、TodoPanel与BashSample三段；缺少报告宣称加载的：

- ConversationRoot.module.css（官方字符串6855字节）
- ChatView.module.css（34770字节）
- ChatGroupSeat.module.css（2414字节）
- InputBar.module.css（5894字节）
- ContextMeter.module.css（2429字节）
- ToolList/pmht6G（4503字节）

四个官方源文件哈希本身正确，问题出在提取及加载门禁。旧子集头注明确是2026-10-07记录的Desktop0.2.0-rc.2，不能按文件名rc2直接宣称是本次0.2.1-rc.2完整CSS。

例如真实`.WW4l1q_body`为`max-height:min(400px,50vh);overflow-y:auto`，真实`.pmht6G_list`默认max-height320px且有条件解除限制；fixture却手工内联固定180/140px及overflow来造滚动条件。它证明此手写容器的浏览器行为，不能支撑“所有结构100%一致”或不加范围地排除外观影响。runner测量中会话横向left为0也提示外层布局/尺寸未充分对齐。

要求：正确解析并解码完整JS字符串（例如处理转义的解析或AST），每个必要模块缺失/为空立即非零失败；冻结实际加载内容、来源、版本与哈希。布局关键规则、宿主DOM映射与rc.35相关CSS/生命周期应使用真实实现或可机械核对的提取，解释保留的简化，不能手写近似后宣称100%。移除为了制造内部滚动的尺寸/overflow覆盖，按官方样式与足量内容形成滚动；人工容器可另作浏览器机制对照。普通思考与折叠组/工具详情分别报告，不把扁平行结论扩成全部“思考内容”。

## R3（P2）：退出0只表示采样结束，缺少有效性断言与关键动态覆盖

runner只import assert，没有执行断言。全程只有1920×1080；toggleRunning未调用，未切换统计显隐，没有真正持续追加/结束流式内容，也没有waiting恢复有效帧的转换。cleanup-failed与unloaded都仅映射同一个unmount模拟动作，尚非真实不同错误生命周期。当前五状态采样不能写成全部动态验收完成。

要求：在修正R2之后补最小有效性门禁：目标在视口且实际命中预期区域、必要CSS生效、内部确有剩余/边界滚动范围；滚动前后及恢复后的几何关系应被检查。可用CDP浏览器输入，准确称为浏览器输入，不能说是物理系统鼠标验收。直接赋scrollTop用于设置起点可以保留并明确区分。

优先覆盖运行中追加→结束、normal→waiting→恢复、清理/卸载恢复，以及任务/统计显隐和至少两种窗口尺寸；不要求无意义全组合。记录同帧/RAF后/稳定时的数据以验证或反驳瞬态假设。对没有复现的路径写not-reproduced，不能靠退出0证明根因或修复；若隔离环境始终不能重现，列出下一次需用户另安排的实际DOM/wheel只读证据，不擅自操作日常应用。

## 已有成果与下一份交付

现有手写页中，局部有空间时inner移动80、outer不动，边界时outer移动150；普通扁平行使外层移动。可保留为当前fixture观察，不等于用户故障已解释。B六审/P1A十审保持，不重做它们、不安装混包、不进入其它专项。

只补R1–R3的调查与QA证据，交`docs/SCROLL_A_OFFLINE_INVESTIGATION_REPAIR_DELIVERY_20261018.md`，使用新独立输出目录保留本次旧证据。定时任务保持PAUSED；用户本次已授权Codex将复审和补修发给小G原对话，发出后记录核验结果。

转达记录：依用户本次明确授权，已发至Antigravity原对话ab784c53-5544-4551-b38f-8f7217324a77，保持Gemini 3.8 Flash High；核验18:37新用户消息、输入清空及Working/Cancel。仅发送一次，等待补修交付，定时任务保持PAUSED。
