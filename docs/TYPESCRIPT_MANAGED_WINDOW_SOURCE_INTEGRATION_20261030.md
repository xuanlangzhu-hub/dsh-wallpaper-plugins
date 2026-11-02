# managed-window 实际开发源码接入

2026-10-30。本轮把已审隔离注释接入实际源码，并将消费正负例、原字节／新源码运行对照绑定到真实路径。没有更改校验、超时、轮询或helper清理策略，不是运行故障修复或性能优化。

## 实际源码与基线

`dsh-whale-mist/src/wallpaper/managed-window.js` 保持原CRLF，实际SHA256：

```text
EAE70E89B991A02F99D45F930BF7CE82FC653FD56BC15F4377E577DE653A8D27
```

原字节SHA256为 `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86`，另存到仓库 `dsh-whale-mist/qa/typescript-managed-window/baseline/managed-window.js`。

实际源经换行归一化后，等同上一轮已审LF候选 `E5A2BE2D64746486EDB02972E9C3FA833EA3E298970835B470F0F5C585FBD500` 及annotate.py配方；只加JSDoc和既有判断的局部类型视图／分组。运行AST、可选链语义及3项关键逻辑变异门禁通过。

保持unknown校验入口、泛型fallback、Promise<unknown>原始JSON及未验证窗口字段。FindWindows仍是注入者应满足的数组／记录契约，不等于runHelper已验证JSON，Session消费端没有因本轮而获得完整类型覆盖。

## 实际路径验证

新增 `qa/typescript-managed-window/check-source.py` 和 `SOURCE_CHECK.md`。入口从仓库基线重建审定文本，不依赖历史实验目录；正例／16项负例直接导入真实开发路径，运行对照也导入实际模块。所有新夹具只写独立输出，检查器不写源码。

证据：`.tmp/typescript-managed-window-source-20261030-a/`。

- 同轮核验原21条类型诊断，实际源正例零错；16项负例逐文件、逐具体错误码拒绝。
- 原字节／实际源码共21项纯运行对照通过，覆盖标识／路径／fallback／别名、JSON、helper事件、超时／迟到结果、轮询阶段与歧义。进程／流是底层事件IO替身，不启动真实helper或窗口，不证明真实原生退出或宿主兼容。
- 固定TS5.9.3＋真实Node24／undici归档与声明，126个缓存文件前后核验。图仅实际模块／QA消费端及59标准库／66Node／41undici，skipLibCheck:false，无DOM／SDK／伪声明。
- 9阶段全部退出0、确认退出，无超时和清理错误；最慢约4.25秒，阶段耗时合计约20.32秒。原20秒／总75秒及运行单项3秒期限保持，编译器输出0。

## 既有检查保持可用

实际源变化需要新的保护基线，不能让既有命令永久停在旧指纹拒绝状态。新增v5审定清单，仅更新ES-only、Node Hub、统一编排器的清单选择、收据计数和相关说明；编译配置、模块集合、负例和运行规则不扩围。编排器自身现已在v5内，逐项与审定哈希比对，不以当前文件哈希覆盖已审记录。

`.tmp/typescript-all-v5-boundaries-20261030-a/`：原8项编排边界检查通过，只有合成收据中的基线计数同步。

`.tmp/typescript-all-after-managed-source-20261030-a/`：完整原单命令约44.96秒通过。

| 子入口 | 类型负例／纯运行 | 阶段 | 环境 |
| --- | --- | --- | --- |
| ES-only三模块＋生成段 | 35／56 | 18 | 57个ES2022标准库，types:[] |
| Node Hub | 14／17 | 8 | 59标准库＋66Node＋41undici |

全部26阶段退出0、确认退出、无超时，编译器输出0；最慢ES阶段约3.05秒、Node阶段约4.74秒。全局160秒和原入口80／75秒监督保持。两个环境仍分离，新增managed-window由上面的独立真实源入口验证，尚未编入此命令的编译图。

第五个实际开发模块的类型接入到此完成；不把重叠协议依赖或生成单元重复算作新生产模块，不称全仓TS迁移、Session／SDK覆盖或性能提升。

## 保护、历史与下一步

备份／双边差异在 `.tmp/typescript-managed-window-source-application-20261030-a/`。原430个输入中421个保持，批准变化9项：实际managed-window、ES入口与说明、Hub真实源入口与说明、编排入口／计数自测／说明、managed-window历史入口说明。新增仓库原字节基线、真实源检查器和说明3项，v5固定433项；另外保护v5文件自身，最终434项。

旧379／393／397／417清单及所有失败轮次保持。历史隔离run.py仍保留原源指纹及旧快照门禁，README明确导向新的真实源入口，不改门禁来伪造历史重跑成功。实际源检查和原单命令本轮均一次通过。

下一小步只把现有managed-window真实源入口纳入统一命令的Node部分，继续保留独立环境图／收据。编排器通过runpy同进程调用入口，Hub与managed-window都有名为annotate.py的配方：纳入前必须按文件身份加载并避免sys.modules同名缓存串用，补相关边界验证；不能仅追加调用路径。不要扩Session／SDK、运行行为或日常安装。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，DSHrc.5暂不更新。本轮没有日常进程／窗口／Profile查询或操作，没有打包、安装、发布、提交推送、派发或清理。作者长期滑动调查、进一步任务栏优化、UI大改、三体／GPU／性能仍暂缓。
