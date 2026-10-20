# 独立/吸附设置P1A七审：W1闭合，W3仅余动作前身份核验

2026-10-18，Codex。复核[六审补修交付](DETACHABLE_APPEARANCE_P1A_SIXTH_REPAIR_DELIVERY_20261017.md)，对照[六审报告](DETACHABLE_APPEARANCE_P1A_SIXTH_REVIEW_20261017.md)。**总体暂不通过；W1闭合，W3扫描过滤已改善，只补根/子资源动作前的严格身份复核。** 不重做已经通过的解析、UI、Host或其它生命周期修复。

本轮未修改实现、安装、提交推送、清理旧证据、查询/操作日常DSH/WE或使用日常Profile。Windows检查在独立Node VM中执行默认生产分支，只替换底层spawn/execFile，未执行真实PowerShell/taskkill。双Tab回归仅使用独立profile的无界面Edge，生产窗口适配器仍为替身，不算真实独立窗验收。日常基线仍沿用DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，未刷新实时播放状态。

## 已通过的部分

证据目录：[`.tmp/detachable-p1a-seventh-review-20261018-cf530799`](../.tmp/detachable-p1a-seventh-review-20261018-cf530799)。冻结158项输入；相对六审对应输入，修改为adapter与五审QA，另新增六审QA。158项输入及59项受保护资产/归档最终哈希无变化。

- **W1闭合**：删除逐行parseInt回退；非空异常文本、截断JSON、结构/字段不足均保留未知状态。独立复跑六审相同语义fixture，8项安全门禁现在全部通过，见`windows-adversarial-result.json`、`safety-gate.log/json`。原复现脚本仅去掉了“期待旧缺陷存在”的断言，fixture未变。
- **W3扫描部分有效**：默认查询实际输出JSON元数据，调用生产分类器；查询自身、无关shell提及、目录前缀碰撞、knowledge.exe等原负例通过。taskkill已统一走带超时runner。这些成果保留。
- W2根已退出、W4失败dispose保护、EBUSY重试及R1/R2/R3/R6保持。check、P0 15/15、P1A 5/5、六审QA（8项门禁及2项附加场景）、五审5项、四审7项、三审5项、双Tab11项（替身spawn=3/close=3）均退出0。
- 原独立`alive-dispose`、`ownership-origin`、`remaining`与实际新SDK引导/卸载通过；SDK匿名引导401、不泄露token、ctx.effect释放后无监听保持。client/index/Host/契约/伴随页/外观QA未变，真实React/生产页面及外观570/英文566/选择沿用已有证据，不记为本轮新实测。

主要日志：`check.log`、`p0.log`、`p1a.log`、`sixth-repair.log`、`fifth-repair.log`、`fourth-repair.log`、`third-repair.log`、`browser-e2e.log`、`real-sdk.log`。

## W3 [P1] 扫描用了严格过滤，动作前却仍退回profile子串检查，根分支还跳过复核

位置：[身份检查](../dsh-whale-mist/src/detachable-edge-adapter.js:298)、[根强制回收](../dsh-whale-mist/src/detachable-edge-adapter.js:730)、[子强制回收](../dsh-whale-mist/src/detachable-edge-adapter.js:744)。

新加的子进程pre-action调用`checkWindowsProcessIdentity`，但该函数仍生成：

```powershell
$p = Get-CimInstance Win32_Process -Filter 'ProcessId = <pid>' -ErrorAction SilentlyContinue
if ($null -eq $p) { exit 2 }
elseif ($p.CommandLine -like '*<profile>*') { exit 0 }
else { exit 1 }
```

这一步没有使用刚补好的`classifyProcessRecord`，没有精确检查可执行体和完整user-data-dir参数，也没有获取/对比进程创建身份。因此扫描时受控、动作前已变成无关进程的PID，只要新命令行仍提到该路径，就被返回matched并交给taskkill。前一步的严格扫描不能证明后一步数字PID仍指向同一资源。

