# Whale 外观 0.6.0

为 DeepSeek Harness Windows 桌面端提供主题、透明背景和 Wallpaper Engine 动态壁纸。

- 鲸雾／鲸渊主题、配色和强调色、文字可读性。
- 壁纸图库、搜索、年龄分级筛选，选择与播放分开操作。
- 最右侧原生外观栏、透明基础控件、独立分页。
- 背景亮度、遮罩、模糊、界面透明度与按壁纸保存外观。
- 支持的壁纸作者公开参数可即时下发；本地图片／视频及 WE 场景、视频、网页壁纸。

## 安装

已验证环境：**Windows x64 · DeepSeek Harness 0.2.1-rc.3**。安装前正常退出 DSH 并备份原设置和旧包。

```powershell
dsh plugin --profile desktop add dsh-whale-mist@0.6.0
```

也可从 [GitHub Releases](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/releases/tag/dsh-whale-mist-v0.6.0) 下载 ZIP，按其中 INSTALL.md 安装同一 tgz。Source code.zip 是源码压缩包。

WE 集成需要自行安装 Wallpaper Engine、准备壁纸和 .NET 10 x64 运行时。项目不附带壁纸、宿主或 .NET 运行时。顶栏打开“Whale 外观”进入右侧栏，选中壁纸后点击“▶ 播放”，用“壁纸参数”查看设置。

## 使用范围与已知问题

自动播放只对已验证 Lucy 开放，其它壁纸手动开始。作者参数仅支持公开声明的字段，初始值可能来自默认值或本机记录，不是 WE 实时值回读。

- 三体实时演算忽快忽慢在无采集源窗口也出现，尚未解决。
- 启动时额外任务栏图标可能短暂出现。
- 长时间播放后快速拖动作者滑块曾有偶发失败反馈，仍在观察。
- application 类型未支持；通用鼠标／点击转发和音频未纳入兼容验证。

反馈请提供版本、壁纸名称与复现步骤，分享日志前去除私人信息。更多说明见[仓库](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins)。

## 许可与来源

源码采用 MIT；第三方二进制按随包 THIRD_PARTY_NOTICES.md 与 licenses 下的原许可提供。社区插件，与 DeepSeek／Microsoft 无隶属或背书关系；DeepSeek 标志仅用于应用识别。

0.6.0 是已验 rc.61 的正式发行：运行代码与原生资产保持原样。内部诊断继续保留该代码构建的 rc.61 身份用于追溯，发行版本为 package.json 的 0.6.0；详见 BUILD_PROVENANCE.json。
