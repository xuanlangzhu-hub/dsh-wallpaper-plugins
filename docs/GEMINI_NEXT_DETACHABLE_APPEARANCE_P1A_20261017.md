# 给小G：P1A正式接入独立/吸附设置的窗口链路

2026-10-17，Codex。用户已让继续推进。宿主升级优先项已完成，当前日常为DSH0.2.1-rc.2、鲸系外观rc.35、Git Bash0.1.1，见[升级短验](DSH_021_RC2_UPGRADE_TRIAL_20261017.md)。**本轮在源码和隔离环境实现P1A，不安装、不热改、不查询或操作真实DSH/WE，不创建可见伴随窗口。** 代码通过复审后，再安排独立候选和另约实机；用户继续用rc.35。文档由用户转交，不向其它会话发送消息。

## 本轮交付到哪里

把已经通过七审的通信骨架接进插件正式生命周期：主renderer顶栏入口、吸附视图、受保护的Host引导、真实静态伴随页，以及可注入的Edge窗口适配器。交付应是可供后续候选整合的生产源码，测试从生产入口加载；不再只交假controller、单独QA服务器或演示Tab。

本轮用亮度20–120、遮罩0–90两个真实控件，以及连接/确认/错误状态，证明同一个controller在吸附与独立视图之间连续工作。保留现有通用设置的完整功能和停止入口。这个小视图是接入阶段，**不冒充完整设置UI或可视化壁纸库已完成**。后续P1B整理共享控件、库/详情布局与预览图；作者专属参数另拆目标隔离验证，不能以这两项调节冒充壁纸作者设置。

吸附指DSH内右侧非模态面板，独立指Edge应用模式顶层系统窗口；通过按钮切换。拖拽自动磁吸、外部工具窗跟随主窗、跨屏位置记忆和动画后排。Edge路线仍有条件，真正开窗、跨屏和关闭实机尚未验收。

## 先读及已核对事实

先读AGENTS、NEXT_TASK、两份README、PROJECT_STATUS、[P0任务](GEMINI_NEXT_DETACHABLE_APPEARANCE_P0_20261017.md)、[七审](DETACHABLE_APPEARANCE_P0_SEVENTH_REVIEW_20261017.md)、[UI方向](DETACHABLE_APPEARANCE_UI_DIRECTION_20261017.md)。六审补修和七审结果优先于P0初稿中的旧API/测试计数。旧[页内面板P1](GEMINI_NEXT_APPEARANCE_PANEL_P1_20261017.md)只继承共享状态、即时反馈和回归要求，不继承已被替代的产品形态。

- `src/index.js`现在只接图标和壁纸Host，尚未接可分离服务。`src/detachable-host.js`的`createDetachableHttpHost`会创建自己的127.0.0.1动态端口；不是现成`ctx.webServer`路由，也没有生产静态页。现有浏览器E2E的静态服务器、固定测试token、模拟spawn/close不能直接搬进产品。
- `src/detachable-contract.js`是浏览器安全契约；`createMainRendererBridgeClient`与`executeAuthoritativeAction`已有实现。`detachable-host.js`与Node桥不能从浏览器入口传递引入。不要新建第二套动作执行器/窗口所有者。
- P0七审15/15、双Tab11项及独立排队探针已通过。保持H1注册generation与H2旧lease/revision的队列内复核、G2权威模式及关闭失败重试；不是从零重写协议的任务。
- 新版SDK只读证据在`.tmp/detachable-appearance-p0-seventh-review-20261017-fca7697e/new-sdk/node_modules`：`dsh-host-webserver/lib/index.js`提供路由注册和结构化index注入；`dsh-client-connection/lib/index.js`拥有另一层连接/鉴权。**不能假定注册到webServer的自定义路由就自动继承完整DSH鉴权。** 实际Desktop加载方式与可访问origin要沿正式boot路径核对。
- 新版`conversation.session.header.actions`与`shell.overlay`存在，后者root/list；`settings.section`的carrier是settings-general。存在性来自`new-ui-surface-result.json`，不等于React挂载已实测。
- 新版Desktop只读提取在`.tmp/detachable-appearance-p0-sixth-review-20261017-a7fc57b6/upgrade/audit-source/lib`：主窗口`setWindowOpenHandler`仍deny，preload所查`createProductApi`未见通用插件开窗能力。`dshPlatform.open`限账号页面，不借用。不开Node集成、不改preload/EXE/asar、不使用日常浏览器profile。

## 实现要求

### 1. 正式Host组合和引导

在插件Host生命周期组合可分离服务，明确端口/静态页面/凭据各自拥有者；复用现有localhost独立监听骨架即可，不强行把两套路由并成一个服务器。主renderer通过已证实的正式服务/引导接缝取得本轮连接信息，不硬编码端口或从用户配置、日志、进程命令行抓token。

交付中给出从Host到真实renderer的完整引导路径和实际模块/接口依据。主注册凭据不可从匿名loopback端点或无条件公开静态页取得；index注入若被采用，也要证明其页面/访问边界，不能把随机值放进所有人可取的index后声称已鉴权。不要复用完整DSH认证URL/账号凭据，不把renderer入口改成公网或扩大CORS。若当前SDK无法提供成立的引导路径，交具体阻塞证据与最小替代方案供复审，不绕过或假称生产接通。

注册/重连仅在插件生命周期及需要时发生，不依赖设置组件是否挂载。Host与renderer卸载时撤销路由、连接、订阅、定时器和本轮凭据；处理start未完成就dispose及重复dispose，不留下端口。可分离初始化失败不能破坏原主题、图标或壁纸Host。

### 2. 真实页面和模块边界

