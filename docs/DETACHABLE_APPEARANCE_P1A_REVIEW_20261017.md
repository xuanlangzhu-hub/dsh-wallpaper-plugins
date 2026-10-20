# 独立/吸附设置P1A复审：暂不通过，先补生产接缝

2026-10-17，Codex。复审[小G交付](DETACHABLE_APPEARANCE_P1A_DELIVERY_20261017.md)，依据[P1A任务](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1A_20261017.md)。**结论：暂不通过，不进入打包/安装/P1B。** 新增了生产模块和页面，但引导、启动、React挂载与关闭资源归属仍有可复现缺口；保留P0七审成果，不重写整套协议。

本轮未改小G实现，未安装、查询或操作真实DSH/WE。日常沿用已交接的DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，不把上轮“播放停止”当当前现场或新授权。下述浏览器均为独立profile的headless检查；进程终止探针全部用替身，未执行taskkill或终止真实Edge。未提交、推送、清理旧包/备份或跨会话消息。

## 证据与检查结果

独立目录：`.tmp/detachable-p1a-review-20261017-b9a9679c`。冻结149项源码/QA/脚本/配置及本轮交付与任务，见`inputs.json`和`frozen/`。复审结果不是把测试命令退出0等同生产链路通过。

| 检查 | 本轮结果与范围 |
| --- | --- |
| check | 退出0 |
| P0专项 | 15/15，退出0 |
| 原浏览器E2E | 11项，spawn=3/close=3，退出0；仍为旧fixture页面、手动引导及替身窗口，不覆盖新生产伴随页和新React入口 |
| P1A专项 | 5/5，退出0；引导鉴权接口来自自定义桩，双端同步用mock controller，DOM验证用假元素；不能称实际双视图/React/生产加载已验 |
| 外观/英文/选择 | 570/566及选择回归通过，退出0；旧功能回归保持，React调度仍不在原harness覆盖范围 |
| 独立边界探针 | `boundary-probes.mjs/json/log`，复现R1/R2/R4/R6，不接日常实例、不输出凭据 |
| 实际新版SDK补充 | `real-sdk-bootstrap-probe.mjs`及结果；实际Cordis与HostConnectionService，隔离webServer、认证后端替身；复现R1/R5 |
| 实际React挂载 | `react-mount-probe.mjs`及`react-mount-result.json`；npm固定react/react-dom19.2.0、scheduler0.27.0，包与来源日志在react-deps；实际ReactDOM、生产client组件、假DSH服务，复现R3，无真实DSH/视觉验收 |

`test:sdk-contract`交付日志仅证明此前路由登记等，不证明bootstrap鉴权或监听释放。本轮以新增实际SDK探针补这些边界，未调用官方Desktop进程。初次探针脚本的配置/解析问题修正后才形成最终结果，不计为产品缺陷。

## R1 [P1] 引导路由实际放行匿名请求，主端origin链路也未接通

位置：`src/index.js:151`、`src/detachable-host.js:254`、`src/client.js:5829`。

bootstrap只在`connection.isAuthenticated`存在时做校验，缺服务/缺方法就直接返回主端token。实际0.2.1-rc.2的`HostConnectionService`没有这个方法；`isAuthenticated`属于其认证内部对象，公开入站守卫是`requestRejection/admit`等实际接口。隔离组合**真实SDK服务**：同一匿名请求的`connection.requestRejection(req)=401`，本插件bootstrap却返回**200并包含mainToken**。P1A Test1自造`connection.isAuthenticated`，所以把错接口测成通过。

另外，Host组合没有传主端allowedOrigins。向本轮隔离服务以`dsh-app://app`、`null`及另一loopback origin发主注册预检均403。生产client直接跨origin访问新端口；旧E2E手动传fixture origin绕开了缺口。最终Desktop请求origin应沿正式boot/fetch路径证明，不能靠Node无Origin请求认定可用。

补修：用实际新版服务及明确inject/组合接缝实现fail-closed引导，服务缺失/方法不可用/未授权/已卸载均不返回秘密；index注入也要证实其真实页面访问边界。主端origin/端口引导按实际Desktop承载接通，只放行经确认的本轮可信入口，不用`*`或任意`null`放开。补实际SDK正负例、匿名index/引导检查及浏览器跨origin主注册，不再伪造所需鉴权API。

## R2 [P1] 正式Host到Edge适配器的规格不匹配，页面地址和实例参数也不匹配

位置：`src/detachable-host.js:553`、`src/detachable-edge-adapter.js:117`、`src/detachable-contract.js:215`、`src/companion/companion.js:28`。

三处独立断点已复现，需一起闭合：

1. Host先调用`buildEdgeAppLaunchSpec`，传给adapter的是`{executable,args,appUrl,profileDir,spawnOptions}`；adapter却再读`spec.hostPort/token/instanceId`构建一次。把真实Host生成的spec交给真实adapter（仅发现/进程替身）即报`invalid hostPort: undefined`，尚未进入spawn。当前检查只各自调用这两个模块，未验证组合。
2. 默认启动路径为`/whale-companion.html`，生产静态清单仅`/`、`/index.html`等；对生成URL的实际HTTP请求返回404。
3. builder生成查询参数`instance`，生产页面读取`instanceId`。把同一查询串交生产app，即使改用可加载的index页，也显示“缺少有效的一次性连接凭证”，未连接。Test5自行构造`instanceId`，掩盖了不一致。

