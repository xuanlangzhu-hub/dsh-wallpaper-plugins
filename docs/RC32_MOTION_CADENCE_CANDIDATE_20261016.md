# rc.32 运动节奏逐帧诊断候选

2026-10-16后续：[临时短测完成并恢复](RC32_MOTION_CADENCE_SHORT_TEST_20261016.md)。用户仍报告加速减速；同seq记录显示Host写出约40ms、client accept约569ms后密集到达，尚未分清传输/读回调/解析/主线程或trace开销。首run受干扰、鼠标run溢出835/重复191按degraded保留，不称完整验收。已恢复日常rc.28与当轮五Profile/十存储、原环境，用户重开正常保持停止；原WE保留。下一步可手动交小G只做Host→client接缝的离线窄调查，不盲改P4/FPS/RAF。下文为核包时快照。

2026-10-16，Codex。用户授权继续后，基于[收尾复审](MOTION_CADENCE_TRACE_FINAL_REVIEW_20261016.md)及[候选前审查勘误](MOTION_CADENCE_TRACE_PRE_CANDIDATE_ASSESSMENT_20261016.md)固定的源码，完成隔离发布、打包与核包。此文记录候选状态；尚未安装、操作 DSH/WE 或实采。

## 候选指纹与内容

- 归档：`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.32.tgz`
- SHA256：`45CF6BF73EE849A88265F2F0AA14F52087A0923B25C4C10C03C39B32EC6D7A19`
- 大小：7,399,870 bytes；29 文件。
- 实际发布 DLL SHA256：`804EB7868282431CD77A6C6494997B1D16A53DE2667FBE98189451443B9D2309`。
- 相对 rc.31，只有 README、package.json、WallpaperProbe.dll、src/client.js、src/wallpaper/cadence-trace.js、src/wallpaper/frame-hub.js、src/wallpaper/session.js 七个路径不同，其中 cadence-trace.js 是新增文件。
- 19 份原生工程输入冻结到新目录，以 Release / win-x64 / 框架依赖方式 publish；12 个运行文件与实际发布输出逐字节一致，较 rc.30 运行资产仅 DLL 不同；没有把工作区旧 DLL 当成新程序打包。
- 29 个包文件与隔离 package-stage 全部一致；不含 QA 源码、PDB 或离线分析脚本。版本只在隔离暂存目录改为 rc.32。

## 本轮检查与保护

- `npm run check` 通过；包内 index/client 与全部 wallpaper JS 语法检查通过。
- 实际发布 helper：等待自测 54 项通过；pacing 自测 ok=true、mismatches=0、r1Checked=true、snapshotFields=22；trace 自测 ok=true、保留 32 / 溢出 18 / 总记录 50。
- 包内实际 session 模块不启动采集的检查通过：干净 env 默认 Host/client trace 均关闭；仅给进程 env 设置 `WM_WALLPAPER_CADENCE_TRACE=1` 时，两者均开启。正式 session 会据此给 helper 加 `--cadence-trace`。
- 34 份复审输入、54 份当前保护文件与 29 份工作区打包源文件在核包中保持一致。此前获准的 trace 改动没有回退；P4/P3/P2 已通过项不重写。
- 工作区 package.json 仍为 rc.30，12 运行资产与 rc.30 固定基线一致；五份 Profile 不变；日常 rc.28 的 28 个安装文件与原归档一致。
- 本轮之前的 24 个 tgz 全部保持指纹，只新增 rc.32，不覆盖同版本归档。未修改 Local Storage、进程环境或系统/用户环境变量，未安装、启动或停止 DSH/WE，未提交或推送。

此前正式七类 QA、Host106、P2/P3 及真实 I/O/背压/导出故障接缝证据沿用最终复审；本轮只检查新发布物和打包边界，没有机械重跑 GPU 或长测。

## 默认关闭与解释边界

