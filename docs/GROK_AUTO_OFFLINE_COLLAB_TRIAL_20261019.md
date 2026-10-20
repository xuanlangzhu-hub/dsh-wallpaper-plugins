# Grok CLI auto 后台离线协作：读写与回收通过

2026-10-19，用户授权“操作 grok 继续”“权限自己看着办，auto 应该就行”。本轮用管理的 Grok CLI 1.0.59，在独立源码快照中读取文件、计算 rc.36 开始按钮的门禁结果并写报告，再由 Codex 独立复核。**最终 auto 读文件和编辑报告成功；没有桌面传话或用户逐项点击确认。** 闲置聊天自动唤醒仍未接通，采用当前活动轮次等待结果的方式。

日常 DSH0.2.1-rc.2 / 外观 rc.35 / Git Bash0.1.1 保持。上轮 rc.36 恢复后的重开已由用户确认，本轮没有操作 DSH/WE、安装或修改正式插件实现。

## 权限与调用范围

- 启动器：`C:\Users\HP\.codex\tools\grok-worker`；后台 `windowsHide: true`，`--permission-mode auto`，不使用 always-approve 或 bypassPermissions。
- 初轮工具为 read_file、grep、list_dir、search_replace；最终紧凑任务仅 read_file、search_replace。关闭子代理、Web 工具和终端工具，仅工作目录内的 REPORT.md 作为授权输出。
- 源码来自已核包的 rc.36 解包候选副本；Grok 在独立 workspace 工作，不直接编辑仓库或日常安装。路径规则禁止输入副本、F 盘实现和日常运行目录编辑。此处是工具过滤与权限规则，不声明 Windows 内核沙箱已经验收。
- 任务有总时限、最大轮数、后加的工具调用次数限制和外部 watchdog；超时只处理本轮自有子进程树，不全局结束 Grok/node/Edge。

## 三次实际请求及问题纠正

| 请求 | 实际结果 |
| --- | --- |
| `runs/rc36-start-button-offline-924e68ab` | 3 分钟上限触发，进程退出确认。18 次 read_file、1 次 list_dir、7 次 grep 全部完成，但没有编辑报告或 end_turn。报告仍是占位符，不计交付通过。提示中建议的 8 次工具限制未被遵守；随后在启动器增加可观测的工具调用预算及轮数限制 |
| `runs/rc36-start-predicates-compact-acc196fb` | 正常 end_turn/退出 0，约 96.8 秒；读取完成，两次 search_replace 均因 `deny rule on edit` 被拒绝，报告未写。此轮仅传输结束正常，业务交付失败；Grok 最终明确报告了失败，没有谎称已写好 |
| `runs/rc36-auto-edit-policy-fixed-728ebc3b` | 去掉与 search_replace 编辑分类重叠的 bare Write 拒绝规则后，auto 下 1 次读取、1 次编辑均 completed，报告实际落盘，约 83.6 秒，end_turn/退出 0，未超时。Codex 独立复核通过 |

前两轮原始证据保留。去掉重叠规则后仍保留输入和真实运行/仓库目录的 Edit 禁止项以及工具白名单，没有改全局 Grok 配置或关闭整个权限系统。`effective-policy.json` 记录最终实际参数。

启动器随后补充交付存在性门禁：offline-review 必须产出非空且不含占位符的 REPORT.md，才允许总体成功；`transportOk` 与 `deliveryPresent` 分开记录。这个补充没有重写上述历史结果，也没有额外发起模型请求。

## 独立复核与插件相关结果

最终报告：`C:\Users\HP\.codex\tools\grok-worker\runs\rc36-auto-edit-policy-fixed-728ebc3b\workspace\REPORT.md`；独立结果：同目录上一级的 `independent-review.json`。

Codex执行冻结候选 `src/client.js:5125–5170` 的真实纯判定片段，注入明确的四组输入：

| 输入 | canStartWp | 判定原因 |
| --- | --- | --- |
| 未加载目录，Lucy 可见、idle、无清理任务 | false | catalogReady 不成立 |
| ready 且 loaded=true，Lucy 可见可用、idle、无活动源 | true | 启动门禁满足 |
| 上一正例但 cleanupPending=true | false | isStartableState 不成立 |
| 上一正例但模式 detached | false | isDetached 阻止主端按钮 |

Grok 的四项结果与真实候选片段一致；报告以带 canStartWp 的对象记录各 case、行号用字符串，复核时只作明确类型规范化，保留原文。**未记录短验时的 catalog.state/loaded，故仍不能确认上次实机禁用按钮的真实根因。** 该矩阵只证明目录加载门禁足以产生“已验证/未播放但开始禁用”，不证明它就是现场原因，不授权删除清理/分级门禁。

已核对：2 次工具调用均完成且目标在隔离 workspace；输入快照哈希不变，只有 REPORT.md 改动；原工作区源码/QA/资产/归档 201 项保护输入不变。本轮自有 Grok 与 worker 进程已退出，用户原 Grok 不处理。原始事件可能包含 CLI 用量签名，留本地，不复制到公开报告。

## 后续使用与范围

auto 后台协作可以按明确小任务继续使用：提供冻结输入与限定输出，设截止时间，回收后独立审核。后续若需正式源码/QA 补修，再给该任务对应的写入范围；当前没有开放真实仓库自动修改，没有提交推送或打新候选。

启动器自检包含 7 项解析断言、4 项交付门禁断言、7 种真实子进程夹具（含超时、worker 事件循环卡死和工具预算超限）；这些夹具不冒充真实模型结果。真实读写验收以上表最终请求为准。定时 PAUSED、A/三体/GPU 暂缓，rc.36 剩余实机交互仍未验收。