补修：统一唯一启动规格/页面路径/参数契约，避免两次构建；异常创建也不得留下临时profile。新增从正式Host、正式adapter参数到正式HTML/ESM执行与握手的组合验证，不手工替换路径、实例参数或凭据绕过生产生成过程。浏览器依赖图加载不是检查几个资源分别200就完成。

## R3 [P1] 外层桥的getSnapshot引用不稳定，实际React挂载循环更新

位置：`src/client.js:5800`，消费者`:4995`及`:5035`。

新增`appearanceBridge.getSnapshot: () => ({...bridgeState})`被直接传给`useSyncExternalStore`，未变状态每读一次也返回新对象。本轮实际React19.2.0＋ReactDOM挂载**生产顶栏组件和实际apply创建的bridge**：`snapshotStable=false`，捕获React **#185（Maximum update depth exceeded）**，最后顶栏按钮不存在。无需点击面板就能触发。原harness的hook只调用一次getSnapshot，不会发现此问题。

补修：桥也使用稳定的不可变缓存快照，状态实质改变才换引用并通知；原controller稳定快照保持。补实际React挂载顶栏和吸附视图、重复开关、模式回调、卸载再挂载检查，验证无循环、无重复监听及可操作；不能把fixture的React stub当真实renderer。

## R4 [P1] 窗口关闭未验证归属/完整退出，dispose会丢弃失败资源

位置：`src/detachable-edge-adapter.js:180`、`:207`、`:301`。

- `close`即使在`activeProcesses`中找不到handle，也对来参PID执行taskkill。替身探针确认：未登记PID仍产生`taskkill /PID … /T /F`命令。
- 即使已登记child先发出exit，`close`仍走taskkill。退出后的旧PID可能复用，当前没有可执行路径/进程创建身份/窗口或专属profile所关联的存活树复核。替身探针确认已退出的本轮child仍生成终止命令。
- 任务要求正常关闭并确认本轮多进程资源终止；代码的`child.kill()`在Windows不能作为页面正常关闭证明，taskkill回调成功即`terminated=true`，既未再确认整棵进程/窗口状态，也没有正常窗口关闭协议。
- 更严重的是`dispose()`吞掉close失败，清空activeProcesses后继续删所有ownedProfileDirs。模拟child未退出、kill不生效、taskkill报错：dispose返回后跟踪数0、所属目录已删除，退出并未观察到。Host层还吞dispose异常，无法保留待清理归属。

补修：只接受本轮所有者签发、绑定代次与强进程/窗口身份的handle；失效/未知handle拒绝，不对旧PID发动作。补正常关闭及完整退出确认，Edge launcher退出不等于整窗/子树退出。失败保留句柄/profile/错误，可明确重试；dispose不得清空失败记录或删除仍在使用的目录，Host不能把失败转换为已清理。所有负例用替身验证，不能拿真实进程试kill。

## R5 [P1] 生产卸载没有真正结束独立监听服务

位置：`src/index.js:181`。

新Host仅以`ctx.on('dispose', async ...)`收尾，而实际Cordis的fiber释放并不会据此发出这个自造事件。实际新版SDK探针中：正常`root.fiber.dispose()`后，登记在`ctx.effect`的对照cleanup已执行，`dispose`事件未触发，独立HTTP Server仍`listening=true`。P1A Test1手工调用它收集的dispose监听器，所以没覆盖真实生命周期。

初次SDK探针因此在输出后仍持有本轮隔离监听；已按自身精确进程身份结束该探针，重跑改为记录泄漏后主动结束自身测试进程，未影响日常程序。这个测试进程退出不是插件正确卸载的证据。

补修：按实际Cordis的`ctx.effect`/正式资源归属清理服务、引导、窗口adapter和监听，正确处理bind未完成即dispose、失败、重复dispose及重载。以真实SDK释放fiber验证监听端口不可再访问、本轮连接/凭据失效；关闭失败要结合R4保留并报告，不能只在桩里手调回调。

## R6 [P2] 遮罩合法值0被当成默认值40

位置：`src/companion/companion.js:128`。

`parseInt(val,10) || 40`把合法零误当空值。本轮从已确认mask=55调用生产app的`handleMaskChange('0')`，实际发出的动作value=40；因此独立页无法关闭遮罩。亮度最小20不受这个零值例子影响，不扩大结论。

补修：区分合法0与NaN/空/非法输入，与主controller的规范化契约一致。补range和数字输入0/边界/非法值、真实已确认快照回显。连续input的在途策略也应按任务补串行/保留最新意图验证；目前inFlight变量仅赋值，不足以证明快速拖动后最后意图必然落地，不以一次直接调用代替连续交互证据。

## 给小G的本轮范围

只补R1–R6及其生产组合/真实React/SDK负例，保留现有静态页面方向和P0七审代次/lease/revision保护。先不要进入卡片库、作者参数、位置记忆或整套UI美化，不重编原生采集，不改版本/生产assets、不打包安装。修后写`docs/DETACHABLE_APPEARANCE_P1A_REPAIR_DELIVERY_20261017.md`，逐项对应本报告，列出实际替身边界和完整命令/计数。

复跑check、P0专项、旧E2E、新P1A组合检查、实际React挂载、新版SDK引导/释放检查，以及改client后的外观/英文/选择回归。旧5/5或11项通过保持，但不能替代新增缺口。交付修好后由用户转Codex再审，不向其它会话自动发消息。

收尾保护：149项本轮冻结输入无变化，59项既有资产/原归档/候选指纹保持，报告相对链接有效，`git diff --check`退出0（仅既有LF/CRLF提示），见`final-preservation.json`。入口文档已转向本报告，旧P1A交付中的完成声明不作复审结论。
