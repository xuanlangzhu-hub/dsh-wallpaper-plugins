# 场景规则的隔离类型补修

本阶段只生成隔离JSDoc候选，不写实际开发scenes.js、不更新两模块联合入口或日常rc.57。

从仓库根运行，显式传入已审387项接续保护清单与固定TS5.9.3缓存，输出必须全新：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-scenes/run.py --protected-manifest .tmp/typescript-scenes-scope-20261030-a/protected-after.json --compiler-root .tmp/typescript-compiler-5.9.3-supervised-20261030-a --output .tmp/scenes-type-check-1
```

参数给出的是本轮已核对的例子，不会自动寻找“最新”目录或复用退出授权。缓存重新按固定SRI归档及解压成员校验，保护清单在前后核对；公共执行器来自qa/typescript-check，阶段最多20秒／总65秒，Node测试单进程／单项3秒。失败保留输出并非零，不重试／清理旧轮，不调用应用或native helper。

annotate.py按唯一锚点只补类型注释与必要括号：unknown请求字段、场景记录及动态字典、注入回调、未验证的selection和已验证的request。两个局部断言对应既有证明：Number.isInteger后seconds为number，以及返回前全部既有校验已完成的SceneRequest（主要是模式列表收窄）；不展开原对象简写或改变控制流。RequestFields只是object检查后的可选unknown字段视图，不是可信请求。

isSceneId仍是boolean而非字符串类型谓词；sceneSelection.mode仍是unknown。resolveProject结果保留unknown并由运行检查拒绝错误值；exists回调按实际Host接口声明字符串输入／布尔返回。原输入转换、缺省、时长边界和异常传播全部保留；不引入any、ignore、Node／SDK或伪声明。

positive.ts真正导入候选，cases.json记录12项精确错误码负例。verify.mjs只纳入候选／消费者及57个ES2022标准库，检查原7处基线诊断、正负例、运行语法树等价及3个逻辑变异。候选与原源分别运行同8项纯规则用例，共16项；用例由已审范围工具重新按AST从原测试抽取，并加入边界刻画，不导入整个Session／Library测试或创建Profile。

通过后下一步才核指纹并接实际开发源；再显式调整联合检查基线，不能为通过旧脚本删门禁或声称整个项目已迁移为.ts。
