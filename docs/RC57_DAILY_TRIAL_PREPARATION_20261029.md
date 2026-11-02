# rc.57 日常切换准备

状态：**准备完成，尚未安装。** 用户在[短验并恢复 rc.56](RC57_AUTHOR_DIAGNOSTIC_SHORT_TEST_20261029.md)后同意继续准备日常切换。当前日常仍按最后已确认状态记为 DSH0.2.1-rc.3／Whale rc.56／Git Bash0.1.2；本轮没有查询运行中的应用或 Profile。新安装仍须用户确认当时方便、无任务并正常退出，不能沿用前轮临时安装许可。

## 原包与本轮

沿用已实测 rc.57 原包，不重编、不重新打包、不提升共享 Trace 开发树：

- `.tmp/rc57-author-diagnostic-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.57.tgz`。
- SHA256 `EE286630B7D6F090C8762A7409A9E816BCE31D892EF355D0DEE4CEEE7273D262`，7,280,507字节／47文件。
- 回退原包 rc.56：SHA256 `85258A1BD5F5A6E421C6CCAA7E21D3DE5C28725EA5E8F92A19115D43D91BD160`，43文件。
- 新工具 `.tmp/rc57-daily-trial-20261029-a`，purpose=`retain-rc57-daily`。
- 计划新备份 `C:/Users/HP/.dsh/backups/rc57-daily-trial-20261029-a`，准备结束时尚不存在。

新 config 为 `profileWritesAuthorized:false`，没有 authorization、closed-backup、应用 PID／端点、运行回执或 closed-out。新轮不复制旧实机证据；旧短验轮 b 及其失败／更正、下载文件和备份保持，closed-out 不复用。

## 离线核验

配方 `release-sources/rc57/prepare-daily.py` 先校验前轮成功恢复与用户确认、真实下载回执、候选归档及完整解包成员，再调用同一 `prepare-trial.py` 以新 root／purpose 派生工具。该生成器新增的 purpose 参数只有两个固定选择，默认临时短验行为保持。

本轮45个脚本：36固定模板、7诊断工具、2个默认启动阶段脚本。检查结果为32个 PowerShell 解析、10项授权对象、5项时间精度、7项清理绑定、23基础＋8新增无授权拒绝、24个 runner 引用闭合、7项下载／授权合成用例、4项子进程环境夹具通过。三个准备阶段退出0、无超时；固定来源与361保护输入保持。

记录 `offline-preparation-report.json`、`diagnostic-tool-preparation.json`、`preparation-commands.json`、`source-adaptation.json`、`daily-adoption-policy.json`。这些是准备证据，不能当成新轮安装成功或视觉验收。不可变原包已有146项行为检查及刚才的实机结果，本轮只重新核对指纹，没有机械重跑整套包内功能测试。

## 安装后保留的行为

只安装已测原包并确认重开／原外观／布局／侧栏目录，**不再手动播放、不改作者参数、不重做导出、不启用本轮诊断启动**。诊断默认关闭；不写系统、用户或日常启动器环境。原自动播放若触发，正常停止并等清理，不改用户自动播放偏好。

新工具保留前轮有界启动和回退能力，但诊断启动工具不属于本轮计划；具体范围写入 `daily-adoption-policy.json`。助手启动时仅向候选子进程显式传0，父进程及持久环境不变；也可由用户按原方式正常重开。启动 helper 的成功只是拿到启动结果，不是 Host 已就绪，后续新鲜发现与实际窗口确认仍独立执行。

## 执行顺序（待新退出确认）

1. 记录新的直接正常退出确认；原 WE 保持，不杀原 WE。核对当时日常包、宿主与关闭状态，建立本轮新备份。
2. 依次备份 Profile／关闭外观存储、媒体和布局，保留原安装与两份包。**先 retain，再 layoutBefore**；不重复前轮布局核对早于补充备份的顺序错误。
3. `preflightRetry → readonlyDaily → backup → mediaBackup → verifyBeforeRetry → retain → layoutBefore → mediaVerifyBefore → install → verify → layoutAfter → runtime`。任何失败确认退出并留档，未知结果先查，不盲重试。
4. 记录唯一诊断变量原状态，`launchDefault` 或用户正常重开。先观察窗口实际就绪，再 `discoverDefault`／`snapshotDefault`，不在 Host 未就绪时假定启动失败或重开。
5. 核对原外观、布局及全年龄目录；不扩分级、不开始播放，确认诊断入口默认隐藏、后台停止／采集0。用户确认正常后保留 rc.57，写本轮日常交接与 closed-out。
6. 若本轮安装或重开出现问题，先保护本轮新增数据，依当前关闭／源窗口／清理门禁恢复 rc.56 和本轮原设置。未来再回退不能直接复用今天备份覆盖后来新增数据，须另取当时方便确认并保护新数据。

尚未解决数小时后的脆弱循环，未实机验证失败后的刷新恢复；不要把换日常说成根因修复。后续先日常使用反馈，不要求用户等待复现或反复尝试。TS、进一步任务栏零闪现、UI大改、三体与公开发布保持暂停；本轮不提交、推送、发布、派发或清理。
