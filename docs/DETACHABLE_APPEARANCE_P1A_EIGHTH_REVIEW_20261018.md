# 独立/吸附设置P1A八审：旧三例闭合，W3仍需补齐创建身份与完整程序路径

2026-10-18，Codex。复核[七审补修交付](DETACHABLE_APPEARANCE_P1A_SEVENTH_REPAIR_DELIVERY_20261018.md)，对照[七审报告](DETACHABLE_APPEARANCE_P1A_SEVENTH_REVIEW_20261018.md)。**原三个动作前PID复用负例已通过，根/子共用JSON核验有效；总体暂不通过，仅余W3身份字段缺失仍放行、完整程序路径未比对两处。** 这是七审已要求的“身份不足不能获得动作权限”与“同名不同路径”边界，不重做已通过流程，也不扩UI。

本轮未改实现、安装、提交推送、清理旧证据或查询/操作日常DSH/WE。默认Windows分支在Node VM中替换底层spawn/execFile，无真实PowerShell/taskkill或可见窗；双Tab为独立profile无界面浏览器，生产窗口适配器仍是替身。日常仍沿用DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，未刷新现场状态。

## 已通过与证据

目录：[`.tmp/detachable-p1a-eighth-review-20261018-34fd55e6`](../.tmp/detachable-p1a-eighth-review-20261018-34fd55e6)。冻结159项输入；相对七审对应输入只改adapter，另新增七审QA。159项输入及59项受保护资产/归档最终哈希无变化。

- **七审原3例闭合**：原`pre-action-identity-probes.mjs`不改fixture复跑，sub-shell/sub-prefix/root三例均close=false、forced=[]、profile保留；根/子均实际执行动作前查询。原门禁退出0，结果在`pre-action-identity-result.json/log`。
- **前轮8项门禁保持**：错误/异常输出保留、根已退出、自身排除、无关提及、前缀碰撞与非Edge程序均通过，见`windows-adversarial-result.json`、`safety-gate.log/json`。
- 创建时间明确不同的记录能拒绝；Name与ExecutablePath基础名矛盾能拒绝；未知或mismatched后本次close保留profile的结构有效。
- check、P0 15/15、P1A 5/5、七审专项、六审专项、五审5项、四审7项、三审5项、双Tab11项均退出0；原独立alive-dispose/ownership-origin/remaining和实际新SDK引导/卸载保持。
- client/index/Host/契约/伴随页/外观QA未变；真实React/生产页面及外观570、英文566、选择沿用已有证据，不记成本轮新实测。

日志包括`check.log`、`p0.log`、`p1a.log`、`seventh-repair.log`、`sixth-repair.log`、`fifth-repair.log`、`fourth-repair.log`、`third-repair.log`、`browser-e2e.log`、`real-sdk.log`。

## W3-A [P1] 创建身份缺失或无法解析时，严格比较被跳过

位置：[parseCreationDate](../dsh-whale-mist/src/detachable-edge-adapter.js:80)、[创建身份判断](../dsh-whale-mist/src/detachable-edge-adapter.js:175)、[子动作前调用](../dsh-whale-mist/src/detachable-edge-adapter.js:879)。

当前逻辑只有在expectedCreationDate为真、且currentMs/expectedMs都不为null时，才检查是否不同：

```javascript
if (expectedCreationDate) {
  const currentMs = parseCreationDate(proc.CreationDate);
  const expectedMs = parseCreationDate(expectedCreationDate);
  if (currentMs !== null && expectedMs !== null && currentMs !== expectedMs) {
    return { status: 'foreign-recycled' };
  }
}
return { status: 'controlled', pid, proc };
```

因此“缺少/解析不了当前创建时间”“没有可用的预期创建时间”都会落到controlled。扫描阶段同样未要求CreationDate有效，缺失的快照可以进入subProcessSnapshots；调用方传undefined后整个日期分支被跳过。校验机制虽然已建立，但缺失关键身份并没有成为未知状态。

新增`incomplete-identity-probes.mjs`沿用原VM默认生产分支，只改变进程记录字段：

| 情况 | 预期 | 实际 |
| --- | --- | --- |
| 扫描有合法创建时间，动作前CreationDate缺失 | 未知，禁止强杀并保留 | 发taskkill /F，随后close=true |
| 扫描有合法创建时间，动作前CreationDate为invalid-creation-time | 未知，禁止强杀并保留 | 同上 |
| 扫描快照已缺CreationDate | 不能建立强杀身份基线 | 仍进入动作，发taskkill /F，close=true |

