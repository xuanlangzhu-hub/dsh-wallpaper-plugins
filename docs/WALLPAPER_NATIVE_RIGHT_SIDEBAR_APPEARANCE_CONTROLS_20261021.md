# 原生右侧栏：亮度与遮罩两个控件离线接入

2026-10-21，Codex。承接[只读侧栏源码整合](WALLPAPER_NATIVE_RIGHT_SIDEBAR_INTEGRATION_20261021.md)与[侧栏交互要求](WALLPAPER_SETTINGS_SIDEBAR_REQUIREMENTS_20261021.md)。本轮仅推进开发源码及有界隔离检查，没有打包、安装或操作日常DSH/WE。

## 已实现

原生右侧栏的“壁纸画面”分组新增亮度和遮罩两个滑块，调用同一既有controller的同步`set()`；保留原控制器的CSS投影、本地存储与订阅通知，没有第二套设置状态或播放器。

| Before | After | Why |
| --- | --- | --- |
| 侧栏只显示亮度数值 | 亮度20–120%、遮罩0–90%两个滑块，旁边显示百分比 | 与原设置范围一致，直接调整画面 |
| 无可编辑操作 | 原生滑块支持鼠标、键盘Home/End与方向键，改动立即走原控制器 | 无额外保存/应用步骤，不给高频操作增加动画或延迟 |
| 同一页不能调整参数 | 多个原生页共享数值、每个控件有独立label/id | 不重复创建订阅、播放器或相互串联标签 |
| 无写入失败反馈 | 失败仅在对应字段显示短提示，读取实际值；用户再次调整时重试 | 不输出原始命令、不自动重试、不虚构回滚或保存成功 |

这两个值是Whale画面设置，不是作者公开参数。未播放时仍可调整本地值，不会开始播放；更改不会选择壁纸、扫描图库、请求预览或下发作者命令。未挂载会话、没有setter或对应值损坏时禁用；卸载后的旧事件处理器不能继续写入。重复相同值跳过controller写入，无新增定时器或子进程。

控件使用宿主文字/强调色变量、容器保持透明，不覆盖其他页样式；字段名在上、百分比靠右、滑块占满可用宽度。常驻成功段落与保存/应用按钮均未增加。实际主题透明度、壁纸画面效果和整体观感尚未验收，不以CSS变量或headless布局检查替代。

## 修改与保护

本轮证据：`F:\dsh-wallpaper-plugins\.tmp\native-sidebar-controls-20261021-6c401240`。

仅改既有三个源码/QA输入：

- `dsh-whale-mist/src/sidebar/native-appearance-sidebar.js`：字段范围、局部写入与失败状态、两个可访问滑块。
- `dsh-whale-mist/src/client.js`：由既有生成器更新的`WM_NATIVE_SIDEBAR`块；块外字节与本轮开工快照完全一致。
- `dsh-whale-mist/qa/native-sidebar.test.mjs`：新增10项写入/错误/范围/迟到事件检查，另增强范围契约对照。

`change-audit.json`核对236项开工输入：上述3项变化，其他233项保持，包含manifest、生产assets、归档、Host/采集/作者参数与Trace相关源码。生成器本身未改，没有整份替换client、版本号提升或包发布。

| 最终输入 | SHA256 |
| --- | --- |
| client.js | `7A4AA8F1DBFA42B1676D106A3B566CFC451ABD156803346EE9F153664D030D3F` |
| native-appearance-sidebar.js | `1ED7EBA9C1340EB80738B840A25BC81E33EB0735CB8F16B5715A657CBA98C89A` |
| native-sidebar.test.mjs | `B68937C4DA613BD8522AF01E8FA9794E7E71223069F6D7A0BFEDE1C1B6B05731` |

## 检查结果与实际边界

`final-regressions-report.json`：侧栏20项、目录/旧UI/作者上下文相关49项通过；两个生成器一致性、3项语法及CSS guard通过。纯替身检查包含端点/越界/小数/NaN、重复相同值、快速交替、外部设置变化、setter拒绝/抛错、抛错前后真实值、损坏字段、无会话和provider释放后的旧事件。

