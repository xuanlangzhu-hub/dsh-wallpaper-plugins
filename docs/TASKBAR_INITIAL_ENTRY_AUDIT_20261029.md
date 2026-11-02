# 任务栏创建期入口：调用顺序边界已确认，下一步只补阶段计时

2026-10-29。承接[本日视觉短验](RC54_TASKBAR_VISUAL_SHORT_TEST_20261029.md)后，用户要求继续。此次只读固定源、两轮留存证据、历史实验及官方文档，新增离线核对工具与本报告；没有查询当前窗口／进程、操作DSH／WE／Profile、安装构建或改动运行实现。

**结论：当前是“WE先显示普通顶层窗口，采集首帧后再移除按钮”。它允许初始入口出现；取消10秒等待不能变成创建起不登记。worker的3–4秒总体耗时尚未分解，不能据此认定COM慢，也不能保证单独加速worker就消除闪现。**

日常保持DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2，rc.54原候选及两个已关闭短验轮保持。公开GitHub／npm不变，没有提交推送、清理或派发。

## 验证方式与范围

真实症状来自今天用户确认“图标短暂出现后消失”，没有另开实机重现。离线工具`dsh-whale-mist/qa/taskbar-startup-audit/audit.py`读取两轮原始action／summary／播放身份／关闭记录，核对location、HWND、源PID、发布首帧、worker终结和源关闭事实，检查固定代码的实际调用顺序。

输出`.tmp/taskbar-startup-boundary-audit-20261029-a/result.json`：18份原生源码按原rc.39指纹及已审的一处rc.54工厂补丁验证，另核对固定rc.53 Host共19文件；8份相关源码冻结，361保护输入及10份运行证据在读取前后保持。脚本正常退出0，无子进程、窗口、COM、采集、编译或安装。它是可重复的证据／调用顺序核对，不是Windows Shell模拟器，不宣称修复已经通过。

## 三个假设及实际结论

| 排序与预测 | 离线结果 | 尚未知 |
| --- | --- | --- |
| H1：源先显示，后置DeleteTab无法保证首次不登记；若代码如此，移除入口应在源获取和首帧之后 | 已确认此顺序。两个源的初始事实均visible=true、owner=0、exStyle=0；今天用户观察到短暂入口 | 精确首次显示／Shell登记时间未记录，不能声称所有机器每次必闪 |
| H2：worker总体开销可能延长停留；若可分解，应存在进程启动、监督就绪、验证、COM前后的时间点 | 现有记录只有触发与整体完成、HRESULT／退出事实；无法拆分。没有取消监督门禁以换速度 | 各阶段耗时、实际DeleteTab返回时刻、视觉消失时刻 |
| H3：WE支持创建期不进任务栏的启动参数；若存在于官方接口，应有相应参数说明 | 已重新核对官方CLI，列出playInWindow、尺寸／位置、activate、borderless，没有列出任务栏／owner／toolwindow或预显示回调参数 | 不能从文档缺项推出所有内部版本绝不存在；不编造未记录开关 |

不另做矩阵实测：现有症状与严格固定源已足以说明调用顺序的能力边界；实际Shell时间和更改样式的兼容性没有离线可替代的视觉断言，后续需要时另起实机轮。

## 真实顺序与容易混淆的细节

1. 固定rc.53 `session.js`的注册路由默认`WM_WALLPAPER_OFFSCREEN_START !== '0'`，因此默认初始屏幕外。`create()`形参默认false及旧“先显示再移动”注释不代表路由的实际默认值，不能据此误判日常仍先开在屏幕中央。
2. `SourceWindowHelper.OpenWallpaper`调用WE的`-control openWallpaper -playInWindow`；初始屏幕外时加位置和`-borderless`。插件本身没有在WE创建该HWND之前设置owner或扩展样式的接点。**屏幕外坐标与无边框都不等于不具备任务栏登记条件。**
3. Host等待源窗口和打开命令的结果、绑定HWND／PID／进程启动时间，然后才spawn采集helper。源PID两轮都与原WE相同；这是WE复用进程，不能为这个目标终止该进程。
4. 原生先验证目标、记录初始状态、创建D3D／WGC捕获项、StartCapture，再处理有效帧。rc.54真实工厂MinSeconds=0，但保留encoded／published及停止门禁；随后异步Task.Run进入验证与worker执行。
5. worker启动后须由父进程绑定Job并授权，worker检查父生存及授权，然后STA内验证目标→创建COM对象→HrInit→再次身份／停止校验→DeleteTab→释放／报告，父再确认退出并取结果。这条链上有多种未计时的步骤，不可全算成Shell耗时。

source-order的文件和行号写在result.json.facts中。源码中的自检／--taskbar-worker入口之前还调用EnsureDefaultDesktop；本轮没有直接运行那些入口，也未因其名称叫self-test就当纯离线执行。

## 两轮留存时间，分别解释

| 留存轮次 | 首帧采集时钟 | 点击→首帧壁钟差 | 首帧触发→worker总体完成 | 点击→worker完成壁钟差 |
| --- | --- | --- | --- | --- |
| 10月28日 | 0.119s | 3.860s | 4.203s | 8.138s |
| 10月29日 | 0.120s | 3.461s | 3.331s | 6.868s |

