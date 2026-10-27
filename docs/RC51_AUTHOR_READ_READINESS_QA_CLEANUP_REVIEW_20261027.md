# rc.51 就绪补修QA收尾独立复审：离线闭合

2026-10-27。审查`RC51_AUTHOR_READ_READINESS_QA_CLEANUP_DELIVERY_20261027.md`与`.tmp/rc51-gemini-readiness-repair-20261027-d/`。**本轮接受：原Case6两种在途阶段失败都已确认清理；与上一轮接受的c运行代码合并，作者首次读取同请求等待就绪的指定离线修复阶段闭合。** 不再追加QA补修或重复旧SDK／诊断组。

## 独立执行结果

输出目录：`.tmp/rc51-readiness-qa-cleanup-review-20261027-a/`。先冻结51项交付，再复制实际QA／依赖；四个运行源码逐项等同上一轮接受的c指纹，其余src与package也等同c。281共享保护项、上一轮43冻结项、固定rc.51的43文件保持。

| 本轮独立检查 | 结果 |
|---|---|
| 原normal／清理修改后回归 | 内部1156ms，8/8；外监督1287ms退出0，清理通过 |
| 原fault／真实关闭失败 | 内部1122ms，子退出1、7/8；外监督1269ms退出0，Case1实际关闭失败仍诚实记为cleanup=false |
| 原Case6A在途失败 | 内部601ms、子退出1，外监督741ms退出0；原主错误为150ms注册阶段超时，单Server／Session关闭均true、cleanup错误为空，无父kill |
| 原Case6B第二套服务建立后失败 | 内部633ms、子退出1，外监督776ms退出0；保留150ms主错误，两Server／Session关闭均true、cleanup错误为空，无父kill |

这些时间是进程／监督耗时，**不是阶段预算或屏幕性能**。阶段预算仍150ms，进程耗时包含夹具准备、请求、退出及清理。

两项Case6负例均由Codex从本轮原`test-readiness-repair.mjs`生成，未使用交付另写脚本里的复制版cleanup替代：只选择原Case6，分别在第一次订阅前／第二套Server已创建后的订阅IO置no-op，并仅将相应阶段预算缩为150ms。实际等待helper、`executeCaseCleanup`、原catch/finally、真实HTTP Host／adapter、报告聚合与退出逻辑保持。具体替换及源指纹见`prepare.py`与`prepared-inputs.json`的instrumentation字段。

子退出1表示测试主阶段按预期失败；父退出0表示严格确认了这个错误、资源正常关闭及退出状态。**没有把失败子用例改成passed=true，也不靠进程强退代替Server／Session关闭证明。** 原Case6B第一次等待正常经历Host dispose，第二次等待才注入永不注册，因此覆盖了两套服务已经存在的失败边界。

## 接受的改动与证据归属

QA现在优先abort客户端请求、dispose Host，再显式关闭本轮Server连接并有界关闭Server，最后stop Session；各资源独立保护，主阶段错误与cleanup错误分别保留。Case6第二套资源已提到finally可访问范围，Case7双请求／双session沿用同一收束。正常与真实故障组统计保持。

交付另有无请求helper负例、单独复制cleanup的6B脚本，其证明范围按其实际代码保留。本次对**原QA真实失败路径**的接受，主要依据上述两项Codex独立原Case6回放，不把复制脚本冒称原入口执行。

上轮五字段响应边界漂移／事件前漂移／session_changed消费／adapter销毁证据沿用`RC51_AUTHOR_READ_READINESS_REPAIR_FINAL_REVIEW_20261027.md`及对应review-evidence。运行源码及相关脚本未变，本轮没有机械重复。c四运行文件继续冻结，d仅QA／报告变化；未来候选从已接受固定来源最小整合，不能整体打共享开发树。

## 阶段闭合与下一步

本次闭合的是已复现的“首帧触发首次读取早于采集证明”时序修复及其响应身份、预算、取消、代次隔离和必要QA清理边界。**不是rc.50／51现场所有target.unverified已找到唯一根因，也不是安装后首次读取已经实机通过。** 缺startUtc／非法身份、未授权、分级、busy等仍应拒绝。

真实引擎／原effect函数体通过自写hook执行器与acceptFrame手动交帧运行，解码／绘制／native helper和process IO为替身，鉴权上下文受控。没有实际GPU、完整HTTP帧流或日常窗口验证。实际子进程仅本轮Node监督／QA，已确认退出。

**下一阶段：准备隔离候选的最小整合与核包计划，再按新轮备份／回退和当时方便确认安排首次自动读取短验。** 本轮只复审收尾，不自动提升共享源、构建包或安装，不复用旧授权／备份／PID。“▶ 播放”后续可作为单独小文案改动排期，不混入本轮冻结源。

日常保持DSHrc.3／Whalerc.48／GitBash0.1.2与原WE。本轮无日常操作、Profile／媒体／生产assets／版本写入，无推送清理或定时。既有232项脏改动保留。原a／b／c／d、失败见证、包和备份全部保留。

## 原会话交接

将向原Gemini说明本阶段接受、保持源码及证据、停止继续补修等下一阶段安排；实际发送核验见本轮`dispatch.json`／`sent-task.txt`。

通过结论已单次发至原Gemini会话，确认新用户消息、空输入及Working／Stop execution，模型与权限保持；仅通知离线收尾、等待后续，无新实施任务。见dispatch.json。
