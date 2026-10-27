# 原生侧栏：Host 启动栅栏与显式重新启用协议

2026-10-23，接续[前端有界读取](WALLPAPER_NATIVE_HOST_CLOSE_READ_20261023.md)。本轮只完成 Host 侧关闭栅栏及离线验证，**尚未接前端关闭事务、none 偏好提交或按钮，不可据此发布候选**。日常 DSH0.2.1-rc.2／外观 rc.42／Git Bash0.1.1 保持。

## 为什么不能直接使用上轮读取结果

`close-state` 只覆盖已经到达 Host 的操作。旧 controller 的 start/restart 如果在读取之后才到达，仍可能重新启动。前端局部 pending 为零也不能排除另一旧 controller。因此 `sameRound`／`bothQuiescent` 仍是观察，`canCommit` 仍为 false。

新增 `src/wallpaper/close-fence.js`，在实际 `registerWallpaperRoutes` 接入显式协议。未主动调用 prepare 时，原 start/restart/stop 保持原用法；Host 卸载后的新生命周期请求明确拒绝。没有自动迁移、自动请求、后台轮询或定时释放。

## 协议与旧请求边界

均为 `POST /whale-wallpaper/close-fence/<action>`，返回 no-store，错误使用固定短码，不返回本地路径、命令或原异常。

| 动作 | 严格请求字段 | 效果 |
| --- | --- | --- |
| prepare | hostInstanceId、revision、requestId | 校验 Host 身份和当前修订，先封住启动入口，再调用一次原 stopNow；返回本轮 fenceId 和状态 |
| inspect | hostInstanceId、fenceId | 只读本轮状态；不停止、不重试、不放行 |
| retry | hostInstanceId、fenceId、attempt | 仅在已落定但清理未确认时显式再试；前一 attempt 的重发返回当前结果，不新增 stop |
| activate | hostInstanceId、fenceId、revision | 仅在本轮 ready、修订相符时显式重新启用，返回新的启动凭据；本身不开始或停止 |

prepare 成功表示**栅栏已接受**，不表示清理完成。它不等待可能卡住的原生清理；未落定时返回 pending。相同 requestId 必须带完全相同的原 revision 才可取回原票据，不重新停止。封闭期间另一 requestId 不能抢占；错误 Host、旧修订、缺字段、额外字段均拒绝，不发生停止。

栅栏在读取 start/restart 的 body、取得 ownership 之前检查。已进入的旧请求由 stopNow 同步增加取消代次，继续受现有每阶段检查约束；未到达的旧请求则在入口拒绝。即使 legacy stop 的 pending 为 false，尚未读完 body 的旧操作仍会使栅栏保持 pending，直到实际落定。

ready 要求本次停止有完整有效结果、全部已到达操作落定、实际关闭观察 quiescent，且没有不确定记录。没有窗口时可根据真实 Host absent 状态 ready，不编造 cleanup。清理失败保留 session 和封闭入口；意外异常、损坏结果或失去证据属于 unknown，不因后续健康读取清除，也不允许普通 retry 洗掉。没有超时自动放行。

封闭期间旧 stop 仍可用于清理恢复，不能启动新资源。重新启用后，**start、restart、stop 都必须携带本轮 `x-whale-wallpaper-admission`**；旧版无凭据请求、旧代凭据和重复数组头拒绝。这样迟到的旧补偿 stop 也不会停掉新一轮播放。凭据只在 activate 返回，inspect 不输出它。

下一次 prepare 撤销旧凭据；上一轮票据或迟到 activate 无法重新打开新的栅栏。相同 activate 请求的重发只返回同一凭据，不重复变更。全部状态均属于当前 Host 实例，重建 Host 必须按身份变化处理。这是生命周期顺序约束，**不是针对其它本地应用的身份认证**。

新协议 body 使用独立的有界读取：完整请求最多 1 秒、1024 字节、64 个分块，严格 UTF-8／JSON；挂起、过量空块和损坏编码均拒绝。读取失败仅销毁本次未完成入站请求并清理计时器；调用方断开或等待截止，不会释放已经安装的栅栏，也不会假称已取消被接受的停止。旧播放 body 协议保持。

## 独立负例与补修

先保留负例输出，再改产品代码：

- 首轮 32 项中，损坏 stop 结果缺 payload 的情况被误判 ready；现严格验证结果及 failed 类型，异常 getter 也落 unknown。另一夹具原本在错误状态中仍成功完成实际关闭，并未制造所称的 stop 异常；修正为真实保留失败后，状态读取抛错，未放宽验收。
- `late-close-negative` 复现较新的清理先成功归档、旧清理随后失败时，旧失败丢入 absent。现当失败结果属于已不再由 session 保留的旧 run 时，锁存 unverifiedRetirement；不改变 native 清理动作，不允许晚到失败转正面关闭证明。
- `old-stop-negative` 复现旧补偿 stop 在重新启用后仍能停掉新 run；增加 stop 的代际凭据检查。封闭期间的清理恢复路径保留；真实回环 HTTP 正例改为携带新凭据完成停止。

