# 短验辅助工具：状态解析、任务注册与备份收据补修

用户认可rc.61透明基础控件，要求UI先到这里；随后授权继续。本轮只补上次实机留下的辅助脚本缺陷，UI继续暂停。没有日常应用／Profile／WE操作，没有安装、打包、公开发布或提交推送。

## 实现范围

原`release-sources/rc61/prepare-trial.py`与已经闭合的`.tmp/rc61-basic-transparent-short-trial-20261031-b`不改写。新增`prepare-trial-repaired.py`及`trial-helpers/`，仍从45项固定模板生成全新、未授权的工具。

1. **统一状态响应入口。** 三个发现脚本改用`Invoke-WebRequest.Content`，保留原文，再由纯函数`ConvertFrom-WhaleHostStatus`解析为保留大小写的Hashtable。根对象、available／active布尔值、session存在性及类型必须有效；损坏、字段缺失或未知不解释成“已停止”。不改变端口／后代进程／原WE身份校验及发现脚本的停止状态要求。
2. **后续读取保留大小写。** 三个snapshot及两个清理脚本读取发现文件时也使用Hashtable和字符串日期，避免`Width`／`width`同时存在时普通对象解析失败。其它播放身份与played恢复规则不变。
3. **重复初始化任务名立即拒绝。** 主runner的对象字面量改为有校验的条目列表。`defineSteps`在初始化时检查任务名重复，在选择／spawn之前抛错，不再由JavaScript静默覆盖。原44项任务、参数、截止时间及原有显式模式切换逻辑保持；并非新增任务调度功能。
4. **收据跟随实际数据。** 备份purpose来自当前trial config；补充收据文件数量来自已经核验的daily归档清单，取消硬编码43。没有改变备份复制或验证算法。

没有修改rc.61产品源码、构建配方、原包、版本或资产，也没有改刚安装的UI审查skill。

## 原因与验证

按diagnose流程，在合成进程／CIM／HTTP替身下执行真实PowerShell发现与snapshot脚本。原失败收据已有明确根因，因此没有另行猜测壁纸／宿主根因或重新采样实机。

证据：`.tmp/rc61-helper-repair-20261031-a`。

- `callsite-red-corrected`：旧代码收到确实包含`available:true`的有效JSON文本，仍无法识别Host，2项预期失败；原文类型与内容另有断言，避免把空响应误算复现。
- `callsite-final`：11项通过，覆盖JSON文本、大小写不同字段贯穿发现→snapshot、损坏JSON、array／null根、缺字段、字符串布尔值及错误session类型。有效响应保持原字段；无效响应不产生可信status。
- `step-registry-final.json`：5项检查通过，44项原任务参数／期限逐项一致；用真实runner初始化片段复现旧重复键静默覆盖，再证明新重复初始化在dispatch之前拒绝。测试没有spawn任何进程，也没有实际启动应用。
- `receipts/result.json`：3项检查通过，旧43字段问题复现；新表达式分别跟随47项与3项合成清单；备份脚本除本轮路径变化外只改purpose字段，没有执行生产备份／恢复脚本。

额外保留一轮无效夹具过程：最初HTTP替身使用`$script:`变量，跨脚本调用时拿到空值，导致最初red／green都未送入真实JSON。此组不算原缺陷复现；修为每个隔离测试进程的合成global变量后，重新确认旧版失败、新版通过。没有为此放宽产品或测试断言。

## 新工具离线检查

最终新工具：`.tmp/rc61-basic-transparent-short-trial-20261031-d`，不是已闭合的-b。中间-c也保持未授权，最终-d新增缺失状态字段的明确拒绝。

34个PowerShell解析、10项授权对象、5项恢复精度、7项切换清理绑定、24项无授权入口拒绝、25项runner引用闭合通过；另有8拒绝负例、7下载授权夹具、4子进程环境夹具通过。3个准备阶段退出0、无超时。

config为`profileWritesAuthorized:false`，没有真实authorization、preflight或生产备份。恢复安全／授权等关键脚本只迁移新轮路径，内容保持；原-b全部250文件与既有458保护输入保持。原rc.61包SHA-256仍为`D6B286A18E06E4F1BA0C9AAF114F957EECFBD66085F0946A63985EB28B000A47`。没有重复跑未改动产品的大套件或把替身回放说成新实机验收。

## 当前边界

UI阶段继续暂停，用户认可的方向保持。日常仍DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2，公开仍rc.53。以后若安排rc.61日常切换，应另建对应目的的全新工具与授权，不把本次temporary恢复流程或旧备份拿来直接保留安装。

本轮不自动发起新实机；新-d仅为修复模板的离线验收产物。接续由用户决定下一阶段，安装前仍需普通聊天的当前方便／正常退出确认与新备份，不弹反馈框。
