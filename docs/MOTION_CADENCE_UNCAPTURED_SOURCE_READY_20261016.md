# 无采集源窗口筛查：隔离工具已准备，等待本轮方便确认

2026-10-16，Codex。依据[源端调查二审](MOTION_CADENCE_SOURCE_SIDE_SECOND_REVIEW_20261016.md)完成隔离工具准备。**当前仅离线检查通过，没有创建源窗口、查询或移动真实应用窗口/进程、执行设置备份。日常仍为rc.28，不需要小G继续改代码或安装新包。**

## 这次要区分什么

历史A：同一被捕获源恢复可见时，用户报告源和DSH均突变。拟做B：DSH正常退出，工具只创建新三体窗口，不启动本轮WGC、读回、编码、pipe或Host会话，观察约15–20秒，再正常验证关闭。

这仍是**不同初态、不同系统负载与焦点历史的新实例定性筛查**，不是严格单变量因果证明：

- 无本轮管线时也突变：支持继续查源场景/专属窗口条件，不能排除历史A的采集反馈或下游叠加。
- 观察期平滑：整条负载或两轮运行条件差异值得继续区分，不能直接确证WGC。
- 场景未初始化、没有有效动态、初态/事件不可比或难以判断：未知，不能记作平滑/通过，不重复长测凑结果。

## 用户实际步骤

1. 另确认现在方便，暂停其它助手并确认DSH无运行任务；停止播放，通过菜单正常退出DSH，先不重开。原Wallpaper Engine保持运行，不改品质/FPS/演算属性。
2. Codex核验退出，保存**这次**的5个Profile文件与关闭状态Local Storage；在DSH仍关闭时建立新WE身份/脚本/安装与物理工作区基线。不上次的备份或trial。
3. Codex通过已有rc.28 helper短暂控制命令创建本轮唯一源，验证location/HWND/实际WE启动身份；按实际尺寸/样式与历史源比较。只在预演合格后，将其只改坐标放到可见工作区。用户无需按像素拖窗口。
4. 提示后用户观察15–20秒，保持普通浮动窗口，不最大化/全屏、不改参数；反馈“类似突变 / 未复现且有正常动态 / 未初始化或无法判断”。记录当时前台/鼠标条件。工具不声称已测出源FPS或物理速度。
5. Codex显式调用本轮身份绑定的验证关闭入口，核实源缺席和原WE保持；再恢复本轮Profile/存储，保留测试时数据。用户日常重开确认外观/窗口正常，播放先保持停止。

若准备阶段尚未创建源便拒绝，记录原因，不继续窗口操作；仅完成备份不会改变原设置。若创建后尺寸不匹配，不观察、不改源尺寸/样式，使用本轮拥有关系正常验证关闭。启动超时、从未绑定到源的“当前没有窗口”不能作为排除迟到创建的证明，需保留未知并复核，不强杀原WE。

## 工具、默认模式与边界

目录：`F:\dsh-wallpaper-plugins\.tmp\uncaptured-source-screen-20261016-67efbc05`

- `source_screen.py`：默认plan只输出准备信息，不构造Win32接口，也不查应用。prepare/move-plan/verify-visible仅做授权后的只读实时核验；只有open/move/close加明确execute才做窗口动作。没有capture或任意helper参数入口。
- `win32_support.py`：冻结摘取已使用的Win32 ABI/身份读取方法，导入无原生调用。所有真实读取和动作只在后续本轮确认后执行。
- `closed-settings.ps1`：默认预演，不创建备份。实际backup/restore均要求DSH/capture/worker退出；恢复还要求本轮cleanup-confirmed绑定备份manifest。先保留测试时数据再复制原件，不删除用户数据，不安装包。
- `reference.json`：冻结上轮物理客户区/外框尺寸1302×776、style/exStyle及历史plan哈希。1280×720只是本轮候选启动请求；initial-offscreen请求borderless，仍须实测读回，不能由NOSIZE保证成为1302×776。
- `offline_checks.py`：真实gate/Runner注入fake OS/helper，测试创建、移动、关闭的成功与拒绝分支。没有操作真实应用。

