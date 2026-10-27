# rc.52 首次作者读取就绪修复候选／短验准备

2026-10-27，Codex。用户同意在离线闭合后继续，已完成隔离候选、实际包检查和新轮备份／回退工具准备。**尚未取得本轮当时方便／无任务／正常退出确认，未安装，未操作日常DSH或WE。**

## 固定候选与最小整合

- 候选：`.tmp/rc52-author-read-readiness-candidate-20261027-a/dsh-whale-mist-0.6.0-rc.52.tgz`。
- SHA256：`93553C4C6E4DD8DCB4C433D9066DBF0814C21341BF7D519B9DE24A0EB14362C4`；7,260,813字节，43文件。
- 底座：固定rc.51取证原包，SHA256 `A8AA341F560C17CB7AC85817DFB205404AE7C2765F2F29B15CF436F912313725`。原件保持。
- 仅移入已独立接受的d／c四运行文件：session、index、author ApplyAdapter、作者Host；另改隔离包版本与README。**37文件／14资产逐字节继承，client等同rc.51，未夹带新UI／“▶ 播放”／开发Trace。**
- 来源及最终指纹见`candidate-audit.json`。四文件与`rc51-readiness-qa-cleanup-review-20261027-a/review-evidence.json`逐项一致；所有文件按实际tgz重新读取／解包核对，不从共享开发树整体打包，不提升共享源码。

修复范围：仅为其它身份合法、同一具体session／generation尚待采集证明的首次GET在原总预算内等待事件；就绪后至响应前验证完整绑定。无前端额外GET／自动重试／默认参数写入，不改变POST或原生最终写门禁。缺startUtc、非法身份、授权／分级、busy等仍诚实拒绝。现场全部target.unverified尚未唯一归因，本包首次读取实机仍待验收，不作日常。

## 实际包核验

23个JS语法、34条相对导入闭包、manifest除版本外保持、客户端QA钩子排除、CSS模板门禁通过。实际包Trace GET／POST路由仍404，关闭状态路由和dispose正常，零原生IO。

使用官方Windows rc.3 SDK及本轮自有Headless Edge，对**实际包客户端／HTTP Host／真实ApplyAdapter**执行两项：

1. 首次自动schema GET只发一次；受控session采集未就绪时真实adapter注册1个等待，DOM没有可编辑作者字段；发送就绪事件后同请求成功、等待解绑，Lucy粒子控件可用，0作者POST／0原生命令。
2. metadata409时实际DOM显示`未能读取设置，请重试 [schema.metadata.409]`，仍一次GET／零写，测试私密正文不进入界面。

SDK父监督3860ms退出0，自有浏览器退出与Host会话清理确认，pageErrors为空。控制台的401／404／409记录保留在原JSON，不称控制台全无错误。package原始client哈希62F95B…保持；仅QA服务副本加`window.__qaBridgeClient`观察钩子，未进入tgz。

这里的session事件／PID／HWND／时间／helper／播放状态和预览为受控离线替身，非实际WE窗口、GPU／完整帧流或DSH实机验收。原始默认身份装配、预算／取消／ABA、响应五种漂移等按完全相同运行指纹复用既有独立证据，不重复旧SDK／全部诊断。

## 新轮工具与安全边界

新轮目录：`.tmp/rc52-author-read-short-trial-20261027-a/`。从上一轮实际完成恢复的当前工具复制30个明确模板（原29项＋纯授权QA），仅适配新轮路径、purpose、版本、包哈希和新的生产备份根；来源／适配指纹见该目录`source-adaptation.json`。

没有复制旧authorization、Profile／存储／媒体／窗口布局、WE身份、运行证明或测后记录。`authorization.json`、`closed-backup.json`和新的生产备份目录均不存在；旧轮授权及退出状态不能复用。

工具Python／Node／PowerShell语法、纯授权对象10项、纯日期精度／恢复证据5项通过；install、restorePackage、backup、restoreSettings、mediaBackup、preflight和实机授权序列化校验共7个真实入口缺授权均拒绝，发生于日常查询／写入前。所有外部命令有stdin隔离、阶段与父监督退出期限。

首次离线准备检查将需要真实授权的`test-datekind.ps1`误归为纯检查，被门禁正确拒绝；失败日志／脚本保留。v2改用纯合成对象检查精度，并将该真实入口纳入缺授权拒绝，不修改授权门禁、不生成假授权，随后通过。

日常rc.48原包SHA256 `93290398BEAFBDCB5B01CB4273D4759A92D4325934CD2FBFA2D1FC26B88CAEAE`、实际安装43文件和rc.3宿主ASAR只读核对保持。281共享保护输入、已接受交付及四源码、旧候选／旧轮工具保持。未读取Profile配置或外观存储内容，未查询日常进程／窗口或Host API。

## 当前确认后的一轮验收

1. 用户确认方便、其它助手暂停、DSH无任务、播放停止并菜单正常退出，原WE保持；届时才创建本轮授权和新鲜关闭／WE身份记录。
2. 先新备份当时Profile、关闭存储、IndexedDB／Blob／媒体及窗口布局，按实际集合记数量和哈希；核对固定rc.48回退与rc.52再临时安装，不沿用历史文件数量或内容。
3. 正常重开后助手代点顶栏侧栏，Everyone目录选择Lucy，日常模式／自动播放关闭。一次播放，观察作者参数能否首次自动出现，不点重试／重读，不改作者开关、草稿或apply。
4. 若失败，只记录安全阶段码及当轮必要状态；若成功，记录本轮限定通过。均不靠多次重启／重试把失败冲掉，也不扩称所有错误已解决。
5. 正常停止清理／退出，先保留测后数据，再恢复rc.48及本轮新备份设置／媒体／布局，核验后正常重开、播放停止。仅处理本轮变化，原WE不动。

当前待本轮方便／正常退出确认。无安装发布、日常操作、提交推送、清理或定时；日常DSHrc.3／Whalerc.48／GitBash0.1.2保持。
