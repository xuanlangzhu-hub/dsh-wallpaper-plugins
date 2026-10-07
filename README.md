# DSH Wallpaper Plugins

为官方 DeepSeek Harness 开发的 Whale Appearance / 鲸系外观插件，提供鲸渊、鲸雾主题、自定义配色、图片和视频背景，以及 Wallpaper Engine 实验预览。

主要插件位于 [dsh-whale-mist](dsh-whale-mist/README.md)。当前源码候选版为 **0.6.0-rc.18**，新增侧栏/聊天区独立底色开关，[后台复审通过](docs/RC18_REGION_REVIEW.md)，四种组合的实机观感待确认。rc.17 的仅输入卡片遮挡、外围壁纸与消息裁剪已通过[本机短实机](docs/RC17_DESKTOP_VISUAL_ACCEPTANCE.md)，临时测试后日常恢复 rc.1。rc.13 的本机单 Lucy 场景 35 分钟日常播放及正常生命周期实机验收已通过；启动闪窗与 GPU 增量优化仍待验证。rc.7 的手动预览曾通过短实机验收。当前状态与接续边界见 [项目状态](docs/PROJECT_STATUS.md)，实际桌面证据见 [验收记录](dsh-whale-mist/docs/wallpaper-settings-desktop-acceptance.md)。

已实施 [B：日常持续播放与启动闪窗优化](docs/NEXT_B_DAILY_PLAYBACK.md)，由 DS 实现、Codex 审查；实现、短复审与核心实机验收已完成，详见 [rc.13 验收记录](docs/B_DAILY_PLAYBACK_RC13_DESKTOP_ACCEPTANCE.md)。启动仍会闪出独立窗口，GPU 单引擎采样较高且包含原桌面工作，需要后续对照；不宣称通用稳定版或低开销。

## 功能与当前边界

- 鲸渊 / Whale Abyss 深色主题与鲸雾 / Whale Mist 浅色主题，深海、石墨、暗紫和墨绿配色。
- 自选图片和本地视频背景，亮度、遮罩、模糊和界面不透明度设置。
- 官方 Windows Desktop 的透明白鲸运行时窗口图标。
- Wallpaper Engine 原始渲染 → Windows Graphics Capture → 内存画面流 → DSH 背景层。

Wallpaper Engine 部分仍限于单 **Lucy** 场景。默认限时预览为 180 秒、最多 300 秒；候选版新增无定时结束的日常模式与默认关闭的下次启动自动播放，后两者的本机单场景核心行为已验收。需要已安装的 Wallpaper Engine、对应场景与 .NET 10 运行时。场景路径由 Host 的 `src/wallpaper/scenes.js` 白名单配置，仓库不包含壁纸本体。

源窗口收在屏幕外，任务栏 / Alt-Tab 仍可能显示入口。音频、鼠标交互、其它壁纸兼容性、数小时/数天运行尚未验收，.NET 10 依赖保留。

## 目录

| 路径 | 用途 |
| --- | --- |
| `dsh-whale-mist/src` | 主题、设置入口、Host 和画面流 |
| `dsh-whale-mist/assets/wallpaper` | 随插件打包的原生采集程序与依赖 |
| `dsh-whale-mist/qa/wallpaper-probe` | 原生采集程序源码 |
| `dsh-whale-mist/qa/wallpaper` | Host 单元测试与 SDK 契约检查 |
| `dsh-whale-mist/qa/wallpaper-preview` | 前期独立实验及历史回归 |
| `dsh-whale-mist/docs` | 实施、返工、复审和实机验收记录 |
| `official-desktop/README.md` | 原工作区的迁移与兼容记录 |
| `DeepSeek-Harness.ico` | 图标构建脚本所需的源资产 |

## 检查与打包

在 Windows 上使用 Node.js / npm。图标辅助程序需要 Windows 自带的 .NET Framework C# 编译器；重新编译采集程序需要 .NET 10 SDK。

在仓库根目录运行：

```powershell
New-Item -ItemType Directory -Force .\release\plugins
Set-Location .\dsh-whale-mist
npm run check
npm run test:wallpaper-host
npm run build:client-protocol
npm run build:desktop-icon
npm pack --pack-destination ../release/plugins
```

目前已有原生采集程序在 `assets/wallpaper`，图标辅助 EXE 由构建脚本生成。生成包不保证与历史归档字节一致；正式交付应记录本次包的指纹并验收，不覆盖同版本归档。

更多检查见插件 README。部分历史 QA 脚本固定了原机器的 SDK、场景或证据路径，使用前需检查并准备独立输出目录；不能把这些路径指向的旧源码或旧证据当成本轮结果。

## 安装和实机验收

在官方 Windows Desktop 的插件页添加新生成的 tgz，重开后从「设置 → 通用 → 鲸系外观」选择主题和背景。Wallpaper Engine 需要选择来源后手动点击「开始预览」。

安装、切换日常版本或恢复 Profile 前先备份。需要退出、重开或点击应用时，由用户操作界面，外部助手核验；代码和无窗口检查通过后再安排实机验收。

## 来源

源码从原 [dsh-desktop](https://github.com/xuanlangzhu-hub/dsh-desktop) 工作区拆出，起点本地提交为 `ff19f3bf42be2de2fb5715a120d77b8d5a5b2d9d`。本仓库保留插件目录结构、原生源资产和验收记录，后续插件开发在本仓库继续。
