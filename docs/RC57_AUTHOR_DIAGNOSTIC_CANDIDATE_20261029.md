# rc.57 作者参数恢复／取证：本机候选与短验准备

后续更新：用户新确认后的[实测与恢复](RC57_AUTHOR_DIAGNOSTIC_SHORT_TEST_20261029.md)已完成，已恢复日常rc.56。本篇以下是准备阶段快照，其中“未安装／无授权”不是当前状态；该轮已closed-out，不可复用。

状态：**候选及全新工具离线通过，尚未安装／实测。** 日常仍是 DSH 0.2.1-rc.3、Whale rc.56、Git Bash 0.1.2。公开 GitHub／npm 保持 rc.53。本轮没有查询日常窗口、进程或 Profile，没有提交、推送、发布或清理。

本轮承接[默认关闭启用与下载入口](AUTHOR_DIAGNOSTIC_ACTIVATION_DOWNLOAD_20261029.md)，把已审的47文件实验载荷单独版本化。不是再次从含 Trace 的共享开发树整体打包。用户描述的旧“数小时后进入脆弱循环”仍未复现／定因；rc.56 上一次普通失败、刷新即恢复的反馈继续分开记录。

## 1. 固定候选

| 项目 | 结果 |
|---|---|
| 候选 | `0.6.0-rc.57`，private，本机短验专用 |
| 归档 | `.tmp/rc57-author-diagnostic-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.57.tgz` |
| SHA256 | `EE286630B7D6F090C8762A7409A9E816BCE31D892EF355D0DEE4CEEE7273D262` |
| 大小／成员 | 7,280,507 字节／47个文件 |
| 两目录重现 | a／b归档与成员清单完全一致 |
| Build ID | `2069a0c9912d7821319d4ce0a5242f3d92e60736b799ca855f63c20cf0ae62ba` |
| 默认诊断 | 关闭；只有 Host 启动时严格 `WM_AUTHOR_DIAGNOSTICS=1` 才启用 |
| 回退 | 日常 rc.56 原包 SHA `85258A1BD5F5A6E421C6CCAA7E21D3DE5C28725EA5E8F92A19115D43D91BD160` |

相对上一轮启用／下载实验，只改 README、package.json 版本，以及 client／私有 build 模块中一致的版本与 build 元数据。控制器、Host、适配器、记录器核心指纹保持。47成员中全部14个原生／图标资产与固定 rc.56 相同，没有重新编译原生。manifest 只改 version，保留 private、宿主约束及无安装钩子。

持久配方／清单：`release-sources/rc57/build-candidate.py`、`README-prefix.md`、`package-manifest.json`、`candidate-audit.json`、`build.json`。可重现构建仍依赖已固定的前轮 `.tmp` 源证据与原 rc.56 归档，不宣称清空 `.tmp` 后可以独立重建；本轮不清理这些输入。

## 2. 实际归档检查

证据 `.tmp/rc57-author-diagnostic-package-check-20261029-b/`，配方 `release-sources/rc57/check-candidate.py`：

- 从47成员实际解包目录运行：40项生命周期／bootstrap／组件／provider、30项导出／真实生成路由、76项 Host／provider检查，合计146项通过。
- 27个 JS 语法检查、36条相对 import 边闭合；两独立归档相同，361个保护输入保持。
- 30个执行阶段全部退出0、无超时；Node测试使用单进程隔离模式及10秒测试截止，父监督总预算90秒、单阶段最多25秒。
- 首次检查 a 把数组形式的 package-manifest 按字典读取，断言失败；只修核包脚本读取，b通过。候选包没有因此改变；失败目录保留。

以上是包内真实 JS 与底层 IO／浏览器接口替身检查。没有完整桌面 SDK 启动、真实文件下载或数小时运行验收，不能据此宣称长时故障已解决。

## 3. 全新短验轮与备份边界

最终工具轮：`.tmp/rc57-author-diagnostic-short-trial-20261029-b/`。

计划新备份：`C:/Users/HP/.dsh/backups/rc57-author-diagnostic-short-trial-20261029-b`，目前不存在。

`trial-config.json`：purpose=`temporary-rc57-author-diagnostics`，dailyVersion=rc.56，candidateVersion=rc.57，`profileWritesAuthorized:false`。没有 authorization、旧 PID／端点、运行结果、closed-backup 或生产备份。不能把本次“继续准备”当成实机方便／退出确认。

工具由36个 SHA 固定的 rc.54 视觉短验模板做同时替换，避免 rc.53→56→57 串联替换。增加7个诊断工具与2个默认启动阶段脚本。a准备通过后，b隔离保存默认启动的端点／状态，避免覆盖随后诊断启动的证据；a不用于实机。

明确调整：

