# DSH 0.2.1-rc.3 升级与短验记录

日期：2026-10-25。依据[本轮升级准备](DSH_021_RC3_UPGRADE_PREPARATION_20261025.md)执行。用户本轮明确确认：“已正常退出，可以备份并升级”。**官方DSH0.2.1-rc.3、Whale rc.47及Git Bash0.1.2已安装，关闭核验、用户正常重开／原外观布局确认及Lucy播放／操作／停止短验均通过，本轮升级收尾，保留新版本。**

## 来源与现场

- 证据目录：`F:\dsh-wallpaper-plugins\.tmp\dsh021rc3-upgrade-20261025-3157c0a4`。
- 本轮新备份：`C:\Users\HP\.dsh\backups\dsh021rc3-upgrade-20261025-3157c0a4`，`summary.json` 已核验通过：`.dsh` 7852个普通文件／645353037字节、桌面端706个文件／32946355字节，共8558个文件／678299392字节；534个链接独立记录。另保留8项新旧安装器／原包。全部备份与源清单核验通过，耗时68642毫秒。正式关闭备份计数取代准备时只读清点，不能把运行中缓存数量当成应恢复的固定数量。
- 原日常为官方DSH0.2.1-rc.2、Whale rc.42、Git Bash0.1.1。目标为签名官方rc.3、固定日常代码的兼容过渡Whale rc.47及Git Bash0.1.2；不混未日常验收的原生侧栏或Trace。
- 当前关闭基线已重读：DSH／采集／伴随窗等阻塞进程为空；原WE路径、PID与精确创建时间已保存在 `closed-baseline.json`，后续每阶段核对，不能沿用为未来轮次授权。
- 既有脏改动保持，未提交推送、清理、派发或启用定时任务。

## 预检环境异常及纠正

首次 `preflight` 退出码1，签名读取子进程退出已确认，未创建备份或安装。Windows PowerShell自动加载 `Microsoft.PowerShell.Security` 失败；显式按名称导入复现类型成员重复，而从 `$PSHOME\Modules` 指定模块导入返回签名 `Valid`。对照记录见 `signature-environment-probes.json`。

仅在本轮 `runtime.ps1` 子进程中将 `PSModulePath` 限定为其自带 `$PSHOME\Modules`，不改系统／用户环境和日常安装。修订前脚本、指纹、失败状态、日志及退出回执完整保存在 `preflight-attempt-1`；核实无生产备份／修改且自有子进程均已退出后，才执行有原因的预检重试。没有重用失败日志或吞掉失败结果。

修订后的实际新旧安装器签名读取均为 `Valid`，实际只读关闭快照无阻塞进程且原WE在运行；准备输入指纹已同步。第二次预检通过，7583毫秒，父监督及其子进程退出确认。这是准备流程环境补修，不是插件或宿主故障，原25项离线检查仍为补修前证据，另有本次真实调用对照。

## 插件安装守卫误报及单步接续

第一次插件阶段在34661毫秒后以失败结束；Whale安装命令本身退出0、退出已确认，实际37文件符合rc.47固定tgz。Git Bash和宿主尚未安装。阻塞来自准备脚本将依赖目录误写为 `profiles/node_modules`，本机实际是普通目录 `profiles/desktop/node_modules`，并且遗漏了官方CLI新建的操作日志。

只读逐项差异为9项：Whale的 README／package.json、桌面Profile的 package.json／pnpm-lock.yaml、3项pnpm元数据和1个新操作日志目录／文件；桌面用户数据完全未变，原WE创建身份保持，阻塞进程为空。见 `plugin-first-step-observed-diff.json`。未据此放行任意node_modules变化。

修订守卫只接受两项兼容插件的README／清单、5项明确的Profile／pnpm元数据，以及最多两次本轮新增操作日志；拒绝旧日志修改、运行代码／资产、其它插件、用户设置、删除及重解析替换。9项有界回归通过，父监督351毫秒；其中单步接续测试确认不会重复安装Whale。原始脚本、指纹、失败状态保存在 `plugin-guard-review`，修订说明与新指纹见 `plugin-guard-repair-review.json`。

新增受控 `plugins-resume` 仅接受本次精确失败及已确认的首次安装退出，要求新Whale／旧Git Bash、旧宿主、原WE、其它插件和本轮备份／数据差异均核验一致，才执行尚未启动的Git Bash一步；成功后将首次失败保存在状态历史。这是已定位并补回归后的续接，未重跑整阶段、重复安装或绕过未知失败。

