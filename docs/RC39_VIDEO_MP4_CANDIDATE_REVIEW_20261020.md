# rc.39 本地 MP4 视频候选：独立构建与核包通过（2026-10-20）

实机结果：**rc.39视频验收失败，已恢复rc.38并获用户重开确认**。参见[现场复现/补修任务](RC39_VIDEO_LIVE_FINDINGS_REPAIR_TASK_20261020.md)。下文离线通过仅为历史核包范围，不能当作准入日常；本包归档保留、不得覆盖或直接再试。

最新进展：[本轮临时短验已获授权并新备份/安装核验35项](RC39_VIDEO_MP4_SHORT_TEST_20261020.md)，当前待正常重开/选择MP4；下文“未安装”为候选核包阶段状态，实机尚未通过。

**已完成候选准备、实际解包检查和原生离线验证，未安装。** 当前日常仍是 DSH 0.2.1-rc.2 / 外观 rc.38 / Git Bash 0.1.1。视频实际画面、编码、音频、循环与长期效果尚未验收。

## 不可变候选

| 项目 | 结果 |
| --- | --- |
| 归档 | `release/plugins/dsh-whale-mist-0.6.0-rc.39.tgz` |
| SHA256 | `FBF1B015A93403F6B3E1F442AE105DBCCF0163C0EEC1045713D85C06DB2D6121` |
| 大小 / 文件数 | 7,160,806 字节 / 35 regular 文件 |
| 基底 | 固定 rc.38，`B417B73F93973564522839CE803AF1BB0AAA2072D35C24E5ACEF0E2C42CF0DEA` |
| 差异 | README、manifest 版本、6 个产品 JS 的 MP4 局部差异、WallpaperProbe.dll，共 9 项变化；26 项不变，无增删 |
| 原生 | 11 个运行文件沿用 rc.38，仅 DLL 替换；无 Motion Cadence Trace |
| 保护 | 212 项开发源码/QA/资产/manifest/旧归档输入漂移 0；工作区仍 rc.30，生产 assets 保持 |

证据目录：`F:\dsh-wallpaper-plugins\.tmp\rc39-video-candidate-20261020-6a8d759a`。关键文件：`native-provenance.json`、`mp4-transplants.json`、两份 C# diff、`archive-audit.json`、`run2/regression-results.json`、`native-validation-results.json`、`native-pure-results.json`、`final-audit.json`。

## 来源与移植审计

rc.38 的 12 个原生运行文件逐一等同 [rc.31 P4 构建证据](../.tmp/rc31-p4-candidate-20261015-152630-ed24ea48/native-runtime-hashes.json)。从该轮原生源码留档取得 18 个文件，逐项匹配当轮已审输入指纹；16 个保持，只有：

1. `SourceWindowHelper.RequireProjectFile`：接收绝对 JSON / MP4，拒绝其它后缀、相对/设备路径、ADS 和控制字符等。
2. `Program`：增加任何桌面访问/枚举/启动之前的 `--validate-wallpaper-file` 纯校验入口。

原生 publish 在本轮独立目录完成，exit 0 已确认。新发布的依赖、deps/runtimeconfig 与原包一致；新编译器 apphost 未装入候选，保留 rc.38 原启动器，实际测试由这个保留 EXE 加新 DLL 执行，已证明它能加载并运行新入口与自测。PDB 仅留证，不入包。

JS 从固定 rc.38 解出，仅按[上一轮 MP4 复审](WALLPAPER_VIDEO_MP4_OFFLINE_DELIVERY_20261020.md)提升前后差异移植，逐块要求唯一完整上下文匹配；没有整份复制当前含诊断的开发 client/session。只改登记/重新核验、解析 MP4 媒体路径、JS 文件参数校验和三端类型门禁/文案；Host session、采集/清理算法、Edge guest/身份核验与主端收尾顺序保持 rc.38。

manifest 解析后只有版本变化；兼容声明、权限、main/exports/files 不变。35 个成员拒绝链接、重复/大小写冲突、绝对/穿越路径，实际重新解包逐字节匹配。15 个 JS 语法、16 条静态相对 import 闭包和 Trace 特征检查通过；未打入 QA、用户壁纸、Profile 或凭据。

## 实际候选离线检查

| 检查 | 通过 |
| --- | --- |
| Host、目录、选择、会话、清理与 UI（含 MP4 路由） | 112/112 |
| P0/P1A、目录初始化与 MP4 年龄门禁、主端收尾 | 61/61 |
| MP4 专项 | 7/7 |
| 实际保留 EXE + 新 DLL 的 JSON/MP4 参数正负例 | 12/12 |
| P4 原生等待生命周期自测 | 54 项 |
| 原生 pacing | 22 字段一致、0 mismatch |
| 有界 frame log | 10 项、failed 0 |
| 实际采集 CLI 纯解析 | 5 项，含 daily/preview 与缺少归属、错误模式/FPS 拒绝 |
| JS / CSS / import | 15 文件 / 守卫 / 16 条闭包 |

测试导入的是新 tgz 解包得到的真实产品字节，QA 复制在解包目录旁支，不在归档。Host 原生/进程边界及浏览器/React 使用明确替身，真实 loopback Host 不等于真实 Edge/DSH。原生自测中的关闭协调包含 mock，不能扩称真实 worker/源窗口收尾通过；未做 WGC/视频画面采样、GPU 或精度对比实验。

所有监督子进程设置截止、记 PID/退出；最终任务均 exit 已确认且无超时。首次 Host 测试缺少 `qa/temp-profile.mjs`，补复制该 QA 依赖后原断言通过。首次收尾套件 5 项出现 fetch `bad port`；单独 9 项、完整 24 项诊断以及恢复原测试后完整 61 项均未复现。原始失败及 URL 诊断保留，原因未知，没有改产品代码或删断言迁就检查。该离线现象不写成已修复的用户实机问题。

## 功能范围与下一步

候选允许已登记且每次重新核验的本地 MP4 video 手动实验播放，scene 沿用；不等于所有编码都可播。Lucy 自动播放名单不扩大，默认 Everyone，Questionable/Mature 和 unknown 的过滤规则保持；web/application/其它视频容器仍拒绝。

下一步只做一次受控短验，**尚无本轮实机方便/退出确认**：

1. 按 [AGENTS](../AGENTS.md) 重新确认当前方便、其它助手暂停、DSH 无任务；停止壁纸并菜单正常退出，原 WE 保持。
2. 关闭后新建本轮备份，保存当时实际集合的 Profile 文件、关闭状态外观存储、布局、活动 rc.38 归档/安装文件及原 WE 身份；不用上轮备份覆盖新增数据。
3. 官方 CLI 临时安装固定 rc.39 并核验 35 项，正常重开确认原外观/布局、目录与分级，播放先保持停止。
4. 用户选一项本人认可的 Everyone、本地 MP4 video，手动播放约 20 秒并观察；失败即停，不反复重试。停止后核对本轮采集/worker/源窗口清理，再做 Lucy 简短切换回归。不自动打开隐藏分级内容；音频不在这轮验收范围。
5. 默认测后正常退出，先保存本轮新增证据，再恢复本轮 rc.38 和原设置并逐项核验；正常重开由用户确认。是否保留 rc.39 日常另作决定。

本轮没有安装、操作或采样 DSH/WE，没有模型请求、跨助手派发、提交推送或清理。定时仍暂停，A/三体/GPU 暂缓；网页、应用类及作者参数等待这项实际验收后再排。
