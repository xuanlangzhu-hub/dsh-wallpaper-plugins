# 日常壁纸清理恢复 B 首轮复审：需补修

日期：2026-10-18。审查输入为小G的[交付报告](WALLPAPER_CLEANUP_RECOVERY_B_DELIVERY_20261018.md)及实际源码；原[任务单](GEMINI_NEXT_WALLPAPER_CLEANUP_RECOVERY_20261018.md)范围保持。**本轮不通过，下一步仍为 B 补修，暂不转滚动 A。**

正常恢复主流程已经接上：首次缺 Summary 保留、后续独立核验、源窗关闭成功后释放 session，正常 Summary 路径不增加查询。这部分保留。独立核验还有三个失败放行缺口，不能用“测试全绿”代替证明不足时的保护。

## 输入与独立证据

证据目录：`.tmp/wallpaper-cleanup-b-review-20261018-8acabe57`。`frozen/src`是本轮冻结源码，`inputs.json`记冻结输入；`review-probes.mjs`、`review-probes.json`为独立负例及结果；全部 helper/采集动作都是替身，未运行真实 PowerShell、源窗口、DSH 或 WE 操作。

- 本轮 `session.js` SHA256：`C67AB483ABF8C34AC991336EFDE4F97B73461171CF278C6505FDDACE284A74B3`。
- 对照 P1A 十审的161项输入，仅 `session.js` 变化；59项生产资产/归档全部一致。见 `preservation.json`。
- `npm run check`通过；冻结副本上复跑交付新增12项全部通过。
- Host JavaScript相关103项全部通过，见 `wallpaper-host-js-tests.log`。测试副本只调整硬编码 `F:\out` 到本轮目录，外部进程查询由 `offline-guard.mjs`阻断；生产源码未改。默认查询解析另由下面的底层 `execCommand`负例覆盖。
- 初次在名为 `frozen` 的副本直接跑全套时，15项原生 CLI 测试因未携带隔离原生测试产物而失败，另1项因包目录名断言失败；日志保留于 `wallpaper-tests.log`。随后使用包名正确的副本，明确只重跑上述103项 JS 检查并通过。本轮未重新编译/验收原生 CLI，不宣称全套118项通过。
- 独立探针共12项：3项查询协议负例、6项危险放行、1项合法对照和2项拒绝对照。它们对当前缺陷行为作断言，脚本退出0表示复现成立；补修验收须反转危险用例的预期。

## R1（P1）：损坏查询记录被当成“无进程”

位置：`dsh-whale-mist/src/wallpaper/session.js` 的 `queryWindowsProcesses`（约89–174行）。

解析 `{}`、`[{"Name":"WallpaperProbe.exe"}]`、`[null]`均得到 `ok:true, processes:[]`。循环把缺PID/非法记录跳过，丢掉“查询结果不可信”状态。不是 JSON 语法错误才算失败。默认生产分支的 `execCommand`注入 `{}` 后，在完整 session 两次 stop 中，第二次实际调用源窗关闭1次，返回 `closed:true`。

补修：查询协议区分“可信空结果”和“无效记录”；缺失/非法必要字段、非法行类型、错误结构等返回未知/失败，不静默过滤成空集。严格验证 location 输入与记录格式、字段类型、元数据和归属；如采用封装协议，明确其版本和计数，避免只凭空 stdout 宣称完整查询成功。查询自身排除应依据实际查询者身份，不能任意以命令行出现 `Get-CimInstance`/`Win32_Process` 两个子串丢掉记录。执行错误、超时、读取字段失败和无效结果均须保留锁，不调用源窗关闭。

## R2（P1）：动作报告缺身份/缺安全证明仍被接受

位置：`verifyIndependentWorkerCleanup`，约249–281行及 runClose 调用处。

独立生产 session 探针中，下列输入均使二次 stop 关窗1次并释锁：

| 输入变体 | 当前实际结果 | 补修后应有行为 |
| --- | --- | --- |
| 仅 `{schemaVersion:1, location, stage:'action-done'}`，无 requestedIdentity/action | `closed:true` | 证据不足，保留 |
| action 中删除 cleanupSafe | `closed:true` | 证据不足，保留 |
| action.exited=false | `closed:true` | 未证实退出，保留 |
| requestedIdentity.startUtc 改成2099年 | `closed:true` | 无可信身份关联，保留 |

现逻辑只在字段存在且 truthy 时比较 HWND/PID，只拒绝 `cleanupSafe === false`，未要求明确安全或退出证明，也完全没绑定创建身份。查询虽收集 CreationDate/ExecutablePath，却未进行创建身份关联；当前过滤只证明“查到了哪些命令行含 location 的记录”，不能夸称已经严格证明 capture/worker 身份。

