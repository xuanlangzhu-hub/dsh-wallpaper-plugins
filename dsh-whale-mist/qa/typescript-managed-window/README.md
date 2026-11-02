# managed-window 隔离类型补修

后续实际源码已接入：当前请用本目录check-source.py和SOURCE_CHECK.md。下文run.py保留隔离阶段复现说明，固定旧源与423项快照，不作为当前基线入口。

只生成隔离副本。显式传入上一阶段423项审定保护快照、已固定TS5.9.3和真实Node24／undici缓存；输出必须全新。

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-managed-window/run.py --protected-manifest .tmp/managed-scope-1/protected-after.json --compiler-root .tmp/ts-compiler-1 --cache .tmp/node24-types-1 --output .tmp/managed-types-1
```

检查真实隔离JS导入，16项精确错误码负例分4组，原21条诊断核验，AST／可选链等价及3逻辑变异。声明图严格为59标准库／66Node／41undici，不混DOM／SDK，无自制声明、any或ignore。

入口保留unknown校验，validateSize保留泛型fallback；JSON结果Promise<unknown>，归一化窗口只保证已有验证的句柄、原typeof判定的pid及处理后的startUtc。标题／可见性／坐标仍unknown。局部视图只表达原for-of非空字符、Number.isInteger后数值运算和原object guard之后的字段读取，运行AST不能改变。

FindWindows是注入者应满足的数组／记录契约，不是原始runHelper已验证JSON的断言。正例显式检查原始JSON；负例阻止直接将Promise<unknown>接进finder。真实Session尚未编译。

21项纯运行对照覆盖原字节与候选的路径／标识／fallback／记录别名、helper成功／原始JSON／异常／超时／迟到close、轮询阶段与歧义。底层process／stream使用事件IO替身，不启动真实helper／Session或窗口。运行测试单进程、单项3秒，案例超时10ms／延时25ms均为夹具参数，不改生产默认30秒／轮询次数。每阶段20秒／总75秒，失败保留，不清理或自动重试。

隔离通过后才可接实际开发源；本入口不更新ES-only／Node Hub图、不打包安装、不查询日常DSH／WE，也不修复长期参数滑动或生命周期行为。
