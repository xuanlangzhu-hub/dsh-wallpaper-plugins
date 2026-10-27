# rc.48 日常切换记录

2026-10-25。当前阶段：**日常切换闭合，用户已确认正常重开、原外观／布局和右侧栏目录正常、播放停止；新鲜只读 Host 核验通过，保留 rc.48 日常试用。** 当前日常为 DSH 0.2.1-rc.3／Whale rc.48／Git Bash 0.1.2。

## 固定来源与范围

沿用[rc.48 已完成临时短验](RC48_NATIVE_SIDEBAR_SHORT_TEST_20261025.md)的同一固定归档，SHA256 `93290398BEAFBDCB5B01CB4273D4759A92D4325934CD2FBFA2D1FC26B88CAEAE`，43 个文件；回退 rc.47 原包 SHA256 `21792EBCD902F64AF2F4C4266F6EACC6F92C815634BCCEEDA1925EC3449B4176`，37 个文件。重新只读核对当前安装集合／逐项哈希、宿主 app.asar 与固定包一致。

本次目标为安装后保留 rc.48 日常，原设置／布局保持，不重复 Lucy 粒子短验。重开后核对原外观、布局、顶栏侧栏目录和当前播放状态。原自动播放设置为开启，不擅自关闭；若重开自动开始，正常停止后保持停止供交接。出现异常先保护新数据再按本轮新备份恢复，不能直接套用上一轮备份。

## 本轮独立工具

- 工具／证据目录：`F:\dsh-wallpaper-plugins\.tmp\rc48-daily-trial-20261025-38118984`。
- 计划新备份：`C:\Users\HP\.dsh\backups\rc48-daily-trial-20261025-38118984`，目前不存在。
- 从刚完成短验的已审工具定项复制 24 个工具文件，仅替换轮次目录／授权用途。新配置用途为 `retain-rc48-daily`，未复制旧授权、旧清理证明或现场 PID。
- PowerShell 语法解析、两项归档集合与哈希、当前 rc.47 只读核验通过；Python 缺少本轮授权时明确拒绝。283 项源码／QA／资产／归档保护输入保持。证据为 `daily-preparation.json`、`readonly-daily-check.json`、`archives.json`。
- 新轮获得确认后，仍先验证当前 DSH／采集／伴随已退出、原 WE 唯一身份，才备份本轮 Profile、关闭状态 Local Storage、媒体存储、布局／外观目标及当前安装和固定原包；所有复制哈希核对后才能安装。
- 工具保持既有外层期限、退出结果与失败门禁；无全局杀进程、旧授权复用或自动恢复。准备阶段只写独立工具和文档，没有应用控制。

整体 UI／自绘下拉改版继续后置；开发 manifest／生产 assets 仍 rc.30。无提交推送、清理、其它助手派发或定时任务。本记录将在实际切换后追加结果，不能把准备完成当作日常安装完成。

## 实际安装与关闭状态核验

用户本轮明确回复“已正常退出，可以安装并保留 rc.48 日常试用”；新授权绑定本轮用途、目录、候选／原日常哈希，未复用旧授权。预检确认 DSH／采集／伴随全部退出，原 WE 身份唯一。

本轮新备份已实际创建并核验：5 个 Profile、10 个 Local Storage、9 个媒体文件，三项原布局目标、实际 rc.47 安装目录和两份固定原包另存。全部前置步骤有界正常退出后，通过官方 bundled CLI 安装 rc.48。安装日志有一般 peer dependency 提示，CLI 退出码为 0；不将该提示代替兼容核验结论。

实际 rc.48 43 个文件完整集合／逐项哈希一致，10 个存储及三项布局保持；Profile 只改变安装预期的 package.json／pnpm-lock.yaml，官方 EXE／app.asar／原 WE 身份保持，283 项保护输入不变。此时 DSH／采集／伴随仍关闭，尚未操作真实窗口。证据为各步 result/stdout/stderr、closed-backup.json、supplemental-backup.json、media-storage-before.json、installed-candidate-closed.json、layout-after-install.json、post-install-runtime.json、installation-summary.json。

待用户正常重开确认；不重复作者参数或 Lucy 播放测试。原自动播放若触发，正常停止即可，不改原自动播放设置。以下准备阶段的“计划／不存在／尚未安装”仅描述准备当时，已由本节实际记录替代。

## 正常重开与日常交接完成

用户确认“重开正常，外观布局和侧栏目录正常，播放停止”。随后只读重新发现本轮当前 DSH 及其子进程所属端口，不沿用旧 Host／PID；唯一 Host 返回 inactive、session 为空、failed=false、无错误，目录 ready／26 项，采集进程为 0，原 WE 身份保持。当前安装 43 文件集合／哈希及 283 项保护输入再核对一致。此次没有再启动播放、修改作者参数或操作应用界面。

证据：discover-result.json、live-endpoint-discovery.json、daily-handoff-summary.json。本轮新备份与 rc.47 固定原包保留，安装后不自动恢复 rc.47。未来若需回退，先保护届时新增设置／数据并取得当时操作确认，不能直接覆盖使用本轮之后产生的数据。关闭状态设置一致性证据来自安装后、重开前；运行后的外观／布局／目录由用户确认，不用运行中存储文件哈希替代视觉验收。

本轮已闭合并写 closed-out.json，旧轮次变更入口拒绝再用。整体 UI／自绘下拉改版按用户安排后置；当前范围不扩称所有作者参数／全部壁纸或长期稳定通过。无提交推送、清理、派发或定时任务。前文“待确认”等内容保留为分阶段历史，由本节最终结果替代。
