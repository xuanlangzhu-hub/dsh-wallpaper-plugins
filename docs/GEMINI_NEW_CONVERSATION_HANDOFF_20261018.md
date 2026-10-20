# 小G新对话交接：滚动A调查QA收尾

日期：2026-10-18。此文用于替代旧超长对话记忆。用户已决定在旧轮结束后换新对话，由Codex准备交接；用户随后已明确确认新对话并授权发送；19:34交接首条任务已发送并确认开始读取文档。旧对话`ab784c53-5544-4551-b38f-8f7217324a77`只作历史，不再作为默认发送目标。模型沿用用户选定的Gemini 3.8 Flash High，不自行换模型。

## 先读这些

仓库`F:\dsh-wallpaper-plugins`，主要插件`dsh-whale-mist`。依次读AGENTS.md、NEXT_TASK.md、docs/PROJECT_STATUS.md及[最新A二审](SCROLL_A_OFFLINE_INVESTIGATION_SECOND_REVIEW_20261018.md)。需要具体证据时再读[A补修交付](SCROLL_A_OFFLINE_INVESTIGATION_REPAIR_DELIVERY_20261018.md)、[原日常故障](DAILY_SCROLL_WALLPAPER_INCIDENT_TRIAGE_20261018.md)。不用重新通读所有历史审查。

宿主源码目录`F:\deepseekharness`，其中NEXT_TASK.md只是跨仓库接续入口。先git status，保护所有脏改动与未跟踪文件；Codex负责独立审查/证据/文档，小G负责本次调查QA补修，不同时改同一实现。

## 当前可靠结论

| 项目 | 到哪一步 | 不能扩称的结论 |
| --- | --- | --- |
| 日常环境 | DSH0.2.1-rc.2 / 外观rc.35 / Git Bash0.1.1 | 当前未重新做实机核验，不复用历史停止/退出确认 |
| B：壁纸消失后清理锁、不能重开 | [六审](WALLPAPER_CLEANUP_RECOVERY_B_SIXTH_REVIEW_20261018.md)源码离线通过；Host JS110与独立38项有证据 | 尚未安装到日常rc.35；首次为什么断流仍未知；不是所有未知身份都能无条件恢复 |
| A：滚动思考带动会话、输入框/底部状态错位 | 有隔离fixture；原错误归因撤回；9模块CSS已独立核对；两尺寸六状态未复现截图悬空 | 用户现象真实报告但根因未定，不能说已修或外观已排除；最新二审仍有Q1–Q3 |
| 独立设置窗口P1A | [十审](DETACHABLE_APPEARANCE_P1A_TENTH_REVIEW_20261018.md)源码离线通过 | 真实独立系统窗口/吸附体验、独立候选整合尚未验收；当前不进P1B |

工作区manifest和生产assets仍冻结rc.30，源码含Trace/P1A等后续功能；日常来自固定rc.35归档。绝不能直接把整个工作区打包或仅改版本号发布。

## 新对话唯一当前任务

按A二审只补Q1–Q3，**不改生产client/index/companion或宿主实现**：

1. Q1：修正运行状态隐藏的测量/断言，报告数据一致；把手写模型、采样时钟、缺少真实观察器等局限写清。工具列表overflow:hidden的因果声称没有反事实，降为观察/假设即可，不要求再做庞大矩阵。
2. Q2：修正将来实机取证脚本的元素选择与活动会话scope；当前脚本选不到card/todo/stats，把折叠组当running，scrollState取错ID、reserve取错节点。只在隔离页验证目标存在/隐藏/缺失/歧义，不运行于日常DSH，不读正文。
3. Q3：connect在open前close时清了timer却没reject，仍可永久pending。用一次性settle覆盖close/error/timeout等异常，纯替身负例即可；自有浏览器退出等待也必须有界，已退出不能再等新exit事件。

交`docs/SCROLL_A_OFFLINE_INVESTIGATION_SECOND_REPAIR_DELIVERY_20261018.md`，附本轮文件/指纹、执行命令、证据路径和实际范围。新输出目录，保留全部历史证据。先检查已有数据，不机械重跑无关套件。可以以有限模型not-reproduced诚实结束调查，完成后等Codex复审，不自动扩展到实机或新专项。

## 关键证据位置

