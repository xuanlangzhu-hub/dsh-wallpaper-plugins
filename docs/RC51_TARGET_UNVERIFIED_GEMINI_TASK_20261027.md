# 给Gemini：沿真实session目标身份链定位target.unverified

2026-10-27。用户继续授权离线定位及有因果证据后的最小补修，沿用此前授权，不需要用户转述。用户重启Codex后computer-use恢复，已核实原会话并单次发送，确认新用户消息、空输入和Working。此前初始化前报`failed to write kernel assets ... os error 3`及重置同错为上轮失败历史，没有在失败轮发送或重复派发。

## 新现场证据与保护边界

先读AGENTS.md、NEXT_TASK.md、docs/PROJECT_STATUS.md及`docs/RC51_AUTHOR_READ_DIAGNOSTIC_SHORT_TEST_20261027.md`。本轮临时rc.51已取证并恢复，用户确认重开正常、原外观布局正常、播放停止；恢复后Host inactive／session=null／无错误、采集0、原WE保持。日常DSHrc.3／Whalerc.48／GitBash0.1.2，不再采样或操作日常。

唯一一次Lucy启动，Everyone目录23项、翻页1→2→1，日常模式、临时关闭自动播放，未改作者值、未点重试／保存／应用。作者首次自动读取实际报`未能读取设置，请重试 [target.unverified]`。随后读到的active=true、captureStarted=true和源HWND属于稍后状态，不证明首读当刻的全部身份。原始作者响应未保留；快照没有windowStartUtc／generation／helper全字段。不能宣称已证明具体竞态，也不能把旧冷库409当本轮根因。

本轮本地证据：`.tmp/rc51-author-read-short-trial-20261027-a/first-read-outcome.json`、`first-read-target-unverified-ui.json`、`author-read-failed-status.json`、`closed-out.json`。截图供按需查证，不发送完整隐私日志或token。

固定包：`.tmp/rc51-author-read-diagnostic-candidate-20261027-a/dsh-whale-mist-0.6.0-rc.51.tgz`，SHA256 `A8AA341F560C17CB7AC85817DFB205404AE7C2765F2F29B15CF436F912313725`；实际解包在同目录`unpacked/`。rc.51仅在固定rc.50基础增加两个已审诊断区域／manifest／README，40文件和14资产保持，实际client SHA256 `62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8`。先针对固定包定位，不用共享开发树替代现场版本。

## 这次查什么

目标是解释“首次失败，但稍后画面及captureStarted正常”是否由真实目标身份链的可重复缺口导致。先给出字段映射和实际可运行的窄复现，不能继续靠人工完整target替身证明生产链正常。

按优先级验证以下可证伪假设；每项只变一个条件：

1. **渲染playing与Host采集证明到达顺序不同。** `src/client.js`在成功emitFrame后置playing；`src/wallpaper/session.js`仅在采集子进程stderr的Status／Summary带`captureSource==='window'`时置captureStarted=true。独立stdout帧／stderr状态到达不天然同步。若这是可达缺口，让真实首帧先到、就绪Status后到，应能经过真实桥接／控制器触发一次target.unverified；相同输入仅调换顺序应成功。不要用直接setContext+手填state=playing冒充完整renderer路径；若某层只能替身，要明确只证明到哪一层。
2. **进程启动时间查询失败被保留为空。** 实际session在create期间await queryWindowsProcessCreationUtc，失败不必使播放失败，windowStartUtc可能一直为null。若此链可达，在底层execFile返回明确失败／timeout／无效身份时，应看到真实session.state().windowStartUtc为空、captureStarted后来为true，而真实canApply一直false。正例用合法、精确的启动时间；保留错误和身份校验，不把null补成now或放宽精度。
3. **目标装配／资格不一致。** `src/index.js:138–145`实际readTarget从state.config取sceneId／window／helper，从session取location／windowPid／windowStartUtc／captureStarted，从route取generation；ownership时返回null。核对实际传给Host的adapter是否存在、application.available与targetActive哪一门失败，是否generation／数字类型／helper／location映射不同。若声称锁导致失败，必须解释为何lifecycle busy没有先产生409；不能回到已被反例否定的“启动时一定200targetfalse”。

实际已核对的代码点：

