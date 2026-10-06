# DS 本轮审查（2026-10-05）

结论：仍需返工，暂不安装/验收 0.0.4。屏幕外放置有短时可行性证据；完整生命周期尚未通过。
本轮审查没有修改实现、安装插件或启动真实窗口。仅核对源码、原始数据，运行选定测试和纯模拟复现。

## 已确认的进展

- 成功 stderr 日志已经按 info/warn/error 分类，旧日志误报问题得到处理。
- 关闭接口增加了测试窗口名前缀/字符限制和唯一同名窗口检查。
- 有标记 `captureSource=window` 的屏幕外采集数据，不能把这轮工作视为无效。
- 报告承认任务栏/Alt-Tab 入口仍在，且 0.0.4 没安装到日常 Desktop；本次检查 Profile 也未引用它。
- 选跑 lifecycle.test.mjs 与 log-journal.test.mjs，现有 20 项检查通过；下面的新时序仍能复现失败。

## 后续复查结果

DS 后续已经补强了大部分问题：原生管道持有 `--owned-location` 并在父端断开时尝试关窗，
关闭结果包含 outcome/closed，窗口动作携带 location/PID，managed 路径使用
`--require-window-item`。这些改动方向正确；生命周期测试也扩展到了 20 项。

仍保留下面的 R1；测试本身目前把它误判为通过。

复审复现（返工后）：挂起 `--we-open` → 等待 `stop()` 完成 → 放开建窗 → 等待 `setup()`。
结果仍为 `windowCreated=true`、`--window-ensure-closed` 只调用 1 次、第一次结果为
`outcome=not-found/closed=false`，且模拟的晚到窗口仍存在；报告为
`Window setup failed: teardown started during creation and the window never appeared`。
这说明返工没有覆盖“首次关闭发生在窗口出现之前”的真实时序，不能以 24 项测试通过替代修复。

---

# 实现者答复（第二轮返工，2026-10-05）

这次先复现再修。审查者的时序确实还能打穿第一轮返工：teardown 只等建窗调用返回，
没有等身份轮询的结论，所以它会在窗口出现之前就决定“没有窗口可关”。

## R1 的处理

改动（`qa/wallpaper-preview/index.js` 的 `cleanup()` 与 managed 建窗段）：

- 建窗阶段现在同时维持两个视图：`polls`（真实采集只等它）和
  `windowAcquisitionWait`（teardown 等的有界裁决）。
- `cleanup()` 在调用 `--window-ensure-closed` **之前**等待该裁决；裁决内部先等建窗调用
  得出结论（最长 6 秒宽限），若仍未返回则继续轮询 10 秒，因此
  「停止时窗口还没出现、之后才出现」的窗口也会被关掉。
- 建窗调用报错时，裁决会抛出该错误，因此不会在失败后继续进入采集；同时
  `--window-ensure-closed` 仍会执行，覆盖「helper 报错但其实建出了窗口」的情况。
- 真实采集不再等 `--we-open` 的返回，避免 helper 卡死时整个生命周期被挂住。

新增/调整的回归（`tests/lifecycle.test.mjs`）：

| 用例 | 断言 |
| --- | --- |
| `stop requested during window creation still closes the late window` | 用真实定时器挂起建窗；先断言 teardown 在 150 ms 内**不会**完成（必须等待裁决），再放行建窗，断言只关一次、`closed===true`、`failure===null` |
| `a window created after teardown started is still closed` | teardown 先启动、建窗后完成，断言窗口最终被关闭恰好一次 |
| `a window that appears after the create call returns is still closed` | 建窗返回后才出现窗口，断言它成为采集源并被关闭 |
| `a failed create call that left nothing behind rolls back and never captures` | 建窗报错且无窗口：不启动采集，仍执行一次关闭尝试 |
| `a failed create call that did leave a window is still cleaned up` | 建窗报错但窗口存在：不进入采集，窗口被关掉并报告 `closed` |

同时修掉测试夹具的一个掩盖性问题：`sleep` 原来是立即 resolve，会造成微任务饥饿，
使「挂起建窗」的场景永远轮询不到窗口，从而**掩盖**R1 的真实时序；现在默认让出事件循环，
需要「建窗保持挂起」的用例改用真实定时器。

## 其余四项在本轮的状态

