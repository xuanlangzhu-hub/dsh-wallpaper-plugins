# 原生侧栏：前端有界读取与同轮状态核验

2026-10-23，接续[Host只读关闭状态](WALLPAPER_NATIVE_HOST_CLOSE_STATE_20261023.md)。本轮接通显式读取与上下文核对，**尚未提交none或接关闭按钮**。

## 读取与核验

同一engine新增 `readHostCloseState()`、稳定的 `getHostCloseSnapshot()` 和可释放的 `subscribeHostCloseState()`；controller新增 `refreshBackgroundCloseState()`，原 `readBackgroundCloseState()`附带本轮hostRead观察。

只有明确调用refresh／read方法才发一次 `GET /whale-wallpaper/close-state`，cache:no-store；启动、打开侧栏、普通读取快照、改变外观或重建原生服务均不自动发GET。读取不开始／停止／重启、不写偏好，不调用旧set background路径。

整个fetch和响应体共用截止时间，默认最多4秒；调用方可缩短，较长值会被截到4秒，也不会扩大原hostStatusTimeoutMs上限。外部AbortSignal、较新读取、代次／命令变化、上下文失效和卸载均能结束这轮等待。底层即使不配合abort，迟到成功也不能覆盖当前状态；晚到的未读响应体会取消消费。没有自动重试或轮询。

响应最多8192字节、8192个数据分块；额外的分块上限覆盖连续零字节块耗尽事件循环的情况。严格UTF-8、JSON、完整字段／类型／安全整数、UUID、16项明细上限／真实总数／截断关系、合法种类与递增操作ID、代次，以及state／session／ownership／uncertain／quiescent的组合必须一致。缺失、矛盾、未知版本或额外字段均拒绝，不用默认值补成idle。

首个有效Host UUID绑定当前engine；后续更换身份报host-read-changed，不因重建侧栏而重置。相同Host的修订／运行／取消代次不得回退，相同修订不得携带不同内容，disposed身份不能复活。身份绑定不会因一次失败或取消而清除。

错误只返回固定短代码，不把响应原文、路径、命令或异常细节放进观察对象。旧Host没有新接口时明确unsupported，不退回status／lastCleanup推算正面证明。网络读失败不会清除原有的**写命令未知锁存**。

## 本轮上下文与许可边界

每次读取捕获engine代次、命令修订和当时状态对象。controller再绑定偏好对象、显式播放意图、来源选择修订及主题事件修订；选择或主题A→B→A也会使旧结果失效。普通快照读取、引擎状态发布及回包发布前后都会核对有效性；外观变化后即使最终值相同，也不能复用之前的观察。没有为此增加全局设置订阅或后台网络任务。

- `sameRound:true`：这一有效回包仍对应发起时的本轮上下文。
- `bothQuiescent:true`：本地没有活动／清理／未落定命令／写未知，且该Host回包的quiescent为true。
- **canCommit仍始终false**：两侧当前观察一致，也不构成关闭来源的授权票据。

Host的scope仍只是arrived-operations，GET不会阻止稍后才到达的旧格式start。本轮没有解决跨controller旧请求、Host端写入栅栏或读取到提交之间的原子性问题。快照不能缓存后再交给旧setter关闭背景。

## 负例与收尾修补

新增QA先在原输入运行，因接口不存在失败。首版24项中，一个状态枚举夹具把同一Host已disposed后的状态重新改成活动，并在状态变化时没有增加修订，正确触发拒绝；修正为按实际协议递增修订、disposed最后出现，未放宽产品解析。

随后先补负例，再修新读取实现的边界：异步／非true上下文回调不算有效；连续空分块有有限预算；完成监听中同步发新命令时，外层也必须返回stale而非ok；取消后晚到响应体需要释放。另一次Signal监听注册抛错暴露截止计时器留存，已将注册放入完整try/finally，固定失败码、清除计时器并防止提前取消分支成为未处理拒绝，移除监听异常也不覆盖原结果。失败输出和输入保留。

这些补修只涉及新读取，不改原播放command的超时／兼容行为。原网络写命令仍不会因为UI截止时间就被当作已经取消，未知也不会靠一次健康GET洗掉。

