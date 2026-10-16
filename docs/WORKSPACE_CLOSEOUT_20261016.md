# 工作区收尾记录

日期：2026-10-16。用户授权：“好，那就收尾，好久没推送和清理了，你来推送吧，再清理一下工作区”。

## 提交范围与当前状态

本轮汇总此前未推送的C1任务栏生命周期、rc.28周期查询修复、P1/P2/P3观测、P4原生等待、Motion Cadence Trace，以及对应QA、交付/复审和实机报告。保留失败与修订记录，避免只留下最终通过结论。

根README、AGENTS及PROJECT_STATUS改为简短当前入口；原PROJECT_STATUS全文另存[历史快照](PROJECT_HISTORY_20261016.md)。NEXT_TASK是本机忽略文件，保留短接续入口，不强制加入Git。

- 日常仍是rc.28；最近一次用户重开确认外观布局正常、播放停止。本轮未安装、退出、启动或采样DSH/WE。
- rc.31原归档及Lucy常规短验保留，是可选日常试用候选，本轮不切换。
- rc.32保留为诊断候选。三体源端突然变速尚未定位，按用户决定暂缓。
- 工作区manifest/生产assets为rc.30冻结基线，源码含后续已复审P4/Trace；本轮不重建生产assets、不改版本号或重打候选包。

## 提交前验证

以下均在本轮执行通过，属于离线检查，不代替实机或长期验收：

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 语法检查通过 |
| `npm run test:wallpaper-host` | 106/106通过 |
| `node qa/perf/check-frontend-stages.mjs` | 10类通过 |
| `node qa/perf/check-native-pacing.mjs` | 5类通过，独立构建/原生自检 |
| `node qa/perf/check-motion-cadence.mjs` | 7类通过，含独立原生构建、自检与Trace接缝 |

命令在`dsh-whale-mist`执行；日志保存在本机根`.tmp/push-close-*.log`。未重复GPU、真实窗口或长测流程。

## 清理与恢复边界

清理前逐项验证工作区路径、无重解析点、无Git跟踪文件，并将选中的可重建目录压缩留档。ZIP校验及全部3016个文件SHA-256核对通过后，使用PowerShell逐项删除146个目录，复核目标均已移除。

范围为根/插件`.tmp`与QA目录中的`obj`、`__pycache__`，另含正式probe及隔离wait QA的两处`bin`。其它发布输出、实测二进制、报告和原始日志保留。增加QA `bin/obj`及Python缓存忽略规则，避免后续误提交。

- 原缓存：121,377,608字节；压缩留档：43,128,157字节；净释放78,249,451字节（约74.6MiB）。
- 本机留档：`F:\dsh-wallpaper-plugins\.tmp\workspace-close-20261016-5d3ed9f8\rebuildable-caches.zip`。
- 同目录`cache-manifest.json`保存恢复相对路径、各文件指纹及ZIP指纹；`cleanup-result.json`记录删除结果。恢复时按清单选择性解压到工作区，避免覆盖后续新生成文件。
- 全部25个本机候选tgz、原备份及运行环境保留；归档/证据目录均继续忽略，不随源码推送。

提交与远端同步以本轮Git记录和最终核验为准。当前有效状态见[PROJECT_STATUS](PROJECT_STATUS.md)，旧报告中的下一步或应用操作确认不作为新一轮授权。
