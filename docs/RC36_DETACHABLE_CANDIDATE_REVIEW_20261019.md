# rc.36独立设置/分级图库候选：独立核包与离线接缝通过

2026-10-19，Codex复审[rc.36交付](RC36_DETACHABLE_CANDIDATE_DELIVERY_20261019.md)，对照[隔离整合任务](GEMINI_NEXT_RC36_DETACHABLE_CANDIDATE_20261019.md)。

**结论：候选核包、已审来源整合和本轮实际候选离线检查通过，无新增阻断项。** 可以进入有新备份的独立窗/吸附与图库短验准备，尚未安装或取得真实系统窗口/长期体验验收。日常仍DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，不把候选通过写成升级完成。

## 不可变候选与来源

| 项目 | 独立结果 |
| --- | --- |
| 候选 | `release/plugins/dsh-whale-mist-0.6.0-rc.36.tgz`，7,477,137字节，35文件 |
| SHA-256 | `DCF07386808BC5DD50522AF9143A3840E0B485F6881907D640F744D80B0DF8D5` |
| 基底 | rc.35，SHA-256 `20D35ED1A63E2272FF50E44A9A38891F1D973994BED446FB19D79B0A9E6FAE58`；**实际7,392,549字节**，28文件；交付报告基底大小7,458,458为笔误 |
| 相对rc.35 | 20项逐字节保持、8项原文件修改、7项新增；原文件没有删除 |
| 原生/声明 | assets/wallpaper全部12运行文件、另外2个assets、图标源码与patch保持；manifest的新宿主engines/6项peerDependencies/注入/exports/main保留 |
| Trace/归档路径 | 禁止的Trace标识0；35项均为regular文件，无重复、链接、绝对路径、父目录穿越，未混入QA/Profile/私有图片/缓存 |

独立证据：`.tmp/rc36-candidate-review-20261019-7d382b65`。Python tarfile直接读取冻结归档成员，再仅按验证过的regular路径写入全新candidate-stage；**本轮所有运行检查均绑定这份从tgz解出的代码**，不是原工作区。archive-audit.json列全量路径/哈希与差异，final-evidence.json汇总最终结果。原包、候选均未改写。

八项改动为README、package.json、client、index、catalog、library、session、managed-window；七项新增为四个detachable JS与三个companion静态文件。

- index/catalog/library、四个detachable JS及companion三文件逐字节等同P1B2五审冻结来源。
- session/managed-window逐字节等同B六审rc.35对应修复版，未复制带Trace的工作区session。
- 对**包内client**反向应用准备时21-hunk产品patch，恢复结果SHA-256 `4B81E383D72645225ADBE4A85B31A870F998E653592F11E2E20AC4555038CD1C`，与rc.35 client逐字节相同。代码来源可追溯；反向成功不代替下表运行检查。
- manifest只有version/files/scripts结构变化，scripts.check增补新模块语法检查，未扩大运行权限或降回旧宿主声明。
- 归档内35文件与交付stage逐项一致，测试结束解包文件及固定tgz仍与入场哈希一致；工作区158项源码/QA、42项受保护资产归档前后不变。

## 本轮运行检查

| 检查 | 结果与实际覆盖 |
| --- | --- |
| 原交付五组重放 | 5/5，约9.1秒；delivery-replay.log。路径改到本轮解包候选及独立输出；每子脚本15秒，真实浏览器25秒硬限。第5组替身ctx.effect缺失的边界见下文，不把进程退出0扩称完整接入 |
| 独立P0/P1A基线 | 20/20，约1.6秒；baseline-result.json、baseline-console.log，12秒外层硬限；窗口/系统IO用替身，不操作DSH/WE |
| 独立B六审rc.35对应完整负例/路由 | 退出0，约1.9秒；b-route-probes.mjs、b-route-result.json及日志，8秒外层硬限，加载offline-guard阻止遗漏替身时执行真实外部查询 |
| **实际官方0.2.1-rc.2 SDK接缝补验** | 退出0，约1秒；actual-sdk.mjs/log、actual-sdk-observations.json，3.5秒软限/6秒硬限；真实Cordis Context与HostConnectionService，结果见下文 |
| 实际解包候选React/认证HTTP/图片解码 | 3项通过，约2.6秒；candidate-qa/test-4-real-browser.log、real-browser-observations.json；真实headless Edge、React生产panel、生产桥接、真实Host/临时库；自有进程和服务确认关闭，profile保留 |

独立基线第一次重绑定时漏改QA读取package.json的相对路径，19过/1个ENOENT；只修测试副本路径到候选manifest后20/20，首次失败保留baseline-first-path-error.json，不归咎产品。不编辑包内代码来迁就测试。

### 已覆盖的关键行为

