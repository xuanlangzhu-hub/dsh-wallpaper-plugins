> 后续日常切换已按新授权完成，当前保留rc.40，见[日常交接](RC40_DAILY_TRIAL_20261020.md)。下文本轮恢复rc.38为短验结束时状态。

# rc.40 MP4 ASCII 桥接临时短验（已完成）

本轮结论：批准的Everyone MP4连续播放、界面操作及停止正常；Lucy回归正常。源窗口关闭/采集退出/副本清理证据通过，原WE保持。已按约恢复rc.38、5个Profile/9项关闭存储及原布局；用户最终确认“重开正常，外观布局正常，播放停止”。当前日常仍rc.38，rc.40仅为通过本轮短验的候选，未获日常保留授权。

以下按阶段保留过程记录，旧“待重开/尚未恢复”不代表最终状态。

2026-10-20。用户本轮确认“已正常退出，可以临时安装短验”。当前临时安装 rc.40，尚未重开或试播；默认测后恢复日常 rc.38 和本轮新备份设置，不将安装/离线检查等同可见播放验收。

- 新备份：`C:\Users\HP\.dsh\backups\rc40-video-short-trial-20261020-c004781e`。5 个 Profile、9 项关闭 Local Storage 已逐项核验；另保留原布局/Preferences/Local State、rc.38 安装35项及原包。
- 证据目录：`F:\dsh-wallpaper-plugins\.tmp\rc40-video-short-trial-20261020-c004781e`。安装与复核各独立有界执行，退出确认，无超时。
- 官方 CLI 安装 rc.40 成功，实际安装文件集合与 tgz 的37文件及SHA完全一致，无多余文件；关闭存储9项保持。218项源码/QA/assets/原包保护输入保持。
- rc.40 tgz SHA256：`E83255202DCE92EB1FC1C37345827544729AA769BCB669CB61169024ABA4F1FB`；回退 rc.38：`B417B73F93973564522839CE803AF1BB0AAA2072D35C24E5ACEF0E2C42CF0DEA`。
- 安装后 DSH/WallpaperProbe/伴随窗仍关闭；原 WE PID11980、启动UTC2026-10-20T00:48:51.6465382Z 与本轮预检一致。官方EXE、app.asar、WE EXE哈希保持。该身份仅用于本轮核对，后续仍实时复核。
- 旧采集运行目录仅复制JSON/JSONL/TXT/LOG元数据，见 `prior-run-metadata-retention.json`；未复制图片/视频，避免新播放裁剪旧证据。
- 下一步：用户正常重开，确认外观布局/目录和模式/自动播放控件；仅Everyone、同一批准MP4，日常模式且自动播放关闭，暂不开始。随后按视频结果安排Lucy短验，失败即停止，不重复试播。
- 试验结束先核实停止/源与worker退出及副本清理；用户正常退出后保留测后数据，再恢复本轮rc.38与原设置，核验并请用户正常重开。未知归属/迟到IO保留，不盲删cache。

249项实际候选离线检查及构建边界见[候选复审](RC40_VIDEO_ASCII_BRIDGE_CANDIDATE_REVIEW_20261020.md)。视频连续动态、UI修复、清理与Lucy尚待本轮用户及实际运行证据，不扩称所有视频/音频/帧率/长期稳定。

## 正常重开与视频准备

用户确认“重开正常，控件可见，视频已选好，尚未播放”。本轮按DSH进程父子关系发现Host为127.0.0.1:3197、拥有PID29688；实时状态active=false、activeSceneId=null、目录ready且26项、采集进程0，原WE身份保持（live-endpoint-discovery.json）。本次授权MP4 project/文件哈希与此前批准一致，类型video、分级Everyone、43,235,218字节。已启动总截止170秒、外层180秒监督的只读状态/副本元数据记录，要求视频约20秒后停止。画面效果与清理结果尚待用户反馈，尚未安排Lucy。


## MP4 短验通过（本轮范围）

用户反馈“视频连续播放，操作和停止正常”。只读监视70项样本正常结束，无超时，32项active样本的身份均为批准视频、模式daily，观察到受控lease及停止后空cache。末次原生摘要668帧/628变化、24.681秒、parent-stop，源窗口关闭证明closed=true；采集PID13192已退出，实时Host active=false/session=null/lastCleanup.closed=true。源窗口由原WE PID11980承载，关闭窗口不等同退出原WE进程；原WE启动身份保持。采集/渲染计数不等同屏幕FPS。新运行元数据保留见video-run-retention.json。随后只进行Lucy回归，结束默认恢复rc.38。


## Lucy 短验通过，待正常退出恢复

用户反馈“Lucy画面、操作和停止正常”。只读监视60项样本正常退出，无超时；实际活动身份lucy、模式daily，源窗口关闭证明及帧变化保留于lucy-watch-summary.json，原始运行元数据见lucy-run-retention.json。实时Host停止、session为空、lastCleanup.closed=true，采集为0、cache为空，原WE保持。

复核脚本首次将CIM微秒CreationDate与Get-Process的100ns StartTime直接比较，因末尾8 ticks精度差误报Host身份变化；改为同一API的PID/Name/Parent/CreationDate逐项精确比较通过，未使用时间容差、未更改产品实现。

接下来请用户正常退出DSH；保留测后设置后按约恢复rc.38及本轮原设置，当前尚未恢复。
Lucy最终原生summary（独立于轮询末次active样本）：737帧/737变化、26.639秒，parent-stop，源窗口395642/location WhaleWallpaperProbe-261020070813-ac6d关闭closed=true、safeToCleanUp=true。该最终摘要已加入lucy-watch-summary.json。

## 已恢复日常 rc.38，待用户正常重开确认

用户本轮确认“DSH已正常退出，可以恢复”。实时确认DSH/采集/伴随窗关闭、原WE身份保持、cache为空后，先保存测后Profile/Local Storage/desktop/Preferences/Local State，文件逐项核验，见after-test-retention.json。随后官方CLI恢复rc.38，恢复本轮5个Profile/9项关闭存储，实际安装35文件集合/内容与固定rc.38归档一致，218项受保护输入保持；各有界命令exit0、退出确认、无超时。原布局desktop/settings.json、Preferences及Local State原本即与本轮备份一致，未额外覆盖。官方EXE/app.asar/WE哈希与原WE身份保持。空media-bridge目录保留，无lease/clip/budget.lock，不为收尾删除目录或旧证据。

本轮MP4与Lucy、主面板null身份/模式/自动播放控件的实际短验范围通过；不覆盖所有视频/codec/音频/长测，也不改变Lucy-only自动播放名单。当前已恢复rc.38，rc.40暂不保留为日常；等待用户正常重开并确认原外观布局正常、播放停止后结束本轮。

## 最终恢复交接完成

用户确认正常重开、外观布局正常、播放停止。只读复核实际安装0.6.0-rc.38、DSH已打开、WallpaperProbe进程0，原WE PID及启动时间精确保持；见user-restored-reopen-confirmation.json。本轮流程结束，不再追加采样、安装或试播。备份/候选/实测证据保留，未提交推送、清理或恢复定时任务。后续若用户决定保留rc.40日常，需在当时正常退出后做新备份安装，不能复用本轮备份覆盖之后新增设置。
