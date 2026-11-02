# 任务栏首帧补修：固定rc.53离线整合预检

2026-10-28。**预检通过，运行文件白名单只有`assets/wallpaper/WallpaperProbe.dll`一项。** 固定rc.53的另外42文件、旧apphost、deps、runtimeconfig及8项依赖均保持。当前仅有本机解包副本，没有生成候选包、升版本、安装或公开发布。

本轮接续[隔离补修](TASKBAR_FIRST_FRAME_REPAIR_20261028.md)，不重新跑未改的41项回归，也不重新编译其原生DLL。日常DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2保持。

## 来源和最小替换

| 输入 | 固定值 |
| --- | --- |
| 原rc.53归档 | `.tmp/rc53-gallery-author-candidate-20261028-a/dsh-whale-mist-0.6.0-rc.53.tgz`，SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA` |
| 原43文件清单 | `release-sources/rc53/package-manifest.json` |
| 已审原生输入 | `.tmp/taskbar-first-frame-repair-20261028-c/green/source-receipt.json`，18份源仅Runtime工厂配置改0，其余17份不变 |
| 新DLL | 同目录`native-source/bin/Release/net10.0-windows10.0.19041.0/WallpaperProbe.dll`，SHA256 `6313602FE6CB8E8A80DCB93BE0D3D44EF8E961CCA1B7CC10E8F4F1AD5CCCD37D` |
| 本轮最终证据 | `.tmp/taskbar-first-frame-integration-20261028-c/` |

先核对原归档／逐文件指纹及上轮构建产物指纹，再解到本轮`baseline/`，复制成`staging/`后只换DLL。两份本机目录各有43文件，staging版本仍是原快照，仅作整合预检，**不能当成另一个rc.53包安装或发布**。

## 依赖、入口和实际二进制内容

- 原deps的runtimeTarget为`.NETCoreApp,Version=v10.0/win-x64`，普通build产物为`.NETCoreApp,Version=v10.0`。选取各自实际target后，完整依赖图和libraries记录相等；差异来自RID发布形态，没有发现版本升级。
- build输出的8项依赖DLL全部与原包逐字节相同。固定runtimeconfig保持；不需要复制新的deps或runtimeconfig。
- 原包apphost保持原字节，并核对其内嵌`WallpaperProbe.dll`入口名。新旧程序集身份均为`WallpaperProbe,1.0.0.0`、Amd64，同一托管入口签名。
- 用`PEReader`读取新旧DLL，没有Assembly.Load或执行入口。19项程序集引用（版本及公钥标记）一致；2717项类型／字段／方法定义签名记录一致，包含私有和编译器生成成员，不能称为2717个公开API。
- 1490个有代码的方法中，只有`TaskbarHideRuntime.Create`的方法体不同；原捕获循环、参数解析、worker和帧／日志协议方法体保持。源码唯一行为差异是已审的10→0工厂门槛。

以上支持保留旧apphost／依赖的静态兼容结论，**尚未通过旧apphost实际启动新DLL**，也没有验证Windows捕获、Shell和连续出帧。新build的EXE、deps、PDB不进入整合白名单。

## 跨语言协议检查

持久入口在`dsh-whale-mist/qa/taskbar-first-frame/`：`preflight.py`、`IntegrationProbe.cs`、`host-preflight.test.mjs`，命令见同目录README。

| 本轮检查 | 实际覆盖 |
| --- | --- |
| 14项纯原生／Runtime检查 | 链接已审原生源码：日常／预览／回退参数、重复／未知／无归属／模式／时长／FPS拒绝、FramePipe封装、真实工厂0门槛及Runtime确认／未确认终结 |
| 11项固定Host检查 | 导入解包rc.53的真实JS：拆分帧解码、坏magic／截断拒绝、三种启动参数、真实Journal／Runtime样本接纳、周期状态不能替代终结、未确认拒关、未动作安全关闭 |
| 3种真实Host argv往返 | 从上述Host实例收集日常、预览和关闭隐藏开关的实际argv，再交给真实C# CaptureArguments解析，分别保持forever、taskbarHide、pipe和精确location |

回放调用纯FramePipe／ProbeJournal／Runtime代码，窗口probe、进程与原生调用是替身。WHL1样本的JPEG内容仅4字节标记占位，用来验证封装／拆包，**没有图像解码或画面验收**。Status／Summary来自Runtime，捕获记录的帧数等为夹具输入；不是现场采集日志。

不直接执行WallpaperProbe的`--parse-check`或`--self-test-pipe`：冻结Program中这些入口位于`EnsureDefaultDesktop()`之后。本轮只运行另建的纯检查程序，避免把名称像自检的入口误当成零桌面操作。

最终Inspector编译0警告／0错误；4个直接子阶段均退出0、未超时，父控制阶段总截止120秒，子阶段40／12／20／8秒。没有后台常驻等待、应用请求或真实worker进程。

## 失败留档及保护

a轮检查工具遗漏嵌套类型的父类型名，导致元数据键重名，未进入Host检查；修正为完整嵌套名。
b轮夹具将mode传在错误层级，Host按既有默认预览处理，两个“日常”断言失败；修正夹具为实际`scene.mode`契约，没有改Host或放宽断言。a／b证据保留，最终c轮独立输出通过。

361项既有保护输入和原18份留档保持；共享生产assets、版本、日常Profile／媒体、原WE及公开GitHub／npm归档未改。无提交推送、清理或跨会话派发。

## 下一小步

准备供本机短验的新候选：使用原固定rc.53运行文件，只替换上列DLL，并单独处理新候选的版本／说明元数据；不能覆盖同版本原包、公开附件或npm版本。继续保留固定rc.53读取就绪／诊断、UI、图库和关闭门禁，不从共享Trace树整体构建。

本轮没有生成这个候选。后续先核包，再按届时方便确认、新备份、临时安装与回退约定做限定任务栏观察；分别验入口停留／短闪、连续播放、停止和清理。离线通过不等于创建期零闪现，不能直接替换日常或转为公开发布。

同日后续：[rc.54候选及新短验工具已准备](RC54_TASKBAR_FIRST_FRAME_CANDIDATE_20261028.md)，尚未安装。上文“本轮未生成候选”保留为本次整合预检结束时的阶段记录。
