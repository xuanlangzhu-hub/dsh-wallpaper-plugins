# 实际开发 Hub 的独立 Node 检查

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-frame-hub/check-source.py --cache .tmp/node24-types-1 --compiler-root .tmp/ts-compiler-1 --output .tmp/hub-source-check-1
```

显式传入已固定Node24声明缓存与TS5.9.3编译器，输出必须全新。准备方式分别见qa/typescript-node-environment和qa/typescript-frame-protocol，均不npm install或改变运行依赖。

这是实际共享Hub路径检查，独立于ES-only三模块／生成段入口。先核434项v6审定基线、声明／编译器SRI归档及完整文件集合，再从仓库baseline/frame-hub.js重建已审注释文本并核对实际源；历史隔离run.py保留，不作为新基线入口。固定未标注Hub是共享Trace版原字节，不是发行40行副本。

正例与14精确负例直接导入实际Hub，协议依赖也是实际开发FrameDecoder。基线仅复制到本轮输出作对照。既有验证器仅在冻结副本中改纯用例输出路径／import绑定，不改类型／AST门禁，不往src写legacy.test.mjs。提取的2旧纯用例各跑两实现，加其余Trace／背压／异常／解绑对照共17项；HTTP只用底层IO替身，不导入混合原生测试、Session、完整Trace／HTTP服务器或DSH。

Node声明图保持59个TS标准库＋66个Node＋41个undici，skipLibCheck:false，不混DOM／SDK。分5＋5＋4负例及其它小阶段，执行期限20秒／总75秒，Node测试单进程／单项3秒。源码／工具／声明缓存前后核指纹，无重试、emit或生产写入。

注释配方在保护输入核对后按完整文件路径独立加载，不查找或注册裸名annotate缓存；结果记录配方路径和SHA。统一命令可与managed-window顺序运行，两套Node消费图／收据分别保留。
