# 原生作者开关：待发送记录的安全恢复

2026-10-22，Codex。承接[Lucy布尔开关离线接入](WALLPAPER_NATIVE_AUTHOR_SWITCHES_20261022.md)。本轮只推进开发源码与隔离QA，日常DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1保持，未安装或操作日常DSH/WE。

## 已实现

保存草稿后应用失败、结果未知，或读取时发现其它入口的待发送修改，现在可以明确检查范围，再清除待发送记录。**清除不执行WE命令、不撤回画面效果、不恢复作者默认值；插件记录值保留，控件恢复未读回实际值的混合态。** 只有再次明确修改开关，才会开始下一次提交。

| Before | After | Why |
| --- | --- | --- |
| dirtyKeys存在时只能反复读取 | 显示参数名称/数量、来源分类及发送状态，按需展开清除入口 | 给出可完成的恢复路径 |
| 无法区分未发送与可能发送 | Host记录当前revision的delivery证明；未知需先确认观察画面 | 不把未知当作未发生 |
| 清除容易被误解为恢复默认 | 明确说明只清除记录，不改变/回退壁纸 | 限定操作范围 |
| 旧确认可能套到更新后的草稿 | 前端绑定当次恢复对象；Host核对revision、fingerprint和完整字段清单 | 不清除用户尚未审阅的新修改 |

正常开关区不增加常驻按钮组。只在重读发现待发送记录时出现恢复区，继承侧栏字体/主题；其它或无法确认来源的修改不冒充本次开关保存。确认区列出名称，尚未发送时确认“不改变壁纸”；可能发送时明确确认“我已观察画面，不回退壁纸”。命令仍待结束则不提供可执行的清除入口，只允许稍后明确重读。

## Host协议与保留门禁

- 沿用鉴权`POST /api/author-properties/draft`，增加`action:'discard'`、`discardKeys`和布尔`acknowledgeUnknown`。其它action不能携带这两个字段；discard不能夹带values。没有新增执行路径或调用适配器的清除分支。
- 读取回包增加`application.busy`和绑定draft revision的delivery状态：none、not-sent、pending、confirmed、unknown；没有有效证明时按untracked处理。原有窗口/进程身份、owner、选择、分级、生命周期和schema检查保留。
- 清除要求当前schema不stale、expectedRevision一致、完整dirty字段集合相同且没有重复/增减、适配器不busy且记录不pending。未知或untracked必须显式确认；空集合、越界字段、旧revision、切目标、撤权及清理状态均拒绝。
- 核对和替换记录之间没有await。成功只清空dirty、保留values、revision加一，使旧apply与重复discard不能重放。返回`discarded:true`、`mutation:'discard'`、`currentValuesKnown:false`；不使用恢复默认值分支。
- 适配器进入应用时标pending；成功才标confirmed。真实适配器标明可能发送、未知返回或异常则保守标unknown。较早dirty的未知状态会跨后来的保存/reset及发送前失败保留，不能被新revision洗成“从未发送”。
- 适配器退出未确认仍busy时，即使HTTP已经返回未知且用户确认观察，也不能清除或解锁第二条命令。

本协议是客户端和Host的协同修改。旧Host缺少明确busy证明时，客户端不启用清除；未来候选不能只移入新client而漏掉Host文件。旧草稿表单仍可使用原set/reset/apply协议，额外回包字段不改变其行为。

## 原生侧栏恢复协调

显式重新读取只检查，不自动应用或丢弃。当前UI只把已确认保存的相同fingerprint/revision/字段和值认作本次开关来源；其它记录按其它/未确认来源展示，包括非布尔字段。

确认绑定当次恢复对象。重读、版本冲突、字段范围变化、目标/代次变化会使旧确认失效；失败后须重新读取并重新确认，不能让旧回调自动套用新的清单。未知记录必须同时有观察确认。读取与本地清除均4秒，原开关连续提交仍12秒/最多4批。忽略abort的旧请求保留物理通道直到结算，不自动重试。

成功回包必须证明清单为空、revision精确递增、fingerprint不变、布尔记录值保持以及明确discard标记；缺少证明不显示成功。清除回包丢失时保持未确认，通过明确只读重查确认是否已清空，不重发清除或WE命令。

范围仍限schema未变化的Lucy开关路径。schema stale继续拒绝，不能借“清除”偷偷重置成新默认值；实际效果没有读回。滑块/其它字段即时提交、独立窗互斥和全部异常策略尚未完成，不把本步称为所有作者设置或UI最终验收。

