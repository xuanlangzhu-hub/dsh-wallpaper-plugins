# 独立/吸附设置P1A六审：W2、W4闭合，W1解析失败与W3资源身份过滤仍待补修

2026-10-17开始复审，2026-10-18完成接续，Codex；文件名沿用本轮日期。复核[五审补修交付](DETACHABLE_APPEARANCE_P1A_FIFTH_REPAIR_DELIVERY_20261017.md)，对照[五审W1–W4](DETACHABLE_APPEARANCE_P1A_FIFTH_REVIEW_20261017.md)。**总体暂不通过；只剩R4里的W1输出解析与W3资源归属核验，不重做已闭合项，也不进P1B或安装候选。**

本轮只读实现，修改复审/接续文档；未查询或控制真实DSH/WE，未使用日常Profile，未开可见窗口、安装、提交推送或清理旧证据。Windows默认分支通过Node VM替换底层spawn/execFile执行，所有PowerShell和taskkill仅被捕获，没有实际执行。另运行独立profile的无界面Edge双Tab测试，生产窗口适配器在该测试中仍为替身。

日常基线沿用已确认的DSH0.2.1-rc.2、外观rc.35、Git Bash0.1.1；没有刷新实时播放状态，不复用历史退出确认。

## 已闭合部分与本轮证据

独立证据目录：[`.tmp/detachable-p1a-sixth-review-20261017-cb4f1e5b`](../.tmp/detachable-p1a-sixth-review-20261017-cb4f1e5b)。冻结157项输入；与五审对应输入相比，已有实现仅`detachable-edge-adapter.js`变化，另新增五审QA。最终157项输入及59项受保护资产/归档哈希均无变化，见`inputs.json`与`final-preservation.json`。

| 原项目 | 本轮结论 |
| --- | --- |
| W1 命令报错/超时保留 | 原VM的CIM执行错误现返回失败，保留record/profile；失败dispose也保留，条件恢复后可重试清理。这部分闭合。输出解析错误仍有下述余项 |
| W2 根PID已退出 | 闭合。独立VM模拟实际脚本的退出码2，跳过CloseMainWindow，继续查资源组；确认为空后成功清理。原五审fixture也不再卡在身份不符 |
| W3 查询自身/旧根强杀 | 查询自身排除、根退出后改对返回子PID发动作的部分有效；但返回PID未经受控Edge身份过滤，仍不能放行 |
| W4 存活资源dispose保护 | 闭合。原独立alive-dispose探针现在profileExists=true、owned=1、tracked=1；交付专项的后代退出后再次dispose清理通过 |

本轮通过：check、P0 15/15、P1A 5/5、五审专项5项、四审专项7项、三审专项5项、无界面双Tab11项（窗口替身spawn=3/close=3）。原`ownership-origin-probes`、`remaining-probes`与实际新SDK引导/卸载检查保持：匿名引导401、不泄露token、ctx.effect释放后无监听，原来源分表/已有目录保护/stop重试/调参队列通过。

client/index/Host/契约/伴随页/外观QA与五审冻结输入一致；沿用此前真实React挂载、正式生产页及四审外观570/英文566/选择结果，本轮不重跑这些相同输入，不把沿用记作新实测。上述通过也不代表生产原生窗口清理通过。

主要日志：`check.log`、`p0.log`、`p1a.log`、`fifth-repair-probes.log`、`fourth-repair-probes.log`、`third-repair-probes.log`、`browser-e2e.log`、`real-sdk.log`。原VM及原dispose探针结果分别在`windows-default-result.json`、`alive-dispose-result.json`。

## W3 [P1] 生产查询仍只有PID，新增过滤器未接入实际输出

位置：[查询/解析](../dsh-whale-mist/src/detachable-edge-adapter.js:120)、[过滤器](../dsh-whale-mist/src/detachable-edge-adapter.js:60)、[强制回收](../dsh-whale-mist/src/detachable-edge-adapter.js:599)。

实际生成的PowerShell仍是：

```powershell
Get-CimInstance Win32_Process -Filter "CommandLine like '%<profile>%'" -ErrorAction Stop |
  Where-Object { $_.ProcessId -ne $PID } |
  Select-Object -ExpandProperty ProcessId
```

