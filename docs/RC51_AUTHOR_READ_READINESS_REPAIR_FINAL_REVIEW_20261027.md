# rc.51 就绪补修最终交付独立复审：运行修复接受，QA失败收尾待补

2026-10-27。审查`RC51_AUTHOR_READ_READINESS_REPAIR_FINAL_DELIVERY_20261027.md`及`.tmp/rc51-gemini-readiness-repair-20261027-c/`。

**四个运行源码的就绪修复在指定离线范围可接受。R1响应边界补修通过，R2阶段总截止已生效；只剩QA的在途失败清理未闭合。下一轮只修QA，不再改运行实现，不提升或构建候选。**

## 独立复跑

交付43项冻结，复制至`.tmp/rc51-readiness-repair-final-review-20261027-a/`独立运行。原五组脚本／运行源码未改字节，各自输出排他、关闭stdin、外层监督有界，均确认进程退出。

| 原组 | 外监督结果 | 事实 |
|---|---|---|
| normal | 1186ms退出0；内部1024ms | 8/8，首次同GET／零POST／6字段，正向与原小组保持 |
| fault | 1206ms退出0；内部1047ms | 实际清理故障子退出1、7/8，Case1关闭失败真实触发 |
| responseGap | 494ms退出0 | 不漂移targetActive=true；等待成功后HWND／PID／startUtc／helper／具体session五种漂移均targetActive=false |
| counterexamples | 548ms退出0 | 事件前漂移、Host消费拒绝、adapter销毁解绑均保持 |
| registration | 535ms退出0；阶段含收尾165ms | 无请求、监听恒0的单独脚本按150ms阶段截止抛错，最后正常回收 |

运行修改与固定rc.51比较仍只有session、index、author ApplyAdapter与作者Host四文件，client／manifest／资源不变。`isBoundTargetCurrent(boundIdentity)`已贯穿wait恢复、GET handler恢复和state同步构造；保留原生最终写验证、单总预算、GET-only及旧适配器兼容路径。未发现本轮新的运行逻辑阻断。

## 唯一剩余项：原Case6阶段失败时，finally先等server.close，不能可靠结束在途请求

交付的`test-registration-timeout-negative.mjs:112`明确不发起请求；它验证了单独等待函数会超时，但没有覆盖原Case6已有在途HTTP请求后的失败收尾。该负例自己又复制了一份helper，也不等于原Case6运行的失败见证。**接受其已有证据，但不能扩称原QA在途失败也已干净退出。**

Codex因此补一个窄回放，见`prepare-registration-failure.py`、`registration-instrumentation.json`：

1. 从本轮冻结的原`test-readiness-repair.mjs`生成独立QA回放；只选择原Case6运行。
2. 仅将该case的`session.onCaptureReady`订阅IO替换为不注册的no-op，制造“永不注册”；仍发原来的真实HTTP请求、走真实Host／ApplyAdapter。
3. Case6阶段预算800ms缩为150ms。**实际等待helper、原case的try/finally、session.stop、server.close、Host、报告聚合与非零退出逻辑保持。** 未改运行源码或伪造等待成功／失败结果。

结果：外监督3172ms退出1；内层3057ms确认子退出1，**未触发父强杀**。报告`allPassed=false、cleanupSuccessfulForAll=false`，具体错误为：

```text
Timeout: server.close exceeded 2500ms
```

`expectedFailureConfirmed=false`：本应确认“阶段失败但正常清理”，实际收尾也失败。失败证据完整保留，不包装成预期负例通过。程序依靠原汇总的`process.exit(1)`结束，不能拿进程退出当成Server／Host清理成功。

代码对应：`test-readiness-repair.mjs:1045–1050`的finally先`session.stop()`、再await `server.close()`、最后才`host.dispose()`。若server.close超时，Host dispose与后续cleanup赋值都跳过；finally异常还覆盖原阶段失败。Case6第二个Host／Server定义在try内，也需纳入所有失败分支的资源收束；Case7两路请求按同一原则核对即可，不展开新专项。

**最小QA补修验收：**

- 先取消／dispose在途Host与本case客户端请求，确认abort／响应body回收或明确关闭本轮拥有的连接，再有界关闭Server；每一步失败不能阻止其它已创建资源清理。仅关闭已证明属于本轮的资源。
- 保留原阶段错误，另列cleanup错误、各资源关闭／监听／子进程状态，不用finally覆盖唯一原因；不靠强制process.exit声称干净清理。
- 在原Case6入口真正发出请求后制造永不注册，使用原helper和真实catch/finally；阶段按小预算失败、汇总自然非零，cleanupSuccessful=true，退出确认且父未kill。至少覆盖新建第二套Host／Server后失败的收尾边界。不只跑“未发请求”的另一个脚本。
- 同类Case7资源做最小必要修正／验证；保留normal及真实清理故障的既有统计。**本轮c四个运行文件按`review-evidence.json`哈希保持，只修QA与报告。** 不重跑旧SDK／诊断大组。

交付`docs/RC51_AUTHOR_READ_READINESS_QA_CLEANUP_DELIVERY_20261027.md`，全新排他输出，原a／b／c和本次失败见证不得覆盖。待Codex核对QA收尾后才讨论候选整合。

## 保护与边界

281共享源码／QA／assets保护项、43固定包文件／固定tgz及43交付冻结均核验保持。既有230项脏改动保留。实际引擎／原effect函数体仍使用自写hook执行器、acceptFrame手动交帧、解码和native IO替身；不是GPU／完整HTTP帧流或日常实机验收。现场具体根因仍未全量定案。

本轮未提升、打包安装、修改版本／生产assets／Profile，不操作采样日常DSH／WE，不推送清理／定时。日常仍DSHrc.3／Whalerc.48／GitBash0.1.2，原WE未动。“▶ 播放”和后续UI仍后排。

## 交接

本报告的单项QA补修将发到原Gemini会话；最终发送状态见本轮`dispatch.json`及`sent-task.txt`，不重复派发。

单项QA补修已单次发至原Scroll A Investigation Q1-Q3 Repairs，确认新用户消息、空输入、Working和Stop execution，模型／权限保持。见dispatch.json。
