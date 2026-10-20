> 2026-10-20 当前接续：[rc.40日常试用交接完成](docs/RC40_DAILY_TRIAL_20261020.md)：用户授权保留rc.40，本轮新备份5个Profile/9项关闭存储、37安装文件核验通过；正常重开后原外观布局正常、播放停止、采集0、原WE保持。当前日常DSH0.2.1-rc.2/外观rc.40/Git Bash0.1.1，不自动恢复rc.38；rc.38回退包与本轮备份保留，日后回退先保护届时新增数据。MP4/Lucy前轮短验通过，本轮未重复试播。下文rc.38日常/待候选与短验为阶段历史。

# DSH Wallpaper Plugins

当前接续：[rc.38日常试用交接完成](docs/RC38_DAILY_TRIAL_20261020.md)：用户确认“重开正常，外观布局正常，播放停止”，本轮新备份、35安装文件核验及原外观/布局保持已闭合。当前日常DSH0.2.1-rc.2/外观rc.38/Git Bash0.1.1，保留rc.38，不自动恢复rc.35；本轮5个Profile/9项关闭存储备份及rc.35回退包保留，日后回退先保护届时新增数据。前轮独立窗/吸附及Lucy短验通过，长期表现由日常积累，不重复采样。用户已将壁纸类型扩展排在作者参数前；[本地MP4源码离线接入完成](docs/WALLPAPER_VIDEO_MP4_OFFLINE_DELIVERY_20261020.md)，真实播放尚未验收。[rc.39视频候选已独立构建并核包通过](docs/RC39_VIDEO_MP4_CANDIDATE_REVIEW_20261020.md)，[本轮临时短验已授权并完成新备份、安装rc.39与35项核验](docs/RC39_VIDEO_MP4_SHORT_TEST_20261020.md)，[本轮视频失败并已恢复rc.38，用户确认正常重开/原外观布局/播放停止](docs/RC39_VIDEO_LIVE_FINDINGS_REPAIR_TASK_20261020.md)。[Grok补修经独立复审，null身份与新面板模式/自动播放控件R1/R2源码离线通过](docs/RC39_PLAYBACK_UI_GROK_REPAIR_REVIEW_20261020.md)：209项相关测试及语法/CSS检查通过，设置回退反例已补；未打包或实机验证。[R3路径/容器/准确候选启动链与保留日志离线核验完成](docs/RC39_VIDEO_R3_OFFLINE_INVESTIGATION_20261020.md)：批准MP4为4K/30fps/约12秒，未见明确路径错配；1200条保留记录时间戳递增而hash相同，前台/非前台均出现，根因未定。[有界source-only运行器准备完成](docs/RC39_VIDEO_R3_SOURCE_ONLY_PREPARATION_20261020.md)，33项离线检查通过，含真实Python挂起/异常/缺报告的父监督收束，窗口IO均替身；未实机。[原中文路径MP4可见无采集源观察完成](docs/RC39_VIDEO_R3_SOURCE_ONLY_RESULT_20261020.md)：用户确认黑屏，20.004秒正常关闭、原WE/设置保持并已正常重开DSH。WE日志两轮打开失败80070002且文件名恰好呈GBK误解为UTF-8的损坏，路径编码为强线索未定案。[ASCII相同字节副本无采集源观察完成](docs/RC39_VIDEO_R3_ASCII_SOURCE_RESULT_20261020.md)：用户确认正常播放，13.019秒因用户窗口操作触发可见性门禁提前正常收尾，并已正常重开DSH。中文原路径黑屏/日志损坏与ASCII成功支持路径兼容问题，具体转码边界未定，DSH/WGC视频仍未验收；[受控ASCII桥接实现与离线复核完成](docs/RC39_VIDEO_ASCII_BRIDGE_OFFLINE_REVIEW_20261020.md)：38项桥接、相关Host/UI/独立窗分组回归及1项真实只读Windows ACL/重解析IO通过，6项源码/QA经214项输入保护核对后提升。副本排他发布、两倍配额预留、停止代次及同轮退出证明已接实际链；损坏/迟到/未知关闭保留。合并回归的两项bad port失败及Grok失败尝试均保留，单项有界复核通过，不扩称一次全绿或实机播放通过。[rc.40路径兼容候选已最小整合并核包](docs/RC40_VIDEO_ASCII_BRIDGE_CANDIDATE_REVIEW_20261020.md)：37文件，8项既有文件变化/2新增，原生12文件等同固定rc.39且无Trace；实际tgz解包225项主检查及24项销毁检查、17个JS/CSS/18导入闭包通过。补上重复create不能覆盖活动lease及异步副本释放期间不能提前解锁两项，开发共享QA现40项。新包已单独归档，旧包不变；未安装或操作日常DSH/WE。下一步取得当时方便/正常退出确认，再新备份临时短验，默认恢复rc.38与本轮设置。日常rc.38保持，不改codec/GPU/系统代码页。web、应用类可行性及作者参数后排。源码manifest/assets仍rc.30，定时PAUSED，A/三体/GPU暂缓。