补修：形成按真实原生协议分支的必要字段规则，缺字段/错误类型/未知 stage 不可授权；动作已启动分支必须有可信的本轮终结/退出证据，不能用 `!== false`或 stage 字符串替代。把本轮 source/capture/worker 的实际必要身份和创建时间关联设计完整，无法从旧接口取得证明时保留未知或补隔离协议；不能把旧 action 文件的 startUtc 自己当成期望身份。不要机械给所有“从未启动”分支补不存在的 exited 字段，而应分别证明“确实从未启动”与“已启动且终结”。正常合法对照必须仍可恢复。

## R3（P1）：未收到首条状态不等于 capture/worker 从未启动

位置：`verifyIndependentWorkerCleanup` 约285–293行；`captureStarted` 在 `onChildStderr` 收到 `captureSource:'window'` 才置 true。

独立探针真的经过 `spawnChild` 创建采集替身，并让它退出但不发任何 Status/Summary，也不提供 action 文件；二次 stop 仍因 `!captureStarted` 返回 safe，最终关窗释锁。这个变量描述“Host是否收到过首条特定日志”，不能证明原生端没有执行到启动 worker。

补修：删掉这种用观测缺失推出未启动的授权。记录真实启动阶段/身份与证据来源；采集已经创建、日志丢失或管道异常时，必须走可信独立核验，未知则保留。周期 `nativeStatus.taskbarHide.attempted=false`也可能早于真实动作，须防止将早期状态升级为最终证明。无日志/无动作文件负例必须贯通 session/路由并验证无关窗、无释锁；后来补齐合法证明再重试应恢复成功。

## R4（P2）：rc.35 对应回放未实际交付，报告需校正覆盖

交付称 `.tmp/wallpaper-cleanup-b-replay-20261018/rc35-test/` 已验证纯 rc.35 修复。实际目录只有 `session.js`，SHA256为 `670DE9B99AC9F89751234F7C018923537DB97B42D04AAFCC8F10E1766F3FB527`，与事故冻结的**未修复**rc.35文件完全一致；无 `queryWindowsProcesses`、`verifyIndependentWorkerCleanup`、`closeAttempts`，且该目录缺相对依赖。主 replay 脚本实际导入当前源码树，不能证明纯 rc.35 对应修复通过。

补修：用固定 rc.35 原归档在新的独立暂存目录建立可运行基底，最小整合本轮修复，冻结输入、保存差异和运行命令/结果；用同一正确行为回放证明日常基底对应链路。保留旧目录原样，不覆盖旧失败/未完成证据，不打包安装。交付矩阵的“并发”目前 Scenario 8 只是顺序 await；需新增实际并发 stop、旧轮迟到结果不污染新轮、timer/listener 不重复的断言，或如实标为未覆盖后补齐。

交付第1/5节把 force-kill 写成缺 Summary 的已证实因果，证据只支持日志窗口中未见最终 Summary、收尾保护没有收敛；请与首次断流仍未知的表述一致。主 replay 故障数据来自真实日志，但进程查询与关闭均为替身，应称“事故数据离线回放”，不要称现场当前资源已证实安全。

## 交给小G的下一步

只补 R1–R4 和对应 QA；保留正常恢复及保护对照。新增负例优先注入底层 `execCommand`原始输出，经过默认查询解析、独立核验、`createPreviewSession`和路由；不要整体替换核验器为 safe 或只改测试预期。当前独立探针的 wrong-location、live-worker 两个拒绝对照，以及合法对照都要保留。

补修报告写到 `docs/WALLPAPER_CLEANUP_RECOVERY_B_REPAIR_DELIVERY_20261018.md`，逐项列明输入/输出指纹、关键调用序列、旧锁保留和合法恢复、新增负例结果、rc.35对应整合证据、并发与迟到结果覆盖及未覆盖项。完成后等 Codex 复审，暂不自动做滚动 A。

本轮日常仍是 DSH0.2.1-rc.2 / 外观rc.35 / Git Bash0.1.1；未安装、退出、重开或采样日常应用，未修改实现/版本/生产资产、提交推送或清理工作区。首次壁纸断流根因仍未知；P1A十审已通过成果保持。本轮用户明确授权 Codex 复审后直接转达小G下一步，因此可发送本补修任务；这不扩大为操作DSH/WE或其它跨会话任务的授权。

转达记录：已通过 Antigravity 原有“DeepSeek Harness 插件项目交接”对话发送上述 R1–R4 补修任务；发送后复核到新用户消息、输入框为空及 Working/Cancel 状态，当前模型仍为 Gemini 3.8 Flash High。仅确认已送达并开始处理，不代表补修已完成；本轮不自动转入滚动 A。
