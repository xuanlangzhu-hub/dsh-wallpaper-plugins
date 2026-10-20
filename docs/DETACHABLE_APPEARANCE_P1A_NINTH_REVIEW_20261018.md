# 独立/吸附设置P1A九审：八审余项闭合，仅撤回新增的创建身份一秒容差

2026-10-18，Codex。复核[八审补修交付](DETACHABLE_APPEARANCE_P1A_EIGHTH_REPAIR_DELIVERY_20261018.md)，对照[八审报告](DETACHABLE_APPEARANCE_P1A_EIGHTH_REVIEW_20261018.md)。**八审字段完整性与完整路径两项已修复；总体仍暂不通过，仅余本轮新增的CreationDate一秒容差。** 不重做已通过项，不扩UI或其它功能。

本轮未改实现、安装、提交推送、清理旧证据或查询/操作日常DSH/WE。Windows默认分支在独立Node VM内替换底层spawn/execFile，未执行真实PowerShell/taskkill；双Tab回归仅独立profile的无界面浏览器，生产窗口适配器仍为替身，不算实机窗口验收。日常仍沿用DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，未刷新实时状态。

## 已通过

证据目录：[`.tmp/detachable-p1a-ninth-review-20261018-58669df9`](../.tmp/detachable-p1a-ninth-review-20261018-58669df9)。冻结160项输入；相对八审对应输入修改adapter及五/六/七审QA，另新增八审QA。最终源码和资产保护结果见`final-preservation.json`。

- 八审原`incomplete-identity-probes.mjs`不改fixture复跑，4项均零taskkill：当前创建时间缺失、损坏、基线快照缺时间时close=false并保留profile；已明确归类为其它程序路径的记录被排除，根已退出且无本轮资源时close=true并清理，这个结果允许。
- 七审原`pre-action-identity-probes.mjs`3项PID复用负例保持通过，根/子均动作前查询、拒绝错误目标并保留。
- 六审原8项安全门禁通过。测试专用empty stdout直接matched分支已移除；返回PID一致性校验已加入；全路径与当前/基线字段校验有效。
- check、P0 15/15、P1A 5/5、八审专项、七审专项、六审专项、五审5项、四审7项、三审5项、双Tab11项均退出0；独立alive-dispose/ownership-origin/remaining及实际新SDK引导/卸载保持。
- client/index/Host/契约/伴随页/外观QA未变；真实React/生产页面及外观570、英文566、选择沿用已有证据，不作本轮新实测。

对应日志：`incomplete-identity.log/json`、`pre-action-identity.log/json`（JSON文件名带`-result`）、`safety-gate.log/json`、`check.log`、`p0.log`、`p1a.log`、`eighth-repair.log`及各历史专项日志、`browser-e2e.log`、`real-sdk.log`。

## W3 [P1] 同一个创建身份被放宽成一秒范围，仍可放行不同生命周期

位置：[classifyProcessRecord创建身份比较](../dsh-whale-mist/src/detachable-edge-adapter.js:208)。

此前为合法创建时间不同即拒绝；本轮增加：

```javascript
const delta = Math.abs(currentMs - expectedMs);
if (delta > 1000) {
  return { status: 'foreign-recycled', reason: 'creation-date-mismatch' };
}
```

相差0到1000毫秒均被判controlled。这里核对的是OS进程创建身份，不能按测量误差把两个不同创建时刻合并。允许的WMI/ISO格式可以规范化为同一个epoch；本轮没有提供同一身份需要一秒容差的证据。当前代码和新增QA反而明确接受相差500毫秒的记录，属于本轮引入的放宽，不能用其绿灯证明PID复用防线闭合。

### 独立默认Windows分支结果

`creation-identity-boundary.mjs`沿用原动作前VM框架。扫描快照的创建时间固定为`2026-10-18T01:00:00.000Z`，动作前返回相同数字PID/路径/精确profile参数，但创建时间变化；实际生产解析/判断运行，只有系统IO是替身。

| 场景 | 实际命令选择与收尾 | 安全期望 |
| --- | --- | --- |
| 子创建时间+1ms | 发taskkill /F，close=true | 拒绝并保留 |
| 子创建时间+500ms | 发taskkill /F，close=true | 拒绝并保留 |
| 子创建时间+1000ms | 发taskkill /F，close=true | 拒绝并保留 |
| 子创建时间+1001ms | 不发taskkill，close=false并保留 | 通过负例 |
| 根创建时间+500ms | 发taskkill /T /F，close=true | 拒绝并保留 |
| 子创建时间完全一致 | 正常定向强杀并清理 | 通过正例 |

结果在`creation-identity-boundary-result.json`与日志，门禁退出1；5个身份变化负例中4个失败，合法一致正例通过。它证明当前谓词允许不同创建身份，不测量真实Windows中PID复用的发生概率，更不声称已在用户系统误杀。

## 下一轮只改这一判据和对应QA

1. 继续保留当前字段/完整路径/根子动作前核验的全部修复。规范化后创建身份必须严格相同；不同即mismatched，不要改成另一个宽限区间。若后续发现真实协议精度差异，应另附同一OS身份的双格式证据并设计无歧义的表示，不能在本轮凭空容忍一秒。
2. `qa/verify-eighth-review-probes.mjs`中“当前01:00:00.000、预期01:00:00.500仍controlled”的断言应改为拒绝；合法一致正例使用同一epoch。补1/500/1000/1001ms差值及根/子链路，任何不同均零强杀并保留，完全一致正常收尾。
3. 补同一时刻的WMI/ISO/带时区ISO等值格式，证明是表示规范化而非时间范围；原八审4例、七审3例、前轮8门禁及历史回归保持。

交`docs/DETACHABLE_APPEARANCE_P1A_NINTH_REPAIR_DELIVERY_20261018.md`。只撤回这一新增放宽，不重写模块或扩大矩阵，不安装或开可见窗。已排队的[日常滚动/壁纸清理锁](DAILY_SCROLL_WALLPAPER_INCIDENT_TRIAGE_20261018.md)本轮未修复，仍与P1A分开交付，优先于P1B。
