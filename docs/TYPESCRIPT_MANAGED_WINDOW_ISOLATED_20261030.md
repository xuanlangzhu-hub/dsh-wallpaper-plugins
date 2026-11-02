# managed-window 隔离类型补修通过

2026-10-30。承接只读范围报告，本轮在全新输出目录生成候选，补注释并完成真实类型／纯运行对照。实际开发源、原有联合检查图和日常安装未改。

## 已完成的类型边界

原模块SHA256：`6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86`。

隔离候选为LF，SHA256：`E5A2BE2D64746486EDB02972E9C3FA833EA3E298970835B470F0F5C585FBD500`。配方在 `dsh-whale-mist/qa/typescript-managed-window/annotate.py`，其余检查工具和用法见同目录README。

- 校验入口保持unknown。validateLocation／validateProjectFile返回string，保留原trim和运行拒绝；validateSize用泛型保留任意fallback的原类型，不错误承诺总返回number。
- runHelper使用真实Node ChildProcess最小成员接口和spawn参数契约，返回Promise<unknown>，不把JSON.parse结果声明成已经验证的窗口数组。
- FindWindows单列注入者应提供的数组／记录契约。正例显式检查原始JSON，负例拒绝直接将runHelper结果接入；这不代表真实Session已通过类型检查。
- normalizeWindow接受unknown，字段读取仍是unknown。返回只明确已有验证的hwnd、原typeof判断下的pid和处理后的startUtc；title／visible／left／top保留unknown。未新增pid有限数、布尔值或坐标验证。
- 局部视图表达原for-of字符必非空、Number.isInteger相关数值运算、object guard后字段读取；未加入运行变量、字段、分支或类型收紧用的运行校验。newLocation、超时／轮询参数及所有导出保持。

Node上游事件API仍使用其官方声明；未为应用添加any、ignore／nocheck或伪造声明。

## 最终验证

通过输出：`.tmp/typescript-managed-window-20261030-c/`。

固定TS5.9.3，真实Node24／undici声明缓存经归档SRI、身份／依赖与完整文件集合重验，126个缓存文件前后指纹保持。strict／checkJs／noEmit，skipLibCheck:false；每个程序只含被检查的原字节或候选、必要QA消费文件和59个TS标准库／66个Node／41个undici声明，无DOM／SDK。

原21条诊断（7006×18、18048×3）同轮得到核验；候选正例零错。16项负例分别绑定消费文件与具体错误码：2345×4、2322×9、2739×1、18046×1、18047×1。覆盖错误spawn接口／命令／参数、超时和轮询参数、错误finder／sleep回调、原始JSON未验证、未知窗口字段、可空窗口／pid以及泛型fallback。

运行AST和可选链语义等价；修改尺寸上界、唯一窗口判断、settled判断的3个逻辑变异均被拒绝。编译器输出0。

21项纯运行对照由原字节和候选各10项，加1项稳定轨迹比较组成，覆盖：

- 标识字符、长度与首尾trim；盘符／UNC／json／mp4及非法路径；尺寸边界、fallback身份、时间／随机参数。
- 窗口别名、空值、未知字段、pid NaN及原先接受的非安全整数句柄，不顺手强化行为。
- helper分块文本／Buffer、JSON对象／数组／原始值、非法JSON／空输出／非零退出／error／同步spawn异常、超时、kill抛错及迟到close／error。
- fast／grace／slow轮询顺序、失败回调／无结果、大小写字段原行为、歧义及无效匹配窗口、defaultSleep。

底层进程和流为事件IO替身；没有启动可执行helper、真实窗口、Session或DSH。测试超时10ms／延时25ms是夹具参数，不能当生产默认修改，也不能证明真实helper退出已确认。原runHelper超时语义保持。

共9阶段，全部退出0、确认退出、无超时和清理错误；阶段耗时之和约19.02秒，最慢约3.90秒。每阶段20秒／总75秒监督、单进程运行测试与单项3秒期限保持，不靠延长等待通过。

## 失败轮次保留

1. `.tmp/typescript-managed-window-20261030-a/`：正例已通过；缺失进程接口的负例实际为2739，初写预期2345导致停止。另用有界单程序收集16项具体诊断，记录在 `.tmp/typescript-managed-window-negative-codes-20261030-a/`；据原始诊断修正3项错误码预期，未放宽拒绝规则。
2. `.tmp/typescript-managed-window-20261030-b/`：全部类型和AST门禁通过；运行中原字节与候选都对同一“末尾空格应抛错”预期失败。原实现先trim，该预期错误；改为内部空格，保留首尾trim正例。此轮19项运行通过、2项失败，不记作整轮通过。
3. c完整重跑通过。a／b／c候选SHA完全相同；只改负例错误码及运行用例输入，没有改注释候选或实际源码。各失败进程均已确认退出，原日志留存。

## 保护和接续

原423项输入保持，新增7个隔离QA文件，430项接续清单见c/protected-after.json。旧ES-only／Node Hub图、统一编排入口、实际四个已补模块、缓存和旧证据未改，无需重复旧26阶段。

下一步核对源指纹并保持CRLF，将这份审定注释接入实际managed-window，另记实际哈希；仓库保留原字节基线，再把消费正负例和原字节／实际源运行对照绑定到真实路径。通过后另一步才扩Node检查入口，不能现在把第五模块算成实际接入完成，也不扩Session／SDK或更改生命周期行为。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，暂不升级DSHrc.5。本轮无日常进程／窗口／Profile查询或操作，无打包安装、发布、提交推送、派发或清理。作者长时间滑动调查、进一步任务栏优化、UI大改、三体／GPU／性能仍暂缓。
