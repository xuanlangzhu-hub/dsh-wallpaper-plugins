# rc.37短验发现两项问题，已恢复日常rc.35并确认重开正常

2026-10-19。用户确认“已正常退出，可以临时安装短验”，本轮按[rc.37候选计划](RC37_CATALOG_INITIALIZATION_CANDIDATE_REVIEW_20261019.md)执行。**本轮短验停止：开始按钮可用及亮度80同步获用户确认，但独立窗出现Edge账号/同步提示、吸附清理查询报错；已恢复rc.35和本轮原设置，用户确认重开正常、外观布局正常、播放停止。**

## 本轮新备份与安装

- 证据：`.tmp/rc37-detachable-short-trial-20261019-a69050a2`。
- 新备份：`C:\Users\HP\.dsh\backups\rc37-detachable-short-trial-20261019-a69050a2`。5个Profile、关闭状态完整Local Storage的9个文件逐项哈希通过，另保留原desktop设置/Preferences/Local State、活动rc.35文件、固定rc.35与rc.37包。没有覆盖旧轮备份或读取报告外的用户会话内容。
- 入场确认 DSH、WallpaperProbe 和带 `whale-companion-profile-` 标识的 Edge 进程均不存在；原WE为PID11780、创建时间 `2026-10-19T00:49:08.4024581Z`，已在本轮重新读取身份，未用旧记录替代检查。
- 官方CLI实查版本0.2.1-rc.2，调用官方安装目录 `resources/runtime/cli/bin/dsh.cmd plugin --profile desktop add`。固定rc.37 SHA-256 `F0958CEF5FD89ECD7B289921A0EBCC4FE6859E7421D83338AA116555B14D8ED8`，安装前rc.35的28项匹配原包。
- 官方安装退出0，约2.3秒，无超时或强制终止；安装调用有90秒截止与105秒外层watchdog。
- 安装后35项逐字节匹配rc.37，9个关闭存储文件未变；Profile只有package.json与pnpm-lock.yaml按安装流程改变。官方EXE、app.asar、WE文件及原WE进程身份保持，DSH/采集/伴随仍关闭。
- 证据包括 `closed-backup.json`、`supplemental-backup.json`、`install-result.json`、`installed-candidate-closed.json` 和 `post-install-runtime.json`。源码/QA/生产assets/旧归档保护输入保持，工作区manifest仍rc.30。

## 用户首项反馈与后续待验收

用户先询问“开始”是否需要点击；Codex澄清仅观察按钮是否从灰色变为可用，暂不点击。用户随后回复“可以的”。本轮据此记录为用户确认开始播放按钮可用；没有新增工具窗口采样，不把简短反馈扩写为已播放、独立窗通过、全部目录/原布局细节均已验收。首次初始化的离线机制证据保持。

## 实机发现与恢复收尾

用户确认独立页亮度80同步正常，并提供两张截图：Edge自动登录/同步提示及吸附后“窗口关闭待确认”/CIM无效查询。吸附清理判为未通过，未开始Lucy播放；不把同步成功扩成资源清理通过。诊断与补修要求见[两项问题任务](RC37_COMPANION_LIVE_FINDINGS_REPAIR_TASK_20261019.md)。

用户确认独立窗和DSH正常关闭后，本轮重新检查DSH、WallpaperProbe及带独立配置标识的Edge均为0，原WE身份保持。先留存测试后Profile，再通过官方CLI重新安装固定rc.35：退出0，约1.7秒。保留测试后完整存储和Profile，再仅恢复本轮原5个Profile、9个存储文件；28项rc.35安装文件、5个Profile和9个存储哈希通过，既有保护输入保持。没有删除会话、附件、旧归档或本轮证据，没有改系统/日常Edge设置。

关闭态结果见 restore-closed-preflight.json、restore-package-result.json、settings-restored.json、restored-daily-with-settings.json。其后用户回复“重开正常，外观布局正常，播放停止”，本轮恢复收尾已确认，无新增窗口采样。日常DSH0.2.1-rc.2 / 外观rc.35 / Git Bash0.1.1保持；未保留rc.37日常。不继续独立窗重试、Lucy播放或新候选安装。A/三体/GPU暂缓，定时PAUSED。
