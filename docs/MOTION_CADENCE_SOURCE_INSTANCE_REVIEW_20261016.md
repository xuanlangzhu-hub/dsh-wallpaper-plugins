# 三体源实例调查复审：配置核对通过，运行结论及对照方案需收敛

2026-10-16，Codex。复核对象：[小G调查报告](MOTION_CADENCE_SOURCE_INSTANCE_INVESTIGATION_20261016.md)。本轮只读源码、本机project/config快照、官方文档，并在冻结的实际session代码上运行三项合成控制；未操作DSH/WE、安装、采集、修改生产/QA或用户设置。

**结论：调查方向和同一源实例对照思路保留；尚不足以进入实机。只需补R1运行证据边界、R2可执行同源可见方案、R3判定/观察条件及少量元数据措辞。不是要求重做P4、重写trace或开始生产代码修复。**

## 已独立核实、应保留的部分

1. 本机三体项目SHA256仍为`982EF336280C59023731A34C6D64A49B4BF0A54C344FF62321410CCF5A31930D`。作者元数据确有四阶辛积分器/Aarseth软化说明、超高品质/>60fps提示、计算步长默认0.75ms、时间倍速默认1；description中也确有v3.8.0/v3.8.1改写时间倍速、尽量保持跨设备物理一致的说明。它们是作者说明/默认值，不是包内求解代码的独立审计。
2. 本轮读取的WE config中，`HP.general.user`确为preset=ultra、fps=180、msaa=x2、postprocessing/shadows=ultra、resolution=full、playbackfocus=run、playbackmaximized/fullscreen=pause。报告的配置值基本属实，准确路径应保留。
3. 此config中目标`wproperties[.../3509243656/scene.pkg]`只有Monitor1 volume18、MonitorPositionL0T0 volume29；能确认该处未见步长/倍速的持久覆盖。
4. 启动源码确用`openWallpaper -file ... -playInWindow <本轮location>`另开源窗口，没有显式传CLI preset或演算属性；capture目标30fps不等于源渲染/物理更新30fps。
5. 同一源窗口与其DSH输出比对，可以减少两次独立随机初态混杂，比直接对照桌面另一个三体实例更有区分力。rc.32的569.1ms接收间隔及降级记录仍保留，不能用新假设删除旧证据。

## R1（P2）：配置上限/未见覆盖，不等于已证明运行值与继承

位置：原报告2.2“严格采用”、2.3继承机制及“内部按照全局最高180fps运行”、5.1；NEXT_TASK最新事实段。

config是磁盘快照。`fps:180`是配置目标上限，不是独立窗口实际渲染或SceneScript更新达到180fps的测量；报告3.1也承认屏外内部渲染FPS未知，不能在2.3同时当已证明事实。仅在该wproperties路径未见演算覆盖，不足以证明当前运行内存、脚本初始化/随机模式、其它保存状态或独立location的最终参数一定为默认。

