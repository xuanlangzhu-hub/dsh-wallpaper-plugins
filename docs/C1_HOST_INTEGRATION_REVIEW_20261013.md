# C1 正式接入复审：基础检查通过，三个生命周期接缝待补

2026-10-13，Codex。复核 `C1_HOST_INTEGRATION_DELIVERY_20261013.md` 与当前实现。

**暂不打包或实机。** 原生候选构建、93 个 Host 测试及 QA 109/19/5 检查均独立通过，但实际 Host 状态消费与父进程强退仍有可复现问题。只修下面 F1–F3，不重写已验证的 DeleteTab/非阻塞帧策略，不重复独立 40 秒、GPU 或长测。

证据根：`F:/dsh-wallpaper-plugins/.tmp/c1-host-review-20261013-0743847f`。保留 Gemini 交付、Host/原生源码快照、独立候选、检查日志与反例代码。本轮只启动自建无窗口控制台假父/worker，不调用真实 Shell、WE 或窗口 API；日常 rc.24 保留，无安装/提交/推送。

## 已确认的进展

- 正式参数支持 `--taskbar-hide`，预览与 `--forever` 兼容，Host 回退 `WM_WALLPAPER_TASKBAR_HIDE=0` 可用。
- 原生发布当前 JPEG 后调用非阻塞帧策略，共用逻辑保留 F1–F3 的时序修正和单次调度。
- 普通隐藏 warn 不被 Host 判为致命播放错误，新增停止等待及退出未确认分支。
- 独立 `dotnet publish` 退出 0；显式 `WM_WALLPAPER_PROBE_EXE` 指向本轮候选的 Host 93/93 通过，check、SDK 契约退出 0。
- QA 共用接线构建退出 0，109/109 自检、19/19 生成场景、5/5 假 worker 进程检查通过。

以上证明已完成的部分可保留，但 QA 生成场景没有替代新正式 Host/native 的跨进程收尾验收。

## F1 / P1：父进程强退后没有 worker 退出证明，仍允许关闭源

`src/wallpaper/session.js:190` 调用 Node `child.kill()`，没有终止工作进程树或受控容器。原生 `TaskbarWorker.cs:106` 正常创建 worker，监督及 tree kill 在仍活着的采集父进程内；父进程被 Host 杀死后，这段监督不会执行。

同时 `session.js:195` 将 `nativeStatus?.taskbarHide?.cleanupSafe !== false` 当作安全门禁。字段缺失为 true，旧的 armed/safe 状态也可能为 true；父进程退出并不能证明工作进程退出。

独立反例 `real-process-counterexample.mjs` 直接运行本轮 Host 源码快照，通过实际共用 TaskbarWorker 启动一个无窗口控制台父进程及假 worker。把 Host 的等待预算缩短用于复现同一强退分支，假 worker 延迟 1.2 秒写入模拟动作标记，完全不执行原生 Shell。

结果 `real-process-counterexample.json`：父已退出，关源 helper 被调用一次时 worker 仍存活，Host 返回 closed=true；随后该 worker 写出迟到模拟动作。最后假 worker 自行结束，复核剩余 0。另一个仅假边界的缺失状态反例也同样返回清理成功。

修正要求：

- worker 必须在可以执行动作之前建立父丢失监督/终止保障，父强退或异常丢失也不能放任 worker 继续执行。
- 使用本轮精确进程/源身份，不杀原 WE。不能只增大 timeout，或把“父退出”作为子进程退出证据。
- Host 接受明确且属于本轮的终态：已确认未启动 worker，或已确认 worker 退出并 cleanupSafe。缺失/旧状态/未确认一律不能关闭源或释放所有权。
- 实际假进程回归须覆盖父强退、父丢失、启动监督建立期间和无终态；证明工作进程与迟到动作均不存在。

## F2 / P2：worker 已安全结束，Host 仍保留 pending 的不安全状态

原生 `Program.cs:264` 执行 Finish 后，会在 `:302` 的 Summary 中写最终 `taskbarHide`。Host `session.js:378` 只消费 Status，不消费 Summary。最后一个周期 Status 若在动作 pending 时，其 cleanupSafe=false；安全收尾后的 Summary 不会更新这个值。

`host-counterexamples.json` 的 `final-worker-safe-summary-left-pending` 使用正式协议：先发 pending/false 的 Status，停止时发最终 safe=true 的 Summary，然后退出。结果 Host 仍报 worker-unconfirmed，关源 0 次；再次 stop 仍 worker-unconfirmed，无法恢复该轮所有权。

修正要求：终态协议与 F1 门禁一起完成，等待真正的进程退出及 stderr 完整消费后再裁决。不能依赖只等待 exit 事件而丢掉末尾输出；不能拿周期状态的 false 永久阻塞已完成的本轮，也不能一律放行。回归覆盖 pending→终态安全、终态不安全、终态缺失、丢失/坏协议及停止重试。

## F3 / P2：原生 Status 改为嵌套 record，Host 原有字段读取失效

`Program.cs:248` 在默认启用隐藏时把原本的 capture record 包为 `{ record, taskbarHide }`，但 `session.js:382` 仍读取顶层 `value.captureSource`。因此正常窗口采集不再设置 captureStarted，也不会触发已有的收起/核验流程。初始屏幕外路线可以掩盖这一问题，但保留的 capture-then-tuck 回退路线会受影响。

独立协议对照：旧平铺 Status → captureStarted=true、offscreen 调用 1 次；同样的 record 包在正式新协议中 → captureStarted=false、offscreen 调用 0 次。结果保留在 `host-counterexamples.json`，不是由手工假定新格式正常通过。

修正要求：保持原 capture 状态字段的兼容形态，或在 Host 明确解包并分别合并 capture/taskbar 状态；检查新的真实 Program 序列化形态，覆盖初始屏幕外与旧创建后收起回退。不能丢失帧状态、位置核验和原生诊断字段。

## 最小返工与交付修正

只补上述 Host/native 状态协议和 worker 监督/停止门禁，保留现有参数、10 秒单次触发、F1–F3 采集时间判定、warn 和 A2 选择逻辑。新增检查须经过正式入口/真实假进程接缝，不能只再跑一次独立 QA。

交付报告另需修正三处表述：

- “强退兜底进程树杀灭保护”与当前 Node child.kill 不符；修正实现后再按真实机制描述。
- “正常退出实际 ~200–400ms”和“Alt-Tab 与任务栏行为已在离线全闭合”没有正式实机依据，改为合成检查范围/未验收。独立 Lucy 实机不代表正式插件通过。
- 给出真实存在的 QA 证据路径与当前构建输入哈希；报告里的 `F:/dsh-whale-mist/.tmp/...` 与本仓库路径不同，后续复核不能猜路径。

当前 14 个非任务目标保护文件与原基线及复审起点一致，包括活动包/归档、生产资产、Profile、官方/WE EXE 和安装版本。session.js/Program.cs 为本次授权修改目标，不能同时声称这两项还与修前一致。14 个原生构建输入在复审期间未变。候选指纹在 `candidate-hashes.json`；本轮无窗口假进程最终剩余 0，日常安装仍 `0.6.0-rc.24`。

修后交 Codex 再复审，通过后才准备新包与正式生命周期短验。不要安装、开窗、清历史证据或推送。
