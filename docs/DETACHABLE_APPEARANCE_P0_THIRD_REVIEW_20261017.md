# 可分离/吸附外观设置 P0 三审：资源失败传播与HTTP双向接缝仍需补修

2026-10-17，Codex。对象：[二审补修交付](DETACHABLE_APPEARANCE_P0_SECOND_REPAIR_DELIVERY_20261017.md)、bridge/contract及新增detachable-host，对照[二审](DETACHABLE_APPEARANCE_P0_SECOND_REVIEW_20261017.md)。

**结论：暂不通过，剩余重点收敛为R2资源所有权失败传播、R6真正双向/认证/执行边界。** 二审指出的重复弹出、普通close失败后禁止新建、dispose复用Promise、迟到connect取消、连接中快照与stale恢复、单次伴随吸附失败回执已有对应改进，复跑专项通过；这些成果保留。HTTP通道新增不等于双向同步和关闭撤权已经完成。

日常rc.34和DSH主程序均不更新。用户此前已选择暂缓0.2.1-rc.1，本文不启动宿主迁移。UI库/详情方向另见[记录](DETACHABLE_APPEARANCE_UI_DIRECTION_20261017.md)，先补P0，不扩完整UI。

## 本轮证据与检查

独立目录：`.tmp/detachable-appearance-p0-third-review-20261017-72660421`。包含冻结源码/QA/package/交付、`protected-before.json`、专项输出、`review-probes.mjs`、`probe-results.json`及`http-browser-probe.log`。

| 检查 | 结果与覆盖 |
| --- | --- |
| `npm run check` | 退出0 |
| 冻结P0专项 | 12/12，退出0；第12项是真HTTP，但客户端仍运行在Node测试进程中 |
| 补充Node/子进程探针 | 7组剩余缺陷复现成立，退出0；断言成立表示缺陷已复现 |
| 独立headless Edge +纯浏览器HTTP客户端 | 退出0，复现主端改值不推送、无凭据快照读取、断开后旧租约可写 |
| 既有外观回归 | 本轮不机械重跑；client.js、appearance-regression.mjs、appearance-harness.js与上轮冻结输入逐字节一致，沿用上轮570/566/场景选择及实际controller同值证据 |

本轮未查询或操作真实DSH/WE，未打开真实伴随窗口，未打包安装/提交推送/清理；headless使用独立临时profile。源码、QA、package、资产及release归档保护清单179文件保持不变，Codex只写独立证据与文档。

## R2 [P1，仍未闭合] 迟到资源清理失败丢句柄，断线被误当窗口退出

位置：`src/detachable-bridge.js:305–316,342–343,589–607,613–684`。

### 1. 迟到spawn成功后的close失败仍被吞

复现步骤：adapter.spawn已开始，尚未返回；调用dispose；随后spawn返回明确句柄H。取消分支尝试close(H)，adapter报告H仍存活并抛错；代码空catch，未保留H、未设置unconfirmedCleanup。dispose等到该操作结束后，又执行close(activeOwnedHandle)，此时activeOwnedHandle仍为null；若adapter对null无事可做而正常返回，最终**dispose返回ok=true、unconfirmedCleanup=false，而H尚未退出**。

探针实际close参数为`[{id:'late-H'}, null]`。await屏障增加了等待，但丢掉第一次失败后不能据此确认清理成功。

补修：spawn拿到句柄即登记归属，包括取消/卸载分支；失败保留该句柄及错误，后续仅针对它重试。dispose必须返回同一资源的真实最终清理结果，不能用close(null)覆盖先前失败。adapter成功需定义为本轮资源退出已确认，而不是仅发出关闭请求。负例用具体H，close(H)失败、close(null)成功，仍必须报告失败并保留H。

### 2. transport断开不等于owned窗口已经退出

复现：spawn得到H并连接；transport触发disconnect，bridge直接置docked，activeOwnedHandle仍在；此时requestDock返回alreadyDocked、不执行adapter.close；再requestDetach启动H2，H被覆盖。**计数spawn=2、close=0**。

补修：独立跟踪连接失效与窗口存活状态。断开立即撤销写权限，但只有本轮窗口退出已确认才能释放handle/宣告资源清理完成；状态未知时按已有清理门禁阻止新建或先定向确认/清理H。补异常网络断线、窗口退出确认与重开的差异测试，不按进程名/标题盲关。

## R6-A [P1] HTTP实现只有请求响应，没有主端更新与会话关闭生命周期

位置：`src/detachable-host.js:77–83`的空sendSnapshot/close；`src/detachable-contract.js:291–345`的HTTP transport。

| 本轮复现 | 具体结果 |
| --- | --- |
| HTTP握手成功后，主端亮度70→110 | 主端快照110，伴随端仍70；HTTP transport的onSnapshot回调仅赋值，无任何收取/调用路径 |
| 伴随client.disconnect/transport.close | 仅清本地变量，不发断开通知；主bridge仍detached，持旧lease和当前revision仍可成功写成100 |
| 主bridge.dispose，伴随再次dispatch | 服务端503正确拒绝；客户端仍isConnected=true，不进入失联禁写状态（不代表服务端越权写入成功） |

