# rc.52 首次作者读取短验及rc.48恢复

> 后续补正：用户补充恢复后重开曾弹出Host启动错误，点击Restart后才恢复。原始日志证实UTC11:25:50的authenticateWebHost/fetch底层bad port；11:26的正常Host快照属于之后恢复运行。见[启动事件只读核对](RC52_POST_RESTORE_STARTUP_FETCH_FAILED_20261027.md)。首次6项参数观察和关闭状态恢复核验保持有效，但不能称恢复后首次启动无异常；具体端口及选择原因未定。

2026-10-27，Codex。**本轮限定通过并收尾：Lucy首次手动播放后，作者参数6项自动显示，未点重试／重读，也未改作者参数。已按约定恢复rc.48及本轮原设置，用户确认“原外观和布局正常，播放停止”。**

## 本轮授权、备份与安装

用户对本次问题直接回复“已正常退出，可以临时安装短验”；助手核验DSH／采集／伴随窗关闭、原WE唯一身份及rc.48安装后，创建新轮授权和备份，没有沿用旧轮退出／备份／PID。

- 轮次：`.tmp/rc52-author-read-short-trial-20261027-a/`。
- 新备份：`C:\Users\HP\.dsh\backups\rc52-author-read-short-trial-20261027-a`。
- 5个Profile文件、10个关闭状态Local Storage文件；IndexedDB／Blob共9个文件，原桌面布局／Preferences／Local State三目标均备份核对。
- 固定候选rc.52：SHA256 `93553C4C6E4DD8DCB4C433D9066DBF0814C21341BF7D519B9DE24A0EB14362C4`。安装后43文件逐项一致，原布局与官方EXE／ASAR／WE保持。

候选只包含已审四运行文件及隔离版本／README，实际client与固定rc.51相同，37文件／14资产继承，没有整体打共享开发目录。构建与SDK证据见`RC52_AUTHOR_READ_READINESS_PREPARATION_20261027.md`。

## 实际操作与观察

助手正常重开DSH，原会话处于无任务／播放停止状态。从顶栏打开Whale原生侧栏，仅全年龄，目录23项；选择Lucy，日常模式，临时关闭原自动播放。没有进入通用设置或刷新目录，未修改亮度90／遮罩0／模糊0／界面不透明度40等原值。

仅点击一次开始。实际画面显示Lucy播放中，同时自动出现：开场动画、粒子、光照、水袋、开关、关闭作者营销词，共6项。未出现本轮可见的读取失败提示，未点重试／重新读取／保存／应用，未改作者参数。

后台本轮快照确认active=true、scene=lucy、mode=daily、captureStarted=true；本轮location与capture PID已绑定在`playing-status.json`，未复用旧轮身份。正常点击停止后，实际Host证明inactive／session空、lastCleanup.closed=true，采集进程0，当前location源窗口0，原WE保持；见`live-cleanup-verified.json`。

**证据限制：** 原生截图直接显示6项参数，但电脑操控的AX辅助文本曾滞留在“正在启动…”，尚不含作者行。以本次工具返回的实际画面观察为依据；本地`first-read-visual-evidence.json`明确注明AX滞后，`first-read-ui.json`附带的旧AX树不能拿来证明6字段。未为此重新启动播放。

本轮没有抓取真实schema原始响应或HTTP请求计数，也没有记录后端wait分支是否实际命中。因此只能确认**本轮一次首次播放自动显示参数**，不能把SDK的“一次GET／零POST”计数移植成实机已测，也不能宣称所有target.unverified已唯一归因／永久修复。没有测试作者参数实际下发、性能／长期稳定或其它壁纸。

## 停止、数据保留与恢复

助手通过菜单正常退出DSH。新鲜关闭预检在played模式下验证了本轮playing与cleanup身份配对；先保留测后Profile／存储／媒体／布局，再重装固定rc.48，恢复本轮备份。

关闭状态核验：

- rc.48安装43文件一致；Profile5文件原哈希一致，changedProfileFiles为空。
- Local Storage10文件、媒体9文件及布局三目标一致。
- 原官方EXE／rc.3 ASAR／WE文件及原WE进程启动身份保持，采集与伴随窗关闭。
- 正常重开后新鲜Host快照active=false、session空、capture为空、failed=false、无错误，原WE保持。

恢复重开时电脑操控先报未取到目标窗；只读刷新确认DSH确已启动，未重复启动。现有窗最小化，activate／重新绑定后仍遇user-input状态冲突和最小化提示，助手停止窗口输入，交用户显示现有窗。用户随后确认“原外观和布局正常，播放停止”。本轮已闭合，不再重试操作或播放。

日常仍**DSH0.2.1-rc.3／Whale0.6.0-rc.48／GitBash0.1.2**；rc.52没有保留作日常。候选、全新备份、测后数据、原包与所有失败见证保留；未来回退先保护届时新数据，不复用本轮授权或旧PID。

## 工具准备／执行修正记录

以下均如实保留，不包装为单轮全绿；未削弱运行身份／备份／恢复门禁：

1. 备份前发现模板残留正斜杠rc.51目录与旧备份标签：改为从本轮config取candidateArchive，纠正本轮标签，保留原字节与`round-path-fix.json`。
2. 安装前`verifyBefore`因未生成本轮protected-before清单拒绝；补齐来自原保护基线和实际包的清单，重新验证`verifyBeforeRetry`通过，安装前置明确要求新的成功证明，原失败未覆盖。
3. 前轮工具写死“读取失败”快照名称；本轮新增current版cleanup／restore预检，绑定实际`playing-status.json`、snapshotPlaying与成功校验标签。原脚本保留；native／时间精度／同轮清理／权限检查不变，保护清单的工具变更有逐项前后指纹和旧版保留。
4. mediaRestore首次因restoreLayout尚未执行而前置拒绝，未写媒体；先完成布局恢复，再以独立mediaRestoreRetry通过。
5. verifyRuntime与其依赖mediaVerifyRestored被助手误并行，前置正确拒绝；依赖完成后独立verifyRuntimeRetry通过。保留两次失败及通过结果，后续须按实际依赖顺序执行。

共享源码／QA／生产assets及已审交付指纹保持，未提升共享源、提交推送、清理或新增定时；未发送DSH模型请求、未杀原WE。下一步可按用户选择准备rc.52日常切换，或继续单独处理后续UI文案；本轮不自动切日常或开启新试验。
