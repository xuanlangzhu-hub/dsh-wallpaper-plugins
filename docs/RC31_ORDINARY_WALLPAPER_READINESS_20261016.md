# 回到P4性能优化收尾：rc.31候选复核与普通壁纸短验准备

2026-10-16，Codex。用户确认继续按“收口P4、普通壁纸短验、再决定日常版本”推进。**三体运动变速保留为未解决专项，当前暂不推进其脚本/源帧时间调查，不再作为插件性能候选收尾的前置阻塞。** 不把暂缓等同于修复或证实壁纸算法错误。

## 本轮已经完成

- 原候选 `F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.31.tgz` SHA256仍为 `F1C5B2A3ADCD2BA9B67CC3D432CDB8637B140ADDEDFD520D19CA0BB1B11965DB`，7,384,632字节、28文件，与原候选清单逐项一致，12原生运行文件保持。没有重建或覆盖归档。
- 相对rc.30仅README、package.json和WallpaperProbe.dll不同；DLL SHA256仍为 `5CD02541DC6C7F252168E100E17A77D47947EACF66068055F7ACD57508294C90`。相对日常rc.28另含client.js/session.js既有P2/P3观测差异，共5个不同文件；不能把rc.28→rc.31描述成只换一个DLL。
- 包内客户端/Host及DLL没有混入rc.32的Motion Cadence Trace。rc.31仍保留之前的轻量阶段计数，不宣称完全无观测。
- 现日常rc.28的28安装文件与原归档完全一致；工作区仍rc.30，34复审输入/54保护/29打包源/19原生源码/旧24归档及rc.32保持。
- 新当轮工具位于 `F:\dsh-wallpaper-plugins\.tmp\rc31-ordinary-readiness-20261016-f841a31e`：候选静态审计、当前安装只读核验通过；设置工具默认预演、PowerShell AST解析通过，未执行备份或安装，也未查询真实应用运行状态。

源码及候选没有变化，沿用P4最终复审、54等待自测和此前真实后端证据，不机械重跑全套、GPU矩阵或长测。[P4真实短测](COMPLEX_SCENE_P4_FOREGROUND_RESULT_20261015.md)已有本机三体短窗口的等待改善和用户“好了很多”反馈，但不扩大为长期稳定或所有壁纸通用验收。

## 下一次短验的最小范围

1. **当前方便确认和新备份**：暂停其它助手、确认DSH无任务，用户正常停止并菜单退出。核实DSH/capture/worker结束，原WE保持；备份**此次**5个Profile与完整关闭Local Storage，不复用三体筛查或昨天备份。当前播放状态不查询、不假定。
2. **只临时安装现有候选**：使用官方CLI给desktop profile安装上述固定rc.31归档，逐字节验证28安装文件及关闭存储保持，再由用户日常重开。不开逐帧Trace、不改全局环境、FPS/品质/物理参数或窗口外观。先确认没有意外播放，再手动进入普通壁纸。
3. **Lucy普通壁纸短验**：选择“Lucy（已验证样例）”，日常模式、自动播放关闭，原窗口/外观保持；手动开始后保持前台约20–25秒，其中缓慢移动鼠标约10秒，然后直接停止并等待清理。不先回来报“已开始”，不点重新开始，不要求静止/鼠标各跑一长轮。
4. **判据**：用户确认有效动态、没有明显冻结/忽快忽慢、鼠标操作和界面响应正常；核对新run的kernel-highres-worker启动诊断、接收/绘制进度与错误，并证明parent-stop、Host无failure、源关闭、任务栏worker安全结束、capture/worker为0及原WE身份保持。原有日志够用，不加新仪器。若后端回退、症状复现或证据缺失，如实记录，不能直接宣布P4性能已验收。
5. **恢复，再决定日常版本**：默认仍正常退出、恢复rc.28和本轮设置，用户重开确认；普通壁纸结果通过后，由用户再明确决定是否将rc.31作为日常，不默认永久保留临时安装。

这是普通壁纸兼容/生命周期短验，不是同条件性能A/B，不对源渲染或屏幕FPS作新结论，不要求三体匀速问题先解决。任何失败先正常停止并保留证据，不自动开多轮或让小G继续猜改调度。

## 具体操作与恢复边界

工具内 `closed-settings.ps1` 只负责本次设置备份/恢复，默认预演；`verify-installed.py` 只读比较归档与安装，可在候选安装后检查Local Storage未变、日常恢复后检查Profile/存储与备份一致。它们不负责自动关闭源或安装包，安装/停止证据/恢复均由Codex分步核对，不能一次连跑。

计划新备份：`C:\Users\HP\.dsh\backups\rc31-ordinary-readiness-20261016-f841a31e`，当前未创建。

候选归档和CLI固定为：

```powershell
$cli='C:\Users\HP\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$candidate='F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.31.tgz'
$daily='F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.28.tgz'
# 仅在新鲜方便确认、核实完全退出后执行本轮备份。
.\closed-settings.ps1 -Stage backup -Execute
# 安装前再次核实DSH/capture/worker均退出、原WE身份保持、备份及归档哈希正确。
& $cli plugin --profile desktop add $candidate *> .\install-rc31.log
# 必须先检查CLI退出码；异常保留证据，不继续打开DSH。
python .\verify-installed.py candidate --check-backup --output .\installed-candidate.json
# 用户短验正常停止；核对新run终态和源/worker退出，再让用户菜单退出DSH。
# 恢复前再次核实退出、原WE及归档，先保留CLI重装前的测试时Profile。
& $cli plugin --profile desktop add $daily *> .\restore-daily.log
# 检查CLI退出码与日常版本后，才恢复本轮设置。
.\closed-settings.ps1 -Stage restore -Execute
python .\verify-installed.py daily --check-backup --output .\restored-daily.json
# 用户最后正常重开确认。
```

实际执行前再次验证备份完整、原WE路径/启动时间及包指纹，不能用旧PID。恢复时先把测试时5个Profile另存到本轮备份内的新目录，再运行CLI恢复，设置工具会额外保留重装后Profile与测试时Local Storage，不删除用户数据。恢复前所有移动路径须保持在明确的本轮备份/指定存储目录内；退出未完成则等待后复核，不强杀或复用前一轮退出确认。

本轮只准备与静态核包，未运行CLI安装、helper、源窗口或实时采样。没有新编码任务、rc.33、新包、生产/QA改动、提交推送或自动消息。

## 证据

新工具目录中的 `candidate-preflight.json`、`installed-daily-preflight.json`、`settings-preview.json`、`before.json` 和收尾 `readiness-verification.json`。P4旧候选/短测、三体同源/无采集调查证据均完整保留，历史三体专项不再作为当前NEXT_TASK默认动作。
