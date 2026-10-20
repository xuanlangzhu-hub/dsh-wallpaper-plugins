# 独立/吸附设置P1A三审：R6原失败闭合，继续收敛R1/R4

2026-10-17，Codex。复审[二审补修交付](DETACHABLE_APPEARANCE_P1A_SECOND_REPAIR_DELIVERY_20261017.md)，对照[二审余项](DETACHABLE_APPEARANCE_P1A_SECOND_REVIEW_20261017.md)。**仍暂不通过，不打包安装或进入P1B。** 原探针结果已改善，R6同值卡住/跨字段丢意图两项闭合；不要返工这些已修项。剩余集中在生产组合的R1来源隔离与R4目录归属、失败重试。

本轮只读源码并运行隔离检查，未改小G实现，未查询或操作真实DSH/WE/日常Profile，没有可见伴随窗口，没有执行真实taskkill、提交推送或清理旧证据。日常基线沿用已交接的DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，不将历史停止状态作当前事实或授权。

## 已通过的部分保持

独立目录`.tmp/detachable-p1a-third-review-20261017-bf44de30`，冻结154项输入，见`inputs.json`。优先复跑二审原探针，未用小G重新编写的同名检查替代：

- `remaining-probes.mjs`：默认未配置origin时null/外来端口正确拒绝；预构建profile登记1、普通关闭后不存在；未收到child exit不报成功、保留记录/目录；adapter明确失败传回主端，保持docking/owner/unconfirmedCleanup。
- R6：同值70→95实际发送95且最终确认95；brightness95与mask0交错分别用revision1、2，最终确认95/0。原两个失败已闭合，不继续要求重写输入队列。
- 实际新版Cordis/HostConnectionService：匿名引导401、无mainToken泄露，普通fiber卸载后无监听。实际React19.2.0：稳定引用、无错误、顶栏按钮保持。
- 正式Host生成URL→正式伴随HTML/ESM→实际握手→DOM input→真实主controller确认95/0仍通过；主端引导/DSH服务和窗口adapter有fixture，不称真实Desktop/原生窗验收。
- check、P0 15/15、新P1A 5/5、旧headless双Tab11项（spawn=3/close=3）、外观570/英文566/scene-selection均退出0。

以上证明修复有效，但不能用来覆盖下列新组合探针的反例。

## R1余项 [P2] 正式Host注入的主端白名单仍被伴随端共用

位置：`src/index.js:126`、`src/detachable-host.js:265`。

默认`createDetachableHttpHost({allowedOrigins:[]})`确实通过二审origin负例。但生产index传入`['dsh-app://app', desktopOrigin]`，server仍在区分路由前执行`if(allowedOrigins.includes(orig)) return true`。因此正式组合中的伴随端仍放行主端来源，交付所称“伴随通道严格仅本轮独立origin”不成立。

隔离调用**实际index.apply**，webServer替身设为http://127.0.0.1:12345，获取其真正创建的动态端口，再访问该服务：

| 路由 | Origin | 实际预检 |
| --- | --- | --- |
| /api/main/connect | dsh-app://app / 明确Desktop origin | 204，符合主端用途 |
| /api/action | dsh-app://app / 明确Desktop origin | **204，穿过伴随端隔离** |
| 两类路由 | null / 未配置的另一端口 | 403，补修保持 |

这不是匿名token/lease绕过；鉴权已修项保持。剩余是主/伴随两种能力的来源范围未拆开，原测试只构造默认空配置，未覆盖实际index传参。

补修：主端允许表只在`/api/main/*`使用，伴随端独立检查自己的精确origin；如确有其它通道需求，单独命名配置并给出用途，不能共用无条件allow。新增实际Host组合正负例，保持null/未知端口拒绝，不重做认证协议。

## R4-A [P1] 用路径外观认领已有目录，会删除不属于本轮的文件

位置：`src/detachable-edge-adapter.js:111`、`:126`、`:128`和`cleanupProfileDir`。

