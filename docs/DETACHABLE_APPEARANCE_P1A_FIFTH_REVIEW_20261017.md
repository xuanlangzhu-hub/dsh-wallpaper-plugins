# 独立/吸附设置P1A五审：关窗结构和EBUSY重试改善，默认Windows资源核验仍有缺口

2026-10-17，Codex。复审[四审补修交付](DETACHABLE_APPEARANCE_P1A_FOURTH_REPAIR_DELIVERY_20261017.md)，对照[四审报告](DETACHABLE_APPEARANCE_P1A_FOURTH_REVIEW_20261017.md)。**总体仍暂不通过；剩余继续限定R4默认Windows资源核验与失败保留，不重做其它模块。**

本轮未修改小G实现、未查询/操作真实DSH或WE、未使用日常Profile、未创建可见Edge App窗口。新增默认Windows分支检查在独立Node VM中替换底层spawn/exec，PowerShell/taskkill均未实际执行；文件操作只涉及本轮隔离测试目录。未提交推送或清理旧证据。日常基线仍沿用上轮交接DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，不复用历史现场状态作为新授权。

## 已确认的改善与证据范围

独立目录`.tmp/detachable-p1a-fifth-review-20261017-b39eaa0d`，冻结156项输入。

- 生产代码已加入正常关窗请求、资源组检查入口、句柄代次核对及清理状态拆分，旧交付的测试边界误述也已修正。
- `qa/verify-fourth-review-probes.mjs`原7项通过，**已终止进程的EBUSY目录归属保留及close/dispose重试子项闭合**。新正常关闭/资源组状态机在注入钩子下有效，不再笼统说“什么机制都没实现”。
- 三审原`ownership-origin-probes.mjs`仍通过：实际index来源分表、已有目录保护、停止失败后重试保持。
- check、P0 15/15、P1A 5/5、旧双Tab11项（替身spawn/close各3）退出0；实际SDK普通引导/卸载、真实React挂载、正式生产伴随页握手/调参95/0保持。
- client/index/Host/契约/伴随页和原外观QA均与四审输入字节一致，沿用四审外观单独复跑570、英文566及选择结果，不机械重跑整套外观矩阵。

**覆盖缺口**：专项把`requestWindowClose`、`inspectResourceGroup`、`verifyProcessIdentity`、`forceTerminateResourceGroup`整体替换为成功/失败钩子；替换spawn还会令`isMockSpawn=true`，进一步绕开默认Windows身份/查询代码。本轮新增`windows-default-probes.mjs`让适配器在VM中走`isMockSpawn=false`的原始生产分支，仅替换底层系统调用，故不会接触真实进程。结果在`windows-default-result.json`；另有`alive-dispose-probe.mjs/json`。

## W1 [P1] 系统查询错误被转换为空集合，未确认资源退出也能删除目录

位置：`src/detachable-edge-adapter.js:59`、`:72`、`:420`和`:430`。

`queryWindowsProcessesByProfile`遇到exec错误、超时或空输出都返回`[]`；`performResourceGroupInspection`又把空集合当作`alive=false`。因此无法区分“查询成功且没有残留”和“查询失败、不知道还有什么”。外层catch也继续落到无存活结果，不符合失败时保留资源的门禁。

默认Windows分支探针：身份检查成功、正常关闭使根child exit，随后CIM查询注入失败。实际结果`closeOk=true/processTerminated=true`，记录和目录全部删除。整个过程未取得资源组清空证据；未声称真实系统中已发生孤儿进程。

补修：资源检查必须区分成功有残留、成功无残留、查询失败/未知；错误、超时、无法解析输出一律保留owner/profile并返回明确未确认，不能降级为空数组。使用有结构且可校验的结果，不把任意空stdout当查询成功。补默认命令执行/输出解析分支的错误与超时负例，不只给inspect钩子返回预设对象。

## W2 [P1] 用户先关掉根窗口后，被判成PID身份不符而不能清理

位置：`src/detachable-edge-adapter.js:90`、`:359`和`:369`。

身份验证在任何资源检查前，无条件要求根PID当前仍有匹配命令行。若用户已经正常关闭独立窗口，根进程不存在是可预期的生命周期状态；当前命令返回非0后直接`pid-identity-mismatch`，资源组检查一次也不做，目录和记录持续保留。重试仍查不存在的根PID，无法恢复。

