# 场景规则已接开发源，三模块统一检查通过

承接[场景隔离补修](TYPESCRIPT_SCENES_ISOLATED_20261030.md)，本轮将已验JSDoc和两个局部分组断言接入实际开发scenes.js，再将它纳入统一开发检查。没有改播放规则、JS入口、原生资产或日常安装。

## 接入与批准差异

应用前核对隔离b轮通过回执、LF候选哈希与393项保护输入；先保存原源、统一入口和说明，再应用。应用记录在 `.tmp/typescript-scenes-source-application-20261030-a/`。

| 对象 | SHA256 |
|---|---|
| 修改前scenes.js（CRLF） | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` |
| 已验隔离候选（LF） | `2A5F064924CBDA63A0549A48E16B6BECEBC615C5C0B8BA9D90FCD2522B4F124D` |
| 实际开发scenes.js（CRLF） | `96D95390C4F931715B5FF477DC09C6011AD3F9DF3339027882915721E1205B69` |

实际源166行，166个CRLF／166个LF，未引入混合或双CR行尾；按文本读取与已验LF候选一致。只有注释及Number.isInteger分支／校验后返回对象的两个分组断言，原对象简写、条件和异常保持。

原393项中390项保持。明确批准变化只有scenes.js、统一检查run.py和其README；新增 `qa/typescript-check/protected-baseline-v2.json` 一文件，包含更新后的393项。原379项 `protected-baseline.json`及所有旧快照保留，不覆盖；新manifest自身由统一入口的工具前后指纹保护。应用目录 `approved-input-changes.json`记录三处双边哈希，新轮不动态忽略不匹配项。

FrameDecoder、ProbeJournal、公共执行器及原8项执行器自检源码指纹保持，本轮不机械重复未改的执行器自检。

## 统一入口

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-check/run.py --compiler-root .tmp/ts-compiler-1 --output .tmp/ts-check-1
```

编译器仍显式传入并重新验证TS5.9.3的锁定SRI归档、SHA1和全部解压成员；输出必须全新。执行不要求历史实验目录存在：基线、消费者、负例、验证器和纯用例来自受保护仓库文件。

场景源另按受保护annotate.py，从固定rc.53原字节重建已审注释文本并核对。正例与12负例直接导入实际开发路径，不检查另一个带声明的替身。纯规则由AST从原Session／Library测试提取后绑定固定基线与实际源，完整混合测试文件不加载，不创建Profile或执行Session／Library。

## 验证结果

最终 `.tmp/typescript-three-modules-20261030-a/`，首次运行通过：

- 联合strict／checkJs／noEmit零错误，实际程序集合是三个开发JS模块、三个真实导入的TS消费文件和57个ES2022标准库，共63文件，无DOM／Node／SDK类型。
- 7＋9＋12＝28负例在各自文件按指定单个错误码拒绝；三个原始未标注基线诊断仍核验，未删除原负例。
- 12协议＋8日志对照＋8原纯日志＋16场景规则＝44项纯运行回归通过。场景部分为固定原字节8项与实际源8项；保留unknown请求、未验证mode、可空seconds、注入回调及String转换差异。
- 协议运行token、日志及场景规则运行语法树保持；两组语法树比较各通过3个逻辑变异。没有放宽对象节点、操作符或控制流比较。
- 原client生成器仅操作副本，两次幂等，协议块外字节保持，三个client协议块token一致；开发client及assets不写。
- 15个阶段全部退出0、确认退出、无超时或清理错误。阶段最多20秒／运行总预算80秒，Node单进程／单项3秒。编译器输出0，无声明／map／tsbuildinfo。

实际编译图／消费路径、各组类型结果、命令回执和TAP均保留在最终目录。这证明三模块类型约束与纯行为回归；没有声称宿主全量编译、真实播放或性能收益。

## 接续

最终目录 `protected-after.json` 记录394项后续基线，`baseline-transition.json`记录390项保持、3项批准变化与1项新增。旧隔离工具继续按当轮原基线解释，不拿它们在新源上失败当成回归，也不删除门禁强行通过。

首批三个模块的JSDoc／checkJs接入已闭合。下一小步先只读盘点它们的真实消费端和构建接缝，挑一处类型收益明确且边界可控的范围，再决定是否扩展；不为凑模块数量继续孤立扩张，不自动引入Node／SDK声明或整体改.ts后缀。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，本轮无日常进程／窗口／Profile查询、依赖安装、打包安装、发布／推送／派发／清理。作者长时根因仍未知且暂缓，进一步任务栏优化、UI大改及三体／GPU／性能不推进。
