> 2026-10-25 当前接续：[D1作者反馈源码整理完成](WALLPAPER_NATIVE_AUTHOR_FEEDBACK_20261025.md)。五类作者参数共用固定反馈槽，初始展示参考值、下发确认与本轮未知分清，格式错误单独保留；来源按需展开，重新读取不重复下发。232项相关离线／实际Windows rc.3 SDK130项通过，控制器／输入编辑器／恢复区及38个事件表达式保持，仅提升ESM／client与两份新QA。新UI桌面视觉未验收。按用户最新安排，整体UI和控件样式设计后置，不自动进入D2–D5；下次先核对原生侧栏原路线的剩余功能／固定来源候选范围。日常DSHrc.3／Whalerc.47／GitBash0.1.2未写入，版本／生产assets仍rc.30，无候选安装、推送清理、派发或定时。

# 原生侧栏：rc.3兼容接续与作者反馈语义核对

2026-10-25。承接[宿主升级收尾](DSH_021_RC3_UPGRADE_TRIAL_20261025.md)及[侧栏改版方案](WALLPAPER_NATIVE_SIDEBAR_UI_REFINEMENT_PLAN_20261024.md)。**已核验既有rc.3 SDK证据仍适用于当前源码，作者反馈语义审计完成；本轮未改产品实现、打包或安装。** 日常保持DSH0.2.1-rc.3／Whale rc.47／Git Bash0.1.2。

## 兼容复核结果

当前侧栏已经包含局部控件样式、壁纸／界面分区、独立滚动及当前对象小预览，不重做已完成步骤。上轮实际npm rc.3 SDK和签名Windows rc.3 SDK各128项的输入重新核对如下：

| 输入或证据 | 本轮核对 |
| --- | --- |
| 281项共享源码／QA／资产 | 全部与上轮保护清单相同 |
| 260项冻结SDK验证材料 | 全部符合原指纹 |
| 35项实际Windows制品输入 | 全部符合原指纹；已安装app.asar也符合已验证的签名rc.3来源 |
| 两组原SDK报告／监督回执 | 各128项通过、父监督退出确认；是既有覆盖的重复分发验证，不加成256个独立功能，也不是本轮重跑 |
| 当前client及作者Host | 当前SHA256与Windows SDK报告inputHashes一致；client=`5D5B77EBCE77CA6B8FD741DB6BACD7D011B847BFED707F8EE884B4521C6FE4AD`，作者Host=`E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` |
| 日常安装来源 | Whale rc.47的37文件、Git Bash0.1.2的7文件分别仍符合固定tgz；只读核对，没有刷新运行状态或读取活动用户存储 |

因此不为未变输入再次启动headless浏览器或重跑全套SDK。旧SDK中的WE／原生窗口／作者命令底层IO为替身，不代替新侧栏真实桌面视觉验收；升级中的Lucy短验使用日常rc.47固定旧界面，也不能冒充当前新侧栏的验收。

实际固定rc.46原包SHA256仍为`E44108B008CB4D022136BD2568F4F02C75E303D0FF13678AAEE74F411E24DB7E`。本轮从tgz直接读取清单，调用已保存的官方兼容判断：rc.2接受、rc.3拒绝，未使用豁免；实际Windows右侧栏模块版本为0.2.1-rc.3。隔离内存追加精确rc.3声明后门禁接受，rc.4／正式0.2.1／0.2.2仍拒绝。**这只是元数据补修范围验证，未生成候选，也不意味着仅改rc.46清单即可包含后续新UI。** 以后候选必须绑定当时固定源码、正确的右侧栏inject／peer、真实归档和适用SDK证据；开发rc.30清单不热改。

## 作者状态的真实来源

核对源码：`dsh-whale-mist/src/sidebar/native-appearance-sidebar.js` 的 `createNativeAuthorSwitches`、各Author控件；`src/wallpaper/author-properties-host.js` 的state／apply／draft；`src/wallpaper/author-properties-apply.js` 的身份验证与命令退出链。

| 状态 | 已有真实含义 | 不能推导的结论 |
| --- | --- | --- |
| 未读取／读取中 | 还没有可用字段，或正在读取schema及插件内存记录 | 不是壁纸当前值读回，不能显示“已与壁纸同步” |
| 字段有值但无mark | 值来自作者默认值／插件记录，或重新读取后留下的记录值 | checkbox的true／false只是参考值，不能声称当前画面开关状态确定 |
| busy | 用户意图已入本地队列，可能正在保存draft、等待前一个命令，或下发 | 不能统一写成“正在发给壁纸”，更不能说每个busy字段已经发送 |
| sent／✓ | 对该次实际delta，draft指纹／revision、applySent和currentValuesKnown=false等条件均通过 | 不是视觉效果确认，也没有查询WE当前属性；文案保留“下发已确认，效果请观察” |
| error | 这条UI操作确定未完成；确定拒绝发生在下发前时标记error | 值仍保留用户请求位置，不自动回滚；错误不等于值格式非法 |
| unknown | 本轮操作无法确认结果，状态保守阻塞后续写入 | 不等于确定失败／确定未发送；也不能断言每个同标字段都执行过命令 |
| recovery | 读取到旧dirty、pending、unknown或旧schema记录；需按实际证明处理 | 重新读取、清记录不重新下发、不回退画面；未确认命令不能自动重放 |

Host的 `state()` 返回 `draft.source='plugin-memory'`；apply只有在adapter返回ok／sent并通过后置身份核验后，才清dirty、记delivery.confirmed并返回`applySent:true,currentValuesKnown:false`。adapter验证进程／窗口／创建身份，等待命令和后置校验，但没有渲染结果回读能力。不能在纯UI步骤新增“实际当前值已知”字段。

