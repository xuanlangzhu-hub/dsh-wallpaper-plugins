# rc.41 web 临时短验记录

2026-10-20。用户本轮明确确认“已正常退出，可以临时安装短验”。**临时 rc.41 的批准 web 样例及 Lucy 播放/停止短验通过，用户反馈均正常，实时 Host 与独立源/进程收尾核验闭合。已恢复 rc.40 与本轮原设置并核验，用户正常重开后回复“额，都正常”，本轮临时短验与恢复交接完成。** 不代表所有 web 或长期播放通过；没有保留 rc.41 为日常。

依据：[候选离线交付与审计](WALLPAPER_WEB_OFFLINE_DELIVERY_20261020.md)。候选归档 SHA256 `DB920CCD4E0436AF384F3C68E00DE60F7275A20422F0BB8DB9FF01CC4EACB03A`，回退 rc.40 归档 SHA256 `E83255202DCE92EB1FC1C37345827544729AA769BCB669CB61169024ABA4F1FB`。

## 本轮新备份及保护

- 证据根：`F:\dsh-wallpaper-plugins\.tmp\rc41-web-short-trial-20261020-f9f029b4`，包含 authorization、git 状态、220项源码/QA/资产/归档保护指纹、归档成员、关闭备份、安装与前后核验。
- 新备份：`C:\Users\HP\.dsh\backups\rc41-web-short-trial-20261020-f9f029b4`。5 个 Profile 文件、9 项关闭 Local Storage 逐项一致；活动 rc.40 的37项、前后两原包和 desktop/Preferences/Local State 补充保留。没有复用前轮旧备份。
- 当前 DSH/WallpaperProbe/伴随 Edge 已关闭；保留原 WE 精确 PID/启动时间。本轮原 WE PID11980，启动 UTC `2026-10-20T00:48:51.6465382Z`，仅作本轮身份，后续仍重新核验。
- 安装使用官方 bundled CLI `plugin --profile desktop add` 固定本地 rc.41 tgz。DSH EXE/app.asar、WE 文件及原 WE 身份保持。Profile 变化仅 package.json / pnpm-lock.yaml；关闭存储9项及220项保护输入保持。
- 安装进程 exit0 已确认、3.505秒，无超时；实际安装37项文件集合和SHA256与候选相同，rc.41版本正确。前置、备份、保留、安装、核验由有界父监督记录本轮自有子进程退出，未全局结束任何进程。

## web 播放与停止结果

- 本轮 ID 为 `we-04cfda7edaf159881d4a383d`，daily；唯一 location `WhaleWallpaperProbe-261020080823-0d49`，源 HWND1313138 / 原 WE PID11980，本轮采集 worker PID46752。用户确认未发现画面、操作或停止问题。
- 只读观察器76项采样、正常退出0，76.035秒包含等待用户开始；34项活动采样从UTC08:08:23.487至08:08:57.004，含启动和停止阶段。原生总结实际采集29.280秒、799帧/799变化，client 639次decode/draw、解码/同步/绘制错误0，诊断错误0；这些是管线计数，不是屏幕FPS或性能结论。
- 原生 parent-stop 正常收尾，windowClose.closed=true/outcome=closed；随后 Host active=false/session=null，lastCleanup.closed=true/outcome=absent，MP4桥目录整轮无租约。`web-watch.jsonl`、`web-watch-summary.json`、`web-user-feedback.json`、`web-watch-result.json`及`webWatch-result.json`留证。
- `web-stopped-verification.json`再次实时确认绑定 Host、无活动session/采集进程、按本轮精确location查询不到源窗口、原WE精确启动身份保持。没有启动第二轮播放或改动原WE。
- 独立收尾检查前三次因核验脚本问题拒绝：ConvertFrom-Json对象拒绝原生Width/width字段；CIM微秒时间被错误地与Get-Process高精度时间直接比较；window-find误传了location参数而触发helper用法错误。依次改为-AsHashtable、同CIM来源精确时间/父PID比较、真实无参window-find后精确过滤location，最终`webStoppedConfirmed`退出0/3.218秒通过。失败日志均保留；未使用时间容差、盲关窗口或降低身份标准。用法错误没有启动采集。

