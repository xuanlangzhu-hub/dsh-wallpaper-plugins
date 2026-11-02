# rc.54 任务栏首帧候选与短验准备

2026-10-28。用户继续授权后，已生成本机rc.54候选，并准备新一轮备份／恢复工具。**尚未安装或操作日常DSH／WE，日常仍rc.53；没有公开发布。**

后续状态：[本轮实测和恢复已完成](RC54_TASKBAR_FIRST_FRAME_SHORT_TEST_20261028.md)。取得新鲜退出确认后临时安装，技术链路通过；用户离开期间任务栏视觉仍待确认，已恢复并重开rc.53。下文“尚未安装／待确认”保留为准备时快照，旧工具轮已关闭。

## 固定候选

| 项目 | 本轮结果 |
| --- | --- |
| 版本 | `dsh-whale-mist@0.6.0-rc.54` |
| 归档 | `.tmp/rc54-taskbar-first-frame-candidate-20261028-b/dsh-whale-mist-0.6.0-rc.54.tgz` |
| SHA256 | `D9E28918522C3ABFF974465D53604583BAC520806D388EAE773F84BCDAF2F096` |
| 大小／内容 | 7,261,395字节／43文件 |
| 底座及默认回退 | 固定rc.53，SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA` |
| 差异白名单 | `assets/wallpaper/WallpaperProbe.dll`、`package.json`版本及`README.md`候选说明 |
| 原样保持 | 其余40文件、全部23份JS、14项资产中的另外13项，原apphost／deps／runtimeconfig及8项依赖 |

使用固定rc.53和[已审的首帧DLL](TASKBAR_FIRST_FRAME_INTEGRATION_PREFLIGHT_20261028.md)，未重新编译原生源或从共享rc.30／Trace树整体构建。DLL SHA256为`6313602FE6CB8E8A80DCB93BE0D3D44EF8E961CCA1B7CC10E8F4F1AD5CCCD37D`。

持久配方、候选说明前缀、全43文件清单和审计快照位于`release-sources/rc54/`。仅候选副本版本改为rc.54；共享manifest／生产assets、固定rc.53快照和所有旧归档保持。候选保留`private:true`、原DSH rc.3精确兼容声明及peer范围，没有调用npm或执行包scripts。

## 实际归档核验

`build-candidate.py`按原43文件白名单、原文件模式生成确定性tar／gzip，再重新读实际tgz并逐文件／模式比对，另解到独立目录核对。a／b两独立输出的归档逐字节相同，b为本轮使用原包；未覆盖a或旧包。

除了版本字段，manifest结构、SDK声明、bundle、peer、files与scripts保持原值。新增README最前面标明rc.54范围、当前日常rc.53及旧说明为历史；旧正文作为来源保持。QA、PDB、新build apphost／deps、临时日志、截图和Profile不在包中。

上轮41项策略／Runtime回归，以及14纯原生、11固定Host、3种实际argv往返检查的代码／DLL字节没有变化，本轮按指纹继承这些证据，**没有重新执行或累加成新的检查／实机数**。当前实际归档23份JS与固定rc.53相同，不为版本／说明变化重跑UI和浏览器套件。实际入口与捕获效果仍待短验。

证据目录b含`candidate-audit.json`、`package-manifest.json`、`independent-rebuild.json`及`unpacked/`。配方输入核对361项保护指纹，打包前后均未变化。

## 新一轮短验工具

工具目录：`.tmp/rc54-taskbar-first-frame-short-trial-20261028-a/`。候选固定为上表b轮，回退固定rc.53；新备份目标为`C:\Users\HP\.dsh\backups\rc54-taskbar-first-frame-short-trial-20261028-a`，**当前未创建**。

`release-sources/rc54/prepare-trial.py`只复制上轮实际使用后的34个明确脚本模板，固定源指纹在`trial-template-hashes.json`。适配新根、purpose、版本、包指纹及备份路径；不复制旧authorization、备份、端点、PID／HWND或通过结果。已保留身份时间精度、恢复前负证据、末轮播放对象绑定、媒体／布局恢复和有界runner；不改备份／恢复行为。

本轮config为`profileWritesAuthorized:false`，没有真实authorization。确认方便及正常退出后，才现取关闭证明、原WE身份和当时数据，创建本轮新备份；不能复用历史退出状态或覆盖旧备份之后新增数据。

纯离线准备检查全部通过，见工具目录`offline-preparation-report.json`：

- 25份PowerShell解析，Python／Node语法检查；
- 10项内存授权对象、5项恢复身份精度／负证据、7项末轮清理绑定检查；
- 17个安装／备份／恢复／采样入口在缺少本轮授权时拒绝，未查询进程／窗口或生产写入；
- 22个runner脚本引用闭合，两个43文件归档的版本／指纹与config一致，34份源模板和361项保护输入保持；
- 两个父监督准备阶段均退出0、未超时；阶段10／55秒、控制总截止80秒。没有常驻脚本或无限等待。

这些是工具解析和门禁检查，**没有实际执行本轮生产备份或恢复**。所有未来Profile、外观存储、媒体和布局数据必须在取得本轮退出确认后新备份。

## 拟定的限定短验

1. 当时方便／无任务并正常退出后，核对本轮固定包和当前关闭状态，新备份日常安装、Profile、关闭状态存储、媒体／布局及原WE身份，再临时安装rc.54。
2. 助手代点一轮Lucy，日常模式、关闭自动播放，不改外观／作者参数。观察源窗口任务栏入口是否仍出现及停留多久、连续播放约15–20秒，再正常停止。
3. 结合本轮原生动作时间、后续帧和最终worker／源清理证明记录结果。S_OK不算任务栏视觉确认，时间戳推进不单独代表画面正常；看不清初始短闪就记录未知，不凭截图或API推断完全隐藏。
4. 异常即停止，不重试；保留测后数据，正常退出后恢复本轮rc.53和原设置，再重开确认。原WE不终止、不改全局任务栏设置。

本轮只准备包和工具，未建立实机授权、未安装、未退出／重开／采样日常应用或读写Profile，未提交推送、清理、打tag或发布GitHub／npm。下一步仅等待当时方便及正常退出确认；默认测后恢复rc.53，不自动保留rc.54日常。
