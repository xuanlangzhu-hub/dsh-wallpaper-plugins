# 独立/吸附设置P1A二审：部分闭合，收窄补R1/R4/R6余项

2026-10-17，Codex。复审[补修交付](DETACHABLE_APPEARANCE_P1A_REPAIR_DELIVERY_20261017.md)，对照[首审R1–R6](DETACHABLE_APPEARANCE_P1A_REVIEW_20261017.md)。**结论仍暂不通过，不打包安装或进入P1B；已经成立的修复保留，只补本文余项。** 本轮没有改小G实现，没有查询/操作真实DSH、WE或日常Profile，没有创建可见原生窗口、提交推送或清理旧证据。日常基线沿用已交接的DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，不假定当前播放状态。

## 已确认的改善

| 首审项 | 本轮结论 |
| --- | --- |
| R1匿名引导泄露 | 已闭合此子项。原探针及实际新版Cordis/HostConnectionService补查均401、不返回mainToken；index注入也不再含秘密。origin收口仍见下文 |
| R2启动规格/页面/实例参数 | 原三个断点已修正。正式生成URL为/index.html且200，实例参数一致；适配器能越过原规格解析断点。生产规格的临时目录生命周期余项归R4，不重开已修正的404/参数问题 |
| R3React循环更新 | 原实际React19.2.0挂载探针通过，snapshotStable=true、errors=[]、headerPresent=true。保留此修复；不扩称所有面板布局/键盘已验 |
| R4原负例 | 未登记PID不再生成taskkill，已收到exit的child不重复taskkill，dispose报错时能保留记录/profile；这三点保持。生产组合及退出确认仍不完整 |
| R5普通fiber卸载 | 原实际SDK探针在普通无窗卸载后监听数0，旧永久监听泄漏已修正。异常窗口清理/等待和结果传递随R4补，不把普通分支等同全部生命周期通过 |
| R6合法遮罩0 | 单次0输入已正确发送。新增队列的无变化输入及跨字段在途问题仍见下文 |

还补了**正式生产页面**浏览器检查：直接使用正式Host生成的appUrl加载正式HTML/ESM，实际完成握手、URL去掉查询凭据，DOM range input把主端真实controller改为brightness=95、mask=0。主端由隔离fixture手动引导、窗口adapter替身；该证据比只给app塞customTransport更强，但仍不等于真实DSH入口/Edge顶层窗实机通过。

## R1余项 [P1] 通过扩大来源范围解决403，未做到本轮可信入口绑定

位置：`src/detachable-host.js:256`及主端loopback分支。

当前`orig === 'dsh-app://app' || orig === 'null'`在判断路由前直接放行，因此**伴随端`/api/action`也接受任意opaque/null来源的预检**，并非交付所称“仅主端开放、其它接口严格限定本轮activePort”。此外`/api/main/*`接受localhost/127.0.0.1/::1的任意端口，没有绑定本轮实际Desktop origin。

本轮对隔离服务的实际OPTIONS结果：

| 路由 | Origin | 结果 |
| --- | --- | --- |
| /api/main/connect | null / dsh-app://app / 另一个loopback端口 | 均204 |
| /api/action | null / dsh-app://app | 均204 |
| /api/action | 另一个loopback端口 | 403 |

此结果**不意味着匿名请求已绕过token/lease鉴权**；匿名引导泄露的修复确实保留。剩余缺陷是额外origin防线被扩大，且违背首审明确要求“不任意放开null”。不能把全部预检从403变204当作生产来源接通验收。

新版官方只读证据中，`audit-source/lib/main.js`的`forwardWebRequest`会将主应用同源请求转给原Host、去除origin并带Host cookie；主renderer正式承载是dsh-app://app。可以利用已核实的正式受认证引导/代理，或为需要跨origin的通道传本轮精确origin配置，不能猜测所有localhost/null都可信。

补修：按路由和本轮承载明确区分主通道/伴随通道，只允许所需精确origin；没有真实需求和身份绑定就拒绝null。补foreign/null/不同端口负例及真实浏览器注册正例，保留fail-closed鉴权，不扩大为CORS *。

## R4余项 [P1] 生产预构建规格丢失profile归属，关闭失败仍可能被写成成功

### A. 正式Host路径创建的目录不计入owned集合

位置：`src/detachable-edge-adapter.js:101`和`:123`。

生产Host先构建spec，spec始终已有profileDir。adapter把它直接作为dedicatedProfileDir，于是`isDedicatedTemp=false`，即使目录由本轮`mkdir`实际新建，也不会登记ownedProfileDirs。孤立adapter测试用“不带profileDir的原始参数”，绕开了生产分支。

本轮**正式Host＋真实adapter（只替换Edge发现/进程IO）**：detach成功、ownedCountAfterSpawn=0；吸附返回成功且trackedAfterDock=0，但本轮目录仍存在。它也按main instance生成固定目录，不能据此宣称“每轮由Host/adapter创建并正确回收独享目录”。

补修：选择唯一创建者，明确预构建规格与目录创建/所有权转移契约；只登记本轮确实创建的目录，不能为补计数把任意传入路径直接标为owned。覆盖正式Host生成spec的成功关闭、创建失败和重开生命周期。

