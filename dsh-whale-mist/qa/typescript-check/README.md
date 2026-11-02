# 三模块开发类型检查

同时检查真实生成到client的WHL1解码器片段；它是生成代码单元，不是第四个生产模块。

从仓库根运行。需要Python、Node以及单独准备的固定TypeScript5.9.3缓存；不使用npm依赖安装、hooks或全局tsc。

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-frame-protocol/prepare-compiler.py --output .tmp/ts-compiler-1
python -X utf8 dsh-whale-mist/qa/typescript-check/run.py --compiler-root .tmp/ts-compiler-1 --output .tmp/ts-check-1
```

编译器已准备好时直接执行第二行。编译器路径显式传入，每次由锁定SRI归档重验全部解压文件，不信任自报版本或收据。下载准备器只访问锁定官方npm元数据／归档；它有45秒父监督，不执行包脚本。运行检查本身离线。缓存和检查输出均应为全新目录；不会清理旧目录或自动重试。

`run.py`统一检查实际开发frame-protocol.js、probe-log.js和scenes.js：三个真正导入模块的正例、7＋9＋12个精确错误码负例、12＋8＋8＋16个纯运行回归。严格checkJs／strict／noEmit／types:[]；联合编译只纳入这三个模块、三个消费者和57个ES2022标准库。复用已有验证器及回归文件，保留各原始基线诊断、协议运行token／日志及场景规则语法树检查，两组语法树比较各有3项逻辑变异。

未标注基线直接取仓库内已保护的rc.53文本（与原审定基线同字节），不读取任何历史`.tmp`轮次。原生成器只操作复制后的开发client；重复生成幂等，协议块外按字节保持，并比较开发client／固定rc.53client／生成副本的协议token。不会写开发client或生产assets；没有执行宿主SDK、native helper、采集或日常应用。

从本轮实际生成副本按唯一marker提取解码器原字节，只追加QA export别名，记录client／片段偏移／片段与包装哈希。另用strict noEmit检查提取段和真实导入消费者，7个原协议负例按精确文件／错误码拒绝，12个原协议基线／生成段运行对照通过。两次生成必须幂等，块外字节及解码器运行token保持；不使用重写类、假声明或整段client执行。合计4个正例消费、35负例、56纯运行用例，其中原三模块仍28负例／44回归；每个类型程序仍只有57个ES2022库，无DOM／Node／SDK。

当前使用`protected-baseline-v7.json`的432项审定基线，明确接续managed-window实际注释接入和已有Node检查工具；本入口的ES-only编译配置／模块集合不变，不导入Hub或Node声明。379项原清单、393项v2、397项v3、417项v4及433项v5历史基线保留不覆盖；新manifest自身由运行前后工具指纹保护。不是自动接受当前目录的动态快照。未来有意修改这些输入时，先审查差异并留下新的基线依据；不要删除门禁、忽略错误或覆盖旧取证文件。工具本身和编译器文件在执行前后也核对指纹。旧历史入口保留，不再作为新基线的执行入口。

场景规则的原始基线来自仓库固定rc.53；实际源码文本还必须与受保护annotate.py从原字节重建的已审注释配方一致。按AST从原Session／Library测试中抽取纯规则用例，原字节及实际源各跑8项，不导入整个混合测试文件或创建Profile。允许CRLF行尾保持，不把选中ID格式当成已完成文件验证。

公共执行器每阶段最多20秒、运行阶段总80秒，Node测试单进程／单项3秒；只终止自己启动的直接worker，记录exit确认和超时，错误保留输出并非零退出。自检可单独执行：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-check/selftest.py --output .tmp/ts-runner-selftest-1
```

自检覆盖成功／非零／忙循环父监督终止、过期预算拒绝启动、保护输入漂移／越界和伪编译器归档拒绝，另用底层进程IO替身检查退出不明时保留PID／部分输出并拒绝成功。不把替身当真实退出证明，也不把这些自检当成真实应用性能或行为验收。

这是三个模块及一个真实生成单元的ES-only开发检查入口；实际Hub的独立Node入口见qa/typescript-frame-hub/SOURCE_CHECK.md。尚非全仓TS迁移或完整CI，QA消费者不代表真实paint／accept回调已编译。当前432项基线可能包含本机保留但尚未提交的QA文件；不声称公开rc.53的干净检出已具备这些后续开发文件。只要这些仓库文件齐全，加上按上面命令准备的缓存，就不需要历史实验目录。

2026-11-02：v7仅明确接续rc.61已审UI和本轮检查入口／说明，v6历史清单不变；详见 docs/WORKSPACE_MAINTENANCE_20261102.md。

提交前固定排除两项与类型范围无关的本机输入：未跟踪的whale-icon-helper.exe和自动生成的sdk-contract-result.json；不提交运行报告或强行添加二进制。其余成员和哈希严格校验，基线接续明细见维护报告。