默认Windows分支探针：spawn后先发child exit，再模拟根PID不存在；得到`closeOk=false/error=pid-identity-mismatch`、resourceQueries=0、tracked=1、owned=1。该分支对应正常手动关窗/根先退出后的收尾，已有“根活着→发关闭请求→退出”的钩子测试不覆盖它。

补修：明确区分根仍匹配、根已不存在、根被其它进程复用、身份查询失败。根不存在时不对旧PID发动作，继续检查本轮已绑定的其它窗口/后代；资源组成功确认为空后才清理，未知则保留。身份不匹配仍拒绝操作陌生进程，不能为修此项把校验直接删掉。

## W3 [P1] profile子串扫描会纳入查询自身，强制回收仍对已退出的旧根PID发动作

位置：`src/detachable-edge-adapter.js:59`与`:443`–`:453`。

当前PowerShell命令行本身就包含profileDir，CIM只按`CommandLine like '%profileDir%'`筛选，没有限制受控Edge可执行体、解析精确`--user-data-dir`参数或排除查询者。查询程序的命令行会符合这个子串条件；其它仅提及该目录的进程也可能混入。需把这种情况列入受限进程快照fixture，而不是只假定查询回来的都是本轮Edge资源。

本轮默认分支捕获实际生成命令，确认其中包含本轮profile；给底层返回“查询者PID”fixture，资源检查便认作残留。随后虽然groupStatus已是`rootAlive=false/subAlive=true`，强杀却仍忽略返回的pids，对旧根`taskkill /PID <record.pid> /T /F`。探针命令序列显示根已exit后仍针对其旧PID；没有强杀前重新确认OS身份。这里未执行真实WMI或taskkill，也不把fixture结果称为真实Windows测量。

补修：查询输出应携带PID、实际创建身份、可执行体及受限参数/归属所需信息，由生产代码做精确匹配，排除查询进程/非本轮资源。强制回收只能针对经过当次核验的本轮存活资源；根已不存在不能再靠旧根PID/T回收现存后代，防止PID复用误伤。补查询自身、无关命令提及profile、根先退出/子资源仍在及PID复用负例。

## W4 [P1] 资源组仍存活时dispose再次删除profile，破坏失败保留

位置：`src/detachable-edge-adapter.js:585`、`:612`–`:613`。

close遇到`resource-group-still-alive`会正确保留记录/profile。但dispose把该PID记到failedProcesses，只有`processTerminated`分支才把目录记到failedDirs；随后遍历ownedProfileDirs时仅排除failedDirs，于是仍对**活着的失败资源**调用cleanupProfileDir。此处重新引入“进程未退出也删除profile”的问题。

独立探针让inspect始终返回后代存活：第一次close失败且保留；调用dispose后返回`some-processes-failed-to-close`、tracked=1，但profileExists=false、ownedProfileCount=0。真实进程均为事件替身，目录仅是本探针新建的空目录。

补修：所有尚未确认终止的记录对应目录都禁止删除；失败/未知资源与已终止但仅目录删除失败分别保留。dispose中的目录补扫只能处理没有存活/未知拥有者且能证明属于本轮的目录。补顽固后代close失败→dispose仍保留→条件解除后确认退出并清理的完整链路。保留本轮EBUSY重试已通过的成果。

## 建议的本轮收敛方式

将Windows系统调用、结果解析和资源归属判定作为一个可注入但默认生产实现完整的边界，共用一个命令runner/有结构的进程快照；当前身份与扫描直接用defaultExecFile，而其它阶段用execCommand，导致测试容易绕过真实分支。测试应替换底层IO并让实际生产判断运行，覆盖成功/不存在/身份不符/错误四种状态，避免整体替换inspect/verify后只证明上层状态机。

只修W1–W4，仍属于既定R4资源确认/保留，不扩UI/P1B，不改变已通过R1/R2/R3/R6或原生采集。写`docs/DETACHABLE_APPEARANCE_P1A_FIFTH_REPAIR_DELIVERY_20261017.md`，逐项给默认Windows逻辑与失败重试证据；原7项继续保持。无需操作真实DSH/WE或打开可见窗口来修这些默认分支。离线复审通过后另整合候选、另约实机。