根分支问题更直接：`groupStatus.rootAlive`为真便执行`taskkill /PID <root> /T /F`，没有对应的动作前复核。close最初的身份检查发生在CloseMainWindow、等待及资源扫描之前，不能替代这次动作的核验；同时rootAlive包含由child事件缓存推导的状态，不能当作当前OS身份凭据。

### 独立默认Windows分支复现

新增`pre-action-identity-probes.mjs`，替换底层IO，保留完整生产判断。过程表fixture先给出合法受控快照，然后在动作前切换为PID复用后的当前记录；身份命令的返回根据**实际发出的`CommandLine -like`条件**计算，未直接把复用场景预设为mismatched。结果在`pre-action-identity-result.json`，安全期望门禁退出1，3/3失败：

| 场景 | 动作时实际记录 | 适配器选择 |
| --- | --- | --- |
| 子PID被shell复用 | powershell.exe，仅Write-Output原profile | 再查1次身份仍matched，对该PID发/F |
| 子PID被不同profile的Edge复用 | msedge.exe，user-data-dir为`<profile>-other` | 再查1次身份仍matched，对该PID发/F |
| 根PID在资源快照后复用 | powershell.exe，仅提及原profile；child退出通知尚未反映到记录 | 快照后身份查询0次，对该PID发/T /F |

三例都在替身报告动作后空集时返回close.ok=true。**捕获到的是错误的命令选择，没有在用户系统杀进程；fixture也不是对真实Windows竞态发生率的测量。** 根fixture刻意使本地退出通知晚于快照，检验代码能否避免依赖旧record/裸PID，不能据此声称正常路径必然发生。

### 为什么交付中的PID复用探针没有发现

`qa/verify-sixth-review-probes.mjs`的Probe 10在查询指定子PID时直接返回退出码1（recycled）；这能证明上层收到mismatched会跳过taskkill，但不能证明**生产身份谓词能认出复用后的真实记录**。若新记录仍包含profile子串，实际脚本返回的是0。Probe 9也只返回预设matched。需要保留这两项上层测试，并补当前记录穿过真实解析/匹配函数的负例。

## 下一轮仅修这一处身份边界

1. 初始身份、资源扫描、动作前核验共享实际进程快照与严格归属判定。默认输出应携带CreationDate/稳定创建身份；现有查询只选择PID/Name/ExecutablePath/CommandLine，`createdAt: Date.now()`只是本地句柄代次，不能替代OS进程创建时间。
2. 对根与子资源都重新取得当前身份。核对可执行体身份、精确user-data-dir与本轮创建身份；不能再退回路径子串或仅凭同名基础名。Name与ExecutablePath矛盾、路径/身份字段不足时不能得到动作权限。必要时将核验与受限动作放在同一执行边界，尽量缩小核验后再按裸PID操作的间隙。
3. 当前不存在、身份改变、查询失败分别处理：不向陌生/未知进程发关闭或强杀；身份变化/未知需保留未确认并明确报告。确认本轮资源已退出后才收尾，不能只因扫描过滤掉复用者就吞掉已发现的身份变化。
4. 覆盖扫描后替换为shell提及、不同profile前缀、同名不同可执行路径、创建身份改变、根先退出/事件延迟、查询错误，以及正常根/子清理。测试必须替换底层IO并执行实际身份匹配，不仅让fakeExec直接报mismatched。共享分类器若对真实子资源字段存在差异，应明确验证真实快照契约，不通过取消校验来迁就fixture。

只补W3这个余项，交`docs/DETACHABLE_APPEARANCE_P1A_SEVENTH_REPAIR_DELIVERY_20261018.md`；不改已通过W1/W2/W4/EBUSY及R1/R2/R3/R6，不扩UI/P1B，不安装或开可见窗。旧fixture因明确JSON协议调整时注明语义映射，不能把格式不适配算产品失败。

另行排队的[日常滚动/壁纸清理锁](DAILY_SCROLL_WALLPAPER_INCIDENT_TRIAGE_20261018.md)没有包含在这次交付：本轮既未修复也未重新实测，不能以这次适配器QA通过替代它。仍优先于P1B扩UI，与P1A分开交付候选。
