# M1任务栏阶段计时：隔离补丁与离线回归完成，尚未实机取数

2026-10-29。承接[创建期入口调查](TASKBAR_INITIAL_ENTRY_AUDIT_20261029.md)，用户要求继续。**已完成隔离诊断补丁：区分worker启动、授权、身份验证、COM创建／初始化／DeleteTab／释放、结果和退出的阶段记录。没有改变任务栏动作时机或窗口owner／样式，未重新安装或操作日常DSH。**

最终证据为`.tmp/taskbar-stage-timing-20261029-b/`：70项计时／失败分支检查、41项既有首帧／Runtime／清理回归通过；完整19输入原生工程编译0警告／0错误。六个直接子阶段退出0，均确认退出、无超时；总截止180秒。它们不是真实窗口、Shell或视觉验收，现有3–4秒耗时尚未取得新分段数据。

日常保持DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2，原rc.54候选和固定rc.53归档不变。未提升共享rc.30／Trace树、版本或生产assets，没有生成新候选、安装、公开发布、提交推送、派发或清理。

## 固定来源和准确差异

持久配方与QA：`dsh-whale-mist/qa/taskbar-stage-timing/`。

- `prepare.py`核对原rc.39的18输入指纹，保留已审rc.54的Runtime工厂MinSeconds=0及两行说明，然后只在新的`.tmp`副本上增加诊断。
- 相对rc.54，改动既有五文件：`Program.cs`、`TaskbarHideRuntime.cs`、`TaskbarHideStrategy.cs`、`TaskbarWorker.cs`、`TaskbarList.cs`；新增`TaskbarTiming.cs`。其余13个原生输入逐字节复制，不做换行归一化。
- `isolated/native.patch`为五文件相对rc.54的差异；`source-receipt.json`固定原输入、输出、配方、QA和补丁哈希。
- 原Host、UI、首次读取／诊断、图库、媒体和依赖保持。没有将构建生成的apphost／deps／PDB复制到包或日常。
- 最终隔离DLL SHA256：`2C2C1FFEF7D0B491ED4EA68BC63FD60C32D58338DB2E008CD19938EC1EF4BB5F`。这是本轮构建产物，尚未做固定包整合预检或安装验收。

## 诊断数据和成功证明分离

两份独立sidecar均明确`purpose=taskbar-stage-timing-not-termination-proof`：

| 文件／时钟角色 | 记录范围 |
| --- | --- |
| `taskbar-parent-timing.json`／capture-parent | Runtime创建、动作调度／执行器进入、worker.Start、实际Process.Start、Job创建／绑定／监督信号、退出观测、结果读取、必要时终止／退出不确定、资源释放、Runtime结束时快照 |
| `taskbar-worker-timing.json`／shell-worker | .NET托管入口的desktop检查前后、原监督授权完成、调用前／后两次身份验证、COM对象创建、HrInit、DeleteTab、释放、结果输出／入口返回 |

“入口”是托管代码达到记录点，不是操作系统创建进程瞬间；目前没有Host点击或WE窗口首次显示的新事件，也没有Shell视觉事件。捕获父侧记录结束不等于worker或源已经安全退出。

每份记录含独立clockId、单调时钟frequency／originTimestamp、originUtc、目标location／HWND／PID／StartUtc。进程内计算两次已出现阶段的差；不把两个进程不同起点的elapsed直接相减。记录前先作整数差，避免高数值时钟丢失小增量精度；倒退、时钟异常和未到达阶段保留未知，不能补0。

原`CallTrace`／`WorkerOutcome`和`taskbar-action.json`终结协议未加入计时成功字段；清理围栏和Host不读取sidecar。worker记录在监督授权前只进内存，只有原授权检查成功才允许写文件。早期拒绝／父丢失／崩溃可能没有worker sidecar，不能由此推出“未启动”或“可清理”。

记录最多64事件，不逐帧记录或枚举窗口。落盘仅一次、create-new、无覆盖／重试／创建目录；不会把阶段JSON写到帧stdout或插进worker终结JSON。现有文件、缺目录、写入异常等只造成诊断缺失，保留原调用／清理结果。诊断快照不是原始失败或终结证据的替代物。

## 保持的运行边界

- MinSeconds=0、encoded／published首帧、目标身份／可见性复验和停止门禁保持；不是提前到首帧之前动作。
- 一次异步动作、持续采集、独立worker、原Job与父授权／父丢失、30秒worker期限及退出确认、源关闭围栏保持，没有预热worker或改owner／TOOLWINDOW／SW_HIDE。
- 原worker授权／父丢失方法体在剥除明确列出的计时语句后逐字相同；原HRESULT和异常路径、动作返回值及终结record声明保持。最终原生入口不在本轮执行。
- 工作区361项保护输入、18份原冻结输入、rc.53／rc.54原归档、QA输入在检查前后保持。新增逻辑只由持久配方材料化到隔离目录，没改共享原生实现。

## 覆盖与没有覆盖的部分

70项检查调用真实`ExecuteCalls`、`TaskbarWorker.Run`、Strategy与Runtime，替换底层COM对象／worker接口、窗口探针、时钟及输出sink。覆盖阶段先后、未知值、64事件上限、旧文件保护、未授权不写、只写一次、时钟异常／倒退／高值精度；成功、HrInit失败、两次身份变化、停止、创建／调用／释放异常；启动拒绝、启动后异常、绑定异常、读取失败、超时、取消、退出不确定及超时后不读迟到结果。真实Runtime的诊断文件IO失败也确认不改变原安全关闭结果。

旧41项回归在本轮新构建上运行，覆盖真实工厂与Runtime接线、首个发布帧、异步待决期间继续帧、迟到结果不能覆盖终结不确定、停止和清理门禁。

父进程失联和named-event授权的Windows实作未动态执行，只核对其原控制体未改；monitor的停止传播用可控回调覆盖。真实Start／Job绑定用源码接线与失败替身验证，未启动真实worker来测量操作系统耗时。worker最终协议读取在monitor边界注入失败，未声称重新实测私有进程读管道。故不能把111项视为完整操作系统协议或实机验收，更不能宣布图标闪现已修复。

## 过程偏差保留

初轮`.tmp/taskbar-stage-timing-20261029-a/`中68项新检查和41项旧回归、构建虽通过，差异复核发现准备脚本把七份未改源码的LF也转换为CRLF，超出五文件白名单。该轮不作为最终交付；修正为未改文件直接复制，加入真实字节差异断言，并补高值时钟精度及Runtime真实文件失败用例，在全新b目录重新构建／检查通过。a目录、日志和产物保留，没有覆盖或删除。

## 下一步：仅固定包离线整合预检

以固定rc.53运行载荷和已验rc.54行为为底座，核对新DLL与旧apphost／deps／runtimeconfig、依赖图和帧／worker协议，列出本诊断补丁预期的类型／签名变化，不能直接沿用上轮“定义签名全相同”的断言，也不能把意外变化全放行。确认sidecar不进入清理证明、没有新增标准输出污染；仍保留原Host／UI／媒体与旧资产。

此步不生成候选或安装。离线整合通过后再安排诊断候选和当时方便确认／新备份的实机取数；还没有真实分段数据，不能选择预热、删监督门禁或owner策略。TS随后，UI保持，三体暂缓。