前三项中主端不更新/断开后旧lease可写也经真实headless浏览器复现，浏览器与测试Host位于不同本地origin。查看目录中的`http-browser-probe.log`。不能用“下一次写值遇到stale再吸收快照”代替调参的即时双向反馈，也不能把本地closed标志当服务端撤权。

补修：提供最小可验证的订阅/推送或有明确时限的同步方案，实际调用onSnapshot及关闭/失联通知；所有通知与请求响应绑定实例/连接代次，关闭后迟到消息不得更新新view。正常关闭有认证注销；崩溃/断网通过有界租约、心跳或等效机制失效，不能只依靠正常关闭请求。主端失联/503时客户端禁写并显示真实状态。租约失效与R2资源退出确认分开。

最小验收：主端改值→浏览器确认同步；浏览器改值→主端与另一订阅视图收到确认；正常关闭/突然失联/主端注销→旧lease受控拒绝、客户端禁写；同一场景下可恢复/重新打开，旧消息不污染新实例。继续保持只有一个controller和一条播放管线。

## R6-B [P1] Origin和读取端点过宽，合法JSON空值可导致Host未处理异常

位置：`src/detachable-host.js:19–64,69–95,128–148`。

1. **GET /api/snapshot没有任何lease认证。** 传来自另一origin `http://127.0.0.1:9` 的请求，返回200及完整快照，ACAO反射该origin。浏览器探针同样可在未给GET提供任何凭据时读取。Origin门禁当前只检查hostname，接受任意localhost/127.0.0.1端口，不能表示“当前伴随页面或当前主DSH”。写端点仍有token/lease，本报告不扩称外部网站已可任意写入。
2. **POST /api/connect合法JSON `null`触发未处理Promise rejection。** readJsonBody返回null，随后直接解构token；子进程探针捕获到`Cannot destructure property 'token' of 'body' as it is null.`。生产默认未处理拒绝的进程行为可能中断服务，不能因为正常载荷测试通过就称失败均受控。
3. 静态核对：构造器允许调用者传任意host并原样listen，未强制loopback；server未处理error，端口占用时start不能返回受控失败；读body无大小/超时/aborted边界。**本轮没有绑定公网地址或进行大载荷攻击**，这些是代码可见的边界缺口。

补修：按选定实际三方origin/角色定义精确权限，统一保护读取、写入、订阅、注销，不将“本机任意端口”当已授权伴随页面。token/lease仍须独立校验，读写失败不泄露确认状态；缺Origin与null Origin的处理根据实际合法调用方给证据。禁止非loopback监听选项，启动错误受控reject；JSON shape、方法、内容类型、合理体积及请求异常均有结构化拒绝，外层async异常被捕获。认证token/lease必须使用安全随机数，当前UUID的Math.random兜底不能作为认证凭据的降级方案（无安全随机能力就受控失败或注入受信实现）。

补空/数组/非法body、错误精确origin、缺/旧读租约、端口冲突、失联及绑定校验的离线负例；不得为跨域方便而加通配放行或关闭Desktop安全隔离。

## R6-C [P1] 主renderer到Host的实际接缝仍未证明

当前createDetachableHttpHost直接接收Node进程内的bridge对象，而bridge直接持有Node mock controller。第12项用Node fetch跑通“controller/bridge/Host/client”并不能证明真实主controller所在的renderer能向另一个Host进程提供受限操作。

本轮Codex浏览器探针证明了真实浏览器可使用HTTP客户端，同时明确暴露了上述同步/撤权缺口；它仍以Node假controller为主端，**没有替小G完成缺失的主renderer→Host通道**。

需要在不操作真实DSH的前提下，把主端放到浏览器独立上下文（可使用现有fixture实际controller），Node仅担任假Host/受控窗口适配器，另一浏览器上下文为伴随端；通过消息/HTTP完成最小受限往返、双向更新及主实例失联禁写。并写明其对应当前0.2.0-rc.2正式ctx/webServer注入、路由及模块加载路径。无需完整UI/真实系统窗口，不复制第二份apply或持久化配置。不能只把Node持有controller的测试重新命名为renderer验证。

启动spec现在含shell:false可保留，但仍没有验证真正调用适配器的受控exe/绝对profile与失败确认；默认C:\Users\HP路径兜底及30–50MB估计也不是通用依赖/实测证据。P0可用不spawn的调用适配器验证这条边界，实际窗口图标/DPI/内存留待授权实机。

## 下一轮集中交付

只补上述R2/R6接缝与相应客户端失联状态，不重做已经通过的主题/预设/可读性，也不扩完整P1 UI。提交逐项修复与最小端到端证据，明确哪些验证仍是mock、哪些是真浏览器；不要用测试数量代替资源退出/即时同步结论。原12项通过保持，本次7组失败复现与浏览器原始日志另存，不覆盖旧证据。

继续遵守AGENTS：用户使用日常rc.34，DSH主程序暂缓升级；源码manifest/assets仍rc.30冻结，不打整个含Trace工作区。未授权真实伴随窗/DSH/WE操作，不跨会话发消息，不提交推送或清理。本文由用户转交，补后复审。
