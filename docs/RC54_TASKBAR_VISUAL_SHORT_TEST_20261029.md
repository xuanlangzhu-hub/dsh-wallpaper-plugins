# rc.54任务栏视觉短验：仍会短暂出现，随后消失；已恢复rc.53

2026-10-29。用户本轮确认“已正常退出，可以做任务栏视觉短验”，助手新备份、临时安装并操作一轮Lucy。用户反馈：**“图标短暂出现后消失”**。因此可确认本轮确有短暂入口且随后消失，不能把rc.54称为“创建起不显示任务栏”或本项目任务栏目标完全解决。用户没有提供消失时间估计或主观流畅度结论。

日常已恢复 **DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2**。关闭状态恢复核对及正常重开后的停止检查通过，助手观察原外观和窗口布局正常，采集0，原Wallpaper Engine身份保持。本轮未提升rc.54日常，未公开发布、提交推送、清理或派发实现。

## 固定输入和新轮边界

- 沿用[已审rc.54候选](RC54_TASKBAR_FIRST_FRAME_CANDIDATE_20261028.md)，43文件，SHA256 `D9E28918522C3ABFF974465D53604583BAC520806D388EAE773F84BCDAF2F096`；没有重新构建或改实现。
- 回退原rc.53归档SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。
- 新轮工具／证据：`.tmp/rc54-taskbar-visual-short-trial-20261029-a/`。备份：`C:/Users/HP/.dsh/backups/rc54-taskbar-visual-short-trial-20261029-a/`。
- 从昨晚固定工具白名单复制36项脚本；预先选用已审的同轮`playing`身份快照绑定恢复脚本，先做layoutAfter及关闭状态runtime核对，再重开。没有复制旧authorization、端点、PID／HWND、备份或运行结果。
- 27个PowerShell脚本解析、10授权对象、5恢复精度、7播放清理绑定及19个无授权入口拒绝检查通过；这些是工具检查，不叠加成插件或视觉测试次数。
- 今天新备份包含5个Profile、11个关闭状态Local Storage文件、活动rc.53和两原包、3项布局目标及2项目标媒体存储。安装43文件逐字节一致。

## 实际播放和视觉结论

仅选择已验证Lucy、日常模式、本轮关闭自动播放；不改作者参数或外观数值，不重试或重复播放。Windows界面操作使用computer-use技能的`node_repl`／`@oai/sky`，正常应用菜单退出，没有终止原WE或改系统任务栏设置，没有发送DSH模型请求。

原计划约20秒观察，实际开始点击01:02:35.501Z、停止点击01:03:08.415Z，相差 **32.914秒**；自动化观察及取证开销使时长超出计划。原生Summary为31.3234433秒，二者时钟边界不同。不能写成实测20秒。

| 证据 | 本轮结果 |
| --- | --- |
| 用户视觉反馈 | 图标短暂出现后消失；没有持续秒数估计 |
| 实际请求 | `minSeconds:0` |
| 首个已发布帧／触发 | sequence1，采集时钟0.120秒，published=true |
| worker完成 | 采集时钟3.451秒；与触发差3.331秒 |
| 异步期间 | framesWhilePending96；动作完成后的有效帧sequence99 |
| 动作／终结 | HrInit和DeleteTab均S_OK，一次动作，worker退出且cleanupSafe=true，无超时或终止 |
| 身份与窗口 | beforeIdentity／afterIdentity完全一致 |
| 停止 | parent-stop；源窗口正常关闭，Host inactive／session空、本轮源窗0、采集0，原WE身份保持 |

0.120秒是采集时钟，不能写成点击或创建后0.120秒；3.331秒包含worker启动、身份验证、COM及监督，不能全归因Shell，也不是用户测得的图标消失时间。没有同条件rc.53视觉对照，不能量化这次图标停留缩短了多少。

原生日志中的`taskbarHidden`和`altTabHidden`仍为null，保留原始值；用户反馈单独存入`native-trial-analysis.json.userFeedback`，其中entryObserved=true、entryDisappeared=true、zeroInitialEntry=false。没有补填主观流畅度通过。

Summary875帧／changed874，帧日志total及保留874条，属于不同记录边界；不补造缺失条目，不当显示FPS。原始6份日志按location／HWND／源PID／采集PID与真实播放、清理证明核对后逐字节留存于`native-run-evidence/`。

本轮源窗口由**原WE进程**承载，源PID与备份中的WE PID相同。所有关闭结论指本轮location的窗口，不能声称WE进程已经退出或强求源PID必须与原WE不同；原WE身份在恢复前后均保持。

## 恢复和证据完整性

正常停止后通过严格played恢复分支；先留存测后数据，再恢复包、设置、布局、媒体。28个运行步骤均退出0、无超时；关闭状态rc.53原43文件、5个Profile／11个外观存储、媒体和布局核对通过。正常重开后新鲜端点确认inactive／session空／capture0，助手观察原外观布局正常。用户未单独确认本轮恢复外观，不代填人工确认。

361项保护输入、原36项模板、新轮适配脚本、两归档哈希保持；`closeout-integrity.json`和`closed-out.json`已保存。本轮不复用，之后实机必须重新确认当时方便／无任务并新备份。

两项工具／分析偏差保留：离线检查驱动放入新工具目录后，旧版本文字扫描误扫到驱动自身的匹配字面量，检查拒绝；独立recheck只排除驱动本身，原工具与授权门禁未放宽。恢复后首次整理日志误断言源PID必须不同于原WE，纯分析拒绝且未复制文件；核对真实窗口协议和原WE身份后，改为按location／窗口身份绑定，如实记录同PID，不改变清理或恢复证明。两项都不是插件播放失败。

## 下一步

任务栏剩余目标现在明确为**创建期短暂入口**。先做离线调查：核清源窗口何时已可见／被Shell登记、WE支持的启动方式、首帧以后移除的能力边界及worker各阶段证据是否足够；提出一个保持采集、鼠标交互和停止清理边界的最小方案。当前没有选择或实现owner／TOOLWINDOW／SW_HIDE等新策略，不自动再开窗、安装或将rc.54留日常。若确需新增实际观测，再单独准备新轮。TS随后，UI保持，三体暂缓。

上一轮技术记录见[10月28日实测](RC54_TASKBAR_FIRST_FRAME_SHORT_TEST_20261028.md)，不覆盖其当时未取得的视觉反馈。
