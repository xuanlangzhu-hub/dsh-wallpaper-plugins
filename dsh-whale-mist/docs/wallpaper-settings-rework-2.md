# rc.3 复审返工：T1–T4 修复与新候选包 0.6.0-rc.4

日期：2026-10-05。范围：只修 `wallpaper-settings-rereview.md` 的 T1–T4，未加功能、未安装包、未创建真实 WE 窗口、未退出宿主。
交付包：`release/plugins/dsh-whale-mist-0.6.0-rc.4.tgz`
SHA256：`7CCBD38553C80DE35BC2A57492F8E563F5151B1EE018E47829D533F4ABDC162C`（26 文件，6.93 MB；rc.3 及更早包全部保留）。

## 0. 需要说明的一次操作失误

清理本轮浏览器临时 profile 时，我用了 `Remove-Item .tmp\wallpaper-settings-rereview-20261005-191850\browser-*`，
误删了复审目录里的 `browser-repro.mjs` 与 `browser-repro.json`。
脚本内容已从会话记录**逐字恢复**为 `browser-repro-restored.mjs`（仅新增一行说明，输出改写到
`browser-repro-restored-result.json`，避免再覆盖复审证据）；原始 `browser-repro.json` 无法逐字还原，
但其中的失败结论已完整记录在复审报告与本报告中。以后不再用通配符删除他人证据目录。

## 1. 逐条修复

### T1 路由只检查锁、没有在读取请求体前取得锁

**根因**：`claim('start')` 发生在 `startOperation` 内部，而请求体在此之前就已 `await` 读取。两个请求可以同时通过
空的 ownership 检查，各自读完正文后分别建实例；stop/unload 在正文挂起期间看不到任何待启动操作。
`generation` 只能约束已经拿到 token 的请求。

**修法**：ownership 的取得提前到**读正文之前**，并覆盖「读正文 → 准备目录 → 创建实例」全过程：

- 请求进入时先 `claim('start')`，再在同一个 token 内 `await readJsonBody`；
- stop / unload 先递增 `generation`，使这个 token 失效——即使正文还没到；
- `stopNow` 只等待**已经开始建窗**（`token.started`）的启动；正文尚未读完的启动不阻塞停止应答；
- 卸载 disposer 同理：不为一个连正文都没发完的客户端等待，返回前仍完成真实清理。

**反向复现**（复审脚本 `host-repro.mjs`，同一份代码、同一份断言）：

| 场景 | rc.3 | rc.4 |
| --- | --- | --- |
| 两份正文同时放行 | 200, 200；建 2 个；停止后仍留 1 个 | **200, 409；建 1 个；停止后 0 个** |
| 正文未读完先 stop | stop 200，start 仍 200 并建实例 | **stop 200，start 409，不建实例** |
| 正文未读完先 unload | start 200 并建实例 | **start 409，不建实例** |

仓库回归另加 3 项（`qa/wallpaper/routes.test.mjs`）覆盖同样三种时序。

### T2 “重试清理”没有重新执行真正的关闭

**根因**：`createPreviewSession.stop` 用 `cleaning ??= ...` 永久缓存第一次的 Promise，第一次 `closed=false` 之后
再停只会拿到旧的失败结果，helper 根本不会再被调用。旧 routes 测试的可变假 stop 遮住了这一点。

**修法**：清理只在**进行中**幂等，结束后允许新的受约束关闭尝试：

- `cleaning` 在完成后归零；已 `closed=true` 的直接返回结果；
- 每次尝试都沿用同一个窗口名与 PID 校验（`--window-ensure-closed <name> 15000 --expect-pid <pid>`），
  并在结果里带上 `attempts`，失败证据保留；
- 重试前先 `reattach` 仍在运行的采集子进程（重新挂上 stdout/close/report），避免在进程还活着时就去关窗。

**反向复现**（真实 `createPreviewSession` + 假 helper）：`first=false`、`retry=true`、
`helperCloseCalls=2`、`sourceStillVisible=false`（修复前为 `false/false/1/true`）。

### T3 自然结束且清理成功后，“开始预览”仍被拒绝

**根因**：时限到达/采集自然结束时 session 自己完成了清理，路由却一直持有它；`startOperation` 只要 `session`
非空就拒绝，于是界面已停止而接口仍报“正在运行或仍在清理”。

