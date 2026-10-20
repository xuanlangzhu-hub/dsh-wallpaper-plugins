# 日常壁纸清理恢复B四审：新增默认身份查询仍需补修

日期：2026-10-18。输入：[三审补修交付](WALLPAPER_CLEANUP_RECOVERY_B_THIRD_REPAIR_DELIVERY_20261018.md)及实际源码。**暂不通过；本轮只补默认身份查询的Q1–Q3及必要QA，暂不转滚动A。**

三审的时间小数秒、非法日历、未启动分支缺字段/冲突旧负例已修。默认身份查询也已接入create，不再只是fixture传字段。新增查询自身却缺PID/结构验证，默认Windows PowerShell输出还会损失原生身份精度，另有异步解析异常；这些必须在真实默认解析链路上解决。

## 输入与独立验证

证据目录：`.tmp/wallpaper-cleanup-b-fourth-review-20261018-19b3e769`。先确认小G已结束、无Working后冻结源码/QA/报告/全新rc.35对应目录，哈希见`inputs.json`。

- 工作区session.js：`F0A0FD93254755B99D6FC5DCAD6B0695C3CA5E59334E5E2452F54BC6B3A04418`；managed-window.js仍`703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A`。
- 对应rc.35修复session.js：`7127D2F4C7B38C8B821B82761887E7CBFB4BF83C70CEE72DAB7F816214842C9D`。
- 静态check、Host JS108/108通过；三审独立24项按修复预期复跑通过。交付工作区探针、rc.35探针及两种事故回放均在offline-guard下通过。日志分别为`check.log`、`host-js-tests.log`、`third-probes-recheck.log`、`delivery-probes.log`、`rc35-probes.log`、`rc35-replay.log`。
- `fourth-probes.mjs/json`在工作区和对应rc.35各跑11项（5项默认身份解析、6项完整session），共22项；脚本退出0表示下列当前缺陷被复现，补修后须改成正确预期。
- `offline-date-serialization.ps1`仅序列化**固定DateTime对象**，实际运行Windows PowerShell5.1.22621.2506，无Get-CimInstance、无真实进程或DSH/WE查询/动作。结果见`windows-powershell-date-json.json`。其它查询/采集/helper全部为IO替身。
- `async-malformed-date.mjs`在独立Node进程模拟异步回调，退出1、RangeError见`async-malformed-date.log`，不影响日常Host。
- 原161项输入中两个实现文件及历史生成结果`qa/wallpaper/sdk-contract-result.json`变化；P1A相关源实现保持，59项生产资产/归档一致，见`preservation.json`。本轮未改实现或生产资产。

## Q1（P1）：返回PID未校验，缺字段或多记录仍成为可信基线

`queryWindowsProcessCreationUtc`用`Array.isArray(parsed) ? parsed[0] : parsed`取记录，仅解析日期，完全不核对`record.ProcessId`，最后返回`pid:numPid`，把请求PID重新填回成功对象。

查询1122时，下列默认底层execCommand原始输出均返回`ok:true,pid:1122`：

| 输出 | 实际完整session结果 |
| --- | --- |
| `{ProcessId:999999, CreationDate:<合法出生时间>}` | 二次stop closed=true，关窗1次 |
| `{CreationDate:<合法出生时间>}`（缺PID） | 二次stop closed=true，关窗1次 |
| 两条记录数组，首条PID999999、第二条1122 | 取第一条日期，二次stop closed=true，关窗1次 |

补修：按选定真实查询协议严格验证根结构、精确记录数、必要字段类型和返回PID严格对应请求PID，再绑定本轮身份。缺PID、错PID、数组歧义/多记录、字段损坏都必须失败保留，不能填请求值掩盖响应错误；不要只校验日期。用底层execCommand原始输出贯通create→失败stop→重试→路由status及新start门禁，不整体替换queryProcessIdentity为成功来证明默认解析通过。

## Q2（P1）：默认Windows PowerShell日期JSON丢精度，合法恢复仍会拒绝

