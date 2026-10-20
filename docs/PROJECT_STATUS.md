> 2026-10-20 当前接续：[rc.40日常试用交接完成](RC40_DAILY_TRIAL_20261020.md)：用户授权保留rc.40，本轮新备份5个Profile/9项关闭存储、37安装文件核验通过；正常重开后原外观布局正常、播放停止、采集0、原WE保持。当前日常DSH0.2.1-rc.2/外观rc.40/Git Bash0.1.1，不自动恢复rc.38；rc.38回退包与本轮备份保留，日后回退先保护届时新增数据。MP4/Lucy前轮短验通过，本轮未重复试播。下文rc.38日常/待候选与短验为阶段历史。

# 项目状态与接续入口

更新：2026-10-20。源码仓库 `xuanlangzhu-hub/dsh-wallpaper-plugins`；本机开发路径 `F:\dsh-wallpaper-plugins`。

## 版本与现场状态

2026-10-19 [Grok auto离线协作读写通过](GROK_AUTO_OFFLINE_COLLAB_TRIAL_20261019.md)：隔离快照中1次读取/1次报告编辑完成，实际候选四项启动谓词复核通过；真实实机禁用原因仍未知。首次超时和权限规则冲突均留证并纠正，未改插件实现或日常环境。采用活动轮次等待回收，不恢复定时或声明闲置唤醒。

最近一次日常升级验收（10月17日）：[DSH rc.2升级记录](DSH_021_RC2_UPGRADE_TRIAL_20261017.md)。已备份并安装DSH0.2.1-rc.2、外观rc.35和Git Bash0.1.1，用户确认重开、原外观布局及Lucy短验正常；当轮停止清理及原WE保持核对通过。其后用户报告日常滚动异常和壁纸清理锁，见专项记录，不能把短验扩称长期稳定。当前P1A源码已离线复审通过，真实系统窗口/候选另排；本轮未刷新实时现场，不热改日常。

最新[九审补修](DETACHABLE_APPEARANCE_P1A_NINTH_REPAIR_DELIVERY_20261018.md)经[十审源码离线通过](DETACHABLE_APPEARANCE_P1A_TENTH_REVIEW_20261018.md)：严格创建身份等值恢复，5项变化负例拒绝且保留，合法一致正例正常；原4/3/8门禁、P0/P1A/历史专项/双Tab及实际SDK全部通过。161项输入/59资产归档不变，无真实系统命令或日常操作。P1A离线收尾，真实窗口/吸附及候选仍未验收；此前先B再A的顺序已被用户10月18日新排期替代：A低优先级，按下文当前入口推进P1B-1，仍不安装。

