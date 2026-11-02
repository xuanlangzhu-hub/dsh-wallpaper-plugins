# ProbeJournal 实际开发源类型检查完成

承接[隔离补修](TYPESCRIPT_PROBE_LOG_ISOLATED_20261030.md)，本轮将已审候选接入实际开发源 `dsh-whale-mist/src/wallpaper/probe-log.js`，并把消费正负例与日志回归重新绑定到这个真实路径。没有将隔离副本的通过直接当成开发源通过。

## 修改范围

只增加已验证的JSDoc、属性注释换行，以及三处校验后局部类型断言所需的分组括号。保留ESM JavaScript入口，不改日志分类、错误文本、容量、时间戳赋值、异常传播或Session调用。JSON字段仍为unknown，经原运行校验后再收窄；不引入any、ignore、伪造声明或Node／宿主SDK类型。

| 对象 | SHA256 |
|---|---|
| 修改前日志源 | `3E49A454180A249AA7C49912C428E524385C8A7C2A532E825147C25819F99C82` |
| 实际开发源／已审隔离候选 | `6AF15D1A87D6B737617ACAAA1565EBEFBA82FA0E65CFBB1D4B9D9135623D09A1` |

实际源与候选逐字节一致，两者原本均为CRLF，保留行尾。应用前核对全部377项保护输入；前置脚本曾因误以为候选为LF而在写源前拒绝，核对原始字节后直接复制已审候选，没有转换成CRCRLF。应用回执和原源备份在 `.tmp/typescript-probe-log-source-application-20261030-a/`；既有隔离d轮证据未覆盖。

## 实际路径验证

最终证据 `.tmp/typescript-probe-log-source-20261030-a/`。新增检查入口：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-probe-log/check-source.py --output .tmp/probe-log-source-check-1
```

输出目录必须全新。检查器只读源码，复验固定TypeScript5.9.3归档SRI和解压成员，冻结验证器／消费者并重绑导入；基线保留修改前真实字节。

- strict／checkJs／noEmit正例零错误，只纳入实际日志模块、实际消费文件及57个ES2022标准库；不纳入DOM／Node／SDK／Trace。
- 基线7处类型诊断仍得到核验；9个负例在各自文件以指定单个错误码拒绝，覆盖错误chunk／编码／返回值、null、消息类型、时间戳、日志级别与journal条目约束。
- 原8项纯日志测试重新导入实际开发源通过；新增8项基线／实际源对照通过，包括UTF-8拆块、条目上限／尾部／首错与既有异常传播。原生helper及实机capture用例没有运行。
- 归一化运行语法树相同；3个故意改变操作符／条件／默认级别的变异均被识别。只忽略注释与分组节点，保留控制流与操作符。
- syntax、tsc-noemit、types-and-ast、existing-pure、runtime-equivalence五阶段均退出0、确认退出、无超时。单阶段20秒／总65秒，Node测试单进程／单项3秒；编译器输出0，无声明／map／tsbuildinfo。

原377项中376项保持，唯一有意变化是日志源；第一项FrameDecoder及既有6个日志QA文件保持。新增实际源检查器和说明2文件后，接续379项清单在最终目录 `protected-after.json`，批准差异在 `approved-source-change.json`，旧保护清单不覆盖。

## 接续边界

两个模块现在都已在实际开发源码路径接受类型检查，但仍是JSDoc配合TypeScript检查JavaScript，不是整个项目已经迁移为.ts，也没有运行性能提升证据。历史 `run.py` 固定旧保护基线，保留为当轮隔离配方，不能删门禁强迫它在新基线上通过。

下一小步先统一这两个模块的开发检查入口和公共执行工具，显式采用新的已审基线，再考虑第三个模块；不要继续堆叠依赖历史临时目录的独立脚本。当前检查依赖保留的隔离证据和本地编译器缓存，尚非干净检出即可执行的全仓CI。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2和公开rc.53保持。本轮没有日常进程／窗口／Profile查询、依赖安装、client生成、打包安装、发布／推送／派发／清理。作者长时根因仍未知且暂缓，进一步任务栏优化、UI大改和三体不推进。