## 两个真实控制器观察

本轮冻结生产控制器，仅替换request底层IO及计时，未修改控制器实现：

1. 初始读取只取记录，不发apply；成功修改particles后mark=sent。再次读取，记录值仍为修改后值、Host记录delivery仍confirmed，但本地marks清空，也不增加apply调用。这是当前保守语义，不能从“清dirty／有记录”重建永久✓。新呈现要允许“记录值”和“本视图本次确认”分别表达。
2. particles的apply未结束时，用户改light；前者超时，两个字段mark都变unknown。实际draft只有`{particles:false}`，apply键也只有particles，light仍为未保存的排队意图。物理请求未结束前canRead=false，之后才释放；迟到成功不能恢复✓或触发第二次apply。**unknown目前是保守的本轮聚合状态，不是每个字段的发送账本。** 此处属于反馈精度限制，不是已证实并发执行或错误重发；下一纯呈现步骤不能伪称light“已发出但未确认”，也不能据此开放单字段重试。

观察见 `state-observations.json`。两个观察经过断言、有界监督129毫秒完成；请求与计时为内存替身，不能当成真实WE超时复现。

## UI问题与下一步最小呈现改动

按emil-design-eng的局部反馈原则审计，下面的After为**下一步待实现目标**，本轮不声称界面已改：

| Before | After | Why |
| --- | --- | --- |
| 无mark的bool以indeterminate减号遮住参考值，其它类型却显示记录值 | 统一让控件呈现参考值，采用独立、可访问的来源说明表达“默认／记录；实际效果未读取” | 值和可信程度分开；不能把三态外观误当作者的第三种布尔值，也不能假称回读完成 |
| 5类控件分别拼busy／✓，完成图标出现时宽度可能变化 | 共用局部反馈呈现，预留固定小槽；busy、sent、unknown、error使用一致语义 | 不改controller或命令；让同一种结果在每种控件中含义相同，不用常驻段落或成功Toast |
| unknown／error主要靠分组文字和aria-invalid，字段未必有可见提示 | 字段附近显示简短标记与按需说明；“本轮修改结果未确认”覆盖聚合unknown，不声称具体字段已发出 | 下发未知不是输入格式非法，颜色／图标也不能单独传达含义；保留本地格式错误的aria-invalid |
| “刷新设置”容易被理解为从WE重新读取真实属性 | 明确为读取作者结构及插件记录，不查询壁纸实际值、不重新下发 | 文案必须符合现有能力；读取失败、待处理记录和恢复动作继续沿用安全门禁 |
| 确认与失败的长说明常驻正文 | 正常路径以控件状态表达；来源解释及技术细节按需展开，必要错误／恢复仍可见 | 减少文字堆叠，同时不藏掉未知状态和用户必须作出的恢复决定 |

下一小步仅修改单一来源ESM内的Author控件呈现及其client生成块：

- 不改`createNativeAuthorSwitches`、edit tickets、dirty／revision／fingerprint、Host、命令adapter、输入校验和12000／4000毫秒期限；不增加重试／轮询／自动load／默认值下发。
- 5类字段及滑块数值编辑器共用一致的反馈语义；保持现有事件、输入data标识、IME／Enter／Esc／blur／slider提交与取消规则。任务中的unknown文案按“本轮”表达，精确每字段发送账本以后若需要，单独做行为任务。
- 正常送达仍只是“下发已确认”，本地未知不能因读取到confirmed的持久记录而自动展示本视图✓。切目标／代次／视图后不带旧成功标记。
- 复用已有主题token和继承字体；不新增动效／外部资源／计时器／依赖；失败和未知不只靠颜色。固定小槽避免图标出现时挤动控件。
- 原`state.message`、确认清记录、旧schema恢复等必要动作可以压缩视觉，但不删掉观察确认、pending阻塞或让清记录变成自动重放；本步骤优先不改恢复区。

## 验证与提升门禁

本轮7个既有测试文件共**119项通过**，父监督1321毫秒，退出确认、无超时：native-author-switches／recovery／schema／stale-recovery及Host的recovery／schema-refresh／stale-recovery。覆盖确定拒绝、传输未知、迟到结果、物理lane占用、ABA、隐藏／卸载、脏记录和旧结构恢复。没有将这些底层IO替身用例冒充真实发送或新UI视觉。

下一呈现实现先在本轮独立副本推进，使用真实生产控制器。提升前必须证明控制器／Host及client生成块外字节不变，保留现有事件，跑相关119项、单一来源生成检查和实际Windows rc.3 SDK相关流程；补有意义的DOM断言，区分未知／下发确认／本地无效值及刷新后状态，避免只测试CSS字符串。外部浏览器资源和原401／409门禁不放宽，不延长旧挂起任务期限。若未发生Windows桌面观察，明确保留最终视觉未验收。

## 证据与保护

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-author-feedback-audit-20261025-b572e061`，含281项冻结副本、既有SDK证据复核、实际rc.46清单、官方声明判断、日常包只读核对、119项输出和两个状态观察。

本轮未启动浏览器／DSH／WE或采样桌面，不运行安装器、CLI安装或真实作者命令，不读取活动Profile／外观存储。281项实现／QA／资产和日常37／7文件保持，版本／生产assets仍rc.30；没有新候选、提交推送、清理、派发或恢复定时。旧首次断流、滚动A、三体与性能／GPU结论保持原范围。
