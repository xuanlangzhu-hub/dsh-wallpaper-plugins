# rc.31日常试用交接

2026-10-16，Codex。用户明确确认“已正常退出，可以安装并保留rc.31日常试用”；已使用官方CLI安装既有rc.31原包，核验后用户确认“重开正常，外观布局正常，播放停止”。**当前日常为rc.31试用；rc.28保留为可恢复基线，本轮不自动退回。**

## 安装与设置保护

- 使用原归档`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.31.tgz`，SHA256 `F1C5B2A3ADCD2BA9B67CC3D432CDB8637B140ADDEDFD520D19CA0BB1B11965DB`；28文件/12运行文件与原候选审计一致，没有重建或覆盖同版本包。
- 本轮新证据：`F:\dsh-wallpaper-plugins\.tmp\rc31-daily-trial-20261016-632621e7`。
- 本轮新备份：`C:\Users\HP\.dsh\backups\rc31-daily-trial-20261016-632621e7`。退出后确认DSH/capture/worker为0，保存5个Profile文件与10个完整Local Storage文件，逐项哈希核对；安装前rc.28的28文件及设置与备份一致。
- 官方CLI `plugin --profile desktop add`成功退出；安装后及用户重开后，rc.31的28个文件均与固定归档逐字节一致。安装完成、DSH关闭时，10个外观存储文件保持不变。
- Profile仅`package.json`和`pnpm-lock.yaml`发生安装所需变化；依赖指向固定rc.31 tgz，其它依赖和配置保持。`cordis.yml`、`cordis.patch.yml`、`pnpm-workspace.yaml`未变。安装后5Profile另存备份内`profile-after-rc31-install/`，用户重开并停止后仍一致。
- 原WE PID11992、路径和启动身份保持；DSH EXE、app.asar、WE EXE、全部25个候选tgz保持。安装前后源码工作区347个跟踪文件保持，后续仅更新本轮交接及当前入口文档。

此次成功保留rc.31，不执行rc.28重装或设置回退。Local Storage重开后会正常活动，不将活跃存储与关闭备份强行比较或恢复。

## 重开后的手动体验与停止核验

用户重开确认后自行开始了一轮壁纸，后台核对因此读到采集进程；用户随后明确说明“是我手动开始的，现已停止并清理完成”。这不是自动播放故障证据，不修改自动播放设置或验证名单。

本轮已有日志保存至证据目录`stopped-run-evidence/`：

- run：`2026-10-16T111428-7ed5-we-41612c520dd4406e48dea550`；location：`WhaleWallpaperProbe-261016111428-f648`；capture PID50436，源HWND3738886，源进程为原WE PID11992。
- 实际后端`kernel-highres-worker`、`highResolution=True`；原生全生命周期39.0768598秒、1094帧。此轮为用户自主体验，未控制前台/鼠标/时长，不作为新一轮性能A/B或平滑度验收。
- 最终Host `running=false`、`failure=null`；原生`parent-stop`，源窗口关闭且`safeToCleanUp=true`，Host随后记录源已不存在。任务栏worker已退出、`cleanupSafe=true`。
- 末次客户端计数received1072、draw990、丢旧帧82，解码/同步/绘制错误均0；不把这些计数当源FPS、屏幕FPS或零丢帧证明。
- 停止后进程复核：capture/worker为0，DSH保持正常打开，原WE身份保持。停止状态同时有用户确认和本轮终态日志支持。

已有[Lucy常规短验](RC31_LUCY_ORDINARY_SHORT_TEST_20261016.md)和[P4候选记录](RC31_NATIVE_WAIT_P4_CANDIDATE_20261015.md)继续有效；未机械重跑Lucy、三体、GPU矩阵或长测。

## 日常边界与回退

当前rc.31包含P4局部等待优化及既有P2/P3轻量计数，不含rc.32逐帧Motion Cadence Trace。此前短验通过不等于所有壁纸兼容、长时稳定或三体速度突变已修复；这些由后续实际使用积累，三体专项继续暂缓。

rc.28回退归档SHA256：`58F5B6233882D269083D7E478B8ED920E690675A22F868B4BC0E4DD618B9F2FC`。若后续需要回退，先重新确认当前方便、停止并正常退出、保存届时数据，再用官方CLI安装rc.28、核验28文件，按明确范围恢复本轮备份；不因旧文档直接覆盖之后新增设置。

自动播放验证名单仍只有Lucy。工作区manifest/生产assets仍是rc.30冻结基线，源码含后续P4/Trace；日常安装来自固定rc.31归档，不能直接把工作区打包当成该版本。

本轮没有修改生产/QA、全局计时器、FPS/画质、启动环境或壁纸演算参数，没有新包或跨会话消息。下一项可另行安排亮度/遮罩与按壁纸外观预设，当前没有向小G发送新任务。
