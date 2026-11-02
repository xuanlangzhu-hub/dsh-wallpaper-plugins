# FrameHub 实际开发源码类型接入

2026-10-30。本轮完成上一轮已审注释的实际接入；范围是开发源码和离线检查，不是运行功能修复、性能优化或发行包升级。

## 结果

`dsh-whale-mist/src/wallpaper/frame-hub.js` 保持原有 CRLF，接入已通过隔离验证的 JSDoc。实际文件 SHA256：

```text
BE91741737F0E0A6C32C4F658F6CC21AFEEEDAE382A28B972D5DE3B2F52DFD51
```

接入前共享 Trace 版 SHA256 为 `6B3E697A5317EF81BBDC39599A111FA3D949526CA28198456EEC88AD8AB5DF57`；其原字节保存到仓库 `qa/typescript-frame-hub/baseline/frame-hub.js`。实际接入文本经换行归一化后，与已审 LF 候选 `F2639D6727DD72A4FA9747903B94494089E3D4B0ABF0FAECE697F65E2FCA262B` 及注释生成配方一致。

只增加接口注释和 catch 中错误对象的局部类型视图／分组。运行 AST、可选链语义保持，3 项逻辑变异仍被门禁拒绝；未增加构造字段，保留既有 clientTrace 回退、Trace 异常、最新帧背压和解绑逻辑。未以固定发行包的 40 行 Hub 替换共享实现。

## 实际路径验证

新增独立入口 `dsh-whale-mist/qa/typescript-frame-hub/check-source.py`，用法见同目录 `SOURCE_CHECK.md`。它从仓库基线重建审定文本，对正负例及运行对照绑定实际 Hub 和实际 FrameDecoder 路径，不依赖历史实验目录。原隔离入口／记录保留。

本轮证据：`.tmp/typescript-frame-hub-source-20261030-a/`。

- 固定 TS 5.9.3、真实 Node 24 声明及 undici 闭包；声明缓存 126 个受保护文件前后核验。
- 图为实际 Hub、实际 FrameDecoder、QA 消费文件，以及 59 个 TS 标准库、66 个 Node、41 个 undici 声明。`skipLibCheck:false`，无 DOM／SDK／自制假声明。
- 原共享 Hub 的 15 条类型诊断得到核验；实际接入源正例零错，14 项负例按文件及具体错误码拒绝。
- 17 项纯运行对照通过：2 个提取的原有 Hub 用例各测两实现，其余覆盖 Trace、背压、连接回退、异常和清理，并比较稳定 IO 轨迹。
- 8 个阶段全部退出 0、确认退出、无超时；最慢阶段约 4.69 秒。仍保留每阶段 20 秒／总 75 秒和运行测试 3 秒期限，不靠无限等待。
- 编译器输出文件为 0。冻结验证器只改提取用例的输出位置和导入路径，所有新 fixture 都写入本轮输出目录；源码目录没有生成 `legacy.test.mjs`。

HTTP 响应是底层 IO 替身；实际 Node 事件、Hub 和解码器执行。没有运行 Session、完整 Trace／HTTP 服务、原生混合测试或 DSH。这些结果不等于实机、宿主 Node 版本或画面验收。

## ES-only 环境保持独立

统一 ES-only 入口只更新审定清单到 v4，不引入 Hub／Node 类型。另起 `.tmp/typescript-es-after-hub-20261030-a/` 复核：3 个实际模块和真实生成的解码器单元，35 项精确类型负例、56 项纯运行回归、4 个 QA 消费正例通过；18 阶段均退出 0 且无超时，最慢约 2.77 秒，编译器输出 0。57 个 ES2022 标准库约束、生成幂等、块外字节与来源门禁保持。

Node 的 14／17 与 ES-only 的 35／56 是两套环境下的检查结果，不将重叠协议依赖算作新增生产模块，也不声称全仓类型覆盖。

## 保护与接续

应用前备份和双边差异：`.tmp/typescript-frame-hub-source-application-20261030-a/`。

原 414 个保护输入中，411 个保持；批准变更只有实际 Hub、ES-only `run.py` 的基线选择、其 README。新增仓库基线、实际源检查器和说明 3 项，v4 固定包含 417 项；再单独保护 v4 文件自身，形成 418 项接续快照。旧 379／393／397 清单、隔离证据和所有失败轮次保留，不覆盖或删除门禁。

日常 rc.57／DSH 0.2.1-rc.3／Git Bash 0.1.2、公开 rc.53 保持。本轮无日常进程／窗口／Profile 查询或操作，无打包、安装、发布、推送、派发或清理，manifest／assets／固定发行载荷不改。作者长时间滑动问题、进一步任务栏优化、UI 大改和三体仍暂缓。

下一小步可把 ES-only 与 Node 两个独立检查入口编排成一个有界开发命令，仍分别输出环境图、结果和超时状态；不合并类型环境，不自动扩入 Session／SDK。第四个实际开发模块的类型接入到此闭合，尚无整体 `.ts` 迁移或性能收益结论。
