# 场景规则隔离类型补修完成

承接[第三项范围审计](TYPESCRIPT_SCENES_SCOPE_20261030.md)，本轮仅在固定字节副本补JSDoc和必要分组括号。**实际开发scenes.js未修改，尚未接入第三个模块的开发类型检查。** 两模块统一工具、日常rc.57及运行行为保持。

最终运行证据 `.tmp/typescript-scenes-20261030-b/`；工具与说明 `dsh-whale-mist/qa/typescript-scenes/`。

| 对象 | SHA256 |
|---|---|
| 实际开发源／原字节基线（CRLF） | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` |
| 已验隔离候选（LF） | `2A5F064924CBDA63A0549A48E16B6BECEBC615C5C0B8BA9D90FCD2522B4F124D` |

## 类型与信任边界

- 所有请求输入仍接收unknown，包括缺省参数；RequestFields只是既有object分支后的可选unknown字段视图，不代表scene／mode／seconds已验证，也不新增运行字段检查。
- isSceneId只返回boolean，不写字符串类型谓词；保留对象／数组的String转换。sceneSelection结果sceneId为string，而mode仍unknown；其行为没有被改成resolveSceneRequest的默认规则。
- 记录与字典允许自定义场景、可缺省playbackVerified；exists按实际Host接口声明string输入、boolean返回。默认SCENES仍是原冻结对象，没有扩展名单、改路径或改变availability。
- resolveProject可缺省／null或为接收string的函数，返回unknown，由原非空字符串检查负责校验。正例明确允许返回错误数字，以证明没有将运行边界伪装成已可信；运行回归确认错误值仍被拒绝。
- 已校验请求的mode为preview／daily，project为string，seconds为number|null。没有虚构目录id品牌、已有文件证明或“daily必有秒数”。

只有两个局部断言：原Number.isInteger成功分支中的number；原返回点全部检查完成的SceneRequest，用于模式成员关系收窄。后者保持原对象简写，断言之前保留场景／project／mode／duration全部运行验证。未使用any、ignore、伪声明、DOM／Node或宿主SDK。

## 检查结果

固定TypeScript5.9.3，重验锁定SRI归档、SHA1与全部解压成员；strict／checkJs／noEmit／types:[]只纳入隔离模块、真正从它导入的消费文件和57个ES2022标准库。没有导入Session／Library实现或执行应用。

1. 原基线7处具体诊断得到核验；候选及正例零错误，覆盖未知请求、可空秒数、选择层未验证mode、注入字典／回调和列表结果。
2. 12个负例都在各自文件以指定单个错误码拒绝：错误字符串收窄、未验证mode、忽略seconds的null、project类型、exists参数／返回、resolver参数／非函数、scene.project类型、冻结默认场景修改、非法已验证mode、availability类型。11项2322、1项2540；没有把接收unknown的入口误当成应在编译期拒绝所有非法外部数据。
3. 复用范围工具按AST重新抽取原纯用例与边界刻画，不加载原混合测试文件。8项原字节＋8项候选回归通过，共16项，包括选择默认／拒绝差异、preview边界／daily无时长、resolver权威与异常、动态字典和String转换。
4. 除JSDoc与分组括号外，归一化运行语法树相同，保留控制流、对象属性节点及操作符。预览分支翻转、上下限变异、null改0三种逻辑变异均被识别；没有扩大忽略范围。
5. extract-baseline-cases、tsc-noemit、type-and-ast、syntax、runtime-equivalence五阶段全部退出0、确认退出、无超时或清理错误。阶段最多20秒、总65秒，Node单进程／单项3秒；编译器输出0，无声明／map／tsbuildinfo。

这些是纯模块与类型消费证据，不是整个宿主编译、真实壁纸播放或性能验收。

## 失败与保护留档

a轮正例与12负例已经通过，但为给mode补声明将原对象简写改成显式属性，运行语法树比较因此拒绝。保留a轮输出，不放宽比较器；改为校验后返回对象的局部断言，保持原属性节点与控制流，另起b轮全组通过。b候选没有变更原返回对象字段或执行语义。

b运行冻结5个QA实现／消费文件。运行结束后仅新增README使用说明，未改执行输入，另留文档新增指纹，不为此重复测试。原387项保护输入全部保持；新增6个QA文件后，393项接续清单、基线承接与说明新增回执在最终目录 `protected-after.json`／`baseline-transition.json`／`documentation-addition.json`，旧清单和失败轮不覆盖。

## 下一步

先核对实际源仍为上述原指纹，再应用这份已审注释和分组括号；保持实际源CRLF，不能误以为候选也是CRLF而直接复制后声称行尾未变。应用后单独记录实际字节哈希，按文本归一化与此LF候选核对，并将消费正负例及纯回归重新导入真实开发路径。通过后明确更新三模块联合入口及其审定保护基线，不删除旧门禁强行通过。接入属于既定开发范围，无需额外实机或用户审批。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2和公开rc.53保持，本轮无日常进程／窗口／Profile查询、打包安装、发布／推送／派发／清理。作者长时调查、进一步任务栏优化、UI大改、三体／GPU／性能暂缓；根因未知不因本轮类型检查变成已解决。
