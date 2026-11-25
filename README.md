# Whale 外观 · DSH Wallpaper Plugins

为 DeepSeek Harness Windows 桌面端添加主题、透明背景和 Wallpaper Engine 动态壁纸。

## 功能

- 鲸雾、鲸渊主题和文字配色，支持本地图片与视频背景。
- Wallpaper Engine 图库支持搜索和分级筛选，可调整亮度、遮罩、模糊、界面透明度和支持的作者参数。
- 「跟随桌面壁纸」随主显示器选择更新 DSH 背景。「固定取景」按 DSH 窗口位置显示壁纸区域，支持移动和缩放。

## 安装

**0.6.1** 面向 Windows x64，桌面实测使用 **DSH 0.2.2-rc.5**。

### 从 GitHub 下载

前往 [0.6.1 发行页](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/releases/tag/dsh-whale-mist-v0.6.1)，下载 `dsh-whale-mist-0.6.1-windows-x64.zip` 和同名 `.zip.sha256` 校验文件。正常退出 DSH 并备份设置。核对校验值后解压，按包内 `INSTALL.md` 安装。

### 从 npm 安装

正常退出 DSH 并备份设置后，在终端运行以下命令。 [npm 0.6.1](https://www.npmjs.com/package/dsh-whale-mist/v/0.6.1)

```powershell
dsh plugin --profile desktop add dsh-whale-mist@0.6.1
```

## 使用

从 DSH 顶栏进入 **Whale 外观**。Wallpaper Engine 集成需要另装 Wallpaper Engine、对应壁纸和 **.NET 10 x64 运行时**。若使用非默认 Steam 库，将 Windows 用户环境变量 `WM_STEAM_LIBRARY` 设为包含 `steamapps` 的库目录，然后重新启动 DSH。

「跟随桌面壁纸」使用主显示器的选择，并在 DSH 内独立播放。跟随查询限于已验证的 Wallpaper Engine 可执行文件版本。使用「固定取景」时请选择日常档并关闭跟随。单屏 2560 × 1440 下已测试场景、MP4 和网页代表壁纸。

已知限制与版本变更见 [0.6.1 发行说明](release-sources/0.6.1/RELEASE_NOTES.md)。反馈时可提供插件版本、壁纸名称和复现步骤。

## 开发

当前交付的运行源码、原生源码与构建配方见 [0.6.1 发行材料](release-sources/0.6.1/README.md)。[项目状态](docs/PROJECT_STATUS.md)记录实测范围。共享开发目录 `dsh-whale-mist/` 中的旧 manifest 用于开发检查。

## 许可

项目源码采用 [MIT](LICENSE) 许可，随包组件见[第三方声明](THIRD_PARTY_NOTICES.md)。

本项目从 [dsh-desktop](https://github.com/xuanlangzhu-hub/dsh-desktop) 工作区拆分。
