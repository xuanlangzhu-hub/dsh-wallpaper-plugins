# rc.45 Lucy 粒子临时短验

2026-10-21。当前阶段：**Lucy粒子关闭/恢复及停止清理短验通过，已恢复本轮日常rc.42、原设置和布局，用户已确认正常重开，本轮收尾闭合。** 只覆盖本轮Lucy参数，不扩大到全部作者参数或长期运行。

## 本轮授权与保护

用户本轮明确回复“已正常退出，可以临时安装短验”。范围仅Lucy particles，日常模式、自动播放关闭；不混改scheme color等其它参数，不扩大为侧栏UI改版或性能测试。原WE保持，出错不自动重试。

- 本轮证据：`F:\dsh-wallpaper-plugins\.tmp\rc45-author-settings-short-trial-20261021-93bc7a61`。
- 新备份：`C:\Users\HP\.dsh\backups\rc45-author-settings-short-trial-20261021-93bc7a61`，未使用rc.44历史备份恢复。
- 新鲜预检DSH、WallpaperProbe、伴随窗为0；实际日常rc.42的37文件及完整集合与原包一致。
- 原WE在本轮新鲜记录为PID11300、UTC启动时间`2026-10-21T00:48:27.4842564Z`；安装后按PID+UTC ticks核对保持，不将历史PID直接当本轮证据。
- 备份核验5个Profile文件、9个关闭Local Storage文件、desktop/Preferences/Local State三项目标、rc.42固定原包和实际安装目录。候选原包也保留在本轮备份中。

## 临时安装

固定rc.45 SHA256：`BAD91155A95C457AF0FB52E8C52BC58A765F9F23ACABDA7DD2F6C11F83FDFBCC`。官方bundled CLI安装正常退出，实际版本0.6.0-rc.45、42文件及文件集合与原包一致；未安装rc.43或rc.44。

安装后9个外观存储文件及三项布局目标保持，Profile仅package.json/pnpm-lock.yaml随安装变化；官方EXE、app.asar、WE及236项源码/QA/资产/归档保护输入保持。各有界步骤正常退出、无超时。

本轮重新使用更新的computer-use技能初始化node_repl/@oai/sky，list_apps已正常返回，未再报kernel assets路径不存在。DSH已按用户操作退出，因此未选择或启动其窗口；实际页面操控仍待正常重开后核对，不能仅凭初始化成功声称已代点。

## 待完成

1. 用户按日常方式重开，确认原外观布局，播放保持停止。
2. 取得唯一当前DSH窗口，代操作选择Lucy、关闭自动播放、日常模式，并只测粒子保存/应用、关闭/恢复；分段确认用户实际可见效果。只读取本轮当前Host与精确源身份，真实窗口/会话漂移则重新核对，不盲用旧HWND/PID。
3. 停止清理，核对源/worker退出及原WE身份保持；用户正常退出后先保留测后数据，再恢复本轮rc.42、Profile、关闭存储和布局，37文件核验及正常重开收尾。

本轮目前没有播放、参数下发或视觉验收结果。依据[核包记录](RC45_AUTHOR_REVISION_CANDIDATE_REVIEW_20261021.md)安排，不把109项离线检查等同实机效果。

## 重开与关闭粒子阶段

用户确认“重开正常，外观布局正常，播放停止”。电脑操控已实际连接唯一当前DSH窗口并操作，未再出现初始化故障。通过UI选择Lucy、保留Everyone/日常模式、取消自动播放，开始一次。启动转换期间作者区短暂提示读取失败，播放稳定后自动回到已读取草稿；未手动重试。随后只取消particles，点击保存一次，确认“草稿已保存到本次连接”；点击应用一次，确认“参数已发送；请观察当前壁纸的效果，尚未读取当前值”。未改scheme color等其它作者字段。

playing/off两次只读Host快照证实同一location `WhaleWallpaperProbe-261021071904-1a21`、HWND4132230、采集PID34600、HostPID47092，原WE启动身份保持；仍在daily播放。证据为两个status.json、particles-off-ui-evidence.json及本对话GUI状态。未单独抓取HTTP响应或命令子进程PID；成功提示依据固定候选代码对应Host成功返回，不扩称已记录每个命令IO。当前等用户判断关闭后的实际动效，尚未恢复勾选或停止。

## 恢复粒子、用户观察与停止

用户对关闭阶段明确回复“明显减少或消失了”。随后通过实际GUI重新勾选particles、保存一次、应用一次，成功提示再次出现；用户回复“粒子动效恢复了”。playing/off/on只读快照确认始终是同一location/HWND/采集PID/Host，原WE启动身份保持，未改其它作者字段。两方向可见效果通过，源码修复对应的下发链路在本轮实际可用；这不证明rc.44历史问题全部根因唯一确定，也不扩大为所有壁纸或全部作者参数通过。

通过UI停止后首份快照仍处于stopping且有临时清理helper，未当成清理成功；后续有界核验Host inactive、session为空、lastCleanup.closed=true（outcome=absent）、WallpaperProbe为0、同轮源窗口为0，原WE保持。随后通过DSH“应用→退出”正常关闭；紧接的一次恢复预检因进程尚在退出中而拒绝，未写Profile/存储。再次只读核对窗口与进程均消失后，用独立最终预检通过再恢复。初次拒绝及正常退出过程的工具状态均保留，不掩盖失败或盲杀进程。

停止转换期间作者区也短暂出现读取失败/待接入提示，稳定后恢复；这是待改进的状态反馈，本轮未热改UI，不影响已验证的粒子效果和清理闭合。

## 恢复日常完成，待最后重开

恢复前另存17项测后Profile/外观/布局文件，再以固定rc.42归档经官方CLI恢复。37安装文件完整集合及逐项hash一致，无rc.45专有模块残留；本轮5个Profile、9个关闭存储文件一致，三项布局原已一致，无多余覆盖。官方EXE/app.asar/WE及236项源码/QA/资产/归档保持，所有最终恢复步骤正常退出且未超时；未提交推送或清理。

证据增加on-status.json、visual-and-stop-result.json、live-cleanup-verified.json、restorePreflight初次拒绝及Final结果、after-test-retention.json、settings-restored.json、layout-restored.json、restored-daily-closed.json、restored-final-runtime.json与restoration-summary.json。当前请用户按日常方式重开，确认原外观布局正常、播放停止。未保留rc.45日常，不再重复试播。

## 最后重开确认，本轮闭合

用户对正常重开、原外观布局及播放停止的收尾请求回复“可以的，重开正常”。本轮Lucy粒子关闭/恢复与清理通过，rc.42及本轮原设置/布局已恢复，正常重开收尾闭合。无需再次操作或采样日常应用。当前日常DSH0.2.1-rc.2/外观rc.42/Git Bash0.1.1保持；rc.45原包、本轮新备份和测后数据保留。是否保留rc.45作日常由用户另行安排；侧栏与即时应用改版要求保持，尚未实现。