- 最新独立A二审：`.tmp/scroll-a-second-review-20261018-a4890924`。`audit-result.json`核对9模块及12采样，`delivery/collector-result.json`证明取证误选，`cdp-close-result.json`证明连接悬挂；原交付冻结见inputs.json。
- 小G现有A修补输入：`.tmp/scroll-a-repair-investigation-20261018`，仍是简化fixture与控制器，不能当生产rc.35完整执行。
- 原A首审：`.tmp/scroll-a-first-review-20261018-6241c6f7`。
- [历史布局探针挂起](SCROLL_A_DEBUG_TASK_HANG_20261018.md)：Math.random小数ID被CDP拒绝且错误无id，旧Promise无限等；另有函数JSON.stringify产生undefined()。整数ID正常路径已修，但二审Q3连接关闭边界仍待补。不要重复启动同一挂起任务或盲等数分钟。
- B六审独立证据：`.tmp/wallpaper-cleanup-b-sixth-review-20261018-48d3821a`；日常rc.35对应两JS改动版：`.tmp/wallpaper-cleanup-b-fifth-repaired-rc35-20261018`，仅供以后用户安排时独立候选整合，不是安装许可。

## 操作边界

定时任务g保持PAUSED，不自行恢复巡检、定时器或持续无人值守推进。跨会话转达由Codex按用户指示进行，小G不自行联系其它对话。

不安装/发布/整体打包，不改日常安装、Profile、生产assets或版本号；不操作/退出/重开/采样DSH/WE，不发DSH模型请求，不杀原WE；不提交推送或清理。涉及真实应用/主观验收/范围决定就记录待办等用户，历史确认不继承为新实机授权。

隔离QA只用新自有profile/随机端口，有界请求与try/finally、失败也要退出；保留证据，不能删除仍被使用或他人目录。资产归档59项、P1A/B通过成果保持，不开启P1B、三体、性能/GPU、CLI/Hook协作专项。今后若用户再安排安装或推送，单独执行届时授权。

## 已发送记录

19:34通过computer-use发送一次，已核验新用户消息、输入清空、Cancel及读取交接文档的进度。新对话名称：Scroll A Investigation Q1-Q3 Repairs；conversationId：44d9b078-56c9-47a4-aa8a-a1f673d23d0e；Gemini 3.8 Flash High保持。今后本专项转达以此新对话为目标，旧对话仅作历史。等待Q1–Q3交付，定时任务仍PAUSED。

## 最新覆盖入口

本交接Q1–Q3已交付并经[三审](SCROLL_A_OFFLINE_INVESTIGATION_THIRD_REVIEW_20261018.md)：Q1与连接挂起反例通过，仅补C1/C2。Q1隐藏测量与模型范围、9模块CSS、连接open前close挂起已闭合。只补C1取证无唯一scope仍退回文档/首个会话、C2未确认测试进程退出仍删profile报成功，交SCROLL_A_OFFLINE_INVESTIGATION_THIRD_REPAIR_DELIVERY_20261018.md；已通过部分保持，不改生产实现。A有限模型未复现且根因未知，B/P1A及59资产保持，日常未安装B修复，定时PAUSED。小G新对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e接续。 旧的二审任务细节只作历史，不重做已过项。

## 用户最新改排期：插件主线优先

用户明确将滚动A降为低优先级，不再阻塞主线；新增线索为似乎仅DSH执行任务时出现，尚未稳定复现，根因未知。停止扩展A调查，已有C1/C2交付仅保留待审，不要求先闭合才转主线。优先P1B-1完整外观控件/布局与即时同步，再P1B-2缩略图库/详情；P1A/B已过成果保持，日常rc.35未接入这些后续源码。仅隔离开发，不安装或操作DSH/WE，定时PAUSED。 最新任务[GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B1_20261018.md](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B1_20261018.md)取代本文件旧的A唯一当前任务，保留旧条目作为历史。已向同一新对话转达。

## P1B-1复审后的当前入口

[P1B-1首次复审](DETACHABLE_APPEARANCE_P1B1_REVIEW_20261018.md)暂不通过，只补R1–R4：独立页快照倒退/在途回跳、权威预设目标门禁、预设与调参顺序、吸附页普通动作错误可见性。实际React基本挂载/同步、P0/P1A20项及旧双Tab11项通过，不抵消负例。交P1B1_REPAIR_DELIVERY后再复审，不进入P1B-2或安装。滚动A低优先级，P1A/B成果保持；日常DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1不动，定时PAUSED。 本节覆盖前文首次实现任务，具体负例与验收按复审报告；只修R1–R4，新交docs/DETACHABLE_APPEARANCE_P1B1_REPAIR_DELIVERY_20261018.md。

