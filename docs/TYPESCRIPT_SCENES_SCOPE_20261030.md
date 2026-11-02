# 第三个类型检查模块：场景与播放请求规则

承接[两模块统一入口](TYPESCRIPT_UNIFIED_DEVELOPMENT_CHECK_20261030.md)，本轮只读选定 `dsh-whale-mist/src/wallpaper/scenes.js`。**未补类型、未修改运行源码，也未将它加入已通过的两模块联合编译。**

证据 `.tmp/typescript-scenes-scope-20261030-a/`，审计工具 `qa/typescript-scenes-scope/audit.py`／`audit.mjs`，复用统一入口的编译器校验、保护检查与有界执行器。

## 为什么选它

| 候选 | 静态结果 | 本轮决定 |
|---|---|---|
| scenes.js | 116行，0imports，12个导出声明，纯规则与注入回调 | 选定 |
| detachable-contract.js | 1428行、0imports，但有crypto、fetch、AbortController及通信／生命周期实现，且不同于固定rc.53 | 不因零导入就当作小型纯数据模块 |
| author-properties-contract.js | 88行，导入detachable-contract与managed-window | 不扩入庞大契约及helper边界 |
| close-fence.js | 142行，导入node:crypto，并有异步停止／围栏状态 | 暂不扩Node类型与生命周期 |
| media-bridge-permissions.js | 45行，导入node:child_process并可执行权限检查 | 排除真实进程与ACL边界 |

`scenes.js`实际开发源与仓库固定rc.53文本同字节，SHA256：

`0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90`

真实调用已静态核对：session从此模块导入并再导出规则；start/create及选择预校验使用sceneSelection和resolveSceneRequest，注入已验证project、exists。library直接使用SCENES和isSceneId，id格式通过后仍需快照查询／文件重验。index经session使用describeScenes。没有运行这些消费模块；共享session含Trace，不纳入此次类型范围。

## 必须保留的运行边界

1. `isSceneId`调用String转换，因此能接受转换为合法目录id的对象或单元素数组；返回true不证明输入本身是string，也不证明此壁纸存在。不能标注为 `value is string`，不能顺手对齐detachable-contract里更严格的同名函数。
2. `sceneSelection`对缺省／null场景回退Lucy，但拒绝显式非字符串或非法id；mode仍为未经验证的原输入，后续request才验证。`resolveSceneRequest`自身对非字符串scene采用Lucy默认值，两层行为不同，不能为了类型整洁合并。
3. `resolveProject`注入函数拥有查找与拒绝权；返回值仍经原非空字符串检查，抛错不回退Lucy。浏览器提供project字段不应成为真实路径。这里只审纯函数，不替代Host文件验证。
4. 预览缺省180秒，整数夹在30–300；非整数／字符串／NaN等使用默认值。daily只接受seconds缺省或null，结果seconds为null；0、false、空字符串同样被拒绝。不能把Number.isInteger误当成TypeScript已自动完成unknown收窄。
5. 自定义scene字典及exists回调是现有注入接口；不能让类型只接受SCENES.lucy这个字面量。playbackVerified可缺省，列表按严格true转换；不改availability／名单／定时器语义。
6. 任意对象的String转换可能抛错，维持原异常传播；不在本轮新增catch、改变分类或限制。

## 当前类型基线及纯回归

固定TypeScript5.9.3，strict／checkJs／noEmit／types:[]；实际只纳入一个模块和57个ES2022标准库，无DOM、Node或SDK。诊断完整留在 `scope-types.json`：

- 7006×3：isSceneId、sceneSelection、resolveSceneRequest输入缺少声明。
- 2349×1：resolveProject默认null导致调用分支被推断为never。
- 7053×1：动态sceneId索引只能推断出Lucy字面量的默认字典。
- 2554×2：默认exists零参函数与实际传入project不一致。

7处是静态类型缺口，不是7个已证实运行故障。审计器拒绝意外外部源文件、DOM／Node类型或编译器输出，未引入伪造声明。

用AST按唯一测试名提取原session规则用例和library的id形状用例，仅重绑规则导入与纯exists上下文；不导入整个原测试文件，避免其Profile、路由及子进程生命周期。另6项刻画String转换／选择差异、缺省与mode、持续时间、resolver拒绝及路径来源、可注入字典／availability、转换异常。共8项纯用例通过，注入函数无文件或进程IO。

scope-baseline及pure-regressions两阶段退出0、确认退出、无超时或清理错误；阶段限12秒、运行总预算30秒，Node单进程／单项3秒。编译器输出0，无声明／map／tsbuildinfo。未执行session／library／helper／应用／真实文件检查。

## 下一步范围

只在隔离副本增加输入unknown、场景记录／可注入字典、存在性／项目解析回调、选择结果与校验后请求结果的JSDoc。保留未知字段到运行校验后的收窄，不用any、ignore、伪声明，不虚构id品牌或字符串类型谓词。若需要局部断言，必须对应既有运行证明，保持运行语法树／token等价。

补真实导出的消费正例与精确错误码负例，重点覆盖回调参数与返回值、动态字典、mode未知值和seconds可空；不把接受未知请求的入口负例错误地设计为拒绝一切非法输入。复用本轮8项纯规则回归，再对照原字节验证行为；通过后才接实际开发源，并明确更新联合入口审定基线。此处“通过后”是源码证据核对，不要求新增用户审批。

原385项保护输入全部保持，新增2审计工具后，387项接续清单与新增文件回执在最终目录 `protected-after.json`／`baseline-transition.json`。旧快照、两模块统一工具和运行源码未覆盖；本轮没有为未变化实现重跑已有28项联合回归。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2与公开rc.53保持，无日常查询／Profile／窗口操作、打包安装、发布／推送／派发／清理。作者长时根因仍未知且暂缓，进一步任务栏优化、UI大改、三体／GPU／性能不推进。
