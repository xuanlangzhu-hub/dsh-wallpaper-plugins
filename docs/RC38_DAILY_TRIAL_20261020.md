# rc.38日常试用：新备份、安装核验与正常重开交接完成

2026-10-20。用户在“把已通过短验的rc.38切为日常试用，切换时新备份、保留rc.35回退”的建议后回复“好，那就继续吧”。**用户进一步确认“已正常退出，可以安装并保留 rc.38 日常试用”。本轮新备份、官方CLI安装与关闭态核验已完成，安装rc.38后用户已确认“重开正常，外观布局正常，播放停止”，本轮日常交接完成；保留rc.38，不自动恢复rc.35。** 与此前临时短验默认恢复rc.35分开，本轮成功安装后保留rc.38。

## 执行前准备（已完成；当时尚未安装）

- 固定候选：[rc.38核包记录](RC38_COMPANION_REPAIRS_CANDIDATE_REVIEW_20261019.md)，SHA-256 `B417B73F93973564522839CE803AF1BB0AAA2072D35C24E5ACEF0E2C42CF0DEA`、7,160,300字节、35文件，当前重验一致。rc.35回退原包SHA-256 `20D35ED1A63E2272FF50E44A9A38891F1D973994BED446FB19D79B0A9E6FAE58`保持。
- 当前rc.35的28安装文件逐项匹配。DSH仍运行，未退出它、未复制运行中的Local Storage作为恢复来源，也未安装。
- [前轮短验及恢复](RC38_COMPANION_SHORT_TEST_20261019.md)已经完成，用户确认无账号提示、80同步/吸附正常、Lucy画面与操作流畅、停止清理正常，以及恢复后外观/布局/播放停止。此次使用同一固定包，不重新构建候选或机械重跑同一测试。
- 本轮独立证据：`.tmp/rc38-daily-trial-20261020-3bbbdcb1`，已冻结209项源码/QA/assets/归档输入、保存git脏改动及intent-and-preparation.json。关闭态备份、官方CLI安装、有界监督及安装核验脚本均已准备，当前未运行。

## 切换与交接

确认当前方便、DSH无任务，用户正常停止播放并菜单退出，原WE保持；关闭后按当时实际集合新备份Profile、完整关闭存储、desktop/Preferences/Local State、当前安装与固定两包，重新采集当前WE身份，不套用旧5/9数量或旧PID。保留用户新增会话/附件和前轮备份。

新备份哈希通过后，官方CLI只安装已测rc.38，核对35安装文件、原设置及宿主/WE保护输入；不升级DSH或Git Bash。正常重开确认原外观/布局、播放先停止，完成后保留rc.38作为日常试用，不自动装回rc.35。

日常使用积累反复开关独立窗、同步吸附和播放清理反馈，不启动常驻采样、定时或性能/GPU矩阵。长期效果、全部壁纸兼容和首次断流根因尚未解决。发生回退需求时先保护届时新增数据，不盲目覆盖今天备份。

开发侧下一项拟为作者公开参数的只读识别/兼容调查，尚未派发或修改实现，不提前运行壁纸或应用作者参数。A/三体/GPU仍暂缓，定时PAUSED，无新Grok任务。本轮无提交推送或清理。

## 本轮新备份、安装及关闭态核验

- 本轮备份：`C:\Users\HP\.dsh\backups\rc38-daily-trial-20261020-3bbbdcb1`。实际枚举5个Profile根文件、9个关闭状态Local Storage文件，逐项哈希匹配；另备份当前desktop/Preferences/Local State、活动rc.35的28文件和两份固定包。原试验/恢复备份与新增会话/附件保留，不以昨天备份代替本轮新备份。
- 安装前重新核对DSH、WallpaperProbe、伴随配置Edge均关闭；本轮重新记录当前WE创建身份，不沿用上轮PID。官方EXE签名有效，实际官方CLI --version为0.2.1-rc.2。
- 官方CLI `plugin --profile desktop add`安装固定rc.38，退出0，3,169ms，无超时/强制终止；90秒期限与105秒兜底未触发。只切外观插件，未升级宿主/Git Bash。
- 安装后35个regular文件逐项匹配固定rc.38、无额外文件；9个存储文件及desktop/Preferences/Local State均不变。Profile只有package.json和pnpm-lock.yaml按安装流程改变，官方EXE/app.asar/WE文件及本轮WE身份保持。
- 209项源码/QA/生产assets/旧归档保护输入保持，源码manifest/assets仍rc.30。无重新构建、提交推送、清理或额外测试；没有自动打开DSH、弹出独立窗或启动播放。

证据包括live-authorization.json、closed-backup.json、supplemental-backup.json、ready-to-install.json、install-result.json、installed-rc38-closed.json、post-install-runtime.json和daily-install-final-verification.json。前轮短验范围保持，不将安装核验扩称长期稳定。

**用户已回复：“重开正常，外观布局正常，播放停止”。rc.38日常试用交接完成。** 本轮安装后保留rc.38日常试用；不再重复前轮Lucy/独立窗短验，不自动回退rc.35。回退包和本轮新备份保留，后续回退先保护届时新增数据。

## 正常重开确认与当前安排

用户确认保存于daily-reopen-user-confirmation.json；没有额外窗口采样、继续播放或改变原设置。当前日常为DSH0.2.1-rc.2 / 外观rc.38 / Git Bash0.1.1，本轮新备份及固定rc.35回退包保留。此项确认不扩称长期稳定或全部壁纸兼容。后续作者公开参数调查按单独离线任务推进，当前尚未启动；定时仍PAUSED。
