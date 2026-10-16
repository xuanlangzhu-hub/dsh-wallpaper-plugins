# DSH Wallpaper Plugins

为官方DeepSeek Harness提供Whale Appearance / 鲸系外观插件，支持主题、图片/视频背景和Wallpaper Engine实验预览。

## 当前状态（2026-10-16）

- 日常安装保留 **rc.28**，最近一轮测试后原设置已恢复，用户确认重开正常并停止播放。
- **P4等待优化已收尾**：rc.31已有真实后端与等待改善证据，Lucy常规短验反馈流畅、停止清理通过；rc.31保留为用户可选择的日常试用候选，尚未自动切换。
- 三体运动变速在无本轮采集/DSH时也可出现，原因未定，专项暂不推进；不以此否定已有P4改善，也不声称算法已定位。
- Motion Cadence Trace实现及离线检查保留，rc.32仅为诊断候选。前端仍有丢旧帧，短验不等于零积压、长期稳定或全部壁纸兼容。

[当前状态与接续](docs/PROJECT_STATUS.md) · [Lucy短验及恢复](docs/RC31_LUCY_ORDINARY_SHORT_TEST_20261016.md) · [产品路线](docs/PRODUCT_ROADMAP_20261011.md) · [历史记录](docs/PROJECT_HISTORY_20261016.md)

## 功能与当前边界

- 鲸渊 / Whale Abyss 深色主题与鲸雾 / Whale Mist 浅色主题，深海、石墨、暗紫和墨绿配色。
- 自选图片和本地视频背景，亮度、遮罩、模糊和界面不透明度设置。
- 官方 Windows Desktop 的透明白鲸运行时窗口图标。
- Wallpaper Engine 原始渲染 → Windows Graphics Capture → 内存画面流 → DSH 背景层。

rc.28 由Host显式配置库根、按ID重新核验scene；自动播放已验证名单仍只有 **Lucy**，其它scene只允许手动实验。默认限时预览180秒、最多300秒；日常模式与默认关闭的下次启动自动播放保留，本轮未调整用户原自动播放设置。需要已安装的 Wallpaper Engine、对应场景与 .NET 10 运行时。Lucy/绯雪双向手动切换是rc.26历史，rc.28 只对本轮当前 scene 作平滑度短验。仓库不包含壁纸本体。

源窗口收在屏幕外，初始阶段任务栏仍可能显示入口，随后只尝试移除一次；不承诺跨机器 Alt-Tab 排除或 Explorer 重启后持续隐藏。部分场景的原生鼠标跟随本机已观察到，DSH 专用坐标/点击转发尚未接入；音频、通用交互、其它壁纸兼容性、数小时/数天运行尚未验收，.NET 10 依赖保留。

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

在 `dsh-whale-mist` 中运行：

```powershell
npm run check
npm run test:wallpaper-host
node qa/perf/check-frontend-stages.mjs
node qa/perf/check-native-pacing.mjs
node qa/perf/check-motion-cadence.mjs
```

需要Node.js/npm，原生隔离自测还需要.NET 10 SDK。检查不创建真实WE源窗口；代码/离线检查与用户桌面验收分别记录。

工作区manifest与打包资产保留rc.30基线，源码同时保留后续已复审P4/诊断实现；**不要直接把工作区打包当作日常rc.31/rc.32**。已有候选由隔离暂存目录构建和逐文件审计，见[rc.31候选](docs/RC31_NATIVE_WAIT_P4_CANDIDATE_20261015.md)及[rc.32诊断候选](docs/RC32_MOTION_CADENCE_CANDIDATE_20261016.md)。新发布应独立构建、记录新版本/包指纹，不覆盖同版本归档。`release/`和本机证据不随Git推送。

历史QA可能带本机路径，运行前检查输入和独立输出目录。构建缓存可以清理，原始实测/复审证据、源资产、运行环境和正在引用的包须保留。

## 安装和实机验收

在官方 Windows Desktop 的插件页添加新生成的 tgz，重开后从「设置 → 通用 → 鲸系外观」选择主题和背景。Wallpaper Engine 需要选择来源后手动点击「开始预览」。

安装、切换日常版本或恢复 Profile 前先备份。需要退出、重开或点击应用时，由用户操作界面，外部助手核验；代码和无窗口检查通过后再安排实机验收。

## 来源

源码从原 [dsh-desktop](https://github.com/xuanlangzhu-hub/dsh-desktop) 工作区拆出，起点本地提交为 `ff19f3bf42be2de2fb5715a120d77b8d5a5b2d9d`。本仓库保留插件目录结构、原生源资产和验收记录，后续插件开发在本仓库继续。
