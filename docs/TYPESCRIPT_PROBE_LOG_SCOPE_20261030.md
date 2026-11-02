# D2 第二项范围：原生日志解析与有界日志簿

后续更新：[隔离类型补修](TYPESCRIPT_PROBE_LOG_ISOLATED_20261030.md)已通过，尚未写开发源。以下为范围选择时的审计快照。

本轮按[首项交接](TYPESCRIPT_FRAME_PROTOCOL_CHECKJS_20261030.md)先做只读选择，确定下一项为 `dsh-whale-mist/src/wallpaper/probe-log.js`。**本轮没有给第二个模块加类型、修改运行源码或重做实机。** 日常rc.57、第一项FrameDecoder标注及其检查保持。

## 选择依据

选中模块106行、0 imports，SHA256 `3E49A454180A249AA7C49912C428E524385C8A7C2A532E825147C25819F99C82`，与固定rc.57载荷逐字节相同。它直接提供 `parseLogLine`、`describeLog`、`ProbeJournal`，真实Host的session会将stderr字节块传入journal，按error级别决定失败／停止，并把snapshot写入诊断状态。这里补类型能约束实际输入与结果消费，无需Node、DOM或宿主SDK类型。

排除本轮其它候选：

- FrameHub只有40行，但共享版不同于rc.57、含未发行Trace，还依赖Node EventEmitter；不为了第二项拉入Trace或Node类型。
- 作者参数契约虽为纯JS，但依赖detachable-contract和managed-window；后者包含helper接口，首轮会牵出多个模块。
- close-fence有Node crypto与停止／准入状态机，范围更大。
- managed-window虽无imports，但并非全文件纯函数，包含spawn接口、计时器和流事件；不因0 imports就当作没有IO契约。

共享session也与固定rc.57不同，保持只读消费审计，不纳入第二项类型程序或执行。这里不是恢复作者故障、关闭恢复或采集专项。

## 已执行的只读核验

工具 `dsh-whale-mist/qa/typescript-probe-log-scope/audit.py`／`audit.mjs`，证据 `.tmp/typescript-probe-log-scope-20261030-a/`。

复用已固定TypeScript5.9.3，先核对归档SRI、归档成员及解压文件；严格allowJs／checkJs／noEmit／types:[]程序只纳入真实日志模块及57个ES2022标准库。没有导入／执行应用模块，没有编译器输出。

真实未标注基线有7处诊断：4个参数隐式any（describeLog的entry、parseLogLine的line、push的chunk、failureText的entry），2个成员隐式类型（entries、firstError），以及解析记录类型缺少后续追加的at字段。详细文件／行号／错误码在 `scope-types.json`。这是类型契约缺口，不证明有7处运行bug，更不证明长时滑块问题已定位。

现有 `qa/wallpaper-preview/tests/log-journal.test.mjs` 的前8项纯用例已冻结并重新绑定到**实际生产源码**执行，全部通过：Desktop信息、Capture恢复警告、结构化分块、未知级别降为info、坏输入／有界记录、普通JSON信息、首个error保留、尾行finish。原测试虽然导入历史QA副本，但该副本当前也与生产字节相同；本轮仍显式重绑，避免拿副本结果冒充真实实现。

最后一项会spawn原生helper，整个capture-journal文件还会打开WE窗口，均没有运行。只执行两阶段，均退出0、确认退出、无超时；各阶段12秒、总30秒截止，Node测试单进程／单项3秒，没有后台无限等待。

## 下一步隔离实现契约

继续JS入口，只补必要JSDoc，先在固定字节隔离副本验证，确认类型和运行边界后才接实际开发源码。范围限定为这一个模块和从它导入的实际类型消费者，不改session、FrameHub或作者契约。

1. 日志条目：level为现有info／warn／error，scope／message／detail为字符串；parse结果为条目或null。`parseLogLine`尚未追加at，不能把所有解析结果都假装已有时间戳；journal追加后的记录再标明可用性。
2. journal：entries为条目数组，firstError为string|null；snapshot包含count／errors、firstError／last可空文本及messages字符串数组。不能把初始null直接固定成只准null，也不能用any[]绕过记录类型。
3. 输入：日志行保留现有String转换边界；chunk应覆盖string和实际UTF-8 Buffer结构接口。用结构化 `toString('utf8'):string` 表达，不引入Node.Buffer声明或手写一个假的Node模块。数值limit只约束类型，不新增运行范围校验或改变默认值。
4. JSON.parse不能因为返回any就被当成已验证日志对象。按现有null／object／array／message／level验证保持unknown边界；若确需局部类型断言，只能位于原运行校验之后并说明证明依据。不得先把所有JSON强断言成合法信封、用宽泛any或ts-ignore压错。
5. 如JSDoc断言需要增加无副作用分组括号，必须对实际JS语法树做归一化比较，保留运算／控制流结构；不能随便删所有括号再按字符串比较。其余运行语句、返回值、报错文字、截断上限和firstError语义保持；功能问题另列，不顺手补。
6. 正例必须导入实际实现，验证字符串／UTF-8块、null收窄、日志字段和snapshot。负例须拒绝错误chunk接口、未收窄null结果、字段类型错误等真实消费错误，检查预期文件及错误码，不用脱离实现的同名d.ts自测。
7. 重放以上8个现有纯用例，并按需要补空白行／坏JSON／未知level／分块／尾行／容量与长度边界。不得为“跑全套”触发原生helper或WE；不能把类型通过当成采集或长时验收。

历史源码注释称parse“Never throws”，其运行代码仍直接做String转换；不要为这次类型接入扩写catch或承诺任意带抛错toString的对象也不会抛错。保持当前运行行为，必要时把描述边界写清楚。

## 保护与接续

第一项369保护输入全部保持，本轮新增2个审计工具，`protected-after.json`记录371项接续基线，旧快照不覆盖。没有修改源码、生成client、改assets／版本／正式依赖、安装、Profile操作、窗口／进程采样、发布、推送、派发或清理。

下一小步仅按以上契约做隔离类型补修与实际消费正负例。日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2和公开rc.53保持；作者长时调查、进一步任务栏优化、UI大改、三体不继续。
