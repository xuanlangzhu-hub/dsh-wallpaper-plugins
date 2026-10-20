# rc.39 播放身份与遗漏控件：Grok 补修独立复审（2026-10-20）

## 结论

**R1、R2 源码离线通过并合入开发工作区；R3 视频静止未解决，rc.39 实机失败结论保持。** 日常仍为 DSH 0.2.1-rc.2 / 外观 rc.38 / Git Bash 0.1.1。本轮没有操作日常 DSH/WE、读写 Profile 或日常浏览器存储，没有打包、安装、修改版本号、覆盖固定归档、提交推送或清理。

用户本轮明确授权使用 Grok。Grok 通过既有受监督 CLI 在隔离输入中交付精确补丁，Codex 负责冻结、独立红例/回归、审查及逐文件合入；没有让 Grok 直接修改日常安装或整个脏工作区。

前置事实见 [rc.39 失败与补修任务](RC39_VIDEO_LIVE_FINDINGS_REPAIR_TASK_20261020.md)。本报告不把几千次 decode/draw 或 UI 修好当成视频播放通过。

## Grok 调用与期限

调用器：`C:\Users\HP\.codex\tools\grok-worker\run.cjs`，沿用既有 auto 隔离规则，无全局权限/模型配置修改，也没有恢复定时或声称闲置自动唤醒。

| 任务 | 监督耗时 | 结果 |
| --- | ---: | --- |
| 合并 R1/R2 首次尝试 | 361.740 秒 | 360 秒截止触发；只完成读取，没有可接受补丁；worker/子进程退出已确认，未合入 |
| 小任务 R1 | 38.301 秒 | 返回三处精确编辑，Codex 核验后应用到隔离 stage |
| 小任务 R2 | 54.786 秒 | 报告和八处控件编辑交付；独立测试发现保存失败不回退 |
| 回退/嵌套身份/默认值补修 | 20.944 秒 | 四处编辑交付，反例转绿 |
| 回退 DOM 空值保护 | 12.848 秒 | 两处最小保护交付，复查通过 |

后四项采用显式 low reasoning effort 与小范围任务，text 任务不启用工具，R2 离线任务仅用获准的读取/精确编辑工具。每项均有总期限与外层监督；所有本轮任务的 `workerExitConfirmed=true`，没有未回收的 Grok 子任务。6 分钟首次失败保留为失败证据，不能用后续成功掩盖。

