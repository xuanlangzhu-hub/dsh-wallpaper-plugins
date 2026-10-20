# 伴随窗R1：隔离访客对照已完成（保留准备记录）

2026-10-19。R2源码补修已[独立复核通过](COMPANION_R2_CIM_SOURCE_REPAIR_REVIEW_20261019.md)。Grok另完成 `rc37-edge-r1-local-plan-2ab2c9c5` 方案交付（约24.1秒，4分钟截止未触发），Codex核对官方来源并准备可审查的隔离实验。**本轮已完成：用户确认无账号提示、亮度80并吸附关闭；生产桥接与自有进程/配置清理确认。已将同一guest参数并入开发源码，31项回归通过。另发现主端dispose认证顺序竞争，单独待补；日常DSH未连接或修改。完整结果见[源码补修复审](COMPANION_R1_GUEST_SOURCE_REPAIR_REVIEW_20261019.md)。以下为执行前准备历史，不作为当前待启动指令。**

## 方向与证据限制

微软[支持文档](https://support.microsoft.com/en-us/edge/sign-in-and-create-multiple-profiles-in-microsoft-edge)确认访客配置适合临时浏览；[BrowserGuestModeEnforced](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/browserguestmodeenforced)说明访客会话可以阻止Profile登录，同时明确该策略并非按Profile生效。因此本插件不能通过全局策略来修复。上述资料也**不证明CLI的 `--guest` 与 `--app` 组合在本机兼容或无提示**；该组合只是本轮待验证候选。

优先在全新临时配置、受控进程和自有loopback上做一次可见对照，既不修改日常Edge账号/配置，也不升级宿主。若访客参数不兼容，不自动退回已出现账号提示的普通模式；记录失败并停止，换窗口宿主或增加依赖需另外作范围决定。

## 已准备的具体实验

证据与脚本：`.tmp/companion-r2-source-review-20261019-b60d9f3f/guest-fixture/guest-experiment.mjs`。

- 默认是无窗口dry-run；只有明确 `--live` 才调用Edge。生产Host/桥接/伴随静态页面来自本轮冻结源码（含已审R2），controller为测试内存替身，不连接日常DSH或Profile，壁纸开始/停止明确拒绝，不读取壁纸库/用户预览图片。
- 仅在独立新配置和App参数中加一次待测guest标志，保留loopback地址和shell:false。窗口标题/页头标明“隔离访客短验”，便于与日常DSH区分；不登录、不自动点击确认、不访问外部页面。
- 可见阶段最多观察120秒；由用户看是否出现账号提示，若页面正常则亮度改80、点吸附。脚本从真实桥接确认内存值及模式，检查原生窗口与配置清理；不把自动结构结果代替用户对账号提示的观察。
- 每阶段有界，父监督210秒硬限/215秒兜底，仅处理本轮自有进程树。清理未知时失败并保留证据，不把强制终止或profile删除当作通过，不操作原WE/DSH或日常Edge。

默认dry-run已执行并正常退出：真实Host、HTTP主/伴随桥接和内存controller走完连接→亮度80→吸附→关闭；窗口适配器为纯替身，没有Edge启动。`guest-dry-result.json`和`guest-dry-supervision.json`保存结果。此项只验证实验载体，不证明真实guest/App兼容或无账号提示。

经用户重新确认当前方便后，才能执行脚本 `--live`。这项实验无需退出DSH或重装插件，用户可继续保持日常rc.35；实验只弹出新的隔离窗口。验收分开记录：账号/同步提示是否消失，真正独立窗口与生产桥接是否正常，本轮PID/配置/创建身份归属及资源终结是否确认。若通过，才进入R1正式源码补修与候选计划；当前不改生产guest策略、不覆盖固定包。

## 实际执行与收尾

用户本轮方便确认后已执行--live，27,515ms正常退出。用户反馈：“没有提示，改成80并吸附后窗口已关闭”。桥接确认连接/80/吸附，自有进程与临时配置均为0，6个原运行身份保持。该实验使用内存controller，不是日常DSH整合验收。main dispose返回unauthorized-main-token的原始结果保持，纯loopback已定位SSE先断、认证会话先失效的可发生顺序；尚未补修，不将其改写为全阶段通过。详见上方复审和guest-live-postcheck.json。
