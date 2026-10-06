# 项目状态与接续入口

更新：2026-10-06。仓库：`xuanlangzhu-hub/dsh-wallpaper-plugins`。本机独立检出：`F:\dsh-wallpaper-plugins`。

## 当前完成的阶段

Whale Appearance 源码版本为 `0.6.0-rc.13`（**U1 已修复、L1 未回退，代码/实际 DOM 几何/包一致性短复审通过，待实机验收**）。
最新：[B_DAILY_PLAYBACK_RC13_REVIEW.md](B_DAILY_PLAYBACK_RC13_REVIEW.md)。五种面板宽度与窄视口下方框均保持 16×16、文案在左；新增回归加载 rc.12 时按预期抓住旧问题，加载 rc.13 通过。
复审时包内 26 文件与源码一致，生产差异仅自动播放行 class/CSS/注释及版本号，播放逻辑、Host 和原生未变。此前 [rc.12 复审](B_DAILY_PLAYBACK_RC12_REVIEW.md) 与全部历史证据保留。
日常仍 rc.1，四份 Profile 哈希与上轮恢复备份一致；本轮未安装或操作真实 DSH/壁纸。DS 先暂停，下一步用户点击、外部 Codex 重新备份后临时安装 rc.13，先确认真实布局，再继续 35 分钟与自动播放/清理实机验收。
续审单：[B_DAILY_PLAYBACK_RC9_REVIEW.md](B_DAILY_PLAYBACK_RC9_REVIEW.md)；首审单：
[B_DAILY_PLAYBACK_RC8_REVIEW.md](B_DAILY_PLAYBACK_RC8_REVIEW.md)。
交付报告：[dsh-whale-mist/docs/B_DAILY_PLAYBACK_DELIVERY.md](../dsh-whale-mist/docs/B_DAILY_PLAYBACK_DELIVERY.md)。
rc.7 阶段：真实开始、停止后再次开始、重新开始均无需调参数就直接出图，每轮计数和倒计时正常，
停止恢复主题并清理本轮源窗口、采集进程；代码与无窗口复审、短实机复测均通过。
详见 [rc.7 复审](../dsh-whale-mist/docs/wallpaper-settings-rc7-review.md) 与
[Desktop 验收](../dsh-whale-mist/docs/wallpaper-settings-desktop-acceptance.md) 末尾的 rc.7 记录。

实机验收结束后已撤回 rc.7 候选版，用户日常仍使用 rc.1，外观与 Profile 恢复并由用户确认。
现有安装包继续留在 `F:\deepseekharness\release\plugins`，Profile 仍引用原路径；迁移源码仓库不移动或覆盖这些文件。

## B 候选版（0.6.0-rc.13）：短复审通过，待实机

任务范围：[NEXT_B_DAILY_PLAYBACK.md](NEXT_B_DAILY_PLAYBACK.md)。rc.11 实机布局未通过：
WE 区域两列横排不换行，窄面板下文字列被压到 0 宽、说明逐字换行；rc.12 修复并复审通过；
复审同时发现 U1：自动播放行的复选框被拉伸成整行宽。

- **L1 修法（rc.12，已复审）**：WE 行加专用 class `wm-wallpaper-row`（纵向堆叠，标题与说明独占上方整行），
  控件容器允许换行且不再固定 `flex-shrink: 0`，字段可收缩且不超容器。
  只动 WE 新区域，未改全局 `.wm-settings-row` / `.wm-media-actions` 与其它行布局。
- **U1 修法（rc.13）**：自动播放行移除 `wm-wallpaper-row`（它带来的 column/stretch 会拉伸复选框），
  改回两列并显式 `flex-direction: row; align-items: center`；复选框定尺寸 16×16（含 min/max-width）。
- **实际 DOM 几何回归**：`qa/appearance-wallpaper-layout.mjs`
  （`npm run test:appearance-wallpaper-layout`），1280px 视口 + 面板 400/480/560/640/720px + 窄视口 + 长文案。
  L1：修复前 560px 起文字列 0px、说明 468px 高；修复后文字列等于面板宽、说明 1 行（长文案 2–4 行）。
  U1：修复前方框 400–720px 宽 × 13px；修复后各宽度均为 16×16、方框在文案右侧且同行、零溢出。

- 候选包：`release/plugins/dsh-whale-mist-0.6.0-rc.13.tgz`，
  SHA256 `DA2C08A187C8A031E6D92DAD416C41A397D273B2EBF5F472590D6FED8DBD81C5`。
- 相对 rc.12 包内只有 `src/client.js`（移除 class + 专用 CSS）与 `package.json`（版本号）改变。
- 已通过：`npm run check`、外观回归 30 项、壁纸浏览器回归 136 项、布局回归（5 宽度 + 窄视口 + 长文案 + U1 断言）、
  Host 46 项、SDK 契约（加载本检出源码）。
- **未验收**：真实 DSH 设置面板布局（需用户点击核对）、真实 ≥35 分钟长跑、DSH 完整重开的自动播放、
  最小化开销、初始屏幕外的真实闪窗观察。本轮结论来自隔离浏览器 DOM 检查，不等于实机验收。
- 本轮实现已通过短复审，随源码提交保存；真实日常播放验收仍待进行。

提交前仅整理 README 与状态文档；已归档 rc.13 不重打、不覆盖，包内 README 保持打包时内容，功能源码与原生资产未变。

## 下一阶段

rc.13 短复审通过。DS 先暂停；用户方便时由用户点击、外部 Codex 核验，重新备份并临时安装。先确认真实布局，
再继续至少 35 分钟实机、完整重开自动播放与退出清理验收。
A 多壁纸与 E 打包字节复现后置；音频、鼠标交互、全屏坐标锚定不在 B 内。
安装、重开与真实长时验收由用户点击、外部 Codex 核验，DS 先交代码和候选包。

已验收的 rc.7 WE 功能限于单 Lucy 场景、.NET 10 依赖、默认 180 秒 / 最大 300 秒的手动预览。源窗口仍可能有任务栏 / Alt-Tab 入口；音频、鼠标交互、多壁纸兼容性、长期播放没有新增验收。全屏桌面坐标锚定的背景想法仍被推迟。

## 本机历史资料

- 原工作区 `F:\deepseekharness` 保留，用于历史源码、资产、归档与验收证据。
- rc.7 证据：`F:\deepseekharness\.tmp\wallpaper-settings-rc7-desktop-20261006-102024`。
- rc.7 起点备份：`C:\Users\HP\.dsh\backups\official-desktop-before-settings-rc7-20261006-102024`。
- 官方程序与 `.dsh` 属于运行环境，不作为源码开发目录。

这些是本机历史路径，不能复用旧 PID、窗口名或证据目录。新检查写入本轮独立目录，保留旧证据。

## 拆分来源

原工作区的插件提交为 `bbab190`、`c838b82`、`8aab3e2`、`a986196` 和 `ff19f3b`；本仓库以最后一项的已提交插件快照为起点。迁移后原工作区的来源历史与正在引用的包均保留。
