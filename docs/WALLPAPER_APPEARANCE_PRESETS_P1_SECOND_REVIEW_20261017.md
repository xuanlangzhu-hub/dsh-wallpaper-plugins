# 外观预设P1补修复审：基础反例已修，R1/R2仍需续修

2026-10-17，Codex。依据[首审](WALLPAPER_APPEARANCE_PRESETS_P1_REVIEW_20261017.md)和[小G补修交付](WALLPAPER_APPEARANCE_PRESETS_P1_REPAIR_DELIVERY_20261017.md)，对实际源码、QA及异步接缝复核。**暂不通过。** 原先两个最直接的反例已修复，120项外观断言及场景选择检查通过；但R1的旧请求隔离、R2的目录确认失效机制仍有可复现缺口。继续补这两项，不扩展功能。

## 已确认修复的部分

- 单个真实stop请求挂起时，`cleanupPending`能阻止UI预设三按钮和controller保存；成功清理后恢复可操作。
- 初始未确认的工坊ID被拒绝；当前快照明确标记不可用时，controller也拒绝。Lucy回退及Host明确不可用拦截已有回归。
- 独立复跑原探针，两行均为`regressionObserved:false`。这只能证明所列基础场景，不能据此声称R1/R2完全闭合。

## R1 [P2] 旧stop回复仍能覆盖新轮状态或清理失败

定位：`dsh-whale-mist/src/client.js:1254–1269`。`isCurrent`只控制是否清除标志；无论是否当前请求，旧回调仍更新`lastCleanup`并调用`emitStatus`，覆盖state、error、host。`:1342/1372`的start/restart会重置活动stop标识，但旧回调并没有因此退出。

本轮使用真实controller/start/stop、可控假Host回复，未替换getStatus，复现：

1. 第一轮启动后调用stop；假Host已完成这次停止，但将其成功HTTP回复延迟。
2. 再次调用真实start，假Host新源active，客户端处于connecting，预设正确拒绝。
3. 释放第一轮的旧stop成功回复。客户端被改成stopped、host旧快照active=false；假Host的新源仍active。
4. `resolveTarget`变为`ok:true/isPlaying:false`，save成功。新轮连接过程被旧停止结果误报成稳定停止，预设屏障被绕过。

补充乱序反例：两个stop都挂起，较新请求先返回`cleanup.closed=false`，客户端进入cleanup-failed并拒绝预设；较旧成功回复随后到达，又将状态改回stopped并允许保存。该例验证旧成功不能解除当前失败；它是受控回复乱序测试，不代表实机Host必然产生这组结果。

**最小续修要求**：在修改任何当前state/error/host/lastCleanup或清理标志前核对请求归属；旧请求的成功、失败和异常都不能发布当前终态、擦掉新失败或解开新屏障。按实际请求标识区分stop轮次，不能只对一个布尔字段做条件赋值。保留reset、背景切换、内部失败停止与dispose边界，不改Host/原生清理规则。新启动与旧清理之间应有明确一致的策略，不能靠无条件清零让未完成请求失去归属。

新增回归至少覆盖旧stop成功/失败/异常迟到、新start/restart、连续stop以及较新cleanup-failed后的旧成功；验证状态与host快照未被覆盖、UI及controller三操作持续遵守当前屏障。保持单stop成功后正常开放的正向检查。

## R2 [P2] 刷新时旧组件快照可恢复授权，读取异常也未清除确认

定位：`dsh-whale-mist/src/client.js:2248–2256`、`:1404–1412`及`:1163–1189`。

组件在render期间和effect内将自己的旧`library`写回引擎，setter没有请求版本约束。显式刷新虽先将引擎快照清空，组件的`setLibrary(current => ({...current,loading:true}))`仍保留旧loaded/ready/items；下次render便把旧确认恢复，绕过`libraryRevision`。

本轮复现使用真实readLibrary HTTP与真实组件，目录局部状态使用仓库已有hook fixture方式供给；未调用生产setLibrarySnapshot来伪造确认，也未替换getStatus：

