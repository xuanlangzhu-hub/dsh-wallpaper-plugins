# 原生作者下拉选项：选定即提交

2026-10-22，Codex。承接[颜色控件](WALLPAPER_NATIVE_AUTHOR_COLORS_20261022.md)。本轮只推进Lucy路径的combo源码和隔离验证，日常DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1保持，未安装或操作日常DSH/WE。

## 本步行为

作者参数区使用“作者标签 + 原生下拉框”，选定后直接提交，没有额外保存/应用按钮。字体、宽度和忙碌/完成反馈沿用现有侧栏。初始选项来自作者默认值或插件记录，**不是WE当前值读回**。

- 读取、聚焦、没有更改的Escape、重复选择当前项不发命令；缺少有效记录时拒绝读取，不自动选择第一项并下发默认值。
- DOM中仅使用`0`至`63`的选项编号，映射回作者提供的原始值。字符串`"false"`与布尔`false`、数字`0`与字符串`"0"`保持区别；不把DOM字符串当作真实属性值。
- 一次有效change只提交本字段。等待上一批时继续选择，只保留最新值，原单通道/最多4批/总12秒、revision和结果确认规则不变。
- 原生闭合select的方向键可能立即触发change，本步会即时应用该次变化，不承诺全部键盘导航都等待Enter；连续变化通过现有队列合并。
- 布尔/滑块/颜色、未知结果恢复、默认分级和播放策略保持；没有扩大作者支持到其它壁纸。

## 数据与回调保护

复用已有`validateAuthorValue`校验所有选项值及当前记录。原生侧栏额外检查选项数组1–64项、无重复精确值、标签非空且受限；无法解析的`ui_`标签、缺失/不安全标签会隐藏整个下拉字段，避免移除部分选项后改变编号映射。损坏、越界或无效值使读取失败。条件字段仍由原schema标为不支持。

展示描述符及选项数组/条目均冻结并复制。新增`select(key,index,expectedField,view)`入口，要求当前字段描述符与当次渲染对象一致、具体视图已注册且可见、编号为规范十进制字符串并在范围内。旧目标/代次、重读后旧描述符、伪造描述符、未注册/已隐藏视图均拒绝，不能用旧编号映射到新字段。

实际DOM的change还沿用上一轮SDK即时`focusedTarget(inputNode)`核验；收起后React可见性尚未更新时也不提交。仍可见的浮动页不受主侧栏收起影响。没有新增轮询、后台任务或执行路径。Host、鉴权、作者协议和原执行器未改，读取/清除4秒、失败不自动重试等规则保持。

## 修改与输入指纹

证据：`F:\dsh-wallpaper-plugins\.tmp\native-author-combos-20261022-01a035a0`，含设计/自审、开工副本、246项保护清单、最终输入和`change-audit.json`。

246项既有保护输入仅client与原生侧栏模块变化，其余244项保持；新增`qa/native-author-combos.test.mjs`。client除原生侧栏生成块外与开工副本完全一致，两生成器、原Host/协议/执行器/旧面板/既有QA、图库/播放、manifest和生产assets均保持。21项官方SDK快照及当前app.asar哈希一致。

| 最终输入 | SHA256 |
| --- | --- |
| client.js | `234EBA8CDAE7DE70EA3A373EE0A6D8F824A46521EDBB1E601DBE1AFBB3573A16` |
| native-appearance-sidebar.js | `BD789E0A199E80C64DE0DA8202C445D605F726808630CA1008F8E3CB79FCC66C` |
| native-author-combos.test.mjs | `C155B1E2FD3F8BB8EB82F2B01B26BC355EFAD013BDB03CD766DDB43992078B4C` |

## 验证

`accepted-regressions-report.json`：新增combo21项及此前338项，共**359项通过**；两个生成块一致性、client/模块/两个生成器语法和CSS guard通过。覆盖精确类型、无变化零提交、编号格式/范围、64项末项、冻结/复制、损坏/重复/不安全选项、未解析标签、旧描述符/代次ABA/视图失效、快速选择合并、超时/未知不重试及待发送记录阻断。

`combos-first-report.json`：完整Whale入口及真实官方SDK **82个流程通过**，新增9项下拉流程。使用真实React、模块/主题、会话/最右侧sidebar/dockkit、主端bridge、认证HTTP、作者Host及原适配器。元数据为Lucy路径下合成Style字段，另有条件combo负例，不代表本轮读取了真实Lucy工程的全部选项。

新增流程经过原生select DOM：读取/聚焦/Escape/重复项零提交、类型保持、真实闭合下拉键盘change、快速选择合并、伪造编号拒绝、隐藏视图事件拒绝、旧断开DOM不能影响新目标、360/520像素宽度，以及主侧栏收起时浮动页正常选择/两个真实occurrence同步和唯一ID。

SDK中`selectOption`覆盖实际React change及后续完整协议链，键盘流程使用真实键事件；没有验收OS原生弹出菜单视觉、全部输入方式或用户主观体验。旧描述符直接回调的阻断由协调器单项验证，SDK旧DOM流程覆盖断开节点事件，二者不混称。

最终属性IO替身35次：原布尔4、滑块10、颜色11，下拉新增10次；新增下拉值顺序如下，全部仅含`variant`字段：

```json
["false", 0, "0", 1.5, "soft", false, "false", 0, 1.5, "soft"]
```

原适配器峰值1、最终0；待上一条时选择三次只追加最新值。读取/重复/隐藏/旧DOM/恢复清除新增属性命令0。**真实WE命令0次**，窗口/进程查询、执行和源/目录/预览/空stream仍为隔离输入或底层IO替身。不能据此认定Lucy实际选项效果或全部作者设置实机通过。

最终订阅、refs、pins、远端监听、DOM、stream、预览IO归零，5个Blob URL全部释放；自有headless Edge退出、测试服务与桥接关闭确认，SDK约8.43秒，无超时。前端预览队列2、原Host全局8分别保持，本轮Host观测峰值3，不声称物理IO始终2。

旧两条401精确比对，仍`cleanLog:false`；原三条故意409（target_unverified、apply_command_failed、revision_conflict）仍精确比对path/POST/generation/error，没有新增或放宽错误例外。

## 首轮回归失败与复核

首轮新增20项及颜色/滑块/恢复检查通过，旧作者栈89项中1项实际loopback HTTP测试出现`fetch failed`，cause为`Error: bad port`。该旧QA通过`listen(0)`随机取端口，本轮是fetch拒绝端口的失败；未改该测试或产品网络行为，也未把失败写成通过。失败报告及stdout保留在`final-regressions-report.json`、`final-author-stack.stdout.log`，子进程正常退出。

补64项边界正例后，仅另做一次独立命名的完整回归，359项通过。SDK首轮82流程通过。没有无限重跑、降低门禁或自动重试产品命令；不称本轮所有检查一次全绿。两次回归的阶段及SDK子进程均有退出确认，无日常进程操作。

QA仍有阶段20秒/总60秒及SDK45秒/收束51秒父监督，只收束本轮自有进程。未打包安装、修改版本/生产assets/Profile、提交推送清理、联系其它助手或恢复定时。

## 下一小步

接文本输入的有效完成提交与取消，注意输入法组合期间不提交；数值直接输入、schema变化策略、独立窗互斥另拆。候选整合和真实壁纸效果/整体视觉另安排；未来实机仍需重新确认当时方便并新备份，日常rc.42保持。
