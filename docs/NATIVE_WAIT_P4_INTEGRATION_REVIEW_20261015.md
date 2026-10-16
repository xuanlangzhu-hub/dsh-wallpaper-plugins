# P4 正式等待接入复审：保留方案，局部补修

日期：2026-10-15。对应[接入交付](NATIVE_WAIT_P4_INTEGRATION_DELIVERY_20261015.md)及[原任务书](GEMINI_NEXT_NATIVE_WAIT_P4_INTEGRATION_20261015.md)。

**暂不准备新候选。** 正常 pacing 的接入位置、单等待线程、异步 continuation 和 QA 链接实际生产类的方向可以保留；以下两个运行反例和资产门禁需要局部补齐。无需重写 P3/P2、重新调查 GPU 或重跑长测。

## R1 [P2] 回退后 Dispose 没有结清已接收的等待

位置：`dsh-whale-mist/qa/wallpaper-probe/NativePacingDelay.cs:79–96,149–169`。

回退分支把外部 token 直接交给 Task.Delay，组件自身的 lifetime/stopping 在创建失败路径中为空。Dispose 只标记 disposed/cleanupFinished，不能取消 pending 的回退任务。

Codex 对本轮独立构建的实际 `WallpaperProbe.dll` 调用：

```text
new NativePacingDelay(forceFallback: true)
DelayAsync(5000, parent.Token)
Dispose()                           -> 0.1608 ms 返回
等待 150 ms                          -> Task 未完成，也未取消
```

随后由控制程序主动取消 parent token 才结清任务；同一程序集的“父 token 取消”正例通过。这里证明的是 Dispose 自身不能履行已接收任务的退出契约，不是说普通父停止取消已坏，也不把 5 秒故障用例当作实际每帧等待时长。

请让回退后端同样具有实例退出取消/结清机制，包含接受后尚未完成、在途和重复关闭的回归；保持单 pending、异步 continuation、正确的后端诊断。不能只把测试改成先取消外部 token 再 Dispose，那样没有覆盖本反例。

## R2 [P2] 原生 cancel 失败没有在当次等待上暴露

位置：`dsh-whale-mist/qa/wallpaper-probe/KernelWaitTimer.cs:90–98`，以及 `NativePacingDelay.cs:119–131`。

CancelWaitableTimer 失败时 finally 只写 LastCancelError；工作线程仍把当次任务置为成功，下一次 Wait 才读取这个错误。如果当次之后就停止或退出，没有下一帧请求，这次清理失败就不会进入调用方的错误处理。

实际编译组件反例：

```text
timer.SimulateCancelTimerFailure = true
await delay.DelayAsync(2)           -> success
delay.LastCancelError              -> 87
下一次 DelayAsync(2)               -> Win32Exception
```

现有 34 项自测在这个路径只断言“记录错误、下一轮拒绝”，所以仍能全绿。请通过当次等待的失败结果，或实际调用方必消费的明确失败状态暴露清理错误，并验证不再发起下一帧就停止的情况。已有主异常/取消原因也要保留；保持线程退出后才关句柄，不扩大 Host 超时。Set 失败、watchdog 超时及原生父取消的独立正例均通过，保留即可。

## R3 [P2] 资产已恢复；固定哈希门禁和交付基线仍需纠正

原任务要求生产 assets、版本及三个 tgz 不动。接入前冻结清单与不可变 rc.30 归档一致，但复审开始时三个工作区资产回到了较旧字节：

| assets/wallpaper 下的文件 | 复审开始时 SHA-256 | 接入前/rc.30 SHA-256，现已恢复 |
| --- | --- | --- |
| WallpaperProbe.dll | D7353A75665DCCD9D6263C10FE3CFC18D176572EBBE0AED2B4A1691D5DF39968 | FD69D9B9C42376A99A29DAFCFA53071CB282F21D5FBF29FC738405646581FF34 |
| WallpaperProbe.exe | F172D2BC60701ADB4479E2E12EE296799F149B09B80C3EE3B5731F5EA30AE117 | C2727F2BAD7CA64F97059BE781F4E2DE5214440BD94B704D58993FD0A1C12731 |
| WallpaperProbe.deps.json | DBAE96C2749E21B384824B411B55D5954BE8A85FC47C0BBBE01028AFD4270D96 | 8356139AA4F13D3C11051CEB2DF5C22B1AC7F9A0E87CDAE003095960698EEB95 |

