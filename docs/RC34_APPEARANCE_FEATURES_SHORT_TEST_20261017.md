# rc.34外观功能短验通过，rc.31与原设置已恢复并完成重开核对

最新进展：用户随后明确选择并完成[rc.34日常试用交接](RC34_DAILY_TRIAL_20261017.md)，现保留rc.34。本报告中的“未选择/日常rc.31”等为相应前阶段快照，原始构建与临时恢复记录保留。

2026-10-17，Codex。用户先确认“已正常退出，可以临时安装短验”，第一阶段后又要求“你来操作电脑吧”。本轮按[固定候选报告](RC34_APPEARANCE_FEATURES_CANDIDATE_20261017.md)执行。**已完成本机功能短验，恢复日常rc.31和本轮原设置，并由Codex代查恢复后的重开、布局及播放停止状态；本轮已收尾。rc.34保留候选，用户未选择它作为日常。**

## 本轮保护与安装

- 证据：`F:\dsh-wallpaper-plugins\.tmp\rc34-appearance-features-candidate-20261017-8f2a6c10`。
- 新备份：`C:\Users\HP\.dsh\backups\rc34-appearance-features-candidate-20261017-8f2a6c10`。关闭后5个Profile、11个完整Local Storage文件逐项哈希核对；另存日常rc.31固定tgz并核对指纹。本轮文件数为11，不沿用旧轮10个的数量。
- 安装前DSH及WallpaperProbe进程为0；本轮原WE为PID12236，路径`E:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe`，启动时间2026-10-17 08:54:54.320927 +08:00。安装后身份、路径、启动时间保持；历史WE PID不用作本轮授权。
- 官方CLI `C:\Users\HP\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd`执行`plugin --profile desktop add`固定rc.34归档，退出码0。未修改官方EXE/app.asar或全局环境。
- rc.34的28安装文件逐字节等同固定归档，SHA256 `8DDB36C86FEDA3DACAAB2904A49414E5DFDAEB2E7D0CC05F71BCAB67AC23EA75`。安装完成且DSH关闭时11个外观存储文件保持。
- Profile仅`package.json`和`pnpm-lock.yaml`发生安装所需变化；package依赖改为固定rc.34，除该依赖外的JSON结构保持，其余3个Profile保持。安装后5文件另存`profile-after-rc34-install/`。
- 安装阶段405个仓库/归档保护输入一致，官方EXE、app.asar、WE EXE及rc.31备份一致。之后只更新本轮报告和入口文档，不更改生产/正式QA。

## 当前进度

用户完成第一阶段后反馈：**“重开正常，新设置可切换，文字清楚”**。这对应正常重开/原布局外观、播放先保持停止、文字标准/增强以及主题跟随/自定义强调色的人工操作。按用户确认记为本机短验通过，不扩称所有颜色/主题均已实机验证，也不把隔离矩阵代替实机。

用户接管请求后，Codex使用computer-use技能的Windows接口操作原DSH窗口，未改大小或布局。接手时界面已经显示Lucy在日常模式播放，因此沿用同一轮，没有另点开始或重新开始，自动播放复选框保持关闭。

- 聊天底色：接手时0%，实际查看50%的半透明聊天列与100%的主题实色聊天列，侧栏仍可见壁纸、输入卡片保持；随后设80%用于排除预设误覆盖。
- 预设：开始显示Lucy未保存；设四项为亮度80、遮罩40、模糊0、不透明度70并保存，界面显示已保存，应用/删除按钮可用。把四项改成60/60/4/90，聊天底色改80、文字点增强；点击应用后实际控件恢复80/40/0/70，聊天底色仍80、增强选择保持。随后删除本轮新建预设，界面回到未保存，应用/删除禁用。
- 本轮只人工覆盖当前深色石墨主题及所选颜色；不扩称所有主题/任意颜色或动态壁纸对比保证。恢复前没有另行重启rc.34验证新字段的跨进程记忆，相关覆盖仍是隔离回归。

