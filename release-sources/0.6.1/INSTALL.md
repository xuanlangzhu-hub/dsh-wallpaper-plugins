# 安装 Whale 外观 0.6.1

本包面向 Windows x64。桌面实测使用 DSH 0.2.2-rc.5。

1. 下载发行 ZIP 和同名 `.sha256`，用 PowerShell 的 `Get-FileHash -Algorithm SHA256` 核对后解压。
2. 正常退出 DSH，备份当前插件包和外观设置。在解压目录运行以下命令。

```powershell
dsh plugin --profile desktop add .\dsh-whale-mist-0.6.1.tgz
```

3. 重新打开 DSH，从顶栏进入「Whale 外观」。如需回退，按同样步骤安装保留的旧包。

若终端找不到 `dsh`，可用 DSH 安装目录中 `resources/runtime/cli/bin/dsh.cmd`。其它 Profile 请替换 `desktop`。

## Wallpaper Engine

使用 Wallpaper Engine 壁纸需要 .NET 10 x64 运行时，并在 Steam 中安装 Wallpaper Engine 和对应壁纸。插件默认从 Windows 的标准 Steam 安装位置读取。若 Wallpaper Engine 安装在其它盘，请将 Windows 用户环境变量 `WM_STEAM_LIBRARY` 设为对应的 Steam 库目录，例如 `D:\SteamLibrary`，然后重新启动 DSH。该目录应包含 `steamapps`。

「跟随桌面壁纸」使用主显示器的壁纸选择，并在 DSH 内独立播放。跟随查询限于已验证的 Wallpaper Engine 可执行文件版本，其他版本可手动播放。「固定取景」请在日常档关闭跟随后使用，当前实测范围为单屏 2560 × 1440 下的场景、MP4 和网页代表壁纸。

包内 tgz 的 SHA-256 为 `{{TGZ_SHA256}}`。项目采用 MIT，随包组件条款见 `THIRD_PARTY_NOTICES.md` 和 `licenses`。