为官方DeepSeek Harness提供Whale Appearance / 鲸系外观插件，支持主题、图片/视频背景和Wallpaper Engine实验预览。

## 当前状态（2026-10-17）

- 日常现为 **DSH0.2.1-rc.2、外观rc.35、Git Bash0.1.1**，已新备份并核包/签名；用户确认正常重开、原外观布局及Lucy画面/操作正常，停止清理和原WE保持核对通过。见[升级与短验记录](docs/DSH_021_RC2_UPGRADE_TRIAL_20261017.md)。旧宿主、rc.34及新备份保留；不扩称全部插件动作或长期稳定通过。
- [P0七审补修通过](docs/DETACHABLE_APPEARANCE_P0_SEVENTH_REVIEW_20261017.md)，[P1A十审源码离线通过](docs/DETACHABLE_APPEARANCE_P1A_TENTH_REVIEW_20261018.md)，创建身份余项闭合，独立负例与相关回归保持。真实独立窗/吸附交互及候选整合仍未验收；下一步先日常壁纸清理锁，再滚动问题，不自动安装或进入P1B。
- [rc.34整合候选](docs/RC34_APPEARANCE_FEATURES_CANDIDATE_20261017.md)包含亮度20–120、四字段手动壁纸预设、文字可读性/聊天底色与独立强调色。以rc.31为基底，原生运行时及Host保持，无Trace；实际候选570/566及补充检查通过。
- [实机与恢复记录](docs/RC34_APPEARANCE_FEATURES_SHORT_TEST_20261017.md)：文字/强调色用户确认，Lucy底色、预设保存/应用/删除由Codex操作核对；停止清理通过。覆盖当前主题/颜色，跨进程新字段记忆仍以隔离回归为证据，不扩称全部组合或长期稳定。
- P4等待优化已收尾；三体源端变速原因未定，专项暂缓。rc.32仅为诊断候选，前端计数不等于屏幕FPS。
- rc.35仅在rc.34基础上调整兼容元数据，无Trace/P0/P1A。工作区manifest/assets仍rc.30冻结，不直接整体打包。P1A正式Host/静态页及隔离生产页面源码链路已离线复审通过，真实系统窗口与发布另验。

[当前状态与接续](docs/PROJECT_STATUS.md) · [rc.34短验与恢复](docs/RC34_APPEARANCE_FEATURES_SHORT_TEST_20261017.md) · [rc.31日常交接](docs/RC31_DAILY_TRIAL_20261016.md) · [产品路线](docs/PRODUCT_ROADMAP_20261011.md) · [历史记录](docs/PROJECT_HISTORY_20261016.md)

## 功能与当前边界

