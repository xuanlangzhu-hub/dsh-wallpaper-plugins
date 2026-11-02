# D1：任务栏启动时序与首个发布帧方案

2026-10-28。**已确认当前原生工厂配置强制等待采集时钟满10秒，才允许尝试DeleteTab。** 本轮只完成时序审计和离线方案回放，未修改生产实现。下一小步是在隔离源上移除这段固定等待，仍在首个已编码、已发布帧之后执行一次异步动作；不能据此承诺窗口从创建起绝不出现任务栏按钮。

来源采用[D0审计](POST_RELEASE_DEVELOPMENT_BASELINE_AUDIT_20261028.md)确定的固定rc.53 Host与rc.39原生留档。日常DSH／WE、Profile、生产assets、发行物和版本均未操作。

同日后续：用户提醒后已追溯10秒来自C1前后对照实验，并完成[隔离补修与41项回归](TASKBAR_FIRST_FRAME_REPAIR_20261028.md)。下文“尚未修改／下一项补修”保留为本轮初始审计快照；隔离源已改，日常安装及共享生产源仍保持原样。

## 实际顺序

| 顺序 | 固定代码接点 | 含义 |
| --- | --- | --- |
| 1 | rc.53 `session.js`约946–1011；原生`SourceWindowHelper.OpenWallpaper` | 用唯一playInWindow名称启动WE源、找HWND并验证PID／启动时间；源窗口已先存在 |
| 2 | `session.js`约1019–1030 | 启动捕获helper，默认传`--taskbar-hide`；已有环境退出开关保持 |
| 3 | 冻结`Program.cs`135–170 | 验证目标身份、创建Runtime和初始快照，再启动WGC；采集时钟在此阶段启动，不是源窗口创建时钟 |
| 4 | `Program.cs`238–268 | 编码、写入帧管线后，将hash、published、stop及采集经过秒数传入AfterFrame |
| 5 | `TaskbarHideRuntime.cs:61`；Strategy OnFrame | 工厂显式`MinSeconds:10`；未编码／未发布／停止均不能派发，未满10秒继续等待 |
| 6 | Strategy异步派发／TaskbarWorker | 身份和可见性重验后，在独立worker中调用DeleteTab；采集线程不等待Shell动作完成 |
| 7 | Runtime Finish／CanCloseOwned及Host关闭围栏 | 停止与worker退出须有终结证明；不确认的动作不能被当成已干净关闭 |

因此本轮可证实的是**软件主动保留了一个采集开始后的10秒下限**。源窗口创建到WGC开始、首次编码和管线发布另有耗时；不能把该10秒说成整个可见期的精确测量。

[rc.27实测](RC27_TASKBAR_DESKTOP_ACCEPTANCE_20261014.md)已记录初始入口出现、约10.027秒动作后移除；当时没有承诺从不出现。[非阻塞短验](C1_TASKBAR_NONBLOCKING_SHORT_TEST_20261013.md)解决的是动作阻塞采集。两者均应保留，不能为提前触发恢复同步COM调用。

## 方案边界与依据

Windows公开文档说明[DeleteTab移除既有任务栏项](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist-deletetab)。这不是创建窗口时的禁止显示策略，S_OK也不是视觉验收。
[Shell任务栏文档](https://learn.microsoft.com/en-us/windows/win32/shell/taskbar)另列出TOOLWINDOW或隐藏owner等方式，但会改变窗口属性／归属；本步不混入此类改动。
本次查到的[WE命令行公开选项](https://help.wallpaperengine.io/en/functionality/cli.html)包括playInWindow、位置、尺寸与borderless，没有列出隐藏任务栏开关；这不证明不存在内部能力。

旧研究中组合改变style／位置后失败，不足以推出“WGC普遍禁止所有TOOLWINDOW”。也不能为省去一次短闪，直接修改原WE或未知窗口。当前选择风险较小、可单独证伪的第一步：**首个已发布帧后尽早移除**。

## 本轮离线反馈环

证据：`.tmp/taskbar-postrelease-audit-20261028-a/`。

- `replay/Replay.csproj`链接冻结的真实Strategy／Runtime／Worker／WindowIdentity等类；窗口查询与Shell执行用底层IO替身。
- 只构造真实Runtime工厂并反射读取配置，**不调用其真实probe、初始窗口快照、Finish或CanCloseOwned，不执行其worker闭包**；另建真实Strategy注入替身执行回放。
- **17项通过，重复一次结果一致**，不是34项。覆盖工厂真实10秒、50ms／9.999秒不触发、10秒仅一次、拟议MinSeconds=0仍拒绝未编码／未发布／已停止／隐藏源／身份检查异常、首个发布帧触发一次、异步未完成时后帧继续、终结未确认阻止清理。
- 其中身份异常与Shell成功都是替身输入，不是实际PID重用或COM回归。序列化视觉字段保持null，没有把假S_OK写成已隐藏。
- 拟议0秒配置只施加在测试实例，生产工厂仍为10秒。
- net10.0测试工程编译0错误、6条CA1416平台警告：链接类包含Windows专用方法，本轮不执行这些方法。没有启动捕获、窗口、Shell／COM或应用。
- 构建有40秒父监督，回放每次12秒父截止；阻塞替身自身最多1.5秒释放／收尾。原始构建与运行stdout／stderr保留。

回放命令为`dotnet <证据目录>/replay/bin/Release/net10.0/Replay.dll`；不能把此工程当作生产原生发布工程。完整17项名称及结果在`trigger-replay.json`，汇总在`offline-summary.json`。

## 下一项：仅隔离源码补修，不打包或实机

1. 新建独立输出目录，从D0确认的18份rc.39原生源复制并冻结指纹。固定rc.53 JS／UI继续作为未来整合基线；不修改原留档、共享生产assets或版本。
2. 唯一行为改动优先为`TaskbarHideRuntime.Create`显式`MinSeconds:10`改为0，让既有encoded／published门禁决定首次尝试；不提前到StartCapture之前，不改变Strategy默认值或历史QA配置，除非有必要且另列依据。
3. 继续异步、一次动作、唯一目标身份复验、可见／非最小化／非cloaked条件、停止检查和worker终结／关闭围栏。已有关闭功能和`WM_WALLPAPER_TASKBAR_HIDE=0`回退开关保留。
4. 增加直接检查**修改后的真实工厂**的回归，防止只改替身选项就报修复；回放未发布、停止、迟到／挂起结果和终结不确定分支。实际身份与worker协议用适用的现有离线用例复核，不能只靠本轮替身。
5. 只作隔离编译与必要回归，设置父截止、保存失败、确认自有进程退出；无须先造新候选包。若引入未解释产物变化、依赖升级、Trace、apphost替换或无限重试，视为范围逸出。

本步验收：来源可追溯、行为差异可定位、真实工厂为新配置、上述门禁保持、保护输入无变化；如实保留尚未进行实机验收。不要把所有任务栏问题标记解决后直接转TS。

## 以后集中实测与回退

真实验证另需届时方便／无任务确认、新备份和固定候选核包。测量源创建、首帧、动作触发／结束各时间；观察初始入口是否仍短闪，连续出帧、焦点、正常停止及动作进行中取消分别验收，原WE保持。

若只缩短入口停留但仍闪现，结论就是“提前移除有效，创建期隐藏未解决”，再由用户选择是否研究owner／style，或接受限制后推进TS。失败回退使用届时新备份，不覆盖后续新增日常数据。此次没有安排或执行这些真实操作。
