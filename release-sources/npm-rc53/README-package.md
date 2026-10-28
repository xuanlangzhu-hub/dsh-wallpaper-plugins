# Whale Appearance / 鲸系外观

DeepSeek Harness Windows Desktop 的社区外观插件：主题、透明背景、右侧外观栏和 Wallpaper Engine 集成。

此 npm 版本为 **0.6.0-rc.53.npm.1**，基于 GitHub 已发布并实测的 rc.53。
运行代码和二进制资产保持原字节；npm 发行单独补入完整许可、安装说明和发布元数据。
预发行标签为 `next`，适用于 Windows x64、DSH **0.2.1-rc.3**。

## 安装

先确认 DSH 无运行任务，停止壁纸并正常退出，备份当前 Profile、外观设置与旧插件包。
通过官方 DSH 命令安装指定版本：

```powershell
dsh plugin --profile desktop add dsh-whale-mist@0.6.0-rc.53.npm.1
```

若 `dsh` 未加入 PATH，使用官方安装目录中的 `resources/runtime/cli/bin/dsh.cmd`。
`desktop` 为桌面 Profile 名称；其它 Profile 请使用对应名称。此包是宿主插件，
不是独立启动程序。重开后从顶栏“Whale 外观”进入最右侧栏。

也可使用 [GitHub rc.53 下载包](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/releases/tag/dsh-whale-mist-v0.6.0-rc.53)，按 ZIP 内 INSTALL.md 安装。
GitHub 自动生成的 Source code 归档是开发仓库，不是插件安装包。

## 功能

- 鲸雾／鲸渊主题，配色、强调色、文字可读性、透明度与聊天底色。
- 原生右侧外观栏、壁纸缩略图与年龄分级筛选，默认仅全年龄。
- 点击卡片只选择，“▶ 播放”显式开始／切换，“壁纸参数”进入详情。
- 本地图片／视频；Wallpaper Engine scene、MP4 video、web 的指定样例支持。
- 支持字段的作者参数即时下发，Lucy 粒子和非 Lucy Float 时钟已实际验证。

本地背景无需 Wallpaper Engine。WE 集成另需 Wallpaper Engine、对应本地壁纸和
**.NET 10 x64 运行时**，这些不在包内。自动播放验证名单仍只有 Lucy。
参数参考值来自作者声明或插件记录，不是 WE 当前值回读。

## 已知限制

- 三体实时演算的速度突变在无采集源窗口也出现，尚未解决。
- 源窗口初始可能短暂出现在任务栏，UI 还会继续调整。
- application、通用点击／鼠标转发、音频、全部媒体格式／壁纸／参数未完成验收。
- 曾记录宿主启动 `fetch failed / bad port`，Restart 恢复，完整根因未定。

预发行不代表长期稳定或全部设备兼容。反馈请提供宿主／插件版本、壁纸类型及复现步骤；
分享日志前去除账号、私人路径与会话内容。回退前先保护届时新增数据，正常退出后再操作。

## 许可与来源

项目代码见 [LICENSE](LICENSE)，随包组件及图标署名见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。Microsoft 组件按其独立 SDK 条款提供，
安装使用前请阅读 `licenses/Microsoft-components-terms.md` 与完整原文。
本插件是社区项目，不代表 DeepSeek、Microsoft 或 Wallpaper Engine 官方发行。

[源码与问题反馈](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins)
