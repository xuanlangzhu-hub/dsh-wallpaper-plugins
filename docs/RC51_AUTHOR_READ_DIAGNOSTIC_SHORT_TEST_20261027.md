# rc.51 Lucy首次作者读取窄取证：捕获target.unverified，已恢复rc.48并闭合

## 最终闭合

用户确认“重开正常，外观布局正常，播放停止”。恢复后重新发现当前DSH所属Host，随后只读快照确认active=false、session=null、failed=false、error为空、采集进程0，原WE身份保持。见discoverRestored-result.json、snapshotRestored-result.json、restored-stopped-status.json；未刷新目录／打开侧栏／重试作者读取或再试播。库尚未加载是重开后的停止快照，不作为先前失败的解释。

本轮已闭合，保留rc.48日常，备份／失败证据／测后数据保留。后续仅按目标验证线索继续离线定位，不宣称根因已定。下方内容为闭合前过程记录。

## 2026-10-27 最新结果（覆盖下方安装阶段历史）

用户正常重开确认后，Codex打开原生侧栏，仅Everyone目录23项，翻页1→2→1后选择Lucy；日常模式，原自动播放临时关闭。只启动一次Lucy，无作者重试／保存／应用／参数修改。画面进入播放，首次作者自动读取实际显示：`未能读取设置，请重试 [target.unverified]`。

首个失败阶段已收窄到目标验证边界，但未证明启动竞争或缺哪一个字段。target.unverified映射target-unavailable，实际控制器application.available或targetActive门禁仍需沿固定包核对。原始作者响应未保留，没有为补响应而手动GET／重试。稍后状态Lucy daily active、captureStarted=true、采集PID2552、源HWND7344372；这份晚于首读的快照不证明首读当刻满足全部身份条件。

证据在`.tmp/rc51-author-read-short-trial-20261027-a/`：first-read-outcome.json、first-read-target-unverified.png及同名-ui.json、author-read-failed-status.json。

一次正常停止后active=false、session=null、capture为空，lastCleanup outcome=absent、closed=true；原WE身份保持。通过应用菜单正常退出DSH，等待自然退出；live-cleanup-verified.json及restore-preflight.json通过，无强杀DSH／原WE。

先留测后数据，再恢复日常rc.48、本轮5Profile／10Local Storage、原布局及IndexedDB／blob_storage两树，媒体9文件与测后媒体均保留。关闭状态最终核验通过：43安装文件、10存储文件一致；Profile文件集合及全部哈希一致（changedProfileFiles为空）；3布局目标一致（实际需替换0项）；媒体恢复与回读通过；官方EXE／ASAR／WE文件及原WE进程身份保持；DSH／采集／伴随关闭。见restored-daily-closed.json、restored-final-runtime.json、restoreLayout.stdout.log、mediaVerifyRestored-result.json。

媒体恢复曾在布局证明生成前被前置门禁拒绝，尚未执行媒体写入。保留mediaRestore失败，完成restoreLayout后用mediaRestoreRetry同脚本重试成功，未削弱门禁或覆盖证据；见media-restore-retry-reason.json。恢复预检仅将通用playing证据绑定改为本轮真实author-read-failed／snapshotReadFailed，保留原脚本，无伪造playing快照或放宽源身份检查；见diagnostic-snapshot-binding.json。

当前DSH关闭，待用户日常方式重开确认原外观布局、播放停止，再只读核对恢复Host后闭合。自动播放已恢复原设置，若触发正常停止即可。后续只离线沿固定包index readTarget／ApplyAdapter／session源启动时间和采集身份传递定位，不重复实机或先放宽门禁。“▶ 播放”文案后排。本轮未向Gemini派新实现、未推送清理或开定时。

## 下方为安装后、实测前历史快照

2026-10-27。用户明确回复“已正常退出，可以临时安装取证”。本轮默认测后恢复日常rc.48及本轮原设置，不保留rc.51为日常。

## 当前状态

新鲜关闭预检、原WE身份、真实序列化授权检查及本轮新备份通过；5个Profile、10个Local Storage文件、9个IndexedDB／Blob／媒体存储文件、原布局和rc.48实际安装副本保留。备份位置：`C:/Users/HP/.dsh/backups/rc51-author-read-short-trial-20261027-a`。

rc.51已临时安装，43文件与固定候选一致，外观存储及原窗口布局保持；官方EXE／ASAR／原WE未改，当前DSH／采集／伴随进程仍关闭。CLI仅替换插件及Profile package.json／pnpm-lock.yaml；候选manifest的peer声明与rc.50相同，安装日志有既有peer warning，未额外升级依赖。安装结果不当成视觉／播放验收。

候选SHA256：A8AA341F560C17CB7AC85817DFB205404AE7C2765F2F29B15CF436F912313725。工具与证据目录：`.tmp/rc51-author-read-short-trial-20261027-a/`，当前证明入口installed-awaiting-normal-reopen.json、installed-candidate-closed.json、post-install-runtime.json。

执行前发现补充备份脚本的POSIX候选路径未被此前Windows路径适配替换，已在任何生产备份／安装前修正并核验固定hash；描述性backup purpose同步rc51，门禁未改，见preinstall-path-correction.json。没有使用旧授权、旧Profile备份、旧布局或原WE快照。

## 尚未完成

等待用户按日常方式正常重开并确认原外观布局、播放停止；此步不让用户进入通用设置／刷新／改参数。随后Codex代点原生侧栏／Everyone目录，选Lucy，日常模式、自动播放关，单次首次作者读取取安全阶段码。若首读成功则如实记录未复现，不无限重试。

错误先留阶段码／截图及必要状态，不点重试／保存／apply。正常停止确认清理，再正常退出；先保留测后数据再恢复rc.48及本轮原设置／媒体／布局，核对正常重开。当前尚未播放、尚未取到实际阶段码、尚未恢复，不能关闭本轮或宣称问题已修复。

日常基线DSH0.2.1-rc.3／Whalerc.48／GitBash0.1.2，当前临时安装rc.51。开发manifest／生产assets仍rc.30；无推送清理、定时或Gemini新实现并行。
