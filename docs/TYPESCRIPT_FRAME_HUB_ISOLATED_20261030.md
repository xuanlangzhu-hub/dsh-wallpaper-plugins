# 共享 FrameHub 隔离类型补修通过

承接[真实Node基线](TYPESCRIPT_FRAME_HUB_NODE_BASELINE_20261030.md)，本轮只在共享141行Hub的隔离副本补JSDoc及catch值的可选message视图。**实际开发frame-hub.js未修改，尚未接入Node侧开发类型检查。** 未用固定发行40行副本替换共享Trace实现。

最终 `.tmp/typescript-frame-hub-20261030-c/`，工具 `qa/typescript-frame-hub/` 共7文件；a／b失败及各冻结输入保留。

| 输入 | SHA256 |
|---|---|
| 实际共享Hub／隔离基线（CRLF） | `6B3E697A5317EF81BBDC39599A111FA3D949526CA28198456EEC88AD8AB5DF57` |
| 已验隔离候选（LF） | `F2639D6727DD72A4FA9747903B94494089E3D4B0ABF0FAECE697F65E2FCA262B` |
| 实际FrameDecoder／两侧协议副本 | `3FDDACB47E248CAD62AECFC822C2FF1DF1B7C1C4C5C605ABD733822C5CE2D5C7` |

## 类型范围

Hub选项及stream选项描述实际runId／connId、Host Trace与连接回调。Trace记录按6处真实调用组成带event／reason的联合；允许完整可启停sink，也允许无record的disabled hook。未导入完整Trace实现，未改变任何记录内容或回退顺序。

push参数为Uint8Array，Buffer按真实Node声明兼容。latest／snapshot继续由实际解码器和Buffer推断，没有另造宽泛帧结构；runId保持可写。构造器仍不保存clientTrace，类型仅允许现有调用传入它；stream的hub参数采用FrameHub加可选clientTrace扩展视图，不新增运行字段。

响应方法来自真实Node ServerResponse，flushHeaders可缺省，write仍必须返回boolean。headers补string字典；catch只增加原值可选message的unknown视图及分组括号，没有新增转换、catch、条件或初始化。没有自写any、ignore、fake Node声明、DOM／SDK或运行逻辑改动。

## 类型与等价验证

TS5.9.3与Node24.10.0／undici7.16.0的固定SRI归档、完整成员及前后指纹均核验。strict／checkJs／noEmit、skipLibCheck:false；每个消费程序只纳入Hub／实际协议副本／真正导入它们的消费者，以及59个TS标准库、66个Node和41个undici声明。

- 原15条真实Node基线诊断得到实际核验；候选及正例零错。正例覆盖可空latest、Buffer／snapshot、真实ServerResponse最小方法视图、缺省flushHeaders、完整／关闭Trace、忽略构造clientTrace与可选扩展、连接回调及runId后续赋值。
- 14负例按各自文件与单个具体错误码拒绝：错误字节、Trace回调／事件／缺record／背压字段、runId、缺响应方法／write返回、连接回调／clientTrace、latest及采集年龄的null、帧宽／Buffer字节类型。2项2345、11项2322、1项18047；不只接受任意非零诊断。
- 运行语法树归一化相同，保留控制流、操作符和optional-chain标记；背压反转、关闭条件翻转、off改on的3个逻辑变异都被识别。只忽略JSDoc和分组节点，不放宽对象／分支比较。
- 原transport文件仅AST提取2个Hub纯用例及packet／Response依赖，原字节与候选各运行一次，共4项；没有导入原混合文件或运行C# helper。
- 新增两实现各6项Trace关闭／启用、最新帧背压／跳帧／重复序号、选项覆盖／连接回退、各种write错误、Trace异常传播和关闭／解绑／缺flush对照，再加1项排除时钟测量后的稳定IO轨迹比较，共17项纯运行测试通过。

HTTP响应是底层IO替身，Node事件／Buffer及两侧Hub／解码器执行实际代码；完整Trace／Session／真实HTTP服务器／DSH未执行，不把这些当成实机或性能验收。

## 有界执行及失败留档

a轮候选CLI已编译通过，但非布尔write返回值的负例实际定位2322，预期误写2345；核具体错误与文件后只修正预期，不改载荷或放宽到任意诊断。

b轮将全部真实Node声明与14负例集中重复编译，type-and-ast阶段触到20秒执行期限。父监督终止该直接子进程并确认退出，timedOut:true；不是通过，也未开始运行Hub纯测试。完整回执留存，没有等用户提醒或扩大期限。

c轮将验证器拆为基线／正例、5＋5＋4负例、AST／提取，各批汇总必须完整匹配全部14个名称和错误码。阶段执行期限仍20秒、总执行预算仍75秒，未改skipLibCheck或减少声明图；Node测试单进程／单项3秒。8阶段全部退出0、确认退出、无超时或清理错误；最长负例批约6.075秒。编译器输出0，无声明／map／tsbuildinfo。

a／b／c候选哈希完全相同，运行源始终未改。原407项保护输入保持，新增7QA后，414项接续清单与承接记录在最终目录protected-after.json／baseline-transition.json；旧快照、统一ES-only工具和声明缓存未覆盖。

## 下一步接实际开发源

先核实际Hub仍为上述原指纹，再保持原CRLF应用这份已审LF候选注释；另记实际字节哈希并以归一化文本核对。把Node检查的正负例及纯对照重新绑定真实开发路径，仍用受保护Node声明闭包和分批验证；不能把隔离通过直接当实际源通过。

接入属于既定类型开发范围，无需实机或新用户审批；Node侧检查继续独立于既有ES-only三模块／生成段，后者35负例／56回归保持，不能为通过旧基线删门禁或整体混入Node声明。共享Hub带Trace，不整体替换固定发行文件，不生成候选包。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，无日常进程／窗口／Profile查询、依赖安装、打包安装、发布／推送／派发／清理。宿主Node版本仍未验证；作者调查、进一步任务栏优化、UI大改、三体／GPU／性能暂缓。
