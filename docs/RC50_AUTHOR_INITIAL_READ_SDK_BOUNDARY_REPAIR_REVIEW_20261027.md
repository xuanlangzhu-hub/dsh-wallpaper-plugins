# rc.50 SDK边界补修复审：离线核验通过，收敛覆盖口径

2026-10-27，Codex。复审 Gemini 的 `RC50_AUTHOR_INITIAL_READ_SDK_BOUNDARY_REPAIR_DELIVERY_20261027.md`。

## 结论

**本轮隔离诊断探针的离线核验通过。** R1失败门禁契约及真实同脚本故障注入已修复；R2合法payload和具体checked断言已修复。SDK剩余的固定等待／销毁通知证据不足，由Codex独立的实际控制器确定性回放补齐，明确分层归属，不冒充SDK端到端完成证明。没有发现需要改动共享业务实现的新增问题。

Gemini报告仍须更正两处口径：示例payload代码块漏了schema包络，与正确脚本不符；60ms是定时等待，不是微任务／实际作业完成信号，终态检查不能称“绝无闪烁”。只需文档更正并引用独立证据，不再为这两处文字重跑SDK／历史套件。

**这不是现场根因解决。** 本轮仍缺原实机首个失败阶段，尚未准备／安装新候选，日常继续rc.48。

## 独立证据与验收范围

新目录 `.tmp/rc50-author-sdk-boundary-repair-review-20261027-a/` 冻结12项交付／诊断输入，核对325项保护输入；四份脚本逐字节复制，使用Codex独立外层父监督（断stdin、20秒树收尾监督／25秒兜底、退出确认）执行。原目录不覆盖。

1. 正常SDK脚本：子code0、六场景passedtrue、cleanupSuccessfultrue；验证器退出0；独立外层耗时5812ms并确认退出。
2. 同一SDK脚本的清理故障注入：真实资源先释放，再将模拟退出未确认标志送入同一个最终门禁；子code1、passedfalse／cleanupSuccessfulfalse，验证器expectedFailureConfirmedtrue并退出0；外层5571ms、退出确认。原先false的失败记录保留，不改成通过。
3. Gemini VM正负对照：独立复跑155ms退出0；残缺旧payload为validation.shape，有效payload进入ready且particlesfalse。当前SDK脚本 createValidLucyPayload 含完整schema／draft／application，修复成立。此为响应校验正负对照，不是实际Host接受任何伪造指纹的授权证明。
4. SDK正常回放保留checkedtrue、fulfilled／零作者写、真实SSE断开及卸载DOM证据。其释放后60ms检查只能算所观测终态，不声称完整网络消费／从未闪入。

运行、详细报告、哈希审计和收尾证据见validation-summary.json等；9项交付文件哈希全部匹配。复核前后325保护输入和12冻结输入保持，没有改共享源码／生产资产。

## Codex补齐的确定性控制器边界

`deterministic-controller-boundaries-v2.mjs` 使用同一实际诊断作者控制器及VM导出。只在VM内增加一个观察physical Promise的QA挂载点，不改check／epoch／disposed等判断；request IO刻意忽略AbortSignal以模拟不配合取消的迟到结果。每个await有2秒截止、VM同步1秒上限，不靠固定等待。

四个场景通过：
- 同一控制器旧上下文在途时切新上下文，分别释放合法旧成功／旧错误；等待实际physical Promise完成，断言无旧值／旧错误进入当前状态，再显式读新上下文为ready／particlestrue，零作者写。
- 旧控制器dispose后新provider已ready，再分别释放旧成功／旧错误；等待旧physical Promise完成，旧控制器和新provider的通知增量均0，旧fields／values清空、canEditfalse，新provider仍ready／particlestrue，零作者写。

上下文切换场景旧physical完成时有一次busy清理通知，属资源收尾；断言其不含旧值或旧错误，不误称全程零通知。第一版报告将后续显式新读通知也计入，已另存v2分开计数，旧证据保留。

上述是实际控制器＋request IO替身的确定性回放，与SDK的真实挂载／HTTP／DOM终态证据组合覆盖本轮诊断边界；不称真实DSH或浏览器网络链路已完整做零闪烁验收。

## 监督器疑点的收敛

Gemini新版父监督相对既有版本缩减了树收尾／兜底。Codex审查时提出疑点，并以复制监督器、只缩短deadline及自有Node子孙替身验证，所有替身均自行限时退出、没有启动真实浏览器泄漏。

两次见证均未证实预设问题：第一次“管道导致父监督迟迟不返”的假设不成立；第二次在观察截止点也未见仍持续的新心跳，证明孤儿的断言失败。失败脚本及JSON保留，**不据此宣称发生孤儿进程或新的挂起缺陷**，不为未证问题开启补修循环。正常SDK／故障注入自有浏览器PID及替身PID的最新只读查询均无匹配，见owned-processes-after.json。

后续运行仍采用原已审的有界父监督，不复用无边界交互前置命令，也不全局结束旧任务。本轮正常／故障路径通过不等于所有可能的操作系统退出异常已穷尽。

## 最后文档更正与下一步

请Gemini只更正本轮交付／当前接续：
1. 把报告createValidLucyPayload代码块改为实际脚本的完整包络，包含schema.wallpaperId／schemaVersion／fingerprint／fields；保留旧错误及更正说明。
2. SDK部分明确60ms为定时终态采样；销毁SDK只验卸载／零写／无异常。实际控制器完成与通知边界引用本报告的Codex四场景、脚本／输出路径及指纹，不能称是自己SDK原断言。
3. 本轮门禁／payload修复及组合离线核验通过，现场首个失败阶段仍未知。无需再跑大套件、继续改实现或开展新专项。

后续只可考虑基于固定rc.50的窄阶段码取证方案，具体候选／安装／实机另轮安排；当前不生成候选、不安装／操作日常DSH或WE。日常DSH0.2.1-rc.3／Whalerc.48／GitBash0.1.2保持，Profile／生产assets／版本不动，既有脏改动保留；无提交推送、清理或定时。“▶ 播放”仍后排。
