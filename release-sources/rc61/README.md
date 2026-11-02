# rc.61 本机候选固定来源

这不是公开发行配置，不运行npm发布或整体打包开发树。

- `integration-inputs.json`绑定已审固定SDK输入与442项保护输入。
- `ui.patch`记录相对固定rc.57完整侧栏的UI差异，不丢失诊断包装。
- `build-candidate.py --output <新的.tmp目录>`生成确定性tgz；原生资产取固定载荷且保持。
- `check-candidate.py --output <新的.tmp目录>`检查最终-b实际包，含152行为、27语法、CSS与导入边。
- `prepare-trial.py --output <新的.tmp目录>`派生全新未授权工具，另做正常退出确认与新备份后才能运行实际操作。
- `run-launch.cjs`使用直接日志描述符；超时只终止自有helper，未知启动结果不得重试。
- `check-launch-runner.mjs <runner路径> <新的.tmp输出目录>`用进程／时钟替身核对5种结果，不启动应用。

实际SDK核包15项、工具离线检查与指纹见本目录收据；完整说明见`docs/RC61_BASIC_TRANSPARENT_CANDIDATE_AND_TRIAL_PREPARATION_20261031.md`。日常rc.57保持，候选未安装。不要复用旧授权、备份或运行证据。

## 2026-11-02 接续

本页上文是候选准备当时的记录。rc.61现已完成临时短验、恢复和另轮日常安装，用户已确认正常；见 [日常交接](../../docs/RC61_DAILY_SWITCH_20261031.md)。公开仍rc.53，不重新执行旧轮次。

后续辅助JSON解析／任务注册修复在 `prepare-trial-repaired.py` 与 `trial-helpers/`；日常保留另用 `prepare-daily-switch.py` 和独立意图门禁。这些都只生成未授权工具，不代表允许操作应用。旧配方／旧指纹作为历史保留，依赖本机 .tmp 固定载荷；本轮维护接续的8项QA/UI差异见 [维护记录](../../docs/WORKSPACE_MAINTENANCE_20261102.md)，不能直接重跑旧候选检查并覆盖旧保护哈希。