### B. taskkill回调成功并非完整退出确认

位置：`src/detachable-edge-adapter.js:200`、`:226`、`:244`。

仍以child.kill作为“正常关闭”，taskkill回调无错误即`terminated=true`，然后删除记录/profile，没有确认本轮进程树/窗口是否真正退出。原要求的强身份与Edge launcher/实际窗口归属也尚未实现。

替身故意不给child exit，模拟taskkill回调成功：close仍ok=true、trackedProcesses=0、profile已删，childExitObserved=false。这是对**未确认分支**的确定复现，不声称已在真实Edge上观察到残留。已退出child跳过taskkill的补修有效，但不能代替仍存活/多进程场景的身份和退出确认。

补修：实现正常窗口关闭路径及绑定本轮身份的完整退出确认，超时/不能确认则保留句柄与目录，允许明确重试；不新增盲关或真实kill实验。Edge首个child exit不能单独证明所有资源已终止。

### C. Host忽略adapter返回的明确失败

位置：`src/detachable-host.js:190`、`:1173`及`src/index.js:231`。

adapter现在可能返回`{ok:false,error:'unowned-handle'}`，Host的performWindowCleanup只`await close()`，没有检查结果便清掉owner。用替身返回这个失败，实际主端requestDock结果仍ok=true、Host为docked、owner丢失、unconfirmedCleanup=false。stop同样忽略dispose返回的ok:false；上层cleanup还吞异常，effect返回函数调用cleanup却未返回其Promise。

补修：统一close/dispose结果契约，任何明确失败或未确认都不能清所有权/宣称docked；把可重试失败向上保留并可见。SDK cleanup返回并等待实际cleanup Promise，处理初始化中卸载/重复卸载。R5普通监听分支不重做，补的是有窗口/失败/异步收尾的真实结果传递。

## R6余项 [P1] 新队列在无变化输入后永久卡住，跨字段仍丢失最后意图

位置：`src/companion/companion.js:113`、`:117`、`:149`、`:153`。

### A. 同值路径同步结束，留下已经完成的Promise占位

worker是立即执行的async函数。如果target恰等于当前值，循环没有await，就先在finally删队列项；随后外层才`inFlightPromises.set(key, workerPromise)`，把已完成的Promise重新存进去。下次该字段输入只返回此Promise，不再启动worker。

实际生产app＋受限transport替身：初始brightness=70，依次`handleBrightnessChange('70')`、`handleBrightnessChange('95')`，发送动作列表为空，确认亮度一直70。不是只测非法输入或猜测时序；同值是正常可达操作。

### B. 按字段串行不能保护全局revision

brightness和mask各有独立worker，但共用同一个权威revision。两个字段在前一请求未确认时都携带revision=1发出，第一项确认到revision=2，第二项stale-revision后break，不重发仍有效的最新用户意图。

隔离复现：同时要求brightness=95、mask=0，实际发送两项expectedRevision都1，最终权威值为95/55，mask=0丢失。单字段快速三次输入不覆盖跨字段争用；交付“最终意图必然执行”目前不成立。

补修：worker占位/清理顺序保证同步结束路径也可再启动；以共享revision设计跨字段动作调度，冲突后仅按最新确认快照重放仍有效的最新意图，禁止乱序重试过期请求。补同值→新值、单字段合并、两字段交错、失败/断线再输入的实际确认值检查。单次遮罩0解析已闭合，不回退该修复。

## 检查与交付要求

独立证据：`.tmp/detachable-p1a-second-review-20261017-961b5891`，152项输入冻结。原三套复审探针逐项重跑：匿名401、React稳定、普通SDK卸载无监听；`boundary-probes.json`保留真实结果，其中adapterError=`spawn-failed: must-not-spawn`为故意阻断实际spawn，说明原字段断点已越过，不能记为真实开窗成功。新增`production-page-probe.mjs`、`remaining-probes.mjs`及各JSON/log覆盖本报告。

- check、P0 15/15、新P1A 5/5及旧headless双Tab11项（spawn=3/close=3）退出0。
- 外观570、英文566及scene-selection退出0，原harness不等同React挂载。
- 实际React19.2.0使用上轮固定测试依赖；实际新版Cordis/HostConnectionService来自原只读提取。SDK认证后端/DSH服务与窗口进程IO仍有替身，不称全真实宿主验收。
- 原始输出保留，不为凑“全修好”修改旧探针预期或把打印结果当断言。

交小G只补R1/R4/R6余项，保留R2/R3、R5普通卸载及原P0七审成果。不扩大P1B、不重编原生、不改版本或打包安装；写`docs/DETACHABLE_APPEARANCE_P1A_SECOND_REPAIR_DELIVERY_20261017.md`，逐项给生产组合、负例与实际最终状态证据，再由用户转Codex复审。

收尾：152项冻结输入和59项既有资产/归档指纹保持，报告链接有效，`git diff --check`退出0（仅既有换行提示），见`final-preservation.json`。活动入口已更新，未修改交付实现或上轮原始证据。