## Lucy 回归与恢复

- 用户反馈“测过了，都好了，可以恢复了”。Lucy observer83次采样、83.195秒（含等待开始）正常退出0；28项活动采样，唯一本轮worker PID20712，location `WhaleWallpaperProbe-261020081251-8a77`。最后保留的原生状态22.592秒、666帧/变化，client decode/draw错误0、诊断错误0；这些是最后观测值，未将其冒充最终总计或显示FPS。
- Lucy的1秒采样没有保留停止瞬间的原生windowClose总结，旧web汇总器把这个缺字段错误当作生命周期未闭合而拒绝，失败保留。调整为如实记录“最终原生close未采到”，仍要求Host已停止并由独立现场核验补齐：`lucy-stopped-verification.json`确认Host session为空、清理closed、采集进程0、本轮源窗口不存在、原WE精确身份保持；`lucyStoppedFinal`2.755秒退出0。不推断未见的原生总结，不放宽产品清理门禁。
- 用户确认“DSH 已正常退出，可以恢复”后，`restore-closed-confirmation.json`核对DSH/采集/伴随窗关闭、原WE保持。先把测后Profile/存储/布局另存于本轮备份下`retained-before-rc40-restore`及`electron-local-storage-after-test`，没有删除原测试证据。
- 官方CLI恢复固定rc.40，2.819秒退出0；恢复本轮5项Profile/9项关闭存储，2.455秒退出0。desktop/Preferences/Local State与原备份均相同，无须额外覆盖，`layout-restored.json`留证。
- `restored-daily-closed.json`核对rc.40的37项文件集合及哈希、9项关闭存储、220项源码/QA/资产/归档保护输入均一致；`settings-restored.json`与`restored-final-runtime.json`确认5项Profile一致（变化列表空）、宿主EXE/app.asar/WE保持、DSH/采集/伴随进程关闭。所有恢复监督子进程已确认正常退出。

## 恢复重开确认与后续

用户针对“正常重开，确认原外观和窗口布局正常，播放先保持停止”回复“额，都正常”。本轮恢复交接闭合，证据见`restore-handoff-confirmed.json`；未为收尾重复播放、采样或读取重开后的活动存储。日常保持rc.40；是否日常换用rc.41由用户另定，不因web短验通过自动保留候选。后续按既定顺序收束application可行性与Scene大小写缺口，作者参数后排。

以下是本轮已完成的原定流程，保留作为范围记录：

本轮重新按 DSH 进程树及其监听端口绑定唯一 Host，实时 GET status 确认无活动 session、原 WE 精确身份保持；没有用前轮端口或会话。`live-endpoint-discovery.json`、`discover-result.json`和`reopen-user-confirmation.json`保留本次核对。只读状态观察器总期限140秒，外层150秒中止及最终退出报告，不主动开始播放、不修改设置、不发送模型请求。

1. 用户正常重开，保持停止；顶栏 Whale 外观仅 Everyone 中选择批准的“Deepseek鲸鱼娘萌物！”，日常模式、关闭自动播放，先检查目录/状态/控件。
2. 单轮手动约20秒观察秒钟和粒子，随后停止并等待清理；实际状态及源/worker/采集归属和退出另记录，失败即停。
3. 清理闭合后 Lucy 手动15–20秒短回归，再停止。
4. 用户正常退出后先保留测后数据，恢复本轮 rc.40 / Profile / 关闭存储；逐项核验和原WE保持，用户正常重开确认。

这次仅验证本机批准 web 与 Lucy，不展开其它分级、作者参数、输入转发、音频或长期循环。当前日常已恢复 rc.40；rc.41 候选及证据保留。无新提交推送、无历史清理，不改系统代码页/解码器/GPU，不自动安装其它版本。
