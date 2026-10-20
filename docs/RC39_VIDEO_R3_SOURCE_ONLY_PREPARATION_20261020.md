# R3 可见源窗口、无采集观察：运行器离线准备（2026-10-20）

后续实测：[无采集可见源黑屏、WE打开失败及路径编码线索](RC39_VIDEO_R3_SOURCE_ONLY_RESULT_20261020.md)已记录；当轮20秒观察/正常收尾与用户重开确认完成，日常rc.38保持。下文为准备/离线阶段历史。

## 结论

**运行器准备完成，33 项离线检查通过；尚未打开任何真实窗口，未验证视频播放。** 本轮只为[R3离线调查](RC39_VIDEO_R3_OFFLINE_INVESTIGATION_20261020.md)准备下一次最小观察。日常 DSH 0.2.1-rc.2 / 外观 rc.38 / Git Bash 0.1.1 保持，未安装或重试旧 rc.39 的 DSH 视频候选。

下一步需按 [AGENTS](../AGENTS.md) 确认用户当时方便/无任务、停止播放并正常退出 DSH，原 WE 保持；关闭后新备份，才进入真实窗口阶段。用户本轮“可以，那继续吧”用于继续准备，不替代当前任务/退出状态核对。

## 范围与固定输入

证据/工具根：`F:\dsh-wallpaper-plugins\.tmp\video-r3-source-preparation-20261020-f8213375`。

- 仅用上轮用户选定的 Everyone MP4：`we-44ebe568602e78737f604f1d`，同一 3790716675 项目，媒体路径与 size/mtime、项目 SHA256 再核验。
- 从固定 rc.39 原归档提取 12 个原生运行文件到 `isolated-helper/`，逐字节哈希记录于 `helper-manifest.json`；不装至日常、不修改归档或生产 assets。它只用于已审的窗口管理入口，可接受 MP4。
- `source_only_core.py` 是依赖注入状态机；`source_only_live.py` 是显式执行的 Windows 适配器及独立父进程监督；`win32_support.py` 沿用已审 ABI/只读身份工具。本轮适配器不用旧宽松 CIM 空输出路径，查询有真实 JSON sentinel、结构检查和 8 秒截止。
- `backup-closed.ps1` 从既有关闭备份脚本最小改本轮路径/用途，动态保存当轮全部 Profile 根文件和完整 Local Storage，不只复制旧集合。默认仅预览，未执行新备份。
- `verify-after.py` 为实验后只读核验，默认预览，必须显式 execute，要求停止/退出证明，再核对原 WE 身份、源消失、日常安装和设置与本轮新备份一致。
- `prepared-inputs.json` 固定 10 项脚本/QA/输入指纹，执行前复核；准备后脚本变动须重审，不能用新 baseline 自动祝福未审修改。

## 运行与收尾规则

默认 `source_only_live.py` 只输出计划，不初始化 Win32、不读进程、不启动 helper。真实入口有显式 `--execute` 与本轮新备份/新确认门禁；直接 worker 入口还必须来自记录的父监督进程和相同 baseline 指纹。

基线要求：

- 新确认、新备份时间在 30 分钟内，无 DSH/capture/伴随窗任务，无其它探针源。
- 原 WE 唯一，PID、完整路径和精确创建 FILETIME 一致，且与新备份相同；不是复用历史 PID/HWND。
- 当前 rc.38 原归档、全部安装文件、Profile/Local Storage 文件集合及内容、新备份内容、批准项目/媒体、隔离 helper 与脚本指纹均一致。
- 全新唯一 location，先持久化 claim 再发开窗命令；不复用已执行过的监督声明，不自动重开或重试。

源窗口只走 `--we-open <新location> <批准MP4> 1280 720`，没有 initial-offscreen、capture、taskbar worker、全局播放/暂停或设备/解码器配置。必须读回唯一窗口，绑定当前 HWND/原 WE 身份；要求可见、非最小化/非cloaked且外框完全位于所在监视器 work area。若不满足即停止/安全收尾，不擅自移动窗口。

准备好后观察默认20秒，核心允许范围1–25秒；按 Esc 或写本轮 `stop-request.json` 会结束观察并正常收尾。用户提前关窗记 closed-early，不重复打开，也不等于画面已验证。正常关闭只针对该次 location/HWND/原WE创建身份，关闭后再证实源消失及原WE保持。

