# rc.55阶段计时诊断候选与全新短验工具就绪

后续状态：[临时实测已完成并恢复rc.53](RC55_TASKBAR_STAGE_TIMING_SHORT_TEST_20261029.md)，用户确认恢复正常。本轮旧工具已关闭；下文“尚未安装／待确认”为准备时记录。

2026-10-29。用户要求继续后，已生成单独版本的本机诊断候选并核包，准备全新备份／恢复／日志收集工具。**当前尚未安装、没有真实实机授权或生产备份；日常仍是DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2。**

本候选只为取得[阶段计时](TASKBAR_STAGE_TIMING_OFFLINE_REPAIR_20261029.md)，不是修复创建期闪现或提升性能的新版日常；没有改变原任务栏动作时机、owner／style、首帧、停止及清理围栏。未发布GitHub／npm、提交推送、清理或派发。

## 固定候选

| 项目 | 结果 |
| --- | --- |
| 版本 | `dsh-whale-mist@0.6.0-rc.55`，private=true |
| 本轮原包 | `.tmp/rc55-taskbar-stage-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.55.tgz` |
| SHA256 | `0D93C59FF1D5E408C3763439A8197CC69F8054CC23064FDDC6A0B3FB6D60FC29` |
| 大小／文件 | 7,265,382字节／43文件 |
| 相对固定rc.54差异 | `assets/wallpaper/WallpaperProbe.dll`、`package.json`仅版本、README最前候选说明 |
| 原样保持 | 另外40文件、全部23份JS、其余13项资产，包括原apphost／deps／runtimeconfig和8依赖DLL |
| 实测后默认回退 | 固定rc.53，SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`，配合届时新备份 |

底座为固定rc.54原包，SHA256 `D9E28918522C3ABFF974465D53604583BAC520806D388EAE773F84BCDAF2F096`。唯一运行资产替换为已完成[固定包兼容预检](TASKBAR_STAGE_TIMING_INTEGRATION_PREFLIGHT_20261029.md)的M1 DLL，SHA256 `2C2C1FFEF7D0B491ED4EA68BC63FD60C32D58338DB2E008CD19938EC1EF4BB5F`。没有重编原生源、复制新build启动器／依赖或整体打包共享rc.30／Trace树。

持久配方、README前缀、全43文件清单、审计快照及工具配方在`release-sources/rc55/`。除了版本，manifest声明、SDK／peer范围、scripts与files等全部保持。没有执行npm或包scripts。源包／旧包／已发布载荷均不覆盖。

## 实际归档与保护

在全新a／b两个目录独立运行配方，tar／gzip字节完全相同，b为固定原包。重读实际tgz，逐文件内容及模式与预期比对，解到独立目录再核对，拒绝重复、越界或意外成员。只含固定43项，不加入QA、原生日志、截图、Profile、PDB、新EXE或额外计时文件；计时文件将在未来真实运行的日志目录产生。

打包前后361项保护输入保持；前次预检的QA、staging、源DLL等指纹保持。70项新回归／41项既有回归，以及14原生／17Host／3argv兼容证据由未改变的代码／DLL继承，没有机械重复测试或累计成新的实机数。全部23份JS字节相同，本轮不重跑浏览器／UI套件。实际旧apphost加载和阶段耗时仍待后续实机。

证据：b目录的candidate-audit.json、package-manifest.json、independent-rebuild.json和unpacked/；两个builder均正常退出0。

## 新轮工具与离线门禁

新轮目录：`.tmp/rc55-taskbar-stage-short-trial-20261029-a/`。新备份目标：`C:/Users/HP/.dsh/backups/rc55-taskbar-stage-short-trial-20261029-a`，目前不存在。

36个模板从今天已关闭的视觉短验轮按固定哈希复制，仅更改新根／purpose／候选版本、原包及哈希、备份路径；日常回退rc.53保持。保留先前已审的playing快照绑定，不复用失败的final快照。新增一个授权门禁后的日志收集脚本及runner入口。没有复制旧authorization、备份、端点、PID／HWND、运行结果或关闭证明。

准备阶段的27个PowerShell脚本解析、Python／Node语法、10授权对象、5恢复精度、7播放／清理绑定用例通过；20个无授权运行入口全部拒绝，23个runner引用闭合。三个准备子阶段退出0、无超时，准备总截止90秒；当前config仍`profileWritesAuthorized:false`，没有实机授权或生产备份，也没有查询日常应用、进程／窗口或读写当前Profile。

新增收集器13项纯夹具检查通过：同一时钟阶段差、缺项为空、缺失／损坏计时文件、异目标／异角色、100ns启动时间不匹配、异常时钟、负数、同轮日志绑定和错HWND拒绝等。只读写自建夹具，未读真实应用日志。

收集器在未来成功snapshotPlaying和verifyLiveCleanup后，绑定location／HWND／源PID及capture PID，将六份原生日志和可选的两份计时文件留存。计时目标启动时间以100ns精度匹配action；不同进程elapsed不直接相减，缺失仍未知。clockId里的worker PID只作自报诊断元数据，不宣称独立核验。收集结果不是清理许可或图标视觉消失时间，也不是“未启动”证明。

## 下一步真实短验边界

1. 先取得当时方便、无任务、暂停其它助手、播放停止及菜单正常退出确认；不要先重开，原WE保持。当前候选准备许可不代替当时的安装／实机确认。
2. 才在新轮创建授权、查询关闭状态并新备份当前安装、Profile、关闭状态外观存储、媒体和布局。安装后先核包、layoutAfter、关闭状态runtime，再重开。全程不复用前两轮备份或PID／端点。
3. 助手代点一轮Lucy、日常模式、自动播放本轮关闭，不改作者或外观值。目标观察约20秒，及时取得成功playing证明并正常停止；不为等用户反馈延长播放，不重复试播。任务栏观察只记实际看到的情况，不凭API或计时替代。
4. 清理核对后收集当前日志／计时；若计时缺失如实记录未知，若收集失败保留错误，不放宽恢复门禁或借诊断成功声称可清理。
5. 正常退出、严格played恢复检查、留存测后数据、恢复rc.53与本轮原设置／媒体／布局并重开核对。默认不留rc.55日常，不公开发布；旧轮最终close-out后不得重跑。

本轮只完成候选／工具准备。没有实机数据，不预热worker、变更owner／TOOLWINDOW／SW_HIDE或移除监督。取得阶段时间后再决定优化路径，TS随后、UI保持、三体暂缓。
