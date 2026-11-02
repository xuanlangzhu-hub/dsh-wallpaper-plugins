# 两模块开发检查入口统一完成

承接[日志模块接入](TYPESCRIPT_PROBE_LOG_SOURCE_CHECKJS_20261030.md)，新增 `dsh-whale-mist/qa/typescript-check/` 六个文件，统一FrameDecoder和ProbeJournal的实际源码检查。本轮没有修改两个运行模块、既有QA、manifest、client或assets。

## 入口与来源

从仓库根运行：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-check/run.py --compiler-root .tmp/ts-compiler-1 --output .tmp/ts-check-1
```

缓存不存在时，先用原固定下载器 `qa/typescript-frame-protocol/prepare-compiler.py --output .tmp/ts-compiler-1` 准备；不安装项目／全局依赖，不运行hooks。执行检查时显式传缓存，每次用锁定SRI归档和SHA1重新验证全部编译器成员。编译器仍为TypeScript5.9.3。

- `common.py`共用保护输入／编译器校验、阶段执行、退出确认和失败日志。
- `run.py`负责两个实际模块与消费者、负例、原生成器隔离运行和纯回归。
- `cases.json`保存既有7＋9个负例的完整正文及具体错误码，不从历史输出读取。
- `protected-baseline.json`将上一轮明确审定的379项基线纳入仓库QA，包含已接入的两个模块和原QA，执行前后都检查。
- `selftest.py`检查执行器的成功、拒绝、超时及退出不明边界；`README.md`给出准备／执行步骤和限制。

复用仓库内原正例、验证器及运行回归；未标注基线取已保护的rc.53固定文本，分别与当初原基线哈希一致。协议对照改用仓库内固定rc.53client、开发client和隔离生成副本。新入口不再读取旧实验目录、旧result／inputs／冻结副本，不要求旧rc.57解包目录存在。静态核对新执行文件及manifest无历史轮次路径；这不等于已在缺少后续开发文件的公开rc.53干净检出上运行过。

## 验证结果

最终 `.tmp/typescript-unified-20261030-b/`：

- 联合strict／checkJs／noEmit只纳入两个真实模块、两个真正导入它们的正例和57个ES2022标准库；正例零错，无DOM／Node／SDK类型。
- 16负例在各自文件以指定单个错误码拒绝；保留FrameDecoder原2诊断、日志原7诊断基线，不靠替身声明通过。
- FrameDecoder运行token保持，日志运行语法树等价且3个逻辑变异被识别。
- 12项协议、8项日志基线对照、8项原纯日志回归通过，共28项；未执行原生helper或实机capture测试。
- 原生成器只运行在复制后的开发client上，两次生成幂等、协议块外原始字节保持；三个client协议块token一致。
- 11阶段全部退出0、确认退出、无超时或清理错误；每阶段最多20秒，运行阶段总预算80秒，Node单进程／单项3秒。编译器输出0，无声明／map／tsbuildinfo。

最终执行器自检 `.tmp/typescript-unified-selftest-20261030-b/`，8项通过。其中真实忙循环由父监督在250ms期限后终止并确认退出；非零退出7保留证据；过期总预算不启动子进程；保护漂移／路径越界／伪编译器归档被拒绝。退出不明分支采用底层进程IO替身，确认PID、部分输出及unknown证据保留并非零，不称真实系统退出验证。

a轮联合检查及7项自检已经通过。收尾审阅发现超时后若管道仍不能收尾，原执行器会抛错但缺少完整退出回执；补留档分支及第8个负例后另起b轮，两轮均保留。没有放宽期限、重试或接受未知退出。

## 保护与接续

原379项输入全部保持，新增6QA文件；385项后续保护清单在最终目录 `protected-after.json`，新增文件／基线承接说明在 `baseline-transition.json`。新QA自己的指纹和编译器文件也在执行前后复核，旧保护清单及历史入口不改。

| 实际开发源 | SHA256（本轮未变） |
|---|---|
| frame-protocol.js | `3FDDACB47E248CAD62AECFC822C2FF1DF1B7C1C4C5C605ABD733822C5CE2D5C7` |
| probe-log.js | `6AF15D1A87D6B737617ACAAA1565EBEFBA82FA0E65CFBB1D4B9D9135623D09A1` |

统一入口仍绑定审定开发基线，不自动接受未来脏改；未来有意更新先审差异，再明确更新基线。379项中含本机尚未提交的后续开发QA，所以这里交付的是文件齐全的当前工作区入口，尚非已发布／已推送或跨平台CI。

下一小步仅只读筛选第三个纯数据／契约模块，先核对真实消费、输入边界和类型依赖，再确定最小范围；不直接扩Node／SDK／Trace或大规模改.ts。日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，本轮无日常查询、窗口／Profile操作、安装打包、发布／推送／派发／清理。作者长时根因仍未知且暂缓，进一步任务栏优化、UI大改和三体不推进。
