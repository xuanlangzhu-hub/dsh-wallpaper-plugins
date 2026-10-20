# 给小G：滚动A单项离线复现与归因

日期：2026-10-18。用户已明确授权Codex在Antigravity原“DeepSeek Harness 插件项目交接”对话转达本任务。定时任务g已关闭，保持PAUSED。本任务完成后停下等待复审，不自动推进其它专项。

## 起点与目标

先读AGENTS.md、NEXT_TASK.md、docs/PROJECT_STATUS.md、[B六审报告](WALLPAPER_CLEANUP_RECOVERY_B_SIXTH_REVIEW_20261018.md)及[日常故障记录A段](DAILY_SCROLL_WALLPAPER_INCIDENT_TRIAGE_20261018.md)。B源码离线通过，先保持；日常rc.35尚未接入B修复，首次断流原因仍未知。

用户现象：滚动上方思考/工具过程内容时，整个会话界面跟随滚动；“深度探索中”等状态出现在输入框和统计行下方。用户关于“状态文字移位导致整片区域变成思考内容”的描述是猜测，不能作为既定根因。截图是现象证据，不提供实际wheel目标或滚动链。

本轮只交付可复跑的离线复现、归因证据和最小修补建议，先不改生产实现。区分：内部仍可滚动时外层误动、内部到边界后的滚动传递、输入框/底部状态排版异常。若前两项在真实宿主结构中没有内部滚动容器，也要明确记录，不为迎合现象人为造一个。

## 输入与隔离方式

1. 核对git status，冻结涉及的输入及SHA256，在新的独立.tmp目录输出；不覆盖旧审查、事故和候选证据。先建立日常固定rc.35外观源码与当前DSH0.2.1-rc.2会话结构/CSS的对应关系。官方结构优先复用此前已提取的只读源码，记录路径、版本、提取来源和必要选择器；缺失时如实说明，不操作当前DSH补取。
2. 使用隔离fixture与本地浏览器测试，不连接日常DSH端口、不读用户真实聊天正文、不发模型请求。以现有真实组件/样式为优先；如用结构化fixture，逐项说明与实际宿主的映射及简化，不能用手写近似页通过就断言实际应用根因已定。
3. 对照至少包括纯宿主结构/样式、固定rc.35外观介入。背景正常、等待/断流、cleanup-failed、无背景/卸载分别记录，利用底层模拟触发状态，不能操作真实WE或启动捕获。当前工作区含P1A/Trace，不能把新工作区页面当作日常rc.35复现。

## 必须记录的证据

- 在同一fixture、同一尺寸和同一滚动位置下，记录wheel命中目标与祖先链，滚动前后的scrollTop/clientHeight/scrollHeight、overflow-y、overscroll-behavior、position。
- 输入框、任务条、统计、底部运行状态、会话视口的bounding rect和DOM父子关系；检查外观prepareHistoryPort/measureHistory、composer seat与背景状态切换时的设置和恢复。
- 用真实浏览器输入产生wheel，不仅赋值scrollTop或dispatch一个不会触发默认滚动的合成WheelEvent。脚本直接赋值只能作为几何辅助，需分开标注。
- 长思考/工具过程、运行中与结束、任务条/统计显隐、窗口尺寸变化；内部有滚动空间与边界场景分别测，纯宿主与外观使用相同输入。
- 复现时给最小触发序列和单变量差异；把观察、推断及未知分开。无法复现则列覆盖范围和仍缺的真实DOM证据，不能为了产出补丁先改布局。

## 交付和边界

交`docs/SCROLL_A_OFFLINE_INVESTIGATION_DELIVERY_20261018.md`，附可复跑脚本/fixture、命令、输出目录、指纹及预期/实际对照。若确认外观影响，给最小修补位置和回归验收标准；本轮不改生产client/index/companion实现、不直接修宿主、不加全局preventDefault或锁body掩盖问题。若只是fixture假设成立，明确写成有限推断。

保持P1A十审与B六审成果、原资产和版本号；不再机械重复无关专项。日常仍DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，工作区manifest/assets仍rc.30。绝不整体打包、安装发布、改日常安装/Profile/生产assets，不操作、退出、重开、采样DSH/WE，不杀原WE，不提交推送或清理，不进入P1B、性能/GPU或三体专项。需要实机或范围决定时写待办，等用户安排。

转达记录：已按用户本次明确授权发至Antigravity原对话ab784c53-5544-4551-b38f-8f7217324a77，保持Gemini 3.8 Flash High；核验18:00新用户消息、输入框清空及Working/Cancel，未重复发送。等交付后人工复审，定时任务保持PAUSED。
