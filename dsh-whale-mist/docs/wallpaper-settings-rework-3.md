# rc.4 复审返工：U1–U2 修复与新候选包 0.6.0-rc.5

日期：2026-10-05。范围：只修 `wallpaper-settings-rc4-review.md` 的 U1–U2，未加功能、未安装包、未创建真实 WE 窗口、未退出宿主。
交付包：`release/plugins/dsh-whale-mist-0.6.0-rc.5.tgz`
SHA256：`CADED49E93589D4C8C7CA7DBF2BC1BF766F5FEF9DB9E071C42321ACB3017C2EB`（26 文件，6.93 MB；rc.4 及更早包全部保留）。

## 1. U1 [P1] 首帧超时被应用于整个健康运行

**根因**：`runStream` 在开始时算出一个 `deadline`，watchdog 每次都检查 `now() > deadline`，与 `firstFrame` 无关。
健康预览持续出帧也会在约 20 秒被判 `intake-timeout` 并请求 Host 清理。

**修法**：把两个界重新定义为「静默」而不是「年龄」，并且都由 watchdog 定时器判定：

- 静默超过 `idleTimeoutMs`（默认 8 秒）→ 结束本轮（原因 `no-frames`），撤图并请求 Host 清理；
- 首帧逾期（`firstFrameTimeoutMs`，默认 20 秒，且**仅在没有收到任何帧时**成立）→ 结束本轮（原因 `first-frame-timeout`），
  这样 Host 长时间只回 503 也能收敛；
- 只要还在持续收到帧，两个界都不成立：健康流可以一直播到 Host 自己的时限。

顺带明确一条规则：静默超过静默界就是终态（不再重连自愈）。真正的自愈路径是第一阶段的 503 重试；
首帧之后长时间无帧意味着采集已停、窗口已消失或机器休眠，此时撤图并清理比继续等待更符合受监督预览的语义。
用户随时可以再次点击开始重试。

**反向复现**（复审 `browser-repro.mjs` 的用例，用不改写证据的副本运行）：

| 场景 | rc.4 | rc.5 |
| --- | --- | --- |
| 健康流持续出帧、客户端时钟 +30 秒 | 帧数 1→24，却 `error/intake-timeout`、running=false、Host stop 1 次 | **帧数 1→33，`playing`、running=true、Host stop 0 次** |
| 200 但无任何数据 | error、撤图、Host stop（已通过） | **error（`first-frame-timeout`）、撤图、Host stop 1 次** |
| 首帧后持续停帧 | error、撤图、Host stop（已通过） | **error（`first-frame-timeout`）、撤图、Host stop 1 次** |
| 503 后恢复 / EOF 撤图 / 单轮迟到响应 / 计数与倒计时 | 通过 | 通过（未回归） |

仓库回归新增第 14 项：在 `firstFrameTimeoutMs = 1500 ms` 的检查配置下，健康流持续 4 秒以上（`elapsedSeconds ≥ 4`、
帧数 12→112、时钟 +30 秒）仍为 `playing`、无 Host stop、画面仍在；原有 `gap-then-resume` 间隙恢复用例继续通过。

## 2. U2 [P2] reattach 建立永久报告定时器与重复监听

**根因**：`runClose` 先清掉 `reportTimer`，紧接着 `reattach()` 又给活着的 child 加了一份 stdout/close 监听并
重建每秒写 `preview-status.json` 的定时器；之后关闭成功，child 的 close 回调调用 `stop()`，而 `stop` 因
`cleanupResult.closed === true` 直接返回，新定时器永远不会被清掉，退役会话持续写日志。

**修法**：把采集订阅做成具名、可撤销的一对 `attachCapture()` / `detach()`：

- `attachCapture()` 拒绝重复安装；`detach()` 先停报告定时器，再按名字移除 stdout/stderr/error/close 监听；
- `runClose` 全程保持 **detached**（关闭期间不写运行报告），只有在**关闭未被证明**时才 `reattach()`，
  因为此时采集可能仍在跑、证据仍值得保留；
- 关闭结束无论成败都再 `detach()` 一次，所以成功停止、自然结束、失败后重试成功与卸载都不会留下定时器或监听；
- 没有用 `unref` 代替取消：定时器是真的被 `clearInterval` 掉。

新增 `session.stats()`（`attached` / `reporting` / 各类监听数）供检查与诊断使用。

**反向复现**（复审 `host-repro.mjs` 的定时器跟踪，副本运行）：

| 指标 | rc.4 | rc.5 |
| --- | --- | --- |
| 停止后活动报告定时器 | 1（before 1 / after 1） | **0（before 1 / after 0）** |
| child close 监听 | 2 | **0** |
| 源窗口已关闭 | true | true |

仓库回归新增 3 项：正常停止后定时器与监听归零、失败后重试成功同样归零（且 helper 真的被调用 2 次）、
卸载活动运行后定时器归零；自然结束路径同样断言归零。这些检查通过计数真实 `setInterval`/`clearInterval`
与 `listenerCount` 完成，不使用 `unref` 之类的替代指标。

## 3. 检查结果（无窗口）

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test:sdk-contract`（真实 Cordis Context） | 通过（退出码 0） |
| Host 测试 | **34 项通过 / 0 失败**（session 17 + routes 17） |
| 浏览器侧（WE） | 47 项断言通过；stall / recovery / healthy 三组输出均正确 |
| 原有外观回归 | 30 项断言通过 |
| `git diff --check` | 无行尾空格 |

证据目录：`.tmp/wallpaper-settings-rework-20261005/`（`rc4review-host-repro-after-fix.json`、
`rc4review-browser-repro-after-fix.json`、`browser-repro-u1.mjs` 副本、`sdk-contract.json`、`rc4-package.json`）。

## 4. 本轮证据操作说明

- 复审脚本以**副本**运行（`browser-repro-u1.mjs` 只改输出文件名与 root），未在复审目录执行会写固定结果名的脚本；
- 清理只针对自己创建的精确目录路径（`Remove-Item <exact path>`），没有使用 `browser-*` 一类通配符；
- 复审目录内的 `host-repro.json` / `browser-repro-current-result.json` 本轮未被改写（脚本输出落在本轮证据目录）。

## 5. 包与一致性

- `release/plugins/dsh-whale-mist-0.6.0-rc.5.tgz`，SHA256 见文首；`0.5.0`、`0.5.2`、`0.6.0-rc.1`–`rc.4` 全部保留。
- 包内 10 个文本文件与源码逐文件 SHA256 一致；`assets/wallpaper/WallpaperProbe.exe` 与 `qa/wallpaper-probe/bin` 一致。
- 原生依赖不变（框架依赖，需要 `Microsoft.NETCore.App 10.0`），样例仍只支持 Lucy。

## 6. 仍未做的实机验收

安装 rc.5、真实点击开始/停止/重试，以及 **20 秒以上持续播放** 的实机观察，仍留给下一轮人工协作
（复审要求把长时运行纳入实机清单，本轮只做了加速与加速时钟下的等价检查）。
本轮未创建真实窗口，`wallpaper64`（PID 33272）与桌面壁纸未受影响，日常 Profile 仍是 rc.1，未提交未推送。
