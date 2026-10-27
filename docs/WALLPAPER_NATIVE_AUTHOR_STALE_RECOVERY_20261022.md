# 原生作者旧结构记录的确认式处理

2026-10-22，Codex。承接[参数结构刷新](WALLPAPER_NATIVE_AUTHOR_SCHEMA_REFRESH_20261022.md)。本轮补上旧结构待处理记录的显式确认、清除及刷新，完成支持范围内的本地恢复路径；不迁移旧值、不重发或回退壁纸，未安装或操作日常DSH/WE。

## 行为与确认

旧参数结构有待处理记录时，仍禁用即时编辑，在既有异常恢复区列出旧参数数量、旧标签及投递状态。低频操作收在“处理旧结构记录”折叠区，使用一个确认框和“清除旧记录并刷新”按钮，不增加日常保存/应用按钮组。

| 旧记录状态 | 行为 |
| --- | --- |
| 明确未发送 | 用户确认仅清除旧记录、不改变壁纸后可处理 |
| 结果未知或缺少可信投递证明 | 明示可能已发送，要求确认已观察画面；不发撤回或重放命令 |
| 命令仍在执行、执行器busy | 不提供可执行的清除入口，等待结算后显式重读 |
| 重新读取、隐藏/关闭视图 | 旧确认失效；重新显示也不能沿用之前的勾选 |
| 旧记录版本/投递状态、当前结构或目标变化 | 拒绝旧确认，保留记录，要求重新读取范围 |
| 清除成功 | 只建立新结构的干净插件默认记录，再允许新的明确编辑 |

确认绑定不可变恢复票据与当前可见SDK视图。任何一个已可见视图隐藏/关闭都会撤销旧结构确认许可，其它视图也需重读；这是一项保守的共享记录保护。超时、回包丢失或证明不完整不自动重试，后续显式读取可核对本地清除是否已经完成。

新显示值仍是作者默认值或插件记录，**不是WE当前值读回**。清除本地记录不证明画面已恢复默认，也不抵消此前可能已发送的修改。

## Host协议与范围保护

旧结构schema响应新增`draft.staleRecord`：旧指纹、revision、dirty key范围、经过约束的旧标签及投递证明。Host仅在插件内存保存已投影的标签，未解析标签回退安全key或“旧参数”；不返回旧值、旧工程JSON或磁盘信息。旧`draft.values=null`和`dirtyKeys=[]`语义保持，防止把旧字段当作新结构字段。

新增既有draft端点的`action: discard-stale-schema`，必须同时提供：当前结构指纹、旧结构指纹、精确revision、完整旧key集合、精确投递revision/state、`confirmDiscard:true`及显式布尔acknowledgeUnknown。除明确not-sent外还需acknowledgeUnknown=true。拒绝values搭车、重复/缺失/额外key、普通动作夹带旧结构证明、执行中/全局busy、无效目标或变化的身份/结构/版本/投递证明。

Host在同一无await的比较及替换段内，只清除确认范围所属的旧记录并建立新默认记录，revision加一，dirty为空、delivery=none；不生成执行计划、不调用WE。回包必须包含旧范围的discardedRecord证明，以及discarded/refreshed/mutation/currentValuesKnown=false。客户端同时核验旧范围与新默认值、指纹、revision、无dirty/非busy证明，全部通过才替换控件与票据。

已有同结构discard、干净refresh-schema及数值校验/执行器保持原语义。旧Host不返回旧范围证明时继续阻断，客户端不回退为reset/apply；本轮未增加跨结构值迁移或自动清除。

## 输入保护与指纹

证据：`F:\dsh-wallpaper-plugins\.tmp\native-author-stale-recovery-20261022-2c90e764`，含设计、开工副本、251项保护清单、最终源码/QA、原始运行输入与报告、`change-audit.json`。

既有251项输入仅client、原生侧栏模块与作者Host变化，其余248项保持；新增两份QA。client除原生侧栏生成块外完全一致，旧QA、两个生成器、协议校验器、执行适配器、manifest与生产assets保持，21项官方SDK快照一致，原脏改动保留。

