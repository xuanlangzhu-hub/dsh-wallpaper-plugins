# 日常壁纸清理恢复B五审：仅余PID字段类型门禁

日期：2026-10-18。审查[四审补修交付](WALLPAPER_CLEANUP_RECOVERY_B_FOURTH_REPAIR_DELIVERY_20261018.md)及实际源码。**Q2精度与Q3异步异常已闭合，Q1仅余下述S1；本轮暂不通过，只补这一类PID门禁及对应QA，不重写已通过部分、不转滚动A。**

## 已确认通过

独立证据：`.tmp/wallpaper-cleanup-b-fifth-review-20261018-b3f7fedc`。先核实小G本轮已结束，再冻结源码/QA/报告/rc.35对应版，指纹见`inputs.json`。

- 工作区session.js：`78F88A1B16B5997A89F08B60933FACF12E79C3A524EB7D2FF42A0E836D92DB11`；对应rc.35 session.js：`CDEAC8716DF6ACCEDC151FB91AD5184CCD6B01545EAD5EF46E2A2FA5083EF91D`。
- 静态check、实际5文件Host JS109/109、工作区/rc.35交付探针与两种事故回放在offline-guard下通过。对应日志为`check.log`、`host-js-tests.log`、`delivery-probes.log`、`rc35-probes.log`、`rc35-replay.log`。
- Windows PowerShell纯固定日期序列化实际复跑：显式`.ToString('o')`输出`.6092543Z`，经默认解析与原生`.6092543+00:00`严格等值；完整session合法重试closed=true、关窗1次。默认Get-Process来源与原生Process.StartTime方向一致，无需新helper。
- 异步`CreationDate:1e20`独立Node探针现在退出0、返回ok=false/date-out-of-range；旧崩溃已修。`async-malformed-date.log`保留结果。
- `fifth-probes.mjs/json`分别对工作区、rc.35各跑18项，共36项。含真实Shell精度正例、错/缺/多记录PID拒绝、旧毫秒记录不冒充精确身份、异步错误保护及下述类型缺口。脚本退出0表示当前行为复现成立，补修须反转坏类型预期。
- 对照161项原输入，仅managed-window.js/session.js变化；59资产归档保持，见`preservation.json`。本轮未查询/操作日常进程；真实PowerShell仅用于固定日期对象序列化，其余为底层IO替身。

## S1（P1，原Q1）：Number转换先于类型核验，坏PID可重新变成安全空集

`queryWindowsProcessCreationUtc`声称严格正整数类型，但实际先执行`Number(rawPid)`；`queryWindowsProcesses`同样先转换`item.ProcessId`。这会把JSON数组、数字串等错误类型变成合法PID。

独立底层execCommand完整session探针（两种基底一致）：

| 输入 | 当前实际结果 |
| --- | --- |
| 身份查询返回`ProcessId:[1122]`及合法日期 | ok=true；二次stop关窗1次、closed=true |
| 身份查询返回`ProcessId:"1122"`及合法日期 | ok=true；二次stop关窗1次、closed=true |
| location查询返回worker记录，`ProcessId:[process.pid]`、Name=WallpaperProbe.exe、CommandLine含`--taskbar-worker`和本轮location | 数组转换成当前Node宿主PID，随后被`pid===process.pid`跳过；返回ok=true空集，二次stop关窗1次、closed=true |

第三项重新打通了首审要堵住的“协议损坏→被过滤成空集→放行”路径。它没有对真实进程发动作，是当前Node进程内的默认解析/状态机故障注入。脚本里的PowerShell查询者`$PID`与JS宿主`process.pid`属于不同进程；不能仅凭等于Node宿主PID就把一条声称仍活跃的worker记录当成不存在。

补修要求仅此一类：

1. **两个默认进程解析入口**均先验证原始PID字段符合选定实际协议的数值类型和正整数范围，再作等值/归属判断；实际PowerShellProcessId输出为JSON数字，不需要靠Number将数组或字符串“修复”。坏类型返回失败，不能静默丢弃或生成ok:true。
2. 复核JS侧宿主PID跳过分支：查询者排除已经在PowerShell端按其真实`$PID`完成。任何自我排除都要依据真实角色/身份，不能吞掉目标/worker或矛盾记录。若不能证明是查询者，保留/拒绝而不报空集。
3. 加原始输出负例：数组、嵌套数组、数字串、布尔、null、对象、缺失、零/负数/非整数；至少让`[1122]`身份查询和`[process.pid]`worker空集绕过贯通默认解析、session与路由。要求0次关窗、保留session及失败状态、阻止新start；补齐合法数字PID后仍能重试恢复。正整数合法查询、真实Shell7位精度、异步错误保护和旧门禁保持。

不要整体替换queryProcessIdentity或queryProcesses为成功来宣称这项已验，也不要为此更换原生二进制、重做时间解析/外观或开启性能专项。

交`docs/WALLPAPER_CLEANUP_RECOVERY_B_FIFTH_REPAIR_DELIVERY_20261018.md`，报告S1的最小差异、真实默认解析/底层替身覆盖、合法恢复及拒绝顺序、工作区与新独立rc.35目录指纹。新目录保留所有旧证据。

日常仍DSH0.2.1-rc.2 / 外观rc.35 / Git Bash0.1.1；不安装/发布/打包、操作或重启DSH/WE，不改安装目录/Profile/生产assets/版本号，不提交推送或清理。P1A成果保持，首次断流仍未知。用户已授权自动巡检直接转达小G，本轮不转滚动A。

转达记录：仅S1补修已发往Antigravity原“DeepSeek Harness 插件项目交接”对话，复核新用户消息、输入清空和Working/Cancel；等待第五轮补修。
