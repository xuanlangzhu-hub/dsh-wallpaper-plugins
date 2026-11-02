# ProbeJournal 隔离类型补修

本阶段只产生隔离候选，不写 `src/wallpaper/probe-log.js`，不改首项FrameDecoder检查或日常rc.57。

从仓库根运行（需已有Node／Python及首项已验证的TypeScript5.9.3本地缓存）：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-probe-log/run.py --output .tmp/probe-log-type-check-1
```

输出必须全新。当前编译器缓存位于 `.tmp/typescript-compiler-5.9.3-supervised-20261030-a`；运行前重新核对首项固定的SRI归档、全部归档成员及解压文件，不安装其它依赖。输出保存完整候选、冻结QA、类型正负例、命令退出与回归证明。各阶段20秒、总65秒，Node测试单进程／单项3秒截止，不自动重试。

`annotate.py`按固定原模块唯一锚点生成JSDoc；编译器检查此候选及真正从它导入的消费者，没有同名声明替身。JSON值覆盖全部合法JSON种类，内部字段／数组元素仍为unknown，按原有运行判断收窄，不能假装已经是日志信封。

只保留三个局部断言：固定level列表命中后的枚举值；原 `entry.at=Date.now()` 之后，分别将同一记录放入entries／added时的必有时间戳。解析结果本身的at仍可缺省。除JSDoc／格式外，只有这些断言所需的分组括号；语法树归一化验证会保留运算符与控制流，并用3个故意变更逻辑的反例证明比较不是空检查。

类型正例和9个负例均来自候选真实导出。原8项纯日志用例重绑候选，另8项基线／候选运行对照检查Buffer分块、边界及转换异常。历史原生helper用例和实机capture文件不执行。无emit、无DOM／Node／SDK声明，也不执行session或FrameHub。

这不是第二模块已接入开发源码的声明；后续连接必须先确认本交付的候选指纹、源与运行语法树，再做实际源消费核验。
