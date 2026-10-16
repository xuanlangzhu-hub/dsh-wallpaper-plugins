# C1 正式接入第二轮复审：普通路径修正，剩余监督与终态两处

2026-10-13，Codex。复核 Gemini 更新的交付报告与源码，并独立重编译/复跑。**暂不打包或实机，只补下面两处剩余边界。** 状态兼容、普通 Summary 消费与普通父强退防止误关源已经确认，不再返工这些已修正路径。

证据根：`F:/dsh-wallpaper-plugins/.tmp/c1-host-second-review-20261013-6dcf3b43`。保存交付与源码快照、本轮候选、原反例适配代码、新的故障注入和输出。没有修改实现、调用真实 Shell/WE、创建窗口、安装或推送。

## 已确认的补修

- 原缺失证明/父强退反例现在返回 worker-unconfirmed，不调用关闭源。
- 原 pending Status→安全 Summary→退出的顺序，能够清理成功，重复停止也正常。
- 平铺 Status 与嵌套 record 都设置 captureStarted=true、收起调用一次；原 F3 已闭合。
- 原生正常建立 Job 容器时，假父强退后没有迟到 worker 入口执行。Host 保留未确认的源所有权。
- 独立候选构建退出 0；96/96 Host、check、SDK 契约通过；QA 构建、109/109 自检、19/19 生成场景、5/5 假 worker 检查通过。

原协议反例代码只适配预期结果，新增边界另列，不覆盖前次失败证据。本轮检查针对普通修复与尚未闭合的失败路径，未重做独立实机。

## F1 剩余 / P1：监督建立失败仍启动，父身份获取失败仍放行

`qa/wallpaper-probe/TaskbarWorker.cs:208` 创建 Job 后，不检查零句柄就调用 Process.Start；`:217` 忽略 Assign 返回 false。进程是先运行、后绑定，仍有未建立监督的启动阶段。

`TaskbarList.cs:128–137` 获取父进程失败后保留 null，而 parentLostOrStop 将 null 当成没有父丢失。此时既没有 watcher，也不会拒绝进入动作检查。正常建立 Job 的成功反例不能证明这些失败路径受控。

独立 `recheck-supervision.mjs` 只在复审副本的 Job 创建/绑定结果边界注入失败，生产文件不改。使用真实共用 TaskbarWorker/TaskbarList，控制台 worker 在进入实际 RunWorkerEntry 前延迟 1.2 秒，模拟进程初始化/调度滞后；父在此阶段强退。动作身份 verify 回调只写标记并返回 false，确保 NativeCalls/COM 不会运行。

`supervision-failure-observations.json` 的三段对照：

| Job 边界 | 父强退后进入真实 worker 入口的 verify 回调 | 真实 Shell/窗口 |
| --- | --- | --- |
| 正常创建/绑定 | 否 | 0 |
| 创建返回零句柄 | 是 | 0 |
| 绑定返回 false | 是 | 0 |

两次失败路径均在父结束后进入 verify，说明缺失父身份被放行；这里只证明执行门禁失败，不声称实际 DeleteTab 已被执行。所有假进程最终退出，剩余 0。

最小补修：容器创建失败在创建 worker 前拒绝；绑定失败终止并确认已创建的 worker，保留真实 started/exited 事实。建立启动握手/等效屏障，监督建立之前 worker 不进入动作。worker 获取/绑定父身份失败直接返回未执行，不允许用 null 表示父仍存活。无需改变 COM 顺序、单次策略或帧循环。

新增回归覆盖 Job create/assign 失败、监督建立前父丢失、父身份取不到及正常取消；不能只再证明 Job 成功时能杀子进程。

## F2 剩余 / P2：正常退出仍可缺证放行，也没有真正等待 stderr 关闭

两处仍未满足前次终态要求：

- `src/wallpaper/session.js:215` 没有 taskbarHide 时仍设 workerCleanupSafe=!forceKilled。因此正常退出但没有终态证明会关源，交付报告的“缺少终态必定拒绝”不符合代码。周期 armed/observing 或 attempted=false 也不能代替属于本轮的最终安全裁决，更不能绕过 cleanupSafe=false。
- `waitForChild` 同时监听 exit/close，且 exitCode 非 null 就直接返回；随后一个 setImmediate 并不等待 stderr close。收到 Summary 的代码已经补好，但可能在最后一段输出到达前就下结论。

`host-counterexamples.json` 新增两例：

1. 正常退出、没有任何 worker 终态：关源调用 1 次，返回 closed=true。
2. pending Status 后先发 exit，再于 30ms 后发安全 Summary 和 close（进程退出与 stdio 关闭的不同阶段）：第一次 stop 返回 worker-unconfirmed；末尾 Summary 到达后重试才 closed=true。此前的永久 pending 已改善，但首次裁决仍早于终态消费。

最小补修：等待真实 close/stdio 完整结束再裁决，跟踪关闭事件，移除残留 listener；不能靠 setImmediate、额外 sleep 或假定 exitCode 已有值就表示输出已排空。只接受本轮明确的终态安全证明（包括已确认未启动），缺失、坏协议、周期旧状态保持未确认；回退关闭隐藏时保留对应无 worker 路径。停止/退出预算保持有界，不影响已有普通 Summary、warn 和状态兼容。

新增回归必须包含缺失证明的**正常退出**、exit→延迟 Summary→close、只有周期安全状态、最终不安全状态、非正常退出及重试，而不只覆盖 forceKilled=true。

## 接续与交付边界

原 F3、普通 Summary 接收、强退时不误关源、参数和 F1–F3 帧时序已通过，不重写。只修监督启动失败和最终状态握手；同一问题修完后再复跑正式接缝，交 Codex 复审。报告中关于 Job 必然保护、setImmediate 保证输出完全消费、缺终态必定拒绝的描述须按最终实现及故障检查修正。

14 个非目标保护文件与复审起点一致；14 个原生构建输入未变；假进程剩余 0，日常仍 `0.6.0-rc.24`。版本/生产 assets/旧 tgz 保留，无安装/提交/推送。编码交付不覆盖已有证据目录、同版本二进制或报告；本轮快照已保存，可用新的输出路径。

修后通过后台复审，才准备新候选和正式生命周期实机；不重复独立 40 秒、GPU 对照或长时测试。
