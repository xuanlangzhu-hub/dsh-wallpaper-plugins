# rc.56标题预筛候选与短验准备（2026-10-29）

后续状态：已按用户当轮新授权完成[rc.56短验并恢复rc.53](RC56_TASKBAR_TITLE_PREFILTER_SHORT_TEST_20261029.md)。两次检查33.6199／8.9822ms，动作字段差0.572秒，用户仍见短暂入口。29阶段通过，恢复重开与用户确认闭合；旧轮不可复用。以下“尚未安装”为当时准备记录。

结论：本机候选已核包，新的备份／恢复工具通过离线门禁；尚未安装或实测。日常DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2保持。此候选旨在测量身份检查是否缩短，不承诺任务栏图标从未出现。

## 固定候选

承接[标题预筛整合预检](TASKBAR_TITLE_PREFILTER_INTEGRATION_PREFLIGHT_20261029.md)，以固定rc.55归档为底座，替换已审DLL，单列新候选版本／README；不从共享rc.30／Trace树整体打包。

- 文件：`.tmp/rc56-taskbar-title-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.56.tgz`。
- SHA256：`85258A1BD5F5A6E421C6CCAA7E21D3DE5C28725EA5E8F92A19115D43D91BD160`。
- 7,265,680字节／43文件；a、b两独立目录生成的归档同字节。
- 相比rc.55仅 `assets/wallpaper/WallpaperProbe.dll`、`package.json`版本和README前缀改变；40文件、23JS与13其它资产保持，原apphost／deps／runtimeconfig不换。
- DLL SHA256：`730DC34D8CAB1970093746CF1F1699EB833C02A267AE68BDFCC55CDFAF93D1E2`。没有重新编译原生或升级依赖。package仍private:true、宿主／SDK配置保持，不新增安装脚本。
- 配方与清单：[release-sources/rc56](../release-sources/rc56/README.md)、[全文件清单](../release-sources/rc56/package-manifest.json)、[候选记录](../release-sources/rc56/candidate.json)。打包后重新读取实际归档核对内容、白名单和文件模式。

## 新工具与离线检查

新轮：`.tmp/rc56-taskbar-title-short-trial-20261029-a/`，默认回退rc.53。只复制36项固定脚本模板并新增1项守门计时收集器；新root／purpose／版本／归档hash替换，严格playing身份绑定与恢复围栏保持。没有复制任何旧authorization、端点、PID、真实备份或结果。config为 `profileWritesAuthorized:false`，对应生产备份目录尚不存在。

三项有界准备阶段退出0、无超时，总截止90秒：

- 27个PowerShell脚本解析，所有Python／Node语法通过。
- 10项授权对象、5项启动时间精度、7项清理身份绑定检查通过。
- 20个无授权入口拒绝，23项runner引用闭合。
- 13项收集器夹具通过：当前源身份／100ns启动时间、缺失与损坏计时、时钟／角色／外来目标、原始日志保留等。夹具只读自造日志，没有读取日常原生日志。

361保护输入、旧模板、M1／预筛源DLL、rc.53／54／55及公开归档保持。没有运行实机preflight、生产备份、安装、窗口／进程采样、DSH模型请求、发布、提交推送、派发或清理。

## 下一次真实短验

[单轮计划](../release-sources/rc56/TRIAL.md)明确：另取当时方便／无任务与正常退出确认，新备份后临时安装、关闭状态核包／布局／runtime再重开；一轮Lucy日常模式、自动播放关闭，由助手代点。用户只需留意启动时额外任务栏图标是否出现、大致多久消失。

计划约20秒播放，只取必要playing证明后优先正常停止；接近30秒先停，不等待反馈或进行证据分析。此为操作目标，**没有伪称已实现自动停止定时器**；若工具控制延迟超时，记录真实时长。上一rc.55实际62.418秒已如实留档，不能再次把计划时长当实际。

停后验证本轮源／采集清理并保留6项日志＋最多2项计时，再正常退出、保留测后数据、严格played恢复rc.53／本轮原设置／媒体／布局并正常重开确认。旧轮授权与备份不可复用，缺失playing证明不作未启动。原WE必须保持，源PID可与它相同。

比较M1的两次身份检查与DeleteTab阶段各自同进程计时；不混减不同clock origin，不累加嵌套区间。离线368→8是夹具IO次数，不是实测毫秒或视觉成功，计时sidecar不授权清理。本轮没有决定日常提升；TS随后、UI保持、三体暂缓。
