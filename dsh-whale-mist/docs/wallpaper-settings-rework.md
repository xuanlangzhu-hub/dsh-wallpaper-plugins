# rc.2 返工：R1–R7 修复与新候选包 0.6.0-rc.3

日期：2026-10-05。范围：只修 `wallpaper-settings-review.md` 的 R1–R7，未增加功能、未安装包、未创建真实 WE 窗口、未退出宿主。
交付包：`release/plugins/dsh-whale-mist-0.6.0-rc.3.tgz`
SHA256：`28564BB0F0FD67ED59B046A9E44A2387B6BD5DC3D264C4FADC0B5AEAE1C27341`（26 文件，6.93 MB，rc.2 及更早包全部保留）。

## 1. 相对 rc.2 的改动

| 位置 | 改动 |
| --- | --- |
| `src/index.js` | 新增 `export const inject = ['webServer']`；去掉"读不到服务就静默禁用"的自我掩盖逻辑（R1） |
| `src/wallpaper/session.js` | 路由层重写为带归属（ownership）与代号（generation）的操作模型；`stopNow` 立即应答并在队列中等待真正关闭；失败会话保留并上报；disposer 返回清理 Promise（R4、R6） |
| `src/client.js` | 传输层重写：运行代号、503 有界重试、状态通道补齐、迟到响应失效、清理失败状态与重试入口、实时帧数/倒计时与文案补齐、行尾空格清理（R2、R3、R5、R6、R7） |
| `scripts/build-wm-protocol.mjs` | 注入时不再产生行尾空格 |
| `qa/wallpaper/routes.test.mjs`（新增） | 路由时序 8 项（R4、R6） |
| `qa/wallpaper/sdk-contract.mjs`、`sdk-contract.cmd`（新增） | 用**真实**官方 Cordis Context 验证注入声明、路由注册与实际应答（R1） |
| `qa/appearance-wallpaper-regression.mjs`、`qa/appearance-wallpaper-fixture.js` | 浏览器 fixture 可脚本化（503 间隙、流结束、停帧、失败启动/停止）；断言从 30 增至 47（R2、R3、R5、R6、R7） |
| `qa/wallpaper/session.test.mjs` | 路由用例改为经路由停止，避免绕过归属记录 |

## 2. 逐条修复与证据

### R1 官方宿主服务访问没有声明注入

`src/index.js` 现在导出 `inject = ['webServer']`，与官方插件（如 `@deepseek-ai/dsh-openclaw-bridge`）和 QA 包 0.0.7 的写法一致；同时删掉了"缺服务就自行跳过"的分支，避免把契约错误吞成告警。

证据 `qa/wallpaper/sdk-contract.mjs`（用 `qa/wallpaper/sdk-contract.cmd` 跑，需 Desktop 自带 node）：

- `declaredInject: ["webServer"]`、`hasApply: true`；
- 真实 `Context` 中注册到 `/whale-wallpaper`；
- 直接调用该路由：`GET /status` 返回 200 且 `available` 为布尔值；
- `POST /start {scene:"../../etc/passwd"}` 返回 409 `unknown scene`（受约束动作生效，且不触碰 helper、不建窗）；
- `POST /metrics` 返回 204。

### R2 首帧尚未就绪时前端立即停止

`runStream` 现在区分"首帧等待"与终态失败：503、网络异常与流读取失败在**有界首帧窗口**（默认 20 秒）内重试（400 ms 间隔），窗口耗尽才结束并给出原因；`connecting` 状态保持 `running=true`。

证据：浏览器检查中 `fixture.preview.streamScript = ['unavailable','unavailable','ok']`，断言
`streams >= 3`、`running === true`（间隙期间）、最终 `state === "playing"` 且 `rendered > 0`。
真正失败与用户停止后不再重试：`cleanup-failed`、`error` 与 `stopped` 都是终态。

### R3 流结束或超时后最后一帧没有撤掉

状态通道补齐为 `{ onFrame, onStop, onStatus }`，并在终态（`stopped` / `error` / `cleanup-failed` / `idle`）撤销画面层与透明标记；`waiting` 只隐藏画面、保留层，恢复后重新显示。

证据：浏览器检查 `streamScript = ['end-after-first']` 后断言
`state === "stopped"`、`#wm-backdrop` 被移除、`body.dataset.wmBackdrop` 清空；重新开始时挂载的是新层（旧订阅随层一起撤销）。

### R4 Host 路由没有统一管理待启动、关闭与卸载

