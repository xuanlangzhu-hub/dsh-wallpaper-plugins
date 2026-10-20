# rc.33亮度/遮罩短验：150%已过曝，改为120%上限；rc.31已恢复

2026-10-16，Codex。本轮承接[候选核包](RC33_APPEARANCE_BRIGHTNESS_CANDIDATE_20261016.md)，用户明确确认“已正常退出，可以临时安装短验”。用户实际反馈：**“200太夸张了，150的时候就过曝了，感觉最多原生100增加到120最多了，遮罩这样就行了”。** 停止清理通过，随后按约定恢复日常rc.31和本轮原设置，用户确认“重开正常，外观布局正常，播放停止”。

结论：200%范围不继续采用；[补修任务](GEMINI_NEXT_APPEARANCE_BRIGHTNESS_120_REPAIR_20261016.md)收窄至20–120，默认70、遮罩保持。120%是用户新要求，未把它写成已单独实机验收。rc.33原包及200%源码暂保留作历史/待补修输入，不覆盖归档或安装为日常。

## 已完成

- 确认DSH/capture/worker退出，原WE PID11992路径及启动身份保持，未强杀进程或关闭原WE。
- 本轮新备份：`C:\Users\HP\.dsh\backups\rc33-brightness-candidate-20261016-eb1e95d4`；5个Profile、10个完整关闭Local Storage文件逐项核验。安装前rc.31的28安装文件、5Profile/10存储均与原归档/本轮备份匹配。
- 官方CLI临时安装固定rc.33归档成功，SHA256仍为`48052B724F8737BD7C26B095731928979CD16405999DDDA8D6E807B23C207DBC`。
- 安装后28文件与归档逐字节一致，10关闭存储未变。Profile仅package.json/pnpm-lock.yaml发生安装所需变化，package中仅插件归档依赖从rc.31切到rc.33，其它依赖/配置保持。
- 没有重新构建、覆盖候选或修改生产源码，没有改启动环境/全局设置。设置工具一处错误消息中的旧版本标签已纠正为rc.31，不改变备份/恢复逻辑。

## 实际观察与停止清理

请求用户正常重开，选择Lucy、日常模式且关闭自动播放，手动开始；依次约100%、约150%、200%观察，再将遮罩调为0%，其它外观项不动。实际完成了Lucy播放并给出上述过曝/遮罩反馈；各档精确数值、持续时间和动作边界未独立记录，不冒充严格A/B或对120%已有观感结论。

新run为`2026-10-16T114216-3f0d-lucy`，location `WhaleWallpaperProbe-261016114216-00e0`，capture PID24676、源HWND2492694，源进程为原WE PID11992。全生命周期59.0903326秒、原生1694帧；后端`kernel-highres-worker/highResolution=True`。末次客户端received1689、draw1518、丢旧帧170，解码/同步/绘制错误0；这里只保留运行事实，不推导源/屏幕FPS或性能结论。

本轮最终Host `running=false/failure=null`，原生`parent-stop`、源关闭且`safeToCleanUp=true`，Host收尾确认closed。任务栏worker `cleanupSafe=true`，额外进程复核capture/worker为0、原WE路径及启动身份保持。日志保存至本轮`stopped-run-evidence/`，观察摘要为`short-test-observation.json`。

## 恢复与最终状态

用户确认菜单正常退出后，核验DSH/capture/worker均退出及原WE身份，先将CLI重装前的5Profile保存在本轮备份`profile-before-daily-reinstall/`。官方CLI恢复固定rc.31，再由设置工具恢复本轮5Profile/10存储；同时保留重装后Profile及测试时存储，没有删除用户数据。

`restored-rc31-closed.json`证明28安装文件、5Profile、10关闭存储恢复一致。用户日常重开确认正常且停止后，`final-verification.json`证明28安装文件及5Profile一致、capture/worker为0、原WE身份及官方EXE/app.asar保持。10存储的精确恢复来自关闭时验证，重开后不硬比活跃存储。

本轮证据目录：`F:\dsh-wallpaper-plugins\.tmp\rc33-brightness-candidate-20261016-eb1e95d4`。安装/备份、用户原始反馈、停止及恢复/重开核验均记录于此；旧归档、测试数据和实测日志保留。没有修改生产/QA或版本、重建/覆盖包、调整启动环境或向其它助手发送任务；下一步仅按新120%要求交小G补修。