- 安全归档核对区分日常43文件与候选47文件，原来两者都写43的断言已改。
- `verify.py`、`verify-installed-readonly.py` 与布局核对也必须先通过本轮授权，才读生产文件。
- 两种候选启动方式只在 `ProcessStartInfo.Environment` 给子进程传入 `0` 或 `1`；不调用 SetEnvironmentVariable，不写系统／用户／日常启动器。原 Process／User／Machine 的**这个单独变量**只在实机授权及新备份后记录，恢复启动沿用原 Process 值或原先缺省状态，不枚举其它环境变量。
- 启动前仍校验当前关闭状态、原 WE 身份、原 EXE／ASAR／WE 哈希。启动尝试先留 unknown 回执；拿到 launcher PID 也不当作 Host 已就绪，须另做新鲜发现。失败／超时结果不明时停止排查，不盲重开。
- 新启动监督器超时只终止保留的 PowerShell helper 句柄，**不杀进程树**，不因 helper 超时杀新开的 DSH 或原 WE。15秒截止、19秒最终围栏；Host 成功由其它证据确认。
- 下载收集器先查授权，再查本轮显式下载意图，仅接受 Downloads 根下这次 build 的固定文件名（允许浏览器1–999重名后缀），拒绝链接／重定向、旧文件、变化中读取和超过300000字节的文件。绑定候选归档／实际验证器指纹，校验封装和两端快照后复制到本轮，不删除原下载。不扫描其它下载。

最终离线结果：32个 PowerShell 解析、10项授权对象、5项恢复时间精度、7项清理绑定、23个基础无授权拒绝、24个 runner 文件引用闭合；新增8个无授权拒绝、7项下载／授权合成用例、4项子进程环境夹具通过。基础／新增31个入口无授权时先拒绝，没有应用或生产文件采样。三个准备阶段全部退出0无超时。合成授权仅在内存夹具中，不落本轮 authorization。

证据：`offline-preparation-report.json`、`diagnostic-tool-preparation.json`、`preparation-commands.json`、`source-adaptation.json`。a／b均保留，最终使用b。原36模板、361保护输入及旧包保持。

## 4. 下一轮实机步骤（尚未执行）

先另取用户当时方便／无任务、暂停其它助手、停止播放并正常退出 DSH 的直接确认；原 WE 保持运行。助手代点，不要求用户长时等复现。默认测后恢复 rc.56 及本轮原设置。

1. 只在获得新确认后生成b轮 authorization。核验原包／宿主、关闭状态，新备份 Profile、关闭存储、媒体缓存及布局；核对备份后记录唯一诊断变量的原状态。所有备份采用本轮路径，不复用早先轮次。
2. 安装已核验的 rc.57 原包，完整47文件验证、媒体与布局检查、关闭 runtime 核对。使用 `node run-diagnostic-step.mjs environment` 记录原变量；`launchDefault` 只传0。另用 `run-step.cjs discoverDefault`／`snapshotDefault` 存到独立默认阶段证据。助手确认原外观、目录及无诊断导出入口。若原自动播放触发先正常停止；清理异常立即收尾，不继续下一阶段。
3. 正常退出默认启动的 DSH，确认关闭后 `node run-diagnostic-step.mjs launchDiagnostic` 只向本次子进程传1；该模式要求默认阶段的 launch／discover／snapshot 回执。再用原 `run-step.cjs discover` 新发现，禁止套用默认启动 PID／端点。
4. 确认诊断行可见。选本轮可访问、分级允许的原壁纸；不存在时用已验证 Lucy，不更改分级找壁纸。必要时短播，取有效 playing 绑定后做一轮作者参数改变／恢复；有滑块才做一次连续拖动。目标约20秒，接近30秒优先停止，不为等反馈／分析而保持播放。没有真实失败就不声称验证了失败恢复，更不故意重发不确定操作。
5. 停止并核对源／采集清理后，仍在侧栏点显式导出；点击前运行 `mark-download-intent.ps1`，然后只收集确切新下载：`node collect-diagnostic-download.mjs <本轮文件绝对路径>`。界面 ✓ 只说明交给浏览器；只有真实文件校验回执才证明保存成功。取消／下载失败如实记录，不把空文件或不存在当成功。
6. 正常退出，保留测后数据，依 playing 绑定的清理与当前 quiescent 门禁恢复日常 rc.56 原包43文件、本轮 Profile／外观存储／媒体／布局，完整核验。恢复前保护本轮新增数据。原 WE 不退出不杀。
7. `launchRestored` 要求 verifyRuntime／restoreLayout／environment 回执，子进程沿用原 Process 变量；再做新鲜恢复发现，确认播放停止、采集0与原布局。原变量若来自日常启动器而非本助手进程，优先用户原方式重开，不能把父进程环境相同说成已验证全部启动途径。最后确认并关闭本轮，不默认留 rc.57 日常。

若下载目录不是本轮配置的 Downloads，收集器拒绝后记录实际位置再评审调整，不扩大扫描。若启动异常、清理未确认、主观验收或新范围决定需要用户，停止依赖动作；不让工具自行重试循环。

仍暂停：TS、任务栏进一步零闪现、UI大改、三体与公开发布。根因未知不妨碍验证新的恢复／取证能力，但两者不能互相替代。