当前接续：[rc.38日常试用交接完成](RC38_DAILY_TRIAL_20261020.md)：用户确认“重开正常，外观布局正常，播放停止”，本轮新备份、35安装文件核验及原外观/布局保持已闭合。当前日常DSH0.2.1-rc.2/外观rc.38/Git Bash0.1.1，保留rc.38，不自动恢复rc.35；本轮5个Profile/9项关闭存储备份及rc.35回退包保留，日后回退先保护届时新增数据。前轮独立窗/吸附及Lucy短验通过，长期表现由日常积累，不重复采样。用户已将壁纸类型扩展排在作者参数前；[本地MP4源码离线接入完成](WALLPAPER_VIDEO_MP4_OFFLINE_DELIVERY_20261020.md)，真实播放尚未验收。[rc.39视频候选已独立构建并核包通过](RC39_VIDEO_MP4_CANDIDATE_REVIEW_20261020.md)，[本轮临时短验已授权并完成新备份、安装rc.39与35项核验](RC39_VIDEO_MP4_SHORT_TEST_20261020.md)，[本轮视频失败并已恢复rc.38，用户确认正常重开/原外观布局/播放停止](RC39_VIDEO_LIVE_FINDINGS_REPAIR_TASK_20261020.md)。[Grok补修经独立复审，null身份与新面板模式/自动播放控件R1/R2源码离线通过](RC39_PLAYBACK_UI_GROK_REPAIR_REVIEW_20261020.md)：209项相关测试及语法/CSS检查通过，设置回退反例已补；未打包或实机验证。[R3路径/容器/准确候选启动链与保留日志离线核验完成](RC39_VIDEO_R3_OFFLINE_INVESTIGATION_20261020.md)：批准MP4为4K/30fps/约12秒，未见明确路径错配；1200条保留记录时间戳递增而hash相同，前台/非前台均出现，根因未定。[有界source-only运行器准备完成](RC39_VIDEO_R3_SOURCE_ONLY_PREPARATION_20261020.md)，33项离线检查通过，含真实Python挂起/异常/缺报告的父监督收束，窗口IO均替身；未实机。[原中文路径MP4可见无采集源观察完成](RC39_VIDEO_R3_SOURCE_ONLY_RESULT_20261020.md)：用户确认黑屏，20.004秒正常关闭、原WE/设置保持并已正常重开DSH。WE日志两轮打开失败80070002且文件名恰好呈GBK误解为UTF-8的损坏，路径编码为强线索未定案。[ASCII相同字节副本无采集源观察完成](RC39_VIDEO_R3_ASCII_SOURCE_RESULT_20261020.md)：用户确认正常播放，13.019秒因用户窗口操作触发可见性门禁提前正常收尾，并已正常重开DSH。中文原路径黑屏/日志损坏与ASCII成功支持路径兼容问题，具体转码边界未定，DSH/WGC视频仍未验收；[受控ASCII桥接实现与离线复核完成](RC39_VIDEO_ASCII_BRIDGE_OFFLINE_REVIEW_20261020.md)：38项桥接、相关Host/UI/独立窗分组回归及1项真实只读Windows ACL/重解析IO通过，6项源码/QA经214项输入保护核对后提升。副本排他发布、两倍配额预留、停止代次及同轮退出证明已接实际链；损坏/迟到/未知关闭保留。合并回归的两项bad port失败及Grok失败尝试均保留，单项有界复核通过，不扩称一次全绿或实机播放通过。[rc.40路径兼容候选已最小整合并核包](RC40_VIDEO_ASCII_BRIDGE_CANDIDATE_REVIEW_20261020.md)：37文件，8项既有文件变化/2新增，原生12文件等同固定rc.39且无Trace；实际tgz解包225项主检查及24项销毁检查、17个JS/CSS/18导入闭包通过。补上重复create不能覆盖活动lease及异步副本释放期间不能提前解锁两项，开发共享QA现40项。新包已单独归档，旧包不变；未安装或操作日常DSH/WE。下一步取得当时方便/正常退出确认，再新备份临时短验，默认恢复rc.38与本轮设置。日常rc.38保持，不改codec/GPU/系统代码页。web、应用类可行性及作者参数后排。源码manifest/assets仍rc.30，定时PAUSED，A/三体/GPU暂缓。

以下为升级前版本表、功能收尾和审查快照；其中rc.34/旧宿主/“未安装”的当前时态已被上述现场替代，历史“下一步”不再执行。新旧安装器、原包与本轮完整备份保持。

| 项目 | 当前结论 |
| --- | --- |
| 日常安装 | rc.34试用，用户明确选择；新备份5Profile/11关闭外观存储及rc.31原包，28安装文件一致，重开外观布局保持、播放停止 |
| 外观功能包 | rc.34已独立审计、完成当前主题/颜色及Lucy短验，并保留日常；固定归档保持 |
| P4优化 | rc.31原归档及真实等待改善/Lucy既有证据保持，长期效果由日常积累 |
| 诊断候选 | rc.32为Motion Cadence Trace诊断包，不视作流畅度修复版；rc.34不含Trace |
| 开发工作区 | manifest/生产assets冻结rc.30，后续源码/QA单独保留，不能直接打整个工作区 |
| 三体专项 | 无本轮采集/DSH时也出现类似变速，根因未定，用户暂缓 |

