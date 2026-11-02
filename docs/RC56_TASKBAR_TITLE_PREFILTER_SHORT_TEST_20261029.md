# rc.56标题预筛实测与rc.53恢复（2026-10-29）

结论：本轮两次身份检查为33.6199／8.9822ms，上轮rc.55为921.3161／886.4631ms；动作报告的触发→完成字段差从4.244秒降到0.572秒。用户仍确认“图标短暂出现后消失”。**支持标题预筛能减少当前后置动作的等待，不代表创建起不显示，也不是严格控制变量性能基准。**

已恢复日常DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2和本轮原设置／媒体／布局，正常重开后inactive／session空／capture0，原WE保持。用户确认“原外观和布局正常，播放停止”。本轮已关闭，rc.56没有提升为日常或公开发布。

## 本轮身份和范围

- 用户新确认：“已正常退出，可以临时安装短验”；依据[候选准备](RC56_TASKBAR_TITLE_PREFILTER_CANDIDATE_20261029.md)使用全新轮次，没有复用旧许可或备份。
- 证据：`.tmp/rc56-taskbar-title-short-trial-20261029-a/`；新备份：`C:/Users/HP/.dsh/backups/rc56-taskbar-title-short-trial-20261029-a`。
- 临时包：`0.6.0-rc.56`，SHA256 `85258A1BD5F5A6E421C6CCAA7E21D3DE5C28725EA5E8F92A19115D43D91BD160`，43安装文件一致；原apphost／deps／依赖未提升。
- 一轮Lucy，日常／手动播放／临时关闭自动播放，没有调整外观、作者参数或窗口布局。原选中After You, Lucy和原自动播放等设置在回退时恢复。
- 本轮location：`WhaleWallpaperProbe-261029061336-21a2`，HWND397872，capture PID46168。源PID11928与本轮新备份中的原WE相同；只关闭本轮location窗口，没有结束原WE。所有PID／HWND／端点均为历史证据，不是下轮授权。
- 与上轮rc.55留存数据核对，源尺寸868×517、位置2731／0、style／exStyle、owner和源进程创建身份一致；不同时间的无关窗口／系统负载没有严格固定。

## 时长与实际结果

Play调用前UTC记录为`2026-10-29T06:13:36.077Z`，Stop调用前为`2026-10-29T06:14:08.098Z`，相差 **32.021秒**；原生记录 **29.7038322秒**。均超过20秒计划，不能写成20秒短验。取完playing证明后等待、重新观察Stop和输入工具往返仍产生延迟；没有在播放中等待用户反馈，也没有重复播放。

`ui-events.json`中的UTC与ms是每次调用前分别采样，ms字段差32.003秒，与UTC差有18ms采样偏移；这些是注入调用前后记录点，不是精确OS鼠标事件时间。本轮未实现自动停止定时器，约30秒目标也没有当作硬截止保证。

用户视觉反馈：“图标短暂出现后消失”，未给具体秒数；没有主观流畅度确认。原生taskbarHidden／altTabHidden仍为null，不能用DeleteTab成功填成视觉隐藏时间或零闪现。

原始action／summary显示：

- 首个encoded／published帧序号1、采集时钟0.131秒触发；完成字段0.703秒，两字段差0.572秒。
- `firstFrame.capturedAt`至`completedAtUnixMs`的壁钟记录差为662ms；两套字段取点不同，不能混用、宣称精确Shell或图标消失持续时间。
- HrInit／DeleteTab均S_OK，worker started／exited／cleanupSafe=true，pending／timedOut／terminated／cancelled=false，before／after身份一致。
- 动作在飞期间14帧，动作后新帧序号17；原生合计864帧、changed864、保留864／容量1200。支持异步期间及之后仍有出帧，不当作屏幕FPS、主观平滑或全部播放性能证明。

## 同进程阶段计时对照

收集6项必需原生日志和2项M1 sidecar，均匹配本轮location／HWND／PID／100ns启动时间，原始字节及hash保留。两份计时均observed，各自使用独立clock origin，不进行跨进程elapsed相减。

| 同一类记录点区间 | rc.55留存单轮 | rc.56本轮 |
| --- | ---: | ---: |
| worker第一次身份检查 | 921.3161ms | **33.6199ms** |
| worker第二次身份检查 | 886.4631ms | **8.9822ms** |
| COM创建 | 7.8419ms | 7.3378ms |
| HrInit | 0.9115ms | 0.9117ms |
| DeleteTab | 1.2624ms | 1.2815ms |
| 父调度→执行器 | 996.6537ms | 31.1723ms |
| worker启动 | 37.8924ms | 49.8082ms |
| 父观察worker退出等待 | 2091.2995ms | 416.9453ms |

父调度→执行器包含调用前Inspect，不是纯任务队列等待；退出等待包含子侧检查等工作，不能再与子区间相加。原生／诊断记录开销、冷启动与系统状态会影响结果，两个样本不构成稳定百分比承诺。Process.Start本轮38.3789ms，未显示预热worker是当前必要步骤。结果与[离线368→8次读取](TASKBAR_TITLE_PREFILTER_OFFLINE_REPAIR_20261029.md)一致地支持减少无关进程查询的方向，但没有把所有旧0.9秒都归因于一个API。

## 清理和恢复闭环

29个本轮runner阶段全部退出0、无超时，包含成功snapshotPlaying、正常Stop、停止快照、源／capture清理验证、8项原始证据收集。源原生关闭结果closed，Host后续确认absent，均绑定本轮location；原WE身份保持。

通过应用菜单正常Quit，等待关闭后执行严格played恢复前置检查；未使用quiescent／未启动替代。先保留测后数据，再恢复rc.53原43文件、5Profile／11关闭状态外观存储、媒体2目标／9文件与布局3目标，关闭状态核对通过。正常重开后新发现Host核对inactive／session空／capture0；用户确认原外观和布局正常、播放停止。Electron重开后的自然存储变化不与关闭状态hash混用。

`native-trial-analysis.json`、`closeout-integrity.json`和`closed-out.json`已写，roundReusable=false。361保护输入、37冻结模板／收集器和旧归档保持；截图仅本机显示，没有加入Git或发行包。没有发布、提交推送、清理或派发。

## 接续

本轮“减少后置移除耗时”的短验完成，“源创建起完全不进任务栏”仍未解决。默认已恢复rc.53，不自动留rc.56日常。下一步等用户决定是否把这项优化作为本阶段成果保留日常；若要继续追求零初始入口，需单列创建期方案和实机范围，不能把owner／TOOLWINDOW／SW_HIDE、worker预热或去掉身份检查悄悄混入。TS随后、UI保持、三体暂缓。