| 最终输入 | SHA256 |
| --- | --- |
| client.js | `3EAFCA939FF3FBDF578F67150C3DE0286064B1F155C64943323A3B4FC96ED8D5` |
| native-appearance-sidebar.js | `6A94C8F4DF2AB9514D34CE8823B624CB5F6D159ED108CC6155A76E217ACA3ECF` |
| author-properties-host.js | `E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` |
| native-author-stale-recovery.test.mjs | `56CBB3EB536FBBA7354C781BFB89D3BC19435C3FB0AD02E08A28B712D56AF068` |
| author-stale-recovery-host.test.mjs | `24AAAEEC80E109694B3A1EFC141A0489EE9BAA8197646BEA518C58E7044B3FF2` |

## 验证结果与实际边界

`final-regressions-report.json`：新客户端14项、Host18项，加既有434项，共**466项通过**。覆盖范围/证明缺失与损坏、未知/执行中、标签回退、并发确认唯一胜出、同revision下投递变化、版本/结构/身份冲突、可见性/ABA/迟到回包、超时物理通道及丢失确认后的重读；两个生成块、语法与CSS检查通过，全部阶段退出确认。

SDK分两组，均经过完整Whale入口、真实React/官方SDK/主题/会话/原生右侧栏/dockkit、主端bridge、认证HTTP作者Host与原执行适配器：

- `existing-sdk`：原111流程通过，属性IO替身60次，峰值1、最终0；父监督9.155秒，5个Blob URL全部释放。
- `stale-sdk-verified`：前轮结构13流程加本轮8流程，共21流程通过，父监督4.117秒。真实DOM核对旧范围标签、确认前禁用、可能已发送的观察文案、重读/收起后勾选失效、并发改记录/再次变结构拒绝、空结构恢复、外部执行中无清除入口，以及结算后的未知结果确认。6次旧结构清除请求中4次确认成功、2次按预期冲突拒绝，未增加属性执行。

第二组仅有4次明确的属性IO替身：前轮新结构编辑`speed:7`、本轮新编辑`speed:8`、发送后失败用的`speed:3`、模拟其它编辑者明确应用的`caption: external pending`。所有清除、刷新和被拒绝确认新增执行0次；执行峰值1、最终0，**真实WE命令0次**。

浏览器第二组固定核对5条故意409的路由/POST/generation/error顺序：原结构变化draft/apply两条、发送后command_failed、旧确认revision_conflict、确认时schema_changed。其它编辑者通过Node端真实HTTP调用的发送后结构复验，另明确核对409/author_schema_changed/sentMayHaveOccurred=true；没有混成成功或加入宽泛错误豁免。原401身份约束及`cleanLog:false`保持。

两组最终订阅、refs/pins、监听、DOM、stream/预览IO归零，自有headless Edge退出、两服务关闭确认。元数据/生命周期为合成输入，窗口/进程与WE命令为底层IO替身；没有实际Lucy工程、实际Windows输入法或整体视觉验收。隔离空流30秒、UI等待3500ms、读取/本地确认4秒、作者写入12秒及SDK45秒总截止/51秒收束保持，产品停帧保护未改；旧等待观察按前置报告保留，不藉本轮通过改称实机根因解决。

过程保留：首次新SDK到19流程后，测试helper把其它编辑者apply预期为成功而失败，父监督3.699秒退出，清理确认。核对原适配器后发现它在发送后还会再次验证结构，因此执行期间变结构应返回“可能已发送”的拒绝。本轮只修正夹具预期，明确核对该拒绝并要求观察确认，未修改执行器；原失败与最终21流程输入/报告分别保留。

## 下一小步

支持范围内的干净结构刷新及旧记录确认式处理已完成离线闭合。下一步单独做原生页与旧独立设置页互斥；候选整合、真实壁纸/视觉与安装另安排，不能把本轮结果扩称所有壁纸或长期稳定。

日常DSH0.2.1-rc.2/外观rc.42/Git Bash0.1.1保持；未打包安装、改版本/Profile/生产assets、操作日常DSH/WE、提交推送清理、联系其它助手或恢复定时。

> 2026-10-22 后续接续：本节“下一小步”的新旧设置页互斥已完成上述离线范围，实现、迟到结果补修和验收边界见[编辑入口互斥报告](WALLPAPER_NATIVE_EDITOR_EXCLUSION_20261022.md)。当前下一步仅界面分区的界面不透明度与聊天底色两控件，以仓库顶部接续为准。
