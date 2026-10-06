# rc.3 复审：仍需修复四处边界

日期：2026-10-05。结论：rc.3 部分修复已验证，但仍不适合安装；只补 T1–T4，再出新包复审。
本轮只读实现，新增审查文档与自有复现证据；没有改 DS 的源码、安装候选包、操作鼠标或创建真实 WE 窗口。

## 已确认的修复

- R1：真实官方 Cordis Context 可以按 inject 声明读取 webServer，注册真实路由并返回 status 200。
  此复审没有调用完整主题 apply，因此没有启动图标或壁纸原生辅助程序。
- R2 的 503 分支：首次 503 后会重试并开始绘制，而不是立刻停止。
- R3 的 EOF 分支：正常流结束后撤销画面层与透明标记。
- R5 的单轮迟到开始响应：停止后不会复活旧运行。
- R7：绘制计数与倒计时会更新，文案不再出现 undefined。
- 已执行语法检查、17 项 session 检查、8 项路由检查、47 项壁纸浏览器断言和 30 项原外观回归，均通过。
  Node 测试在自有目录副本运行，只有写入路径/测试 moduleUrl 适配，未改变被测实现。
- rc.3 包 SHA256：28564BB0F0FD67ED59B046A9E44A2387B6BD5DC3D264C4FADC0B5AEAE1C27341；
  包内 26 文件与当前源码逐一一致。
- 日常 Profile 四份文件仍与上一轮恢复备份一致，安装版本仍是 rc.1。

证据根目录：F:\deepseekharness\.tmp\wallpaper-settings-rereview-20261005-191850。
SDK、包和 Profile 核对分别在 sdk-contract.json、package-comparison.json、profile-unchanged.json；
以下失败在 host-repro.json 和 browser-repro.json。

## T1 [P1] 路由只检查锁，没有在读取请求体前取得锁

位置：src/wallpaper/session.js:437–450、301–307、481–488。

注释称锁在读请求体前取得，但实际上第 442 行仅检查 ownership，随后 await readJsonBody，
到第 450 行才在 startOperation 内 claim。两份请求同时等待正文时，都通过空锁检查；
收到正文后仍可分别创建实例。stop/unload 在这个间隙也看不到待启动请求，之后正文到达又会启动。
generation 检查只能约束已经拿到 token 的请求，不能取消尚未取得 token 的旧请求。

真实路由 + 假会话复现：
- 两个正文同时放行：两个都返回 200、建 2 个实例；停止后还留 1 个。
- 正文未读完时先 stop：stop 返回 200，随后旧 start 仍返回 200 并创建实例。
- 正文未读完时先完成卸载：随后旧 start 仍创建实例。

要求：请求一进入就取得包含“读取正文 → 准备 → 创建”的归属，
停止/卸载让这个 token 失效；已卸载的路由闭包不能再启动资源。
不要只在注释里声称提前取得锁，也不要只测试 create 已经开始之后的并发。

回归：用可控异步请求体同时释放两个请求；在正文挂起期间 stop 和 unload；
断言最多一个实例，停止/卸载后旧请求不能创建窗口。

## T2 [P1] “重试清理”没有重新执行真正的关闭

位置：src/wallpaper/session.js:127–161、329–342。

路由现在保留失败会话并提供重试，但 createPreviewSession.stop 会永久返回 cleaning 的旧 Promise。
第一次 closed=false 后，再次 stop 不会重新调用 helper，永远得到第一次的失败结果。
新 routes 测试的假 session.stop 可以返回不同结果，因此遮住了生产实现的行为。

证据：真实 createPreviewSession + 假 helper/child。
第一次关闭返回 timeout；随后让 helper 能成功关闭，再次 stop：
first=false、retry=false、helperCloseCalls=1，源仍存在。

