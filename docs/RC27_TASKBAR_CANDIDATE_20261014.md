# rc.27 任务栏入口隐藏候选

2026-10-14，Codex。**包核验及正式 DSH 短验通过，用户已选择保留 rc.27 作日常试用。** 最终状态见 [本机验收与日常交接](RC27_TASKBAR_DESKTOP_ACCEPTANCE_20261014.md)。包内 README 保留打包时的待验收快照，不因此重打或覆盖同版本归档。

## 包与范围

- 包：`F:/dsh-wallpaper-plugins/release/plugins/dsh-whale-mist-0.6.0-rc.27.tgz`。
- SHA256：`5754AD221CFF8DC9236C11E0129D55F915BBB7C60C920A249D6E4B644B196973`。
- 7,356,868 字节；28 个文件，解包后 27,345,277 字节。
- 保留 rc.26 的受限列表、手动选择/重新开始切换、选择记忆；新增正式 C1 单次后台任务栏按钮移除。
- 正式 Host 默认传 `--taskbar-hide`；捕获开始约 10 秒并有有效发布帧后尝试一次。回退环境变量为 `WM_WALLPAPER_TASKBAR_HIDE=0`。
- 先确认 worker 退出再关本轮源，未确认时不放行下一轮。普通隐藏失败安全退出后继续播放；提前停止无动作。
- 不含 QA 的时限、全局 Esc、选卡包装、音频/鼠标接入、壁纸属性或独立选择器；不修改全局 GPU/FPS 或官方程序。

## 本轮核包

独立复审通过后复核全部原生输入、Host 源码和构建指纹无漂移，使用该次已审查正式候选的 12 个运行文件更新工作区 assets/wallpaper，未带 PDB 或 QA 工具。版本改为 rc.27，旧资产/版本/README 先另行备份。

与 rc.26 相同的 28 文件中，只变化 README、package.json、src/wallpaper/session.js 及 WallpaperProbe.exe/.dll/.deps.json。其它源码、图标、运行依赖和 bundle/peer 声明字节或结构保持原样。全部包文件与打包工作区一致，8 个 Host 文件与复审快照一致，12 个原生运行文件与复审候选一致。

本次另跑 JS/CSS check 和资产中原生程序的 14 项参数检查，均通过。105 Host、113 原生自检、19 生成入口、5 假 worker、9 监督接缝、4 提前停止接缝结果来自同日 [正式接入复审](C1_HOST_INTEGRATION_FINAL_REVIEW_20261014.md)，没有把它们计为本次重新执行。

核包只在内存中读归档，按全新文件名写入 release/plugins；rc.24/rc.26 原包、运行 Profile 和当时已安装 rc.24 未被核包改动。后续临时安装与保留属于用户已授权的正式短验，详见验收记录。

证据：`F:/dsh-wallpaper-plugins/.tmp/rc27-candidate-20261014-9477d606`，包含打包清单、核包脚本/结果、资产前后指纹、workspace-before 备份和检查日志。归档未经覆盖，尚未提交/推送本轮 C1 与候选准备改动。
