# FrameHub 真实 Node 声明基线已测定

承接[独立Node缓存](TYPESCRIPT_NODE_ENVIRONMENT_CACHE_20261030.md)，本轮只读编译实际共享FrameHub及FrameDecoder，未补类型、未修改源码、未执行模块或transport测试。目标仍为QA Node24声明环境，不代表宿主Node／Electron版本已验证。

工具 `qa/typescript-frame-hub-baseline/audit.py`／`audit.mjs`；证据 `.tmp/typescript-frame-hub-baseline-20261030-a/`。

## 使用真实环境后的差异

固定TS5.9.3、@types/node24.10.0及实际undici-types7.16.0闭包。锁定SRI归档、全部120缓存文件及元数据／状态等126文件再次校验，编译器归档／文件前后核验。没有下载／安装依赖、创建node_modules或使用伪声明。

在同一轮、同一实际源码上分别测ES-only与Node环境，不从旧计数推算：

| 项目 | ES-only | Node真实声明 |
|---|---:|---:|
| FrameHub诊断 | 23 | 15 |
| TS标准库 | 57 | 59 |
| Node声明文件 | 0 | 66 |
| undici声明文件 | 0 | 41 |
| 非声明源 | Hub＋FrameDecoder | Hub＋FrameDecoder |

Node图共168文件；所有声明只能来自固定编译器或这两包缓存，无lib.dom／webworker／SDK。strict／checkJs／noEmit，skipLibCheck:false；依赖模块与上游声明本身没有诊断。程序只经编译器读取，不导入执行。

按文件、行列、错误码与完整消息比对，消失8条：node:events无法解析1、Buffer缺失1、performance缺失4，以及EventEmitter缺失导致的emit属性2。新增0条，其余15条逐条相同。这是类型环境得到纠正，不是修了8个运行bug。

## 剩余15条与传播结果

- 2339×9：构造／stream的options默认{}缺字段，以及catch错误值的message属性视图。
- 7006×3：push(bytes)、streamFrames(hub,res)的参数缺声明。
- 7053×3：三个可选Trace响应头的动态索引缺字典类型。

逐条源码行列和消息在node-baseline.json。仍有诊断，不称FrameHub已经类型通过；补参数类型后还可能暴露被any遮住的成员约束，不能把15当成最终补修量。

已标注FrameDecoder的类型确实传入了真实消费者：latest推导为具有number帧字段、Buffer<ArrayBuffer>的packet／jpeg以及null的联合；decoder为FrameDecoder，计数为number、closed为boolean，snapshot包含准确的number|null采集年龄。无需为latest另造一份宽泛帧结构。

当前cadenceTrace／runId、push输入仍泄漏any，这是未标注源的实测推断，不是本轮手写any。clientTrace在类上**没有声明成员**（输出members.clientTrace=null表示找不到符号，不表示该字段值为null）；stream当前hub参数为any，因此其可选回退尚未接受具体成员约束。后续不能通过新增this.clientTrace初始化改变运行行为。

## 下一步隔离补修范围

只在共享141行文件的隔离副本增加JSDoc及既有运行证明对应的必要局部类型视图：

1. push字节参数承接实际FrameDecoder的Uint8Array入口；保留现有推断出的latest／snapshot及Buffer行为。
2. 构造／stream选项声明runId／connId及可注入Trace和连接回调，按6处真实record形状约束。本项目结构接口可以描述Trace注入，不导入或修改整个Trace实现。
3. hub参数采用真实FrameHub及可选clientTrace扩展视图；真实Session传入但构造器不保存的选项需准确表达，不新增运行字段。保留options→hub→null回退顺序。
4. res使用来自真实Node HTTP／事件声明的最小方法视图，flushHeaders仍可缺省；保留write布尔背压、drain／close／end和解绑，不以假HTTP库或总成功替身通过。
5. Trace响应头声明为正确字符串字典；catch仅补可选message的unknown视图，保留String转换、原异常路径和时序，不新增catch或改错误处理。

随后用该真实Node闭包检查真正导入候选的消费正负例，确认实际调用形状能编译、错误字节／字段／响应／Trace接口按精确错误码拒绝。原2项Hub纯用例须从混合transport文件按AST提取并重绑；另覆盖Trace关闭／启用、最新帧背压、关闭／解绑及回调异常，原字节与候选运行语法树及行为对照。届时只运行有界离线纯用例，不运行原生C#测试、Session、完整Trace／服务或日常应用；检查通过后再接实际源，不整体提升固定发行文件。

旧ES-only三模块／生成单元的35负例／56回归保持独立，未修改或机械重跑。本轮仅一审计阶段退出0、确认退出、无超时或清理错误，编译器输出0，无声明／map／tsbuildinfo；应用／运行测试执行0。原405项输入保持，新增2QA形成407项接续清单，最终目录protected-after.json／baseline-transition.json留存。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，无日常进程／窗口／Profile查询、打包安装、发布／推送／派发／清理。作者调查、进一步任务栏优化、UI大改、三体／GPU／性能暂缓。
