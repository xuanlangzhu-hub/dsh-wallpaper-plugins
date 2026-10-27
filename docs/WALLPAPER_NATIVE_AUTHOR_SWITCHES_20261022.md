# 原生侧栏：Lucy布尔开关即时应用离线接入

2026-10-22，Codex。承接[播放选项](WALLPAPER_NATIVE_RIGHT_SIDEBAR_PLAYBACK_OPTIONS_20261022.md)。本轮仅开发源码与隔离验证，日常DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1保持，未安装、操作或采样日常DSH/WE。

## 本步结果

当前活动对象和所选对象均为Lucy，且目录/分级/运行代次有效时，原生侧栏当前页显示“壁纸开关”。明确点“读取开关”后读取现有声明与插件记录，只展示受支持、标签可读的布尔字段；随后勾选直接保存该次布尔修改并应用，不再手动操作保存草稿→应用按钮。

| Before | After | Why |
| --- | --- | --- |
| 修改开关后还需保存和应用 | 开关变化进入有界串行提交 | 去掉日常三按钮链 |
| 自动触发旧应用可能带上别的草稿字段 | 初读要求没有遗留待发送字段，每批只保存用户刚改的布尔差量 | 不连带发送其它修改或作者默认值 |
| 默认值容易被看作壁纸当前值 | 初始复选框为未确认混合态，说明未从壁纸读取；明确修改后显示请求值 | 不伪造当前值读回 |
| 大段成功提示占用页面 | 行内处理中/确认标记；失败才显示短错误及重新读取 | 反馈靠控件和状态表达 |

布局在播放主控下、收起的播放选项上，字体、色彩和强调色继承已有侧栏。条件参数、其它类型、无可读标签的token不搬入这一步，不增加搜索、重置区或旧草稿按钮组。仍是离线中间态，不称整体UI或所有作者参数完成。

## 提交协议与保护

1. 复用原`appearanceBridge.requestAuthor`及正式schema/draft/apply协议，不增加Host路由或放宽鉴权；前端不直接运行WE。后端仍负责owner、选择、分级、schema fingerprint、draft revision、活动代次/location及原生身份/退出检查。
2. 初读要求application可用且目标活动、schema有效、记录不stale、dirtyKeys为空。已有其它待发送字段时暂停，不能靠自动点击旧应用来夹带它们。
3. 先保存本次布尔patch，确认revision精确递增、fingerprint一致、dirtyKeys恰好等于该批字段及值，再应用该revision；不提交完整默认值。成功必须有`applySent:true`、`currentValuesKnown:false`以及清空的dirtyKeys，才显示命令确认标记。适配器刚完成时targetActive可能因释放微任务暂为false，成功回执以这些明确证明为准，不误判为目标不可用。
4. 同一root集成只有一个UI事务通道，跨provider替换保留；实际命令单执行器仍是原Host适配器。快速连改保留每个字段最新意图，上一批确认后才发下一批。每次连续操作最多4批、总12秒；读取4秒。无自动失败重试、无限发送或无期限节流。
5. 底层忽略取消时，UI期限到仍能返回未知/失败，但保留物理通道直到旧工作实际结算，不因此增发第二个操作。每个await后重新检查同轮context/epoch、可见性和取消，旧回包不能在换目标后继续应用；ABA恢复到相同context文本也不能接纳旧结果。
6. 无会话、隐藏分级、所选与活动对象不符、非Lucy、运行代次不明确、启动/停止/清理或命令结果未知时不提供该编辑区。关闭最后可见页、进入图库、provider撤回或目标变化取消本UI操作；两个可见页关闭一个不取消另一个的共享操作。
7. 明确未发送失败显示字段错误；应用阶段超时、传输丢失或`sentMayHaveOccurred`保留未知，不假装壁纸回退。控件保留用户请求值并标异常，不自动重发。✓只表示命令确认，不等于作者视觉效果验收。

初始值可能来自作者默认值，也可能来自本次连接已保存的插件记录，二者均不是WE当前值读回。原生侧栏的生命周期不代表其它旧编辑入口已经互斥；旧入口并发冲突仍由Host revision与执行器门禁拒绝。

## 尚未闭合的恢复体验

如果保存草稿已经成功、应用随后失败或结果未知，Host可能仍保留dirtyKeys。当前“重新读取”可以核对状态，但不会擅自清除、覆盖或发送这些字段，因此可能继续提示“另有待发送修改”。这是刻意保留的发送门禁，**并不是失败恢复体验已经完成**。

下一小步优先设计并实现明确的安全恢复入口：分清本UI保存但未发送、其它入口遗留、可能已发送三类，明确取消/确认范围，不能借恢复默认值把整套字段再次发给壁纸。该项闭合前不安排作者即时应用候选或实机安装；滑块、其它类型和独立窗互斥后排。

## 源码与输入保护

