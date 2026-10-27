# 原生右侧栏：播放主控与故障状态离线接入

2026-10-22，Codex。承接[亮度/遮罩接入](WALLPAPER_NATIVE_RIGHT_SIDEBAR_APPEARANCE_CONTROLS_20261021.md)和[侧栏层级规划](WALLPAPER_NATIVE_RIGHT_SIDEBAR_PLAN_20261021.md)。本轮只改开发源码并运行隔离QA，没有打包、安装或操作日常DSH/WE。

## 本轮结果

原生侧栏增加一个播放主控，按真实状态切换开始播放、停止播放、重试清理。调用原controller的`wallpaper.start/stop`，没有创建第二份播放器或新增重新开始按钮。播放专项25项、既有侧栏20项、相关回归49项及真实SDK完整入口21项检查通过；语法、生成一致性和CSS guard通过。桥接既有401仍留档，`cleanLog:false`，不称日志全绿。

| Before | After | Why |
| --- | --- | --- |
| 侧栏只能读播放状态 | 一个主控随状态切换开始、停止或重试清理 | 常用操作在同一位置，减少重复按钮 |
| 当前与所选对象容易混淆 | 活动壁纸作为主标题；所选不同则另列简短名称 | 不暗中切换或覆盖正在播放对象 |
| 无操作中反馈 | 点击后立即占锁，按钮显示正在启动/停止/清理并禁用 | 防止同一时刻重复提交 |
| 异步失败可能堆原始文字 | 短错误/未确认提示就近出现；正常状态没有成功通知 | 不暴露原始命令、不假称已经成功 |
| 视图重载可能遗失操作状态 | 控制器接线持有共享操作门禁，provider子模块只订阅 | 重载不重新发命令，多个页共享同一锁 |

亮度/遮罩仍可独立调整，不触发播放或作者参数。打开、关闭、折叠、切会话、provider恢复和渲染均不自动发播放命令。

## 状态与身份门禁

- 开始只允许现有壁纸背景、有效ID及`daily/preview`模式、已确认且非加载中的目录、类型/可用性/分级符合条件，并且当前没有活动源或未完成清理。默认Everyone、Lucy自动播放资格均不扩大。
- scene/video/web沿用现有支持边界；application、不允许的分级、不可用或未确认项目不能启动。缓存更新通过新增的一条library订阅通知，不从render扫描目录。
- 空选择不回退成Lucy；`"null"`等活动身份异常和“已停止但仍有活动ID”的冲突状态显示未知，不能作为空闲绕过开始门禁。
- 停止针对活动轮次，不依赖当前所选项目或目录是否可用。补查确认：目录getter抛错不会卡住停止；内部pending-cleanup门禁仍参与判断。
- 点击携带渲染时的动作、选中ID/模式或活动ID/generation。旧Start不会被解释成Stop，旧目标/旧轮次Stop也不会操作替代轮次。
- 清理失败仅允许明确重试清理；进行中的停止或清理不重复提交。其它入口启动且尚未返回时，本侧栏只显示繁忙，不插入新的命令。

## 异步生命周期与限制

原生侧栏自己的命令门禁有12秒反馈期限。期限到返回“操作结果未确认”，不是成功，也不自动重发。超时启动允许用户明确停止并确认；若旧启动还未结束，即使停止返回，也继续禁止重播，直到旧任务真正落定。迟到旧结果不会覆盖较新的停止结果或当前controller状态。

超时停止仍在进行时，不能再叠加停止或开始；底层挂起不被假装清理完成。root卸载清除自有期限并结束等待，provider撤回只释放视图订阅，恢复后仍持有原锁；侧栏关闭不顺带停止壁纸。

**期限仅约束本侧栏等待和反馈，不取消现有engine的底层HTTP命令，也不证明源/worker退出。** 现有命令fetch没有在本轮重写，最终清理事实仍来自原controller/Host协议。共享门禁覆盖本侧栏发出的命令，不声称给其它历史入口的全部并发请求补了统一锁。Windows源身份/原生退出和真实画面仍需后续候选实测，不能由这些测试替代。

## 实现与保护

证据：`F:\dsh-wallpaper-plugins\.tmp\native-sidebar-playback-20261022-3b1d2c5b`。

本轮改`src/sidebar/native-appearance-sidebar.js`、生成的`src/client.js`原生侧栏块，以及既有`qa/native-sidebar.test.mjs`的一项按钮数量断言；新增`qa/native-sidebar-playback.test.mjs`。生成器未改；精确移除生成块后，client其余字节与开工快照一致，Trace与历史脏改动保持。

