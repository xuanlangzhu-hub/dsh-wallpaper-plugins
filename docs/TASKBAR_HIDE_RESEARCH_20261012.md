# 源窗口入口隐藏：只读调查与第一轮方案

2026-10-12，Codex。rc.26已完成Lucy／绯雪手动短验；本机已恢复日常rc.24及测试前外观。
本轮只读源码、历史证据和官方文档，写接续范围，**没有安装、创建窗口或改变运行配置**。

## 当前目标与依据

目标是移除插件独立源窗口的任务栏按钮，继续WGC画面流。不是隐藏WE进程，也不是删除右下角原WE托盘图标。
任务栏、Alt-Tab、启动窗口闪出和焦点分别记录；其中一项通过不能代表全部隐藏。

当前创建路径在`dsh-whale-mist/src/wallpaper/session.js`：helper以`--initial-offscreen`请求正坐标屏幕外源，
`SourceWindowHelper.OpenWallpaper`传WE官方`-borderless`；WGC创建窗口捕获项后开始采集。
首个窗口状态到达Host时，若已屏幕外且身份/可见性正常，则保留现有尺寸，不反复移动。
rc.23用户确认白条消失、无主动闪窗/抢焦点，但任务栏入口仍在。rc.26未改变这条原生路径。

官方WE命令支持独立窗口、位置和无边框；当前[CLI文档](https://help.wallpaperengine.io/en/functionality/cli.html)没有列出独立窗口隐藏任务栏或Alt-Tab的参数。
这只表示文档未提供，不能推出所有版本内部都不存在，更不能编造开关。

## 历史失败的准确范围

旧矩阵原始记录：
`F:/deepseekharness/.tmp/wallpaper-window-modes-control-20261005/WhaleWallpaperProbe-20261005-tgl-021834/toggle-results.json`。

- `SW_HIDE`后另开采集：visible=false，0帧、非零退出；恢复显示后采集恢复。
- `offscreen-tool`后另开采集：visible=true，exStyle=0x180，0帧、非零退出；去掉该组合样式后恢复。
- `offscreen-tool`同时加TOOLWINDOW、去APPWINDOW、设置旧负坐标和固定尺寸；不能当成单独切换TOOLWINDOW的完整因果拆分。
- 旧运行是改窗口后重新创建捕获项，不能证明已运行会话上每一种入口处理必然失败。

旧README把本机实验结果写成普遍WGC限制，接续时按上述实际范围理解。
Microsoft [CreateForWindow](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow)
页面说明按HWND创建捕获项，未在该页给出“所有TOOLWINDOW永远不可采集”的完整规则。
本轮不重跑旧失败矩阵，也不把新路线当作已可行。

## 路线顺序

| 顺序 | 路线 | 本轮判断 |
| --- | --- | --- |
| C1 | 已出帧后，ITaskbarList::DeleteTab移除该HWND的按钮；保留可见性、owner和样式 | 首选独立QA，尽量少改变采集条件 |
| C2 | 隐藏的辅助顶层窗口作为可见源窗口的owner，必要时处理APPWINDOW | 仅后续候选；跨进程、最小化/销毁、Shell更新和WGC行为均待验证 |
| 后置 | 已建捕获项后再改工具窗口样式 | 暂不实现；既有失败和恢复风险较大 |

C1依据：[ITaskbarList](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-itaskbarlist)
支持动态改变任务栏项目，需先HrInit；[DeleteTab](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist-deletetab)
按HWND移除按钮。官方描述不承诺Alt-Tab排除、不承诺WE不会重新登记，也不承诺调用前按钮从未出现。
保留窗口状态可能降低对采集的影响，**这是待实测推断**。HRESULT成功只说明API调用成功，实际任务栏消失要用户观察。

C2依据：[任务栏说明](https://learn.microsoft.com/en-us/windows/win32/shell/taskbar#managing-taskbar-buttons)
把隐藏owner列为另一种办法；[SetWindowLongPtrW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowlongptrw)
的GWLP_HWNDPARENT用于顶层owner，区别于SetParent。辅助owner不直接选DSH或原WE窗口，以免带入宿主最小化/退出耦合。
这不是本轮编码许可；C1失败后先审查结果，再决定是否开C2，不一次写全矩阵。

## 第一轮验证与停止条件

下一轮[DS任务](DS_NEXT_TASKBAR_QA.md)仅准备隔离QA工具和假边界检查，不操作真实应用。
审查通过后再确认用户方便，只用Lucy建立一个本轮唯一命名的屏幕外无边框源；默认25秒，最多60秒。
同一捕获会话先留5秒正常基线，再调用一次DeleteTab；保持采集直到有足够后续动态帧，末尾恢复/关闭本轮资源。
不以低频哈希变化、单张JPEG或函数返回值替代动态画面/任务栏观察。

需要分别取证：调用前后源HWND/PID/StartTime、样式/owner/位置/尺寸、visible/iconic/cloaked、
有效JPEG及源时间戳进展、最后帧距当前时间、任务栏和Alt-Tab人工观察、主动闪窗/焦点、最终清理和原WE保留。
源时间戳增长不单独证明画面变化；不能把采集上限当源FPS。Alt-Tab第一轮只记录，允许仍有入口。

窗口消失、身份不符、API失败或画面停止时有界结束；不循环重试、不连续DeleteTab、不重启Explorer。
若删除按钮后仍反复出现，先记失败/不足，下一轮单独评估事件处理；不在本轮偷偷加入Shell钩子或owner路线。
正常停止、Esc、stop.txt、父进程丢失都要能退出；仅关闭本轮location，不结束原WE。

即使C1可用，正式接入还要另验开始/重启/停止、DSH最小化恢复、退出和Shell状态变化。
若只解决持续播放时的任务栏按钮，就按这一范围交付；入口短暂出现、Alt-Tab等保留为明确限制。
暂时不可行也不阻塞壁纸属性、主题预设和独立选择器的后续开发。

本轮只读/保护指纹：`.tmp/taskbar-hide-plan-20261012-100029`。历史证据和rc.24／rc.26归档保留，未提交/推送。
