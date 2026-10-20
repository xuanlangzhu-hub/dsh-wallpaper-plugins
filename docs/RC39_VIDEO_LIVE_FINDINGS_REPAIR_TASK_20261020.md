# rc.39 实机失败：null 身份、遗漏播放控件与静止采集（2026-10-20）

## 当前结论

**视频实机未通过；rc.39 不进入日常。** 本轮已正常停止自有采集，原 WE 未结束；用户正常退出后按当轮新备份恢复 rc.38 与原设置，35 个安装文件、5 个 Profile、9 个外观存储文件及布局核验一致。测后文件另存，用户已确认“重开正常，外观布局正常，播放停止”。恢复后重新发现 DSH 当前端口12878，只读 Host active=false/error为空、采集进程0、原 WE PID11980/启动时间保持。端口仅是本次证据，未来不能复用。

有三项问题，不能合并成“修好 null 就能播视频”：

1. **R1 / P1：面板读取活动壁纸身份不符合真实 engine 状态形状，稳定复现播放 null。**
2. **R2 / P2：新吸附面板和独立窗漏了日常/预览及自动播放控件。** 用户不是没找到；旧通用设置已有播放模式，指引用户去新面板找它们有误。
3. **R3 / P1：真实 MP4 捕获没有动态画面，根因尚未定位。** 后端开窗/采集和前端 decode/draw 调用不构成视频实际播放验收。

## 后续离线补修状态（2026-10-20）

[R1/R2 Grok补修独立复审](RC39_PLAYBACK_UI_GROK_REPAIR_REVIEW_20261020.md)已通过并逐文件合入源码：209项测试、语法和CSS检查通过，失败保存回退反例已补。没有打包、安装或新实机；R3静止仍未解决，rc.39失败结论和日常rc.38保持。下文为原失败事实及验收要求。

## R1：真实状态字段与面板读取错位

实际 `createWallpaperEngine` 初始状态仅包含 state/error/host/generation/cleanupPending；启动结果保存到 host，画面后续只更新 state 等指标。活动 ID 位于 `getStatus().host.activeSceneId`，并非保证存在顶层 `activeSceneId`。

实际候选主端面板 `src/client.js` 5125–5129：先从 bridgeState 或 controller 取得 wallpaper 状态，随后只读 `wp.activeSceneId || null`。5164 的 mismatch 把 `playing + null + 已选ID` 当成另一张，5737 的模板直接插入 null。独立端 `src/companion/companion.js` 也有仅取顶层 ID 的路径。共享 snapshot/权威执行器已有 host fallback，显示层却不一致。

隔离加载**实际候选完整 client 模块**和既有 React/定时器/网络替身，三组对照：

| 输入 | 实际输出 |
| --- | --- |
| idle，host.active=false，host.activeSceneId=null | 开始可用，无 mismatch |
| playing，host.activeSceneId=所选视频 ID，无顶层 ID | 开始不可用，出现“当前正在播放「null」…” |
| 同上，唯一增加顶层 activeSceneId=所选 ID | mismatch 消失 |

因此，原截图不证明系统从空闲凭空冒出播放。首次只读 Host 的确空闲；用户点击开始后，后端实际启动了指定视频，而面板错误显示 null。当前证据没有复现“真正 idle 时出现 null”，不能扩写。

最小补修：统一读取真实活动身份，主面板/独立窗/共享 snapshot 一致；未知身份显示明确未知或待确认，不能插入 null/undefined 或凭所选项冒充活动项。真实另一张、身份未知、清理锁、并发启动仍须保守保护。覆盖实际 client engine → snapshot/bridge → 两种视图，而不仅是顶层字段齐全的假状态。

## R2：新面板遗漏控件

实际 docked 树找不到 daily/preview select；独立 HTML/脚本也没有相应输入。开始回调只是读取已存 `settings.weMode`，因此本轮后台实际为 daily，但用户无法在新面板切换。旧通用设置包含“播放模式”“日常（持续播放）”“预览（限时）”与自动播放勾选，不能拿旧页存在代替新视图交付。