## 最终验证

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-host-close-read-20261023-f21e8c64`。

新增 `qa/wallpaper-host-close-read.test.mjs` 的**30项**使用完整client的产品engine导出，覆盖正常读、挂起fetch／body、截止／取消／迟到／替换、命令与上下文失效、卸载、HTTP／解析／字节／分块、严格schema和组合、Host身份／计数回退、写未知、监听注册／清理及完成回调重入。一项通过真实回环HTTP将实际registerWallpaperRoutes接到实际engine parser，未调用生命周期动作。替身用例的挂起在finally明确释放，自有计时器归零。

`verified-regressions-report.json`：新30项加原694项前端／相关回归和28项Host schema检查，**752项测试通过**，共42个有界阶段，含生成同步、语法与CSS检查。P2与Motion Cadence纯离线回归分别1.071秒、11.985秒通过，不是性能实测。

| 完整client／实际官方SDK | 流程 | 父监督时间 | 作者IO替身 | 播放HTTP／新GET |
| --- | --- | --- | --- | --- |
| verified-existing-sdk | 原111项 | 23.988秒 | 60次 | 既有3次合成播放；新GET 0 |
| read-repaired-sdk | 新8项 | 2.980秒 | 0次 | 播放0；新GET 8次 |

共**119项完整SDK流程通过**，使用真实Whale入口、官方React／ThemeRuntime／会话／原生右栏／dockkit、controller和引擎。新GET走实际Host只读handler；Host没有创建session，文件存在性／sessionFactory若被调用即失败，真实WE命令0。旧组的播放／作者／原生窗口IO仍为底层替身，不能扩称实机。

新组覆盖打开侧栏不自动请求、controller真实读取、选择A→B→A、普通设置往返、实际主题事件往返、原生服务重建不重置绑定、Host更换拒绝、调用方取消及完整Whale卸载。只用QA为新GET扣住／释放回包，未替换产品读取或解析逻辑。

SDK首轮在主题用例等待中间主题停留超时：原有保护会将外部主题恢复到已选Whale主题。修正脚本为检查同步切走、随后恢复的实际A→B→A过程，产品主题保护保持，3.5秒等待期限未增加。此失败、较早的通过及最终输入的完整重跑均保留。

最终两组页面异常0、未知HTTP错误0；settings／status／library／preset订阅、refs／pins、远端监听、DOM、stream和活动Blob URL归零，自有headless Edge正常退出、两个服务关闭确认，无强制退出。旧111组创建9个URL、释放9个。新增订阅在单测中取消／卸载验证，不借现有订阅计数声称它已由UI使用。

保留原精确匹配的首次可选snapshot401／disconnect401及旧组3项故意作者409，cleanLog:false，无额外400；历史snapshot400和Edge收尾超时仍未定因。父监督45秒／51秒、单阶段20秒／25秒及回归总60秒保持；网络中断前已完成的自有测试退出均有记录，未遗留依赖用户提醒才停止的任务。

## 输入保护与下一步

268项既有输入仅client变化，其余**267项保持**；新增30项QA，旧QA／Host／侧栏模块／作者执行器／两个生成器／manifest／生产assets和官方冻结输入保持。client变化限制在engine新读取、controller只读／refresh方法及主题上下文修订；两处生成块和旧偏好写入／停止／reset／CSS保持。精确开工副本与最终审计见change-audit.json。

最终client SHA256：`A28CACB76A9C84988A0B92438861DFE1FC3B2E8B56B6936AA9C635F78C03B111`；实际Host仍为 `EF4E19950CE27E0F0904D8E7749B043860E548D875D45CECC66F88F2B0407637`。两组最终SDK均绑定上述client，新GET组另绑定实际Host指纹。

下一小步转向**关闭来源的提交约束与最小实现**：先明确如何排除旧controller／未到达请求和未知，再设计只能消费当前有效上下文、且不额外发stop的专用提交方法；不能把bothQuiescent直接当成许可，也不能走await stop后set none的重复命令链。必要的写入栅栏未闭合前继续拒绝，不先挂一个看似可用的按钮。图片／视频导入、全局恢复、独立窗迁移和性能专项不顺带推进。

本轮未构建打包、安装发布、操作日常DSH／WE、改Profile／版本／生产assets、提交推送清理、联系其它助手或恢复定时。日常DSH0.2.1-rc.2／rc.42／Git Bash0.1.1保持，开发manifest／生产assets仍rc.30；源码／协议测试不代替实机、视觉或长期验收。
