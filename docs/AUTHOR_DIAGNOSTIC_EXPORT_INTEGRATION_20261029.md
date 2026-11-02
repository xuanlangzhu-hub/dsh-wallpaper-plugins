# 作者参数诊断：实际client生成与受控导出整合

日期：2026-10-29。**实际诊断client和受控导出通道离线整合通过；尚未接入生产启用链／保存按钮，未打包安装，长时滑块故障仍未定因。**

## 固定输入与成果

输入为[有界诊断源码阶段](AUTHOR_SLIDER_BOUNDED_DIAGNOSTICS_20261029.md)的`.tmp/author-diagnostics-20261029-e`，44个实验运行文件按固定rc.56清单＋已审差异逐项校验。保护输入361项保持。

持久入口`dsh-whale-mist/qa/author-diagnostic-integration/check.py`，最终`.tmp/author-diagnostic-integration-20261029-e/result.json`。

- 原生成器实际生成client，随后`--check`与三份JS语法检查通过。
- 侧栏源只增加provider的可选`diagnostics`转交；原控制器业务实现及Host／Adapter／记录器源码保持前轮字节。没有把整个共享开发树混入。
- 标记外client只新增受控导出方法及其返回API，反向去除后与输入完全相同。
- 相对前轮44文件，只改client与`detachable-host.js`，新增私有`author-diagnostic-export.js`，其余42保持。45文件清单与34条相对import边闭合。
- 本机实验仍标rc.56，不是新候选，不可按相同版本安装或发布。

构建ID：`39fded844063896b8c8d65935b4effa35d098be125626d562d5e75fcef1c2203`，绑定固定输入、接点源和本轮转换配方。它是指纹标识，不是授权或签名证明。

| 文件 | SHA256 |
| --- | --- |
| 实际client | `90FF237DB5CDC270CB0BED305BA61FF47784CC5CD7013A33C898A7C83FA38C4E` |
| 受控网关 | `46999EE3230E39E0F87BCFA222D75A8E5C7DBDCE4CC427356E9504D1AAA28A81` |
| 私有导出session | `EF93F20985F3B933496D4B684B709AA9AAE13B737017CE25F421A6E1178656DF` |

## 导出边界

没有新增HTTP地址。只在原`POST /api/main/snapshot`鉴权通过后，识别独立的`authorDiagnostics`导出操作，命中后不进入snapshot更新分支。

- 顶层只允许instanceId／generation／authorDiagnostics；子对象只允许`action:export`与buildId。附带snapshot、文件路径、enable或未知字段全部拒绝。
- 要求当前main token、instance及严格整数generation头与body一致；新操作不继承其它旧路由的query凭据或宽松parseInt行为。旧／伪造代次、伴随窗lease、外站／伴随窗origin均不能导出。
- 生产默认session为空。可信Host代码必须先显式创建启用session；网络请求不能创建／启用记录器或替换源指纹。
- session自己创建记录器，不接受网络或调用方交入的任意JSON快照。build与四项source pins经固定结构校验并复制，外部修改配置对象不能改掉已有证据。
- 返回构建版本、指纹、实验标记和有界Host记录；不返回mainSession快照、参数值、聊天文本、鉴权头或token。响应no-store／nosniff。
- 导出既不清空缓冲，也不读壁纸metadata／生命周期、不下发参数、不改变播放或设置。测试给这些读取注入会抛错的函数，确认导出调用次数为0。
- session随Host停止而关闭，之后不能再导出。记录是Host进程近期历史，可包含不同generation；请求者必须是**当前**主窗口，不能把历史记录误当当前播放的授权证明。

主窗口实际桥接实现增加`requestAuthorDiagnostics(buildId,{signal})`，只显式调用才发送一次请求：2500ms总截止、262144字节响应上限、取消转发、构建ID与当前连接／代次复验。拒绝超大或错误构建响应；即使测试替身忽略abort，也按自己的截止返回，不无限等待。没有自动重试或落盘。

## 验证

- **19项导出检查**：默认关闭／无法请求启用、精确参数与build/source绑定、无snapshot混入／不修改设置、凭据／代次／origin／query拒绝、私有模块不可下载、实际生成桥接的单次请求、真实自有loopback导出、动作流断开后的迟到拒绝、取消／disposed、错误构建／超大响应、忽略abort的传输截止。
- **11项实际生成片段路由检查**：控制器接到真实鉴权HTTP网关、Host与ApplyAdapter；显式注入独立Renderer／Host记录器，仅metadata及child IO替身。前轮未知结果／修订／schema／迟到围栏继续通过。
- **76项Host与provider回归**通过，包括既有56项Host检查和20项侧栏provider生命周期检查。

这些是VM、实际Node模块、私有loopback HTTP及底层IO替身检查；没有运行完整桌面SDK、浏览器DOM、真实WE／PowerShell／COM／窗口或采集，不算实机验收。前轮控制器核心和后端诊断核心保持，未机械重复其23项等价测试。

8阶段退出0，无超时；单阶段25秒／总截止90秒，导出测试另设10秒期限。Node子退出、测试服务关闭均已确认，输入／冻结QA／45文件指纹留存。e轮用本机Node24.18的`--test-isolation=none`运行测试，避免父监督终止runner时遗留独立测试进程。另以有限3秒忙循环、父截止200ms验证保留句柄可停止事件循环卡住的自有Node；guardian-probe.json确认预期终止及退出，不属于业务检查超时。

## 失败留档

a轮模拟动作流返回不成功，真实桥接按原逻辑将authorConnected清为false，两个成功用例因此被stale门禁正确拒绝。仅修SSE替身为可正常关闭的读取，不放宽产品门禁。

b轮负例在动作流真正进入读取前就模拟断开，未触发预期状态；改为等待替身ready及连接已失效的有界状态后，c轮通过。d轮增加“导出不得读取metadata／生命周期”和原控制器只做provider转交的精确比较后再次通过，产物与c轮相同。e轮加单进程运行和独立父监督探针，检查通过且45份产物与d轮同字节。早期输出全部保留。

## 下一小步

1. 在固定隔离载荷中接通**默认关闭**的生产创建链：可信bootstrap发诊断配置，主窗口与Host各自创建记录器，不复用Node QA共享引用；缺失／错误配置保持关闭。
2. 增加显式导出文件入口，复用已审桥接；将Renderer与Host分别封装，标明各自时钟域、截断及缺失，不推断跨进程时间。先核对源码／构建指纹与总大小，再保存；不自动上传或导出聊天／参数内容。
3. 文件保存与UI操作先离线验证生命周期／取消／失败反馈；之后才准备新候选。真实安装／实测另取当时方便确认及新备份，不复用旧授权。

当前生产`index.js`和原bootstrap未接入session，原调用方也未注入诊断；没有开启设置、导出按钮或文件保存器。**日常rc.56仍不会生成或保存这套诊断。** 本轮不安装、不打包、不改Profile／媒体／外观存储、不查询日常端点，不发布、派发、推送或清理。

DSH0.2.1-rc.3／Whale rc.56／Git Bash0.1.2保持；TS后移、任务栏进一步优化暂停，UI大改与三体不推进。两种用户失败现象仍分开记录，不要求用户现在专门等待复现。

## 后续启用与下载入口

[默认关闭创建链／显式下载报告](AUTHOR_DIAGNOSTIC_ACTIVATION_DOWNLOAD_20261029.md)已完成40＋30＋76项检查。前文“未接启用链／保存UI”是本报告阶段；新实验已接线，尚未核包、安装或验收浏览器实际保存，日常仍未开启诊断，根因未知。
