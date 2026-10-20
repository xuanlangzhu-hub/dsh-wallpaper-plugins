# 独立/吸附设置P1A十审：九审余项闭合，源码离线复审通过

2026-10-18，Codex。复核[九审补修交付](DETACHABLE_APPEARANCE_P1A_NINTH_REPAIR_DELIVERY_20261018.md)，对照[九审报告](DETACHABLE_APPEARANCE_P1A_NINTH_REVIEW_20261018.md)。**本轮通过：创建身份一秒容差已撤回，九审余项闭合；P1A当前源码在已列离线范围内复审通过，无新增阻断项。** 不把它扩称真实Edge独立窗口、吸附体验、发布包或长期运行验收。

本轮只读实现，编写复审/接续文档；未安装、提交推送、清理旧证据、查询/操作日常DSH/WE或修改日常Profile。Windows默认分支由Node VM替换底层spawn/execFile，未执行真实PowerShell/taskkill。双Tab仅独立profile无界面Edge，生产窗口适配器是替身。日常版本沿用DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，没有刷新实时播放状态。

## 本轮变更和独立验证

证据目录：[`.tmp/detachable-p1a-tenth-review-20261018-1e025368`](../.tmp/detachable-p1a-tenth-review-20261018-1e025368)。冻结161项输入；相对九审对应输入，仅adapter和八审QA变化，另新增九审QA。

实际adapter差异只有注释与创建身份判据：移除delta计算和`delta > 1000`，恢复`currentMs !== expectedMs`。没有重写路径/字段/生命周期模块。

原`creation-identity-boundary.mjs`不改fixture复跑：

| 场景 | 本轮结果 |
| --- | --- |
| 子创建时间+1/+500/+1000/+1001ms | 四例均close=false、零taskkill、profile保留 |
| 根创建时间+500ms | close=false、零taskkill、profile保留 |
| 子创建时间完全一致 | 定向taskkill替身1次、close=true、正常清理 |

安全门禁退出0，见`creation-identity-boundary-result.json`与日志。五个身份变化负例全部通过，合法一致正例通过。实际匹配/解析与状态机运行，只有系统I/O被替换，不声称实测了Windows的PID复用概率。

## 累积修复保持

- **八审4例**：当前创建时间缺失/损坏、基线缺失均未知保留；同名不同目录的程序被排除，没有taskkill。原`incomplete-identity-probes.mjs`退出0。
- **七审3例**：子被shell/不同profile复用、根在快照后复用，均动作前拒绝，零taskkill并保留。原`pre-action-identity-probes.mjs`退出0。
- **六审8门禁**：命令错误、异常文本/截断JSON、根已退出、自身排除、无关提及、前缀碰撞、非Edge程序保持。原`windows-adversarial-probes.mjs`与`safety-gate.mjs`退出0。
- 完整路径、当前/基线字段必验、返回PID一致性和统一测试协议保持；W2根缺席、W4存活/失败dispose保留及EBUSY重试保持。
- 原独立`alive-dispose`、`ownership-origin`、`remaining`与实际新SDK引导/卸载退出0，来源分表/已有目录保护/stop重试/输入队列保持。SDK匿名引导401、不泄露token、ctx.effect卸载后无监听保持。

## 回归和覆盖边界

| 本轮复跑 | 结果 |
| --- | --- |
| npm run check | 退出0 |
| P0 / P1A专项 | 15/15、5/5 |
| 九审QA | 表示规范化单元及7项生命周期场景通过 |
| 八/七/六/五/四/三审QA | 全部退出0 |
| 双Tab无界面浏览器 | 11项通过，窗口替身spawn=3/close=3 |

九审QA验证同一epoch的数值、WMI、UTC ISO和带时区ISO形式通过，正/负毫秒差异拒绝；独立默认Windows分支补上表中的实际根/子动作链路。源码与这些fixture范围通过，不将替身强杀称为真实系统强杀。

日志位于证据目录：`check.log`、`p0.log`、`p1a.log`、`ninth-repair.log`至`third-repair.log`、`browser-e2e.log`、`real-sdk.log`及各独立探针日志/JSON。

client/index/Host/契约/伴随页/外观QA与九审输入一致；真实React挂载、正式生产页面握手/调参及外观570/英文566/选择沿用已有证据，本轮不重复整套外观检查，也不记为新实测。P1A当前源码已有正式Host/静态页接入及隔离生产页面证据；旧P0报告“尚未交付”的描述是阶段历史，当前仍未完成的是独立候选整合及真实系统窗口交互验收。

最终161项输入及59项受保护资产/归档无变化，见`inputs.json`、`final-preservation.json`。工作区manifest/assets仍rc.30冻结；本轮源码没有进入日常rc.35，不直接整体打包或热改安装目录。

## 接续

本阶段P1A反复补修可在离线范围收尾，不再要求小G重做已闭合项。下一步按已记录优先级处理[日常滚动/壁纸清理锁](DAILY_SCROLL_WALLPAPER_INCIDENT_TRIAGE_20261018.md)：先B的异常退出后重试恢复，再A的滚动容器复现与归因，优先于P1B扩UI。

日常故障与P1A分别保护输入、单独交付，不把本轮W3适配器成果说成修复了壁纸worker清理；初次断流原因仍待查。P1A未来候选须从明确日常基底独立整合并审计，真实安装/开窗/采样另确认届时方便；当前不安排新实机、不自动进入P1B或发送跨会话任务。