这是诊断候选，用于补足用户报告的三体球“突然加速、突然减速”的时间线。它没有修复或定位该症状。保留 30fps 目标、RAF/latest、P4 局部等待、WHL1 24 字节头、原生 22 / 前端 36 指标及主题/自动播放规则。

启用只采用临时启动环境：在用户正常退出且完成当轮备份后，由本次启动的 DSH 进程继承 `WM_WALLPAPER_CADENCE_TRACE=1`。不写持久环境变量，不编辑包源码强行开启。正常退出恢复时重新使用原启动环境，日常 rc.28 不带该变量。当前只验证入口，没有执行这种启动。

停止后核对同一 run 的 `cadence-trace-native.json`、`cadence-trace-host.json`、`cadence-trace-client.json` 及健康字段，再用仓库 `qa/perf/analyze-motion-cadence.mjs` 的导出函数按 run/seq/连接/代次分析；它是模块，不能把直接执行该文件当成已生成分析结果。

三域各自使用单调时钟，不直接跨域相减。draw 为 Canvas2D 调用完成，WGC 时间戳差值和 cadenceProxyRatio 只作节奏代理，不能证明屏幕呈现时刻或球的物理运动速度。缺失、溢出、未确认尾批、导出失败等需保留 unknown/degraded，不为凑 available 重跑。Argon报告仍需结合 Codex 勘误阅读。

## 下一阶段：另确认方便后临时实测

1. 重新确认当前方便、其它助手暂停、DSH 无任务；由用户正常退出，先不重开。不套用历史“已退出/保持停止”。保存届时五份 Profile、关闭状态 Local Storage、活动包与原启动环境，记录现有 WE 身份，保留原进程。
2. 核验 DSH/本轮遗留 capture/worker 状态，使用官方 CLI 临时安装本归档，再逐文件核对 29 个实际安装文件。只有核验完成后，才通过本轮进程环境启用诊断并让用户打开 DSH。
3. 同一三体、窗口尺寸/外观、日常模式与自动播放关闭，手动开始。建议拆成静止和鼠标两轮，每轮有效观察约 15–20 秒、从开始到停止尽量不超过 30 秒；提前约好由用户按时停止，不在两阶段之间长时间等待聊天。
4. 拆轮原因是每个 collector 8192 条**事件**，客户端正常每帧约六条；30fps 下约 45 秒即可能覆盖，不能沿用同 run 两段各 27 秒再加聊天等待的旧采样方式。若仍溢出，应明确标为降级，不能扩大容量或隐藏标志。两轮源运动初态不同，不称严格 A/B。
5. 分别保存每轮原始输出和用户体感，核查 run/seq/连接、实际等待后端、前台/尺寸、各域间隔与 draw/skip、最终确认/健康；若未复现，只报告该次没有复现。仅元数据，不额外录屏或截图。
6. 正常停止并确认本轮源/capture/worker 结束，保存导出；由用户退出后恢复当轮 rc.28、设置与原环境，核对原 WE/官方文件，最后用户重开确认。安装便利确认之前不执行上述实时步骤。

当前不需要再交小 G 改代码；下一步是取得这两轮针对性实机证据，再决定最小修复。

## 证据目录

`F:\dsh-wallpaper-plugins\.tmp\rc32-motion-cadence-candidate-20261016-135447-2759e599`

- `before.json`、`native-source/`：固定复审/保护/打包源、19 工程输入、旧归档/Profile 指纹。
- `native-publish/`、`publish.log`、`native-runtime-hashes.json`：实际发布物及 12 文件比对。
- `published-*-selftest.log` 与 wait/pacing 自测输出：发布程序实际自测。
- `package-stage/`、`npm-pack.json`、`package-smoke.log`、`check.log`：隔离打包、默认关闭/启用入口及检查。
- `audit-candidate.py`、`package-audit.json`、`final-audit.json`：精确归档内容、工作区/日常保护及文档收尾后复核。

包内 README 为核包时快照，后续安装或实测结论另记，不回写归档。
