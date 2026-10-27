# 作者设置 P0：受限参数、内存草稿与共享表单契约

2026-10-21。依据[P0任务](WALLPAPER_AUTHOR_SETTINGS_P0_TASK_20261021.md)完成离线实现：**受限作者参数读取、schema/value校验、分壁纸草稿、双端修订冲突保护及参数计划已有可执行模块和QA，285项主回归+24项销毁检查通过。**

**尚未接入实际面板控件或正式Host引导，也没有执行WE参数命令。** 新Host模块只在明确传入认证controller上下文后才能注册，测试执行了真实路由模块及隔离loopback HTTP，不能将其称为日常DSH接口已上线。日常仍DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1，安装/Profile/活动存储/原WE保持，不打包或安装本阶段代码。

## 本机声明与实际支持

仅使用批准根，目录扫描后按ID重验入口及分级，读取可用Everyone的scene/web项目metadata，不读取预览或媒体载荷。15项符合条件；清单只记录结构、类型、计数，不复制作者标签或实际值。证据根：`F:\dsh-wallpaper-plugins\.tmp\author-settings-p0-20261021-94c28e17`。

328个原始声明：color37、slider138、bool56、combo7、textinput3，另有group24、text30、未声明type32及scenetexture1。最终投影：

| 结果 | 数量 |
| --- | ---: |
| 可编辑slider / bool / color / combo / textinput | 126 / 52 / 34 / 5 / 2，共219 |
| P0未支持类型（含分组/说明项） | 80 |
| 带条件字段，先不计算/执行 | 21 |
| 不满足声明或值约束 | 7 |
| 非白名单/原型属性key，未投影 | 1 |

`author-declaration-inventory.json`记录原声明结构；`local-schema-evaluation.json`记录支持边界。最大项目233字段，初版128上限拒绝；据实际规模改为明确256上限，并补256通过/257拒绝的负例。首次受限评估失败和最终通过日志均保留。没有截断字段后悄悄当完整schema。

