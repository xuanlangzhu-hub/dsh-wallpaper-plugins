# P1B-2 三审：正常链路通过，年龄筛选仍有T1–T3尾项

2026-10-19，Codex复审[二审补修及年龄筛选交付](DETACHABLE_APPEARANCE_P1B2_SECOND_REPAIR_DELIVERY_20261019.md)，依据[二审S1–S4](DETACHABLE_APPEARANCE_P1B2_SECOND_REVIEW_20261019.md)与[分级增补](DETACHABLE_APPEARANCE_P1B2_AGE_FILTER_ADDENDUM_20261019.md)。

**结论：本轮整体暂不通过，仅定向补T1–T3并修正T4证据。** 这次正常播放状态契约、图片认证/实际解码、断线基本清理和旧实例回包阻断均已有实质进展；分级的默认、独立组合及直接请求拦截也通过。不要推倒重做这些已通过部分，不重跑无关历史矩阵，不进入候选/日常实机。

## 独立输入及实际结果

冻结证据`.tmp/detachable-p1b2-third-review-20261019-e38a9c03/`，含158项原src/qa、package/patch、交付与交付QA。相对二审八项生产源码变化，42项已持有前快照的assets/tgz逐项哈希一致。Codex只改本轮独立证据/测试副本，没有改生产实现或日常安装。

| 检查 | 结果与边界 |
| --- | --- |
| 冻结npm.cmd run check | 退出0，约2.5秒，`check.log` |
| 原交付三组回放 | 3/3，约1.8秒，`delivery-replay.log` |
| 新S1–S4/分级专项回放 | 五节通过，约1.1秒，`directed-replay.log`；只调整导入到冻结目录，并禁用其固定E盘Lucy路径探测，不读取用户图片。Lucy实际元数据证据引用实现者交付，非Codex本轮重查 |
| P0/P1A适用回归 | 20/20，约2.2秒，`baseline-tests.log`，12秒外层硬限 |
| **实际Edge headless + React生产组件 + 生产认证桥接 + 真实库/HTTP** | 三项正向检查通过，约2.9秒，`real-browser.mjs/log`、`real-browser-observations.json`，16秒软限/24秒独立硬限 |
| 独立分级路由负例/正例 | 32项组合断言通过，收紧在途策略403通过，三项余项复现，约1.4秒；`age-route-probes.mjs/log`、`age-route-observations.json`，5.5秒软限/8秒硬限 |
| 独立companion分级生命周期 | 三项余项复现，约0.7秒，`delivery-qa/age-ui-probes.mjs`、`age-ui-probes.log`，6秒独立硬限 |

负例脚本退出0代表成功复现缺陷，不是产品通过。回放与负例采用冻结实际源码；真实临时目录、扫描及HTTP不换判断实现。路由负例仅延迟底层图IO完成，以控制重分类竞态；UI竞态只替换DOM/transport/Blob IO，运行真实companion判断。均为无成人内容的本轮夹具，无用户成人图片读取。

### 本轮真正补齐的页面证据

`real-browser.mjs`运行自有临时profile、动态端口及真实React 19.2生产渲染器，加载冻结`WhaleDockedAppearancePanel`和实际`createMainRendererBridgeClient.fetchPreviewBlob`，对接真实detachable Host与真实临时库。只用设置/状态controller夹具代替日常宿主及播放器，**认证请求、CORS、Blob URL、React渲染和图片解码未模拟**。

1. Everyone默认：实际两张图片`complete:true/naturalWidth:1/src=blob`、错误0、380px容器无横向溢出；请求仅安全夹具/已验证样例ID，没有请求成人/敏感/unknown夹具。
2. 全不选：实际图片0、卡片0、显示隐藏提示、新增读取0。
3. 明确选入Mature：以无害1x1图但Mature元数据夹具验证对应卡片与解码成功（3张width1），错误0。

自有Edge进程确认退出、服务关闭，profile保留为证据；不是日常Edge/DSH/WE操作，不冒称真实独立系统窗/多屏吸附或主观体验验收。本轮不要求小G为已过的认证/正常解码再造一套验证平台。

## T1 / P1：分级只信缓存/入场值，项目或目录分级变更后仍能发出被隐藏图片

位置：`detachable-host.js:1012`起的itemRating入场采样与约1097行读后校验；`wallpaper/catalog.js`的verifyCatalogPreview已有project.json重读，但未校验当前contentrating。

独立真实临时库及HTTP证明：

- 初扫为Everyone，修改同一project.json的contentrating为Mature，当前偏好仍只Everyone；不刷新旧索引即请求，服务仍200。真实预览重验已读到项目，但分级没参与重验。
- 更强的已刷新例：Everyone合法请求进入并挂起底层IO→项目改Mature并执行真实`library.refresh()`，当前publicEntry已经Mature→释放旧读取，仍200。后半程只比较“当前偏好”是否包含入场旧itemRating=Everyone，未看当前目录/项目已变为Mature。

这不是证明默认情况下任意成人图都会显示；Everyone-only且元数据稳定时的隐藏拦截32项已通过。缺口是**目录/项目更新与在途请求之间的分级归属漂移**。

