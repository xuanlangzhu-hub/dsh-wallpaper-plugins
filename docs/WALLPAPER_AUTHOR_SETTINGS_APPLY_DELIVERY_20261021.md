# 作者设置 P1B：定向参数下发离线交付

2026-10-21。接[P1A双端草稿](WALLPAPER_AUTHOR_SETTINGS_P1_DRAFT_DELIVERY_20261021.md)。本轮完成Host下发器、正式apply入口和两端按钮的源码离线接入。**尚未制作候选包、执行真实WE属性命令或验收作者代码响应。** 日常DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1保持。

## 实现及边界

- `author-properties-apply.js`是一个Host持有的下发器，复用现有session状态，不创建第二条播放管线。session只新增私有`windowStartUtc`状态；index从同轮真实session取得ID、代次、location、HWND、PID、启动时间、captureStarted及停止状态。参数请求不能提交或覆盖这些身份。
- 正式`POST /api/author-properties/apply`只接受所选ID、schemaFingerprint和草稿修订。它在原主端/伴随窗认证内运行，读取已保存的修改增量，不接收任意values、路径、可执行文件、命令或location。未配置adapter时仍返回404，隔离SDK模式不启用真实adapter。
- 下发前后分别调用既有helper的只读`--window-inspect`并查询目标进程的完整路径和UTC启动时间；核对同一HWND/PID、窗口名、wallpaper64身份及固定可信WE路径。UTC身份沿用严格tick等值，单个100ns变化也拒绝，不引入一秒容差。身份缺失、窗口不在、未开始采集、清理中、所选B与播放A不同均拒绝。
- 每次异步边界重验主注册/lease、所选ID、分级、修订、Host代次及窗口目标；命令前后再读schema。活动操作期间每25ms检查纯Host状态，停止、换代或断连取消正在等待的自有命令。检查只在一次下发期间运行，不做常驻轮询。
- 固定执行`E:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe`，参数数组始终带同轮`-location`。shell关闭；WE的RAW JSON块使用`windowsVerbatimArguments`保留引号。值经schema和值约束校验，Unicode转成JSON的`\uXXXX`，限制序列化JSON最多12000个ASCII字符，拒绝RAW终结符、嵌套对象和额外控制标志。
- 一次操作总期限5秒；子命令默认900ms、取消后250ms退出确认宽限，输出总计最多16KiB。schema/body各沿用1.5秒限制，表单应用请求最长10秒。只终止自己spawn出的ChildProcess句柄，并禁止终止目标渲染PID；不执行taskkill WE、全局kill或关闭原桌面壁纸。
- 未确认退出的子进程保留占用，阻止新命令。卸载最多再等350ms，仍未知就返回`author_apply_exit_unknown`，Host不报告全部清理成功。迟到IO即使返回也不能继续启动命令。
- 成功只报告“参数已发送”，清除已发送增量、保留草稿值及本轮发送修订；重复请求不能重放旧默认值。schema/身份/权限在发送后变化，返回“可能已发送但结果未确认”，保留草稿，不自动重试。它没有读取WE当前值，也没有证明作者代码一定响应。
- 双端复用同一表单：先保存草稿，再显式点击应用；有未保存修改、非法输入、不同活动壁纸或未确认占用时不能应用。普通编辑/渲染不发命令。显式确认恢复作者默认后，才可把全部默认值作为新草稿再次应用。