[官方属性文档](https://docs.wallpaperengine.io/en/web/customization/properties.html)将用户属性区分为bool、slider、color、combo、textinput等；[翻译文档](https://docs.wallpaperengine.io/en/web/customization/localization.html)给出general.properties与相邻localization。本阶段只支持其中有限声明，不推定项目值就是WE当前用户值。[显示条件文档](https://docs.wallpaperengine.io/en/web/customization/displaycondition.html)允许JavaScript兼容条件，P0将其明确标为未支持，不eval、不在DSH执行作者表达式。

## 实现范围

- `catalog.js`：共用一次受限项目读及原有入口验证的内部结果；旧verifyCatalogEntry仍只返回原路径descriptor，不增加metadata泄漏。新增Host私有readCatalogAuthorMetadata，只投影参数/翻译，拒绝类型/分级变化，支持取消。
- `library.js`：新增按ID的getAuthorMetadata。先用快照拒绝隐藏分级/未支持类型，再作真实文件与最新分级复核；根只能来自Host配置，调用者不能覆盖。Lucy别名也必须在批准目录快照中找到同一项目，不绕过根或分级。
- `author-properties-schema.js`：生成无路径schema，支持参数、作者默认值及指纹。区分empty/unsupported/ready；unknown/file/directory/texture等不输出原值。标签/翻译限长纯文本，不作为HTML；不返回作者脚本、条件原文、文件路径或用户当前WE值。
- `author-properties-contract.js`：浏览器共享的类型/值校验、修改增量、计划参数及表单状态。切换ID/请求ticket/本地编辑序列防止迟到A覆盖B；新后台读取保留未确认修改，成功确认清除已提交增量，明确reset后清草稿。与Node无关的3模块导入闭包已检查。
- `author-properties-host.js`：显式认证controller钩子、只读schema/内存草稿/计划路由。选中ID、分级策略、owner、controller修订及活动生命周期都由Host钩子提供，前端不能提交路径/策略/schema/目标窗口。生产index.js未导入/注册此模块；P1另接现有主端/独立窗认证与controller。

### P0路由契约（仅测试注册）

| 路由 | 行为 |
| --- | --- |
| GET `/whale-author-properties/schema?wallpaperId=...` | 重验并返回schema与草稿；只允许当前已选ID |
| POST `/whale-author-properties/draft` | ID、schemaFingerprint、expectedRevision、values增量；或明确reset草稿到作者默认 |
| POST `/whale-author-properties/plan` | 同样的身份/版本及当前活动窗口约束，仅生成参数数组，始终executed=false |

无apply路由。草稿只在当前Host内存，按认证owner+壁纸ID分开，上限32条，满时拒绝而不丢未保存值；不持久化，不代表WE实际值。首读defaultsOnly=true/currentValuesKnown=false，schema漂移保留旧草稿并标stale，需显式reset，损坏项目/非法值不覆盖已有草稿。两个Tab同修订并发只有一次成功。

字段上限256、选项64、标签160字符、文本256字符、数值绝对值上限1e6、请求32KiB。禁止原型key、控制字符、RAW分隔符及文件路径型输入；slider检查范围/步长/整数，combo严格匹配声明选项，color仅RGB归一化字符串。损坏字段明确不支持，项目总体超限拒绝。

本阶段的[CLI计划](https://help.wallpaperengine.io/en/functionality/cli.html)仅是数据：`applyProperties`的properties用JSON封装，必须包含Host当前活动ID、代次及同轮location，不提供EXE或shell字符串。仅计划明确编辑的增量，默认草稿不能生成控制计划，reset除外；不省略location影响全桌面。不含任何spawn/exec或原WE配置写入。退出码、真实作者监听器是否应用及Unicode传参仍待后续真实链路验证。

## 验证、发现与保护

最初30项作者检查通过，但独立加的3个负例发现计划和表单请求带入未修改默认值。保留30通过/3失败的红例后，改成Host dirty增量及客户端pending patch：编辑一项不把其它作者默认值下发；未改草稿拒绝计划。之后补清理owner时取消迟到读取、后台读保留未存草稿、明确reset、256字段上限与隐藏分级前置拒绝等检查。不是凭首轮通过认定完成。

| 最终检查 | 结果 |
| --- | --- |
| 作者P0共39项+历史246项 | **285/285**，mainVerified，16.600秒，PID2200，exit0已确认，无超时 |
| 主/从销毁回归 | **24/24**，7.163秒，PID17724，exit0已确认，无超时 |
| 新/改产品及QA语法 | 6文件通过 |
| 共享契约浏览器导入闭包 | 3模块，无Node导入 |
| 实际loopback HTTP | 认证拒绝、schema、草稿与有界关闭通过；并非DSH或Edge窗口 |
| 文件/生命周期负例 | 损坏/过大/缺失/类型/路径/链接/分级、策略收紧、切换/停止/owner变化、并发/迟到/取消、未知关闭锁均覆盖 |
| 有界失败 | body与schema默认各1.5秒，最多2个未落定metadata读取；超时IO占槽到落定，迟到不写草稿，dispose取消；测试覆盖挂起body、超时、迟到、释放 |

主QA内部30秒、外层40秒中止/45秒最终落定，owned PID退出有证据；元数据评估20秒、语法每项3秒。底层文件与Host路由是真实实现，worker/窗口/WE均未启动，controller身份/生命周期与HTTP认证为明确测试钩子。不可把替身认证等同正式SDK/会话认证已接入。

前后指纹核对后提升2项既有文件（catalog/library）和4项新增模块/QA；`promotion-before`及`promotion.json`留证。222项保护输入中仅两项明确变化，其余220项保持；实际日常rc.42的37项仍匹配固定包。既有web/类型补修等脏改动保持，manifest/生产assets/旧归档不动。没读写日常活动Local Storage、没操作DSH/WE、没发模型请求、没提交推送或清理历史数据。

下一步按[P1接入任务](WALLPAPER_AUTHOR_SETTINGS_P1_INTEGRATION_TASK_20261021.md)接正式认证controller及共享控件，先离线证明，再决定可见变化短验；P0并非完整作者设置产品已上线。