要求：同一次正在进行的清理保持幂等，但已结束且 closed=false 的清理必须允许新的受约束关闭尝试。
保持原窗口名和 PID 校验，保留失败证据；成功后更新结果并允许释放归属。
不要将 closed=false 改成成功、直接忘掉失败会话，或关闭 wallpaper64 主进程。

回归：用真实 createPreviewSession 的 stop 测一次失败、第二次成功；
确认 helper 确实被调用两次，结果变为 closed=true，再由路由验证归属释放。

## T3 [P2] 自然结束且已清理成功后，“开始预览”仍被拒绝

位置：src/wallpaper/session.js:309–324、345–348；createPreviewSession 的 close 回调。

时限到达/采集自然结束会在 session 内自动清理，isClosed=true；但路由仍持有该 session。
status 已报告 active=false，而 startOperation 只要 session 非空就拒绝。
所以界面已停止并允许点击开始，接口却说“正在运行或仍在清理”。

证据：真实 createPreviewSession + 假 child 触发正常 close。
sourceClosed=true、reportedActive=false；再次 POST /start 返回 409，仅保留原实例。

要求：对已确认关闭、且不存在进行中操作的旧会话，归档结果并安全释放后允许新开始。
未确认关闭的会话仍须阻止新开始；不要靠把按钮改成 restart 掩盖状态不一致。

回归：模拟达到时限/自然 close，等待真实关闭成功，再 POST /start，应建立新实例；
同样的测试中把旧关闭结果改成 false，则必须继续拒绝。

## T4 [P1] 开放的停帧连接绕过超时，旧画面继续显示

位置：src/client.js:457–499、504–520。

20 秒 deadline 只在 fetch/非成功响应/读取异常的分支检查。
收到 200 后若 reader.read 一直挂起，没有独立计时器中止等待。
第一次画面没到时，可以无限保持 connecting；已经绘制过时，pollTimer 也没有检查 lastFrameAt，
会一直显示最后一帧和 playing。
lastFrameAt 虽在 accept 内更新，但现在没有用于失效判定。
即使终态失败被判定，connect 只通知撤图，没有请求 Host 清理已启动资源。

使用受控客户端时钟推进 30 秒（不实际等待 30 秒）：
- 200 响应、始终无帧：仍 connecting、running=true，没有 Host stop 请求。
- 一帧后连接持续开放但不再出帧：仍 playing、running=true，画面未隐藏、透明标记仍在，
  同样没有 Host stop 请求。

要求：为首帧和持续无帧建立独立于 reader.read 的有界监测，
停帧后撤销失效画面并恢复普通主题；恢复或终态处理规则写清楚。
进入终态失败时清理本轮 Host 资源，并正确处理关闭失败；
用户停止/新代号/卸载后旧监测器不得影响新运行。

回归：脚本化 200 但无任何数据、首帧后持续停帧、恢复出帧、到达终态后的 Host 清理，
并验证停止/卸载/新一轮后旧超时不再生效。不能只用 503 和 EOF 替代。

## 检查为何没有发现这些问题

- 并发路由检查先让第一个请求进入 create，再发第二个；没有同步挂起两份请求正文。
- 关闭重试检查使用可变返回值的假 stop；没有测试真实 stop 对失败 Promise 的缓存。
- 没有测试自然结束之后的普通 start。
- fixture 支持 stall，但现有断言没有使用开放、无数据的连接检验 deadline 与画面失效。

## 本轮返工范围

只修 T1–T4，沿用已通过的修正、原生采集和协议；不扩大功能或重做真实窗口实验。
补对应无窗口检查，修复后复用本轮最小复现，应得到正确的相反结果。
新包优先 rc.4，存在则递增；保留 rc.3 和所有被引用包，不覆盖。
交付相对 rc.3 的改动、检查、包 SHA256，更新 NEXT_TASK.md 后交回 Codex 复审。
仍不安装日常 Profile、不自行退出 DSH或操作鼠标。

原生依赖和单样例限制仍与原候选说明一致；实际桌面验收待这些问题消除后再安排。