这轮通过“位于tmpdir字符串前缀内且basename带whale-companion-profile-”就设置isDedicatedTemp；`mkdir({recursive:true})`对已有目录也成功，随后加入owned集合。这正是二审明确禁止的“把任意传入路径直接标为owned”，独特默认名称不能保护显式已有路径分支。

确定复现：复审fixture先创建一个自身专用临时目录及sentinel文件，之后才把路径交adapter，进程IO全为替身。adapter把它登记ownedCount=1，close返回成功后，**目录和sentinel都消失**。没有接触任何用户已有目录；删除范围只涉及本探针刚创建的隔离测试资产。证据`ownership-origin-probes.mjs`、`ownership-origin-result.json`。

补修要求：

1. 唯一创建者用独占创建/mkdtemp取得新目录，真实创建成功才登记归属；预构建spec与创建者通过内部所有权句柄衔接，不以命名前缀当所有权证明。
2. 已有/外来目录明确拒绝或只作为不可清理的外部资源，不认领、不覆盖、不递归删除。保留正常生产spec的回收改善，不能退回全部不清理。
3. 删除以记录内目录为准，不信任close调用新传的profileDir；解析后的实际边界用目录祖先关系/必要的重解析点校验，不用`startsWith(tmpdir)`判物理归属。
4. 补已有同前缀目录＋sentinel保留、失败创建/启动、正常创建回收与错误handle负例。所有目录仅测试自己创建的独立资产，不拿用户目录验证。

## R4-C [P1] 停止失败后server已置空，再次stop会未重试却返回成功

位置：`src/detachable-host.js:1172`、`:1189`、`:1193`及`src/index.js:232`。

新stop确实能在**第一次**返回cleanup失败，改动有效。但随后关闭server并令server=null。下一次stop直接走末尾`return {ok:true}`，不再处理仍保留的owned handle。index的cleanup Promise则缓存第一次调用，只警告stop失败，不把该结果返回上层；不能由“已返回并等待Promise”推成“失败结果/重试也已闭合”。

隔离替身第一次close返回失败，之后切换为成功：第一次stop.ok=false；第二次stop.ok=true，但closeCalls仍1、ownerStillRetained=true、unconfirmedCleanup=true。第二次没有尝试关闭，却报告成功。

补修：通信server关闭与原生资源清理状态分开；server=null也必须依据未清理所有权重试或明确返回仍失败，不能凭server不存在宣称全部成功。cleanup返回真实结果/失败供拥有者保留、报告和重试；成功后重复调用幂等，失败后允许有边界的再次清理。补“先失败→修复条件→再stop确实调用close→最后清归属”及持续失败负例。

## R4-B验收边界仍须如实保留

收到child exit才允许清理，已修复二审“taskkill成功回调但没exit也当成功”的反例。本轮不重开这个已闭合子项。

但当前实现仍只有最初child的kill/exit记录，未交付原任务要求的正常系统窗口关闭、进程/窗口强身份及Edge多进程资源集合确认。二审已明确“Edge首个child exit不能单独证明所有资源已终止”，不能把本轮事件替身的exit写成完整OS资源已确认。下次交付须给明确生产机制/可注入验证；若做不到，指出具体依赖或阻塞供复核，勿再把“等首个exit”描述成完整方案。实际顶层窗效果仍在离线复审通过后另约，不为补证明擅自操作日常程序。

## 下一轮范围

只补本文R1与R4剩余资源归属/关闭/重试，R6以及R2/R3、R5普通卸载和P0七审成果保持。写`docs/DETACHABLE_APPEARANCE_P1A_THIRD_REPAIR_DELIVERY_20261017.md`，报告区分实际index组合、独立server、真实React/controller、进程/窗口替身及未实测边界，不只输出“全部100%”。

复跑原二审探针与本轮`ownership-origin-probes.mjs`对应正负例，补真实清理结果/重试断言；按改动范围跑check、P0/旧E2E/P1A、实际SDK/生产页面及必要外观回归。暂不进入候选整合、安装、P1B或作者参数，不改版本/原生assets、不提交推送/清理，不跨会话消息。