helper 调用总截止8秒，超时只处理本轮持有的 helper 子进程并留证；窗口发现5秒。父监督是独立进程，整体工作预算65秒；ready后25秒若观察器未进入收尾则收束本轮 worker，正常 closing 阶段另给最多10秒的有限收尾预算。超时/异常退出/正常退出但没有完成报告均保持失败，必要时父端只对本轮已声明源作一次身份核验后的正常关闭；这不等于所有外部异步创建都已排除。

开窗返回失败或退出不明、源一直没出现时，即便 find为空也只能 `open-unconfirmed`，不能报安全关闭或恢复成功。窗口复用/多窗/WE身份变动、查询损坏、关闭拒绝均拒绝盲关，保留证据并报告未知；不会全局结束 WE/Node/Edge，或删除实验目录。若超时窗口仍可能迟到，要先人工审计/新只读核对，不能自动继续安装、恢复或下一轮。

## 独立离线检查

`offline-final-exit.json`：退出0、exitConfirmed=true、无超时；`offline-final.stderr.log`：33个 unittest 方法通过，另含参数化负例。

| 检查 | 覆盖 |
| --- | --- |
| 纯状态机 | 新鲜授权/错误时间/非法location/观察上限、繁忙/其它源、严格WE身份、已有同名拒绝、非法/多窗查询 |
| 所有权/显示门禁 | PID/完整路径/创建时间/布尔伪PID拒绝、HWND复用、隐藏/最小化/cloaked/工作区越界、不合法几何 |
| 失败与终结 | emit在claimed/ready/closing/finished抛错、开窗失败/迟到/发现超时、用户提前关闭、Esc/stop请求、正常关闭拒绝不重试 |
| 实际监督进程 | 真正启动本轮 Python 子进程：正常完成、一直sleep、退出7、退出0却缺报告；均由父监督实际回收/确认退出；窗口IO完全替身 |
| 适配器边界 | plan/缺execute不初始化Native、任意capture/helper模式拒绝、损坏CIM不能变空集、旧备份拒绝、未审代码指纹拒绝、无当前父监督的worker拒绝 |

最初27项检查有2个失败：一是测试把fake wall=1000时的timestamp=0当过期，实际仅1000秒，改为真正超过1800秒的负例；另一项发现初次窗口字典别名会随替身修改而改变所保存的HWND，改为持有初始身份副本，复用负例通过。随后补了“从未看到源时不能信任空集”、外层watchdog、取消、指纹门禁等，最终33项。没有删断言以迁就实现。

PowerShell备份脚本经语法解析且实际只运行默认 preview；Python文件 AST 解析通过，实际 plan 输出 `liveQueried=false`。没有运行真实 baseline/open/close/helper/capture，不能把测试子进程或 fake normal-close 写成实机验收。

## Grok 使用结果

本轮确实尝试了两项受监督 Grok 任务，但均到截止没有正文交付：

- `r3-source-only-core-2964def7`：约121.446秒，120秒任务截止，workerExitConfirmed=true。
- `r3-source-cleanup-audit-dfc0f713`：约61.005秒，60秒任务截止，workerExitConfirmed=true。

没有采用部分推理或声称 Grok 编写/审过最终脚本。运行器及独立QA由Codex完成；两项失败原样留证，没有改Grok全局配置、重启服务、恢复定时或无限重派。`C:\Users\HP\.codex\tools\grok-worker\runs\`保留退出结果。

## 下一轮执行顺序（当前未执行）

1. 用户确认当时方便：暂停其它助手，DSH无任务、停止壁纸、菜单正常退出，原WE保持。
2. 关闭状态执行本轮 `backup-closed.ps1 -Execute`（另有外层截止），核验新备份。
3. `source_only_live.py --mode baseline --execute --ready-confirmed --backup <本轮closed-backup.json>`，只读现场与指纹，生成新 ready-baseline。
4. 先告知用户窗口出现即观察、到时会自动关闭，再通过 `--mode run --execute --baseline <ready-baseline.json>`启动父监督；不直接启动worker。及时读取ready结果，用户观察同一视频是否正常动态。
5. 到时正常收尾，保留worker/supervisor/原生管理调用结果；`verify-after.py --execute`核验。源动/不动/不确定由用户如实反馈；不自动加采集或屏外对照。
6. 若确认源清理、进程退出及设置一致，用户正常重开DSH并确认外观/布局及停止。出现任何不确定性，先留证，不盲恢复或继续。

本轮没有产品改动、打包、安装、Profile写入、真实窗口操作、推送或清理。开发manifest/assets仍rc.30，日常rc.38保持；R3根因仍未知。
