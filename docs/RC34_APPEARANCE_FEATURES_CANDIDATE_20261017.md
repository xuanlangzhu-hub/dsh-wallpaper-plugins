# rc.34 外观功能整合候选：核包通过，未安装

最新进展：用户随后明确选择并完成[rc.34日常试用交接](RC34_DAILY_TRIAL_20261017.md)，现保留rc.34。本报告中的“未选择/日常rc.31”等为相应前阶段快照，原始构建与临时恢复记录保留。

后续进展：[本机功能短验及恢复已完成](RC34_APPEARANCE_FEATURES_SHORT_TEST_20261017.md)，日常rc.31与原设置已恢复并核对重开正常、播放停止。下文“未安装”为构建核包时快照，rc.34未被选为日常。

2026-10-17，Codex。用户在强调色最终复审通过后同意继续；本轮从不可变rc.31原包独立整合已审外观功能，完成候选构建、实际候选回归和逐文件审计。**当前日常仍是rc.31，rc.34尚未安装或取得真实DSH观感验收。** 本轮没有查询/操作真实DSH或Wallpaper Engine。

## 固定归档与整合边界

| 项目 | 结果 |
| --- | --- |
| 版本 | `0.6.0-rc.34` |
| 归档 | `F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.34.tgz` |
| SHA256 | `8DDB36C86FEDA3DACAAB2904A49414E5DFDAEB2E7D0CC05F71BCAB67AC23EA75` |
| 大小/文件数 | 7,392,415字节 / 28文件 |
| 基底 | rc.31，SHA256 `F1C5B2A3ADCD2BA9B67CC3D432CDB8637B140ADDEDFD520D19CA0BB1B11965DB` |
| 相对rc.31变化 | 仅`README.md`、`package.json`、`src/client.js`；manifest仅版本字段变化 |
| 原生运行时 | 12文件逐字节等同rc.31；P4保持，未重编译 |
| 原生DLL SHA256 | `5CD02541DC6C7F252168E100E17A77D47947EACF66068055F7ACD57508294C90` |
| 候选client SHA256 | `4B81E383D72645225ADBE4A85B31A870F998E653592F11E2E20AC4555038CD1C` |

归档前核对rc.34尚未使用；新包以排他创建写入，旧26个tgz未覆盖或清理。打包前后包内集合完全等同rc.31，归档每个文件与暂存目录一致，不含QA、证据或新增诊断文件。

工作区manifest/生产assets继续冻结rc.30；工作区client包含后续Trace，不能直接复制整份进包。本轮从Git HEAD到当前已审client生成**仅功能差异**，干净应用到rc.31 client，无手工冲突合并。再反向应用同一差异，恢复结果与原rc.31 client逐字节一致。候选无`cadenceTrace`、`CADENCE_CLIENT`和`cadence-trace`；Host、帧协议、session及其它25个包内文件保持rc.31。客户端包含预设所需、已复审的停止归属和目录确认保护，不是只有CSS变化。

## 已合入功能

- [亮度120%补修](APPEARANCE_BRIGHTNESS_120_REPAIR_REVIEW_20261016.md)：范围20–120、默认70；遮罩0–90/默认45保持。旧rc.33的200%候选不改写，用户明确跳过该参数单独候选/重复实机，随本包交付。
- [四字段手动壁纸预设](WALLPAPER_APPEARANCE_PRESETS_P1_FINAL_REVIEW_20261017.md)：仅亮度、遮罩、模糊和界面不透明度；按稳定scene ID保存/应用/删除，独立存储，R1/R2保护保留；不自动套用，不把主题字段加入预设。
- [主题可读性](THEME_READABILITY_P1_FINAL_REVIEW_20261017.md)：文字标准/增强，默认标准；聊天底色0–100，旧opaqueChat布尔设置迁移兼容；增强普通标签，保留语义状态色。
- [独立强调色](THEME_ACCENT_P1_FINAL_REVIEW_20261017.md)：默认跟随主题，可选严格六位十六进制自定义色；按钮前景/hover、链接和焦点等按已审算法处理。选中控件保持普通primary文字和20%彩色轻底，A1/A2修复均在包内。

