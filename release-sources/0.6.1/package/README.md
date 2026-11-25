# Whale 外观 0.6.1

为 DeepSeek Harness Windows 桌面端提供鲸雾、鲸渊主题与壁纸背景。包含本地图片和视频、Wallpaper Engine 图库、跟随桌面壁纸和固定取景。

```powershell
dsh plugin --profile desktop add dsh-whale-mist@0.6.1
```

安装前正常退出 DSH 并备份设置。桌面实测使用 DSH 0.2.2-rc.5。Wallpaper Engine 集成需要 .NET 10 x64 运行时。非标准 Steam 库通过 Windows 用户环境变量 `WM_STEAM_LIBRARY` 配置为包含 `steamapps` 的目录。

固定取景的实测范围为单屏 2560 × 1440 的场景、MP4 和网页代表壁纸。跟随功能按主显示器选择独立播放，查询限于已验证的 Wallpaper Engine 可执行文件版本。

[使用与下载](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/releases/tag/dsh-whale-mist-v0.6.1) · [问题反馈](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/issues)

项目采用 MIT。第三方组件的许可见 `THIRD_PARTY_NOTICES.md`。
