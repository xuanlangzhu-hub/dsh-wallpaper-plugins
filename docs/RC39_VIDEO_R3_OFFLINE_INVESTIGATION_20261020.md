# R3 视频静止：路径、启动链与保留帧离线复核（2026-10-20）

后续实测：[无采集可见源黑屏、WE打开失败及路径编码线索](RC39_VIDEO_R3_SOURCE_ONLY_RESULT_20261020.md)已记录；当轮20秒观察/正常收尾与用户重开确认完成，日常rc.38保持。下文为准备/离线阶段历史。

## 当前结论

**离线未发现明确的视频路径错配或命令构造错误；尚未定位静止根因，不改视频/捕获实现。** R1/R2 已通过[上一轮源码复审](RC39_PLAYBACK_UI_GROK_REPAIR_REVIEW_20261020.md)，本轮只推进 R3。日常仍是 DSH 0.2.1-rc.2 / 外观 rc.38 / Git Bash 0.1.1；本轮没有操作窗口、安装、采集、播放/解码媒体、修改 Profile/WE 设置或生产资产。

用户允许继续使用 Grok；本轮已调用既有受监督 CLI 做独立文本复核，73.025 秒完成，正常退出且已确认回收。其输出另经 Codex 校验，纠正了焦点遗漏与删除证据的建议，没有原样执行。

## 选项、路径和容器

从[原失败轮](RC39_VIDEO_LIVE_FINDINGS_REPAIR_TASK_20261020.md)的公开 ID 出发，只枚举既定 workshop 根目录的一级目录名，用产品相同的规范化路径 SHA256 规则匹配；只读取匹配项目的 project.json，未读取其它条目内容或任何分级预览。

| 项目 | 结果 |
| --- | --- |
| ID | `we-44ebe568602e78737f604f1d` |
| Workshop 目录 | `E:\SteamLibrary\steamapps\workshop\content\431960\3790716675` |
| 当前项目声明 | video / Everyone |
| 媒体声明 | `[绯莎]蓝色大肥鱼 deepseek娘化.mp4`，位于该项目内 |
| 大小 | 43,235,218 字节，非空且可读 |
| project.json SHA256 | `bcdc6d6db00842721ee8b5c57c578b9f4480dfbf32e6e4a2090ea4d555c917c9` |
| 容器 | ISO BMFF，isom / iso2 / avc1 / mp41 |
| 视频轨 | avc1，3840×2160，AVC profile 100 / level 51，362 个样本，30.0 样本/秒，12.0667 秒 |
| 音频轨 | mp4a，44100 timescale，约 12.0744 秒；未解码/试听 |
| 总时长 | movie header 12.075 秒 |

受限元数据解析器只读 ftyp/moov 中所需字段，跳过 mdat，实际读 779 字节；有 atom 数量、读取预算和时间上限。解析前后媒体 size/mtime 一致。视频时间表与样本数相符，**不能据此证明每帧可解码、内容必然动态、WE 能播或当时媒体字节与现在完全相同**。没有保存/显示帧内容，也没有为此安装 ffmpeg/codec。

## 真实 rc.39 启动链复核

重新读取固定归档 `release/plugins/dsh-whale-mist-0.6.0-rc.39.tgz`，SHA256 仍为 `FBF1B015A93403F6B3E1F442AE105DBCCF0163C0EEC1045713D85C06DB2D6121`。从其实际字节提取 library/session/依赖到本轮隔离目录，原生源码按原候选构建来源留档复核；没有用当前含 Trace 的开发源替代实际候选。

