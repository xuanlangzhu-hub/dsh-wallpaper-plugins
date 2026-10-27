> 后续更新：[本地 web 源码及 rc.41 候选离线核验](WALLPAPER_WEB_OFFLINE_DELIVERY_20261020.md)已完成，未安装。下文“未放宽类型”指本轮源观察阶段；当前开发源码已最小接入，日常 rc.40 仍保持。

# web 本机无采集源窗口观察通过

2026-10-20。用户本轮确认“已正常退出，可以做web无采集源观察”。按[准备记录](WALLPAPER_WEB_FEASIBILITY_INVESTIGATION_20261020.md)新备份后，用固定rc.40 helper及批准项目JSON打开本地Everyone样例“Deepseek鲸鱼娘萌物！”。**用户确认“画面正常，秒钟和粒子持续变化”；20秒观察结束后正常关闭，原WE/日常rc.40/原设置核验保持，用户已正常重开。**

本轮仅证明这张web的独立源窗口可见动态与受限清理可用，**不证明DSH已经能选择播放web，不证明WGC采集/传帧/渲染链通过**；未安装新包、未开启采集、未修改原生生产assets或放宽播放类型。

## 本轮证据

- 新备份：`C:\Users\HP\.dsh\backups\web-feasibility-20261020-839147ca`，5个Profile、9项关闭Local Storage，另保留活动rc.40原包及3项原布局设置，逐项核验。
- 证据：`F:\dsh-wallpaper-plugins\.tmp\web-feasibility-20261020-839147ca`，含授权、新备份、准备/基线、helper命令与退出结果、ready/closing/finished、父监督及用户反馈。
- 本轮location：`WhaleWallpaperProbe-web-261020074648-4be03154`；源窗口HWND4261904，客户区1280×720，普通可见、未最小化/隐藏。
- 源窗口确属本轮原WE PID11980、可执行文件wallpaper64.exe、精确启动FILETIME134369309316465382；无需扩大对CEF或其它进程的信任。以上身份仅作本轮证据，不在下轮复用。
- observe阶段25.657秒包含预检/启动/观察/关闭，退出exit0、确认退出、无超时。worker结果observation=elapsed、cleanup.closed=true/outcome=closed。
- verifyAfter实际检查通过：源窗口不存在、无本轮采集、实际日常rc.40及新备份设置一致、原WE身份保持。未覆盖不需要恢复的设置。
- 用户最终确认“重开正常，外观布局正常，播放停止”。只读收尾复核DSH已打开、WallpaperProbe进程0、安装仍rc.40、原WE保持，见live-closeout.json。

## 接入结论与下一步

本机可以用**已登记web的project.json**沿现有helper JSON接口启动，不需要在第一版中放开任意HTML参数、另起浏览器或套用MP4单文件副本桥。下一步仅离线准备受限本地web接入：catalog与重验、Host路径描述、主/从动作和可用性提示必须一致；前端仍只提交ID，Host重验web类型、HTML入口与受限根，保留选择/播放分离、分级和停止清理锁。

接入后仍需针对受审候选安排一次实际DSH采集/显示短验，届时另取当时方便确认并做新备份。当前日常保持rc.40，工作区manifest/生产assets仍rc.30；不直接打整个开发树。application可行性与两项Scene大小写兼容缺口另收束，作者公开参数后排。
