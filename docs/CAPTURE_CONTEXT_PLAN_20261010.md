# 下午下一轮：真实 Host 与普通 Node 的最小采集对照

已执行完成，结果以 [真实 Host 对照记录](CAPTURE_CONTEXT_RESULT_20261010.md) 为准。
Node 两轮 Intel、Host 两轮 RTX4060；清理/恢复并由用户重开确认。以下保留准备阶段说明。

状态：QA 工具和本机临时包已准备，**未安装、未开窗、无新的 GPU 实测结论**。
接续上午 [V1](CAPTURE_MODE_V1_20261010.md)，不重跑五阶段或长时间验收。

用户选择先保留准备成果、稍后再测。本轮已停止实际操作；未退出 DSH、未修改 Profile。

## 要回答的问题

同 helper、同源、同 pipe 接线与有限时长下，真实正式 Desktop Host 与普通 Node 是否稳定选择不同设备？
这是启动上下文的组合对照，不声称只改变了某一个环境变量。

待区分的线索：

1. Host 可执行文件/运行身份或其图形策略：若这一上下文足以复现，Host 两轮应同卡且与 Node 两轮不同。
2. 继承的环境标志：本轮只记录白名单标志，不交换/删除环境，结果不同仍不能证明某个变量因果。
3. 初始化时序或上下文交互：若两次相同上下文的结果也不一致，不按“固定父进程决定显卡”归因。

## 实施范围

- 保留日常鲸系外观 rc.1，临时增加一个纯 Host QA 插件；没有前端、主题、背景显示或 HTTP 启动接口。
- 插件必须由真实 Cordis 插件树加载：启动进程应为官方 DeepSeek Harness.exe、ELECTRON_RUN_AS_NODE=1。
  就绪记录写出 PID/PPID/execPath/Node/Electron 版本，外部再只读核对实际 Host 进程身份。
  不能单独运行同名 EXE 后声称是正式 Host。
- apply 只报告就绪并等待本轮指令；没有有效、未过期、匹配 token 的票据不采集。
  两次票据使用独立 wx 领取文件；同一目录不可重跑，重新加载也不能重复执行已领取票据。
- Node 控制器创建一个屏幕外 Lucy 源，按 Node→Host→Host→Node 各采集 8 秒。
  同 helper EXE/DLL 指纹、HWND/PID、cwd、pipe/30 上限、--echo-on-stderr、三条标准流接线。
  两侧继承各自环境，**环境不是本轮的固定变量**；只记录 4 个指定标志，不导出完整环境/凭据。
- Host 借用源，永不创建/移动/关闭窗口；唯一源归 Node 控制器最终清理。
  每个采集复用上午检查过的 trial 边界，持续 drain stdout，stdin 保持打开至自然结束。
- STOP、Esc、停用或异常会结束自己的有限采集，等 child close 后写响应。
  若无法确认 Host 完成，控制器保留源归属账本并标记未清理，不冒险关闭仍在借用的源。
  后台人工核验本轮 helper/源身份后再处理；不得杀原 WE 或其它同名进程。

## 本机准备产物

- 控制器：`dsh-whale-mist/qa/perf/probe-context-device.mjs`
- Host 工作者：`dsh-whale-mist/qa/perf/context-device-worker.mjs`
- 隔离检查：`dsh-whale-mist/qa/perf/check-context-device.mjs`，9/9 通过。
  覆盖真实 Host 门槛、票据拒绝、就绪无采集、两次且仅一次、STOP/停用、
  Node/Host 顺序、失败后清理、Host 未确认时不关借用源。旧 trial 检查 13/13 仍通过。
- 新目录：`F:/dsh-wallpaper-plugins/.tmp/context-device-v2-20261010-afternoon1`
- 包：`plugin/dsh-whale-context-device-qa-0.0.1-qa.1791611779015.tgz`
- 包 SHA256：`2C99D24F0836353CEFADA71C1253256CAAC9AF2122A39571144597E3FA8E523B`
- 包仅包含入口、patch、package.json；入口明确引用本机固定 QA 源码。
  这是一次性本机工具，不是可发布的便携插件。实验期间不再编辑这些 QA 源码。
- 隔离证据：`dsh-whale-mist/.tmp/perf/context-check-8sx71I` 与 `mode-check-qSD9Sm`。

## 用户配合与恢复

先确认方便、其它助手暂停、没有运行任务。用户通过应用菜单退出后，备份 5 份 Profile
与关闭状态的外观存储、原 WE 身份、官方 EXE 和正在引用的日常包；再用官方 CLI 添加本轮 QA 包。
用户重开即可，不需要改背景设置或点播放；后台核 Host 就绪，再显式启动控制器。
本轮可能出现任务栏入口/弹窗，请不点击。原桌面壁纸保持；按 Esc 或要求停止即结束。

四轮结束核唯一源和 capture 清理，记录设备与上下文，不比较功耗/完整性能。
用户再正常退出，保留测试后数据，用官方 CLI 移除 QA 包并恢复本轮 5 配置与外观备份；
核日常 rc.1、EXE/原 WE 保留，用户重开确认。不能只还原配置而遗留自动运行的 QA 插件。

运行入口（只有安装就绪并再次确认方便后才执行）：

```powershell
node dsh-whale-mist/qa/perf/probe-context-device.mjs --run --root .tmp/context-device-v2-20261010-afternoon1
```

结果不同：只支持“受测启动上下文能复现”，再决定是否值得继续区分身份与环境。
结果相同：这次最小 Host QA 未复现此前正式播放差异，正式生命周期/参数/时序仍在范围内。
两种结果都不自动授权修改 GPU 绑定或生产选择策略。