最小补修：在两种新视图接现有 weMode/weAutoStart，共享 controller/认证动作和修订机制；切换不自动开播，不在播放中另建管线。活动/启动/停止/清理期间明确禁用或标注仅下次生效，保持 Lucy-only 自动播放验证名单，未验证 video/scene 不扩大自动播放。真实事件要验证设置持久化、两端同步、重开保持及旧通用设置一致，而不只查文字或提取一个表达式。

## R3：传输和绘制在运行，但采集表面不变

本轮选项由 Host 公开元数据核对为 Everyone/video/available，ID `we-44ebe568602e78737f604f1d`，用户已选中并尝试开始。仅检查该已批准元数据，没有抓取隐藏分级预览或查看帧内容。

| 证据 | 结果 |
| --- | --- |
| 本轮 location / capture PID | `WhaleWallpaperProbe-261020013710-281a` / 32872 |
| native 总时长 / 帧 / changed | 159.667 秒 / 4610 / 1 |
| 最终停止原因 | parent-stop |
| 客户端 decode / draw 调用 | 3057 / 3057 |
| decode / draw error | 0 / 0 |
| native 窗口关闭 | closed、safeToCleanUp=true |
| Host 关闭复核 | absent、closed=true |
| 退出后现场 | 捕获进程0，原 WE 身份保持 |

`changed=1` 表示这轮捕获到的表面哈希仅首次变化，不能单凭此断言源视频暂停、视频文件坏或 WGC 无法捕获。drawCount 只证明有调用，不代表屏幕显示视频、物理 FPS 或流畅。用户反馈未正常播放是本轮验收结果，不能用零错误或几千帧推翻。

最小后续定位顺序（当前未执行新实机）：

1. 离线核验被选项目的声明/真实媒体路径、Host argv、文件容器/编码元数据，确认不是其它条目或路径漂移；不调整用户播放器/系统策略，不读取隐藏内容，不启动源窗口。
2. 列出三个可证伪方向：源/WE 未输出动态（同一受控源窗本身也静止）；捕获视频表面失败（源窗有动态而 WGC 哈希不变）；DSH 呈现/覆盖问题（采集动态而 DSH 不显示）。现有 decode/draw 计数不能独自排除呈现问题。
3. 需要新窗口时另取得当时方便确认、新备份，以同一个批准 MP4 做短同源可见对照，保持原 WE；一次只改变一项，先分源动态与捕获动态，再查下游。若无法安全区分，记录未知，不盲换编解码器/设备策略。
4. 下一次短测加本轮身份绑定的有限时监督：达到约定观察期限即提示/通过正常停止接口结束该轮；不要在日常模式下因 UI 误导继续空跑。本轮原计划约20秒，实际运行约160秒，不能报为20秒通过。

## 可复现证据与验收

证据：`F:\dsh-wallpaper-plugins\.tmp\rc39-video-short-trial-20261020-e75e9c0a\reported-null-e3e6b4cd`。

- `status.json`、`pre-normal-stop-status.json`：故障时真实 Host/前端状态；`normal-stop-result.json`、`post-normal-stop-status.json`：正常停止200及关闭证明。
- `run-after-stop/`：当轮最终原生/Host/worker日志与有界元数据，未保存或展示 JPEG/用户视频内容。
- `frozen-candidate/`、`diagnosed-product-hashes.json`：真实候选相关产品与 QA 冻结。
- `reproduce.mjs` / `reproduction-results.json`：三个状态对照。
- `regression-red.test.mjs`：R1/R2 两项**预期失败**断言、一个空闲正例，原候选为 pass1/fail2；`run-red.cjs` 有7秒外层截止，子进程 exit1 已确认。这是缺陷复现，不是修复通过。

补修验收须让红例转绿，补真实 engine 状态形状、两端 UI 和控件事件；保留另一张/未知/迟到状态/清理失败/年龄过滤/Lucy名单负例。R1/R2 离线通过以后，R3 仍单列未解决；不能把旧候选重新标通过，不能覆盖 rc.39 原归档。下一包另定新版本并从固定基底最小移植，工作区生产 assets/版本不动。

本轮只读诊断、隔离复现/证据和既定恢复，没有改产品实现、重新打包、安装新修复或开启新专项。源码/QA/生产资产/固定归档保护保持；没有模型请求、杀原 WE、推送或清理旧证据。
