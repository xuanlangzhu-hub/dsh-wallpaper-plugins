# 同源对照方案A：隔离脚本已准备，等待本轮实机方便确认

2026-10-16，Codex。接续[调查二审](MOTION_CADENCE_SOURCE_INSTANCE_SECOND_REVIEW_20261016.md)，已准备隔离脚本及设置备份/恢复工具。**不需要小G改代码、不需要新包；计划使用现有日常rc.28。当前仅完成离线准备，未开始实机，未查询或移动DSH/壁纸窗口、备份/改写用户设置。**

## 用户实际需要做的步骤

1. 确认当前方便，暂停其它助手并确认DSH无任务；停止播放，通过菜单正常退出DSH，先不重开。Codex核验退出并保存**这一次**的配置，不复用rc.32备份。
2. 备份核验后，用户用原日常方式重开DSH，保持播放停止。先用普通窗口状态记录原窗口布局，再按脚本的实际工作区结果把DSH放在左侧；源窗口绝不自动缩放。不最大化或全屏，不改品质/FPS/物理参数。
3. Codex绑定本轮DSH主进程/Host与原WE身份后，用户手动开始三体、日常模式、自动播放关闭。脚本只读检查新run，等真实tuck及任务栏worker结清，生成布局预演；合格后才明确执行一次源窗口坐标移动，将**同一个Host绑定窗口**放到可见区域。
4. 用户比较两边同一个球经过对应轨道事件的运动，观察约15–20秒后直接停止，再报告“源也突变 / 仅DSH明显 / 两边不同或不确定”。不把链路有延迟误认为两边应同时经过同一点，不需要录屏。
5. Codex核对本轮源/capture/worker停止、原WE保持，恢复本轮记录的DSH普通窗口位置/尺寸；用户再正常退出，恢复本次Profile/外观存储，最后正常重开确认。若布局不适合或任何状态未知，停止在检查阶段，不缩放源或绕过身份/清理门禁。

系统只读显示信息报告2560×1440；实际工作区和DPI仍在本轮预演时读取。以过去1302宽的源为例，两个同宽窗口加间隔不能完整并排，可能需用户临时缩窄DSH。脚本按实际边界计算，不采用固定x=1280；保存调整前DSH普通窗口布局并支持停止确认后恢复。此布局变化是观察条件，不称严格历史A/B。

## 工具与默认行为

目录：`F:\dsh-wallpaper-plugins\.tmp\same-source-plan-a-20261016-a9a0fd23`

- `same_source.py`：标准库实现，默认`plan`只读；没有新建、捕获、关闭、强杀窗口/进程或改变插件的入口。`move`和`restore-dsh-layout`必须明确加`--execute`，只操作核对过的本轮源或本轮DSH主窗口。
- `closed-settings.ps1`：默认仅显示预演；`-Execute`才备份/恢复。两阶段均要求DSH与probe完全退出，备份到新的`C:\Users\HP\.dsh\backups\same-source-plan-a-20261016-a9a0fd23`，恢复前保留测试时数据，原WE保持，不安装插件。
- `offline_checks.py`：只用合成状态/fake OS调用，测试与实机共用的绑定、布局、结果核查和runner拒绝路径。

实际操作需要新的关闭状态备份及30分钟内的试验基线；目标run必须在基线之后产生、位于批准的logRoot、属于三体catalogue id。旧run、过期基线或无用户本轮准备确认均不能进入移动流程。备份和结果不覆盖。

源窗口移动使用NOSIZE/NOACTIVATE，不写style/exStyle。执行前再次校验唯一location/HWND/PID/进程启动时间、Host/capture父子关系及命令行精确绑定；拒绝trace开启、源已在屏内、worker未结清、状态过期、布局重叠或尺寸变化。移动后读回位置/客户区/样式与capture尺寸，等待**移动前最后一次读取之后**的新帧；失败记为未知并要求正常停止，不自动关源/强杀或盲目回滚。

保留当前正常屏外启动环境；不必为了对照强制设置`WM_WALLPAPER_OFFSCREEN_START=0`。工具接受Host已经确认的initial-position或capture-then-tuck策略，再在该源实例上恢复可见，这减少额外启动条件变化。屏内显示本身的可见性/合成/焦点差异仍须记录。

## 执行入口（由Codex在确认方便后分步调用，不能一次全跑）

在工具目录中：

```powershell
# 用户正常退出DSH后，保存本轮设置。
.\closed-settings.ps1 -Stage backup -Execute
# 用户重开、保持停止且普通窗口化后，先记录原布局和本轮身份。
python .\same_source.py --mode create-trial --backup-manifest .\closed-backup.json --ready-confirmed --output .\trial.json
# 用户之后手动开始三体；显式指定刚创建的run，不能用旧日志。
python .\same_source.py --trial .\trial.json --run-dir '<本轮新run绝对路径>' --output .\plan.json
# 预演合格、目标/布局复核后才执行；plan有效期60秒，变化则重新预演。
python .\same_source.py --mode move --trial .\trial.json --run-dir '<同一run>' --plan .\plan.json --execute --output .\move.json
# 用户停止后，只读核对，再恢复本轮记录的DSH普通窗口布局。
python .\same_source.py --mode verify-stop --trial .\trial.json --run-dir '<同一run>' --plan .\plan.json --output .\stop-verified.json
python .\same_source.py --mode restore-dsh-layout --trial .\trial.json --run-dir '<同一run>' --plan .\plan.json --execute --output .\layout-restored.json
# 用户再次退出DSH后，恢复这次配置，随后用户正常重开确认。
.\closed-settings.ps1 -Stage restore -Execute
```

若一次预演因窗口宽度等拒绝，保留结果，用新的输出文件名重试，不覆盖既有证据。等待状态使用实际状态和有界期限，不能靠“已经过1秒”认定就绪。实机过程不自动连跑，不继续尝试其它窗口。

## 已完成的离线验证及限度

- **23项离线测试通过**：含合法方案/结果、句柄/PID/启动时间/路径/连接绑定改变、重复标题、状态过期/停止、worker pending、最小化/cloaked/最大化、布局不足与负坐标屏、计划过期、尺寸/style变化、无新帧、重复移动拒绝、源/捕获未退出与DSH布局恢复时有新probe的拒绝。
- PowerShell AST解析通过；备份脚本默认预演未创建备份目录或触碰设置。
- Win32导出及ctypes ABI绑定通过，合成带空格命令行解析通过；仅选择并恢复**工具自身线程**的DPI上下文，没有枚举/读取/移动用户窗口。不能由此宣称SetWindowPos、WGC或真实关闭成功。
- rc.28归档只读核对：Host windowReady/tucked、hub sourceSequence和DLL内workerCleanupSafe/isPending元数据均存在；这是兼容性检查，当前实时字段仍由预演验证。
- 本轮生产/QA/版本资产不变，不重跑GPU、长测或以前全套；最终保护见目录内`preparation-verification.json`。

参考：[SetWindowPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos)、[线程DPI上下文](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setthreaddpiawarenesscontext)、[GetWindowRect的DPI边界](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowrect)。实机就绪仍需本轮用户方便确认，当前播放状态不假定。