| 审查项 | 状态 | 证据 |
| --- | --- | --- |
| R2 父端断开后的清理 | 已实现 | 原生 `--owned-location`；`tests/capture-journal.test.mjs` 的 `parent disconnect leaves no source window behind` 自己**不**关窗，只断言采集退出后窗口消失且 `summary.windowClose.closed===true` |
| R3 整屏回退 | 已删除 | `CreateItem` 只接受指定窗口，失败即抛错；`captureSource` 恒为 `window` |
| R4 关闭结果核对 | 已实现 | `outcome` 区分 `closed`/`absent`/`ambiguous`/`identity-changed`/`timeout`；Host 只在 `closed===true` 时算成功 |
| R5 动作身份绑定 | 已实现 | `ApplyAction(hwnd, action, expectedLocation, expectedPid)`；`--window-apply` 带 `--location`/`--pid`；`--self-test-window-ops` 8 例 0 mismatch |
| 报告与验收证据 | 已更正 | 见下节 |

返工中还修掉一个只有真实窗口能暴露的缺陷：`--window-apply` 的入口条件写成参数个数恰好为 3，
带 `--location`/`--pid` 后该分支被跳过、参数被当成采集参数解析，导致「收起窗口」实际失败
（`Window tuck failed`）。已改为 `>= 3`，并由 `tests/window-cli.test.mjs` 三条回归锁定。

## 报告更正

- **09:24 零帧的归因**：审查意见正确。那次对照脚本直接运行采集程序，不经过 preview Host，
  所以 Host 的 stderr 误判不能解释那次 0 帧。报告已改为：那次是现场采集未产生帧的独立失败，
  Host 误判是同期的另一个缺陷，两者不再互相引用。
- **ctl-021135 不能作为「连续 60 秒窗口源」的证据**：该轮没有 `captureSource` 字段且尺寸变化，
  已降级为「方法初筛」；通过结论改由新补测承担。
- **不再宣称 80% 性能门槛通过**：99.5% 是挑选后两对的结果，位置因素未被排除，
  改为「有条件可用 + 负载混杂」。

## 补测（审查要求的那一组）

`qa/wallpaper-preview/tests/redo-60s.mjs`，一次运行内固定同一尺寸后录三段，逐帧要求 `captureSource=window`：

| 段 | 时长 | 帧数 | window 来源帧 | 尺寸 | 稳态 fps | 最大帧间隔 | readback P50 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 可见基线 | 60 秒 | 566 | 566 | 1902×1071 | 8.54 | 2251 ms（47.3 s 处） | 66.29 ms |
| 屏幕外 | 60 秒 | 646 | 646 | 1902×1071 | 9.96 | 188 ms | 66.25 ms |
| 恢复可见 | 20 秒 | 1285 | 1285 | 1902×1071 | 21.46 | 86 ms | 11.33 ms |

- 屏幕外段首次满足「同分辨率 + 明确 window 来源 + 连续 60 秒」，全程无 >3 秒冻结，
  645/646 个帧哈希不同、646 个源时间戳不同。
- 116.6% **不能**读作「屏幕外更快」：逐秒帧数显示两段都在 21–22 fps 与 8–9 fps 两个台阶间切换，
  可见基线在 47 秒处还有一次 2251 ms 停滞。差异来自测量窗口落在不同台阶。
- 结论保持：位置不是吞吐主因，机器负载是；屏幕外可用性成立，性能门槛待空闲机器复测。

## 本轮验证

- `npm test`：38 项通过（含 18 项 lifecycle）。
- `node browser-regression.mjs`：passed。
- `node tests/managed-session.e2e.mjs`（真实窗口）：`failure=null`、`remainingProbeWindows=0`、
  `summaryReason=parent-stop`、99 帧。
- `WallpaperProbe.exe --self-test-lifecycle`、`--self-test-window-ops`：0 mismatch。
- 现场：probe 窗口 0、采集进程 0、用户原有 wallpaper64 保留。

---

# 实现者答复（第三轮：只修 helper 报错后窗口晚到的回滚分支，2026-10-05）

范围：只改这一条分支，未重跑整套桌面实验。

## 问题

`--we-open` 报错时，清理的"有界裁决"会在报错后立刻抛出错误，于是不再做窗口轮询——
「helper 报错」被当成了「没有窗口」。若窗口其实稍后才出现（建窗副作用已发生、helper 只是返回失败），
清理就不会观察它，也就不会有第二次关闭。

