# rc.29 前端阶段测量候选

2026-10-15，Codex。基于 [P2 最终复审](FRONTEND_PERF_P2_FINAL_REVIEW_20261014.md) 固定输入，已完成独立候选打包、临时安装和 [三体短前台实测](COMPLEX_SCENE_P2_FOREGROUND_RESULT_20261015.md)。28 个安装文件逐字节一致；两段P2字段与覆盖通过，画布计数约21.5fps，本轮没有明显卡顿体感，不代表已做性能优化。日常rc.28和今天原设置已恢复，用户重开确认正常。

## 包与范围

- 包：F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.29.tgz
- SHA256：E354F837B2C86616EE053E8088A8EF73DC00EDACF5625C59DD212698DC7E9AF9
- 大小 7,359,875 bytes；28 个文件；解包 27,357,612 bytes。
- 与日常 rc.28 相比仅 README.md、package.json、src/client.js、src/wallpaper/session.js 四文件不同。
- 12 个原生运行文件逐字节一致，manifest 除版本外一致；8 个已复审源码/工具/交付输入保持，28 个包文件均与工作区一致。
- npm run check 通过；既有 P2 十类/P1 九类/Host105 的最终复审输入未变化，不为改版本重复整套离线或实机检查。
- 日常 rc.28 安装 28 文件与活动归档一致，准备过程没有修改五份 Profile 配置。活动 rc.28 tgz 和旧归档均保留，不覆盖 rc.29 归档。

rc.29 仅加入 P2 的有界阶段统计与此前已通过的 run 隔离/停止计时修正；不调整原生采集、30fps 上限、JPEG 参数、主题、输入裁剪或播放策略。rendered 是解码后投递计数，drawCount 是同步 drawImage 成功计数，两者都不等于屏幕呈现 FPS。计数/耗时和取阶段增量；累计 max 只能按运行期报告。

## 当前实机准备

用户已确认方便，助手暂停且 DSH 无任务。测试前：三体实时演算 | Three-Body problem - SYKM，WE，停止；自动播放勾选但未启动。已读取日常安装源码确认 VERIFIED_SCENE_IDS 仅 Lucy，三体手动播放符合当前限定；本轮记录提示不醒目的反馈，不扩大自动播放名单。

实机计划：备份今天五份 Profile，用户完整退出后备份关闭状态外观；临时安装 rc.29，以同 scene/run/窗口/外观短测前台静止与缓慢移动鼠标，工具只读现有日志；然后停止/退出，保存试验设置和记录，恢复 rc.28 与今天原设置。用户负责原生 UI 操作。待实际采样、覆盖审计和恢复确认后另写结果，不把核包当实机性能验收。

已完成：用户完整退出，五配置与初始备份保持，关闭状态十个 Local Storage 文件逐文件备份核验；官方 CLI 临时安装 rc.29，28 文件与候选一致，三份插件顺序/配置文件及十个外观文件未被安装改动。原 WE PID 10344/启动身份、DSH EXE/app.asar/WE EXE 哈希保持。本轮准备脚本的一次时间字符串比较误报已确认是 ConvertFrom-Json 自动解析 DateTime，改为 UTC ticks 比较；未绕过身份门禁。用户重开手动播放三体，静止/鼠标采样完成；随后停止/退出，保留测试后设置，恢复rc.28、五配置和十外观哈希一致，用户重开确认正常且停止。capture/worker和源窗口均0，原WE/官方文件保留。下一步只补原生采集节奏观测，见结果与P3任务书。

## 证据

- 候选核验：F:\dsh-wallpaper-plugins\.tmp\rc29-p2-candidate-20261015-29533100\package-audit.json
- 候选检查：同目录 check.log、npm-pack.json、before.json、audit-candidate.py。
- 本轮测试目录：F:\dsh-wallpaper-plugins\.tmp\rc29-desktop-20261015-090238-9d91f7b0
- 今天回退备份：C:\Users\HP\.dsh\backups\official-desktop-before-p2-rc29-20261015-090238-9d91f7b0

未提交或推送。
