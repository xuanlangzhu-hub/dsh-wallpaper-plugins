# Whale 外观 0.6.0

首个正式版，基于已实测并日常使用的 rc.61。此次正式发行保持运行代码与原生资产原样，补齐统一的 GitHub／npm 安装包、许可和说明。

## 相比公开 rc.53

- 外观栏采用透明基础控件与细边框，保留宿主字号比例；侧栏背景可选通透或毛玻璃。
- 图库卡片独立滚动，分页单独占位，翻页回到列表顶部。
- 缩短启动时额外任务栏图标的停留。
- 改进作者参数失败后的恢复流程，提供默认关闭的有界诊断。

## 安装

已验证环境：**Windows x64 · DeepSeek Harness 0.2.1-rc.3**。使用 WE 集成还需要 Wallpaper Engine、本地壁纸与 .NET 10 x64 运行时。

下载下方 `dsh-whale-mist-0.6.0-windows-x64.zip` 和 `.zip.sha256`，核对后解压，按 INSTALL.md 安装。GitHub 自动生成的 Source code.zip 是源码压缩包。

或在正常退出 DSH 并备份设置后，从 npm 安装：

```powershell
dsh plugin --profile desktop add dsh-whale-mist@0.6.0
```

GitHub ZIP 内的 tgz 与 npm 包保持同一字节。升级前保留原包及设置备份；已在用 rc.61 的用户，本次没有新增运行功能，无需为版本号立即重装。

## 已知问题

- 三体实时演算忽快忽慢在无采集源窗口也存在，尚未解决。
- 启动时额外任务栏图标仍可能短暂出现。
- 长时间播放后快速拖动作者滑块曾有偶发失败反馈，仍在观察。
- application 类型未支持；通用鼠标／点击转发和音频未纳入兼容验证。自动播放仅对已验证 Lucy 开放。

源码 MIT；随包第三方组件按各自许可提供。插件、宿主和 Wallpaper Engine 分别提供，本项目不包含壁纸本体，也不是 DeepSeek 官方发行。
