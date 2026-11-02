# FrameHub 隔离类型补修

只对共享141行Hub副本补JSDoc／已有catch值的可选message视图，不接实际源、不修改Trace、Session或固定发行包。

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-frame-hub/run.py --cache .tmp/typescript-node-cache-20261030-b --compiler-root .tmp/typescript-compiler-5.9.3-supervised-20261030-a --protected-manifest .tmp/typescript-frame-hub-baseline-20261030-a/protected-after.json --output .tmp/frame-hub-types-1
```

从仓库根运行，输出必须全新。显式缓存与407项审定清单是本轮例子，不自动选“最新”。重新核TS5.9.3和Node24.10.0／undici7.16.0的锁定SRI归档、实际文件集合及前后指纹，不npm install／hooks／node_modules。

Trace类型来自6处真实record对象，允许具有record的可启停sink或没有record的disabled hook；只描述本项目注入接口，不导入Trace实现。res方法引用真实Node HTTP类型，flushHeaders可缺省。构造器接受已有调用传来的clientTrace但不保存，stream使用FrameHub加可选扩展视图，不新增运行字段。latest／snapshot保持真实解码器和Buffer推断，runId仍可写。

positive.ts真正导入候选，14负例按单个精确错误码／文件拒绝。编译图只能出现Hub／实际协议副本／消费者和59个TS标准库＋66个Node＋41个undici声明，skipLibCheck:false，无DOM／SDK或假声明。原15条基线诊断也实际核验。

完整Node声明重复编译按基线／正例、5＋5＋4负例、语法树／提取分阶段执行，汇总必须覆盖全部14个名称及指定错误码；每阶段仍20秒、总75秒，不通过延长期限或减少声明检查避开超时。

语法树只归一化注释与分组括号，保留控制流、操作符及optional-chain标记，并以3个逻辑变异证明比较有效。原transport混合文件只按AST提取2个Hub纯测试及其packet／Response依赖，不导入该文件或执行原生C#用例。原字节与候选各跑这2项，另做Trace／背压／异常／解绑对照和排除时钟量后的稳定IO轨迹比较，共17项。HTTP响应是底层IO替身，事件／Buffer和Hub／解码器运行真实代码；不称真实HTTP／DSH验收。

公共父执行器每阶段最多20秒／总75秒，Node单进程／单项3秒，无重试；失败输出保留，确认退出后才报告通过。通过后再核指纹接实际开发源；旧ES-only三模块／生成段检查保持独立，日常rc.57不动。
