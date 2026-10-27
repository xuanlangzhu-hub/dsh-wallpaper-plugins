# rc.50 SDK边界交付复审：两项仍需补齐

2026-10-27，Codex。用户要求检查Gemini新交付，有问题按持续授权直接交回原对话。复审对象为 `RC50_AUTHOR_INITIAL_READ_SDK_BOUNDARY_DELIVERY_20261027.md` 及 `.tmp/rc50-gemini-boundary-verification-20261027-a/`。

结论：部分通过。真实SSE断开进入原requestAuthor并产生bridge.disconnected、输入原始／服务版哈希区分、隐藏时请求数量／取消态断言、正常收尾的最终通过门禁，均有新增有效证据；不要求重复这些未变部分。下面两项有可重复负例，不能宣称“四项全部完成”。日常实现没有因这轮诊断验证发生变化，现场根因仍未定。

## 独立证据

Codex新建 `.tmp/rc50-author-sdk-boundary-review-20261027-a/`，冻结15项交付／诊断输入，并核对325项受保护实现／QA／资产；四份运行脚本逐字节复制，新目录复跑，不覆盖原证据。

- 原SDK六场景断言再次通过，5244ms退出0，exitConfirmed=true、timedOut=false，浏览器退出与Host主会话清理为true。
- 收尾失败验证的父监督实际退出1，114ms；子code=1，但 **expectedFailureConfirmed=false**。原交付目录的运行结果也为false。
- 新增轻量VM校验使用实际诊断作者控制器，只替换request IO，不跑浏览器／原生：交付的旧成功payload和销毁payload均立即被拒为response-invalid／validation.shape；完整协议正对照则可ready且particles=false。三项检查均按预期通过。
- 复跑前后325保护输入、15冻结输入未变；交付成果八项文件哈希匹配。完整证据见validation-summary.json、两个-run.json及payload-validity-report.json。没有为未变代码重跑其它UI／性能套件。

## R1：失败验证本身未通过，且仍未验证实际SDK门禁的失败路径（P2）

`run-cleanup-failure-stub.cjs` 的 expectedFailureConfirmed 要求 `childReport.cleanupSuccessful === false`，但 sdk-cleanup-failure-stub.mjs 仅声明局部cleanupSuccessful，没有将它写入JSON。因此原文件及独立复跑均 expectedFailureConfirmed=false，父监督进程退出1。交付文档却称true／验证通过，与其列出且哈希匹配的结果文件直接冲突。

此外该stub另写了一套 allCasesPassed && cleanupSuccessful，既没调用 SDK 主脚本实际最终门禁，也没让该主脚本经历一次模拟close失败。它无法保证主脚本的失败收尾分支正确。正常六场景清理成功这一点仍接受。

最小修复与验收：
1. 修结果契约，使预期失败验证的子报告及父监督断言一致；区分子测试应失败（code1/passedfalse）和验证器应成功（expectedFailureConfirmedtrue／验证器code0）。绝不能把非零退出一律称预期成功。
2. 复用实际 SDK 最终通过判定函数，或给同一sdk-boundary-test.mjs增加仅QA故障注入点，在真实资源正常收尾后合成一个未确认／失败标志，验证同一生产于QA的最终门禁返回false和非零；不造真实泄漏。不要再拷一份无关布尔表达式自证。
3. 正常路径再确认仍为true／0。新轮排他目录，保留本次false作为失败证据；sdk-boundary-test.mjs末尾仍使用flag:w，应改wx，避免旧报告被覆盖。无需为此重跑全部历史测试。

## R2：旧成功响应仍不合法，迟到测试缺少可区分与处理完成证据（P2）

`sdk-boundary-test.mjs:457–465` 旧“成功”只有ok／schema.wallpaperId／fields，缺 schemaVersion、fingerprint、draft.revision／dirtyKeys／values 和 application。字段type还写成boolean，实际协议是bool／supported／label，数值在draft.values中。销毁例593–598的空fields响应同样缺协议包络。

原实际控制器 `client-probe-test-hook.js:7602起` 会在accept阶段拒绝上述响应。Codex将两份原payload作为当前可见上下文的正常响应读取，两者均blocked／validation.shape、0字段；补完整协议的正对照则ready、1字段、particles=false。因此不能把“旧成功未覆盖新UI”归因为换代隔离，也不能称已使用结构有效的旧成功。

现有换代成功只断言控件 enabled，没有断言checked／值／字段及当前上下文；旧值覆写但仍enabled也可能过。RequestLatch.handle吞掉route.fulfill失败后仍set settled=true；waitSettled只证明路由处理结束，不证明客户端已消费／忽略结果，随即读DOM可能早于异步更新。错误例的单次count==0也不能证明“从未闪入”。销毁后DOM为空只证明卸载，不证明控制器没有迟到通知。

最小修复与验收：
1. 从真实成功schema响应复制完整包络（或复用已验协议夹具），仅调整合法draft.values.particles等可辨认字段；先在同一真实controller当前上下文中单独读入，确认ready并出现旧值，证明payload能被接受。销毁例同样用该有效包络。
2. 旧请求保持在途直到新代次确已ready；释放旧成功／旧错误后，等待可核实的客户端结果／作业完成检查点，再断言新上下文的具体值、checked／字段与状态保持。记录请求数、零作者写及零原生命令。需要证明“没有闪入”就观察更新／mutation；否则收窄文字到确实检查的终态。
3. 明确记录路由是成功fulfill还是请求已被abort，不吞掉后称成功投递。真实abort属于有效取消证据，但要与“客户端收到有效旧结果后丢弃”的用例分开。可组合SDK卸载／abort事实和实际控制器在不配合取消的请求替身下迟到成功／错误的状态通知断言，分别标注归属。不要为了测试去删业务门禁。
4. 销毁检查需覆盖旧控制器不再发布更新／不写；不要求大量新增矩阵。以上为同一迟到隔离问题的最小补齐，不增加新专项。

## 交接与范围

下一交付：`docs/RC50_AUTHOR_INITIAL_READ_SDK_BOUNDARY_REPAIR_DELIVERY_20261027.md`。只修本轮隔离QA／诊断夹具和报告，不提升共享实现、不放宽鉴权／身份／响应校验、不改自动读取策略、不打包安装或准备实机候选，不操作日常DSH／WE／Profile／assets／版本，不推送清理／建定时。所有前置命令与测试同样断stdin、有界父监督，严禁再套交互PowerShell持续等待。

Codex已接受的真实bridge／输入指纹等成果保留；不要因补两项重跑无变化的大套件。根因仍未知，不把测试转绿称为现场已修。日常DSH0.2.1-rc.3／Whalerc.48／GitBash0.1.2保持，既有脏改动保留。
