# 首批模块的真实消费端与生成接缝审计

承接[三模块接入](TYPESCRIPT_SCENES_SOURCE_INTEGRATION_20261030.md)，本轮未修改运行源码或统一检查入口，只读核调用与构建边，并在新隔离目录执行生成器副本。结论：下一小步优先补**实际生成的WHL1内联段类型检查**，不直接扩大Host编译图。

## 真实调用与边界

| 已补模块 | 实际调用端 | 本轮决定 |
|---|---|---|
| frame-protocol.js | frame-hub.js第11行构造FrameDecoder；生成脚本读取并内联到client；client第2116行构造WM_FRAME_DECODER | Host文件引入node:events／Buffer／Trace；选择内联生成接缝 |
| probe-log.js | session第667行构造，stderr处理第1187行push后读取level／scope／message与failureText | session共2044行，含文件、进程、媒体、围栏与Trace，暂不整体纳入 |
| scenes.js | session导入／再导出并在选择、请求与列表中使用；library导入SCENES／isSceneId后仍查快照／重验文件 | library共292行并依赖Node与catalog，不用伪Node声明截断依赖 |

生成脚本28行，真实package脚本 `build:client-protocol` 指向它；现有 `npm run check` 仍是语法／CSS检查，不包含新开发类型检查。client共10325行并含浏览器调度与宿主界面逻辑，不因零静态imports就当成纯模块。

审计AST图保留8文件的imports及相关名称调用行。调用名列表只是语法匹配，须结合导入边或内联marker认定关联；尤其client中的同名isSceneId来自其它内联契约，不能算作直接消费scenes.js。没有执行Host／client／Session／Library。

## 生成接缝实证

最终 `.tmp/typescript-consumer-scope-20261030-a/`，工具 `qa/typescript-consumer-scope/audit.py`／`audit.mjs`。

1. 先核对394项保护输入和固定TS5.9.3编译器；将真实生成脚本、开发client和frame-protocol复制到新目录，原脚本仅在副本路径执行。开发client／生产assets不写。
2. 按唯一marker提取当前开发client旧内联体与副本实际生成的新内联体，运行token一致，协议块外原始字节保持。
3. 两段分别保留真实代码，仅在QA末尾加export别名以暴露私有类／常量；没有重写解码器、补假.d.ts或替换方法实现。
4. 当前旧内联体strict检查出现两处7006：onFrame和chunk。这是共享client尚未运行新注释生成的类型基线，不是运行故障，也不据此覆盖开发client。
5. 实际新生成段加真实导入的既有正例，strict／checkJs／noEmit零错；字符串chunk负例在该消费文件以2345拒绝。各程序只含真实提取段／消费者及57个ES2022标准库，无DOM／Node／SDK类型，编译器输出0。

两阶段退出0、确认退出、无超时或清理错误；阶段12秒／运行总35秒。没有执行解码器或真实播放，也未机械重复未变的44项回归。这一步尚未跑生成段的全部7负例／12运行用例，未证明整个client或真实浏览器回调已接受类型检查。

## 下一步最小范围

仅扩展统一开发QA：从该轮实际生成的client中提取WHL1体，保留上述export包装；将已有协议正例、7精确错误码负例及12纯运行对照重绑此生成段。检查模块闭包／类型图、运行token、生成幂等及块外字节，继续保存完整生成副本与提取来源指纹。保持现有三模块28负例／44回归，不把额外生成段算作新增生产模块。

允许修改检查器及必要审定基线，原snapshot与版本保持；不改共享client、生成脚本、manifest、assets或运行模块，不扩大Node／SDK／DOM声明，不导入整个client。正例消费者仍是QA，不假装实际paint／accept回调已被完整检查。完成这条边界后再评估下一处实际调用范围。

原394项输入全部保持，新增2审计工具，396项接续清单与承接回执在最终目录 `protected-after.json`／`baseline-transition.json`。日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，无日常进程／窗口／Profile查询、安装打包、发布／推送／派发／清理；作者调查、进一步任务栏优化、UI大改、三体／GPU／性能暂缓。