`accepted-change-audit.json`绑定236项开工输入：仅上述3项既有输入改变，其余233项保持，新增播放QA单独列出。manifest/生产assets/归档/Host/原生采集/作者参数实现均未改。21项官方SDK提取件及当前官方app.asar指纹核验一致。

| 最终输入 | SHA256 |
| --- | --- |
| client.js | `B812FE472DB3DCA40C345C2691FDD8AC6EC24EEFDFBA80A44333CA0BEA172D0C` |
| native-appearance-sidebar.js | `738C531CB869AB6AAAD66FFDFB46AAD01016662C7BD3E6039AE21F08C2F8058F` |
| native-sidebar.test.mjs | `DB04503945A5F0FC1D0791E2DA3AFC95326EE4783980A13BF46AA2E0BA73F951` |
| native-sidebar-playback.test.mjs | `5B76EAE335E1EAFE1B5493355711F2DB04716E0F48A43D6B3121380F1E678565` |

## 检查证据分层

`accepted-regressions-report.json`：25项播放专项、20项既有侧栏、49项目录/旧UI/作者上下文相关回归通过；两个生成器一致性、3项语法及CSS guard通过。播放专项使用替身controller和虚拟时钟，覆盖越权动作/无目标/类型/分级/目录损坏/迟到结果/旧目标与旧代次、超时未知、防重入、provider恢复及root卸载期限归零；不是实际12秒等待或真实进程验收。

`playback-accepted-report.json`：完整Whale `apply`、实际ModuleLoader/React/Cordis/槽位/layout/UiSession/rightbar/ThemeRuntime及正式HTTP桥接运行，21项流程通过。壁纸侧使用真实客户端engine和自己的HTTP后端夹具；未把start/stop替换成计数函数。底层会话/权限/资源等仍为既有夹具。

- 通过真实DOM点击，一次开始提交`{scene:'lucy',mode:'daily'}`；同一事件周期双击只产生一条start请求。
- 保留启动响应时撤回/恢复真实rightbar provider，按钮仍忙碌且没有第二条start。释放响应后进入真实engine的connecting阶段。
- 假后端提供空流，未编码或显示任何壁纸帧；这只验证连接/状态/交互，不能称Lucy画面通过。
- 折叠页不产生stop。第一次stop返回`cleanup.closed:false`，原engine进入cleanup-failed；界面保持恢复操作。明确点击后第二次stop返回`closed:true`，再显示可开始。
- HTTP夹具记录恰好1条start、2条stop（每次stop请求体为原engine协议的空对象）；没有restart、属性、扫描或真实窗口命令。页面`trace.commands:0`仅指其它被禁止的夹具服务调用，不代表没有上述3条测试HTTP命令。
- 亮度/遮罩原有键盘、鼠标、CSS与隔离存储、双视图、窄宽度逻辑检查和侧栏完整生命周期继续通过。
- 清理后settings/status/library新增订阅、refs、pins、远端监听、DOM子节点及测试stream均归零；自有浏览器退出、服务器关闭和桥接断开/关闭确认。

最终SDK运行约3.31秒。父监督45秒/收束51秒，回归逐阶段20秒/总期限60秒；未触发超时。全部输出独立保存，本轮没有挂起任务或依赖用户结束脚本。

保留前两次已通过的`playback-first/final`与回归，补齐目录异常、返回状态损坏、旧Stop代次及冲突身份负例后才形成上述accepted输入。桥接仍只出现[既有两条unauthorized-main-token 401](WALLPAPER_BRIDGE_BASELINE_401_FINDINGS_20261021.md)，响应字段与上轮冻结基线一致；Playwright事件时序观察保留但不当作服务端鉴权状态。未放宽鉴权、隐藏新错误或修复该既有问题。

## 接续

**下一小步先接原生侧栏的目录确认路径。** 当前只有缓存订阅，尚未迁入目录加载入口；首次缓存未准备时开始保持禁用，本轮SDK明确通过夹具预置目录验证后续路径，不能说“新开侧栏已能自行加载并立即播放”。下一步在明确打开入口时复用现有有界ensure读取、取消与单次在途规则，然后迁入更换壁纸入口/图库；不让render、状态轮询或折叠自动扫描。

作者即时下发、更多外观项、独立窗互斥与整体UI视觉仍分别推进。侧栏继续是开发中间态，不作为完整候选发布。日常DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1保持，工作区manifest/生产assets仍rc.30。本轮不安装、不重开、不采样日常现场，不提交推送清理、不联系其它助手；Opus不重试、定时不恢复。
