# FrameHub 的 Node／Trace 类型范围审计

承接[生成段检查](TYPESCRIPT_GENERATED_DECODER_CHECK_20261030.md)，本轮只读源码、离线包清单和测试文件，不导入或执行FrameHub／Session／Trace／transport测试，不安装或下载Node声明，不修改运行源码和既有统一入口。

证据 `.tmp/typescript-frame-hub-scope-20261030-a/`；新增 `qa/typescript-frame-hub-scope/audit.py`／`audit.mjs`。

## 两份实现不能混用

- 共享开发FrameHub：141行，包含可选Trace及stream连接接口。
- 仓库固定rc.53文本：**40行**，SHA256 `93386920898555DE5362176E505E107E7651A3895B510FBDF1BCB0A5B113ECE4`；与rc.57包清单记录相同。旧QA的frame-hub文本也与它一致。此前口头按41行估计，以本轮AST统计为准。
- 两版imports都是node:events和frame-protocol。push／close／snapshot三个方法的运行token相同；constructor和streamFrames不同。不能用旧QA副本通过证明共享Trace实现，也不能通过整文件替换将Trace带入发行包或删除Trace来通过类型检查。

本轮只对照离线清单和固定文本，没有重验日常安装。共享／固定／测试／清单及真实消费端的完整指纹在result.json的inspectedHashes留存。

## 真实环境与接口需求

| 边界 | 实际使用 | 后续类型范围 |
|---|---|---|
| Node事件 | EventEmitter继承，frame／end通知，on／off解绑 | 真实Node声明；不手写假的node:events |
| 字节 | Buffer.from(frame.packet)，packet／jpeg是Buffer视图；push仍委托Uint8Array解码器 | 真实Buffer声明和可空latest记录，不改复制／保留策略 |
| 响应 | writeHead、flushHeaders、write、end、on／off；write布尔返回决定背压 | 来自真实HTTP／事件类型的准确方法集合，保留drain／close／解绑 |
| 时钟 | Date.now及Trace启用时的performance.now | Node环境声明，不借DOM库掩盖缺失环境 |
| Host Trace | enabled、record；6处记录形状，5个event名 | 从实际调用建立本项目结构接口，不导入整个Trace实现 |
| 连接记录 | 可选clientTrace.registerConnection及options.registerConnection | 可选回调／返回值被忽略，不新增持久字段 |

Node官方HTTP文档明确write的布尔返回与drain相关，类型不能用“总成功”替身抹掉这一边界。[Node 24 HTTP响应文档](https://nodejs.org/docs/latest-v24.x/api/http.html#responsewritechunk-encoding-callback)

constructor实际只读取options.cadenceTrace／runId；stream读取cadenceTrace／clientTrace／runId／connId／registerConnection。Session构造时虽然传clientTrace，构造器并未保存；stream中有hub.clientTrace回退，但真实路由显式传session.cadenceTrace.client。这里仅记录接口差异，不据此宣称运行bug，也不为类型完整度增加this.clientTrace赋值。Session稍后会给hub.runId赋location，不能标成只读常量。

6处Trace记录分别为hub-received、两种stream-skip、stream-write、stream-write-error、stream-drain；逐条字段键和行号在frame-hub-scope.json。既有record调用、时钟域、背压、跳帧及错误路径都属于受保护运行行为。

## 受限类型基线与测试范围

固定TS5.9.3，strict／checkJs／noEmit／types:[]，只纳入实际FrameHub、已标注FrameDecoder及57个ES2022标准库。没有Node声明，因此本轮是**环境边界诊断，不是完整Node类型检查**：

- 23条诊断：2307×1（node:events）、2591×1（Buffer）、2304×4（performance）、2339×11（属性及继承链等）、7006×3（参数）、7053×3（动态Trace响应头）。
- 其中环境缺失会影响其它推断，不能把这些都当成运行错误，不能据数量认定补入Node类型后还剩固定几项；有效Node环境建立后须重新测基线。
- 没有fake.d.ts、skipLibCheck绕过或模块执行，编译器输出0，无声明／map／tsbuildinfo。

旧transport文件有5项测试，其中1项spawn原生C#程序，最后2项是背压保留最新帧、EOF／解绑的Hub纯用例。本轮仅AST核测试名，**0项运行测试执行**。后续应提取并重绑真实目标，不能执行整文件后说只是纯测试。

QA Node本轮实际为v24.18.0，只有它得到版本确认；宿主Node／Electron版本仍未知，未查询日常进程或安装。两阶段退出0、确认退出、无超时，阶段5／12秒、运行总30秒；“审计通过”不代表FrameHub类型零错。既有35负例／56回归未改，以指纹承接，不重跑。

## 真实声明来源与下一步

TypeScript的types配置控制全局声明范围，但不阻止代码显式导入带类型的模块；因此不能只写types:[]就宣称不存在额外声明，仍要核实际程序文件图。[TS配置说明](https://www.typescriptlang.org/tsconfig/types.html)

Node声明从DefinitelyTyped的实际@types/node包获取，并按选定版本元数据锁定依赖闭包；当前仓库主分支已是26系列且依赖undici-types，不能直接选master／latest或把其依赖版本套给24系列。[声明包上游元数据](https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/node/package.json)

下一小步仅为**Node 24离线开发目标**准备独立声明缓存：先查24系列精确版本／实际依赖，固定官方registry元数据、SRI与完整文件清单，父监督限时获取到全新.tmp；不运行npm install／hooks，不改package、node_modules、系统或日常环境。宿主版本未知只限制兼容性结论，不要求为了准备声明去运行或采样DSH。当前本轮未做下载／安装，也未选择精确包版本。

随后先用真实声明重新扫描共享FrameHub的只读类型基线，再定隔离JSDoc范围。原ES-only三模块及生成段检查保持独立，不混入Node／DOM／SDK声明；不改Trace、Session或发行载荷，不通过伪声明／新运行初始化掩盖接口差异。

原398项保护输入全部保持，新增2审计工具形成400项接续清单，见最终目录protected-after.json／baseline-transition.json。日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，无日常查询／Profile／窗口操作、打包安装、发布／推送／派发／清理。作者调查、进一步任务栏优化、UI大改、三体／GPU／性能仍暂缓。
