# 插件工作区

主要开发目录为 `dsh-whale-mist`。先读根 README、`docs/PROJECT_STATUS.md`、插件 README 和最新验收记录。原 Tauri 桌面壳、WSL 环境与旧会话迁移不属于本仓库的开发任务。

## 工作方式

- 先核对 git status，保留用户和其它实现者的现有改动；同一实现任务不要与其它 AI 同时编辑或安装。
- 当前源码候选 rc.23，人工启动/重新开始与白条短验通过，日常恢复 rc.1；先读 docs/RC23_STARTUP_ACCEPTANCE.md。性能 QA 接手修复见 docs/PERF_SAMPLER_REPAIR.md，使用新 fixture 契约，不把旧 DS 自检当成修正版结果。真实性能以 docs/NEXT_SOURCE_PERFORMANCE.md 接续，等用户确定阶段清单和时段；不按旧 B 起点重复 35 分钟或自动扩 A/C/E。
- 本地源码检出是开发工作区；官方安装目录和 `.dsh` 是运行环境。
- 当前性能下一小步见 docs/DS_NEXT_PERF_COMPARE.md：仅离线对比工具与合成检查。阶段协议和模板见 docs/PERF_PHASE_PROTOCOL.md；计划不等于已经授权实机。WE 源 owner PID 不能用短命 launcher PID，采集上限不能当源 FPS。
- 真实应用操作由用户点击、外部助手核验。需要窗口操作或退出宿主前先确认用户方便；用户按 Esc 或要求停止就立即停止。
- 不修改官方 EXE、app.asar 或系统安全设置，不终止原 Wallpaper Engine 进程。
- Profile 修改前备份，只恢复本轮修改；保留旧会话、源资产、备份和正在引用的 tgz。
- 新检查使用独立输出目录。不用通配符清理别人的证据目录，不覆盖历史报告、同版本安装包或原始证据。

## 检查与交付

- 未改实现时优先核对源码与包内容；不要为文件整理重跑真实窗口实验。
- `npm run check` 和 `npm run test:wallpaper-host` 可在插件目录运行，不创建真实 WE 窗口。
- 历史 QA 脚本可能包含旧机器绝对路径；运行前检查目标源码与输出路径。
- 保留主题恢复、设置持久化、输入文字可读性与桌宠共存逻辑。
- 代码检查和实机效果分开验收，不能仅凭编译成功宣布桌面功能完成。
- 原生辅助程序存在框架和平台依赖；发布时记录包指纹、依赖与实测范围。
- 提交、推送、发布或操作应用依照用户在当前会话中的授权执行。