证据：`F:\dsh-wallpaper-plugins\.tmp\native-sidebar-author-switches-20261022-f97277af`，含`design.md`、各次执行报告、源码开工快照、指纹与检查日志。

- `src/sidebar/native-appearance-sidebar.js`：独立布尔提交协调器、原生开关区、可见性/目标生命周期接线。
- `src/client.js`：生成块更新；块外只增加一处requestAuthor闭包，复用现有bridge。去除生成块并还原该闭包后，其余字节与开工快照完全一致。
- 新增`qa/native-author-switches.test.mjs`。既有QA文件、Host/适配器/协议、原生采集、Trace、manifest/生产assets和归档均未改。

`change-audit.json`绑定240项开工输入，只有上述2项既有源码变化，其余238项保持，新QA另列指纹。21项官方SDK快照及当前app.asar一致；开发manifest/assets仍rc.30。

| 最终输入 | SHA256 |
| --- | --- |
| client.js | `DFC1A9F9750BF0A416CA3A4878951F7432F0135D09D82C4A5BD359208BAD2627` |
| native-appearance-sidebar.js | `F690C955D639B06DBEA4FDDA6DE38C7BF937498F8FD31651BFE37AACB9833A66` |
| native-author-switches.test.mjs | `5C0104E995576022A4A3D125D6DBEC31D9B44DF4373F7ACFECD41473152F3A11` |

## 验证与实际覆盖

`final-regressions-report.json`：新协调器22、播放选项17、图库23、目录21、播放25、侧栏20、相关49，共177项通过；两个生成器一致性、3项语法、CSS guard通过。新增负例包含夹带草稿、字段/类型/标签、fingerprint/revision、传输丢失、超时且忽略abort、迟到、ABA、两个可见页、4批上限和释放。

`author-complete-report.json`：42项完整Whale入口/真实SDK流程通过。在已有38项上增加4项作者路径，实际React/Cordis/ModuleLoader/槽位/layout/UiSession/rightbar/ThemeRuntime、主端bridge、鉴权HTTP Host、schema/draft/apply服务及`createAuthorApplyAdapter`均运行。

- 显式读取之前没有作者元数据请求；读取后只显示两个合成布尔字段，不显示合成slider，初始值为混合态。
- 单次取消粒子勾选，正式保存/应用链到达适配器，接收的差量仅`{particles:false}`，未夹带光照或速度。
- 属性子进程IO替身故意延迟，同时等待播放器原有500ms诊断上报发生；期间快速改回，确认上一批结束后才发送最新值。三次替身属性命令依次为false/true/false，峰值并发1、最终0，正常播放计数更新未导致作者上下文误拒绝。
- 保存时元数据故意延迟，再通过图库选择其它对象，旧操作取消，没有第四条属性命令；原开关区消失，不把参数套给另一所选项。
- UI操作未新增播放命令：整个既有流程仍只有明确操作产生的1条start、2条stop。原有目录/图库、provider/会话及清理流程继续通过。
- 底层窗口/进程身份检查与属性命令均由`runChild`替身提供合成stdout/退出证明，**真实WE命令0次**。替身的location/HWND/PID/UTC均是合成数据；不是实际原生身份、效果、性能或长期稳定验收。目录/预览、会话权限和空stream同样为隔离输入，没有真实帧。

最终settings/status/library订阅、refs、pins、远端监听、DOM、stream归零，5个Blob URL全部释放；自有浏览器退出、隔离服务器与桥接关闭确认。最终SDK约4.52秒，无超时。既有[两条桥接401](WALLPAPER_BRIDGE_BASELINE_401_FINDINGS_20261021.md)继续严格对照，`cleanLog:false`，未扩大允许错误列表或放宽认证。

## 失败尝试保留

- 首个新协调器测试把包含await的两次编辑误称为“同一tick”，实际跨微任务产生两批；改为同一tick同步事件后通过，未改发送实现迎合错误断言。
- 复制QA监督器时重复加入播放选项阶段，第二轮发生同名输出EEXIST并退出。修正为唯一阶段并增加启动前去重检查；其余失败日志保留。后续只读检查没有该QA残留Node进程，见`runner-process-check.json`，未全局结束进程。
- 首次SDK正向通过；后续更长运行暴露旧夹具没有接播放器原有metrics POST而产生500。最初补接时又错误假设body带state，实际是数值计数快照，修正为按实际received/rendered/seconds接收并保留记录。最终主动等该上报穿过延迟应用阶段，完整42项通过。两次500失败报告保留，未吞错或改生产指标链。

新QA均有阶段/总期限及外层自有进程监督，沿用回归20秒/阶段、总60秒、SDK45秒/收束51秒。未打包安装、改日常Profile/存储、提交推送清理、联系其它助手或恢复定时。后续真实候选/安装/视觉验证另按当时方便确认，日常rc.42保持。
