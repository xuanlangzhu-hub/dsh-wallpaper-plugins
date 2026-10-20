# 顶栏面板首次目录初始化：离线复现与源码补修通过

2026-10-19，用户要求继续 Grok 后台协作。Grok 在隔离任务中交付复现断言与代码替换方案，Codex 独立执行、复审、要求补空值保护，验证后仅将已审补修并入开发源码。**目录未初始化时的禁用路径已离线复现并补修；语法/CSS检查及31项相关回归通过。日常仍 rc.35，原 rc.36 固定包不含本补修。**

这不确认[上次短验](RC36_DETACHABLE_SHORT_TEST_20261019.md)的实时 catalog.state/loaded，也不把源码检查写成真实独立窗口、吸附或播放验收。

## 复现与缺口

旧 rc.36 的真实 `WhaleHeaderAppearanceTrigger` 只调用 togglePanel；主端 bootstrap 的 togglePanel/openPanel 仅切换面板可见状态，没有目录读取。`WhaleDockedAppearancePanel` 显示内建 Lucy，但开始按钮仍要求目录 state=ready 且 loaded=true。旧通用设置页有首次 `readLibrary({ensure:true})`，顶栏入口缺少对应初始化。

Grok 交付的 probe 加载整个冻结候选 client，执行其真实导出 header、panel 和 createWallpaperEngine；React hooks/虚拟树、bridge carrier 和 metadata fetch 用替身。Codex 独立运行确认：

1. 初次直接打开：只有 Lucy 卡片，目录请求0，缓存null，开始禁用。
2. 点击真实刷新回调：发起一次 POST `/whale-wallpaper/library/refresh`，真实目录状态机变为ready/loaded，开始恢复。
3. 关闭再打开：缓存保持、请求仍1，没有调用播放接口。
4. cleanup-failed/cleanupPending=true 时开始仍禁用。

独立复现证据：`.tmp/rc36-catalog-init-review-20261019-hA1iMq`，`independent-result.json`、冻结 delivered/probe.mjs 和运行日志。Grok任务 `rc36-catalog-repro-low-16f81112` 在low档约31.1秒结束，2次读取、2次编辑；没有终端权限，由Codex先检查代码后执行。

## 补修与复审

仅补主端打开入口，不改 React hooks、开始/清理/分级门禁或其它桥接行为：

- togglePanel/openPanel 打开时调用有界 ensure 读取；已有ready/loaded缓存、其它库刷新或本次in-flight读取时跳过。
- 每次请求四秒上限；关闭、toggle关闭和ctx.effect卸载回调取消，清理计时器并同步释放槽。
- 同步抛错和异步失败均处理，不自动无限重试；重新打开允许重试。
- 旧请求finally只在引用仍相同时清当前槽，避免影响新请求；不启动、停止或切换壁纸，也不改全局设置。

初版 Grok 提案直接读取 cache.loading，而真实首次缓存为null。Codex在隔离阶段运行原引导块时得到明确 TypeError，拒绝提升；失败证据`.tmp/rc36-catalog-init-repair-review-20261019-579OnJ/repair-first-exit.json`及stderr。Grok随后只补三处可选链，原其它取消/身份逻辑保持。首次按LF传递的替换点与Windows CRLF源码不匹配也曾被暂存校验拒绝；只修暂存器的换行序列化，保留原源码CRLF，不归咎产品。

最终隔离复审：`.tmp/rc36-catalog-init-repair-review-20261019-A05yEh`。

| 输入 | client SHA-256 |
| --- | --- |
| 固定rc.36候选原client | `207A8C771B70359166570FAD6A64BDF5686DD755C0FD2AE275E79680E0E580DA` |
| 隔离rc.36补修副本 | `7DAB8E1ACB4848F751853B4E48604AE493DA46C4A642B626D13571A8FD4085D2` |
| 开发源码补修前 | `3EF3F9618B1FEE79E219DCEEFFEEDC4F3EE8C5A9346554A6E9ED45D762DC9D05` |
| 开发源码补修后 | `C71F3375B9216471D605B52F98E63C6ACB0E9AF028070C6FA45660F9C2445760` |

两份源码各只应用四个精确替换点，原候选暂存和固定tgz不写回，开发源码中原有Trace及其它脏改动保持，未用候选client整体覆盖工作区。

## 验证与提升

对隔离候选和开发源码补修副本分别执行12项验证，均通过：原包首次打开负例、首次ensure及缓存复用、单一in-flight、关闭取消/立即重开、四秒超时、异步失败无循环、同步异常、旧结果迟到、新请求槽保护、卸载、缺失接口/缓存接口、非docked拒绝和外部刷新保留自身取消权（按组合分组计数12）。

验证调用真实候选的导出组件、目录状态机及真实private bootstrap代码块；React hooks/tree、生命周期载体、底层fetch与时钟用替身，没有跑真实React调度或创建原生窗口。外部刷新测试首次错误地把调用方主动abort后的Promise当成成功结果；只修独立测试为断言预期拒绝，首错stderr保留，不改产品迁就测试。

提升时先核对开发源码仍等同入场哈希，再写入已审副本，保留其CRLF及全部原改动。既有201项源码/QA/资产/归档保护输入中，仅允许client.js这一项变化；新增两个便携QA文件：

- `dsh-whale-mist/qa/detachable-catalog-harness.mjs`
- `dsh-whale-mist/qa/detachable-catalog-init.test.mjs`

开发源码上 `npm run check` 退出0（含CSS模板守卫）；以下相关回归31/31通过，均有15秒外层时限，进程正常退出：

```powershell
node --test qa/detachable-appearance-p0.test.mjs qa/detachable-p1a-production.test.mjs qa/detachable-catalog-init.test.mjs
```

其中新增11项源码回归、旧P0/P1A共20项。仅在隔离复审中额外保留了原候选首次打开负例；便携回归不需要旧包文件。`regression-results.json`、`promotion.json`及各日志保存实际结果，未重跑无关性能/GPU/三体矩阵。

## Grok协作边界与现场保护

本轮未采用默认长分析无限等候：第一次QA设计240秒截止、初次补修设计120秒截止均未交付，进程正常收束并保留失败。之后按明确替换点拆小任务，仅本次调用使用low档、模型不改；复现断言约31.1秒、紧凑代码提案约56.6秒、空值修复约13.8秒，均完成实际文件编辑。未引用或公开内部分析文本、用量签名或登录凭据；不是权限弹窗/桌面消息卡住。

auto只对任务内允许的文件工具生效；Grok没有执行终端命令或写真实仓库，Codex负责审查后提升。所有任务均结束，不留轮询或常驻等待；闲置自动唤醒未接通，定时PAUSED。

日常 DSH0.2.1-rc.2 / 外观rc.35 / Git Bash0.1.1不操作。工作区manifest仍rc.30、assets不改；rc.35/rc.36归档指纹分别保持 `20D35ED1A63E2272FF50E44A9A38891F1D973994BED446FB19D79B0A9E6FAE58` / `DCF07386808BC5DD50522AF9143A3840E0B485F6881907D640F744D80B0DF8D5`。没有打新包、修改版本号、安装、发布、提交、推送或清理。

下一步是将已审四点补修纳入新的隔离候选并核包；不能覆盖同版本rc.36或直接整体打工作区。剩余真实独立窗/吸附验收还需合规操作路径和当时方便确认，不能重复操作已受策略限制的接口来冒充通过。首次壁纸断流根因仍未知，A/三体/GPU不重启。