另外，官方CLI的`-preset`表示用户保存的**本地壁纸预设名称**，不能与`HP.general.user.preset=ultra`图形品质字段仅因同名就视为同一种继承控制。官方页列出了可选参数，但未由此证明省略后全部运行继承语义。参考[官方CLI Open Wallpaper](https://help.wallpaperengine.io/en/functionality/cli.html)。

请改成：“磁盘全局目标ultra/180，该目标项目的指定wproperties项仅见音量；启动未显式指定壁纸预设/演算参数。源实例有效品质/演算参数的继承及实际FPS仍待确认，默认0.75/1为候选参考。”如能给出实际安装版本对应的引擎实现/运行值证据，再逐项升级结论；不要为补文案操作运行应用。

## R2（P2）：同源对照方向成立，但现有方案尚不能照着执行

位置：原报告4.2“使用现有命令启动但不移至屏幕外”、4.3“0行改动”及NEXT_TASK实施段。

真实调用链：

- `session.js` create只用offscreenStart决定`--we-open`是否加`--initial-offscreen`。
- 首条`captureSource='window'`状态到达后，`onChildStderr`仍会执行capture-then-tuck；offscreenStart=false不会跳过它。
- offscreenStart=true且确认源已在屏外，才保留initial-position；否则同样回退offscreen。
- helper的offscreen将窗口放至(-32000,-32000)，而现有onscreen动作会设置(100,100)/1280×720并改exStyle，不是无副作用的原尺寸坐标移动。

冻结实际session模块的合成控制结果：

| 输入条件 | 首次窗口采集状态之后 |
| --- | --- |
| offscreenStart=false | offscreen调用1次，capture-then-tuck |
| true且已确认在屏外 | offscreen调用0次，initial-position（本来就在屏外） |
| true但未确认在屏外 | offscreen调用1次，capture-then-tuck |

这不是生产回归缺陷，而是**报告的实机准备步骤遗漏**。小G应补一个可执行方案：由哪个现有入口让Host本轮已绑定的同一HWND保持/恢复可见、何时完成tuck/任务栏动作、如何验证绑定与不发生额外resize/style干扰、如何清理恢复。不能仅设`WM_WALLPAPER_OFFSCREEN_START=0`就声称可保持可见，也不能手工另开一个窗口让DSH自行“接入”；Host仍绑定它自己创建的本轮窗口。同一wallpaper64进程可承载多个窗口，**同PID不等于同实例画面**，要核对location/HWND及capture绑定。

如存在不改生产代码的受控方案，可以提交步骤与局限；若确需临时诊断开关，先写最小提案供Codex复核，不直接动生产、不打包安装，不扩展通用任意HWND授权。不能为了满足“0行代码”口号而跳过这些边界。

## R3（P2）：改为有条件判定，并保留“都异常/未复现/条件变化”结果

位置：原报告Mermaid终点、4.2两条判定、4.3“0观测副作用”，NEXT_TASK“直接证伪/确证”。

- 源窗口同样突变，只能支持源端已有贡献，不能排除DSH另外叠加的接收/抽样/显示波动。
- 源窗口较平滑而DSH较差，支持源输出之后的路径值得查，范围包含WGC取样、30fps呈现差异、传输/处理与显示；不等于已确定某个DSH代码错误，也不宜宣称彻底排除任何源/采集交互。
- 两边都有但程度不同、没有复现、无法确认同轨道段，都应记为混合或未知，不能强制二选一。由于链路有延迟，应比对对应运动片段，而不是默认同墙钟瞬间是同一源帧。
- 不启用trace只减少一种诊断开销。将源从屏外移至屏内，同时并排显示，会改变可见性/焦点/窗口或捕获尺寸、合成负载及鼠标指向；当前全局还有maximized/fullscreen=pause，需避免布局触发其它规则。故不能称零观察副作用，也不能直接拿屏内结果外推历史屏外条件。

请补短而明确的条件/局限/停止清理及恢复步骤，先保持原FPS/品质/物理参数，默认不录屏/不额外日志；未来实时操作仍由用户另确认方便。本轮不要求执行对照。

## P3：作者说明与物理推测的措辞

“初始位置固定”未由当前求解代码证明；元数据默认Custom/Random开关为false，另有Random Pos Range=2、Random Speed Range=0.1。不能只写固定位置而忽略这些参数，建议改为“默认随机种子模式，具体初始化以脚本实现为准”。“近距离必然极高加速度”也不宜当诊断事实：本项目作者声明近距离软化，元数据甚至给出近区加速度随r线性变化的式子；究竟如何运行尚未解包验证。可保留“存在自然非匀速运动可能，但是否解释用户突变未知”。不需要扩写天体理论或动资源。

## 保护、证据及下一步

证据：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-source-investigation-review-20261016-ff41465d`

- before.json、原报告/NEXT快照：复核输入和保护基准。
- project.snapshot.json、we-config.snapshot.json：本轮只读磁盘快照，不作实时运行证明。
- source/、tuck-controls.mjs/json/log：实际冻结session与三项合成控制，helper/child均为替身，未启动任何真实应用或窗口。
- after.json：复核末固定输入、工作区/归档/Profile/日常安装及外部快照状态检查。

本轮只需小G修调查报告、NEXT摘要和可执行方案，完成再交Codex复核。**暂不需要生产修复，不进入安装或实机。** 既有实现与QA不重跑，原报告完整保留为修前依据；工作区rc.30/12运行资产、日常rc.28与旧归档边界保持。当前播放状态未查询，不套用历史“保持停止”。
