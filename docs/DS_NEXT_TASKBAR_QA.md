# 给 DS：C1 任务栏按钮移除 QA 准备（先不实测）

## 目标和完成边界

先读[调查记录](TASKBAR_HIDE_RESEARCH_20261012.md)、[rc.26验收](RC26_SELECTION_SAVE_REPAIR_20261012.md)和AGENTS.md。
开发工作区是`F:/dsh-wallpaper-plugins`；本机日常仍rc.24，源码候选rc.26修正未提交。
保留现有改动。本轮只准备**可编译、可离线检查的独立QA helper**，测试C1的ITaskbarList::DeleteTab路线。
不要求解决Alt-Tab，不承诺完全隐藏，不重新做旧hide/TOOLWINDOW矩阵。

## 可修改范围

- 新目录`dsh-whale-mist/qa/taskbar-hide/`：生成/构建脚本、TaskbarList封装、实验策略、离线检查和README。
- 新交付记录`dsh-whale-mist/docs/TASKBAR_QA_DELIVERY.md`。
- 不改src、accepted原生源码、assets、package.json/版本、SDK、Profile、外观存储、活动tgz或历史证据。
- 不安装、不退出/重开DSH、不调用真实WE、不创建任何真实窗口、不调用真实DeleteTab/AddTab。
- 不提交/推送、不清理Temp；构建和离线检查输出放全新`.tmp/taskbar-hide-qa-*`目录。

## 实现要求

### 隔离构建

可以参考`qa/adapter-probe/build.mjs`的隔离生成方式，但不导入其选卡实验。
读取当前accepted源码，生成独立`WallpaperProbeTaskbarQa`项目；不修改原文件、不覆盖生产二进制。
记录所有输入源码和accepted资产哈希，构建后再次核验未变；生成锚点必须恰好命中一次，否则停止。
使用结构化文件写入/apply_patch，不继续用PowerShell多行替换去修数百行文件；每次改C#后尽快编译。

无QA参数时保留当前捕获行为。实验必须显式启用，限制为有限时长的JPEG出帧模式（memory或pipe），拒绝forever及不编码帧的模式。
新选项先严格提取/验证再交既有CaptureArguments；未知、重复、矛盾或缺身份参数均拒绝，不能误改位置参数。
自检入口必须在桌面/WGC/COM初始化之前返回，不调用EnsureDefaultDesktop、窗口枚举或Shell接口。

### 操作接缝和身份

源创建/关闭继续由将来的受监督控制方执行，使用本轮唯一`WhaleWallpaperProbe-...`location。
QA显式要求HWND、精确location、源PID及StartTime绑定；数值类型和时间格式自行选定并在README说清。
不接受只匹配标题前缀。DeleteTab和恢复前都检查目标仍存在、同名唯一、HWND/PID/StartTime一致且进程为wallpaper64。
直接复用VerifyExpectedWindow的强校验（waitMs=0），另补StartTime；不复制旧弱验证入口当授权。
已最小化/不可见/cloaked时拒绝动作并记录，不自动还原/显示它；尺寸和位置以当前原样保存。

### 一次调用与有界清理

默认总时长25秒（不超过60秒），同一capture item/session不重建。
至少正常运行5秒且已完成有效JPEG编码/发布后，核验身份并尝试**一次**DeleteTab。
不改WS_VISIBLE、TOOLWINDOW、APPWINDOW、owner、父窗口、位置、大小、Z序；不发激活/隐藏/最小化命令。
触发点放在一个有效帧完成后；不能在session.StartCapture或仅started日志出现时就把“已出帧”判成真。

COM封装按官方顺序保留HrInit/AddTab/DeleteTab/ActivateTab/SetActiveAlt槽位，保留HRESULT并正确释放接口。
固定COM初始化/调用/释放在线程策略内；不要让await后的线程切换含糊地依赖当前公寓。
HrInit失败不调用DeleteTab；不调用ActivateTab/SetActiveAlt来做试验。

动作失败记独立failure，不自动再试；保留采集或安全有界结束，把真实情况写出。
本次源是一次性测试资源，恢复方式是结束采集并关闭本轮location；**不调用AddTab**、不增加按钮恢复/再次删除矩阵。
启用QA时必须接收明确的owned-location：停止/到期/异常/父断开都在外层finally有界关闭本轮源，正常生产模式保留原行为。
外层清理要覆盖CreateItem之前的异常；在清理前验证同一HWND/PID/StartTime/location，仅对一致目标调用既有有界关闭。
目标已关闭算已结束；身份变化/无法确认则不关闭别人的窗口，写cleanup未确认并非零结束，由受监督控制方复核。
控制方最终确认源已消失。不得为“清理成功”结束原WE进程，或拿其它同前缀窗口代替本轮目标。

### 输出与离线检查

独立输出taskbar-action.json（或jsonl）：实验是否启用、第一次有效帧/动作时间和序号、HrInit/DeleteTab返回值、
每次操作身份、窗口前后属性、关闭结果和失败。标准pipe stdout仍只有帧协议，诊断走stderr/独立文件。
没有视觉观察时taskbarHidden/altTabHidden必须为null/unknown，不能由HRESULT或窗口样式推断true。
采集日志/summary保留原义，不把动作成功算播放通过，不把调用前旧帧重复统计成调用后动态帧。

用真实策略状态机配注入的窗口/COM/时钟假边界，至少覆盖：

1. 无flag零操作；有效帧和5秒两条件满足才调用，后续帧不重复。
2. 正常HrInit→DeleteTab；API错误保留；COM释放在成功/异常下都发生，不调用AddTab/ActivateTab。
3. 非法/重复flag、forever、非JPEG模式、缺身份拒绝。
4. wrong location、复用HWND、PID相同但StartTime不同、同名多窗、目标关闭均无Shell动作。
5. 操作前已停止、无有效帧、不可见/最小化/cloaked均不删除按钮。
6. 关闭失败、关闭前目标消失/复用、父断开/异常（含CreateItem前失败）的清理归属和有界退出。
7. fake返回S_OK时视觉结果仍unknown，不能由假边界宣称Windows实际隐藏。

只运行构建、解析和这些无窗口自检。不要重跑GPU/35分钟/真实窗口流程。
不必为文档或文件整理增加重复测试，重点是动作与身份/清理边界。

## 交付后停下

提交简短交付记录：改动文件、构建/检查命令与退出码、新输出目录、QA EXE/DLL哈希、accepted源码/资产未变、
未调用真实Shell/WE/DSH以及已知不足。最多说明一条后续路线，不堆自我反省，不把真实隐藏写成已通过。
如果编译或边界检查仍失败，明确标失败并保留原始输出；不要绕开要求或自动增加owner/TOOLWINDOW方案。

交Codex审查后才另约用户实测。第一轮人工观察任务栏、Alt-Tab、窗口闪出/焦点及桌面正常，约一分钟；
若C1通过再安排正式Host接入和更长生命周期检查，未获新授权不自行进入下一阶段。
