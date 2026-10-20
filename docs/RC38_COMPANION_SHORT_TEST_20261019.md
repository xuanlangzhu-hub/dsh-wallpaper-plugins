# rc.38合并短验通过，rc.35与原设置已恢复并确认正常重开

2026-10-19，用户本轮确认“已正常退出，可以临时安装短验”。按[候选复审计划](RC38_COMPANION_REPAIRS_CANDIDATE_REVIEW_20261019.md)执行。**用户已确认正常重开后外观/目录正常、无账号提示、亮度80同步并吸附成功。只读核验伴随进程与采集进程均为0、原WE身份保持；Lucy画面/操作流畅及停止清理获用户确认，原生源窗口关闭、任务栏worker安全退出、采集/伴随进程0与原WE保持已核对；10月20日用户继续后已重新核对关闭态，恢复rc.35与原5个Profile/9项存储，28安装文件核验一致；用户随后确认“重开正常，外观布局正常，播放停止”，本轮恢复收尾完成。当前日常为rc.35。**

## 新备份与安装

- 证据：`.tmp/rc38-detachable-short-trial-20261019-88eb1359`；新备份：`C:\Users\HP\.dsh\backups\rc38-detachable-short-trial-20261019-88eb1359`。保留本轮用户授权、源码/QA/assets/归档209项保护哈希及入场git脏改动清单，没有改实现、提交推送或清理。
- 入场重新确认DSH、WallpaperProbe及独立配置标识的伴随Edge均关闭；本轮重新采集原WE身份，仅作保持核对，不复用历史PID或结束原WE。
- 当时实际5个Profile、9个关闭状态Local Storage文件逐项备份/哈希核验；另存原desktop设置/Preferences/Local State、活动rc.35安装文件和两份固定归档。没有读取或覆盖会话/附件内容。
- 固定日常rc.35的28安装文件匹配，候选rc.38 SHA-256 `B417B73F93973564522839CE803AF1BB0AAA2072D35C24E5ACEF0E2C42CF0DEA`、35文件核验。官方CLI实际--version为0.2.1-rc.2，使用官方安装目录 `resources/runtime/cli/bin/dsh.cmd plugin --profile desktop add`，未升级宿主/Git Bash。
- 安装退出0，1,781ms，无超时/强制终止；90秒执行期限和105秒外层兜底未触发。
- 安装后35项文件匹配固定rc.38，9项关闭存储未变；Profile仅package.json与pnpm-lock.yaml按官方安装流程改变，官方EXE/app.asar/WE文件和本轮原WE身份保持。DSH/采集/伴随仍关闭。

证据包括ready-to-install.json、closed-backup.json、supplemental-backup.json、install-result.json、installed-candidate-closed.json和post-install-runtime.json；没有把安装退出0当作交互通过。

## 独立窗阶段实际结果

用户回复：“外观和目录正常，无账号提示，80同步并吸附成功”。据此记录本轮安装后的正常重开、首次目录与独立→80→吸附这一轮交互通过；没有将其扩写为反复弹出/全部控件/长期稳定通过。

companion-stage-check.json为本轮重新读取的进程/安装身份：DSH运行、rc.38仍安装，采集进程0、带伴随配置标识的Edge进程0，原WE身份保持。没有操作窗口或结束进程。本轮独立临时profile删除未取得逐目录归属证据，不能把进程0写成所有临时配置均已证明删除；用户未见清理报错与当前进程退出分别记录。

接下来只做Lucy约20秒播放、约10秒缓慢鼠标移动、停止清理；已记录开始前日志目录集合，用于识别本轮新日志，不沿用旧run/PID。

## 前一阶段操作指引（已完成独立窗部分）

请正常重开DSH，播放保持停止；顶栏打开外观（不先进入通用设置或刷新），观察目录自动出现与原外观。独立窗→亮度80→吸附，确认是否有账号提示、同步或清理报错；异常立即停，不反复重试。随后另安排一次Lucy约20秒播放/鼠标/停止清理。默认仅Everyone，不打开成人预览或三体，不扩展GPU/性能专项。

原受限Computer Use独立窗接口不重试、不换接口绕过；本轮由用户直接操作并反馈，工具仅核验明确授权范围内的安装、设置保护和本轮进程/日志。

## Lucy阶段实际结果

