# rc.2 设置入口审查：需返工

日期：2026-10-05。结论：dsh-whale-mist 0.6.0-rc.2 暂不安装，修复以下问题后再审查。
保留 DS 的源码、候选包和原始交付报告；本轮没有修改实现。
源码/测试结果与实机验收分开。下面的失败均由本机 SDK、假采集会话或隔离浏览器复现，
没有创建真实 WE 窗口、安装插件、退出日常 DSH或操作鼠标。

证据目录：F:\deepseekharness\.tmp\wallpaper-settings-review-20261005-183343。
候选包 SHA256：8BB9F1ABE6E9B581978235B50C38CA7BDE63C6F91CB1A76E2D5AB62ADEA3529C。
解包后 26 个文件逐一与当前源码一致。Profile 四份文件与上轮恢复备份哈希一致，日常版本仍为 rc.1。

## R1 [P1] 官方宿主服务访问没有声明注入

位置：src/index.js:59–70。

主模块没有导出 webServer 的注入声明，却直接读取 ctx.webServer。
本机官方 @deepseek-ai/cordis 4.0.4 的真实 Context 在插件内抛出：
cannot get property "webServer" without inject。
该错误被当前 catch 吞成告警，registerWallpaperRoutes 不会执行，真实设置入口只能收到缺失接口。

证据：sdk-service-repro.json。不声明时得到上述错误；声明服务依赖的对照可正常读取。
已有测试用普通对象 ctx 绕过了这个契约，不能证明官方宿主可加载。

要求：按当前 SDK 的服务依赖机制注册路由，兼顾缺少服务时原主题与图标仍能工作。
不要改 SDK、不要把失败用普通对象替身掩盖。补真实 Context 的无窗口契约检查。

## R2 [P1] 首帧尚未就绪时，前端立即停止

位置：src/client.js:444–478；src/wallpaper/session.js:332–334。

Host 的 create 在采集子进程启动后即返回；首个画面还没进入 hub 时，stream 返回 503。
前端把这个正常启动间隙当作已结束：connect 等 catch 完成后清掉定时器并把 running 设为 false，
没有重试，也不会在稍后第一帧到达时恢复。

证据：browser-repro.json 的 firstFrameNotReady。
先返回一次 503、随后允许有效流时，只有 1 次请求，state=stopped、running=false、没有绘制帧。

要求：区分首帧等待与终态失败；用有界等待/重连或 Host 就绪握手，保持明确的停止能力。
补“503 → 首帧到达成功”和“真正失败/用户停止后不再重试”的检查。

## R3 [P1] 流结束或超时后，最后一帧没有撤掉

位置：src/client.js:508–514、668–681。

mountWallpaper 传入 onStatus，希望 waiting/error/stopped 时隐藏画面并恢复原主题；
但 engine.subscribe 只登记 onFrame 和 onStop，完全忽略 onStatus。
到预览时限、EOF、源窗口失败或持续无帧时，状态变了，背景层却仍可见。

证据：browser-repro.json 的 normalStreamEnd。
state=stopped 时，layerExists=true、layerHidden=false，body 的背景标记仍是 wallpaper。

要求：把状态通道接完整，终态和失效时撤销画面与透明标记；
重新开始时恢复新实例，取消旧订阅，避免重复回调。补 EOF、停帧、错误和到期恢复检查。

## R4 [P1] Host 路由没有统一管理待启动、关闭与卸载

位置：src/wallpaper/session.js:296–319、337–344、373–374。

- starting 的空值判断后先 await 请求体，锁还没有设置；两个并发请求都会进入 startSession。
- 创建输出目录的 await 期间 session 尚未赋值，stop 看不到待启动操作，先返回停止成功，
  但旧 start 随后继续建立实例。
- stopSession 在关闭完成前先清空 session，另一 start 会与仍在关闭的旧源窗口并存。
- 卸载不取消正在准备的开始请求；生命周期 disposer 也没有返回 stop 的 Promise，
  官方 Cordis 无法等待清理完成。

证据：host-route-repro.json，直接调用真实路由实现，仅 sessionFactory 为假会话：
两个并发开始得到 2 个实例，停止后仍有 1 个；准备期间停止/卸载后仍创建实例；
关闭未完成时可以新建第 2 个实例；卸载 disposer 返回时旧源仍未关闭。
SDK 的 runDisposable 与 _unload 会等待返回的 Promise，目前的回调丢掉了它。

要求：在第一个 await 之前取得操作归属；停止/卸载使此前待启动请求失效，
并等待本轮真实清理后再允许后续明确的开始。关闭期间保留归属，卸载返回清理 Promise。
覆盖上述五种路由时序，而非仅测试单个 session 的 stop 幂等。
不要通过无限等待、杀 wallpaper64 或修改原生算法绕过问题。