自动播放验证名单仍只有Lucy。三体变速调查、GPU/性能长测、作者属性、主题自动预设与自定义底色均未推进。

## 实际候选检查

所有下列前端检查读取`package-stage/src/client.js`，使用冻结harness、独立临时profile的无头Edge和假Host，不连接日常DSH/WE，不截图。

| 检查 | 结果 |
| --- | --- |
| 包内JS语法 / 实际候选CSS模板守卫 | 10文件 / 通过 |
| 默认完整回归 | 570项通过 |
| 英文fixture | 566项通过；默认另含4项尾部媒体/资源检查 |
| 场景选择 | 延迟Host正控制自动开始1次；手动选择取消后0次 |
| 强调色实际消费者 | 41项通过 |
| 选中文字叠色 | 5主题×7颜色×2文字档×2侧栏，共140组合及4项恢复通过 |
| 预设补充边界 | 17项通过：旧停止失败/异常、卸载、目录失效/取消/过期请求及恢复 |

所测已知不透明参考面最低对比为6.919947113835508；这不是任意动态壁纸或实际DSH观感保证。Headless/代码检查不能代替人眼确认。不因Host与原生文件未变而机械重复原生编译、GPU矩阵或长测。

`npm pack --ignore-scripts --json`仅在独立stage执行。归档审计前436个保护输入指纹一致，涵盖工作区生产/QA与文档输入、旧26归档、日常rc.31的28安装文件及5个Profile。日常安装还逐字节复核等同原rc.31包。本轮未写Profile/Local Storage；当前运行/播放状态未查询。之后仅更新本报告和6个入口文档，生产/正式QA、工作区manifest/assets保持。

## 下一轮统一短验与恢复

已准备本轮`closed-settings.ps1`及`verify-installed.py`，前者默认仅预演，AST语法检查通过；后者Python语法及日常rc.31的28文件只读核验通过。计划新备份为`C:\Users\HP\.dsh\backups\rc34-appearance-features-candidate-20261017-8f2a6c10`，**当前未创建、未执行备份或恢复**。不复用历史退出确认或旧设置备份。

1. 另行确认用户当前方便、其它助手暂停且DSH无任务，正常停止并通过菜单退出；届时确认DSH/capture/worker退出，记录原WE身份并保持原WE。
2. 备份当次5个Profile、完整关闭状态Local Storage；留存固定rc.31归档及活动安装指纹。只用官方CLI临时安装此固定rc.34，核验28安装文件、安装所需Profile变化和外观存储未变后，再由用户正常重开。
3. 合并做一轮功能短验：原主题/布局重开正常；切文字标准/增强、聊天底色和强调色；同一Lucy背景手动保存、改动、应用与删除四字段预设，确认主题字段不随预设改变。只作必要短播放与停止清理，不追加120%单独一轮、三体运动判断或性能测量。需要观察重开记忆时正常关闭再开，由本轮备份保护。
4. **默认测后恢复日常rc.31和本轮原设置**；是否保留rc.34日常另由用户明确决定。回退先正常退出，保留测试时Profile及完整Local Storage，再用官方CLI重装固定rc.31、核验28文件，恢复本轮原设置并核验；最后由用户正常重开确认外观布局与播放停止。rc.28只作历史回退，不自动替代当前日常rc.31。

尚未修改官方EXE/app.asar、WE、启动环境或任何全局设置。当前无新编码任务、提交推送、工作区清理或跨会话消息；真实安装/操作仍待当时方便与退出确认。

## 本机证据

目录：`F:\dsh-wallpaper-plugins\.tmp\rc34-appearance-features-candidate-20261017-8f2a6c10`。

`before.json`、`prepare.py/json`、已审源快照、`approved-feature-overlay.patch`、`feature-overlay-apply.log`、`feature-overlay-verification.json`及`rc31-to-candidate-client.patch`记录隔离整合与反向恢复；`package-stage/`、`qa-check/`及各`candidate-*.log/json`记录实际候选检查。`npm-pack.json`、`audit-candidate.py`、`package-audit.json`保存完整28文件清单与SHA256。设置工具、`settings-preview.json`及`installed-daily-preflight.json`仅为下轮准备。原始输出与旧归档保留。