用户回复：“画面和操作流畅，已停止并完成清理”。开始前已冻结日志目录集合，本轮只新增一个Lucy run：`2026-10-19T121549-1c9d-lucy`。已将6份原始文件复制至本轮证据lucy-run并逐项哈希核验，lucy-log-retention.json绑定来源；不使用历史三体或旧Lucy日志替代。

原生summary实际生命周期33.6817秒、950帧，parent-stop正常停止；这些是原生管线计数，不是物理显示FPS或前端延迟。preview-final.failure为空、诊断errors为0；原生windowClose.closed/safeToCleanUp为true，父端最终确认源窗口absent。任务栏动作记录exited/cleanupSafe为true，无timeout。未将单次短验扩称所有壁纸、长期稳定或首次断流根因解决。

lucy-stage-check.json重新核对DSH仍运行、安装rc.38，采集进程0、独立配置伴随Edge进程0、本轮原WE创建身份保持。lucy-short-verification.json记录短验范围通过、209项源码/QA/assets/原归档保护输入不变。没有继续播放、改源码或开始性能/GPU专项。

恢复rc.35的固定包、原5个Profile/9项存储和官方CLI恢复脚本已准备；**尚未安装回rc.35或覆盖运行中设置**。接下来用户通过菜单正常退出DSH，确认本轮已关闭后再保留测试后数据、恢复并核验。

## 恢复安排（执行前计划，实际结果见下文）

短验完成或中止后，用户正常关闭独立窗并退出DSH，重新核对本轮清理及原WE身份。先保留测试后Profile/存储及新增数据，通过官方CLI装回固定rc.35，再仅恢复本轮备份的原设置，核对28项安装文件与本轮5/9实际集合，正常重开确认原外观布局。未获用户另行明确选择前不保留rc.38日常。定时PAUSED。

## 2026-10-20恢复结果：关闭态通过，用户已确认正常重开

用户回复“好，继续吧”后先重新只读核对：DSH、WallpaperProbe和伴随配置Edge均为0，安装仍rc.38。隔夜WE已不是10月19日进程，旧创建身份匹配为false；只记录该变化，不推断是重启系统或重开WE导致。当前WE为PID11980、创建时间2026-10-20T00:48:51.6465382Z、原wallpaper64.exe路径；本轮单独冻结其身份，后续保持核验，未退出、重开或终止WE。官方EXE/app.asar/WE文件及固定包哈希仍与本轮原备份一致。

恢复前核对Profile仅package.json和pnpm-lock.yaml有变化，manifest差异只在dependencies.dsh-whale-mist。重新保留当时全部5个Profile至backup/profile-before-rc35-reinstall-20261020、完整9文件Local Storage至backup/storage-before-rc35-reinstall-20261020，并逐项哈希确认。没有覆盖或删除新会话/附件，也不把旧备份当作今天新建备份。

官方CLI恢复固定rc.35正常退出0，2,426ms，无超时/强制终止。随后先保留恢复前的测试后Profile/存储，再仅恢复该轮原5个Profile/9项存储。最终28个rc.35安装文件、5个Profile、9个存储哈希/数量一致，209项源码/QA/assets/旧归档保持；官方EXE/app.asar/WE文件保持，当前10月20日WE身份保持，DSH/采集/伴随关闭。没有将“今天WE保持”误写成“昨天WE身份从未改变”。

证据：restore-current-preflight-20261020.json、restore-current-baseline-20261020.json、restore-retained-before-reinstall-20261020.json、restore-package-result-20261020.json、settings-restored-20261020.json、restored-daily-with-settings-20261020.json、restore-final-runtime-20261020.json、restore-final-verification-20261020.json。旧脚本/原始记录保留，新脚本单独绑定当前WE身份，未修改历史closed-backup.json。

**用户随后回复：“重开正常，外观布局正常，播放停止”。本轮恢复后的正常重开验收完成，日常为rc.35。** 该结论来自用户反馈，没有额外窗口采样或再次改设置；追加证据为restored-reopen-user-confirmation-20261020.json，前面的关闭态原始记录不回写。rc.38本轮独立/吸附及Lucy短验通过的结论保持；未保留rc.38日常，后续试用另由用户选择。定时PAUSED，无新后台助手任务或新的产品专项。
