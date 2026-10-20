# P1B-2 五审：U1/U2通过，源码离线阶段收尾

2026-10-19，Codex独立复审[四审补修交付](DETACHABLE_APPEARANCE_P1B2_FOURTH_REPAIR_DELIVERY_20261019.md)，依据[四审U1/U2](DETACHABLE_APPEARANCE_P1B2_FOURTH_REVIEW_20261019.md)与[分级增补](DETACHABLE_APPEARANCE_P1B2_AGE_FILTER_ADDENDUM_20261019.md)。

**结论：U1与U2的原复现及必要回归通过，P1B-2当前源码离线范围收尾。** 不再要求实现返工。图库/详情/显式播放、共享外观、年龄分级正常链路保持。通过不等于候选整合、真实独立系统窗口、吸附/多屏/主观体验或长期稳定验收；不自动打包安装或推进新功能。

## 冻结输入与保护

证据目录：`.tmp/detachable-p1b2-fifth-review-20261019-af4d4200`。交付SHA-256 `1E46DE731C53ED94245FB55B54CB2F374EC086F670F9400966F702A2F7A1CC58`。

冻结158项src/qa、package/patch、交付和QA；相对四审只有Host、catalog、library三个生产文件变化，其余源码/QA保持。测试结束158项原输入哈希未漂移，42项有前快照的assets/tgz一致，见inputs.json、preservation.json、protected-before.json、final-evidence.json。Codex只写独立证据与文档，没有改小G生产实现。

## 实际验证

| 检查 | 结果与边界 |
| --- | --- |
| 冻结npm.cmd run check | 退出0，语法及CSS守卫通过；check.log，版本仍rc.30 |
| 原交付Test 1–5回放 | 5/5，约8.9秒；delivery-replay.log。U1/U2专项约6.9秒。各子进程由已审监督器以15秒硬限运行 |
| P0/P1A | 20/20，约1.6秒；baseline-tests.log，独立12秒硬限 |
| 原独立年龄路由回归 | 32项组合/unknown、读取期间取消分级、磁盘改Mature未refresh、在途refresh改Mature及损坏偏好/协议拒绝均通过；age-route-probes.mjs/log与observations，5.5秒软限/8秒硬限 |
| 原独立companion生命周期 | pending-only取消、取消后再放宽旧结果无URL、旧目录结果无URL且旧finally不删新请求登记通过；delivery-qa/age-ui-probes.mjs、age-ui-probes.log，6秒硬限 |
| 四审复现改为修复断言，并加强最终查询占位检查 | 5组通过，约7.3秒；async-rating-probes.mjs/log与observations，11秒软限/14秒独立硬限 |
| 实际隔离Edge headless + React生产组件 + 生产认证桥接 + 真实库/HTTP | 3项通过，约2.5秒；delivery-qa/real-browser.mjs/log、real-browser-observations.json，16秒软限/24秒独立硬限 |

只调整交付QA导入/资源路径到冻结目录；固定E盘Lucy项目探测跳过，真实Lucy元数据仍引用小G先前交付，不冒称本轮重读。年龄夹具是无害1x1图片，没有读取用户成人图片。真实路由/库/metadata/图片读写使用生产代码；异常竞态只在IO完成边界放置可释放屏障，不替换授权判断。MockDOM/transport仅用于生命周期判断，不作浏览器解码证据。

### U1：全生命周期期限与真实占位

- 前置并发限制在首次metadata IO之前执行；单一3秒超时覆盖整个pipeline，不每段重新计满。占位绑定实际pipeline最终落定，而非HTTP超时响应或图片读取单段完成。
- **首次查询挂起8路：** 9个认证请求只有8个进入metadata，3.26秒时9个HTTP都已503；底层仍挂起时新增请求也503、metadata调用仍8。释放真实IO后合法请求200，取消后不启动后续图片IO。
- **最终查询挂起8路：** 8个不同scene的首次查询和图片IO完成后，各自最终查询挂起。约3.01秒时8个HTTP均503，metadata共16次；未释放时新增请求503且调用不增加。释放后合法请求200。
- 自有屏障全部释放，Host正常关闭。该证据证明慢IO边界与占位处理，未宣称真实磁盘实际发生过永久挂起。

### U2：每段await后重核权威权限与会话

- 首次metadata查询等待期间取消Mature：403，图片读取严格0。
- 最终metadata查询等待期间取消Mature：403，不发送图片响应。
- 最终metadata查询等待期间登记另一主端instance：403，会话失效。

以上三条是四审独立复现原脚本改为修复断言，不依赖小G结果文字。源码在各IO完成后重核当前会话/代次、分级允许列表及abort状态；原先的旧允许列表跨metadata await问题已消除。

### 真实页面最小回归

真实React19.2渲染冻结WhaleDockedAppearancePanel，使用生产createMainRendererBridgeClient认证fetch到实际Host及真实临时库，仅controller/播放状态使用夹具。认证请求、CORS、Blob URL和图片解码未模拟：

1. Everyone默认2张图片实际complete=true、naturalWidth=1、blob URL，错误0，380px容器无横向溢出。
2. 全不选：图片0、卡片0、隐藏提示存在、新增读图0。
3. 显式选入Mature：3张无害夹具图真实解码，错误0。

自有Edge确认退出、HTTP fixture server和Host关闭，profile保留为证据。没有操作日常DSH/WE，未将无头页面等同真实系统窗/吸附交互。

## 交付文档勘误（不阻塞源码通过）

交付中的示意摘录与实际脚本细节有两点以本轮原始日志/源码为准：实际并发错误为`preview-concurrency-exceeded`，不是`preview-concurrency-limit-exceeded`；run-p1b2-qa.mjs实际是每个子脚本15秒外层期限，并未实现交付所称的单一30秒总期限（5项最坏约75秒加有界终止）。test-u1-u2单独入口是10秒软限/12秒硬限，主runner运行它时外层为15秒。均有有限期限，本轮没有挂起；不要把未实现的30秒总限写作已验事实。后续沿用当前报告的实际数值即可，无需为措辞启动新一轮源码补修或重测。

## 当前接续

小G停止实现，保留冻结成果；不再反复回读历史或扩大矩阵。下一阶段可由用户另排：先定义隔离候选整合边界（从可信日常基底挑入已审源码，排除工作区Trace等未验增量），再独立核包与准备真实窗口/吸附及图库短验。当前只记录待办，没有开始构建、安装或实机操作；不能整体打当前工作区或只改版本号发布。

日常DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1保持；工作区manifest/生产assets rc.30保持。未改Profile、未发模型请求、未提交推送清理。A滚动问题低优先级，B首次断流根因仍未知，三体/GPU暂缓，定时PAUSED。

收尾转达：已向Antigravity原对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次“离线通过、停止实现/测试、等待用户安排”的通知，核验新用户消息与输入清空、Working/Cancel，Gemini 3.8 Flash High未变。未恢复轮询或定时。
