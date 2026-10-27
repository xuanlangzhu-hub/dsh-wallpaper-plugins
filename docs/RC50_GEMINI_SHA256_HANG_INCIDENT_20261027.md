# Gemini 本轮 SHA256 校验挂起与恢复

2026-10-27，Codex。用户反馈“哈基米是不是又在做一个没有返回的测试了，一直挂着”。

## 实际状态与原因

Antigravity原 Scroll A Investigation Q1-Q3 Repairs 对话显示 Worked for 1m 后“Waiting for the background task to complete”，当前单个任务为 Verify SHA256 of inputs，已等待约8分钟。尚无本轮SDK边界补验目录／交付，不是SDK计算耗时。

只读CIM查到本轮 PowerShell父33336（09:05:18.956107+08:00）及子36832（09:05:19.240774+08:00）。父命令是再次嵌套 powershell -Command 并双引号包裹含 $_ 的代码；子实际命令中 $_ 已被外层展开为空，出现 `Split-Path  -Leaf` 和 `Get-FileHash  -Algorithm SHA256`，均缺文件路径。缺必填参数的交互等待与本次长期无输出一致；具体交互提示未从任务输出读到，不宣称已捕获提示全文。

这次没有测试脚本／父监督截止，也未使用-NonInteractive或断开stdin。20／45秒测试约束不能只用于名为test的脚本；哈希、目录读取、进程查询等前置命令也必须有界。

## 收尾证据

保存 `.tmp/gemini-sha256-hang-20261027-a/processes-before.json`。操作前逐一核对名称、完整目标路径／命令、父子关系、CIM创建时间及进程句柄StartTime；仅结束本轮这两个明确身份的PowerShell，不结束Antigravity、其它Node／Edge、原DSH或WE，不处理其它旧任务。

`termination-result.json`：36832与33336均 Terminated=true、ExitConfirmed=true（句柄WaitForExit上限2500ms）。本轮属于失败中断，不能标成哈希检查成功或SDK验收通过。

## 继续要求

保留失败任务和证据，不复制原嵌套命令重跑。前置校验写入独立Python／Node脚本文件，直接单一解释器执行，关闭stdin（DEVNULL／ignore），使用有界父监督并在退出前记录结果。不要powershell内再嵌套powershell，不把带 $_／$变量 的脚本插入外层双引号。若必须PowerShell，使用固定ps1配-NoProfile -NonInteractive -File；同样断开stdin、设置监督截止。不要依赖界面“Background task”自行超时。

三项输入最新指纹由Codex本轮独立Python只读结果写入本目录 input-hashes.json，可按输入仍未变复用，不再用交互命令校验一次。然后按 RC50_AUTHOR_INITIAL_READ_SDK_BOUNDARY_TASK_20261027.md 继续剩余窄组；每组20／45秒上限和退出证明不变，超时失败收尾，不循环重试。出现新的命令阻塞先停止／报告，不再次无限等。

日常DSHrc.3／Whalerc.48／GitBash0.1.2保持，不改共享实现或安装／Profile／assets／版本，不推送清理，不创建监控。Codex负责独立复审，不同时改实现。

附：她的第三个哈希输入路径还误写成解包package/assets/scenes/lucy/project.json，该路径不存在。应按SCENES.lucy.project读取实际声明路径；此错误应非交互快速失败，不能等待用户补输。Codex首次为她复核该同一路径也得到FileNotFoundError，已按真实声明修正并保存三项只读哈希。进程结束后，Gemini已自动恢复Working并开始新窄组准备。
