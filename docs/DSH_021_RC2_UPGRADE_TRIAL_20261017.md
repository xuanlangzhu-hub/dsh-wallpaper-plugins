# DSH 0.2.1-rc.2升级记录：重开及Lucy短验通过，保留日常

2026-10-17，Codex。依据[兼容候选复审](DSH_021_RC2_COMPAT_CANDIDATE_REVIEW_20261017.md)，用户新确认：“已正常退出，可以备份并升级”。此次为实际宿主升级，非测完默认恢复的临时插件试装。正常重开、原外观布局、Lucy播放/鼠标阶段及停止清理短验通过，保留DSH0.2.1-rc.2、鲸系外观rc.35和Git Bash0.1.1日常使用；不扩称全部插件动作或长期稳定已验收。

## 新退出确认与备份

退出后实际DSH与WallpaperProbe进程为0；原WE为`wallpaper64.exe` PID11708、启动时间2026-10-17 17:20:20.609254+08:00、路径`E:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe`。此为本轮身份，不复用历史PID。

新备份：`C:\Users\HP\.dsh\backups\dsh021rc2-upgrade-20261017-570056c0`。

- 2,028个常规文件、977,028,387字节，源/副本SHA256逐项核验，未打印凭据内容。
- 覆盖`.dsh`的所有Profile实体文件、会话、附件、存储、配置、凭据、插件数据等，完整Electron userData，以及两版宿主安装器、4个原日常插件归档与2个新候选归档。
- 记录534个依赖目录重解析点的类型与目标，未盲目解引用外部目录。恢复依赖布局需结合`reparse-points.json`及原官方安装来源；不把这些链接称为已复制全部外部目标内容。
- 既有`backups`不嵌套递归；可重建`cache`/`dsh-runtimes`未纳入副本，原件保留。`files.json`、`summary.json`、`reparse-points.json`与`backup.log`保存明细，不覆盖既有备份。

## 候选安装

通过原官方`resources/runtime/cli/bin/dsh.cmd plugin --profile desktop add`一次安装两个固定tgz，退出0：

- 鲸系外观0.6.0-rc.35：28文件与候选归档逐项一致。
- Git Bash0.1.1：7文件与候选归档逐项一致。
- Profile package.json仅两项归档依赖变化，原bundle顺序及其余依赖保持。pnpm完成时有peer提示，未把提示本身当作失败，也未通过豁免/扩大权限处理。
- 安装后所有备份范围中非Profile文件保持，原外观存储未被覆盖或恢复；候选来源、28/7文件核对及差异证据在`install-candidates*.log`、`installed-candidates-closed.json`、`post-candidate-preservation.json`。

## 官方宿主升级

再次确认DSH未运行、安装器签名Valid后，使用本轮备份的已审官方0.2.1-rc.2安装器以NSIS `/S`启动，保持原安装位置。安装器PID41128，退出0，完成时间2026-10-17T12:10:14.0593690Z（北京时间20:10:14）。未自动启动DSH。

安装后只读核验：

- app.asar实际版本0.2.1-rc.2，buildCommit=`332895e0f7c9d4dbfb29729f5eb367fa263ff986`。
- app.asar SHA256=`47874618BF5B3011FCAAC10CD4C85F69DA333E70D4F99B921207C78D0999512A`，与已审新包一致。
- EXE SHA256=`9C789407850773CE7D914A3EC0476852BF1CEEA69789D8CCF4E39BE953F4BF52`，以归档流核对官方安装器内EXE一致，Authenticode Valid；FileVersion=0.2.1-rc.2。
- 关闭状态下，备份范围非Profile文件无缺失/内容变化；DSH/WallpaperProbe仍为0，原WE身份保持。
- 证据：`host-install-start.json`、`host-install-result.json`、`host-installed-closed-verification.json`、`post-install-processes.json`及`we-before-host-install.json`。

原0.2.0-rc.2官方安装器及rc.34/Git Bash0.1.0已在新备份保留。回退不假定数据自动向后兼容；失败先保护新现场及新增数据，再正常退出并按本轮备份与原安装来源处理。