`ui-short-test-evidence.json`保存相关控件文本及结果，不另存完整会话截图。Windows接口短验与用户第一阶段反馈相互补充，没有将离线检查写成人眼确认。

## 停止与正常退出

点击停止后界面显示当前未播放；实际WallpaperProbe进程退出。本轮原始终态6个文件已复制至`stopped-run-evidence/`，归属核验见`stopped-run-and-retention.json`：

- run：`2026-10-17T052106-b1a0-lucy`；location：`WhaleWallpaperProbe-261017052106-a995`；capture PID42176，源HWND3604556，源进程为本轮原WE PID12236。
- 原生`parent-stop`，源关闭`closed=true`、`safeToCleanUp=true`；Host随后确认源不存在，taskbar `cleanupSafe=true`，failure为空。
- 原生全生命周期369.9740334秒、10842帧，是用户先开始、随后界面操作期间的功能运行，**不是受控性能测量**。启动时的后端初始化消息已不在有界诊断尾部，未据本轮日志独立确认后端名称；12个原生包文件等同rc.31的核包结论保持。
- Codex关闭设置后通过“应用→退出”正常退出DSH，等实际进程全部退出才开始恢复；没有强杀或终止原WE。

## 已恢复并完成重开核对

恢复前另存测试时5Profile至`profile-before-rc31-reinstall/`，完整Local Storage另存`electron-local-storage-test-before-reinstall/`。使用官方CLI重装固定rc.31退出码0，28文件一致，重装期间关闭状态测试存储11文件不变。

随后执行本轮设置恢复：测试存储保留至`electron-local-storage-after-test/`，恢复原5Profile和原11个完整外观存储文件；再次逐文件核验全部一致，rc.31的28安装文件与原归档一致。工具仍保存重装后Profile快照，不删除用户会话/附件或旧备份。原WE身份及官方保护文件保持。

证据：`restore-rc31-result.json`、`rc31-restored-before-settings.json`、`settings-restored.json`及`rc31-restored-with-settings.json`。恢复后曾中断，接续时用户明确同意继续完成核对；没有重复安装或短验。

接续现场DSH已经于13:35:09重开且处于最小化，Codex未重复启动实例。通过新窗口对象（HWND7344072）将其显示，观察原会话和正常布局；进入通用设置只读核对：开始按钮可用、停止按钮禁用、状态“未开始。点击「开始播放」创建本轮源窗口”，四项参数为100/0/0/40。设置核对后关闭设置面板，DSH保持打开，未改参数或再次播放。

恢复后28安装文件再次逐字节匹配固定rc.31，见`rc31-after-final-reopen.json`；界面核对见`rc31-reopen-ui-verification.json`。本次恢复重开验收由Codex代操作观察，不虚构用户另作反馈。原设置开关保持恢复值，不为测试再强制关闭自动播放；本次实际未播放。活跃Local Storage可正常更新，不再拿运行中存储强比关闭备份或强制覆盖。

最终`trial-final-verification.json`确认5Profile在重开后仍匹配本轮原备份，405个仓库/归档保护输入中仅7个接续文档变化，生产/QA/资产与全部归档保持；官方保护文件一致。`final-process-verification.json`确认新DSH主进程PID65864保持、capture/worker为0、原WE PID12236的路径和启动身份保持。`git diff --check`通过。本轮没有提交推送或清理，用户及小G的未提交实现/QA与文档改动保留。

rc.34固定归档保留；用户未选择将它改作日常。**下一步建议先决定是否采用已短验的rc.34作日常试用，再考虑新增功能；这是建议，尚未获得安装/保留授权。** 若采用，另行确认当前方便并按新一轮备份/安装流程执行，不自动重装。

当前没有原生重编译、性能/GPU/三体专项、提交推送、清理或跨会话消息。