## P1B-1二审接续与用户脚本要求

[P1B-1二审](DETACHABLE_APPEARANCE_P1B1_SECOND_REVIEW_20261018.md)：旧版本拒绝、权威预设目标与动作错误显示保持通过；只补C1动作Promise/有限重试、C2预设屏障顺序、C3在途及取消值恢复、C4测试脚本有界退出和遗留后台记录核对。用户明确要求禁止无返回脚本，先加等待/清理保护再启动新测试。交SECOND_REPAIR_DELIVERY后复审，不进P1B-2或安装。A低优先级，日常rc.35及P1A/B保持，定时PAUSED。 本节覆盖首次补修入口，仅补C1–C4，详见二审验收标准。

## P1B-1三审当前入口

[P1B-1三审](DETACHABLE_APPEARANCE_P1B1_THIRD_REVIEW_20261018.md)：保留已过断连落定、3次重试、正常屏障顺序和显示恢复，只补E1无回包动作截止/worker释放、E2 stale替代不得跨预设屏障、E3实际QA调用方清理失败非零及总超时收尾。交THIRD_REPAIR_DELIVERY后复审，不进P1B-2或安装；旧后台记录界面已无计数，不扩称全系统进程验收。A低优先级、日常rc.35及P1A/B保持，定时PAUSED。 本节覆盖二审补修入口，详见三审E1–E3；禁止无返回脚本的AGENTS规则继续生效。

## P1B-1四审当前入口

[P1B-1四审](DETACHABLE_APPEARANCE_P1B1_FOURTH_REVIEW_20261018.md)：E2冲突屏障、E3清理失败非零/error监听与单次超时已过；只补F1逻辑动作总预算和真实响应入口失效、F2工作软截止进入清理及独立外层watchdog。交FOURTH_REPAIR_DELIVERY后复审，已过项保持，不进P1B-2或安装。A低优先级，日常rc.35及P1A/B保持，定时PAUSED。 本节覆盖三审余项入口，仅补F1/F2；禁止无返回脚本的AGENTS规则继续强制执行。

## P1B-1五审当前入口：仅QA汇总G1

[P1B-1五审](DETACHABLE_APPEARANCE_P1B1_FIFTH_REVIEW_20261018.md)：F1生产源码离线通过，真实HTTP取消/SSE/总预算及F2软硬退出链路已有证据；仅补QA G1：硬截止触发后exitPromise抢先返回timedOut=false，exit0边界可误报成功。只改本轮实际runSupervisedScript和直接入口测试，不再改生产/UI；交FIFTH_REPAIR_DELIVERY后收尾复审，不进P1B-2或安装。A低优先级，日常rc.35/P1A/B保持，定时PAUSED。 本节覆盖四审入口，生产已过部分停止返工；只修实际监督器结果汇总。

## P1B-1六审：离线阶段已通过

[P1B-1六审离线通过](DETACHABLE_APPEARANCE_P1B1_SIXTH_REVIEW_20261018.md)：QA G1闭合，当前源码与QA离线阶段收尾，158项源码/QA及59资产归档保持，不再返工或重跑矩阵。等待下一步安排：产品主线P1B-2预览库/详情，真实系统窗/候选验收仍另排；本轮不自动启动或安装。A低优先级，日常DSH0.2.1-rc.2/rc.35/Git Bash0.1.1不动，定时PAUSED。 本节覆盖前文G1补修入口，停止本轮实现与QA，不把离线通过当日常安装或实机验收。


## 2026-10-19 当前排期（覆盖历史下一步）

[P1B-2壁纸预览库/详情任务](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B2_20261019.md)已建立，按用户10月19日继续指令进入离线实现：预览卡片、选择/播放分离、详情与既有四字段外观、受限图片路由。P1B-1六审已收尾，不重跑旧矩阵；作者参数、真实系统窗和候选安装另排。A低优先级，日常DSH0.2.1-rc.2/rc.35/Git Bash0.1.1及rc.30生产assets不动，定时PAUSED。


### 2026-10-19 P1B-2首审接续