它排除了此次查询自身，却把其余匹配者压成纯PID。生产走逐行数字解析分支，**不会调用只在JSON分支中的`isControlledEdgeProcess`**。因此任何其它命令行仅提到该路径的PowerShell、日志程序或其它profile前缀相同的进程仍会成为`groupStatus.pids`；Phase 2不再核对身份，直接对这些PID发taskkill。把强杀目标从旧根改到这个列表，解决了旧根无效的问题，但没有解决列表是否属于本轮Edge的问题。

本轮`windows-adversarial-probes.mjs`走真正默认Windows分支（VM的default spawn/execFile是底层IO替身），给CIM返回一条无关PowerShell记录：命令仅`Write-Output '<profile>'`，没有`--user-data-dir`。按照实际生成命令输出其PID；适配器随后向该无关PID `987655001`发出`taskkill /PID ... /F`，再报告close成功。**这是捕获到的错误命令选择，不是已经在用户系统误杀了进程。**

此外，即使以后仅将输出改成JSON，现有过滤器也不够：

- `cmd.includes('--user-data-dir='+dir)`把`<dir>-other`当作本轮目录；没有完整参数边界。
- 可执行体不等于msedge时，只要名称含`edge`仍会通过；独立JSON fixture中的`knowledge.exe`被接受。
- 缺失CommandLine时跳过参数验证，无法用当前字段证明本轮归属。

这三点是新增JSON解析路径的补充fixture，不混称当前PowerShell实际输出。前两个已在探针中复现错误taskkill选择。强杀前也没有针对候选PID的当前身份再次验证，不能把裸PID列表称为“已核验的受控子进程”。

补修要求：让**默认系统命令实际返回可校验的进程快照**，包含PID、创建身份、可执行体和命令行；生产匹配使用完整可执行体身份和精确的`--user-data-dir`参数值，并区分非本轮资源与身份信息不足。仅提及路径、前缀碰撞、非Edge、字段缺失不能获得强杀权限。最终动作前核对仍是本轮同一存活资源，PID复用/查询失败则不发动作，保留未确认状态。保留已通过的自身排除与根已退出处理。

## W1 [P1] 无法解析的输出仍被当空集，未知状态下删除profile

位置：[结果解析](../dsh-whale-mist/src/detachable-edge-adapter.js:155)。

命令执行错误现在正确返回`ok:false`，但JSON.parse异常被空catch吞掉，继续尝试逐行`parseInt`；任何不能解析的行直接过滤。最后仍返回`ok:true,pids:[]`。因此“非空但无法解析”仍被解释成“成功且资源组为空”，没有满足五审已要求的解析失败保留。

独立VM分别注入成功退出但stdout为`not a process result`与截断JSON：两例都得到close.ok=true、profileExists=false、record/owner清空。它们只证明解析分支有此错误，不声称当前Windows已经产生了这些输出。相同探针的CIM命令错误则正确保留，清楚区分本次已修与余项。

补修要求：采用明确且可验证的输出协议。合法空集与命令/解析/结构校验失败必须分开；格式不符、截断、非法PID、缺失归属字段不得悄悄降级为空集或已核验资源。未知时close/dispose继续失败保留，协议恢复、确认为空后再清理。不要通过删掉负例或只替换`inspectResourceGroup`来证明通过。

## 小G下一轮范围与验收

只补上述W1、W3，交付`docs/DETACHABLE_APPEARANCE_P1A_SIXTH_REPAIR_DELIVERY_20261017.md`。W2/W4、EBUSY重试及R1/R2/R3/R6保持，不调整UI、主题、原生采集或日常包。

共用一个有超时的底层命令runner和一个生产进程快照/归属解析链路，让默认Windows实现与测试执行相同判断。交付称“所有Windows系统操作都走runExec”目前也不准确：taskkill两处分支仍直接调用execCommand，未带该runner的超时。这项随同现有W3边界统一，不另扩专项。

验收负例至少覆盖：无关进程提及profile、精确参数前缀碰撞、非Edge/身份字段缺失、PID复用、无效或截断输出；均不能误发关闭/强杀或未知删目录。同时保留合法空集、根已退出、实际受控后代回收、命令错误/超时、存活失败dispose保留与条件解除后清理。

可复跑本轮`windows-adversarial-probes.mjs`及`safety-gate.mjs`，另有原探针不变副本。前者退出0表示**缺陷复现断言成立**，不是验收通过；后者按安全期望判断，当前8项中5项失败，详见`safety-gate-result.json`。修后按新的明确输出协议适配底层IO fixture，不把旧fixture输出格式不适配当产品缺陷；也不只使用正整数PID成功fixture来声称过滤已接入。离线复审通过后再另行整合候选与约实机。