点击与原生capturedAt／completedAtUnixMs均为留存的同机壁钟时间，差值只能作这两轮的报告偏移；不是QPC级端到端测量，更不是窗口创建或任务栏显示的时间。worker完成包括监督和退出，DeleteTab可能更早已经生效。没有量化视觉消失，也没有rc.53同条件对照；不能宣传“停留从8秒优化到6秒”。原始taskbarHidden／altTabHidden继续为null。

在飞期间122／96帧及动作后125／99序号，支持动作没有强迫整个采集循环等到worker完成；不支持屏幕FPS、主观流畅度或所有壁纸兼容承诺。

## 官方依据及历史实验

- Microsoft [The Taskbar](https://learn.microsoft.com/en-us/windows/win32/shell/taskbar#managing-taskbar-buttons)说明任务栏与顶层窗口ownership／扩展样式有关，并给出创建时TOOLWINDOW或隐藏owner的办法；动态改变相关样式另有隐藏／显示顺序要求。**这是Win32机制，不是WE给调用者提供了创建前接点。**
- Microsoft [DeleteTab](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist-deletetab)定义按HWND删除任务栏项目；没有承诺调用之前未出现过，也不等同Alt-Tab排除。
- [WE命令行](https://help.wallpaperengine.io/en/functionality/cli.html#open-wallpaper)有位置、边框等选项，没有文档化的notaskbar或预显示owner控制。这里只报告公开接口范围。
- Microsoft [SetWindowLongPtrW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowlongptrw)的GWLP_HWNDPARENT用于顶层owner，不能与SetParent混用；从外部拿到HWND后再设owner仍存在源已显示／Shell已登记的先后竞争，不能自动承诺零闪现。
- [CreateForWindow](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow)页面没有“所有TOOLWINDOW永远不能捕获”的普遍规定。历史本机失败是SW_HIDE后重建捕获项，以及TOOLWINDOW／去APPWINDOW／旧负坐标／固定尺寸的组合改动后重建捕获项，不能扩大成所有样式或已运行WGC会话的定律。见[旧研究的准确边界](TASKBAR_HIDE_RESEARCH_20261012.md)。

## 方案比较与选定的下一小步

| 方向 | 能改变什么 | 本轮判断 |
| --- | --- | --- |
| 补worker／启动阶段计时 | 区分当前停留的可优化部分；不改变采集或任务栏动作 | **选为下一小步，仅隔离诊断补丁与离线回归** |
| 首帧前预启动受监督worker，首帧后才放行动作 | 有机会隐藏worker冷启动开销，仍不能消除已先显示的窗口 | 等阶段计时证明有收益再考虑；不能先绕过首次发布门禁或去掉退出围栏 |
| 获取源HWND后改为隐藏辅助owner | 可能改变后续Shell行为；增加跨进程／生命周期、最小化、清理与WGC兼容验证 | 尚未实施；不是创建前防登记的证明，不绑定DSH或原WE已有窗口为owner |
| SW_HIDE／TOOLWINDOW／隐藏后重显 | 改变可见性或样式 | 有历史失败及兼容风险，本轮不采用 |
| WE自身在首次显示前设置合适owner／style | 对严格的创建起不登记目标才有直接控制意义 | 当前公开CLI没有此接点；不能靠当前后置API保证它，不做注入／Shell全局钩子或修改官方WE |

### M1：诊断补丁的最小验收契约

下一轮从已验证18份rc.54隔离原生源开始，固定rc.53 Host／UI／资产与当前候选；先只补以下阶段事实，不同时优化启动、改owner／style、改首次动作时机或升级依赖。

- 父侧：动作调度、准备Start、Process.Start返回、Job绑定／监督授权、退出观测、结果解析完成。分别记录发生与未发生，不把超时或缺失当0ms。
- 子侧：受监督worker入口、授权完成、每次身份检查前后、COM对象创建前后、HrInit前后、DeleteTab前后、释放完成／结果输出。目标location／HWND／PID／StartUtc与轮次继续绑定。
- 各进程自身用单调计时记录持续时间，明确clock／origin；跨进程相关性另留UTC和进程身份，不相减两个不同起点的elapsed。计时是诊断信息，不是视觉消失事件。
- 保留原HRESULT、异常、父丢失／停止、Job、30秒worker截止及退出确认、初始身份、published首帧、一次异步动作与关闭围栏。诊断缺失／落盘失败不能被当成安全终结，也不能新增成功假象。
- 数据有界、只在这些阶段记录，不每帧枚举窗口或额外开进程。不能往二进制帧stdout插入JSON；不能让中间计时JSON冒充worker终结结果。新诊断字段／文件的消费保持兼容，不改变现有清理依据。
- 离线用真实动作／worker监督代码和底层IO替身，覆盖成功、HrInit失败不调用DeleteTab、二次身份变化、停止／父失联、启动或Job失败、超时／退出不确定、结果缺失与迟到、计时写失败；以注入时钟验证阶段顺序及未知值，不用扩大期限解释挂起。

交付是来源指纹、隔离补丁、构建和适用回归、未触碰保护输入的证明。**不直接生成候选、安装、启动新一轮观察或修改日常。** 真正采取加速／owner方案或新增实机前，再依据计时和用户范围决定；本轮没有宣称这些尚未实现的方案有效。任务栏优先，TS随后，UI保持、三体暂缓。
