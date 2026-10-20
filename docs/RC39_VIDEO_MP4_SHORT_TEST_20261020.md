# rc.39 视频壁纸临时短验（2026-10-20，失败并已恢复）

## 本轮最终结果

**视频短验失败，rc.39 不留作日常；已恢复 rc.38 与本轮原设置，用户确认正常重开、外观布局正常、播放停止。** 详见[现场问题、复现与补修任务](RC39_VIDEO_LIVE_FINDINGS_REPAIR_TASK_20261020.md)：null身份读取错位、新面板漏模式/自动播放控件已复现；捕获4610帧仅1次表面变化，视频未显示的根因未知。正常停止关闭通过，Lucy未执行，本轮不扩称20秒/完整切换验收。

35安装文件、5Profile、9存储及原布局核验一致，原WE保持、捕获进程0。恢复后Host重新发现当前端口12878，active=false/error为空；不复用旧5604。测后设置另存；保护213项源码/QA/资产/归档不变。后续仅离线补修，实机须另约。

## 安装前后阶段记录（历史）

## 当前阶段

用户本轮明确回复“已正常退出，可以临时安装短验”。已核验 DSH/WallpaperProbe/伴随窗均退出、原 WE 保持；新备份后使用官方 CLI 临时安装 rc.39，**35 个安装文件与固定原包一致**。用户已确认“重开正常，已选视频，尚未播放”。只读 Host 状态 available、目录 ready、active=false、无错误；DSH 本轮实际端口5604（3080无监听，5605伴随服务对此路由404，未向其发送变更）。等待约20秒视频短验；尚未开始真实视频播放，不能记为实机通过。

- 固定候选：`release/plugins/dsh-whale-mist-0.6.0-rc.39.tgz`，SHA256 `FBF1B015A93403F6B3E1F442AE105DBCCF0163C0EEC1045713D85C06DB2D6121`。
- 日常回退基线：固定 rc.38，SHA256 `B417B73F93973564522839CE803AF1BB0AAA2072D35C24E5ACEF0E2C42CF0DEA`，本轮默认测后恢复，不自动将 rc.39 留作日常。
- 本轮证据：`F:\dsh-wallpaper-plugins\.tmp\rc39-video-short-trial-20261020-e75e9c0a`。
- 新备份：`C:\Users\HP\.dsh\backups\rc39-video-short-trial-20261020-e75e9c0a`，5 个 Profile、9 个关闭状态外观存储文件逐项核验；活动 rc.38 安装 35 文件、两个固定归档、Roaming desktop/Preferences/Local State 布局设置留档。
- 安装 CLI exit 0 已确认，复用缓存未下载；日志有 peer dependencies warning，未擅改依赖或权限。Host EXE/app.asar/WE EXE 指纹和原 WE PID+启动时间保持；仅 Profile 的 package.json/pnpm-lock.yaml 按安装动作变化，9 个外观存储保持，213 项源码/QA/生产资产/旧新归档保护输入不变。
- 备份、留档、安装、核验、运行身份核对均有总截止及自有子进程退出记录，无超时。没有发模型请求、退出/杀原 WE 或触碰系统设置。

## 待执行短验与恢复

1. 正常重开确认原外观与窗口布局；播放先保持停止。仅在 Everyone 范围内选择用户确认可展示的 MP4 video；若无符合项或条目不可用，如实记录，不改库、不勾隐藏分级。
2. 手动视频播放约20秒，保持原窗口/外观，其中缓慢移动鼠标；停止后核对本轮日志、采集/worker和源窗口清理。失败立即停，不反复重试；本轮不扩音频验收。
3. 清理明确后做 Lucy 简短回归，停止核对。
4. 用户通过菜单正常退出；先保留测后设置/日志，再恢复本轮 rc.38 与原设置、核验安装/存储/布局及原 WE。正常重开由用户确认。期间如有新增用户数据先保存，不能盲套旧备份覆盖。

[候选离线复审](RC39_VIDEO_MP4_CANDIDATE_REVIEW_20261020.md)与[源码阶段记录](WALLPAPER_VIDEO_MP4_OFFLINE_DELIVERY_20261020.md)保留。工作区 manifest/生产 assets 仍 rc.30，定时暂停，A/三体/GPU/web/application/作者参数未推进。