## 改动（`qa/wallpaper-preview/index.js`）

裁决顺序改为：

1. 等建窗调用得出结论（沿用原有 6 秒宽限，快路径不受影响）；
2. **先**读完有界轮询 `polls`，必要时继续 `extend`（另有 10 秒上限）；
3. 只有在窗口被观察到时才返回该窗口；否则在建窗失败时抛出原错误。

即：报错不再提前中断观察，失败原因仍然照常上报。另外，建窗失败分支在回滚前会读取裁决里
**已观察到的窗口**，把它的 HWND/PID 交给关闭调用，所以 `--window-ensure-closed` 会带上
`--expect-pid`（只有当窗口真被观察到时才会有这一步）。

## 新增回归

`tests/lifecycle.test.mjs` → `a window that shows up after a failed create call is still closed`：

- 假 helper 带"窗口存在状态"：`--we-open` 先报错（此时窗口不存在），窗口在清理的有界轮询期间才出现；
- 清理发出关闭请求时把存在状态置为不存在（关闭动作本身才是窗口消失的原因）；
- 断言：关闭请求恰好 1 次、参数为 `--window-ensure-closed <本轮名字> 15000 --expect-pid <窗口 pid>`
  （带 PID 即证明是在观察到窗口之后才发的）、`cleanup.closed === true`、轮询次数 ≥ 3、
  **最终窗口不存在**。

## 验证（未跑桌面实验）

- `tests/lifecycle.test.mjs` + `log-journal.test.mjs` + `window-cli.test.mjs`：31 项通过。
- `node browser-regression.mjs`：passed、cleanup true。
- 未运行 `capture-journal.test.mjs` 与 `managed-session.e2e.mjs`（会创建真实 WE 窗口），按本轮要求跳过。
- 交付包更新为 `dsh-whale-wallpaper-probe-0.0.6.tgz`
  （SHA256 `281D814FF8714C2FD2B87F144F2C096C8AA546DE2AD5AD9DB6034ECD50765D98`），未安装。



## 必须修复

### R1 / P1：启动尚未结束时停止，会遗漏晚到的源窗口

位置：`qa/wallpaper-preview/index.js:35-48, 73-84`。

停止和 `--we-open` 同时发生时，清理可能早于建窗完成。当前代码会在窗口出现前调用一次
`--window-ensure-closed`，随后 `--we-open` 返回并把 `windowCreated` 置真；已经完成的
`cleaning` promise 不会再次执行，所以晚到的窗口仍可能留下。

纯模拟复现顺序：挂起 `--we-open` → **等待 `stop()` 完全完成** → 放开建窗 → 等待 setup。
当前结果：`windowCreated=true`，关闭调用只有 1 次且发生在窗口出现前；若 helper 的第一次关闭返回“无匹配窗口”，
真实窗口会留下。现有回归测试的 fake helper 无条件返回 `closed:true`，因此掩盖了这个时序。

要求：停止必须与尚未完成的创建阶段协调，晚到的资源也要回收。回归测试必须模拟第一次关闭时窗口尚未出现，
然后在建窗完成后验证第二次关闭或等价的延迟清理确实发生，并断言最终窗口不存在。
同时覆盖创建发生了副作用但 helper 响应失败/超时的回滚。

### R2 / P1：父 Host 崩溃后没有存活的源窗口清理者

位置：`qa/wallpaper-preview/index.js` 的源窗口归属；`qa/wallpaper-probe/Program.cs:73-79, 198-208`。

关源窗口只发生在 Node stop()。Host 异常退出不会执行 JS 清理；原生端虽收到 stdin EOF，
但 finally 只释放采集并写 summary，没有关闭所属 WE 源窗口。源窗口由原 WE 进程承载，会继续存在。
这不需要“Host 和原生同时被杀”，仅 Host 异常退出就会留下窗口。

要求：给存活的原生组件传递足够且经过核验的本轮归属信息，使其能在父端断开后关闭自己的源窗口，
或采用等价的有限清理机制。隔离父进程测试必须同时断言“采集退出”和“源窗口消失”。
当前 capture-journal 测试由测试代码的 finally 关窗，不能证明自动清理。

### R3 / P1：默认整屏回退仍存在，并使用已释放的 COM 指针

位置：`qa/wallpaper-probe/Program.cs:329-342`。

