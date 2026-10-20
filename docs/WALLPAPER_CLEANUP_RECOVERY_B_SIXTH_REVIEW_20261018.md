# 日常壁纸清理恢复B六审：源码离线范围通过

日期：2026-10-18。复审[五审补修交付](WALLPAPER_CLEANUP_RECOVERY_B_FIFTH_REPAIR_DELIVERY_20261018.md)及实际差异。**五审S1闭合，B恢复链路在本次源码离线范围通过，无新增补修项。** 日常安装尚未接入这些修改，首次壁纸断流原因仍未知，不能把恢复链路通过写成断流根因已解决或实机验收通过。

## 输入与最小差异

独立证据目录：`.tmp/wallpaper-cleanup-b-sixth-review-20261018-48d3821a`。冻结源码、QA、交付报告和独立rc.35对应版共70项，见`inputs.json`；复核结束时原交付输入没有漂移，见`live-input-stability.json`。

- 工作区session.js：`DE7C5A9DA5AE3A892D5D9B39BAF36E95B0A2A6596C936E98F8001AC9FD18CB8A`。
- managed-window.js：`703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A`。
- rc.35对应版session.js：`2AF9E5011933844E2B4DCE53D99E867E49C1AFB8DF67CC3B499244155EE4E4E5`。

相对五审冻结输入，本次session补修集中在两个默认解析入口：先验证原始PID为正整数数值，再比较身份，不再用Number转换数组或字符串；同时移除JS侧`pid === process.pid`跳过分支。真实查询者仍由PowerShell端`$_.ProcessId -ne $PID`排除。日期精度、异步错误保护及既有恢复证明逻辑保持。

## 独立验证

1. `npm run check`通过；实际5个Host JS测试文件110/110通过，未运行依赖新原生构建的CLI测试。日志为`check.log`、`host-js-tests.log`。历史测试里的`F:\\out`只在冻结副本中替换为本轮synthetic-out，未修改原QA或实现。
2. `sixth-probes.mjs`在五审独立探针基础上反转坏类型的成功预期，并增加数值Node宿主PID的worker记录；工作区与rc.35各19项，共38项通过。输出为`fourth-probes.json`（沿用旧脚本输出文件名）、`sixth-probes.log`。仅替换底层exec、helper和捕获子进程I/O，默认身份解析及完整session清理逻辑真实执行。
3. 两个基底中，字符串/数组身份、错PID、缺PID、多记录、旧毫秒精度身份、查询错误、数组worker PID及数值Node宿主PID worker，重试均closed=false且0次关窗。合法数字PID及真实Windows PowerShell固定日期精确输出均closed=true、关窗1次。固定日期JSON沿用五审纯序列化实测文件，本轮未重查真实进程。
4. 交付探针在独立副本复跑通过，涵盖数组、嵌套数组、数字串、布尔、对象、null、缺失、零、负数、非整数；数值Node宿主PID的worker记录被保留，不再吞成空集。真实注册路由链路验证坏worker输出时stop=409、保留失败session、0次关窗、新start=409；查询恢复可信后stop=200释放session、新start=200。见`delivery-probes.log`。
5. 独立rc.35对应版探针及两种事故回放通过：timeout-force-killed、normal-exit-missing-summary均在首次停止保守拒绝后，凭独立证明成功恢复。见`rc35-probes.log`、`rc35-replay.log`。这些回放注入进程退出事件，不是在本机强杀真实进程。
6. 异步超范围日期`CreationDate:1e20`返回ok=false/date-out-of-range，Node退出0；见`async-malformed-date.log`，旧异步崩溃未回归。

所有进程相关测试均加载`offline-guard.mjs`阻止遗漏替身时执行真实外部查询。上述结果证明JS实现、默认解析、状态机和路由在所列输入下的行为；不证明真实CIM环境、原生二进制、可见窗口或日常恢复体验已验收。

## 保护核对与保守边界

`preservation.json`确认：对照P1A十审161项输入，仅managed-window.js/session.js属于本B专项变化；59项生产资产/归档无变化。rc.35-base的12项源码/manifest输入与原事故冻结安装副本一致，rc.35-repaired只改上述两个JS文件。没有整体打包、安装发布、改版本或Profile，没有操作/重启日常DSH或WE，没有提交推送或清理。

若会话启动时取得的身份本来就不可信，补修继续保留未知状态；例如启动身份为数组的用例，后来查询正常也不会凭空补造原始可信基线。因此不能承诺所有失败都可无条件点击重试恢复，更不能为释锁绕过身份门禁。这一保守行为符合当前验收要求。

## 接续

B源码离线阶段收尾。下一项为[日常故障记录](DAILY_SCROLL_WALLPAPER_INCIDENT_TRIAGE_20261018.md)中的滚动A：用新版真实会话结构的隔离fixture，比较纯宿主与外观介入，区分思考内部滚动、边界传递和输入框/底部状态排版；先复现归因，再决定修补位置。

用户已返回并要求关闭定时任务，automation g保持PAUSED。本轮只进行人工复审并同步文档，未自动向小G发送下一任务。若之后安排B实机恢复验收，应从固定rc.35基底独立整合并重新确认届时方便；不复用旧退出状态，不混入Trace/P1A，也不自动进入P1B、三体、性能或GPU专项。