这三例说明缺字段的安全边界未满足，不表示真实系统已经返回这些数据或发生误杀。实际CIM数据可用性/格式应由明确协议验证，不能以“正常一般都有”绕过检查。

补修：将“建立有效基线”和“按基线核验”分开。扫描/首次登记必须取得可解析且有效的OS创建身份才能给本轮资源建立可操作基线；动作前必须取得有效当前身份并严格比对。任一侧缺失、损坏、数值非有限、协议不符，应返回insufficient-info/error，禁止动作并保留记录/profile。不要把缺失当matched，也不要伪造Date.now作为OS身份。合法不同身份仍mismatched，合法一致才matched。

## W3-B [P1] ExecutablePath只取basename，同名不同目录仍获强杀权限

位置：[基础名提取](../dsh-whale-mist/src/detachable-edge-adapter.js:117)、[可执行体匹配](../dsh-whale-mist/src/detachable-edge-adapter.js:140)。

classify先把ExecutablePath与expectedExecutable都取basename，后续所谓exeMatches只比较`msedge.exe`/`msedge`。Name与路径基础名一致也不等于路径与所发现的Edge一致。因此已知预期为`C:\Synthetic\msedge.exe`时，`C:\ForeignApplication\msedge.exe`仍会被认作受控。

独立第4例将子进程扫描与动作前记录都设置为上述非预期路径，其他字段合法且一致；根记录不改。生产扫描接受、动作前接受、对该子PID发taskkill /F，最终close=true。该fixture用来检查路径契约，不声称真实Edge路径曾发生变化。

补修：既然发现阶段已绑定完整可执行路径，扫描和动作前必须按Windows路径规则核对该身份；Name只做一致性辅助，不能替代路径。ExecutablePath缺失不能靠Name补成已核验；如确需支持经验证的路径别名/规范化，明确依据和允许集合，不能放宽成任意同名文件。测试补同名不同目录、仅Name无完整路径、Name/路径矛盾及合法规范化相等。

## 测试边界及下一轮完整验收

`incomplete-identity-result.json/log`保存4例实际命令选择；安全门禁退出1，4/4失败。全程nativeProcessesTouched=0，所删目录仅为fixture自己新建的空profile。不能把上面已有专项全绿扩称所有身份边界通过。

还有一个需随同清理的测试协议分叉：`checkWindowsProcessIdentity`在empty stdout时，对注入execCommand直接matched，对默认execFile则not-found（370–376行）。这使旧fixture可以不提供身份记录却通过严格检查。修改身份契约时应统一两条路径，以“底层I/O替身、相同解析判断”为原则更新旧fixture，避免为保留绿灯设置测试专用放行。根PID不存在应通过明确not-found协议表达；当前脚本查无PID会exit 2，不应把任意缺记录的成功输出视为完整身份凭据。

下一轮仅补上述W3字段完整性和路径身份，交`docs/DETACHABLE_APPEARANCE_P1A_EIGHTH_REPAIR_DELIVERY_20261018.md`。建议一次覆盖下表，减少只测已知失败样例造成的反复：

| 维度 | 必测 |
| --- | --- |
| 根/子 | 两条动作分支都跑实际默认判断；旧3例继续通过 |
| 创建身份 | 基线/当前各自缺失、null、无法解析、合法不同、合法一致、支持的WMI/ISO格式 |
| 程序身份 | 完整预期路径相同、同名不同目录、路径缺失、Name/路径矛盾 |
| 查询结果 | 明确不存在、命令失败/超时、空/异常结构、返回记录PID必须对应被查询PID |
| 清理状态 | 未知/改变时零强杀并保留；证据恢复后可重试；合法资源正常清理；EBUSY保持 |

其中“返回PID对应查询PID”是同一身份协议的校验要求；七审QA的合法子用例目前对任意ProcessId查询都返回子PID，调整严格契约时需同步纠正fixture，不以此旧输入阻止实现。先用有效记录证明正常根/子可收尾，再验证每种缺字段只得到明确未知。

W1/W2/W4/EBUSY及R1/R2/R3/R6保持，不重做UI/原生采集，不打包安装或开可见窗。已排队的[日常滚动/壁纸清理锁](DAILY_SCROLL_WALLPAPER_INCIDENT_TRIAGE_20261018.md)本轮未修复，仍与P1A独立交付、优先于P1B。
