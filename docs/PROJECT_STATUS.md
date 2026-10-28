# 项目状态与接续

更新：2026-10-28。当前阶段为 **rc.53已保留日常试用，先观察，公开发布暂停**。[图库选择、显式播放和非Lucy作者参数](WALLPAPER_GALLERY_SELECTION_AND_AUTHOR_ID_20261028.md)已完成本轮限定验证。

最新：用户要求继续，公开图标署名已精简为DeepSeek标志改色／透明处理及无背书说明；
回忆细节只留审查记录。外层d轮ZIP固定文本换行并已核对，SHA256 `AFF40FFEA48298066403F6FE7EDF9E67888FC90CE2706549EB90B63678F99C24`，
原tgz不变。发行资料83260ab已推送，[GitHub预发行草稿](RC53_GITHUB_PRERELEASE_DRAFT_20261028.md)及两附件已就位，
下载逐字节一致；draft=true／prerelease=true、未公开、无正式tag，等待用户最终公开安排。不发布npm、不操作日常应用。

当前成果已推送至b8554cb。用户随后要求继续[首个预发行准备](FIRST_GITHUB_RELEASE_PREPARATION_20261028.md)，[本地下载ZIP及许可核对](RC53_FIRST_RELEASE_BUNDLE_20261028.md)完成：43文件原包不变，8DLL均匹配原NuGet条目，13校验条目及确定性重建通过。用户补记ICO为DeepSeek蓝鲸／Harness黑鲸标志改白、眼睛和腹部镂空的衍生图，原图／工具未知；已如实署名并重建外层b轮ZIP，保留旧a轮。材料已备，publicReleaseReady=false等待本次公开安排；本轮新增资料尚未提交推送，尚未建tag／Release或发布npm。日常rc.53不变。

用户随后决定保留rc.53日常试用，已另获本次正常退出确认、新备份并[完成日常切换](RC53_DAILY_TRIAL_20261028.md)。固定43文件一致，原设置／布局保持，重开目录正常，原自动播放正常停止后capture0，用户确认重开正常，本轮closed-out。公开发布继续暂停。

此前限定[rc.53临时实测](RC53_GALLERY_AUTHOR_SHORT_TEST_20261028.md)已完成。卡片留图库、Lucy→绯雪→Float显式切换及Float四个参数首次显示、Clock即时关闭／恢复通过，用户确认“切换和时钟效果正常”。已恢复rc.52、5个Profile、10项外观存储与布局／媒体并正常重开，用户最终确认原外观／布局正常、播放停止，该短验轮已闭合；其后另做新备份换为rc.53日常。短验不代表所有壁纸参数通过或可公开发布。

[固定rc.52隔离整合](RC52_GALLERY_AUTHOR_UNPACKED_INTEGRATION_20261028.md)通过20项单测和15项SDK，四后端运行文件与诊断阶段码保持。用户随后允许生成本机候选：[rc.53核包](RC53_GALLERY_AUTHOR_CANDIDATE_20261028.md)通过，实际归档15项SDK、23JS语法及Trace／CSS检查通过，仅client／版本／README变化，14资产不变。日常安装43文件核对一致。其后已获临时安装授权并完成实测／恢复，公开发布继续暂停。

[本轮短验工具](RC53_GALLERY_AUTHOR_TRIAL_PREPARATION_20261028.md)已准备并完成离线门禁检查：25脚本解析、10授权对象、5恢复精度、7切换清理证明及17个未授权入口拒绝。其后已取得本轮确认、新备份并临时安装，该短验轮恢复rc.52并获用户确认正常，工具与测后数据留存；随后日常切换另起新轮并保留rc.53。

## 当前日常与10月28日最后确认的运行验收

| 项目 | 已确认状态 |
| --- | --- |
| 宿主 | DSH 0.2.1-rc.3 |
| 鲸系外观 | 0.6.0-rc.53，43 文件与固定原包一致 |
| Git Bash | 0.1.2 |
| 重开 | 用户确认重开正常；助手核对原布局、侧栏目录、播放停止 |
| 后台 | 新鲜 Host inactive、session 空、目录 ready／26 项，采集0，原 WE 保持 |
| 回退 | rc.52原包、活动安装和本轮5Profile／10外观存储／9媒体及布局备份保留；回退先保护届时新增数据 |