1. 目录扫描以仅含已批准条目的索引替身代替，不扫描其它内容；实际 `verifyCatalogEntry` 重新核验真实选中项目、批准根及媒体路径。
2. 实际 `library.resolveSelection` 返回 MP4 entry，实际 `createPreviewSession.create` 产生 `--we-open <新合成location> <该MP4> 1280 720 --initial-offscreen`。
3. helper 边界被明确替换并故意返回 `offline boundary: launcher replaced`，确认 native spawn=0、无捕获/真实源窗。预期模拟失败已收束；129 毫秒退出，无超时。这是路径/参数回放通过，**不是播放或清理实机验收**。
4. 原生 `OpenWallpaper` 使用 `-control openWallpaper -file <quoted file> -playInWindow <location>`，初始屏外分支加 x/y/borderless。当前文件名含空格，现有 QuoteArgument 会加引号；参数通过 CreateProcess 传递，不经过 PowerShell/cmd 方括号展开。没有找到需要补转义的本文件名问题。
5. 实际归档路由默认 `offscreenStart = process.env.WM_WALLPAPER_OFFSCREEN_START !== '0'`，不能只看 session.create 的参数默认 false。失败轮 `tucked.strategy=initial-position` 与初始屏外路径一致。

官方[CLI 文档](https://help.wallpaperengine.io/en/functionality/cli.html)明确允许直接 MP4 路径和命名 playInWindow；这只支持命令形式，不证明该媒体的解码或 WGC 捕获成功。

原失败轮没有保存完整 helper 开窗 argv；本轮是从准确候选源码和现存批准文件进行重建/回放，**不能冒充当时实际启动命令的直接记录**。原日志位置 2731,0 与 DPI 读数相关；没有当轮物理虚拟屏边界证据，不能仅凭坐标数字断言离屏面积。

## 保留帧回放与时序

原生最终统计：4610 帧、changed=1、159.667 秒，正常 parent-stop。保留策略是有界采样+密集尾部，共 1200 行，不是完整 4610 行逐帧存档。

| 复核 | 结果 |
| --- | --- |
| 保留序号 | 30–4610，共 1200 行 |
| JPEG SHA256 / 字节数 | 唯一哈希、全部 16699 字节 |
| WGC SystemRelativeTime | 1200 个互异且严格递增，跨度约 156.989 秒 |
| changed | 保留行全为 1 |
| 可见性 API 标记 | 全部 visible=true，无 minimized/cloaked |
| 前台标记 | 1080 行 false、120 行 true，两组均为同一哈希 |
| DeleteTab 触发前 | 保留 9 行，哈希已经相同 |
| DeleteTab 完成后 | 保留 1187 行，仍为相同哈希 |

原生源码在每次有效 frame 后复制该 frame.Surface、编码到新 stream、读入新 lastBytes 并重新 SHA256，然后比较 previousHash；changed=1 包含首次从 null 到首帧的变化。未发现“只更新计数、复用首次 hash”的明显实现错误。这不能验证 Windows/GPU 实际表面或每次 readback 的正确性。

因此，不能把新时间戳解释成视频画面确实在动；同时，日志不支持把约 10 秒后的 DeleteTab 当作首次静止的触发点。120 条前台记录仍静止，也使“只因没获得焦点”不足以单独解释本轮；这不是经过控制的焦点实验。

**纠正过程留证：** Grok 原报告说焦点无记录，Codex最初口头说全部非前台，均不准确。完整统计发现 mixed foreground，已修正文档和 disposition，不删原始输出。Grok 建议清理探针目录也未采纳，所有证据保留。

## 尚待区分的方向

| 假设 | 可证伪观察 |
| --- | --- |
| WE/源本身没有输出动态（含开窗、解码、屏外策略） | 同一 MP4 的屏内无采集源窗正常动态，会削弱“这个 MP4 在任何窗口都不能播”；若仍静止，先查源端 |
| 源动态，但捕获/读取视频表面静止 | 可见源动态时，新增同一窗口的受控捕获仍只有一个 hash，才支持捕获方向 |
| 采集动态但 DSH 显示静止/覆盖 | 新实测须先证明采集 hash/内容有变化，再与 DSH 展示对照；既有 drawCount 不能排除或证明 |

本轮没有建立能离线复现 WE/WGC 静止的执行环境；可重放的是路径/参数和日志统计。按 diagnose 工作流，不在缺少实际源动态对照时猜一个生产修复，也不把官方视频/codec通用排障建议当成本机根因。

## 下一轮具体方案（尚未执行）

后续：[source-only运行器离线准备](RC39_VIDEO_R3_SOURCE_ONLY_PREPARATION_20261020.md)已通过33项检查，当前尚未收到真实开窗阶段所需的当时方便/退出确认，尚未新备份或实机。下文方案保持。

先做一次**同一批准 MP4、可见、无采集源窗口**观察，不安装插件，不复跑旧 rc.39 的 DSH 短验：

1. 按 [AGENTS](../AGENTS.md) 取得当时方便/无任务确认：暂停其它助手，停止 DSH 壁纸并菜单正常退出；原 WE 保持。关闭后新备份当前设置，不沿用旧备份覆盖后续数据。
2. 复核原 WE 当轮路径/启动身份、日常 rc.38 原包与安装文件、批准媒体路径；使用隔离目录内已核验、允许 MP4 的 rc.39 原生 helper，仅走窗口管理入口，不安装至日常、不启捕获。执行前再完成本轮有界 source-only runner 的针对性准备/离线负例核验，不直接复用旧三体/rc.28脚本。
3. 只打开新唯一 location 的屏内普通窗口，绑定当轮 HWND、PID、启动时间；不加初始屏外、不移动到屏外，不改全局 WE 播放/暂停、解码器、设备或系统设置。不读取任何隐藏分级预览。
4. 准备就绪后由用户观察约20秒（长于12秒视频长度），总观察上限25秒；正常关闭仅该新源窗。提前关闭/异常/超时立即进入有界收尾；窗口或进程身份不确定就保留并报告，不盲杀原 WE。若用户没有及时反馈，仍按上限收尾，不重复等待/重试。
5. 核对该 location 消失、原 WE 身份保持，保留全部新证据；恢复本轮有变动的设置并核验，正常重开由用户确认。源动/不动/不确定均如实记录。

这轮相对旧实测同时去掉了采集与屏外路径，属于先拆边界的观察，不能称严格单变量因果证明。若源动态，再另排只增加屏内捕获的对照；之后才单独改变屏外位置。后续动作依新的许可范围，不自动连做全部实验。

## 证据与保护

证据根：`F:\dsh-wallpaper-plugins\.tmp\video-r3-offline-20261020-5f59c108`。

- `approved-selected-item.json`、`selected-project.json`、`selected-path-metadata.json`：只含批准条目与项目。
- `inspect-mp4-metadata.py` / `mp4-container-metadata.json`：受限容器读取，不解码。
- `archive-source-binding.json`、`frozen-rc39/`、`frozen-native/`：真实候选归档与源码绑定。
- `selected-argv-replay.mjs` / `selected-argv-replay.json` / `argv-replay-exit.json`：真实模块+明确IO替身的参数回放。
- `frame-log-replay.json`、`incident/`：旧日志副本及完整保留样本统计，不含JPEG内容。
- `grok-r3-review-request.json`、`grok-r3-review.json`、`grok-independent-disposition.json`：任务、原输出与独立纠偏；worker证据 `C:\Users\HP\.codex\tools\grok-worker\runs\rc39-r3-evidence-review-90eab768`。
- `protected-before.json`、`git-status-before.txt`、`final-verification.json`：214项源码/QA/scripts/assets/manifest/固定归档保护及退出证明；不提交推送、不清理。

本轮只新增离线证据和文档。没有产品实现补丁，因此不重复整套209项UI/Host回归；针对新诊断方法执行了容器元数据读取、保留日志统计和准确候选的参数回放。R3保持未知，rc.39不得日常准入；工作区版本/assets冻结rc.30，日常rc.38保持。