## R5 [P1] 前端晚到的开始响应会使已停止的运行复活

位置：src/client.js:491–503、530–555。

stop 清掉 busy/running，但之前 start 的 HTTP 响应回来后只检查 disposed，
随后无条件设置 running=true 并连接画面流。
切换图片/无、恢复默认或用户停止时，都可能被之前的请求覆盖。
restart 在请求失败后也无条件进入连接状态。

证据：browser-repro.json 的 stopDuringStart。
先开始、延迟响应、等待 stop 完成，再释放旧响应；运行状态重新变成 connecting，
runningAfterLateStart=true，假源又在播放。

要求：对每次运行使用代号/取消标志，停止、切换来源、恢复默认和卸载使旧操作失效。
旧响应、旧解码与旧流回调不可以修改新状态；重新开始失败应保持失败并显示原因。
补迟到响应、失败重启、卸载中启动的前端检查。

## R6 [P2] 关闭失败被接口丢弃，用户看到假停止成功

位置：src/wallpaper/session.js:296–301、353–356。

单个 session 会记录 closed=false 和 failure，但路由先把它设为 null，
stopSession 返回的 statusPayload 不再包含它的报告。
cleanup 记录失败后不抛错，因此当前 catch 也无法恢复错误；随后还允许新开始。

证据：host-route-repro.json 的 failedCleanup。
内部源没有关闭且有 timeout failure，HTTP 响应却是 active=false、session=null，没有 error，
也没有保留可用于后续核验/重试的归属。

要求：保留可核验的最后结果与失败会话，返回失败信息，让客户端明确显示未清理成功。
未证明旧源关闭前不能当作普通已停止状态或静默开新实例。
补路由层 closed=false/超时/歧义检查，不能只断言 session.report。

## R7 [P2] 运行状态的帧数和倒计时停在初始快照

位置：src/client.js:467–471、1362–1376。

状态文案读的是 start 时的一次 Host 响应；运行期间只提交 metrics，并不刷新这个快照。
实际绘制帧数增长时，设置行仍显示 0 帧，倒计时不变。
倒计时还按最大 300 秒计算而不是本轮默认 180 秒；copy.previewLimit 没有定义，
显示出 undefined。

证据：browser-repro.json 的 statusDoesNotAdvance。
实际绘制由 28 帧增至 58 帧，两次文案均为“预览中 · 0 帧 · undefined 4:58”。

要求：使用实时客户端指标或刷新 Host 状态，使用本轮实际时限，补齐中英文文案。
补绘制计数增长、倒计时递减、到期结束及无 undefined 的检查。

## 已执行检查与检查缺口

- npm run check 通过。
- 现有 Host 17 项通过；在本轮目录的副本执行，仅将 F:\out/F:\logs 等写入位置改为本轮自有目录，
  保持源码模块不变、保留原测试的 moduleUrl 语义，避免测试轮转无关目录。
- npm run test:appearance-wallpaper：30 项断言通过。
- npm run test:appearance：30 项断言通过。
- 独立 SDK、路由和浏览器复现仍显示上述失败。因此这些既有检查不能替代漏测时序。
- git diff --check 另报 src/client.js 第 13 行有行尾空格，可在返工时一并清理；这不是功能阻塞的原因。

现有浏览器 fixture 每次开始后直接提供画面流，不模拟真实的首帧 503，也没有 EOF/停帧恢复断言。
它替换了 createImageBitmap，以图片对象绘制，不能称作对真实 WE JPEG 解码的再次验收。
Host 的“并发开始”命名检查实际上顺序调用，没有覆盖并发请求体与准备阶段。
卸载检查只验证 stop 被调用，没有等实际关闭确认。

## 返工范围与交付

只修 R1–R7，不增加壁纸库、鼠标/音频交互、持续播放、任务栏隐藏或其它功能。
尽量沿用已有原生和协议代码。不要重新弹真实窗口或安装 rc.2 来碰运气。

为真实服务契约、路由生命周期和真实客户端补针对性无窗口回归。
本轮目录保留了可复用的最小复现；修复后应得到相反的正确结果。
代码与包完成后出新版本 rc.3（若已有则继续递增），不覆盖 rc.2 或任何被引用的包。
记录相对 rc.2 的变更、检查与包 SHA256，更新 NEXT_TASK.md 为“返工完成，待复审”，交回本对话。

本轮没有安装候选包、修改 Profile 或修改官方程序。源码未改，仅新增此审查单、
本轮证据与交接状态。实机验收待这些阻塞问题消除后再安排。
