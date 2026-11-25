# Whale 外观 0.6.1 发行来源

`package/` 保存 npm 与 GitHub 安装包的完整载荷，`native/` 保存对应原生助手源码。载荷以通过桌面验收的 0.6.1-rc.49 为基线。公开版将 Wallpaper Engine 的路径换为主机 Steam 库配置，重建路径相关的 WallpaperProbe 和去掉调试符号的 DesktopRuntimeQuery。固定取景的画布代码和 DailyFixedCanvas 二进制沿用验收版。

## 重建安装包

从仓库根目录运行 PowerShell。使用 Node.js 24、npm 11 和 Python 3。

```powershell
$npmCli = Join-Path (Split-Path (Get-Command npm.cmd).Source) 'node_modules/npm/bin/npm-cli.js'
python release-sources/0.6.1/build-release.py --npm-cli $npmCli --output release/whale-0.6.1-rebuild
```

输出路径应尚未存在。配方校对真实 npm 归档和包文件清单，生成同载荷的 GitHub ZIP 和 SHA-256 文件。`package-manifest.json` 固定发行文件摘要。原生代码用 Windows x64 的 .NET 10 SDK 构建，项目直接引用随包 DLL；详见 `package/BUILD_PROVENANCE.json` 和许可声明。

```powershell
node --test release-sources/0.6.1/steam-library.test.mjs
```

测试仅运行路径解析和登记在包里的只读摘要核对，无需启动 DSH 或 Wallpaper Engine。
