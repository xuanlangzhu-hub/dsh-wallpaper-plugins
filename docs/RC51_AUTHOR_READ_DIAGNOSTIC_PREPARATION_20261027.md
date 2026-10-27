# rc.51 首次作者读取窄取证候选／临时试验准备

2026-10-27，Codex。用户已要求继续准备，实机安装尚未获得本轮当前方便／正常退出确认。本轮只完成隔离候选、静态／SDK核验及新轮运行工具准备，未操作日常应用。

## 固定候选

- 临时候选：`.tmp/rc51-author-read-diagnostic-candidate-20261027-a/dsh-whale-mist-0.6.0-rc.51.tgz`
- SHA256：`A8AA341F560C17CB7AC85817DFB205404AE7C2765F2F29B15CF436F912313725`；7259277字节、43文件。
- 底座：固定rc.50原包，SHA256 `F6D1BA78A3B08974BCC18410B1692CADDFAB4A72CB0070903D0B74A33C3B78D7`。只改client／隔离manifest版本／README，40文件和14资产逐字节继承。不是从含Trace的开发目录整体打包。
- client仅作者requestAuthor传输及原生作者控制器两个已审区域变化；其它区域保持原包字节。实际client哈希`62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8`，与已验诊断副本A220…仅行尾不同，整段规范化后完全相同；没有VM导出、__qaBridgeClient、__qaAuthorFailure、__qaPhysicalJobs。
- 原targetActive、身份／鉴权、取消／代次、响应校验及首次读／编辑／下发门禁保持；不自动重试、不默认保存或apply，不夹带“▶ 播放”或新UI。

初版组装在打包前被“两区域外字节保持”断言拒绝：原probe统一CRLF、底座为混合行尾。v2只移植两区域，保留其它原字节，并验证与原probe的规范化全文等价。失败脚本与拒绝记录保留，未改生产文件。

## 实际包核验

实际tgz重新独立读取并解包，包内23项JS语法通过，manifest除版本外与底座一致；CSS模板检查、实际Host Trace GET／POST路由不存在（404／零原生IO）、关闭状态路由和生命周期收尾检查通过。

针对实际包client和实际包后端，用官方Windows rc.3 SDK＋自有Headless Edge，仅跑2项本轮取证接缝：健康首次读取恰好1次schema GET、粒子可用／勾选、0作者写；首次读取遭schema metadata409时实际DOM显示 `未能读取设置，请重试 [schema.metadata.409]`，1次GET、0作者写、0原生命令，假私密正文标记不进入UI。自有浏览器及Host／会话正常清理，父监督3548ms退出0。窗口身份／播放status／原生执行器为离线替身，不称实机验收。

先前18项／13项、正常／故障注入SDK及4项确定性控制器回放按未变诊断逻辑指纹复用，不重复跑大套件。证据入口：候选目录candidate-audit.json、actual-candidate-sdk-report.json、trace-boundary-report.json、validation-summary.json等。

## 本轮新备份与回退工具

新轮目录：`.tmp/rc51-author-read-short-trial-20261027-a/`。基于上一轮已实际恢复成功的rc.50-b工具，仅适配新轮根目录／purpose／rc.51版本和哈希／候选路径；29项模板包含{'.ps1': 20, '.cjs': 2, '.py': 6, '.cs': 1}。没有复制旧authorization、运行证明、Profile／存储／布局／原WE身份快照，也没有创建生产备份目录。

归档清单、PowerShell解析、Python／Node语法与纯授权对象检查10项、install／restorePackage／backup／restoreSettings／mediaBackup／preflight六个真实入口缺授权拒绝均通过；拒绝发生在应用查询／写入前，未访问日常窗口或Host API。QA父进程最初按UTF8解码本地化PS错误输出失败，已另存v2仅对QA输出解码使用replacement，不改变脚本字节或授权门禁，旧失败保留。

日常rc.48归档哈希`93290398BEAFBDCB5B01CB4273D4759A92D4325934CD2FBFA2D1FC26B88CAEAE`、实际安装43文件与rc.3宿主ASAR静态只读核对一致。不读取Profile配置或外观存储内容，不查询运行进程／窗口。保护清单327项（325原保护加固定候选／底座／探针）保持，工作区长期脏改动保留。

## 获得当前确认后的具体顺序

1. 用户确认当时方便、其它助手暂停、DSH无任务、播放停止并通过菜单正常退出；原WE保持。仅届时写本轮authorization，查询新鲜关闭状态与WE身份。
2. 新备份当时Profile文件集合、Local Storage、IndexedDB／Blob／媒体缓存和窗口布局；按实际数量记录哈希，不能复用历史5／10／9文件的内容或旧WE PID。核验rc.48回退归档与候选后安装rc.51。
3. 正常重开后助手代点顶栏侧栏；Everyone图库复现既有流程并选Lucy，日常模式、自动播放关闭，首次播放读取参数。用户不需要调参数或跑完整UI流程。
4. 一旦首读失败，先保留安全阶段码和该轮必要状态／截图，不点重试、不改作者开关／草稿、不继续下发。若首次成功，记录“本轮未复现”，不把它称根因已修，不反复尝试。
5. 正常停止并确认清理，正常退出后先保留测后数据，再重装rc.48并恢复这轮备份的原设置／媒体／布局；核对后正常重开，播放停止。恢复只处理本轮改动，不碰原WE。

所有真实操作步骤均由当前授权与前置证明守卫，外部命令断stdin、有阶段期限、父监督树收尾与退出确认。当前没有authorization／closed-backup／安装证明，不能提前执行。

目的仅获取bridge／snapshot／schema／target／响应校验的首个失败阶段。阶段码不等于根因，后续按实际接缝补回归与最小修复。日常仍DSH0.2.1-rc.3／Whalerc.48／GitBash0.1.2；无发布、推送清理或定时。