1. readLibrary确认B可用。调用真实`readLibrary({refresh:true})`并挂起回复。
2. 刷新开始后引擎快照为null，controller正确返回scene-unconfirmed。
3. 以正常刷新中的局部状态`{...旧列表,loading:true}`调用真实组件render。为模拟已经挂载后的render，fixture不重复运行挂载读取effect。
4. 组件render中的setter将引擎恢复为旧loaded/ready快照，保存按钮enabled，controller.save成功；刷新请求仍未返回。
5. 真正释放刷新回复（B不可用）后才恢复拒绝。缺口就在刷新等待期间，不是永久无法识别不可用。

另一个直接controller反例：先经真实readLibrary确认B可用，再让下一次普通readLibrary的fetch抛网络异常。Promise拒绝，但因没有catch清理当前确认，controller仍返回ok并保存成功。正常UI后续render可能清理快照，不能代替controller在失败时立即执行失效策略。

**最小续修要求**：目录确认应由带请求版本的读取结果统一维护；组件展示用的旧列表不能反向恢复已失效的确认，尤其不能在render中写全局确认状态。显式刷新在途、当前读取失败/非就绪应遵守未确认策略；旧请求的异常和迟到回复也不能清掉新确认或恢复旧确认。保留Lucy独立样例语义和明确不可用拦截，不为预设操作新增扫描/窗口查询。若保留快照写入口，必须具有同样的归属约束，不能仅为QA注入而绕过生产边界。

新增回归至少覆盖：真实刷新挂起+旧loaded/ready组件render，刷新失败、fetch/json异常、非ready返回、并发读取乱序及面板卸载后迟到。UI与controller保存/应用/删除一致拒绝；新确认可用后正常恢复。测试不能只注入一个ready快照或替换getStatus。

## 本轮证据与保护边界

证据目录：`F:\dsh-wallpaper-plugins\.tmp\wallpaper-appearance-presets-p1-repair-review-20261017-cfd5087d`。

- `check.log`：`npm run check`通过，含CSS模板守卫。
- `appearance.log`：`npm run test:appearance`，120项通过。
- `scene-selection.log`：`node qa/appearance-regression.mjs --scene-selection-only`通过，未改选择会启动一次、切换过选择则不自动启动。
- `original-boundary-probe.log`：首审基础两项反例均不再出现。
- `extended-boundary-probe.log`：本次四个接缝反例均出现，归属于上文R1/R2两项P2。生产getStatus未替换。
- `before.json`及`protected-verification.json`：在更新本轮接续文档前，411个保护文件指纹全部一致，包含生产/QA、旧归档、日常安装文件和5个Profile。源码及正式QA未由Codex修改。

探针命令：`node <本轮证据目录>/probe/appearance-regression.mjs --preset-review`；原基础反例用`--original-preset-review`。本机探针用于观察这些交错结果，退出码0不表示修复通过；正式回归须明确断言正确拒绝/忽略旧结果。

仅使用独立临时profile的无头Edge与假Host；没有操作/查询真实DSH或WE、截图、实机验收、打包安装、版本/assets修改、提交推送或跨会话消息。没有重复GPU/性能/三体专项。日常rc.31文件保持；今日实际运行/播放状态未查询。

## 给小G的续修交接

只续修上文R1/R2和必要隔离回归，保留已通过部分。四字段、手动语义、120%上限、默认值、存储/reset隔离保持。不要为了让fixture通过在组件render中写确认，也不要只增加状态字段而保留旧回调无条件发布。

交付写入`docs/WALLPAPER_APPEARANCE_PRESETS_P1_SECOND_REPAIR_DELIVERY_20261017.md`，按实际证据修正“旧轮次不会干扰/两项完全修复”的结论。原补修交付及首审保留历史。通过后再拆主题可读性/强调色；本轮仍不打包安装，不为120%单独做候选或实机，不自动向其它会话发任务。
