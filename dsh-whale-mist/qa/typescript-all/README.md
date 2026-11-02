# 开发类型与纯运行检查：单命令、分环境

在仓库根执行，显式传入已准备的固定 TS 5.9.3 编译器和真实 Node24／undici 声明缓存：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-all/run.py --compiler-root .tmp/ts-compiler-1 --cache .tmp/node24-types-1 --output .tmp/type-check-all-1
```

输出必须是不存在的 `.tmp` 子目录。准备缓存的方法见 `qa/typescript-frame-protocol` 和 `qa/typescript-node-environment`；本命令不下载、不 npm install、不清理旧输出、不自动重试。

顺序调用三个检查入口，原有编译／运行门禁不变：

| 输出 | 实际范围 | 类型负例／纯运行 | 环境 |
| --- | --- | --- | --- |
| es-only | frame-protocol、probe-log、scenes 和一个真实生成的解码器单元 | 35／56 | 57 个 ES2022 库，types:[] |
| node-hub | 实际共享 FrameHub 和 FrameDecoder，QA 消费端 | 14／17 | 59 标准库＋66 Node＋41 undici |
| node-managed-window | 实际 managed-window，QA 消费端 | 16／21 | 59 标准库＋66 Node＋41 undici |

三组结果／文件图分开保留，Node两组使用同一真实声明缓存，不混入ES-only；不将重叠协议依赖当成新增生产模块。不代表全仓 TS 迁移、完整 Session／宿主编译、性能或实机验收。

编排器使用标准库 runpy 在本进程顺序调用入口，临时派生原 `common.Stages`，只收紧其 deadline，完成／异常时恢复执行器和 Python 参数／路径／工作目录。真正的 Node 子进程继续由原 Stages 监督：每阶段最多20秒，三入口原总限80／75／75秒保持，另有跨入口160秒约束。时限传到每个子进程；超时只终止直接持有的子进程，清理最多3秒。Python 本地文件核验和收尾不宣称有操作系统硬终止期限。不另外启动外层worker。

Hub和managed-window在保护清单验证后，通过common.load_annotation_recipe按完整文件路径独立加载各自配方；不会查询或注册裸名annotate的模块缓存。两组结果记录配方路径／SHA，编排器按各自身份核对，避免同名模块和收据串用。

任一组失败后不启动后续组。顶层 result.json 区分 passed／failed／not-run，不能以退出码0但无成功收据、部分成功或未知子进程退出当整轮通过。入口日志、详细命令、标准输出／错误、原收据都保留。

当前读取v7的432项审定输入（含编排器自身），逐项核对且不以现值覆盖已审哈希；加v7文件自身共433项前后核验。旧v4／v5等清单保留，前后清单写入输出。已有单项入口仍可直接使用，无历史轮次路径依赖。完整执行应有35个确认退出阶段，合成自测不算入真实编译阶段数。

编排边界自测（合成入口不替代实际编译）：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-all/selftest.py --output .tmp/type-check-all-boundaries-1
```

2026-11-02：v7仅接续已审rc.61的两个UI文件和本次四个入口／两份说明，432项成员保持；v6原件保留。详见 docs/WORKSPACE_MAINTENANCE_20261102.md。

提交前固定排除两项与类型范围无关的本机输入：未跟踪的whale-icon-helper.exe和自动生成的sdk-contract-result.json；不提交运行报告或强行添加二进制。其余成员和哈希严格校验，基线接续明细见维护报告。