- session在create中先写config.window、windowPid并await启动时间查询，再spawn采集并返回report；state()暴露真实windowStartUtc，report().window未暴露该字段。
- ApplyAdapter.target对ID、generation、HWND、PID、有效startUtc、exe helper、stopping及captureStarted均严格校验，canApply会吞掉具体拒绝原因并返回false。
- author Host `state()`返回application.available=Boolean(applyAdapter)，targetActive来自真实canApply。
- client accept即便requireActive=false，仍检查application.available；首次load在无dirty时另检查targetActive，二者都可归为target.unverified。不能单凭这个码判定后者。
- 旧review-vtwo虽用真实ApplyAdapter，但readTarget由测试人工构造，没有经过实际session默认身份查询与index装配。这是新窄复现必须补的接缝，不重跑已有6／11／SDK场景。

## 复现与修复验收

先冻结相关固定源码／QA和本轮证据指纹，独立排他目录输出。复用实际createPreviewSession、ApplyAdapter、Host和已审控制器；底层helper／子进程事件／execFile可受控替身，明确输入和替身范围。index私有闭包若需提取，断言来自固定原件并保持表达式原样；更好是通过实际注册入口，不复制一份“等价逻辑”自测。

第一步交付应给出真实字段的生命周期表以及最小红例、仅改变一个条件的绿例；区分“离线可达原因”和“该次现场根因已证实”。必要的诊断仅记录封闭原因／字段是否有效和就绪阶段，不记录私有路径、完整响应、值、token或原始异常。不能为了凑结论再开日常进程或补现场GET。

有可重复因果证据后，可以在隔离开发副本做最小修复和同一红绿复现；不同时解决其它健壮性问题。保留最后写入门禁、身份、鉴权、分级、取消／迟到／代次、脏记录与未知结果不重放合同。不得直接删除target检查、让未验证目标可编辑、固定延时、无限轮询，或默认下发参数。若需要就绪触发，只能是有界且可取消、绑定同代次的明确状态合同，并验旧代次／隐藏／销毁不会再次读取或写入；若只是显示参考schema，必须始终只读，明确不是实际壁纸回读。

先在隔离副本证明，再列出拟提升的最少文件和生成块，交Codex独立复审；不要直接把整份开发client或生产资产覆盖进固定包。不改共享manifest／生产assets／版本号，不打包安装发布，不修改Profile或媒体，不退出／重开／采样DSH／WE，不发DSH模型请求、不杀原WE、不提交推送清理、定时或跨任务派发。“▶ 播放”和UI后排。

## 所有脚本必须有截止和退出证明

遵守AGENTS中的既有挂起约束：包括准备／哈希／命令都用独立.mjs／.py或-File，stdin ignore、父监督硬截止、阶段截止和自有子进程退出确认；不得嵌套双引号PowerShell让$_提前展开后卡在缺参数提示。数据用结构化参数／文件，不拼接Shell。不重新运行历史挂起任务，不为等待延长成数分钟无输出。超时即保留失败并只回收能证明属于本轮的资源；禁止全局结束node／Edge／PowerShell。

交付`docs/RC51_TARGET_UNVERIFIED_GEMINI_DELIVERY_20261027.md`，写出输入指纹、实际入口、红／绿输出与命令、退出／清理、替身边界、现场仍缺什么。同步NEXT_TASK与PROJECT_STATUS后在原会话回复交付路径，等待复审，不扩下一阶段。

## 发送目标及状态

已将8项固定rc.51源码／清单逐一与原tgz字节比对并复制冻结；另留5项QA／现场证明／任务输入，见`.tmp/rc51-target-unverified-handoff-20261027-a/frozen-inputs.json`。准备脚本父监督1.088秒退出0，13项输入冻结，无实现修改。其中任务副本为冻结前正文，本节是其后补的准备记录；不将二者声称同哈希。冻结副本用于审查比对，完整运行依赖仍从核验过的固定包取得，不把8文件片段当完整可运行包。

已向Antigravity现有“Scroll A Investigation Q1-Q3 Repairs”（44d9b078-56c9-47a4-aa8a-a1f673d23d0e）单次发送，保持Gemini 3.8 Flash Medium／Turbo，未新开或切模型。新用户消息已出现、输入清空、Working已核实；发送后只读刷新确认，未重复发送。证据为`.tmp/rc51-target-unverified-handoff-20261027-a/dispatch.json`及sent-task.txt。等待交付，Codex不并行改实现，不创建自动监控。