## 验证与未通过项

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-host-close-fence-20261023-2bc132cd`。最终源码及 QA 副本、指纹、首轮失败、补修负例、各阶段 stdout/stderr 和父监督结果保留，未覆盖旧输出。

新增 `qa/wallpaper/close-fence.test.mjs` **35 项通过**（verified-fence，父监督 1.693 秒）：调用实际 Host 注册与 handler，生命周期底层为 session/原生 IO 替身；一项走真实回环 HTTP 的 prepare／inspect／activate／凭据 start／stop。覆盖尚未到达及 body 未完成请求、创建回滚、并发迟到失败、重复提交、关闭失败和显式重试、未知、Host/票据/修订错误、凭据换代及旧补偿停止、卸载、body 截止／容量／编码等。没有创建真实壁纸窗口或采集。

最终相关检查另 **318 项通过**：

- 广泛 Host 检查正常退出，225 项中 210 通过、15 失败（16.334 秒）；通过部分包括原 close-state 28 项、实际路由、清理恢复、媒体桥、库／类型／作者等。
- 原 session 37 项完整分为不重叠的 18／19 项，分别 8.281／9.452 秒通过；用原始 QA 名称生成并核对匹配，不改旧测试。前端读取／命令观察 50 项、来源 21 项通过。
- 两个修改模块语法、两个生成同步检查和 CSS 检查通过。client／生成模块未改，本轮没有重跑原 119 项浏览器 SDK，也不把历史成绩算作本轮新验证。

合计 **353 项通过、15 项失败，不能称整体全绿**。15 项全部来自 probe-cli.test.mjs，期待的 `qa/wallpaper-probe/bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.exe` 不存在，WM_WALLPAPER_PROBE_EXE 未配置；输出 no-output／空消息。输入证据在 probe-cli-input.json。没有重复重试、构建原生 EXE、替换生产 assets 或改允许失败规则；原生参数／二进制检查保留为未通过。

更早一次合并 routes/session/cleanup/media/close-state 在原 20 秒父监督触发后结束（exitConfirmed:true、timedOut:true），没有记成功或提高期限。修补迟到失败／旧 stop 后，按独立测试分段完成受影响源码检查；分段不是删除负例。原失败与可能未经过正常 after 的自有临时夹具保留，不批量清理。后续阶段均确认退出，无正在等待用户处理的测试进程；未全局终止 Node、Edge、DSH 或 WE。

## 输入保护与下一步

269 项开工输入中仅 session.js 变化，**268 项保持**；新增模块与 QA 两项。session 原内容除六处明确增量外保持（审计对比规范化换行）；原生会话／worker／窗口／帧处理代码保持。client、原 QA、作者执行器、侧栏／生成器、manifest／生产 assets 及官方冻结输入保持。最终保护清单含 271 项，见 change-audit.json／protected-after.json。

- session.js：`9BEE5F07A6B311B917696BCDB45A90DB0167C126BFF23E68C9756CA44CD89038`
- close-fence.js：`2977C6500FDF09508E43836008E9F9CC442AB1920E7767F91F60F79FC6A7B4C9`
- 新 QA：`13189A8CD7A646A45ABD78DCC88A856924BC9C4585D2F52122932548389C7FDE`

下一步仍是**前端关闭事务与专用零额外 stop 提交**：统一命令入口要接凭据，先处理 pending／写未知／旧 controller 和取消／迟到，再由当前 controller 消费本轮封闭证明；none 写入与持久化失败必须诚实反馈，不走旧 set background 路径重复停止。重新启用只能来自新的显式意图，不能在超时、取消或补偿中自动 activate。prefs／选择／主题 A→B→A 和卸载均需拒绝旧提交，且不能覆盖之后的新设置。还需设计持久化提交与 Host 栅栏的消费边界，不能把 ready 直接提升为 canCommit。

在该完整链路离线闭合前，不挂关闭按钮、不启用这个协议、不构建候选；旧通用 setter 也尚未因此变成安全关闭入口。原生参数缺失 EXE 的检查另留待适当构建／候选阶段，不为本次 Host 逻辑补修改日常环境。

本轮未安装／发布／操作日常 DSH 或 WE、改 Profile／版本／生产 assets、提交推送清理、联系其它助手或恢复定时。源码／替身／回环协议检查不代替实机、视觉及长期验收。
