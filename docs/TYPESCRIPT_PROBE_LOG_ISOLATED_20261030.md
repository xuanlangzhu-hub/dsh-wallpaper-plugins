# ProbeJournal 隔离类型补修通过

承接[第二项范围审计](TYPESCRIPT_PROBE_LOG_SCOPE_20261030.md)，本轮完成固定日志模块的隔离JSDoc补修、真实消费正负例与行为等价验证。**尚未写入开发源 `src/wallpaper/probe-log.js`**，不是第二项已经全面接入的声明。日常rc.57及第一项FrameDecoder保持，不操作DSH／WE／Profile。

最终证据 `.tmp/typescript-probe-log-20261030-d/`，工具 `dsh-whale-mist/qa/typescript-probe-log/`。

| 输入 | SHA256 |
|---|---|
| 原开发源／固定rc.57日志模块 | `3E49A454180A249AA7C49912C428E524385C8A7C2A532E825147C25819F99C82` |
| 隔离类型候选 | `6AF15D1A87D6B737617ACAAA1565EBEFBA82FA0E65CFBB1D4B9D9135623D09A1` |

## 类型边界

- `ProbeLogEntry`包含既有日志级别、scope／message／detail字符串，at可缺省；parse结果仍可为null。
- `JournalLogEntry`是在日志簿中具有number时间戳的记录；entries、push及finish的结果按此区分，不能把刚解析的条目直接当带时间戳记录。
- firstError、snapshot.firstError／last保持string|null，messages为string数组；展示函数允许仅有message、scope／detail可缺省的既有结构。
- chunk使用string或结构化 `toString('utf8'):string` 接口，覆盖真实Buffer的消费方式，不引入Node.Buffer／SDK声明，不声称结构相容的其它对象会被额外拒绝。
- JSON值声明覆盖全部合法JSON种类，内部对象字段和数组元素为unknown；仍执行原有null、object、array、message及level检查。不是先断言合法日志信封。

只有三处局部断言：固定level列表命中后的枚举值，以及原 `entry.at=Date.now()` 后分别将记录加入entries／added时的必有时间戳。它们仅在原运行证明已成立的位置使用，不新增运行转换／校验、不用any、ts-ignore、ts-nocheck或同名声明替身。

## 验证结果

固定TypeScript5.9.3，重验首项锁定的SRI归档、全部归档成员及本地编译器文件。严格allowJs／checkJs／noEmit／types:[]只检查隔离候选和真正从它导入的消费文件，标准库为ES2022，无DOM、Node或宿主SDK类型。

1. 原基线7处类型诊断得到实际检查；补修候选和正例零错误。正例验证字符串与UTF-8块、可空parse结果收窄、level／消息字段、journal必有at、展示字段和snapshot。
2. 9个负例在预期文件、单个预期错误码上被拒绝：数字chunk、错误编码方法、错误转换返回值、直接使用可空parse结果、错误message类型、把解析条目当必有at、非法level、忽略firstError的null、将缺时间戳条目塞进journal。
3. 原8个纯日志用例重绑候选通过，最后的原生helper用例与整个实机capture测试不运行。
4. 新增8项基线／候选对照通过：日志分类／未知级别与字段长度、真实Buffer各字节拆点、容量／pending尾部／首个错误、既有String转换与非法chunk异常传播。共16项纯运行回归，没有启动原生程序。
5. JSDoc和三处断言分组括号之外，归一化的运行语法树完全相同。比较保留操作符和控制流结构；3个故意改动（errorCount++变--、空文本判断反转、默认level变error）均被识别。没有随便移除所有括号后比较字符串。
6. CLI实际noEmit，核对前后文件集合：编译器输出0，无JS／声明／map／tsbuildinfo产物；既有工作区371保护输入全部保持。

5个最终阶段全部退出0、确认退出无超时；单阶段20秒、总65秒，Node测试单进程／单项3秒截止。没有依赖安装、client生成、原生构建、应用／Profile查询或窗口采样。

## 失败与修正留档

a轮中，把属性JSDoc放在同一行中间未被编译器绑定，仍报entries与firstError的2处类型错误；只将注释与既有赋值换行排列，语法树保持，未加运行字段初始化。b轮候选已编译通过，但错误编码方法的负例实际报2322，原预期写2345；检查实际诊断及文件后修正具体预期，不改候选或放宽到任意错误码。c通过，d再补一个缺时间戳入journal负例及说明；c／d候选同字节，a–d均保留。

## 下一步接开发源

后续只应用这个已验证候选的JSDoc与必要分组括号，先核对实际源仍为上述原指纹，再用**真实开发路径**执行正负例和日志回归，确认运行语法树相同。无需用户另做主观验收或安装，连接本身属于既定开发范围；“确认后接入”指这些源码与检查证据的核对，不是新增用户审批流程。

原工作区371项保护输入不变，新增6个补修／QA文件后，本轮 `protected-after.json` 记录377项接续基线。旧保护快照保留，不修改已完成的FrameDecoder工具或绕过历史门禁。后续实际源注释修改须单列批准差异并沿用新的审定基线。

不改变日志分类、错误文本、firstError语义、上限或任意对象String转换的既有异常；不顺手修功能。作者长时问题仍收尾观察，任务栏进一步优化、UI大改、三体与发布／推送／清理不在本轮。
