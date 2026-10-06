# B rc.9 续审：主要修复通过，边界仍需补齐

日期：2026-10-06。结论：**暂不通过，DS 小范围返工 T1–T4；暂不进入日常安装与 35 分钟长跑。**
旧 R1/R4/R5 已验证修复，R2/R3 原有复现场景也通过；下述补测发现它们的边界仍不完整，以及原生入口的约束 / 兼容问题。
本轮未改实现、未安装候选版、未操作用户鼠标或真实壁纸窗口。

## 已验证的进展

- rc.9 包 SHA256：2B2188E54B37E9615B913EE1BFFAAD8B092472319E2CBD4686FB543367297376。
- 包内 26 文件与当前源码 / 资产一致。包内 helper 使用真实解析器接受生产日常与预览 argv。
- 上轮四个独立复现现在符合预期：本轮勾选启动数 0；手动停止后迟到回复不再启动；
  首查网络失败后就绪会启动一次；旧存储缺模式迁移为 preview。
- 日志自检保留 4845..4990 的每 5 帧采样与 4991..5000 完整密集尾，capacity=40，retained=40，失败数 0。
- npm run check、Host 42 项、壁纸浏览器 136 项已独立复跑通过。
- 35 分钟长跑、DSH 完整重开与初始屏幕外闪窗仍未验收。

证据：`F:\dsh-wallpaper-plugins\.tmp\b-daily-rc9-review-20261006-153258`。
有效旧用例复跑为 original-cases-repro.json；新增边界为 additional-cases.json；
native-parser-repro.json、echo-compatibility-repro.json、frame-log-selftest.json、reviewed-source 与 unpacked 保存对应结果及快照。

## T1 [P2] HTTP 错误 JSON 被当就绪，单次查询也没有应用级截止时间

位置：`dsh-whale-mist/src/client.js:674–682`、`2588–2594`。
loadHostStatus 直接解析并返回 response.json，没有判断 response.ok；
自动播放只排除 available===false，所以 503 的 `{error:'service-starting'}` 会被当成就绪。
接着 started=true，向尚未就绪的 start 发一次失败请求，后面的就绪重试不会继续。

隔离浏览器补测：status/start 在前 1 秒返回 503 错误 JSON，随后恢复正常。
实际提前发 start 一次并进入 error；6.4 秒后状态查询仍为 2，成功启动 0（应为 1）。
这是旧网络抛错场景以外的真实 HTTP 错误分支；交付报告声称已经校验 HTTP 成功，但代码尚未做到。

此外，loadHostStatus 没有 timeout / AbortSignal，一次 fetch 或 json 读取不结束时，
starting 会一直等待，最多 5 次的计数并不提供总等待截止时间。
补测观察 7.6 秒后两条状态查询仍悬挂；结合源码确认没有应用级超时。
该观察时长不等于宣布浏览器网络永远不返回，而是指出应用自己没有保证有界结束。

要求：验证 HTTP 成功与有效的 available 布尔值；只把明确 available=true 当成可启动。
为就绪请求及读取设置超时、取消与总截止时间，失败走有界重试；用户停止 / 来源或模式变化 / 卸载后可取消。
补 503/404 错误 JSON、200 无效结构、抛错与永不回复的用例，确认恢复后仅启动一次，放弃后不迟到启动。
不会创建窗口的就绪查询重试与已经发出真实启动的重试要分清，保留当前单轮资源归属。

## T2 [P2] 日常→预览→日常期间的旧自动请求仍会生效

位置：`dsh-whale-mist/src/client.js:2503–2518`、`2588–2594`。
用户操作代号只为背景来源、开始 / 停止等递增，没有记录模式离开日常。
等待回复时只看最后的 settings.weMode；切到预览再回来，会通过检查。

用真实、未禁用的模式 select 回调复现：自动状态查询被延迟，用户切 preview 再切 daily，
释放旧回复后启动数 1、状态 playing；应保持取消，启动数 0。
这不满足 R2 与任务文档的「离开日常模式后，旧自动请求失效」。

要求：实际模式变化绑定用户意图代号 / 取消自动资格，不能仅检查回复到达时的最终值。
补模式往返与单向切换、回复前后交错；保留亮度等外观参数修改不触发重新播放的行为。

## T3 [P2] 原生日常入口仍允许脱离父管道和资源归属

位置：`dsh-whale-mist/qa/wallpaper-probe/CaptureArguments.cs:59–64`；`Program.cs:116–122`、`257–261`。
当前真实解析器接受 forever + 默认 disk + 无 owned-location，也接受 forever + pipe + 无 owned-location。

这两种组合分别不建立 stdin 停止监听、或不能在父断开后关闭所捕获的源窗口；
无限模式还不轮询 Esc。常规 Host 的 pipe＋owned 路径正确，本项不声称该路径已经泄漏。
问题是新增原生日常入口没有实现任务文档要求的「绑定唯一资源归属及父进程停止通道」。

包内 --parse-check 的确认结果：unownedDisk 与 unownedPipe 均 ok=true、forever=true、ownedLocation=null。
这里只验证参数与代码分支，没有实际启动无归属无限采集。

要求：无限日常模式要求 pipe 与合法 owned-location；缺任一项拒绝，或者实现明确等价的父生命周期与资源归属保证。
有限时长的 QA 模式继续兼容 disk/memory/readback 等。补真实解析器的有效 / 拒绝组合断言。

## T4 [P2] 参数重构漏掉旧 --echo-on-stderr，有限 QA 兼容回归

位置：`dsh-whale-mist/qa/wallpaper-probe/Program.cs:100–106` 与 CaptureArguments.Parse。
Program 仍识别 echoMode，但新解析器只剥离 owned-location，不剥离 --echo-on-stderr，
它会成为多余位置参数，导致 Usage 拒绝；旧程序原本支持该标志。

占位 HWND=0 的同形预览参数对照：rc.8 越过参数解析后报 Target HWND 无效；
rc.9 的真实解析器直接报 Usage。没有创建真实窗口或进行采集。

要求：公共解析器兼容该旧可选标志，同时保留 echo 诊断行为；未知 / 冲突参数仍拒绝。
补带 echo 的有限预览及组合 owned-location 的用例，避免又只测日常 happy path。

## 下一次交付

只补 T1–T4，不重新铺开 B 或其它阶段。建议下一包 rc.10（已存在则递增），保留 rc.8/rc.9 与全部旧证据。
补齐失败回归后，跑受影响的 Host、真实解析器、真实控件与就绪边界检查；修后再交 Codex。
新测试及复现输出使用新目录，不能覆盖本次 additional-cases.json 或原 rc.8 JSON。
交付报告区分已证明的旧问题修复与尚待实机的 35 分钟 / 自动启动 / 闪窗，修正本地文档链接。
代码通过后再配合用户安装与实机验收，日常暂保留 rc.1。