- 鲸渊 / Whale Abyss 深色主题与鲸雾 / Whale Mist 浅色主题，深海、石墨、暗紫和墨绿配色。
- 自选图片和本地视频背景，亮度、遮罩、模糊和界面不透明度设置。
- 官方 Windows Desktop 的透明白鲸运行时窗口图标。
- Wallpaper Engine 原始渲染 → Windows Graphics Capture → 内存画面流 → DSH 背景层。

rc.28 由Host显式配置库根、按ID重新核验scene；自动播放已验证名单仍只有 **Lucy**，其它scene只允许手动实验。默认限时预览180秒、最多300秒；日常模式与默认关闭的下次启动自动播放保留，本轮未调整用户原自动播放设置。需要已安装的 Wallpaper Engine、对应场景与 .NET 10 运行时。Lucy/绯雪双向手动切换是rc.26历史，rc.28 只对本轮当前 scene 作平滑度短验。仓库不包含壁纸本体。

源窗口收在屏幕外，初始阶段任务栏仍可能显示入口，随后只尝试移除一次；不承诺跨机器 Alt-Tab 排除或 Explorer 重启后持续隐藏。部分场景的原生鼠标跟随本机已观察到，DSH 专用坐标/点击转发尚未接入；音频、通用交互、其它壁纸兼容性、数小时/数天运行尚未验收，.NET 10 依赖保留。

## 目录

| 路径 | 用途 |
| --- | --- |
| `dsh-whale-mist/src` | 主题、设置入口、Host 和画面流 |
| `dsh-whale-mist/assets/wallpaper` | 随插件打包的原生采集程序与依赖 |
| `dsh-whale-mist/qa/wallpaper-probe` | 原生采集程序源码 |
| `dsh-whale-mist/qa/wallpaper` | Host 单元测试与 SDK 契约检查 |
| `dsh-whale-mist/qa/wallpaper-preview` | 前期独立实验及历史回归 |
| `dsh-whale-mist/docs` | 实施、返工、复审和实机验收记录 |
| `official-desktop/README.md` | 原工作区的迁移与兼容记录 |
| `DeepSeek-Harness.ico` | 图标构建脚本所需的源资产 |

## 检查与打包

在 `dsh-whale-mist` 中运行：

```powershell
npm run check
npm run test:wallpaper-host
node qa/perf/check-frontend-stages.mjs
node qa/perf/check-native-pacing.mjs
node qa/perf/check-motion-cadence.mjs
```

需要Node.js/npm，原生隔离自测还需要.NET 10 SDK。检查不创建真实WE源窗口；代码/离线检查与用户桌面验收分别记录。

工作区manifest与打包资产保留rc.30基线，源码同时保留后续已复审P4/诊断实现；**不要直接把工作区打包当作日常rc.31/rc.32**。已有候选由隔离暂存目录构建和逐文件审计，见[rc.31候选](docs/RC31_NATIVE_WAIT_P4_CANDIDATE_20261015.md)及[rc.32诊断候选](docs/RC32_MOTION_CADENCE_CANDIDATE_20261016.md)。新发布应独立构建、记录新版本/包指纹，不覆盖同版本归档。`release/`和本机证据不随Git推送。

历史QA可能带本机路径，运行前检查输入和独立输出目录。构建缓存可以清理，原始实测/复审证据、源资产、运行环境和正在引用的包须保留。

## 安装和实机验收

在官方 Windows Desktop 的插件页添加新生成的 tgz，重开后从「设置 → 通用 → 鲸系外观」选择主题和背景。Wallpaper Engine 需要选择来源后手动点击「开始预览」。

安装、切换日常版本或恢复 Profile 前先备份。需要退出、重开或点击应用时，由用户操作界面，外部助手核验；代码和无窗口检查通过后再安排实机验收。

## 来源

源码从原 [dsh-desktop](https://github.com/xuanlangzhu-hub/dsh-desktop) 工作区拆出，起点本地提交为 `ff19f3bf42be2de2fb5715a120d77b8d5a5b2d9d`。本仓库保留插件目录结构、原生源资产和验收记录，后续插件开发在本仓库继续。
