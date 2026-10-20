# rc.40 日常试用交接完成

2026-10-20。用户要求“好，那就换上吧”，随后本轮确认“已正常退出，可以安装并保留 rc.40 日常试用”。新备份后安装完成，用户最终确认“重开正常，外观布局正常，播放停止”。**日常现保留 DSH 0.2.1-rc.2 / 外观 0.6.0-rc.40 / Git Bash 0.1.1**，不自动恢复 rc.38。

本轮没有重复播放或采样。批准的Everyone MP4连续播放、鼠标/界面操作、停止清理及Lucy回归已在[前轮短验](RC40_VIDEO_ASCII_BRIDGE_SHORT_TEST_20261020.md)通过；本轮仅完成日常切换与正常重开确认。仍不代表全部视频、编码器、音频或长期效果已验收；自动播放验证名单仍只有Lucy。

## 新备份与安装核验

- 本轮全新备份：`C:\Users\HP\.dsh\backups\rc40-daily-trial-20261020-9aa5f967`。5个Profile、9项关闭Local Storage逐项核验；另保存desktop/settings.json、Preferences、Local State、原rc.38活动安装35文件和rc.38/rc.40两份原包。不复用前轮短验备份覆盖新数据。
- 本轮证据：`F:\dsh-wallpaper-plugins\.tmp\rc40-daily-trial-20261020-9aa5f967`，含授权、预检、备份、逐步stdout/stderr/退出结果、包成员哈希和最终交接确认。
- 官方CLI安装固定rc.40原包。SHA256：`E83255202DCE92EB1FC1C37345827544729AA769BCB669CB61169024ABA4F1FB`。实际安装37文件集合、内容和版本完全匹配；关闭存储9项保持，218项受保护源码/QA/生产assets/原归档保持。
- 安装期间仅预期Profile依赖登记package.json及pnpm-lock.yaml变化；其余Profile、官方EXE/app.asar/WE EXE保持。所有本轮执行步骤exit0、退出确认、无超时。
- 用户正常重开后，只读核对实际安装rc.40、DSH打开、采集进程0、原WE PID及启动时间保持。desktop/settings.json、Preferences和Local State仍与本轮备份一致；用户确认原外观和窗口布局正常，播放停止。见`daily-handoff-confirmed.json`。

## 回退与接续

rc.38回退原包SHA256：`B417B73F93973564522839CE803AF1BB0AAA2072D35C24E5ACEF0E2C42CF0DEA`，与本轮新备份一起保留。以后若回退，先确认届时方便并正常退出，保护届时新增数据；不能直接将本轮旧设置覆盖后续改动。

源码工作区manifest/生产assets仍rc.30且含Trace/P1A，不以整个开发树重新打包。原生文件沿用已审固定候选；本轮未构建、修改实现、提交推送、清理旧包、恢复定时任务或操作原WE。A滚动/三体/GPU暂缓；后续扩展与作者参数按用户另行排期。
