# rc.46 原生侧栏临时短验

2026-10-24。当前阶段：**原生最右侧栏／全年龄图库及Lucy粒子即时关闭／恢复短验通过，用户已分别确认实际效果；停止清理通过，已恢复rc.42和本轮原设置／布局，用户已确认最后正常重开、原外观／布局正常及播放停止，本轮闭合。** 未保留rc.46日常，不把本轮范围扩大为全部UI或参数通过。

## 本轮授权与保护

用户本轮明确回复“已正常退出，可以临时安装短验”。依据[分组准备](RC46_NATIVE_SIDEBAR_SHORT_TEST_PREPARATION_20261024.md)，仅首轮原生右侧栏、少量外观交互及Lucy particles即时关闭／恢复；原WE保持。

- 证据目录：`F:\dsh-wallpaper-plugins\.tmp\rc46-native-sidebar-short-trial-20261024-20058b20`。
- 本轮新备份：`C:\Users\HP\.dsh\backups\rc46-native-sidebar-short-trial-20261024-20058b20`。
- 新鲜预检DSH／采集／伴随进程为0，原日常rc.42精确37文件与固定原包一致。原WE本轮身份为PID12900、UTC启动时间`2026-10-24T04:10:48.1699346Z`；仅供本轮核对，不供未来复用。
- 官方EXE文件版本`0.2.1-rc.2`，ProductVersion`0.2.1.0`，签名有效；官方EXE／app.asar／原WE文件受保护。一次尝试读取runtime/cli/package.json不存在，未以该路径推断版本；之后直接读取EXE版本。
- 5个Profile文件、10个关闭Local Storage文件已复制并逐项哈希核验；三项布局／外观目标desktop、Preferences、Local State、实际rc.42安装目录、rc.42与rc.46固定原包均另存。281项共享源码／QA／资产保护指纹保持。

## 临时安装与核验

通过官方bundled CLI添加固定rc.46归档，正常退出；候选SHA256为`E44108B008CB4D022136BD2568F4F02C75E303D0FF13678AAEE74F411E24DB7E`。实际安装版本`0.6.0-rc.46`，43个文件完整集合及逐项哈希均与原包一致。

安装后10个Local Storage文件、三项布局目标保持，Profile仅package.json／pnpm-lock.yaml随安装变化；官方EXE／app.asar及原WE身份保持，DSH／采集／伴随仍关闭。所有已执行步骤均有界、确认正常退出、无超时。电脑操控技能已重新读取并初始化@oai/sky，未选择、启动或采样应用窗口。

## 接续

请用户按日常方式正常重开，确认原外观和布局，先保持播放停止。随后Codex绑定当前唯一窗口，分步代点侧栏及Lucy即时粒子开关，用户只确认真实效果。异常时停止并保留证据，不自动重复试播。

实际播放后须用本轮新的Host／location／HWND／采集身份核对清理，不能套用rc.45旧采样脚本。正常退出后先保留测后数据，再恢复rc.42及本轮原设置；精确37文件集合、设置与正常重开确认后才收尾。

本节原为安装后的接续计划；当前结果见文末恢复记录。未改开发manifest／生产assets版本、提交、推送、清理或派发。

## 正常重开与原生侧栏

用户确认“重开正常，外观布局正常，播放停止”。使用本轮重新列出的唯一DSH窗口，打开顶栏Whale外观，实际显示在桌面端最右侧的原生标签页容器，聊天区域随之收窄，没有另开Edge或旧浮层。原有文件预览标签仍在，未关闭用户原标签。

图库自动加载，实际截图确认仅全年龄勾选、敏感／成人未勾选。选中Lucy不启动；播放选项为日常模式，原自动播放为勾选，已通过UI取消。亮度由81设为80，控件读数同步；这仅证明控件交互，未要求用户比较1%亮度视觉差异。没有打开旧设置编辑器，本轮尚未验证完整双编辑器互斥。

## Lucy关闭粒子，等待真实效果