见[当前日常交接](RC53_DAILY_TRIAL_20261028.md)、[本轮限定短验](RC53_GALLERY_AUTHOR_SHORT_TEST_20261028.md)及[首次读取短验](RC52_AUTHOR_READ_READINESS_SHORT_TEST_20261027.md)。每次真实操作均按当轮授权与备份，后续不为整理再次操作DSH／WE。

## 已完成与实际覆盖

- scene、MP4、web 路径分阶段可行性、限定短验和正常停止清理；[类型阶段记录](WALLPAPER_TYPES_CLOSURE_RC42_REVIEW_20261021.md)。不承诺 application 或所有库中条目。
- 最右侧原生外观栏、分级图库／预览、主题与画面设置；本地视频焦点／最小化和作者粒子即时下发有专项记录。
- [rc.48 侧栏与参数日常交接](RC48_DAILY_TRIAL_20261025.md)；[rc.50 UI 短验](RC50_NATIVE_UI_SHORT_TEST_20261026.md)反馈观感改善，并发现首次读取失败。
- 首次读取就绪的身份／预算／取消／响应前重验已离线闭合；[QA 复审](RC51_AUTHOR_READ_READINESS_QA_CLEANUP_REVIEW_20261027.md)。rc.52 单次 Lucy 首次手动播放自动显示6项作者参数，没有手动重试或改参数。

实机只确认实际观察的目标／动作，单测／受控 IO／SDK／物理桌面证据分开；未称长期稳定、全部参数或唯一根因永久解决。

## 剩余问题

1. 三体运动节奏：同源及无采集源窗口也有突然加减速，尚未解决，专项暂缓。
2. UI：继续调整布局与控件。本轮rc.53已短验“壁纸参数”入口、点卡片留图库、显式播放／受控切换及非Lucy Float参数绑定；后另行切为rc.53日常试用，继续观察实际体验。
3. 任务栏：初始入口仍可能闪现，未承诺从不出现或 Explorer 重启后的完整隐藏。

此外保留[宿主 bad port 启动事件](RC52_POST_RESTORE_STARTUP_FETCH_FAILED_20261027.md)和低优先级滚动异常；Restart 恢复不等于根因解决。通用鼠标／点击转发、音频、application 类和全部壁纸兼容未验收。

## 源码、快照与发布

共享开发目录仍是rc.30 manifest／资产基线，含Trace，不等于日常包。实际固定包文本分别保存在[rc52快照](../release-sources/rc52/README.md)与[rc53快照](../release-sources/rc53/README.md)，完整43文件指纹可核对，14个assets留原包，不从共享开发树整体打包。rc53快照另含实际整合侧栏源，避免丢失读取阶段码。

10月27日维护见[历史报告](WORKSPACE_MAINTENANCE_20261027.md)。10月28日用户先暂停公开发布，rc.53核包、临时短验后另行新备份换作日常；随后明确授权本轮提交推送，并希望接下来准备首个Release。此次推送权限来自本次直接请求，不沿用昨天授权。Release／npm尚未发布，也未打标签；[发行准备](FIRST_GITHUB_RELEASE_PREPARATION_20261028.md)记录原tgz缺许可材料、SDK依赖来源及附件边界，不能因npm登录或Git推送成功宣称已具备全部公开材料。

## 现场与记录

不为整理重开／退出／采样日常、不改 Profile／安装资产、不终止原 WE。新实机或安装先确认届时方便、无任务并新备份。原包、实测、失败记录和备份保留，清理仅限核实可重建且无进程引用的缓存。

含会话内容的真实截图在 docs/screenshots 本机保留，不上传；docs/previews 是隔离夹具预览。整理前接续原文见[历史快照](history/20261027/README.md)，更早历史仍在[2026-10-16快照](PROJECT_HISTORY_20261016.md)。历史“下一步”不当作当前授权。
