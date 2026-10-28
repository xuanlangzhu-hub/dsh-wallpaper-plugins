# DSH Wallpaper Plugins

2026-10-28：[图库选择与非Lucy参数](docs/WALLPAPER_GALLERY_SELECTION_AND_AUTHOR_ID_20261028.md)补修及[本机短验](docs/RC53_GALLERY_AUTHOR_SHORT_TEST_20261028.md)通过，已另做新备份并[切换rc.53日常试用](docs/RC53_DAILY_TRIAL_20261028.md)，用户确认重开正常。本轮[整理源码与交接](docs/WORKSPACE_PUSH_20261028.md)，准备[首个GitHub预发行](docs/FIRST_GITHUB_RELEASE_PREPARATION_20261028.md)，尚未公开发布。

[本地发行附件与许可核对](docs/RC53_FIRST_RELEASE_BUNDLE_20261028.md)已完成归档检查；图标已按用户回忆记为DeepSeek标志的改色／透明处理衍生图，原图及工具未知的限制保留，等待公开发布安排。项目源码按[MIT](LICENSE)提供，随包组件见[第三方声明](THIRD_PARTY_NOTICES.md)。

[首个预发行草稿](docs/RC53_GITHUB_PRERELEASE_DRAFT_20261028.md)和两个附件已就位并下载核对，目前未公开；
待公开后再提供正式下载入口。GitHub自动Source code.zip不是插件安装包。

Whale Appearance / 鲸系外观，为官方 DeepSeek Harness Windows Desktop 提供主题、背景和 Wallpaper Engine 集成。

当前日常：**DSH 0.2.1-rc.3 · Whale 0.6.0-rc.53 · Git Bash 0.1.2**。用户确认重开正常，助手已核对侧栏目录及停止状态。[rc.53日常交接](docs/RC53_DAILY_TRIAL_20261028.md)记录了本轮新备份、固定包与验收范围，rc.52回退来源保留。

## 功能

- 鲸雾浅色、鲸渊深色主题，配色、强调色、文字可读性、透明度与聊天底色。
- 融入桌面端最右侧的外观栏，壁纸图库、年龄分级筛选、预览、播放与外观预设。
- 本地图片／视频背景；Wallpaper Engine 的 scene、video、web 路径，按已核验目标使用。
- 壁纸作者公开参数：原生侧栏编辑、即时下发与状态反馈；Lucy粒子和非Lucy Float时钟关闭／恢复已经实机观察。
- 官方 Windows 运行时图标及受控源窗口、采集进程停止／清理。

这是实验性预发布阶段。自动播放验证名单仍只有 **Lucy**，其余壁纸的目录可用状态不等于逐项实机通过。仓库不包含 Wallpaper Engine 或壁纸本体；WE 集成需要另装 Wallpaper Engine 与 .NET 10 运行时。

## 已知限制

- 三体壁纸的突然加减速在无采集源窗口中也出现，尚未解决，不承诺所有实时演算场景流畅。
- UI布局与控件仍继续优化；“▶ 播放”和“壁纸参数”入口已有明确文字。
- 源窗口初始仍可能短暂出现任务栏入口；未承诺从不出现、Explorer 重启后持续隐藏或所有 Alt-Tab 行为。
- 通用鼠标／点击转发、音频、application 类型与全部壁纸兼容没有验收承诺；滚动异常暂低优先级。
- 曾记录宿主启动认证 `fetch failed / bad port`，Restart 后恢复，完整根因未定；保留为独立事件，不称永久修复。

## 开发源码与发行包

| 位置 | 用途 |
| --- | --- |
| `dsh-whale-mist/` | 共享开发源码、QA、原生源码；manifest／资产仍为 rc.30 基线，含未发行 Trace |
| `release-sources/rc52/` | 从实际 rc.52 原包逐字节保存的文本源码和完整包指纹清单，未重复提交二进制资产 |
| `release-sources/rc53/` | 当前日常rc.53固定文本源码、43文件指纹及实际整合侧栏源，资产仍留固定原包 |
| `docs/PROJECT_STATUS.md` | 当前状态、验收边界与后续范围 |
| `docs/history/20261027/` | 整理前的接续与 README 历史快照 |
| `docs/previews/` | 使用夹具的隔离 UI 预览，不冒充真实桌面验收 |
| `release/`、`.tmp/` | 本机归档、审查证据及备份工具，保留但不推送 |
| `docs/screenshots/` | 含会话内容的真实截图，仅本机保留 |

**不要直接对共享开发树执行 npm pack/publish。** 当前提交保存开发成果和固定发行源码；Git提交、日常安装均不等同于公开发布。GitHub Release和npm发布分别安排，附件先核对版本、内容白名单及许可声明；本轮按用户要求提交推送，未创建Release／tag、发布npm或清理现场。

## 检查

在 `dsh-whale-mist` 中可运行 `npm run check`。单测使用 `node --test`；历史 QA 可能带本机路径或需要隔离 IO，运行前核对输入、输出及总截止时间，不盲跑浏览器或实机检查。安装／退出／重开日常应用前先确认方便并新备份；已有包、原始证据、会话和原 WE 保留。

[插件说明](dsh-whale-mist/README.md) · [当前状态](docs/PROJECT_STATUS.md) · [本轮整理](docs/WORKSPACE_MAINTENANCE_20261027.md) · [产品路线](docs/PRODUCT_ROADMAP_20261011.md)

源码从 [dsh-desktop](https://github.com/xuanlangzhu-hub/dsh-desktop) 工作区拆分，当前聚焦插件；旧 Tauri／WSL 壳不属于本仓库的活动开发范围。