## 正常重开核对

用户按日常方式重开后确认：“重开正常，外观布局正常，播放停止”。实际主进程PID11316（2026-10-17 20:12:37.530759+08:00），Host PID45468，均来自原官方安装目录。首次重开前后5个Profile文件逐字节保持，差异清单为空；不将活动存储称为冻结。

Host PID45468实际监听127.0.0.1:2261，GET `/whale-wallpaper/status`正常返回：Lucy available、active=false、failed=false、error为空。窗口图标记录绑定本轮主进程且verified=true。此证据确认外观Host已加载；不据此宣布Git Bash、桌宠、推理档位全部动作已实机验证。旧Electron日志目录没有本轮启动日志，未拿旧崩溃日志当新异常。

证据保存在本轮备份的`first-reopen-confirmation.json`、`reopened-wallpaper-status.json`及`profile-after-first-reopen-diff.json`。

## Lucy短验及停止清理

安排Lucy日常模式20–25秒播放、约10秒缓慢移动鼠标后停止。用户确认：“画面和操作正常，已停止并完成清理”。实际日志目录为`C:\Users\HP\AppData\Local\Whale Appearance\wallpaper-preview\2026-10-17T121529-571c-lucy`，记录跨度约30.626秒（含启动阶段）；本轮location=`WhaleWallpaperProbe-261017121529-d7b4`、采集子进程PID6068，源HWND855330属于原WE PID11708。

- 原生最后周期快照789帧/26.759秒，Host最后日志816接收；client最后上报810接收、749 rendered/draw、61丢旧帧，解码/同步/绘制错误均0，diagnostics.errors=0。计数采样时间不同，不作相等性要求，也不称为屏幕FPS或端到端呈现延迟；不宣称零丢帧。
- P4实际报告`kernel-highres-worker`；任务栏worker阶段action-done、workerCleanupSafe=true、warning=null。没有重新要求用户单独验证任务栏/Alt-Tab，不能扩大此项视觉覆盖。
- 停止后实际Host接口active=false、failed=false、error为空，lastCleanup为`outcome=absent/closed=true/waitedMs=274/error=null`；采集PID6068及WallpaperProbe进程均已退出。
- 另以已核验安装内helper执行只读`--window-find`，退出0、结果`[]`，没有剩余测试源窗口。原WE PID11708及其启动时间/路径不变，DSH保持打开。
- `preview-status.json`为停止前最后快照，仍带running=true、cleanup=null；最终停止结论使用上述实时Host状态、进程及窗口核对，不能把旧快照写成停止后的状态。读取其Width/width大小写并存字段时使用保留大小写的JSON解析，首次PowerShell解析错误已修正，不是产品故障。

本轮备份中保存`lucy-status-during-or-after.json`、`lucy-final-host-status.json`、`lucy-short-test-final-verification.json`、`post-stop-window-find.json`及原始3个运行日志副本。

## 结论与下一步

本轮升级在正常重开、既有外观布局及Lucy短播放/停止范围通过，保留新版本，不恢复旧宿主或rc.34。Git Bash0.1.1安装/核包与实际新版SDK离线接缝已通过，但未在真实会话发送命令；桌宠动作、推理档位全套交互、全部主题/壁纸及长时效果未覆盖，由后续正常使用积累，不为补齐清单自动启动工具或模型请求。未启用新Search/Fetch或修改权限。

升级优先项收尾，后续回到独立/吸附设置的正式Host路由、静态页面与生产窗口承载接入，再按库/详情UI方向推进；P0七审只证明离线骨架，不把旧页内面板任务当真正独立窗口交付。后续实现另交小G，不在本轮热改日常安装或自动开展新实机实验。

当前实际安装已是DSH0.2.1-rc.2、鲸系外观rc.35和Git Bash0.1.1；“日常rc.34/旧宿主”仅是升级前快照。P0不在rc.35中，正式独立设置窗口仍未交付。源码工作区manifest/assets仍rc.30冻结。未改小G实现、提交推送、清理、终止原WE或跨会话消息。