通过UI手动开始一次；新鲜只读Host发现播放前inactive、session为空、采集为0，目录26项ready。开始后确认daily／lucy／active、无错误。本轮绑定HostPID35756、端口11286，采集PID8616、HWND2885384、location `WhaleWallpaperProbe-261024054408-1d67`；原WE身份保持。playing和off快照证明同一轮，未重启播放。

点击“读取作者设置”一次，加载6项布尔参数；初始值明确提示未从壁纸读取。仅点击particles一次关闭，没有点击保存／应用，也未改其它作者字段。先出现忙碌反馈，随后该行出现✓和“下发已确认，效果请观察”；命令确认不等同实际效果，现等用户观察5–10秒后的反馈，之后才恢复开关作对照。

证据为reopen-user-confirmation、live-endpoint-discovery、playing-status、off-status、particles-off-ui-evidence及本对话实际UI截图／无障碍树。未单独保存参数HTTP响应或原生命令进程IO，不能据此声称记录了全部底层命令。尚未恢复粒子、停止、恢复日常或完成视觉验收。

## 用户确认两方向效果，正常停止与退出

用户关闭阶段回复“明显减少或消失了”。Codex随后仅再次点击particles开关一次，重新勾选，即时出现下发确认✓；没有保存／应用按钮链，未修改其它作者参数。用户回复“粒子动效恢复了”。playing／off／on三份状态绑定同一Host、location、HWND和采集身份，原WE保持；没有通过重启壁纸代替即时更新。

通过UI点击停止一次后，Host清理核验inactive、session为空、lastCleanup.closed=true、outcome=absent、waitedMs=210；采集进程为0，同轮源窗口查询为0，原WE保持。没有反复停止或强杀。

随后通过DSH“应用→退出”正常退出；立即列应用仍短暂显示窗口，不把这当作已完全关闭。之后独立有界restorePreflight核对进程、伴随、同轮源均退出才允许写入。没有复用旧location或历史退出状态。

## 恢复rc.42完成，待最终重开

恢复前已另存测后Profile／Local Storage／布局数据。官方CLI恢复固定rc.42，实际37文件完整集合及逐项哈希一致，rc.46新增模块无残留。5个Profile文件、10个关闭存储文件逐项恢复一致；三项原布局目标本就保持一致，无多余覆盖。官方EXE／app.asar、原WE身份及281项共享源码／QA／资产保持，Profile最终无变化。

证据增加on-status、visual-and-stop-result、live-cleanup-verified、restore-preflight、after-test-retention、settings-restored、layout-restored、restored-daily-closed、restored-final-runtime及restoration-summary。全部已执行父监督步骤正常退出，无超时或全局杀进程；旧归档、旧备份及本轮新备份保持。

当前实际日常已恢复DSH0.2.1-rc.2／外观rc.42／Git Bash0.1.1，等待用户按日常方式正常重开确认原外观／布局、播放停止；不再重复试播。

本轮仅覆盖原生容器、全年龄目录、亮度控件数值及Lucy particles即时两方向效果。完整旧编辑器互斥、全部外观／主题组合、其它作者参数／目标、普通本地视频真实Windows焦点／最小化、新独立窗和长期稳定仍未实机验收。当前按钮／排版仍需后续视觉打磨，不能把功能短验当作全部UI定稿。


## 最终重开确认，本轮闭合

用户明确回复“重开正常，外观布局正常，播放停止”。rc.46首组原生侧栏与Lucy粒子即时关闭／恢复短验、停止清理、恢复rc.42及本轮原设置／布局、正常重开均已收尾。final-reopen-confirmation.json记录用户原话，restoration-summary更新最终确认；不再操作或采样日常应用。

当前日常保持DSH0.2.1-rc.2／外观rc.42／Git Bash0.1.1，未保留rc.46日常。候选包、新备份及测后数据保持。下一组仍为普通本地视频真实Windows焦点／最小化验证，须另行准备并确认当时方便；本轮不自动开下一组，也不据此接受全部UI视觉。