最新[rc.34日常交接](RC34_DAILY_TRIAL_20261017.md)已完成新备份、固定归档安装及正常重开核对，保留rc.34。此前[临时短验与恢复](RC34_APPEARANCE_FEATURES_SHORT_TEST_20261017.md)为前一阶段记录。DSH保持打开、播放停止，原WE保持；这是本次核对状态，未来操作仍需确认当时方便，不复用旧退出或窗口身份。

## 已完成与验收范围

- 壁纸受限登记、ID解析/刷新/选择记忆及Lucy/绯雪手动切换：[rc.26记录](RC26_SELECTION_SAVE_REPAIR_20261012.md)。自动播放仅Lucy通过名单。
- C1正式任务栏worker接入及生命周期、rc.28周期查询卡顿修复：[C1最终复审](C1_HOST_INTEGRATION_FINAL_REVIEW_20261014.md)、[rc.27短验](RC27_TASKBAR_DESKTOP_ACCEPTANCE_20261014.md)、[rc.28修复](RC28_PERIODIC_STUTTER_REPAIR_20261014.md)。
- P1/P2/P3阶段观测、P4原生等待优化：[P4最终复审](NATIVE_WAIT_P4_INTEGRATION_FINAL_REVIEW_20261015.md)、[三体P4短测](COMPLEX_SCENE_P4_FOREGROUND_RESULT_20261015.md)、[Lucy常规短验](RC31_LUCY_ORDINARY_SHORT_TEST_20261016.md)。Lucy原生全生命周期18.40秒，用户流畅反馈及清理通过；前端仍77丢旧帧，不宣称零积压/全部壁纸或长期稳定。
- Motion Cadence诊断收尾：[最终复审](MOTION_CADENCE_TRACE_FINAL_REVIEW_20261016.md)、[rc.32实测](RC32_MOTION_CADENCE_SHORT_TEST_20261016.md)。存在Host写到client accept的波动线索，但未定位单一根因。
- 三体源端分离：[同源结果](MOTION_CADENCE_SAME_SOURCE_RESULT_20261016.md)、[无采集结果](MOTION_CADENCE_UNCAPTURED_SOURCE_RESULT_20261016.md)。不能据此断言算法bug或排除历史采集反馈/下游叠加。

## 当前收尾与下一步

历史源码、测试及报告曾在14e0556推送并清理可重建缓存，见[旧收尾](WORKSPACE_CLOSEOUT_20261016.md)；其后功能改动和文档当前仍在工作区，本轮未提交推送或清理。

[120%补修](APPEARANCE_BRIGHTNESS_120_REPAIR_REVIEW_20261016.md)、[四字段预设最终复审](WALLPAPER_APPEARANCE_PRESETS_P1_FINAL_REVIEW_20261017.md)、[主题可读性最终复审](THEME_READABILITY_P1_FINAL_REVIEW_20261017.md)及[独立强调色最终复审](THEME_ACCENT_P1_FINAL_REVIEW_20261017.md)均已通过，R1/R2、QA1、A1/A2闭合。[rc.34候选](RC34_APPEARANCE_FEATURES_CANDIDATE_20261017.md)以rc.31原包独立整合，仅3文件变化，12原生运行文件及Host保持，无Trace；候选570/566、场景选择、强调色41/144及预设17项补充通过。

[实机短验](RC34_APPEARANCE_FEATURES_SHORT_TEST_20261017.md)完成：用户确认重开、文字和强调色；Codex操作核对聊天底色0/50/100、预设80/40/0/70保存后改动/应用恢复，聊天底色80/增强档位不被覆盖，新建测试预设删除正常，停止清理通过。已恢复日常rc.31和本轮原设置，接续核对恢复后重开及播放停止，DSH保持打开。本次没有重开rc.34验证新字段跨进程记忆，也不扩称所有主题/颜色/动态壁纸或长期稳定。