CreateForMonitor 得到 monItem 后，第 331 行立即 Marshal.Release，随后第 342 行仍将该指针传给 FromAbi。
未指定 --require-window-item 且目标窗口捕获失败时会进入此路径，可能访问失效对象；
回退到整个显示器本身也会把无关桌面内容误作壁纸画面。

managed Host 加了 require 标志，限制了这条路径，但默认命令及部分测试仍未加标志。
要求：本轮应默认只采指定窗口，失败就明确退出。移除自动整屏回退，避免为了产出帧而扩大捕获范围；
如保留其它 COM 诊断代码，也必须保证引用在使用期间有效。

### R4 / P2：关闭失败可能被报告为成功

位置：`qa/wallpaper-preview/index.js:43-44`；`qa/wallpaper-probe/SourceWindowHelper.cs:339-366`。

- 原生关闭超时返回 `{closed:false,error:...}`，但进程可正常退出；Host 只检查 promise 是否抛错，不看 closed。
  纯模拟返回 closed:false 后，实测 report().failure 仍为 null。
- 原生 EnsureProbeWindowClosed 把 RequireUniqueProbeWindow 抛出的所有 InvalidOperationException
  都转换为“无匹配窗口、closed:true”，但“多个同名窗口”的拒绝也属于该异常。

要求：明确区分已经不存在、身份不明确、关闭超时与真正关闭成功。
Host 必须验证 closed===true，失败要留证且不可报告已清理。补 false 返回值和同名歧义的回归。

### R5 / P2：窗口动作尚未绑定调用方预期的本轮身份

位置：`qa/wallpaper-probe/SourceWindowHelper.cs` 的 VerifyTargetIdentity、ApplyAction；
`qa/wallpaper-preview/index.js` 的 --window-apply 参数。

ApplyAction 只接收 HWND，从当前窗口读取标题，再按该标题找唯一窗口核对 HWND。
若旧 HWND 被另一轮合法前缀窗口复用，这些检查仍能全部通过；代码没有与调用方原先的 location 比较。

要求：把预期的唯一名称及必要的进程归属信息传入并核验，不要仅拿窗口当前信息与自身比较。
补“HWND 相同但轮次名/所属身份改变时拒绝动作”的回归。

## 报告与验收证据需要修正

位置：`docs/wallpaper-source-lifecycle.md` 第 3.3/3.4 节与 NEXT_TASK.md 的通过状态。

- ctl-021135 的 90 秒屏幕外日志有 1170 帧，但 **没有 captureSource 字段**，且尺寸从基线 1284×767
  变成 1902×1071。该轮存在整屏回退疑点，不能用它证明“窗口源连续 60 秒”通过。
- int-021550 中明确记录 window 的有效屏幕外段约 12 秒；切换段总长约 20 秒。
  tgl-021834 的约 8 秒 readback 测试不读取哈希，主要证明能取帧，不能代替持续动态内容验收。
- 99.5% 是挑选后两对的结果。第一对 21.47 → 12.49 fps，以及单次切换后的下降，尚不能排除位置因素。
  “确定是机器负载而非位置”超出了现有证据。可报告负载混杂与暂时可用，不宜宣布 80% 性能门槛已严格通过。
- 此次没有官方 DSH 界面验收，报告已承认；不能将采集侧测试等同于 DSH 内持续动态显示。
- 报告把 09:24 的零帧归因于 Host stderr 误判不准确：当时对照脚本直接运行采集程序，
  不经过 preview Host。日志分类确实要修，但不能替代那次捕获失败的原因。

要求：先修代码问题，再只补一组同分辨率、明确 window 来源的可见基线与连续 60 秒屏幕外记录；
仍有负载混杂就如实标注。不要重做所有已有测试，也不要扩大到音频、交互或正式主题设置。

## 审查验证范围

执行：`node --test tests/lifecycle.test.mjs tests/log-journal.test.mjs`，20 passed。
另用注入的假 helper/假 child 复现 R1 和 R4：没有启动窗口/采集，也没有真实关闭任何程序。
未运行会创建真实 WE 窗口的 capture-journal 和 managed-session.e2e。
R2、R3、R5 为源码控制流/资源归属检查；本轮没有执行崩溃注入、整屏捕获或 HWND 复用实验。

请实现者只针对本审查单返工并补证据，完成后再交回审查。不要把当前测试全绿当作上述路径已经覆盖。
