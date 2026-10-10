# 默认捕获设备静态调查复审：主要事实可采纳，实验方案已收窄

2026-10-10，main@185933d。DS 仅新增一份报告，源码/原生资产/QA/包未变。本轮不运行应用或创建窗口。
原稿见 [DS 静态调查](../dsh-whale-mist/docs/CAPTURE_DEVICE_STATIC_REVIEW.md)，以下修订优先。

## 已核对与口径修正

- 正式 Host 使用默认 Node spawn，未提供 env，按 [Node 官方文档](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)
  继承父环境。不能由此判断哪个变量造成了 GPU 选择。正常注册分支要求 ELECTRON_RUN_AS_NODE=1，
  这是已有条件线索，但捕获子进程的实际环境快照未记录，不能当成 GPU 原因。
- memory/pipe 都在 Program.cs:137 调同一 Native.CreateDevice；设备描述由底层 DXGI adapter 查询得到，
  可确认该 D3D11 设备身份。pAdapter=0 的含义是 [默认枚举适配器](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-d3d11createdevice)，
  不能概括成“全部只由 OS 决定”。帧池接收该 device；不推导所有复制/编码/显示活动都只能在此卡上。
- C 的**采集启动**实际是本会话控制脚本的 Start-Process（Hidden、stdout/stderr 重定向、memory argv），
  不是 measure-phase.ps1 的 `& $helper @Arguments`；后者只是只读窗口查询。C 父 PID 属 PowerShell 的事实保留。
- 原稿表格 139–141 的设备日志是在 137 CreateDevice **之后**，不能列为全部发生在创建设备前。
  创建设备前的 mode 差异包含 stdout 打开及 pipe 的 stdin Task.Run，未发现显式 D3D 选择分支；
  这不排除时序、原生运行库/驱动或启动上下文的间接影响。
- C# 未直接读环境变量不能证明环境只可能由 OS 使用；加载的运行库/图形组件/驱动也未被排除。
- 本轮只读复核 UserGpuPreferences：15 项、相关三个 EXE 名称无匹配项。仅排除**这个用户键中的显式条目**，
  不排除驱动策略、自动分配、其它配置或启动影响。CIM 的分辨率为空也不独立证明完整屏幕接线/输出拓扑。

## 原 V1/V2 的设计问题

1. V1 要同一 source window，但又每轮关闭窗口；首轮关闭后不能继续用同一个 HWND。
   pipe 带 owned-location 且发 stop/EOF 时，Native finally 可能主动关源，也会破坏这一控制条件。
2. V2 的普通 node.exe 由 PowerShell 启动，不等于正式 Electron Host，甚至默认继承同一 PowerShell 环境。
   普通 Node 与 PowerShell 结果相同只能说明这两个受测条件相同，不能排除真实 Host 启动上下文。
3. 一种上下文中两种模式都选同卡，只能说明该条件下“模式单独改变未复现”；不能断言剩下仅父环境，
   或排除模式与上下文的交互。少量重复是复现检查，不是对所有机制的证明。

## 下一步只执行收窄后的 V1（仍待用户确认方便）

- 不安装插件/改 Profile，使用已核过指纹的 rc.23 源码资产 helper，日常 rc.1 保持；新建一个唯一名的
  屏幕外无边框 Lucy 源，由**控制器独占窗口清理责任**，四轮期间保持同一 HWND/PID。
- 同一个持续运行的 Node 控制进程，用完全相同的 env/cwd/stdin/stdout/stderr 接线和 helper 路径；
  顺序 memory→pipe→pipe→memory。每轮有上限的 8 秒、采集 cap 30，唯一改变捕获模式，输出目录各自新建。
  两模式都加同一 `--echo-on-stderr`，从 stderr 解析设备诊断；stdout 两者都及时消费，pipe 按二进制 drain。
- 两模式都使用**有限时长**，不使用 --forever，也不提供 --owned-location；stdin 保持打开至自然结束。
  从而不会因试次间的 pipe 父断连而自动关闭共享源。结束等待 child close、核退出码/设备报告，不杀同名进程。
- 控制器每轮前后只读核验源身份与状态。异常/用户停止时先结束自己持有的 child，再在 finally 关闭唯一源，
  用匹配的名字/HWND/PID 确认清理。不得杀 WE、关闭桌面源、全局 pause 或回收其它任务资源。
  即使控制器失效，child 仍有 8 秒上限；窗口归属账本保留，未确认关闭不写“成功”。
- 输出每轮 adapter/LUID/vendor、PID/父 PID、实际 argv/执行路径/二进制指纹和结果；不采全量环境或凭空补计数。
  只判设备选择，不做性能比较、不冒充正式 DSH 验收。
- 若全相同，保留“此 Node 上下文中模式切换不足以复现”的结论，再另设计能代表正式 Host 的上下文对照；
  若模式稳定对应不同设备，再缩小初始化差异。两种结果都不自动授权 V2 或修改 GPU 绑定。

DS 暂无需重写调查或生产代码。V1 控制器由 Codex 准备与检查，再约用户进行窗口小验证。
没有执行 V1，也没有新 GPU 因果结论。日常状态本轮未动。

原稿与本轮只读快照：`F:/dsh-wallpaper-plugins/.tmp/capture-device-static-review-20261010-103641`。