## 执行阶段

1. 本轮授权与关闭预检：通过。
2. 完整新备份：通过，备份和源清单一致。
3. 兼容插件安装：通过。受控单步接续35186毫秒，Whale rc.47的37个文件及Git Bash0.1.2的7个文件与固定tgz一致；其它两个日常插件保持。相对备份13项差异均为两包README／清单、Profile／pnpm元数据与两次新增操作日志，桌面用户数据保持。
4. 官方宿主升级：通过，阶段50578毫秒，其中安装器20492毫秒，退出0、无超时；安装器及监督退出已确认，新EXE／app.asar／CLI精确哈希符合固定来源。
5. 关闭状态完整核验：通过，26800毫秒。新宿主、两项兼容插件、两项保留插件及13项允许数据差异全部符合；桌面端用户数据未变、原WE身份保持、无DSH／源／采集／独立窗／安装器阻塞进程。`upgrade-verified-closed.json` 已保存。
6. 用户已确认“重开正常，外观布局正常，播放停止”。只读核对本轮新宿主的实际监听与精确创建身份，Host PID6704监听127.0.0.1:6428，GET `/whale-wallpaper/status`返回200、active=false、failed=false、error为空；外观Host实际加载、播放停止。另一监听端口不提供此路由，不作为外观插件失败。见 `first-reopen-runtime.json`、`first-reopen-wallpaper-status.json`、`first-reopen-confirmation.json`；旧崩溃日志不作为本轮异常。没有触发DSH模型请求。安装授权交接结束，不再自动写入Profile／恢复数据。
7. Lucy必要播放短验：用户确认“画面和操作正常，已停止并完成清理”。本轮 `2026-10-24T170704-1ca6-lucy` 日志已按原字节另存，真实会话28.806秒，原生24.825秒；`preview-final.json` 为 running=false／failure=null，停止原因 parent-stop，源窗口 location=`WhaleWallpaperProbe-261024170704-1524` 正常关闭（936毫秒，safeToCleanUp=true、无错误）。采集PID32964实时查询不存在；状态接口active=false／failed=false／error为空，最后一次清理为absent／closed=true。593帧仅是原生记录数量，不作物理显示FPS或性能专项结论。旧 `preview-status.json` 保留最后运行快照，不误当停止后状态。

## 收尾与后续边界

- 停止后重新绑定同一Host PID6704／精确创建时间／监听端口，原WE PID12900及创建身份、路径保持。源窗口在原WE进程中，关闭的是本轮窗口，不能声称原WE进程退出。没有启动或杀掉原WE。
- 实时快照中仍在运行的PID9112为窗口图标辅助进程，实际程序路径是安装包的 `assets/whale-icon-helper.exe`、父进程为本轮Host6704；图标状态绑定本轮主进程22292且verified=true。固定安装包 `src/index.js` 在Host加载时启动该辅助程序、Host dispose才结束，属于宿主生命周期，不是壁纸采集残留。最初核验脚本将其与采集合并判断导致断言停止，随后按实际代码区分；没有因该断言终止辅助进程或DSH。
- 证据：`lucy-post-stop-runtime.json`、`lucy-post-stop-host-status.json`、`lucy-short-test-final-verification.json`、`lucy-run-evidence-manifest.json`及 `lucy-run-evidence/`。本轮仅只读状态、进程与文件，不发DSH模型请求，不重跑播放或性能测试。
- 日常保留DSH0.2.1-rc.3／Whale rc.47／Git Bash0.1.2，DSH保持打开且本轮确认播放停止；原外观布局由用户确认。新旧安装器、原包、完整本轮备份及失败／补修证据保留，不清理或提交推送。以后回退先保护届时新增数据，不能复用本次退出确认。
- Git Bash真实命令、桌宠／推理档位全部动作、全部壁纸／主题组合及长期表现未覆盖，不将Lucy短验扩成全部通过。
- 后续回到原生右侧栏／设置推进时，以新rc.3为宿主重新做适用范围核验；现有rc.46候选只声明rc.2，不能直接安装或将本轮Whale rc.47兼容包说成侧栏功能升级。开发manifest／生产assets仍rc.30，不整体打包、不混Trace，不自动开启性能／GPU／三体、定时或跨助手派发。

失败时保持关闭，先核验自有子进程退出，再按本轮准备流程保存新增数据、恢复旧宿主、隔离恢复本轮数据；不直接覆盖失败现场。重开交接后旧授权结束，未来回退需另保护届时新数据。