新增正式伴随HTML/JS/CSS，使用同一浏览器安全契约和受限动作客户端；禁止再载整份DSH/Whale apply、第二controller/backdrop/canvas/stream。页面只投影已确认快照，不写DSH Local Storage或Profile，不拥有任意路径/命令能力。

静态资源按固定清单提供、正确MIME、只读GET/HEAD，拒绝路径穿越/编码逃逸；不提供工作区/用户目录任意文件服务器。页面不依赖外部CDN或新下载运行时。握手token不写持久存储、错误消息或测试报告，页面响应不缓存凭据并控制referrer；保留单次兑换、实例/lease/generation与revision保护，不以origin检查取代认证。

先证明正式页面的ESM依赖图能在浏览器环境加载（无node:、bare DSH模块或仅fixture有的import map）；完整UI依赖稍后整合。页面收到主端断线应禁用写操作、显示未连接，不能把失败动作展示为已应用。

### 3. 唯一controller与两种视图

在现有apply/controller生命周期绑定主端桥，接入已有稳定快照/订阅；顶栏按钮打开唯一设置视图，吸附宿主用`shell.overlay`。重复点击、会话头替换、关闭/重开不重复注册或初始化；不能占用single rightbar或改官方私有DOM。

两种视图复用最小字段定义/规范化与确认逻辑。滑块连续输入更新主界面；跨端动作遵守expectedRevision串行/合并策略，遇到冲突回读确认，不乱序重试旧意图。非模态、不锁主会话、不遮暗整窗；有关闭与弹出/吸附按钮，320px窄视图仍可操作。关闭设置视图不reset、不停止壁纸；弹出/吸附也不改变scene、mode、auto-start，不重复媒体持久化。所有权切换期间禁用失效视图的写入。

远端不新增播放、目录扫描、媒体上传或作者参数动作，本步保留原受限动作集；原设置的R1停止/cleanupPending、R2目录确认和预设语义保持。独立页不直接调用壁纸Host的start/stop路由绕开controller。

### 4. Edge生产适配器

实现实际可用、可注入测试的spawn/正常关闭/身份确认适配器，基于现有`buildEdgeAppLaunchSpec`；只从已验证路径发现Edge。缺失Edge时禁用弹出并说明原因，吸附和原设置继续可用，不下载浏览器。使用参数数组、shell=false，不启用远程调试或关闭web安全，不借默认Edge用户目录。

每轮由Host创建专属临时profile并记录创建归属。创建者、唯一窗口所有者、主端注册代次和popup lease要关联；不能把Edge启动器退出视为整窗已退出，也不能假设关闭首个child PID就处理完多进程。优先正常关闭，核对本轮资源终止后才释放所有权；失败保留unconfirmedCleanup并允许明确重试，不提前报告docked/closed成功。

不得按msedge进程名、模糊标题、过时PID批量终止。仅清理本轮自己创建且确认不再使用的临时目录；递归操作前核对解析后的绝对边界，不碰日常Edge或旧证据目录。主DSH失联/异常退出时正常结束本轮伴随资源的机制必须交代；没有完成实机验证的部分如实列出。

## 隔离验收和交付

在新独立目录冻结本轮输入与结果，不复用日常profile、DSH端口或WE。测试可启隔离loopback服务/无窗口子进程；浏览器仅用隔离headless实例，不打开可见窗口或真实DSH。既有E2E可以保留，但新增验证须加载**正式页面、正式Host组合及真实主端适配代码**，不能为生产漏接另写只在fixture能工作的桥。

必需证据：

1. 实际新版Cordis服务组合/声明、引导访问正负例、动态端口发现、生产静态页全依赖加载、正式renderer生命周期进入和退出。替代真实DSH的部分逐项标注。
2. 两个已挂载视图＋同一真实controller：亮度/遮罩双向连续更新、相同值不循环、拒绝/过期动作不假成功、存储投影次数不因双视图增加。宿主挂载若使用React，须用实际React renderer，不能仅一次调用stub。
3. 弹出/吸附/重复操作、手动关闭、主端断线及恢复、初始化中dispose、关闭失败重试；计数证明无第二controller及start/stop/restart。H1/H2和排队revision负例保持，不降低旧断言。
4. 适配器以替身进程/IO验证参数、专属profile、缺失Edge、多进程身份边界和关闭确认；证据明确没有真实Edge顶层窗，不写“跨屏/独立窗实机通过”。旧租约不关新窗口，关失败不清新目录。
5. 静态路径逃逸、无凭据/错误origin/旧token、卸载后连接等负例；错误处理不泄露秘密。检查无远端依赖、Node浏览器导入、第二持久化和日常路径副作用。

运行`npm run check`、`npm run test:detachable-p0`、既有浏览器E2E及新增生产接缝检查。改client后运行`npm run test:appearance`、英文套件和scene-selection；改Host入口后补实际新版SDK契约及相关Host回归，不机械重跑原生/GPU长测。570/566是旧计数基线，不删断言凑数；报告真实计数、退出码、替身边界和失败记录。

建议文件范围：现有`src/index.js`/`client.js`及3个detachable模块、新增独立窗口适配器/静态页/小型共享字段和QA。可调整check/files清单保证新模块纳入检查与未来打包；**不改manifest版本/生产assets、不重编原生采集、不覆盖归档、不直接打整个含Trace工作区**。兼容声明日后候选从已审rc.35来源保留，不能把工作区rc.30旧元数据当新包。

交付`docs/DETACHABLE_APPEARANCE_P1A_DELIVERY_20261017.md`，包含正式入口/模块图、引导与认证边界、唯一controller/窗口所有者、依赖清单、关闭机制、测试命令与结果、变更文件/输入指纹、未覆盖项。先交用户转Codex复审；**本轮不打包安装、不提交推送或清理、不启动真实窗口或三体专项**。之后另整合候选并新确认方便再做最短实机窗口验证。