[P1B-2首审未通过](DETACHABLE_APPEARANCE_P1B2_REVIEW_20261019.md)：补R1真实播放签名/目标/截止，R2吸附预览与目录状态，R3图片时序/生命周期，R4认证/归属，R5底层读取并发，R6真实契约QA与证据。只等小G定向补修交付，不进候选/实机；P1B-1及B既有通过保持。A低优先级，日常DSH0.2.1-rc.2/rc.35/Git Bash0.1.1及rc.30生产assets不动，定时PAUSED。


### 2026-10-19 P1B-2二审接续

[P1B-2二审未通过](DETACHABLE_APPEARANCE_P1B2_SECOND_REVIEW_20261019.md)：签名/错误映射、目录failed、首次/反序图片、动作截止、junction与跨超时底层并发已独立通过；仅补S1正常stopped再播放、S2吸附认证图片/Origin/CORS、S3断线/刷新图片生命周期、S4在途读图实例失效。等待定向二次补修，不进候选/实机；日常DSH0.2.1-rc.2/rc.35/Git Bash0.1.1及rc.30生产assets保持，A低优先级，定时PAUSED。


### 用户追加：年龄分级（2026-10-19）

用户追加[年龄分级预览筛选](DETACHABLE_APPEARANCE_P1B2_AGE_FILTER_ADDENDUM_20261019.md)：三个分级独立勾选，首次仅Everyone，未选/未分级默认不读图，主从与Host同一门禁；在S1–S4后接入，不提前进候选。


### 2026-10-19 P1B-2三审接续

[P1B-2三审：正常链路已过，筛选尾项未过](DETACHABLE_APPEARANCE_P1B2_THIRD_REVIEW_20261019.md)：真实headless/React认证读图解码与全不选已验，32项分级组合通过；只补T1项目/目录分级漂移、T2在途图取消及epoch、T3损坏偏好/双端校验，并修正T4手填浏览器成功值的QA证据。不重做S1–S4已过功能，不进候选/实机；日常rc.35、工作区rc.30资产保持，A低优先级，定时PAUSED。


2026-10-19最新接续（覆盖上述历史下一步）：[P1B-2四审：仅余异步查询边界](DETACHABLE_APPEARANCE_P1B2_FOURTH_REVIEW_20261019.md)：上轮T1–T3负例及T4证据修正通过，正常图库/分级/实际解码保持；只补U1分级查询全生命周期超时与并发占位、U2新增await后的权限/会话复核。不得重做已过功能或进候选/实机；日常rc.35与工作区rc.30资产不动，A低优先级，定时PAUSED。


2026-10-19最新接续（覆盖历史下一步）：[P1B-2五审：源码离线通过](DETACHABLE_APPEARANCE_P1B2_FIFTH_REVIEW_20261019.md)：U1全生命周期超时/8路真实占位、U2新增await后的分级与会话复核独立通过，交付5组、P0/P1A20项、32分级组合与真实headless解码保持。P1B-2源码离线收尾，小G停止实现，候选整合及真实独立窗/吸附验收等用户安排；不自动打包安装。日常rc.35、工作区rc.30资产保持，A低优先级，定时PAUSED。


2026-10-19用户同意继续后的新入口（覆盖历史等待）：[rc.36隔离候选任务](GEMINI_NEXT_RC36_DETACHABLE_CANDIDATE_20261019.md)：用户已同意推进。小G从固定rc.35隔离整合已审B恢复/P1A/P1B1/P1B2，候选版本rc.36仅在新stage变更；客户端21-hunk产品patch预检可干净应用，12原生运行文件保持、排除Trace。交付实际候选QA/核包证据后由Codex复审；不安装或操作日常。日常rc.35、工作区rc.30资产保持，A低优先级，定时PAUSED。


2026-10-19最新接续（覆盖历史下一步）：[rc.36候选核包通过](RC36_DETACHABLE_CANDIDATE_REVIEW_20261019.md)：35文件独立核包通过，20保持/8修改/7新增，12原生运行文件不变、无Trace；实际解包候选5组回放、20项P0/P1A、B完整路由负例和真实官方SDK接缝/React解码通过。小G停止实现，下一步待届时方便确认后新备份与独立窗/吸附短验，默认测后恢复rc.35；当前未安装/未操作日常。工作区rc.30保持，A低优先级，定时PAUSED。