- 归属锁在**读取请求体之前**取得：并发的第二个 start 立即得到 409，而不是排队等待造成假挂起（真正的并发只建一个实例）。
- stop/unload 递增代号：准备阶段的 start 在建立实例前失效，不会留下窗口；`stop` 立即应答，关闭动作排在该 start 之后执行。
- 关闭期间**保留**归属（session 仍在，`active` 为真），新的 start 被拒绝，直到本轮真正关闭成功。
- 生命周期 disposer 返回清理 Promise，Cordis 的 `runDisposable` 会等待它。

证据 `qa/wallpaper/routes.test.mjs` 8 项：并发开始只建 1 个、准备期间停止不建实例且 start 返回 409、
关闭期间开始被拒且旧窗口先关闭、卸载取消待启动、卸载活动运行在 disposer 返回前已关闭、
关闭未确认时不放行新实例、重试成功后才释放、状态里带真实时限。

### R5 前端晚到的开始响应会使已停止的运行复活

每次 start/stop/切换/卸载都推进 `generation`；start/restart 的响应、解码回调、流回调、绘制调度都带代号，
旧代号一律丢弃；迟到成功会主动请求停止；restart 失败保持 `error` 并保留原因，不再进入连接状态。

证据：浏览器检查中延迟 400 ms 的 start 响应在 stop 之后返回，断言 `running === false`、
状态不再是 `connecting`、没有画面层；另断言失败 restart 为 `error` 且带原因。

### R6 关闭失败被接口丢弃

`closeSession` 保留失败会话与 `lastCleanup`，`/stop` 在 `closed !== true` 时返回 **409**（`failed:true`、
`lastCleanup`、`error`、`session`），并继续阻止新的 start；只有重试成功（`closed===true`）才释放会话。
`statusPayload` 新增 `failed`、`lastCleanup`、`error`。客户端把它显示为"关闭未确认…可再次点击重试清理"，
并把"停止"按钮换成"重试清理"，同时禁用开始/重新开始。

证据：`routes.test.mjs` 的"关闭无法确认"与"重试成功才释放"两项；浏览器检查中 `stopFails` 场景断言
状态为 `cleanup-failed`、文案含重试、开始按钮禁用、重试控件可用、重试成功后恢复。

### R7 帧数与倒计时停在初始快照、文案 undefined

状态行改用客户端实时指标（`rendered`、`seconds`、`decodeErrors`）；倒计时使用**本轮** `session.seconds`
（回退到 `previewSeconds.default` 180 秒，不再用 300 秒上限）；补齐 `previewLimit`、`previewCleanupFailed`、
`retryCleanup` 中英文案，并在绘制后立即推送状态。

证据：浏览器检查中绘制 28→58 帧期间两次文案不同、含真实帧数与"帧/秒"、无 `undefined`、
`seconds > 0`、metrics 已提交 Host。

## 3. 检查结果（无窗口）

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test:sdk-contract`（真实 SDK Context） | 通过：注入声明、路由注册、status 200、非法场景 409、metrics 204 |
| `npm run test:wallpaper-host` | **25 项通过**（session 17 + routes 8） |
| `npm run test:appearance-wallpaper` | **47 项断言通过** |
| `npm run test:appearance` | 30 项断言通过（未回归） |
| `git diff --check`（client.js） | 行尾空格已清理 |

按审查要求，未运行会反复创建真实窗口的整套测试，未安装 rc.3，未修改官方程序或 Profile。

## 4. 包与一致性

- `release/plugins/dsh-whale-mist-0.6.0-rc.3.tgz`，SHA256 见文首；`0.5.0`、`0.5.2`、`0.6.0-rc.1`、`0.6.0-rc.2` 全部保留。
- 包内 10 个文本文件与源码逐文件 SHA256 一致；`assets/wallpaper/WallpaperProbe.exe`
  与 `qa/wallpaper-probe/bin` 一致（`8584655D915ADF36CF25E1588ED695C0C8E7AC2E98AAECBA7728188407129593`）。
- 原生依赖不变：框架依赖构建，需要 `Microsoft.NETCore.App 10.0`。

## 5. 仍未做的实机验收

R1–R7 都是本机 SDK、假会话或隔离浏览器可复现的问题，已在同一层面验证；
安装 rc.3 到日常 Desktop、真实点击开始/停止/重试、观察真实 WE 画面与清理仍需下一轮人工协作。
本轮未创造任何真实窗口，`wallpaper64` 与原桌面壁纸未被触碰。