**用户随后明确选择rc.34日常试用，现已完成交接并保留rc.34。** 见[日常记录](RC34_DAILY_TRIAL_20261017.md)。接下来以实际使用积累问题，有异常先记录证据；rc.31原包及本轮新备份保持，日后回退需先保护届时新增数据。主题字段进入预设、自动套用、作者属性、自定义底色和三体/性能/GPU专项均未新启动，无跨会话消息。

## 升级前兼容候选审查快照（升级及短验已完成）

[小G兼容候选](DSH_021_RC2_COMPAT_CANDIDATE_DELIVERY_20261017.md)经[Codex复审](DSH_021_RC2_COMPAT_CANDIDATE_REVIEW_20261017.md)通过离线范围：鲸系外观rc.35（SHA256 `20D35ED1A63E2272FF50E44A9A38891F1D973994BED446FB19D79B0A9E6FAE58`，28文件，仅README/manifest不同，无P0/Trace）及Git Bash0.1.1（SHA256 `4BDC48FCE7BC8D71FDEBF94B329913ACD6FC217618C23493EAEFA20E6100B7BB`）可进入受控升级短验准备。旧/新声明门禁8组合通过；Codex补实际新Cordis Host、ThemeRuntime6项、真实SandboxPwshExecutor继承/拒绝权限，以及29个预设条目解析与配置检查。React/整体视觉/全部工具行为仍待现场。

官方nightly本轮重读仍0.2.1-rc.2，[新旧安装器及回退来源](DSH_021_RC2_UPGRADE_PREPARATION_20261017.md)保持。下一步确认用户当时方便/无任务、停止播放并正常退出，关闭后新备份完整升级相关数据，再安装兼容候选及升级宿主，正常重开后做必要短验。当前尚未安装或获准退出/重启，宿主磁盘仍0.2.0-rc.2、日常rc.34保持。完整独立设置正式接入/P1/库详情UI继续后排。

桌宠0.3.0和推理档位0.8.0保留原包，门禁和所用槽位静态存在性已核对，真实显示/动作待新宿主检查。不得把当前未操作现场写成当前播放停止或Profile冻结。

## 当前补修：P1A九审补修交付完成（撤回CreationDate一秒容差，实施严格零容差等值判据）

[九审报告](DETACHABLE_APPEARANCE_P1A_NINTH_REVIEW_20261018.md)确认八审字段完整性与完整程序路径等项均已通过，仅撤回本轮新增的一秒创建身份容差。小 G 已提交[九审补修交付](DETACHABLE_APPEARANCE_P1A_NINTH_REPAIR_DELIVERY_20261018.md)：
- 在 `classifyProcessRecord` 中删除 `delta > 1000` 宽限判断，恢复严格 `if (currentMs !== expectedMs)` 零容差等值核验；
- 明确表示规范化（同一物理时刻的 WMI / ISO / 纯数值解析为同一 epoch 毫秒整数）与非零时间差值（+1ms / -1ms / +500ms / +1000ms / +1001ms 均判定 `foreign-recycled` 且 0 强杀、profile 保留）的本质界限；
- 同步修正 `qa/verify-eighth-review-probes.mjs` 中误接受 500ms 差值的断言，新建 `qa/verify-ninth-review-probes.mjs` 覆盖 7 项生命周期边界矩阵；
- 全量回归（check, p1a 5/5, p0 15/15, e2e 11/11, 第九/八/七/六/五/四/三审专项）全部通过。离线隔离完成，日常 DSH 0.2.1-rc.2 / 鲸系外观 rc.35 运行正常且未热改。

## 记录与目录约定

`release/`是本机包归档，`.tmp/`是本机证据与独立构建，均不随Git推送。活动rc.34、回退rc.31/历史rc.28及旧包不覆盖/不清理。`NEXT_TASK.md`是忽略的本机短接续入口；当前项目结论以本页为准。

旧状态全文保存在[项目历史快照](PROJECT_HISTORY_20261016.md)，各交付、失败报告和修订报告保留。历史PID、窗口名、旧“当前版本/下一步”和旧备份不能直接复用。