**修法**：新增 `releaseFinishedSession()`——当且仅当该轮**已经尝试关闭且证明窗口已关闭**
（`state().cleanup.closed === true`）且没有进行中的 stop 时，归档结果、释放归属，允许新的开始；
清理仍在进行或关闭未被证明的会话继续阻止新开始。状态查询与开始两条路径都会先做这一步。
另外，状态载荷在会话仍被保留时直接读取该会话自己的关闭证据，所以自然结束后的失败也不会显示成成功。

**反向复现**：`sourceClosed=true`、`reportedActive=false`、`startStatus=200`、`instances=2`（修复前 startStatus=409）。
另加用例：把旧关闭结果改成 `closed=false`（超时）后，接口必须继续拒绝新开始并保持 `failed=true`。

### T4 开放的停帧连接绕过超时，旧画面继续显示

**根因**：20 秒 deadline 只在 fetch/非成功响应/读取异常分支检查；200 之后 `reader.read` 一直挂起就没有任何计时器，
可以无限 `connecting`；已经画过一帧时 `pollTimer` 也不看 `lastFrameAt`，于是永远显示最后一帧与 playing；
即使判定失败，也没有请求 Host 清理已启动的资源。

**修法**：把两个界都改成**独立于 `reader.read` 的定时器**，并且都读客户端时钟：

- 无帧超过 `idleTimeoutMs`（默认 8 秒）或超过首帧窗口 `firstFrameTimeoutMs`（默认 20 秒）时，
  立刻撤销失效画面（`onStall` → 隐藏画面层）、中止该次连接并结束该轮；
- 结束走终态失败：状态 `error`（原因 `no-frames` / `intake-timeout`）、撤层、清透明标记，
  并**请求 Host 停止清理**；关闭未被证明时显示 `cleanup-failed`，不会被吞掉；
- 首帧窗口内恢复出帧则继续播放（`no-frames` 分支重连、重置时钟）；用户停止、新代号、卸载后
  旧监视器立即失效（定时器先查 `generation`）。

**反向复现**（复审脚本，加速客户端时钟 30 秒）：

| 场景 | rc.3 | rc.4 |
| --- | --- | --- |
| 200 但无任何数据 | `connecting`、running=true、0 次 Host stop | **`error`、running=false、标记清空、Host stop 1 次** |
| 首帧后持续停帧 | `playing`、画面仍在、标记仍在、0 次 Host stop | **`error`、running=false、层已移除、Host stop 1 次** |

仓库回归另加：`open-silent`、`stall-after-first` 两种 fixture 行为 + `gap-then-resume` 恢复用例
（间隙内恢复出帧后回到 `playing`、画面重新呈现、没有多余的 Host stop）。

## 2. 检查结果（无窗口）

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test:sdk-contract`（真实 Cordis Context） | 通过（退出码 0） |
| Host 测试 | **31 项通过 / 0 失败**（session 17 + routes 14） |
| 浏览器侧（WE） | **47 项断言通过**，另有 stall/recovery 结果全绿 |
| 原有外观回归 | 30 项断言通过 |
| `git diff --check` | 无行尾空格 |

新增/加强的回归：并发正文、正文挂起期间 stop、正文挂起期间 unload、真实 session 的“失败一次后重试成功”、
自然结束后可再次开始、未证明关闭继续阻止、开放静默连接、首帧后停帧、间隙恢复。

证据目录：`.tmp/wallpaper-settings-rework-20261005/`（`rereview-host-repro-after-fix.json`、
`rereview-browser-repro-after-fix.json`、`sdk-contract.json`、`rc4-package.json`）。

## 3. 包与一致性

- `release/plugins/dsh-whale-mist-0.6.0-rc.4.tgz`，SHA256 见文首；`0.5.0`、`0.5.2`、`0.6.0-rc.1/2/3` 全部保留。
- 包内 10 个文本文件与源码逐文件 SHA256 一致；`assets/wallpaper/WallpaperProbe.exe` 与
  `qa/wallpaper-probe/bin` 一致。
- 原生依赖不变（框架依赖，需要 `Microsoft.NETCore.App 10.0`），样例仍只支持 Lucy。

## 4. 仍未做的实机验收

T1–T4 都在本机 SDK、真实 session 实现或隔离浏览器层面复现并修复；安装 rc.4、真实点击开始/停止/重试、
观察真实 WE 画面与清理仍需下一轮人工协作。本轮未创建真实窗口，`wallpaper64`（PID 33272）与桌面壁纸未受影响，
日常 Profile 仍是 rc.1，未提交未推送。