Codex 已备份复审起点字节，再只从原 rc.30 tgz 恢复上述三份工作区资产；未改日常安装或原归档。见证据 `asset-restoration.json`。

`dsh-whale-mist/qa/perf/check-native-pacing.mjs:853–863` 本轮把固定白名单改为旧 DLL 的 D735… 和 rc.28 的 1B33…，未包含实际接入前 rc.30 的 FD69…。恢复正确资产后，P3 测试 1–4 通过，第 5 类在第 862 行固定哈希断言失败。这是资产门禁陈旧，不能当作 P3 指标回归，也不能再次回退资产来过检查。

请只修这段保护检查，绑定已核对的接入前资产/不可变 rc.30 清单，并验证隔离构建前后保持；不能任意信任当前资产自报基线。不改 P3 指标与分析语义。后续交付纠正“不曾碰 assets”及旧哈希陈述，记录偏差与已恢复状态；保留本次交付作修前证据。

## 已通过的核验与边界

- 独立构建实际 helper：0 警告、0 错误；实际 helper 的作者 34 项等待自测全部通过。
- 实际编译组件的 6 个独立控制：上面两个反例不满足契约；回退父 token 取消、原生 Set 失败、watchdog 超时、原生父取消/Dispose 四个正例通过。最后一项约 0.9434 ms，线程退出和句柄关闭为 true。
- 实际 helper 的 P3 自测通过：R1 预算控制通过、22 个快照字段保持。`npm run check` 通过。P3 套件前四类通过，第五类只在上述资产白名单处失败。
- 对比接入前 rc.30，Program 仅新增 self-test CLI、capture 作用域的等待实例/一次诊断，及普通 pacing 委托替换。空帧 2 ms Task.Delay、预算/整数截断/最低 1 ms、30fps 上限和 P3 口径保持。
- 未运行真实 WGC 或 Program 的完整父 EOF/stop 入口。本轮证明的是实际组件取消/故障行为，不能称完整 capture 生命周期实机已验收。作者 `.tmp/p4-probe-seam-check/` 目前只有 P3 status/summary，不能替代新增父停止接缝。补 R1/R2 时，用真实共用调用路径及隔离假接口覆盖正在等待时父停止/退出即可，不开真实窗口。

正常等待精度改善的隔离方向保留；此次未做实际 DSH 帧率对照。用户的另一个问题是壁纸响应鼠标移动时画面停近一秒；源响应与传输/显示延迟尚未分开，不能改称鼠标光标/DSH UI 卡顿，也不能宣称 P4 已解决。

## 证据与保护

本轮目录：`F:\dsh-wallpaper-plugins\.tmp\native-wait-p4-review-20261015-135958-4004c01b`。

- `before.json`、`source-reviewed/` 固定 25 份输入；`native-source/`、`build/`、`build.log` 保存实际构建。
- `controls/Program.cs`、`independent-controls/results.json` 保存两个反例和四个正例；测试窗口数为零，未运行 capture。
- `author-self-test/`、`p3-self-test/`、`check.log`、`p3-check.log` 保存各项结果。
- `assets-before-review/`、`asset-restoration.json` 保存三份资产的备份及恢复证明。
- `final-protection.json`、`daily-final.json` 为结束核对：25 审查输入保持，53 保护文件匹配接入前，另 1 份作者改动的 QA 门禁保留修前字节；五份 Profile 保持，日常 rc.28 的 28 个安装文件与活动包一致。

日常仍 rc.28，工作区版本仍 rc.30；rc.28/rc.29/rc.30 三归档保持。本轮仅复审、保存证据、恢复三份越界工作区资产及更新接续文档；未修改作者接入实现/修前交付或 QA，未安装/操作 DSH 或 WE/改 Profile/打包/提交/推送/自动向其它助手发消息。

## 下一步

Gemini 只补 R1、R2 的组件及共用调用路径回归，纠正 R3 的门禁和后续交付；保留正常方案。资产已经恢复，不要再回退或发布新 assets。修后独立构建、受影响自测和短等待对照，保存原始证据，再交 Codex 复审；通过后才另外准备新候选和约实机。
