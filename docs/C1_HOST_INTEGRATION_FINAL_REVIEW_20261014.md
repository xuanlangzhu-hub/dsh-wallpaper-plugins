# C1 正式 Host 接入复审通过

日期：2026-10-14，Codex。

**第三轮复审剩余 F1、F2 已闭合，可以准备新的 rc.27 候选。** 本轮独立编译与无窗口检查通过；日常安装仍为 rc.24。尚未打包、安装或做正式 DSH 生命周期实机验收。

证据目录：`F:/dsh-wallpaper-plugins/.tmp/c1-host-fourth-review-20261014-0ff78514`。交付报告、Host 与原生源码快照、独立候选、完整日志和检查结果均已保留。

## 复审范围

对照第三轮复审，本次原生输入仅 TaskbarWorker.cs、TaskbarList.cs、TaskbarHideStrategy.cs 有新改动；Host session.js 增加明确未尝试动作的 observing 终态接纳，相关 Host/QA 自检补充。既有帧策略、身份验证和 close/stdio 终态等待保留。

## F1：执行前监督授权屏障通过

父侧在启动前创建并重置同步事件，仅在 Job 绑定成功后发送授权。子侧必须同时满足父仍存活、无停止请求、已收到授权，才进入真实共用的 RunTrace/ExecuteCalls。

`recheck-supervision.mjs` 使用本轮 TaskbarWorker 与 TaskbarList 源码副本，只在 Job/授权失败边界注入故障，把 NativeCalls 替换为无 COM 的假 ICalls。实际进程创建、父身份检查、授权事件、worker 入口、退出监视和 Job 绑定均保留。

9 个场景通过：正常绑定、Job 创建失败、立即绑定失败、延迟绑定失败、延迟绑定成功、父在授权前退出、授权前收到停止、授权事件创建失败、未发送授权。

- 两种成功场景中，假 HrInit/DeleteTab 均只在确认绑定后各执行一次。
- 其余七种场景中，verify 与假 ICalls 均未执行。
- 父丢失检查只终止自建测试父进程；子进程按实际入口退出。全部测试 worker 按 PID/StartTime 核验已退出。
- `supervision-result.json` 保存逐项事实。真实 Shell 动作和窗口操作均为 0，不以假调用成功代替桌面效果验收。

## F2：正式 runtime → Host 提前停止接缝通过

`recheck-early-stop.mjs` 引用本轮独立编译的 WallpaperProbe.dll，通过正式 TaskbarHideRuntime 的实际 constructor/CaptureInitialState/AfterFrame/Finish/GetSummary 生成数据，仅替换窗口观察边界。

覆盖初始化观察前停止、零帧停止、1 秒首帧后停止、9.9 秒停止。四种情况实际产出：

```json
{"stage":"stopped-before-action","attempted":false,"cleanupSafe":true,"warning":null}
```

把这些实际 Summary 送入本轮真实 Host 会话和同一个路由控制器，每种场景连续执行两轮 start/stop：均返回 200、释放旧会话所有权，各关源两次，第二轮能开始。`early-stop-result.json` 与 `early-stop-recheck/production-summaries.json` 保存结果。

初次假窗口枚举夹具错误地要求 location 参数，不符合实际 `--window-find` 无参数枚举约定；失败日志保留于 `early-stop.log`。修正假边界后在新输出目录通过，没有为通过检查修改产品代码。

周期状态不能充当 final Summary；attempted=true 的 observing、缺失终态、未关闭输出及 cleanupSafe=false 的拒绝门禁继续由 Host 回归覆盖。

## 其余验证与保护

| 验证 | 独立结果 |
| --- | --- |
| 正式候选 publish | 退出 0，从本轮 14 个原生输入快照编译 |
| Host 测试 | 显式使用本轮候选 EXE，105/105 |
| JS/CSS check、SDK 契约 | 均退出 0 |
| 隔离 QA 构建 | 退出 0，acceptedUnchanged=true |
| QA 原生自检 | 113/113 |
| 生成入口检查 | 19/19 |
| 假 worker 进程检查 | 5/5，迟到动作 0 |
| 独立启动屏障检查 | 9/9 |
| 正式 runtime → Host 提前停止 | 4/4，每项两轮开始/停止 |

14 个非任务目标保护文件哈希一致，包括生产资产、rc.24/rc.26 tgz、5 份 Profile、官方 DSH/WE EXE 和已安装插件 package.json。复审期间 14 个原生输入和 Host session.js 未被改变。测试目录所属进程 0，安装仍 rc.24，rc.27 tgz 尚不存在。

## 接续

Gemini 无需继续重写这两项。Codex 下一步以本轮已审查源码与原生构建准备独立 rc.27 包，核对内容和指纹，保留 rc.24/rc.26 原包。随后先确认用户方便和助手暂停，再备份并临时安装，短验提前停止后再次开始、超过 10 秒隐藏入口、动作附近停止/重启、普通退出及清理。结束按当轮用户选择保留候选或恢复 rc.24。

实机仍由用户点击；不自动开窗或修改运行配置，不重复独立 40 秒、GPU 对照或长测。任务栏入口消失、是否重现、Alt-Tab、闪窗/焦点和动态持续性仍需正式 DSH 实机记录，不能用本轮离线结果直接宣布通过。
