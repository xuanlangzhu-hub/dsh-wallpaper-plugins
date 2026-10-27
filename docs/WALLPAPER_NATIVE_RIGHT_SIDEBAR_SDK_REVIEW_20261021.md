# 原生右侧栏P0：完整SDK隔离装载验证

2026-10-21，Codex。承接[只读隔离原型](WALLPAPER_NATIVE_RIGHT_SIDEBAR_P0_PROTOTYPE_20261021.md)。本轮补上前轮缺少的实际模块加载、服务注入、槽位继承和React挂载；没有增加可操作控件。

## 结论

**只读适配器通过完整实际SDK的隔离渲染链路，最终12项检查通过。** 实际官方模块加载器、Cordis、SlotCore、槽位渲染器、布局、UiSession、右侧栏及Dockkit参与运行，真实DOM中的Whale页取得宿主注入的`useTabInfo`，不是前轮组件树/放置替身。

这一步可以结束“只有接口片段、正文能否被宿主正确挂载仍未知”的状态，进入下一小步最小源码整合。**还没有执行整个Whale `apply`，也没有安装到真实DSH或完成用户视觉验收。** 真实会话数据、远端、资源保留、快捷键、主题/语言偏好和壁纸controller输入仍是明确隔离夹具；不能扩大为所有插件共存、全部会话/布局、透明度或完整产品通过。

日常继续DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1。本轮没有操作、关闭、启动或采样DSH/WE；没有壁纸控制/属性命令、DSH模型请求、候选打包安装、提交推送或清理。Opus评审不重试，定时不恢复。

