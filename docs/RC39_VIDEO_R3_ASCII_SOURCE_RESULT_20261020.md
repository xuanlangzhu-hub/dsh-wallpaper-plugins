# R3 ASCII路径副本无采集源观察结果（2026-10-20）

## 结论

**用户确认：同一SHA256视频的ASCII路径副本能正常播放。** 与[原中文路径源窗口黑屏](RC39_VIDEO_R3_SOURCE_ONLY_RESULT_20261020.md)及WE日志文件名损坏/打开失败结合，当前主要定位为路径兼容相关，中文转码为强线索，尚未严格证实唯一内部转换边界。

这说明该文件字节在同一WE进程、当前环境下能够通过这条ASCII源路径播放；不能再把当前问题笼统归因于“4K/H.264内容本身不能解码”。但副本同时换了目录和盘符，不能把对照表述成只有中文字符不同，也没有验证DSH/WGC、音频、帧率、所有视频或长期循环。

本轮计划20秒，实际 **13.019秒** 时检测到可见性改变并正常收尾。用户确认做过最小化或切换窗口/桌面，且在此前已看到正常视频；因此记录为**提前结束的有效播放观察**，不是完整20秒通过。脚本worker的ok=false和可见性门禁失败原样保留，不改测试/结果迁就结论。

用户已确认“重开正常，外观布局正常，播放停止”；日常外观rc.38保持。本轮没有安装、修改原视频、系统codepage/codec/GPU或生产资产，也没有开启采集或自动重复本轮。

## 本轮事实

用户重新确认“已正常退出，可以做英文路径对照”，重新执行新备份/基线；没有复用前轮已退出状态。

| 项目 | 证据 |
| --- | --- |
| 新备份 | `C:\Users\HP\.dsh\backups\video-r3-ascii-source-20261020-7367e3a9`，5个Profile、9个外观存储文件一致 |
| 日常 | rc.38归档和35安装文件核验一致，DSH0.2.1-rc.2/Git Bash0.1.1保持 |
| 媒体 | `F:\dsh-wallpaper-plugins\.tmp\video-r3-ascii-source-20261020-7367e3a9\clip.mp4`，完整ASCII路径 |
| 原/副本 | 均43,235,218字节，SHA256 `27f9251e96e20bedbd0b2e7c1ef6f0e63ffd3bba90d7a6deb52d850a90c87364` |
| location | `WhaleWallpaperProbe-video-261020023843-103e9220` |
| 实时绑定 | HWND4198016；原WE PID11980、完整路径及创建FILETIME134369309316465382核验一致 |
| 窗口 | 客户区1280×720，初始外框[266,266,1568,1042]完全在work area内，可见且非最小化/cloaked |
| 时间 | 北京时间约10:38:54 ready，约10:39:07开始收尾；ready至closing13.019秒 |
| 中止 | `source hidden/minimized/cloaked`；用户确认“我最小化或切换过窗口/桌面”，无法从统一错误文字进一步指定是哪一个API标记改变 |
| 清理 | 自有location正常closed；两次管理helper退出0、worker退出1、父监督确认退出且未超时；没有杀原WE |
| 收尾后 | 原WE身份保持、源为空、无采集/伴随任务，日常安装及设置与本轮新备份一致；不覆盖恢复本来没变的设置 |
| 用户验收 | “视频正常播放过”；随后日常正常重开、外观布局正常、播放停止 |

helper命令只有一次 `--we-open <location> <ASCII副本> 1280 720`和一次带期望PID的 `--window-ensure-closed`；没有initial-offscreen、capture、taskbar worker、全局播放/暂停。没有自动重试。

## WE日志对照

运行前记录WE log.txt字节数、完整SHA256和行数；运行后验证原前缀逐字节未变。文件始终550,774字节，本轮新增0字节，因此没有本轮ASCII路径打开失败记录。

**没有新错误本身不是成功播放证据**；成功观察来自用户直接反馈。前轮中文原路径在同一日志中两次出现5种后端打开失败，Media Foundation为80070002，损坏文件名与GBK字节误当UTF8解码结果完全相同；相关字节证明保持在前轮记录。没有新开中文路径、改名或再次采样确认。

## 修复方向与仍待证明

当前先处理Host到WE的路径传递兼容，不继续扩大GPU/解码器排查或改变系统区域设置。原生helper使用Unicode CreateProcess且回执保存了原中文路径；尚不能判定WE启动器、IPC、后端还是日志层中的具体转换位置。目录/驱动器/访问语义也是本轮对照的混杂项。

下一项[受控ASCII媒体桥接离线任务](RC39_VIDEO_ASCII_BRIDGE_OFFLINE_TASK_20261020.md)已写好：原ID/分级与批准路径核验保持，Host内部生成受控ASCII媒体副本，明确限额、哈希/身份再验证、停止代次与生命周期归属。默认副本避免硬链接写入反映至原Workshop；只有自有缓存可清理，原资产和历史证据不删。若无可用安全ASCII缓存根，明确拒绝，不擅自改系统设置或在公共/系统根落盘。

任务目前只有范围/验收文档，**没有开始产品实现或制作新候选**。后续离线补修和核包通过后，另取得当时方便确认做受控视频播放短验；本轮源播放观察不等于DSH视频接入通过，不恢复旧rc.39日常准入。

## Grok复核

本轮新增一个小范围纯文本设计检查，`r3-ascii-path-fix-design-check-e21d7f16`，监督耗时38.906秒、正常交付、退出确认，无工具调用和真实源码写入。Grok提醒原片禁写/禁删、缓存冲突不覆盖、空间/链接/清理边界、换盘混杂等，Codex纳入任务；其“失败清半成品”建议限定为已证明所有权且无持有风险的临时文件，不能覆盖失败/未知清理时保留的原则。

这项是设计复核，不是实现、独立测试或实机验收。此前超时失败记录保留，没有重启Grok、恢复定时或伪称后台自动唤醒。

## 证据与保护

证据根：`F:\dsh-wallpaper-plugins\.tmp\video-r3-ascii-source-20261020-7367e3a9`。

- `live-authorization.json`、`closed-backup.json`、`ready-baseline.json`：新授权/备份/实时身份与输入指纹。
- `ascii-copy-proof.json`、`approved-media.json`、`prepared-inputs.json`：同一媒体与完整性门禁；34项离线准备检查保持。
- `events.jsonl`、`ready.json`、`worker-result.json`、`supervisor-result.json`、两次helper claim/result/stdout：原始提前中止及真实收尾。
- `post-source-verification.json`、`user-feedback.json`：重开前原设置/原WE/源退出核验与用户正常播放/窗口操作/重开确认。
- `we-log-before.json`、`we-ascii-log-after.json`：WE日志前缀和无新增字节，不以无日志代替播放结果。
- `grok-fix-design-review.json`、`grok-fix-design-disposition.json`及对应worker run：原输出与Codex采纳边界。
- `live-trial-summary.json`、`live-protection-verification.json`、`live-closeout.json`：13.019秒结果、退出证明和保护汇总。

214项源码/QA/scripts/assets/manifest/固定归档无漂移，原MP4和ASCII副本哈希仍一致。没有产品改动、整体打包、安装、推送或清理。开发manifest/assets仍rc.30，日常rc.38保持；重开后的新用户数据不以任何旧备份覆盖。
