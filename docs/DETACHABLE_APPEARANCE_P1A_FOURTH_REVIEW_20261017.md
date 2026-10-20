# 独立/吸附设置P1A四审：原三项闭合，R4-B窗口生命周期仍待实现

2026-10-17，Codex。复审[三审补修交付](DETACHABLE_APPEARANCE_P1A_THIRD_REPAIR_DELIVERY_20261017.md)，对照[三审报告](DETACHABLE_APPEARANCE_P1A_THIRD_REVIEW_20261017.md)。**R1、R4-A已有目录保护、R4-C停止失败重试的原失败场景本轮闭合；总体仍暂不通过，剩余范围锁定R4窗口生命周期与清理失败保留。** R2/R3/R6、普通SDK卸载及原P0成果保持，不重做输入队列、页面或来源协议。

本轮未改小G实现、未查询或操作真实DSH/WE/日常Profile，没有可见伴随窗口、真实taskkill或真实Edge App模式试装，未提交推送/清理旧证据。日常版本沿用上轮交接的DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1；没有核对当前播放状态，不把历史状态当授权。

## 已闭合及检查结果

独立证据：`.tmp/detachable-p1a-fourth-review-20261017-7a812ae3`，155项输入冻结。直接复跑三审原`ownership-origin-probes.mjs`，没有以改写后的测试替代：

- 实际index组合：主端dsh-app/配置Desktop origin为204，伴随端对应请求403；null/未知端口拒绝。R1来源分表闭合。
- 先存在同前缀目录：ownedCount=0，sentinel与目录都保持；正常新目录创建/回收改善保持。R4-A原误删闭合。
- 第一次stop失败、条件修复后第二次stop成功：closeCalls=2，owner清空、unconfirmedCleanup=false。R4-C原假成功闭合，index也返回cleanup Promise和真实结果。
- 二审原探针：预构建profile1→0、未确认child exit保留状态、adapter明确失败传回主端、R6同值70→95及跨字段95/0继续通过。
- 实际SDK匿名引导401/无秘密泄露/普通卸载无监听；实际React19.2.0稳定挂载；正式生产伴随页面加载/握手/DOM调参到真实controller95/0继续通过。DSH服务/引导或窗口部分仍有替身。
- check、P0 15/15、P1A 5/5、旧headless双Tab11项（替身spawn=3/close=3）、英文566和场景选择退出0。中文外观首次在媒体ready等待处超时，源码/原harness与上一轮逐字一致；单独重跑退出0、570项通过。两个日志都保留，不将一次超时写成全程零失败，也不据此归咎本轮关闭补修。

## R4-B [P1] 生产实现仍缺正常关窗与完整资源确认，交付说明混淆强终止和正常退出

位置：`src/detachable-edge-adapter.js:239`、`:255`、`:260`及`:312`；交付第3节。

三审要求交付的是“正常系统窗口关闭、进程/窗口强身份、Edge多进程资源集合确认”的明确生产机制。此次代码仍只有：

1. 直接`child.kill()`；
2. 首个child没exit才调用taskkill；
3. 首个child一旦exit，就删除跟踪记录并进入profile删除。

交付把步骤1称为“正常窗口优雅关闭”。但Node官方文档明确：Windows上的SIGTERM等信号会强制、突然终止进程；无参数`child.kill()`默认SIGTERM。因此现代码没有实现正常窗口关闭请求。[Node官方child_process说明](https://nodejs.org/api/child_process.html#subprocesskillsignal)

控制流还有直接缺口：如果child.kill后首个child立刻exit，taskkill `/T`分支根本不会执行，也没有其它资源集合/窗口查询。不能据“后备命令带/T”就宣称该正常返回分支确认了所有后代与窗口退出；当前createdAt仅Date.now记录，未提供OS进程创建身份/HWND归属等生产核验。

隔离事件替身复现`close-boundary-probes.mjs`：childKillCalls=1、treeKillCalls=0、没有资源组检查，closeOk=true、trackedAfterClose=0。该结果证明代码在缺少完整确认时可报告成功；未声称已在真实Edge观察到孤儿进程。

### 交付中的E2E验收边界须修正

交付第3.2节称旧E2E实测完整启动、多Tab通信、吸附关窗、无进程残留。实际`qa/detachable-browser-e2e.mjs:94`仍注入模拟windowAdapter：spawn只加计数并返回对象，close只加计数。**spawn=3/close=3是替身调用数**，不是生产Edge App窗口启动/关闭三次；真正启动的headless测试浏览器在测试finally单独终止。旧11项通信检查有效，但不能证明生产适配器已正常关闭、完整进程树退出或无残留。

### 本项需要交付的具体结果

将正常关闭请求、强身份核对、完整资源确认拆成实际可调用且可注入测试的生产适配接口。正常关闭应针对本轮窗口/会话发送明确关闭意图；退出确认应检查本轮受控资源集合，而非只有最初child exit；强制回收若保留，需要限定为已绑定身份的本轮资源并确认最终状态。验证迟到旧句柄、PID身份变化、根进程先退出而本轮窗口/子资源仍存活、关闭超时和失败保留。

可以使用经证实的Windows窗口/进程辅助能力或其它成立的承载机制；实现和依赖须给出处、打包边界与无窗口self-test，不擅自改官方安装/安全隔离或下载运行时。若当前Edge/纯Node路线做不到，请明确列出缺失接口与可行替代方案供复核，不能再用“child.kill是正常关窗”作为机制说明。本项可以先离线实现/评审，不要求当前操作真实DSH或可见窗口。

## R4清理失败余项 [P2] profile删除失败仍丢掉重试归属

位置：`src/detachable-edge-adapter.js:312`、`:318`、`:331`。

`cleanupProfileDir`捕获rm失败返回false，close却已删除process记录，并无条件从ownedProfileDirs删除该路径，最后返回ok=true。此时dispose没有路径记录，不能再重试。这与交付中所提的EBUSY/EPERM延迟释放直接相关；给rm配置有限重试，不能证明重试耗尽后已经清理成功。

本轮只在独立探针进程里为**本探针自己新建的临时目录**注入rm EBUSY，未操作日常目录或真实进程。结果：closeOk=true、profileDirCleaned=false、ownedBeforeRetry=0、disposeOk=true、profileStillExists=true。修复过的“进程关闭失败保留”保持，本例是目录清理失败被另外吞掉。

补修：保留待清理目录及错误供可见、可重试处理；进程确已退出与目录是否清理完成分别记录，上层不能把两者合写为“全部清理成功”。只有实际删除或确认无需清理时才去除相应归属；补EBUSY持续失败、条件解除后再次dispose实际重试成功的负例/正例。

## 下一轮范围与交付

只做上述R4窗口机制和目录删除失败保留；R1/R4-A/R4-C原反例及R6等已修项保持，不扩大UI/P1B或继续改认证。写`docs/DETACHABLE_APPEARANCE_P1A_FOURTH_REPAIR_DELIVERY_20261017.md`，将“实际实现”“替身测试”“无窗口浏览器验证”“未做的原生窗验收”分清楚，纠正旧交付的误述。

复跑原失败探针与本轮close-boundary对应负例，并给新生产窗口机制的隔离契约证据。相关Host/SDK生命周期检查继续，client/原外观QA不变时沿用本轮570/566/选择结果，不机械重复整套性能/原生长测。不打包安装、不改版本或原生采集assets、不提交推送/清理或跨会话消息。离线复审通过后再安排新候选与另约实机。