## 输入保护与修改范围

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-author-recovery-20261022-1b71236b`，含`design.md`、开工副本、`final-inputs/`、各轮QA及`change-audit.json`。

1. `src/wallpaper/author-properties-host.js`：发送证明、discard CAS与状态延续；原生执行器和鉴权实现未改。
2. `src/sidebar/native-appearance-sidebar.js`及client生成块：恢复检查、确认、4秒清除与界面。client生成块之外与开工副本逐字节一致。
3. 既有`qa/native-author-switches.test.mjs`只更新遗留dirty从“拒绝读取”改为“可检查但不可应用”的断言；新增两份恢复QA。

241项开工保护输入中，上述4项既有输入变化，其余237项保持，新QA单独指纹。正式assets/manifest仍rc.30、归档和日常Profile不动；21项官方SDK快照与当前app.asar保持。

| 最终源码 | SHA256 |
| --- | --- |
| client.js | `F8A2CF7A1FFB9D8635210D11F50662FBACF3BAE95E47EE7BCB7298DB8E7DB948` |
| native-appearance-sidebar.js | `20836CCE1A770F48C93CA8CF36C0026D317401273254CD8CB0E83EECA6DBCE31` |
| author-properties-host.js | `E0BE41484CE4BBFFA87CDA58A3075BE47CF3A4DE7ED62C363CEE06856DC5FA31` |

## 检查与证据边界

`final-regressions-report.json`：恢复Host21、恢复协调器13、原作者schema/表单/适配器/HTTP栈89，以及此前侧栏/目录/图库/播放/上下文177项，共300项通过；两个生成器、3项语法、CSS guard通过。覆盖确实未发送/未知/忙碌、旧revision与字段集合、观察确认、确认ABA、冲突重读、丢回包、超时/取消、身份变化与不降级未知证明等。

`recovery-final-report.json`：完整Whale入口/真实SDK共46流程通过。新增4项实际DOM恢复路径，经过真实主端bridge、认证HTTP、作者服务与原适配器：

- 注入发送前身份拒绝：读取本次待发送范围、勾选确认、清除，属性命令次数不增加，插件值不回退默认。
- 注入发送后失败：Host记录unknown，确认观察后清除；保留请求值和未读回状态，没有重发或撤回命令。
- 同一鉴权owner的另一个测试编辑入口保存slider修改：原生区显示该字段范围并暂停开关编辑，不将其应用。
- 用户审阅后另一个编辑入口又保存字段：旧确认被revision冲突拒绝，只有重读显示新的两字段范围、再次确认才清空。恢复后可再次明确编辑。

全部流程共4次属性命令IO替身调用：前三次来自原正常/快速开关流程，第四次来自故意注入的发送后失败。清除动作新增属性命令为0；仍是1条明确start、2条stop，属性命令峰值1、最终0。**真实WE属性命令0次**，窗口/进程检查、执行与退出stdout均是合成IO；源/目录/预览/会话权限及空stream仍为隔离输入。没有真实桌面效果、主观观察或下一次启动验收。

最终settings/status/library订阅、refs、pins、远端监听、DOM和stream归零，7个Blob URL全部释放；自有浏览器退出、服务器和桥接关闭确认。SDK约5.84秒，无超时。原有两条401严格与[既有基线](WALLPAPER_BRIDGE_BASELINE_401_FINDINGS_20261021.md)比较，`cleanLog:false`；另有本轮故意触发的三条409，精确核对path/POST/generation/error：target_unverified、apply_command_failed、revision_conflict，没有笼统放过409或新增错误。

## 首轮结果与并发范围澄清

首轮恢复专项与旧栈均通过；最终增加“未知不能被后来的保存/reset/发送前失败降级”两项后形成300项输入。中途一次临时Python命令使用了错误相对路径，未修改目标文件，随后在仓库根修正。

首轮SDK全部46流程通过，但末尾把Host读取峰值误限定为前端队列的2而判失败：新增快切场景观测到3次Host读取重叠。源码核对表明，前端队列限制的是两个loader Promise；fetch取消结算可能早于Host已有读取收束，原Host另有8个槽位的全局门禁。最终QA直接绑定现有Host常量8，前端队列2的纯负例保留；最终Host观测峰值4、剩余0。没有改图库或Host预览实现，也不声称全链路物理读取始终不超过2。旧失败报告保留，不能用当前结果倒改旧报告里的观测值。

所有QA沿用阶段期限与独立父监督（回归20秒/阶段、总60秒；SDK45秒/收束51秒）。本轮未打包安装、改日常设置、提交推送清理、联系其它助手或恢复定时。

## 下一小步

当前schema稳定时，Lucy布尔开关的正常提交与失败后明确清除记录已离线贯通。下一步可接Lucy滑块的交互完成提交与快速变化合并，继续只发送本次字段，不扩大自动播放资格或壁纸类型；其它字段、schema变更策略、整体视觉和独立窗互斥分别推进。未来候选独立整合后再按当时方便确认安排实机，日常rc.42继续保持。
