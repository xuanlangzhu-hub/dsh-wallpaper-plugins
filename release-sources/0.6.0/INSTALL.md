# Whale 外观 0.6.0 · Windows x64

社区外观插件，已验证宿主 DeepSeek Harness 0.2.1-rc.3。

## 安装或升级

1. 下载 ZIP 和同名 `.sha256`。用 `Get-FileHash -Algorithm SHA256` 核对 ZIP 后，解压到新目录。GitHub 的 Source code.zip 是源码压缩包。
2. 确认 DSH 没有运行任务，停止壁纸并正常退出；备份当前设置、外观数据及旧插件包。
3. 在解压目录打开 PowerShell，执行：

```powershell
dsh plugin --profile desktop add .\dsh-whale-mist-0.6.0.tgz
```

若 `dsh` 不在 PATH，使用官方安装目录中的 `resources/runtime/cli/bin/dsh.cmd`；`desktop` 为桌面 Profile，其它 Profile 请改用对应名称。

4. 正常重开 DSH，确认原外观和布局。从顶栏“Whale 外观”进入最右侧外观栏，选择壁纸后点击“▶ 播放”。

同一个包也可从 npm 安装：`dsh plugin --profile desktop add dsh-whale-mist@0.6.0`。两种方式任选一种。

内层 tgz SHA256：`{{TGZ_SHA256}}`。外层 SHA256SUMS 列出说明及许可文件校验值。

## 依赖与使用范围

本地图片／视频背景可独立使用。WE 集成需要另装 Wallpaper Engine、对应壁纸和 .NET 10 x64 运行时，附件不含这些软件或壁纸。

支持场景／视频／网页壁纸路径；不同壁纸和作者参数的兼容情况会有差异。自动播放仅对已验证 Lucy 开放，其余壁纸手动开始。作者参数初始值可能是默认值或插件本机记录，并非 WE 当前值回读。

## 已知问题

- 三体实时演算忽快忽慢，在独立无采集源窗口也存在。
- 启动时额外任务栏图标可能短暂出现。
- 长时间使用后快速拖动作者参数滑块曾有偶发失败反馈。
- application 类型未支持；通用鼠标／点击转发及音频未纳入兼容验证。

遇问题记录插件版本、壁纸名称及复现步骤，先正常停止，不反复重试；分享日志前去掉私人信息。

回退前正常退出并保护届时新增数据，再安装保留的旧包；不要用旧备份覆盖后来新增的会话或在运行中覆盖 Profile。

项目源码采用 MIT，第三方组件按随包 LICENSE、THIRD_PARTY_NOTICES.md 和 licenses 中的各自条款提供。0.6.0 将已验 rc.61 的代码正式发行，未改变运行代码和原生资产；内部诊断保留代码构建身份用于追溯。