调用证据在 `C:\Users\HP\.codex\tools\grok-worker\runs\`：

- `rc39-ui-null-mode-repair-6af617e5`
- `rc39-null-three-text-80b64bb6`
- `rc39-playback-controls-r2-8bf5fc71`
- `rc39-controls-rejected-rollback-b2d13542`
- `rc39-controls-null-dom-guard-abc290b1`

## R1：按真实 engine 形状读取活动身份

主端面板、独立窗画廊/详情及新增控件门禁，先验证顶层 `activeSceneId`，否则验证 `host.activeSceneId`；无有效身份时保留未知，不能拿所选 ID 充当当前 ID。主端未知 mismatch 提示改为“当前活动壁纸身份未确认，请先停止播放”，不再插入 null/undefined。另一张、未知、清理及活动门禁保留。

Codex 在补修前建立红例，补修后用实际 client 模块的 `createWallpaperEngine.start → acceptFrame → getStatus → WhaleDockedAppearancePanel` 链路验证：Host 启动替身仅返回真实嵌套形状，实际 engine 达到 playing，顶层身份确实不存在；所选同一视频无 mismatch。未知/另一张仍保守禁止重复开始。假 JPEG 解码、RAF 和流读取为 IO 替身，没有采样真实窗口或媒体。

## R2：新面板补齐现有设置

吸附面板和独立窗新增“播放模式（日常/预览）”及“随 DSH 启动自动播放”，连接既有 `weMode` / `weAutoStart`；不改默认设置、协议、Host、采集或视频逻辑。

- 主端走原 controller.set；独立端走现有串行设置队列、修订和权威执行器。
- 播放/启动/停止/清理锁、已有活动身份、独立端断连/繁忙时禁用；主端已 detached 时不能写。
- 缺失/无效模式回到既有默认 preview，布尔值严格校验；Lucy-only 自动播放名单保持，修改设置不立即开始播放。
- 初次 R2 独立测试为 25 项、24 通过/1 失败：服务器拒绝设置后，控件仍显示乐观值。已由 Grok 补充强制权威回退，并补 DOM 可选节点保护。
- 新处理函数曾再次遗漏 nested Host 身份，另补“绕过 disabled 属性仍不得写”的反例，修复后通过。

实际 controller 自动播放 effect 在页面生命周期开始时冻结选择，仅下一次启动生效，不随设置变动重跑；本轮没有扩大验证名单或建立新播放管线。

## 独立检查与边界

| 检查 | 结果 | 实际覆盖 |
| --- | --- | --- |
| 新播放 UI 专项 | 29/29 | 实际主端模块/引导段/面板、实际独立端模块/DOM 事件、实际 revisioned contract/executor、真实 engine 状态链；IO 与 React/DOM 为明确替身 |
| Host 相关回归 | 112/112 | library/scenes/session/routes/managed-window/ui-library/cleanup-recovery-b；外部系统查询被离线 guard 拦截 |
| 独立窗/目录/销毁 | 61/61 | P0、P1A、catalog-init、dispose；末次 DOM 保护后重新通过 |
| MP4 类型与安全路由 | 7/7 | 路径/元数据拒绝、类型边界、权威启动门禁及独立端类型表达式 |
| 语法与 CSS 模板 | 16 项语法、CSS guard 通过 | 与修改相关模块；末次独立端语法再次通过 |

新 QA 包括真实控件事件、枚举/布尔拒绝、主端/独立端快照同步、失败回退、断连、nested/flat/unknown/other 身份和清理门禁。设置记忆由 JSON 存储替身加 fixture remount 证明接线一致，**没有实测日常浏览器持久化或真实应用重开**；也没有视觉/尺寸/主题对比验收。底层设置与自动播放原实现未改，测试不宣称这些实机条件通过。

所有新 runner 有 Node 测试期限及独立外层 watchdog，外部进程只限本轮自建句柄/PID；退出结果均已确认。回归总计 209 个测试（29+112+61+7），末次复跑不重复累计。

## 合入与保护

独立证据根：`F:\dsh-wallpaper-plugins\.tmp\playback-ui-grok-review-20261020-ee2a1670`。

- `frozen/`、`protected-before.json`、`git-status-before.txt`：本轮输入与既有脏工作区保护。
- `dsh-whale-mist/`：隔离补修与独立测试输入；不是生产安装。
- `grok-*-patch.json`：Grok 原样返回并经精确旧值/count 验证的补丁。
- `ui-before*`、`ui-after-r1*`、`ui-after-r2*`、`ui-after-r2-repair*`、`ui-final*`：红例、失败回退反例与最终结果。
- `regression-results.json`、`final-regression-results.json`、各 stdout/stderr/result：截止、退出及测试计数。
- `before-promotion/`、`promotion.json`：逐文件合入前副本和最终 SHA256。

只合入六文件：`src/client.js`、`src/companion/companion.js`、`src/companion/index.html`、`src/companion/companion.css`、`qa/detachable-catalog-harness.mjs`、新增 `qa/playback-ui-regression.test.mjs`。产品补丁由 Grok 交付；独立 QA 和 harness 扩展由 Codex 编写。214 项既有源码/QA/scripts/assets/包元数据/固定归档合入前一致；合入后排除批准六文件，其余保持一致。README/接续文档另作当前状态同步。

工作区 manifest/生产 assets 仍 rc.30；已失败的 rc.39 固定归档未改，日常 rc.38 未动。后续候选须从固定基底最小移植，另定新版本，不能直接整体打这个开发工作区。

## 下一步：R3 仍需独立定位

后续：[R3离线核验](RC39_VIDEO_R3_OFFLINE_INVESTIGATION_20261020.md)已完成路径/容器、准确候选参数回放及保留样本统计；未定位根因，没有产品改动或实机。下一步按该报告先准备有界无采集可见源观察，重新确认当时方便。下文为当时的接续安排。

先核验本轮已批准 Everyone 视频的项目声明、实际 MP4 路径、Host argv、容器/编码元数据，不打开媒体或隐藏分级预览。此项离线检查尚未在本轮展开。

下一次需要真实源窗口时再确认当时方便并新备份。同一批准 MP4 做有界同源可见对照：源本身静止、源动而捕获不变、采集动而 DSH 不显示三种结果分别归因；不能从本轮 UI 绿例推断其中任何一种。原实测 native changed=1 的证据保持。当前不安装、不重试旧 rc.39、不启动 web/application、作者参数、三体或 GPU 新专项。