生产默认命令是`powershell.exe`执行`Get-CimInstance ... | Select-Object ProcessId, CreationDate | ConvertTo-Json`。本机实际Windows PowerShell5.1对DateTime使用毫秒级`/Date(ms)/`输出，新增解析器据此生成只有三位小数的ISO；但原生`RealProcessClock`使用`System.Diagnostics.Process.StartTime.ToUniversalTime()`，实际冻结action出生时间为7位小数。

纯固定对象实验（不查询任何进程）把`2026-10-17T09:20:20.6092543Z`经同一Shell的ConvertTo-Json处理，得到：

```json
{"ProcessId":1122,"CreationDate":"\/Date(1792228820609)\/","ShellVersion":"5.1.22621.2506","FixtureExact":"2026-10-17T09:20:20.6092543Z"}
```

实际默认解析得到`2026-10-17T09:20:20.609Z`，与原生`.6092543+00:00`不等；用**这份真实序列化结果**注入完整session，二次stop closed=false，提示startUtc mismatch，0次关窗。工作区与rc.35对应版一致。现有正例提供人工ISO或高层queryProcessIdentity，避开了该默认输出问题。

补修：默认身份来源和显式序列化必须保留与现役原生一致的物理身份精度，不能依靠默认DateTime JSON；必要时采用与原生相同的进程StartTime来源并显式UTC字符串格式化。只将WMI微秒/毫秒补零不等于恢复丢掉的信息。**禁止为让两者匹配增加时间容差或截断原生action精度。** 同一真实身份经实际选定默认输出协议应严格等值，不同身份应拒绝；无法取得可信精度时保持未知并解释。

补一份可离线运行的真实Shell纯对象序列化契约实验，以及经过底层IO替身的完整正例/精度变化负例；不需要查询日常进程、开窗或安装。旧rc.35 helper形状不加虚构字段，保持现役原生兼容目标。

## Q3（P1）：异步回调内越界日期会抛出未捕获异常

日期字段允许有限数字或`/Date(...)`字符串，直接`new Date(...).toISOString()`，未检查Date是否有效。`CreationDate:1e20`是合法JSON/有限数，但超出Date范围。

用真实异步回调语义（queueMicrotask中调用execCommand回调）注入后，独立Node进程退出1，`RangeError: Invalid time value`。外层围绕execCommand的try/catch只能捕获同步替身立即调用回调时的异常，捕获不到真实execFile异步回调。这不是`ok:false`或可重试未知，可能使长驻Host异常退出。

补修：所有允许的时间输入在格式转换前检查合法范围，整个异步解析边界把异常收敛为失败结果，保证Promise有界落定；不支持的格式直接拒绝。覆盖越界数字、超大`/Date(...)`、损坏字段、多个记录及错误/超时，使用真正异步回调负例并验证进程不崩、不会关窗或释锁。正常合法原生精度正例仍需可恢复。

## 其余范围与交付

旧T2/T3门禁、正常Summary、无日志保留、并发单次关窗、已有P1A成果保持。不重写已通过部分，不改生产assets或版本号，不安装/打包发布/操作或重启DSH/WE，不提交推送或清理。首次壁纸断流根因仍未知。

三审交付的108项总数本轮复跑通过，但文件分项列表含当前不存在的catalog.test.mjs/scenes.test.mjs；请按实际命令和实际文件核对覆盖，不凭总数补写文件/分项数量。报告中的“真实事故回放”仍是事故数据+IO替身，不称现场实机恢复。

下一份报告：`docs/WALLPAPER_CLEANUP_RECOVERY_B_FOURTH_REPAIR_DELIVERY_20261018.md`。说明选定默认查询协议、精度来源、PID/结构规则、异步错误边界、完整路由恢复与负例、rc.35独立整合指纹。使用新证据目录保留所有旧版本。用户已授权巡检直接向小G转达，本轮不转滚动A。

转达记录：Q1–Q3已发送至Antigravity原“DeepSeek Harness 插件项目交接”对话，复核新用户消息、输入框清空及Working/Cancel；等待第四轮补修，不重复派单。
