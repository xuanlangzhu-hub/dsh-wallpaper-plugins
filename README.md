# DSH Wallpaper Plugins

Whale Appearance / 鲸系外观，为官方 DeepSeek Harness Windows Desktop 提供主题、背景和 Wallpaper Engine 集成。

当前日常：**DSH 0.2.1-rc.3 · Whale 0.6.0-rc.52 · Git Bash 0.1.2**。已确认正常重开、原外观／布局、右侧栏目录和停止状态。[rc.52 日常交接](docs/RC52_DAILY_TRIAL_20261027.md)记录了备份、核包与实际验收范围。

## 功能

- 鲸雾浅色、鲸渊深色主题，配色、强调色、文字可读性、透明度与聊天底色。
- 融入桌面端最右侧的外观栏，壁纸图库、年龄分级筛选、预览、播放与外观预设。
- 本地图片／视频背景；Wallpaper Engine 的 scene、video、web 路径，按已核验目标使用。
- 壁纸作者公开参数：原生侧栏编辑、即时下发与状态反馈；Lucy 粒子关闭／恢复已经实机观察。
- 官方 Windows 运行时图标及受控源窗口、采集进程停止／清理。

这是实验性预发布阶段。自动播放验证名单仍只有 **Lucy**，其余壁纸的目录可用状态不等于逐项实机通过。仓库不包含 Wallpaper Engine 或壁纸本体；WE 集成需要另装 Wallpaper Engine 与 .NET 10 运行时。

## 已知限制

- 三体壁纸的突然加减速在无采集源窗口中也出现，尚未解决，不承诺所有实时演算场景流畅。
- UI 后续继续优化，包括“▶ 播放”的明确文字和控件布局。
- 源窗口初始仍可能短暂出现任务栏入口；未承诺从不出现、Explorer 重启后持续隐藏或所有 Alt-Tab 行为。
- 通用鼠标／点击转发、音频、application 类型与全部壁纸兼容没有验收承诺；滚动异常暂低优先级。
- 曾记录宿主启动认证 `fetch failed / bad port`，Restart 后恢复，完整根因未定；保留为独立事件，不称永久修复。

## 开发源码与发行包

| 位置 | 用途 |
| --- | --- |
| `dsh-whale-mist/` | 共享开发源码、QA、原生源码；manifest／资产仍为 rc.30 基线，含未发行 Trace |
| `release-sources/rc52/` | 从实际 rc.52 原包逐字节保存的文本源码和完整包指纹清单，未重复提交二进制资产 |
| `docs/PROJECT_STATUS.md` | 当前状态、验收边界与后续范围 |
| `docs/history/20261027/` | 整理前的接续与 README 历史快照 |
| `docs/previews/` | 使用夹具的隔离 UI 预览，不冒充真实桌面验收 |
| `release/`、`.tmp/` | 本机归档、审查证据及备份工具，保留但不推送 |
| `docs/screenshots/` | 含会话内容的真实截图，仅本机保留 |

**不要直接对共享开发树执行 npm pack/publish。** 当前提交保存开发成果和固定发行源码；Git 提交不等同于发布 rc.52。GitHub Release 和 npm 发布另做固定版本、内容白名单、资产／许可与账户检查；本轮只整理、提交、推送和清理可重建缓存。

## 检查

在 `dsh-whale-mist` 中可运行 `npm run check`。单测使用 `node --test`；历史 QA 可能带本机路径或需要隔离 IO，运行前核对输入、输出及总截止时间，不盲跑浏览器或实机检查。安装／退出／重开日常应用前先确认方便并新备份；已有包、原始证据、会话和原 WE 保留。

[插件说明](dsh-whale-mist/README.md) · [当前状态](docs/PROJECT_STATUS.md) · [本轮整理](docs/WORKSPACE_MAINTENANCE_20261027.md) · [产品路线](docs/PRODUCT_ROADMAP_20261011.md)

源码从 [dsh-desktop](https://github.com/xuanlangzhu-hub/dsh-desktop) 工作区拆分，当前聚焦插件；旧 Tauri／WSL 壳不属于本仓库的活动开发范围。
