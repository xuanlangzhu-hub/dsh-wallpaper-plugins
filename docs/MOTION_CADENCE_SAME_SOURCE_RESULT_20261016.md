# 同源短对照完成：源窗口与 DSH 都有球体运动突变

2026-10-16，Codex。本轮用户明确确认方便、正常退出后开始，使用现有日常 **rc.28，没有安装新包**。用户对同一绑定源与 DSH 的观察反馈为：**“右侧源也会突变，左侧也会”。** 随后正常停止、清理和恢复完成，用户确认“重开正常，布局外观正常，播放停止”。

## 结论及边界

球体突变在同一个被采集的源窗口中已经可见。后续优先排查 DSH 所创建壁纸窗口的源端运行条件、场景演算与采集负载之间的关系，不能继续只按“源平滑、只有下游播放突变”的前提改客户端。

这不等于证明三体算法有错，也不证明采集或下游完全无责。WGC/编码负载可能影响源端资源；源窗口进入屏内参与 DWM 合成、用户焦点变化、DSH 临时缩窄等条件都有观察效应。此前 rc.32 的 Host写→client accept 波动证据仍保留，可能叠加，不能用这次定性观察否定它。没有测量实际源 FPS、有效物理参数或轨道速度曲线，也没有取得本次与原桌面同一初态轨迹的数值对齐。

原 WE 与本轮源窗口的 PID 均为11992：这里的“源实例”是 DSH 所创建并绑定的专属 location/HWND，**不是已证明另起一个独立 WE 进程**。桌面壁纸也不能代替本轮窗口的实际源作对照。

## 本轮可核查证据

工具及全部结果位于 `F:\dsh-wallpaper-plugins\.tmp\same-source-plan-a-20261016-a9a0fd23`。

- 新 run：`2026-10-16T071233-0e45-we-41612c520dd4406e48dea550`；location `WhaleWallpaperProbe-261016071233-1bb4`，HWND4264276，capture PID17608，Host PID14680、DSH主进程PID10072。trial/plan还绑定启动时间、可执行路径、父子命令关系及精确 HWND/location，不能仅凭 PID 复用操作。
- `create-trial`：备份哈希、日常 rc.28 的28安装文件均通过；记录原 DSH普通窗口矩形 `[309,68,2250,1311]`。
- 最初 `plan.json` 因任务栏 worker仍pending拒绝，无移动；随后worker实际达到action-done、isPending=false、workerCleanupSafe=true。`plan2.json` 因DSH宽度不足以并排拒绝，也无源移动。
- 用户反馈难以肉眼按像素调整，明确授权“还是你来操作吧”。新增隔离 `fit_dsh_left.py`，按同一基线/健康状态/身份绑定调整DSH到 `[12,191,1112,1257]`，读回通过，源尺寸、位置与身份保持。生产脚本和安装文件均未改。
- `plan3.json` 合格；`move.json` 成功，源由 `[4096,0,5398,776]` 移至 `[1246,191,2548,967]`。仅改坐标，客户区及capture均1302×776，style/exStyle保持；sourceSequence从移动前最后读数3845增加至3910，确认移动后有新帧。
- 用户反馈两边均突变。首次 `stop-verified.json` 因尚无preview-final拒绝；只读状态仍running，未误称已停。再次提示用户停止，用户确认右侧消失后，`stop-verified2.json`通过：Host无failure，原capture退出，同源窗口关闭，原WE身份保持。
- 本轮完整原生会话 **229.7501205秒、4909帧**。其中包括等待任务栏、用户调整布局和往返确认；要求的15–20秒是正式肉眼观察目标，实际视觉动作窗口没有精确标记，不能把整个run当成15–20秒或全程稳定前台的定量实验。
- `summary.json` reason为parent-stop、windowClose.closed=true、taskbarHide.cleanupSafe=true；原始最终元数据复制到 `run-evidence/`，没有改写原日志。

## 恢复与最终状态

本次关闭备份在 `C:\Users\HP\.dsh\backups\same-source-plan-a-20261016-a9a0fd23`，没有复用rc.32旧备份。

1. `layout-restored.json`：源正常停止后，恢复原DSH普通窗口位置/大小并读回通过，没有强杀或盲回滚。
2. 用户菜单正常退出；首次恢复被“进程尚未完全退出”保护拒绝，未改设置；随后核实退出，再执行恢复通过。
3. `settings-restored.json`：本轮5个Profile和10个Local Storage文件在关闭状态按字节哈希恢复；测试时数据也保留在备份中，没有删除。
4. 用户日常重开确认布局外观正常、播放停止。`final-verification.json`：28安装文件/5Profile一致，WallpaperProbe为0，原WE启动身份保持；34复审输入、54保护、29打包源、旧24归档零变化，rc.32归档保持，工作区版本rc.30，日常rc.28。

没有修改生产/QA/品质/FPS/演算参数、持久启动环境，没有新包、提交推送、自动消息或额外长测。下一步见 [小G源端窄调查任务](GEMINI_NEXT_SOURCE_SIDE_AFTER_SAME_SOURCE_20261016.md)；先只读调查与最小单变量提案，再Codex复核，另确认方便才安排后续实机。

## 用户补充：稳定对转片段也有速度起伏

用户随后补充：“刚刚单独开个窗口就更明显了，两球应该匀速对转的也变得一快一慢”。这进一步描述源窗口可见的速度起伏，但“单独开个窗口”本身不证明当时已脱离DSH采集，不能视为无采集控制组，也未新增实际源FPS/帧时间或演算时间测量。当前播放状态不再沿用上一轮停止确认。

机制候选需区分：源呈现间隔不均造成位置更新疏密；演算推进依赖帧调用次数或补步策略造成每真实秒推进量变化。Wallpaper Engine官方说明SceneScript update按渲染帧调用，engine.frametime用于速度归一化（https://docs.wallpaperengine.io/en/scene/scenescript/reference/class/IEngine.html）；未查看本壁纸内部实现，不能断言作者漏用frametime。稳定较低FPS本身不必然造成忽快忽慢，关键是帧时间和演算时间如何关联。维持只读调查与单变量提案，不立即调高FPS。
