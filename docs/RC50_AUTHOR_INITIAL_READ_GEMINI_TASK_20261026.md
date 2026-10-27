# 给 Gemini：rc.50 作者参数首次读取定位与最小补修

2026-10-26。用户现在明确授权由 Gemini 继续排查，得到证据后可以直接做相关最小补修，由 Codex 独立复审；不需要用户逐句转述。前端桥接／首次读取时序尚未排除，不能以“已经证明不是前端”为前提。Codex 不同时改实现。

## 先读与当前状态

先读 AGENTS.md、NEXT_TASK.md、docs/PROJECT_STATUS.md，再读：

1. `docs/RC50_NATIVE_UI_SHORT_TEST_20261026.md`：真实症状、操作顺序、恢复证据。
2. `docs/RC50_AUTHOR_INITIAL_READ_DIAGNOSIS_20261026.md`：已有链路复现、隔离窄诊断副本和范围。
3. `docs/RC50_AUTHOR_GEMINI_REVIEW_20261026.md`：对你上一份定因的逐点复核，6项真实门禁反例和保留意见。请独立核验，可指出复核错误并附可重复证据。

日常 DSH 0.2.1-rc.3／Whale rc.48／Git Bash0.1.2 已恢复，用户确认原外观／布局正常。rc.50 未保留。开发 manifest／生产 assets 仍 rc.30 且包含未发布开发内容，不能从共享树整体打包。先 git status，保护全部脏改动、固定包、旧备份／日志；不要 reset、清理或重写他人报告结论。

## 单项任务

定位并解释这次“选Lucy开始、画面出现、作者参数首次自动读显示‘未能读取设置，请重试’”的失败链。在可重复证据支持时，直接做最小源码／QA补修；如仍缺现场响应，先交付窄诊断方案和经过核验的隔离副本，不宣称现场根因已证实，不擅自进行实机。

本轮先从完整调用链查，而不是继续假定A或B成立：

- 实际 rc.50 只在合格、可见且 state=playing 的详情触发首次读，不是仅选中Lucy或starting就读。
- 原 index 的 ownership 同时进入 readTarget 和 lifecycle.busy；busy 会先被Host拒为 author_cleanup_pending，而非直接构造200／targetActive=false。检查正常start释放ownership与响应、renderer进入playing的先后顺序，也检查异常和并发边界。
- 此次先显示了23项全年龄目录、翻页再返回、选Lucy后才播；同一library实例通常已有snapshot。若认为cold/null仍可能，证明实例／快照变更路径，不能以一般冷库负例替代现场证据。
- 连接前失败、snapshot失败、schema错误、目标未验证和response校验均会压成相同UI文案。优先区分实际首个失败阶段，再决定修哪里。
- 单行删除targetActive读取检查的反例已保留：目标未验证时canEdit=true，改参数会产生draft。若设计先展示结构，需要完整只读／禁用与就绪代次合同，保留最后写入门禁，不能只删一行。

## 复用现有证据，避免重跑大套件

- 固定包：`release/plugins/dsh-whale-mist-0.6.0-rc.50.tgz`，SHA256 `F6D1BA78A3B08974BCC18410B1692CADDFAB4A72CB0070903D0B74A33C3B78D7`。
- `.tmp/rc50-author-initial-read-diagnosis-20261026-a/`：重新解包43文件、真实transport／controller／HTTP Host，13项隔离窄诊断场景、18项首次读取回归、4份保留原始源日志。`client-read-diagnostic-probe.js`只是未提升／未打包的窄探针，正常界面不增文案，失败附封闭阶段码；不要当成已审生产实现。
- `.tmp/rc50-gemini-author-review-20261026-a/review-vtwo-report.json`：真实ApplyAdapter＋真实library的6项核验，含冷库、就绪、busy先拒绝、未验证目标、手动就绪重读、单行删除反例。不要覆盖旧结果。
- `.tmp/rc50-ui-short-trial-20261026-b/`：playing／stopped／cleanup／恢复证据，轮次已封口，不可继续执行其授权或沿用PID。

先冻结相关源码／QA／固定包指纹，用自己的独立目录做最小复现。可以检查／复核上述诊断副本，也可提出更小的测量点；固定失败分类，禁止记录token、私有路径、完整响应／壁纸值、原始异常堆栈。若补测实际SDK，只做相关分组，不重跑不相关的UI、GPU或全部壁纸专项。

## 补修许可与边界

已授权：在仓库开发源码／QA中修本问题相关控制器、桥接或Host／library逻辑，必要时同步生成块和文档。前端还是后端由证据决定。先写能失败的回归，最小修改后用同一复现转绿；声明哪些是实际实现、元数据IO替身、SDK或实机。未经证据，不增加固定延时／自动重试、放宽鉴权／身份／分级／响应校验、忽略错误或发送默认参数。

冷库健壮性若要单独修，沿用approved roots、分级、类型、新鲜文件校验与取消／预算；不要无条件全库refresh或直接固定路径绕过授权。读写状态必须分清；未知下发结果不自动重放。保留取消、迟到、ABA、旧／脏记录和编辑保护。

不授权：打包安装发布、操作或采样日常DSH／WE、退出／重开DSH、发送DSH模型请求、改变日常Profile／外观／媒体／生产资产／版本号、杀原WE、提交推送／清理、跨任务派发或定时。任何实机取证先把具体候选和新备份／恢复流程交Codex复审，另问用户当前方便。不要把“继续排查”当实机授权。

UI呈现改版本轮不做；“▶ 播放”已记为参数问题之后的待办，用户说观感好了很多但尚未亲自使用，不算完整操作验收。

## 脚本必须有界

不要再留下“Inspect element bounding boxes”等持续等待任务。每个短检查有显式截止时间（建议10–30秒；SDK单阶段按已有已审上限），父监督也有截止／退出确认；超时即失败并收尾，不延长成无限等待。只回收本次自己启动并证明身份的进程，保留失败日志；结果不明不要重发或后台重复运行。每次只跑与新变化相关的检查。

## 交付

交付 `docs/RC50_AUTHOR_INITIAL_READ_GEMINI_DELIVERY_20261026.md`，写清：

- 已证实／已排除／尚未证实分别是什么，现场是否仍缺阶段证据。
- 最小触发顺序、实际首个失败码或可重复的离线因果证据；不能仅贴一张“可能竞态”图。
- 修改文件、前后行为和为何不放宽写入门禁；若仅诊断则明确“未修复”。
- 精确测试命令、输出目录、指纹、失败／修正记录、退出与资源清理证明，覆盖范围／替身边界。
- 下一步最小操作及是否需要实机，不自动执行。

同步NEXT_TASK与PROJECT_STATUS，完成后在本Antigravity对话回复交付路径和简短结论，等Codex复审；不用新建对话或切换模型。


## 发送记录

已通过 computer-use 发到 Antigravity 现有“Scroll A Investigation Q1-Q3 Repairs”对话（44d9b078-56c9-47a4-aa8a-a1f673d23d0e），核实该对话正包含用户转述的本次参数审查。保持当前 Gemini 3.8 Flash Medium／Turbo，不切模型或新开会话；单次发送，已见新用户消息与 Working。已只读刷新确认输入清空且仍为Working，没有重复发送。调度证据在 `.tmp/rc50-author-gemini-handoff-20261026-a/dispatch.json`。Codex在交付前不并行改实现，不创建自动监控。
