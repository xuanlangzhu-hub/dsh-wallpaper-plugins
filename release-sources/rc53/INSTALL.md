# Whale Appearance 0.6.0-rc.53 — Windows x64

这是 DeepSeek Harness 的社区外观插件预发行。已验宿主为 **0.2.1-rc.3**；
不要把 GitHub 自动生成的 Source code.zip 当作插件安装包。

## 下载与安装

1. 下载 `dsh-whale-mist-0.6.0-rc.53-windows-x64.zip` 及其 `.sha256` 校验文件，解压到一个新目录。先阅读 LICENSE、THIRD_PARTY_NOTICES.md 和 licenses 中的许可；Microsoft 组件按其单独条款提供。
2. 用 PowerShell 的 `Get-FileHash -Algorithm SHA256` 核对下载的 ZIP；解压后可用同一命令核对内部 tgz，预期 SHA256 为 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。SHA256SUMS 另列出包内说明和许可文件的校验值。
3. 确认 DSH 没有运行任务，停止壁纸并正常退出。备份当前 DSH Profile、外观数据及旧插件包，保留到确认新版本正常后。升级或回退时不要用旧备份覆盖之后新增的会话数据。
4. 在已配置官方 `dsh` 命令的 PowerShell 中，进入解压目录，安装下列文件；如果命令不在 PATH，使用官方安装目录中的 `resources/runtime/cli/bin/dsh.cmd`。`desktop` 是桌面 Profile；使用其它 Profile 时应改为对应名称。

```powershell
dsh plugin --profile desktop add .\dsh-whale-mist-0.6.0-rc.53.tgz
```

5. 正常重开 DSH，检查原布局与外观，从顶栏“Whale 外观”进入右侧栏。图库默认仅显示全年龄；点击卡片只选择，点击“▶ 播放”才开始，点击“壁纸参数”查看所选对象参数。切换时先等待当前操作结束。

ZIP 外层说明是本次发行入口。内部 tgz 是保持原始字节的已验归档，其中 README
保留了候选阶段的历史说明；它不会因外层资料更新而被重新打包。

## 可用范围

本地图片／视频可独立使用。Wallpaper Engine 集成还需另装 Wallpaper Engine、
对应本地壁纸及 **.NET 10 x64 运行时**；附件不含这些软件或壁纸。
scene、MP4 video、web 已有指定样例的限定验证，application 尚未支持验收。
自动播放验证名单仍只有 Lucy，其余条目需手动开始。

作者参数只显示受支持的公开声明字段；默认值或插件本机记录并不是 WE 当前值回读。
Lucy 粒子和非 Lucy Float 时钟已实际验证，不能推断所有作者参数都可用。

## 已知限制与反馈

- 三体实时演算源窗口也有忽快忽慢，尚未解决。
- 源窗口初始可能短暂出现在任务栏，UI 继续调整。
- 通用点击／鼠标转发、音频、全部媒体格式和全部壁纸兼容未验收。
- 曾遇宿主 `fetch failed / bad port` 启动错误，Restart 可恢复，完整根因未定。

遇问题先正常停止，保存版本、壁纸类型及复现步骤。分享日志前去除账号、私人路径
和会话内容。需要回退时，先正常退出并保护当时新增数据，再安装自己保留的旧包；
不要在 DSH 运行中覆盖 Profile 或外观存储。