协议依据：[WE命令行文档](https://help.wallpaperengine.io/en/functionality/cli.html)的applyProperties、RAW及named location说明；[Node官方子进程文档](https://nodejs.org/download/release/v26.8.2/docs/api/child_process.html)的参数数组、shell、windowsHide及windowsVerbatimArguments说明。文档没有提供真实属性值回读或作者响应确认，本轮也不作此承诺。

## 独立输出及验证

冻结/测试目录：`.tmp/author-settings-apply-20261021-34c9f871`，指针`.tmp/current-author-settings-apply.txt`。

| 检查 | 实际结果 |
| --- | --- |
| 最终`applyVerified` | 335/335，12.447秒，PID1976正常退出；包括此前301项、33项adapter/生产路由负例及1项共享表单应用检查 |
| `dispose` | 24/24，6.844秒，PID40808正常退出 |
| Win32 RAW隔离接收器 | 父PID20428、330ms正常退出；本轮Python接收器实际读取GetCommandLineA/W，两者一致且全ASCII，中文、emoji、引号、反斜线及带`-location desktop`的普通文本从RAW JSON无损还原，真正控制目标仍是测试named location。未启动WE |
| 实际自有子进程收束 | 两个良性Python子进程分别故意sleep/输出超限；PID41468、41492均经自己的句柄终止并确认close/SIGTERM。父PID34980、439ms正常退出，外层watchdog未触发 |
| 实际Cordis载体 | 官方Electron以Node模式隔离加载本轮index和真实Cordis；bootstrap/主注册/作者入口通过，PID39716、522ms正常退出。auth admission替身；目录不扫描，作者读取返回`author_library_unavailable`。该模式刻意不启用真实adapter，不能声称实际SDK中已执行命令 |
| 静态检查 | 11项更改/新增JS/QA语法、共享生成一致性及CSS模板通过；生产静态页仍只开放已审浏览器闭包，Node adapter不开放 |

335项中的新增检查覆盖：目标/实测窗口/进程身份错配（含启动时间单tick、假WE路径）、显式location和RAW边界、命令行大小、仅存储增量、禁止前端注入values、并发/修订冲突、schema变化、策略收紧、停止、lease失效、主端替换、卸载、挂起/超时/输出超限/未知退出与迟到结果。实际HTTP网关、Host服务、下发器和共享表单是生产实现；窗口/进程探测与WE命令为底层IO替身，DOM/React钩子为替身。现有目录/年龄分级、scene/video/web、独立窗/吸附、Lucy-only自动播放和清理门禁保持。

测试主监督40秒总限/45秒未知兜底，SDK8秒/12秒，RAW及良性子进程检查5秒/7秒；均正常退出。未使用原WE PID作操作目标，未读取日常Profile设置或活动Local Storage。只读核对日常安装37文件及固定rc.42归档，均保持一致。没有提交、推送、清理、打包或安装。

前后保护证据：`before.json`冻结194个源码/QA/scripts/assets输入；`audit.json`与`promotion.json`记录9个既有文件、2个新增文件的提升，185个其余输入保持。前版本文件保存在`promotion-before/`。manifest/生产assets仍rc.30，固定日常rc.42 SHA256仍为`A9B8044CB9C11CCC8B5FAB5309814B3616F267F9F15479484CCE79D714F70CB8`。

## 保留失败和未验收部分

首次adapter专项23/24：已确认退出的子任务仍需一个微任务释放占用，旧断言要求同步立即空闲；改成有500ms期限的等待，不放松未知退出门禁。首轮合并331/333：无adapter时apply入口提前404缺失，已补回；旧选择器QA硬编码CRLF导致LF源码提取失败，改成保留同缩进闭合约束的LF/CRLF兼容。分别保留`apply.stdout.log`、`applyAll.stdout.log`及对应结果；其后335/335，再补真实子进程退出/命令大小边界后最终335/335。重复跑测不叠加计数。

尚待：WE自己的RAW解析及Unicode响应、作者实际参数效果、真实窗口身份读取成功率/权限、实际命令耗时、独立窗/主侧栏可见操作及停止短验。隔离接收器成功只证明Win32传参边界，不等同WE生效。下一步按[最小候选任务](WALLPAPER_AUTHOR_SETTINGS_CANDIDATE_TASK_20261021.md)先核包；核包之后另取当时方便/正常退出确认、新备份再试，不复用历史授权。application/A/三体/性能/GPU与定时均不推进。