## 官方来源与隔离方法

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-sidebar-sdk-20261021-8691a478`。

1. 直接只读解析当前官方`app.asar`，SHA256仍为`47874618BF5B3011FCAAC10CD4C85F69DA333E70D4F99B921207C78D0999512A`。从归档提取21项manifest、client脚本、Web壳和样式，路径/字节数/指纹见`official-inputs.json`，原件副本在`official/`；本轮结束再次逐项核对。
2. 原先不能作为独立包找到的`dsh-client-store`、`ui-slots`、`ui-primitives`、`ui-dockkit`等，实际由官方Web前端壳的`SZ()`平台种子表提供。**没有从网上另装相似版本、拼接自写替身，或因为缺少包而假称无法验证。** React/ReactDOM、Cordis、Zod与这些内核库直接来自当前官方壳及vendor。
3. 为阻止生产启动，只在本轮独立副本中把壳文件末尾的自动boot段替换为导出`SZ()`种子表；此前所有实现字节保持。没有修改官方文件。仪器化壳SHA256为`815C7B8C62C0168FDD7D9C16593D67D394A09B854CE8D9CFCEDD562FDC740625`。
4. 用官方`createClientModuleSystem`消费隔离注册队列，再`import`实际`ui-renderer`、`ui-layout`、`ui-session`、`ui-sidebar-right`完整模块，由真实Cordis `ctx.plugin()`加载并等待fiber，使用真实`ctx.uiRenderer.mount`。注册队列和空boot图是隔离启动夹具；没有连接生产boot/账号/Profile或真实后端。
5. 本机回环HTTP只服务冻结输入；全新无头Edge上下文，页面不访问外部站点或日常浏览器配置。没有截图或主观视觉判断。每轮实际请求均限本轮origin，最终无被阻拦的外部请求、页面异常、console error或slot error。

实际适配器仍是前轮`native-sidebar.mjs`，SHA256 `512AF1C4E1806B2B1EAD81795E8418ADEE62D183749CFF612DD40074341EF033`，本轮没有改它。前轮隔离client、元数据、验证器和SDK注册器片段等5项指纹保持，未机械重跑原19项检查。

## 真实与替身的分层

| 层次 | 本轮实际覆盖 |
| --- | --- |
| 模块解析 | 实际官方Web平台种子表、vendor和ClientModuleSystem；注册队列/空图来自夹具，不启动完整生产应用 |
| 生命周期与服务 | 实际Cordis Context、fiber inject/effect/dispose；真实服务消失后依赖插件卸载，恢复后重新装载 |
| 槽位与渲染 | 实际SlotCore、SlotRegistry、React/ReactDOM、标准/上下文Hook绑定、session scope、布局与右栏Root/Seat/Dockkit |
| 会话投影 | 实际UiSession及scope adapter；底层sessions Controller、两个Synthetic会话、retainInfo/list和Reference数据是夹具 |
| 顶栏承载 | 最小conversation夹具按官方真实声明提供actions/list和corner/single；不执行整个conversation业务组件 |
| 资源与交互底座 | resources pin、remote事件、权限source、shortcuts catalog、locale、theme快照是无外部IO夹具，并记录其清理 |
| Whale输入 | 原只读适配器；注入一份设置/壁纸状态source及拒绝所有写入的controller夹具；整个Whale apply、自动播放/桥初始化未执行 |
| 实机/视觉 | 未安装或操作真实DSH/WE；窗口并排、主题/透明度、主观观感及独立窗互斥未验收 |

## 最终12项结果

`lifecycle-visibility-report.json`及同名run记录为最终输入/结果：

1. 真实Cordis、renderer、layout、UiSession及右侧栏服务就绪，真实root挂载，无slot错误。
2. 通过实际DOM顶栏按钮打开Whale dock页，正文继承tabInfo并取得真实tab id和session id，亮度70正常显示。
3. 同一pane重复打开20次，只复用一个Whale页；该范围现在由实际Dockkit/store验证，不再只是放置替身。
4. 共享设置source更新到80，实际React正文更新；正文无input或button，不加入隐含播放/属性操作。
5. 实际收起与重新打开后，底层设置/壁纸订阅仍各一份，无壁纸命令。
6. 通过实际UiSession切换到s2，再打开该会话右栏，正文绑定s2，共享controller订阅数不增加。
7. 返回保留的s1并打开，仍复用原页，不重复注册或重建controller。
8. 无活动会话时`open()`明确返回`no-session`；没有自行创建会话或播放器；恢复s1后正常进入。
9. 撤回实际右侧栏provider，依赖适配器随Cordis注入关系卸载；自有顶栏消失，两项controller订阅归零，旧api返回`disposed`。
10. 重建实际右侧栏provider，依赖插件仅再激活一次，显示共享的80值，订阅各一份，命令0。
11. 关闭当前页移除实际tab occurrence，没有壁纸命令；不把关闭设置页等同停止播放。
12. 卸载适配器后正文/标题/顶栏注册及controller订阅释放，手动触发已保留的迟到回调也不发命令；整套fixture卸载后归零。

第3项只证明同一pane；不声称跨pane/跨会话的全局唯一编辑器已由宿主代劳。独立窗与原生页互斥、作者参数写入仍后续单独设计。

## 失败记录与修正

保留所有独立输出，不称首轮全绿：

- `first`、`debug`起初只看服务是否出现，按期限报告not ready。补充实际fiber状态与初始化异常后，`fiber-check`定位到**conversation夹具把官方corner/single错误声明成list**，导致官方右栏不带id的单项注册被拒绝。对照实际conversation源码修正夹具，而非改官方右栏。
- `slot-contract`随后捕获真实React的main slot错误：夹具调用`useBinding()`没有传selector。改为实际框架要求的`useBinding(value => value)`，`selector-contract`的8项主链路通过。
- 扩展生命周期负例后的`lifecycle`在收起可见性检查失败：夹具使用`Element.checkVisibility()`默认选项，未检查CSS visibility。改为显式检查visibility/opacity；不是删除收起断言。`lifecycle-visibility`最终12项通过。
- 上述改变均在隔离启动/观测夹具，原型适配器和官方SDK字节保持。首三轮在取得fixture清理句柄前失败，不宣称逐项域资源释放已审计；这些轮次的自有浏览器退出和HTTP关闭有记录。修正后的失败轮及最终轮均另记录页面级清理。

最终自有Node PID5504退出0、2.099秒、未超时；该PID仅是本轮历史证据。所有轮次总监督45秒、51秒兜底，页面等待/连接/关闭另有有限期限；各轮自有Node退出均已确认、没有触发外层超时。Edge进程归属及退出证明见各report中的ownedBrowserPid/cleanup，不复用这些身份操作日常进程。

最终清理：设置订阅0、壁纸订阅0、session refs0、资源pins0、remote事件监听0、root DOM子节点0、壁纸控制命令0；自有浏览器确认退出、本轮HTTP服务关闭。没有全局结束Node/Edge或触碰原WE。

## 保护与下一步

收尾核对前轮冻结的233项开发源码/QA/assets/归档输入保持，前轮原型5项指纹保持，本轮21项官方输入保持，当前官方app.asar保持。证据见`verification.json`；不将文件数当成业务测试数量。

下一小步：以已通过原型为基础，**先做共享开发源码的最小整合及整个Whale入口的隔离回归**，再考虑候选，不直接替换整份client。需要保留开发树已有Trace和其它脏改动，提取/生成适配器保持单一来源；右栏服务依赖与正式顶栏入口、停止使用旧overlay的边界要在实际Whale apply中验证。无会话/缺服务不回退浮层、不自动开播；已有通用设置、自动播放取消、桥/租约和销毁逻辑不因搬容器失效。

当前不提升或热改共享实现、不改冻结manifest/assets、不增加播放/参数按钮。最终UI布局、主题联动与独立窗互斥按[用户要求](WALLPAPER_SETTINGS_SIDEBAR_REQUIREMENTS_20261021.md)后续逐步推进；真实安装/窗口/视觉验收另取当时方便确认。
