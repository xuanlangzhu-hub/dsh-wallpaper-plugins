# 实际 managed-window 开发源码检查

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-managed-window/check-source.py --compiler-root .tmp/ts-compiler-1 --cache .tmp/node24-types-1 --output .tmp/managed-source-1
```

显式传入固定TS5.9.3及真实Node24／undici声明缓存，输出必须全新；准备方式见qa/typescript-frame-protocol和qa/typescript-node-environment。不下载、不安装依赖、不自动重试或清理旧输出。

读取v6的434项审定输入，另外保护v6自身，共435项。原字节基线位于本目录baseline/managed-window.js；按annotate.py重建审定文本，核对实际源码及CRLF。类型正例、16项精确负例、原字节与实际源码的21项纯运行对照都绑定真实路径，所有生成夹具仅写输出目录。

真实Node声明闭包为59标准库／66Node／41undici，skipLibCheck:false，无DOM／SDK／伪声明。包含原21条诊断同轮核验、AST／可选链等价及3逻辑变异，编译器输出0；每阶段20秒／总75秒，运行单项3秒。只用底层事件IO替身，不启动真实helper／窗口／Session，不证明原生退出或宿主兼容。

校验入口和原始JSON仍为unknown，未验证字段仍为unknown，fallback保留泛型；FindWindows是注入者需满足的数组契约，不把runHelper输出冒充已验证数据。旧run.py和README保留隔离阶段的历史复现说明，不再作为当前源码基线入口。

注释配方在核对保护输入后按完整文件路径独立加载，不依赖裸名annotate缓存，结果记录配方路径和SHA。统一命令已将本入口列为第三组，ES-only／Node Hub／Node managed-window的图与收据各自保留，不扩Session或SDK。