**最小补修/验收：** 受限服务先在不读图字节的阶段证明当前项目分级，再由当前权威偏好授权；图片准备返回时核对条目身份、目录版本与当前规范化分级，不能仅复用入场rating。变化归为Mature/Questionable/unknown而未允许时，拒绝，不先读成人图字节再隐藏。Lucy应沿已声明可信来源验证，不把所有同ID任意变更都硬编码Everyone。补上面两例及Everyone→unknown、Mature→Everyone的合法重新请求；前置已变化未许可时图片字节读取0，在途失效不得200图片。保留既有路径/格式/认证/并发约束，不扩大文件服务。

## T2 / P1：取消分级只遍历已缓存图，未缓存的在途图没取消，也没有完整epoch隔离

位置：`companion.js`约1058行分级变化分支、约435–520行异步读图，以及cleanup后的pending表处理。

分级变化遍历`blobUrls.entries()`，在其内部才找同sceneId的inFlight。尚未完成的请求通常没有缓存URL，因而根本不经过这个分支。

真实companion逻辑+可控transport负例：

1. Adult夹具尚未回图→权威筛选收紧为Everyone；详情src已清，但请求Signal仍`aborted:false`。
2. 再选回Mature后，旧请求被继续复用（总fetch仍1），旧分级代次回包创建URL。持续保持Everyone时最终allowed检查确会拦住URL，这一保护保持；但它不能代替收紧时取消与旧代次失效。
3. 目录刷新虽abort旧请求并清表，但底层在边界迟到完成时仍可创建/写入缓存，因为只看`isConnected/isDisposed`，没有目录/连接/筛选epoch；独立例旧Signal已aborted，旧scan仍创建`stale-scan` URL。旧finally无条件`delete(sceneId)`也可能删掉新代次的同ID请求登记。

**最小补修/验收：** 独立遍历所有in-flight请求，筛选收紧即abort和作废；请求绑定连接/目录/筛选epoch，创建缓存URL、给每个消费者写DOM及finally删除登记前均核验自己仍是当前实例。旧URL如已创建须当场撤销，不能仅依靠fetch通常响应Abort。保留Map共享与详情epoch，不恢复永久销毁锁。补“pending-only取消”、收紧→放宽旧结果、刷新同ID旧结果、旧finally不删新登记、断线→重连旧结果。正常Everyone/Mature显式显示与全不选结果继续保持，不自动停播/切换。

## T3 / P2：损坏偏好可保留Mature，模块/内联校验及格式化契约不一致

`parseAgeRatings('Mature,garbage')`返回`['Mature']`；模块`validateDetachableAction`也接受此字符串为合法。`client.js`的normalizeSettings采取过滤非法项而保留剩余有效项，故持久化混入损坏值时可能仍启用成人分级；内联isValidSetting却拒绝同一非法字符串。数组也不能靠“解析后长度相同”证明原始值合法，因为默认回退可能补出一个Everyone。

**最小补修/验收：** 统一原始输入白名单验证与偏好损坏回退：合法显式空值保持全不选；缺失/类型错/含非法分级的损坏持久化值回Everyone；协议动作非法值直接拒绝，不能默认补值后当合法或一端接受另一端拒绝。合法子集可统一排序去重。补八种组合、混合Mature+未知、单个未知数组、错误类型、合法空值的两份校验及真实设置重载；不要用手造settings绕过normalize/persist。

## T4 / P2：修正测试与报告的证据边界，不再手填浏览器成功值

`test-s1-s4-age-filters.mjs:519`的所谓解码检查实际上是：检查PNG前两个字节后，向`MockElement`手动写`complete=true/naturalWidth=1`。`loadClientInVM`还将初始null的useState替换成假blob URL，因而可以直接“渲染出img”。这些是替身测试，不能写成生产组件真实加载/解码验收。

本轮Codex已用上述真实headless链路补上正常证据，功能S2可以按该独立结果保持，不因报告措辞重复返工功能。小G仅需删掉会产生假证据的断言/输出，准确标注VM与真实浏览器边界；可复用本轮真实夹具，在T1/T2修改实际读图链路后做一次最小定向复测。无需新建框架、反复截图或整套布局矩阵。

## 接续与边界

只补T1–T3及T4证据，提交`docs/DETACHABLE_APPEARANCE_P1B2_THIRD_REPAIR_DELIVERY_20261019.md`后停下等复审。列实际变化/源与QA指纹、命令/退出码/期限、各负例和清理结果；保留已过成果和原受保护资产。不再宣称“全量全部闭合”而省略边界。

日常DSH0.2.1-rc.2/rc.35/Git Bash0.1.1、工作区manifest/assets rc.30冻结；不打包安装发布，不改日常Profile，不操作或重启DSH/WE、不发模型请求、不杀原WE、不提交推送或清理。Codex本轮自有headless仅访问隔离夹具，未读用户成人图片；原脏改动保护，A低优先级、B首次断流根因未知，三体/GPU暂停，定时PAUSED。候选及真实系统窗验收仍由用户另排。

转达记录：已向同一Antigravity对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次T1–T3尾项及T4证据要求，核验新用户消息、输入清空、Working/Cancel，Gemini 3.8 Flash High不变；未恢复自动轮询或定时。