- 本地imports/静态页/清单闭包、15个JS语法、CSS模板守卫通过；20项基底保持、B对应修复指纹及无Trace通过。
- 认证/Origin与隐藏分级读前403且图片读取0；U1第9路拒绝、3秒HTTP超时、底层未结束占位保留/释放后恢复；U2首次metadata取消分级读0、最终metadata取消分级403、替换主端403，以及合法图片200通过。Host逐字节匹配五审已审实现，其最终8路metadata占位加强证据保持，不机械再跑同一慢IO矩阵。
- B完整默认解析负例、严格创建时间/字段与worker证明、无日志保持未知、错/坏身份0关窗，以及真实注册路由中的stop=409保留session、新start=409，可信恢复后stop=200释放/newstart=200通过。交付两事故回放也在本轮解包候选重放通过；均是进程/窗口底层IO替身，不是真实强杀。
- 真实React页面Everyone默认2张真实解码width=1、错误0；全不选图片/卡片/新增读取0；显式Mature仅无害1x1夹具解码3图。无用户成人图片读取。

### 第5组接缝测试证据修正与独立补齐

交付脚本名称含Cordis，但它构造的是mockCtx，没有ctx.effect。本轮原样重放明确输出`[Whale wallpaper] setup failed: ctx.effect is not a function`，后续只验证companion引导仍通过。因此该脚本本身不能证明壁纸路由与真实Cordis兼容。

Codex以本地此前从官方安装器提取的0.2.1-rc.2实际SDK加载**包内index.apply**补齐：真实Cordis Context、真实HostConnectionService；webServer载体与browserAuth登录结果是本轮隔离替身，未使用日常凭据。`WM_CONTRACT_ISOLATED=1`保持，不启动任何原生helper或可见窗口。

结果：壁纸和bootstrap路由同时注册；实际连接服务拒绝匿名401、不泄露token，受信任且已认证请求200，非法Host403；fiber.dispose后路由数0、监听Server数0，原动态端口无法再连接。没有靠process.exit隐藏漏监听。实际结果足以补齐本候选当前接缝范围，**无需再为这个mock缺口退回生产源码补修或跑一轮候选**。此处不是实际DSH安装/窗口验收。

交付“零网络请求”应理解为无外部网络/模型请求；实际HTTP/CDP测试用了自有loopback。基底大小及这两项证据措辞以本报告和原始日志为准，不重写不可变包内README或归档。

## 下一轮受控短验计划（尚未执行）

1. 先重新确认届时方便、其它助手暂停且DSH无任务；用户停止播放并正常菜单退出，原WE保持。不沿用历史退出回复/PID/HWND。当前没有新实机授权，不查询或操作日常窗口。
2. 关闭后新建本轮备份：当前实际Profile及完整关闭状态外观存储（按当轮实际集合，不硬套旧5/10/11数量）、固定rc.35包与活动安装文件哈希、原窗口布局及必要启动状态。保护本轮之后新增会话/附件，备份核对通过再安装；不复制包含令牌的内容到报告。
3. 重新核实官方CLI路径/版本，以官方profile插件安装流程安装已核定的固定rc.36，核对35安装文件及兼容加载；不手工覆盖node_modules、EXE/app.asar，不升级宿主/Git Bash或全局设置。
4. 正常重开，先看原布局/外观，播放停止；从顶栏打开外观，短验独立窗→吸附→再独立、主/伴随双端同一设置与即时反馈，关闭伴随不丢主界面，未知清理状态不能绕过保护。先避免大矩阵/多屏长测。
5. 图库默认只Everyone；首轮不勾选Mature或打开用户成人图片。检查预览选择不自动开播、隐藏提示与全不选；选Lucy手动短播/鼠标/停止清理，再确认界面无误。共享控件/四字段预设作一轮最小恢复检查，保留原值。实机主观反馈如有异常立即记录，不硬改宿主或强杀原WE，不做三体/GPU专项。
6. **默认无论短验是否通过，测后正常退出并恢复日常rc.35及本轮原设置**；是否保留rc.36另由用户明确选择。恢复前先保留本轮新增数据/证据，用官方CLI装回固定rc.35，核对28安装文件，再只恢复本轮修改的设置，正常重开确认。不是交付所写“遇异常立即重置”的无备份覆盖流程。

本轮只写计划，未创建日常备份、未安装或退出/重开DSH、未清理Profile/Edge目录。真实系统窗/吸附、多屏DPI、所有壁纸、长期资源与B实机恢复仍未验收，首次壁纸断流根因未知。小G停止实现/构建，保留候选，待用户安排短验；无需新增代码任务。

A低优先级、三体/GPU暂缓，定时PAUSED；本轮不提交推送或清理工作区。源码manifest/assets仍rc.30，日常rc.35保持。

转达记录：已向Antigravity原对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次候选通过及停止通知，核验新用户消息/输入清空/Working，Gemini 3.8 Flash High不变。没有恢复自动轮询或定时。
