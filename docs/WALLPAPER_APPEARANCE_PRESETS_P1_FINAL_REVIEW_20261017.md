# 外观预设P1最终复审：R1/R2闭合，代码与隔离回归通过

2026-10-17，Codex。复核[第二轮续修交付](WALLPAPER_APPEARANCE_PRESETS_P1_SECOND_REPAIR_DELIVERY_20261017.md)、实际源码/QA差异及[上轮复审](WALLPAPER_APPEARANCE_PRESETS_P1_SECOND_REVIEW_20261017.md)。**本次范围通过，R1/R2可闭合，未发现新的阻塞问题。** 这是代码及隔离回归结论，预设P1尚未进入新的功能包，也未在真实DSH中验收。

## 补修核对

| 项目 | 本轮结果 |
| --- | --- |
| R1：真实stop在途 | UI预设按钮禁用，controller拒绝操作；成功完成后恢复 |
| R1：较新失败后的旧成功 | 保持cleanup-failed，旧回复不再抹掉当前失败 |
| R1：新start/restart后的旧stop | 保持新轮connecting及host快照；旧成功、失败、异常不再覆盖状态或lastCleanup |
| R1：dispose后的旧stop | 等待初始Host状态读取结束后单独验证，旧stop完成不再发布状态，controller三操作拒绝disposed |
| R2：初始未确认/明确不可用 | UI与controller拒绝；Lucy回退及明确不可用拦截保持 |
| R2：刷新等待中的旧组件列表 | 引擎确认保持失效；真实组件render不再写回旧列表，保存/应用/删除继续拒绝 |
| R2：网络/解析失败及非ready | 当前确认失效；旧请求异常不清掉新请求确认 |
| R2：组件卸载与恢复 | 实际组件effect清理取消读取，迟到错误不更新卸载后的组件；引擎取消当前读取后拒绝操作，新确认可用后恢复三操作 |

源码关键接缝：`dsh-whale-mist/src/client.js:1274`及`:1288`在任何当前状态写入前检查stopId、generation和disposed；`:1166`的readLibrary在当前版本成功/失败/异常分支统一更新确认；WhaleAppearanceSettings已删除向引擎反向回写目录快照的render/effect逻辑。UI展示缓存不再恢复已失效的controller确认。

四字段、手动保存/应用/删除、120%上限、旧设置归一化、存储错误与全局reset隔离保持。没有将主题/强调色或自动套用临时塞进P1；没有改Host或原生清理规则。

## 独立验证

本轮证据目录：`F:\dsh-wallpaper-plugins\.tmp\wallpaper-appearance-presets-p1-final-review-20261017-496f92d8`。

- `npm run check`通过，含语法与CSS模板守卫，见`check.log`。
- `npm run test:appearance`实际输出**160项通过**，见`appearance.log`。小G交付写159项，本轮以实际日志为准；该计数差异不影响功能结论。
- `node qa/appearance-regression.mjs --scene-selection-only`通过，未改选择启动一次、切换过选择不自动启动，见`scene-selection.log`。
- 原基础两项反例、上轮四项交错反例共六项均为`regressionObserved:false`，见`original-boundary-probe.log`、`extended-boundary-probe.log`；同时核对具体状态/错误，不只看退出码。
- 另补**17项强断言通过**，见`supplemental-review.log`，覆盖旧stop失败/异常、lastCleanup、dispose、坏JSON、非ready、旧目录异常迟到、实际组件卸载取消和可用确认后的三操作恢复。

探针使用真实生产controller/组件与假Host HTTP边界，未替换生产getStatus。目录局部状态沿用现有hook fixture方式；独立临时profile的无头Edge不等于官方DSH界面验收。

补充探针最初的dispose状态比较尚有初始loadHostStatus未结束，因其返回改变host字段而失败，记录保存在`supplemental-fixture-initial-attempt.log`。随后修正fixture为先等待初始Host状态读取完成，再隔离验证stop迟到，最终17项通过。未为此修改生产代码，也不把该检查扩称为所有Host异步返回的全面dispose审计。

本机复跑：`node <证据目录>/probe/appearance-regression.mjs --original-preset-review`、`--preset-review`、`--supplemental-review`。正式源码/QA与本轮快照、`before.json`、`protected-verification.json`、`review-verification.json`同目录保留。

## 保护范围与下一步

更新本轮结论/入口文档前，**413个保护文件指纹一致**，覆盖工作区生产/QA、manifest/assets、旧包归档、日常安装文件和5个Profile。Codex只新增本机隔离证据与复审/接续文档，未修改生产/正式QA。没有查询或操作真实DSH/WE、截图、打包、安装、提交推送或发送跨会话消息。

日常rc.31文件保持，实际运行/播放状态本轮未查询；历史停止确认不能作为后续实机操作授权。工作区manifest/生产assets仍rc.30冻结，源码含后续P4/Trace/外观实现；未来功能包继续从已审rc.31独立叠加、审核差异，不直接发布整个工作区或覆盖旧tgz。

本次P1编码补修到此收尾，不再要求小G继续返工R1/R2。下一步先按[主题可读性/强调色调查](THEME_READABILITY_ACCENT_DESIGN_NOTES_20261016.md)拆小任务：优先可读性增强及阅读底色，再独立强调色，之后另评估纳入壁纸预设。当前尚未下发新的主题编码任务，也未开始主题实现。120%随下一功能包交付，继续遵守用户跳过其独立候选/重复实机的决定。
