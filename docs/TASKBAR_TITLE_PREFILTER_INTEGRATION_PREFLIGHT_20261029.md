# 标题预筛：固定rc.55载荷离线整合预检（2026-10-29）

结论：可在固定rc.55载荷中只替换已审标题预筛DLL，保留其余42个文件。程序集定义／签名和依赖保持，只有两处枚举回调方法体变化；原生协议、固定Host清理和启动参数往返检查通过。本轮仅创建离线staging，没有生成新安装包、安装、查询日常DSH／WE进程或操作窗口。

## 输入与文件范围

- 基线：`.tmp/rc55-taskbar-stage-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.55.tgz`，SHA256 `0D93C59FF1D5E408C3763439A8197CC69F8054CC23064FDDC6A0B3FB6D60FC29`，7,265,382字节／43文件；逐项核对 [rc.55清单](../release-sources/rc55/package-manifest.json)。
- 补修：[标题预筛离线报告](TASKBAR_TITLE_PREFILTER_OFFLINE_REPAIR_20261029.md)对应 `.tmp/taskbar-title-prefilter-20261029-c/isolated/native-source/`，19输入指纹保持。
- 替换：仅 `assets/wallpaper/WallpaperProbe.dll`，SHA256 `730DC34D8CAB1970093746CF1F1699EB833C02A267AE68BDFCC55CDFAF93D1E2`。
- 保留：原apphost／deps／runtimeconfig、其余运行文件与资产；8个依赖DLL与固定包字节一致，新构建依赖图归一化后与原包相同。apphost包含原 `WallpaperProbe.dll` 目标名，但没有实际通过apphost加载它。
- 最终输出：`.tmp/taskbar-title-integration-20261029-c/` 的 `baseline`、`staging`、`staging-manifest.json`、`metadata.json`、`result.json`；staging仍保留rc.55元数据，仅用于预检，**不是新版本安装包**。

## 精确程序集核验

沿用已固定指纹的MetadataProbe，使用PEReader读取，不执行被查程序集。IL先归一化元数据引用、局部变量和异常处理信息，再比较，不把单纯token变化当作实现差异。

| 项目 | 结果 |
| --- | --- |
| 程序集／版本 | WallpaperProbe／1.0.0.0保持 |
| 架构／入口 | Amd64／Program.Main保持 |
| 程序集引用 | 19项相同 |
| 定义数量 | 3399→3399 |
| 新增／删除／改变定义 | 0／0／0 |
| 共有方法体变化 | 仅下列2项 |

变化为 `SourceWindowHelper+<>c__DisplayClass66_0::<FindWindowsByTitle>b__0` 和 `SourceWindowHelper+<>c__DisplayClass77_0::<FindProbeWindows>b__0`，对应上轮两个各新增四行的标题预筛。其余方法体保持。没有生产签名、类型、依赖或协议结构变化。

[精确白名单](../dsh-whale-mist/qa/taskbar-title-prefilter/integration-metadata-allowlist.json)绑定旧／新DLL、两个完整方法签名和双方方法体hash；不允许任意SourceWindowHelper修改。a轮只做清点，明确 `integrationAccepted:false`；审阅两项差异并固定白名单后才进行完整预检。

## 协议与拒绝分支

不重复运行上轮已通过且源码指纹保持的38＋70＋41项。新整合检查在独立目录执行：

- 14项原生协议：同一固定源链接的测试程序，检查daily／preview／关闭隐藏三种参数、重复／未知／无归属参数拒绝、实际FramePipe字节、真实Runtime的已退出与未确认退出分支。
- 36项固定Host：导入staging实际JS，helper／capture子进程、进程查询及创建时间查询使用底层IO替身；意外OS命令抛错。包括原11项Host协议、6项计时sidecar边界和新增19项身份／终结负例。
- 3组实际Host生成argv交回原生CaptureArguments.Parse：daily、preview、关闭任务栏隐藏的fallback，全部往返一致。

新增19项覆盖：错误location／HWND／PID、100ns启动时间差、缺requestedIdentity、pending阶段、缺action、cleanupSafe=false、exited／started未知、pending／timedOut／terminated标记、beforeIdentity创建时间不符、进程查询失败、worker仍在、capture仍在、真实stopped-before-action正例及带trigger伪装未启动的拒绝。

sidecar六项继续确认：诊断文件不能替代缺失／损坏动作文件，不能覆盖未退出或OS进程存在；合法终结证明无需计时文件，损坏计时文件不妨碍合法终结证明。实际关闭由Host原协议门禁决定，未给sidecar增加清理权限。

FramePipe夹具仅有四字节JPEG标记用于帧协议，不是可显示图像、实际画面或FPS证据。原生协议程序使用实际策略／协议类和底层IO替身，不执行WallpaperProbe应用入口、真实worker／COM／采集；Host也没有查询日常进程或启动壁纸。

## 执行与保留

最终c轮6阶段退出0、无超时；metadata／protocol两个测试工程均0警告、0错误。父总截止120秒，单阶段8–35秒；所有子进程exitCode已确认。没有重编原生DLL、改共享rc.30／Trace树或Profile。

b轮的36项Host检查实际全部通过，但汇总脚本期待TAP，当前Node自动输出了人类可读格式，因此整合未被接受，失败证据保留。仅给测试命令明确加 `--test-reporter=tap`，另起c轮完整预检通过；没有放宽断言、期限或生产门禁。

361个保护输入、原M1与本轮预筛源／DLL、固定rc.53／54／55归档保持。可复现入口：[preflight.py](../dsh-whale-mist/qa/taskbar-title-prefilter/preflight.py)，模板指纹：[integration-inputs.json](../dsh-whale-mist/qa/taskbar-title-prefilter/integration-inputs.json)，下一阶段范围：[integration-plan.json](../dsh-whale-mist/qa/taskbar-title-prefilter/integration-plan.json)。

## 下一步

可以准备单独新版本的本机诊断候选，固定rc.55载荷仅换此DLL，并单列新版本／README说明；保留已有阶段计时，后续与rc.55实际数据比较。当前没有分配候选版本、生成归档或自动安装。

真实短验需当时方便／无任务、正常退出和新备份，默认恢复日常rc.53；先准备有界、及时停止的单轮工具，再确认用户方便。不复用旧authorization／PID／端点／备份；不以离线计数推算0.9秒检查实际能缩短多少或宣称零闪现。日常DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2保持，TS随后、UI保持、三体暂缓；无发布、提交推送、派发或清理。
