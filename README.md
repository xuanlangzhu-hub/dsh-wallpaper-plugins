# Whale 外观 · DSH Wallpaper Plugins

为 DeepSeek Harness Windows 桌面端添加主题、透明背景和 Wallpaper Engine 动态壁纸。

## 功能

- **主题与配色**：鲸雾浅色、鲸渊深色主题，自定义强调色与文字可读性。
- **背景调节**：亮度、遮罩、模糊、界面透明度和聊天底色，支持按壁纸保存外观预设。
- **壁纸图库**：缩略图浏览、搜索、年龄分级筛选，选择和播放分开操作。
- **作者参数**：在右侧外观栏修改壁纸公开的设置，支持的参数修改后即时下发。
- **多种背景**：本地图片／视频，以及 Wallpaper Engine 的场景、视频和网页壁纸。

## 安装

本次正式发行版本为 **0.6.0**，已验证宿主 **DSH 0.2.1-rc.3 · Windows x64**。开发进度与本机试用版本见[项目状态](docs/PROJECT_STATUS.md)。

### 从 GitHub 下载

前往 [Releases](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/releases/tag/dsh-whale-mist-v0.6.0)，下载：

- `dsh-whale-mist-0.6.0-windows-x64.zip`
- 同名的 `.zip.sha256` 校验文件

核对校验值后解压，按包内 `INSTALL.md` 安装。安装前正常退出 DSH 并备份设置。GitHub 自动生成的 `Source code.zip` 是源码压缩包。

### 从 npm 安装

正常退出 DSH 并备份设置后，在终端运行：

```powershell
dsh plugin --profile desktop add dsh-whale-mist@0.6.0
```

[npm 版本](https://www.npmjs.com/package/dsh-whale-mist/v/0.6.0)与 GitHub ZIP 内的 tgz 保持同一字节。两种安装方式任选其一。

使用 Wallpaper Engine 集成还需要安装 **Wallpaper Engine 和 .NET 10 运行时**，并在本机准备壁纸；项目不附带 Wallpaper Engine 或壁纸资源。

## 使用

从 DSH 顶栏打开 **Whale 外观**，在右侧栏浏览、选择和播放壁纸，再进入“壁纸参数”调整画面及作者公开的设置。“界面”页用于主题、配色与文字设置。

自动播放仅对已验证的 Lucy 开放，其它壁纸请手动开始；不同壁纸公开的作者参数与实际兼容情况会有差异。

## 已知限制

- 三体实时演算壁纸有突然加减速的现象，在独立、无采集的源窗口中也能观察到，原因尚未解决。
- 播放启动时，额外的壁纸任务栏图标可能短暂出现。
- 曾收到长时间播放后快速拖动作者参数滑块容易失败的反馈，仍在观察中。
- application 类型壁纸不在当前支持范围；通用鼠标／点击转发与壁纸音频尚未纳入兼容验证。

日常使用有问题，可附上插件版本、壁纸名称和复现步骤反馈。其它低优先级调查与历史故障见[项目状态](docs/PROJECT_STATUS.md)。

## 开发

主要开发目录为 `dsh-whale-mist/`，固定版本来源与构建配方在 `release-sources/`。开发源码含实验功能，manifest／原生资产基线与日常试用版本不同；发行包从固定版本准备，不直接整体打包开发目录。

基础检查：

```powershell
cd dsh-whale-mist
npm run check
```

[开发计划](docs/POST_RELEASE_DEVELOPMENT_PLAN_20261028.md) · [当前状态](docs/PROJECT_STATUS.md) · [维护记录](docs/WORKSPACE_MAINTENANCE_20261102.md) · [插件详细说明](dsh-whale-mist/README.md)

## 许可

项目源码采用 [MIT](LICENSE) 许可，随包组件见[第三方声明](THIRD_PARTY_NOTICES.md)。

本项目从 [dsh-desktop](https://github.com/xuanlangzhu-hub/dsh-desktop) 工作区拆分，当前聚焦官方 DSH 桌面端插件。