新基线与创建授权有效30分钟，移动预演有效60秒；创建前先写唯一open-claim，防启动失败后重复创建。动作意图与绑定记录追加到events.jsonl。关闭可在基线过期后按原拥有关系执行，但仍须原WE/工具/安装/窗口身份不变、DSH与本项目capture均关闭；不能因为时间过期放弃必要清理。

关闭采用真实 `--window-ensure-closed <当轮location> 15000 --expect-pid <实际PID>`，验证返回值及原生缺席；closed和already-absent分别记录。无源曾被绑定时不因absent直接出具恢复证明。成功清理也不证明场景曾有正常运动。

本轮工具不启动自己的采集管线，不意味着审计了全系统所有捕获软件或GPU完全隔离。源进程与原桌面WE相同；不关闭、重启或强杀该进程。不修改生产/QA、FPS/P4/RAF/latest/trace容量、品质与演算参数、工作坊资产或持久启动环境。

## 分步入口（仅在新鲜确认后使用，不能一次连跑）

```powershell
# 0. 当前默认预演；没有应用查询/动作。
python .\source_screen.py --output .\preview-new.json
# 1. 用户正常退出DSH后保存本轮设置。
.\closed-settings.ps1 -Stage backup -Execute
# 2. DSH继续保持关闭，绑定新备份和当前原WE。
python .\source_screen.py --mode prepare --backup-manifest .\closed-backup.json --ready-confirmed --output .\trial.json
# 3. 明确创建一次，只运行helper控制模式，不开capture。
python .\source_screen.py --mode open --trial .\trial.json --execute --output .\opened.json
# 4. 只读预演；若尺寸/样式等不匹配，跳过观察和移动，转正常清理。
python .\source_screen.py --mode move-plan --trial .\trial.json --output .\move-plan.json
python .\source_screen.py --mode move --trial .\trial.json --move-plan .\move-plan.json --execute --output .\moved.json
# 5. 用户观察后，可只读核对同一可见源和无本轮管线条件；不伪造新帧证据。
python .\source_screen.py --mode verify-visible --trial .\trial.json --move-plan .\move-plan.json --output .\visible-verified.json
# 6. 显式正常关闭、证明缺席，然后恢复设置。DSH仍未重开。
python .\source_screen.py --mode close --trial .\trial.json --execute --output .\closed.json
.\closed-settings.ps1 -Stage restore -Execute
# 7. 用户正常日常重开确认。
```

每个输出必须是工具目录内的新文件；错误记录保留，修正状态后用新输出名。实际窗口操作不得盲重试，不绕过尺寸/身份/工作区/关闭检查。

## 离线验证与保护

- **36项检查通过**：合法全流程与launcher PID不等于渲染PID；DSH/worker活动、重复/其它源、旧PID/启动时间/路径、准备或plan过期、迟到源/从未出现源、尺寸/style不匹配、最小化/cloaked、工作区变化、执行前竞争与重复移动、假关闭成功/错误关闭报告、already-absent与清理过期仍可执行、输出/证明不覆盖、备份/安装/脚本被改拒绝等。
- PowerShell AST解析通过，备份脚本默认预演未创建任何备份目录或设置更改；默认Python plan实跑只输出元数据。
- Python AST与Win32导出/ABI、带空格的合成命令行解析通过；仅切换并恢复工具自身线程DPI上下文，未枚举或读取真实应用窗口/进程、未执行helper。原生位置读回/实际关闭/用户视觉仍未实测。
- 初次离线运行发现摘取库漏导入hashlib，所有32个用例在同一入口报NameError；补齐标准库导入后32项通过，再补文件完整性检查，最终36项通过。保留修复说明及测试日志，不隐瞒初始失败；没有实机动作受影响。
- 34复审输入、54保护、29打包源、19原生源码、旧24归档及rc.32保持；工作区仍rc.30，日常rc.28保持。没有打包、提交推送、自动消息或GPU长测。

证据：目录内`before.json`、`default-preview.json`、`closed-settings-preview.json`、`offline-checks-final-v2.log`、`native-abi-final.json`、`preparation-verification-final.json`。新备份计划路径为 `C:\Users\HP\.dsh\backups\uncaptured-source-screen-20261016-67efbc05`，**当前尚未创建**。
