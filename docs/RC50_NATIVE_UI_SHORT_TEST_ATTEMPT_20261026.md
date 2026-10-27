# rc.50 UI 短验尝试：在安装前因电脑操控初始化失败收尾

2026-10-26。用户已明确回复“已正常退出，可以临时安装短验”。本轮**未创建生产备份、未安装 rc.50、未写 Profile／外观／媒体／布局**；日常仍 DSH 0.2.1-rc.3／Whale rc.48／Git Bash 0.1.2。候选本身没有进入真实 UI 验收，不能记为通过或失败。

## 实际完成与保护

工具证据：`F:\dsh-wallpaper-plugins\.tmp\rc50-ui-short-trial-20261026-a`。工具与固定包指纹复核后记录本轮直接授权；新鲜 `preflightRetry-result.json` 通过：DSH／WallpaperProbe／伴随 Edge 均为零，原 WE 本轮读取 PID 11076、StartTime `2026-10-26T00:53:12.0617300Z`，安装版本 rc.48。身份仅供本轮审计，不能用于下一轮操作。

结束前再次只读核对日常 43 文件与固定 rc.48 一致，325 保护输入保持；计划生产备份目录不存在，backup／install 阶段未执行。没有应用窗口操作、退出／重开、播放采样、DSH 模型请求、原 WE 终止或系统设置修改。用户退出后 DSH 当前保持关闭，需用户按日常方式正常重开。

## 授权时间读取补修

首次实际预检在 `trial-gate.ps1` 中拒绝：PowerShell `ConvertFrom-Json` 默认将 ISO 时间转成日期对象，而新加的时间字符串类型门禁期待 string。此前纯内存授权正例不能代替真实序列化路径；首次失败的 `preflight-result.json` 和 stderr 保留。

本轮临时工具显式使用受支持的 `-DateKind String` 读取授权；新恢复预检也保留备份／播放／清理 JSON 的日期字符串，避免原 WE 精确启动时间比较经过默认字符串转换丢失小数精度。11 项真实序列化正负例与恢复时间精度检查通过，所有 PS 重新解析通过；实际直接授权校验通过，随后独立 preflightRetry 正常完成。安装前置引用新的成功 proof，旧失败不覆盖。补修未改变候选源码或生产资产。

证据：`datekind-validation.json`、`datekindValidation-result.json`、`runtime-tools-fingerprints-after-datekind-fix.json`。下次适配应保留该补修，准备阶段验证真实 JSON 读入正例；不能仅复制最早的 prepared-tools-fingerprints。

## 电脑操控故障

已读 [computer-use SKILL.md](C:/Users/HP/.codex/plugins/cache/openai-bundled/computer-use/26.1021.31345/skills/computer-use/SKILL.md) 及 guidance／confirmations／api。技能要求使用 `node_repl` 中的 `@oai/sky`；guidance 原文为“Use `node_repl` JavaScript for all Computer Use actions.”

本轮 `node_repl` 尚未执行 import，即返回：

`failed to write kernel assets: 系统找不到指定的路径。 (os error 3)`

重置 JS kernel 后重新初始化仍同错；备用已提供的 `cua_repl` 首次 `getState` 也在执行代码前同错。因此没有取得可用窗口对象，更没有输入或截图。只读确认 TEMP／TMP、当前工程及本会话可视化目录存在；有限日志检索未找到可确定缺失目标路径的证据。公开官方排错页未提供本错误的确定解释。具体根因未定，不归因于插件，也不声称重启必然解决；没有新建猜测目录或修改 Codex／浏览器／Windows 配置。

按原计划本轮由助手代点；电脑操控不可用时不继续安装并转交用户长步骤。`closed-out.json` 记录安装前终止，直接授权另存为 `authorization-aborted-before-install-retained.json`，不沿用本轮退出状态执行后续动作。

## 下一步

用户可正常重开日常 DSH；方便时尝试正常重启 Codex 后继续。下轮先确认电脑操作接口可初始化，再从本轮已补修工具建立新的隔离轮次，核对固定包与工具，并重新确认当时方便／无任务和关闭状态。新备份后才安装 rc.50；仍由助手代点，默认测后恢复 rc.48 和该轮原设置。当前不绕过操控工具、不安装发布或开启其它专项。

没有提交推送、清理、跨会话派发或定时任务。