`controls-final-report.json`：**完整Whale入口在真实SDK隔离环境中的17项主流程通过**。沿用上一轮真实ModuleLoader、React/ReactDOM/Cordis、槽位、layout、UiSession、rightbar、ThemeRuntime及正式HTTP桥接，底层会话/权限/壁纸输入仍为夹具。

- 真实DOM键盘及鼠标拖动经过新控件，验证controller值、CSS `--wm-bg-brightness/--wm-bg-mask`投影和本轮隔离localStorage；不只是直接调用setter。
- 两个真实宿主页同时存在的检查使用宿主内部float与dock页，确认四个input id唯一、任一页改动后两个页同步；这是宿主内浮动面板，**不是Windows独立设置窗口**，产品入口没有新增float操作。
- 折叠/重开、切会话返回、无会话、provider撤回恢复、关闭页与插件卸载仍通过。侧栏新增设置/状态订阅始终各一套，provider恢复仍是原控制器。
- 360/520px正文宽度逻辑检查无内部横向溢出，label与input绑定正确；未截图、未进行整体UI视觉验收。
- 壁纸请求仅`/whale-wallpaper/status`，播放/停止/属性/扫描等命令为0；没有真实采集、WE窗口或模型请求。
- 订阅、refs、pins、远端监听与DOM节点最终归零，自有浏览器退出、服务器关闭、桥接断开与关闭均确认。最终运行约2.21秒，父监督45秒、收束51秒；回归每阶段20秒、总期限60秒，未触发超时。

## 失败记录与修正

不称首轮全绿。全部失败的报告、日志和清理结果保留：

1. `controls-first`发现我最初误将遮罩接为0–100%，真实控制器实际钳制到90%。已改回0–90%，同步补上从原`RANGE_SETTINGS`读取范围的契约断言，既有控制器不改。
2. `controls-second`因临时QA脚本经过PowerShell管道写入的中文期望值损坏而失败，页面实际短错误文字正确；临时脚本改Unicode转义，不修改产品文案。
3. `controls-third`错误假设保留会话必定保留所有Body DOM，实际仅保留页面状态。改为使用宿主正式float/dock操作构造两个同时挂载的真实页，验证多视图同步，未绕过组件或改产品注册。
4. `controls-fourth`的17项主流程已过，但严格沿用旧报告的`mainRegisteredAtDispatch:false`失败：Playwright request事件时读到true。该观察发生在Node事件回调，不能替代服务端鉴权时状态。追加响应正文，并用**本轮开工前只读client**重放相同设置写入序列，`baseline-controls`与最终轮均返回相同两个`unauthorized-main-token`401。

最后一项沿用[既有桥接问题](WALLPAPER_BRIDGE_BASELINE_401_FINDINGS_20261021.md)，未修复。最终严格比较响应路径/状态/方法/generation/鉴权错误及控制台错误与本轮旧源码基线；request事件中的状态观察原样保留，不再把它当服务端鉴权状态。未隐藏其他错误、放宽Host鉴权或改日常运行环境。最终`cleanLog:false`，仅本次控件接入范围`passed:true`。

## 下一步

继续按小步迁移：接入当前壁纸的播放/停止主控及繁忙、停止清理失败等状态，保持选中对象与正在播放对象分开，调用原单控制器；先离线覆盖防重入、无目标、清理未确认和迟到结果。图库布局、更多画面/界面项、作者即时下发和独立窗互斥仍分别推进，不将旧长表单搬入此页。

开发侧栏仍是中间态，不能作为完整设置功能候选发布。日常DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1、冻结manifest/生产assets rc.30保持，未重新采样现场。未来候选需从固定归档独立整合并补实际加载依赖，真实安装/短验另取当时方便确认。本轮没有提交、推送、清理、联系其他助手或恢复定时。
