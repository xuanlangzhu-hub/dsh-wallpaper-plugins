# Whale Appearance / 鲸系外观

官方 DeepSeek Harness Windows Desktop 的主题与壁纸插件。当前已通过限定短验并保留日常的是 **0.6.0-rc.52**，宿主 **0.2.1-rc.3**。新鲜备份、43 文件核验、重开外观／布局和侧栏目录确认见[日常记录](../docs/RC52_DAILY_TRIAL_20261027.md)。

## 能力与使用边界

顶栏“Whale 外观”打开最右侧原生栏。壁纸页提供按年龄分级筛选的图库、预览和播放控制；界面页提供主题、配色、强调色与可读性。支持本地图片／视频背景，以及已经逐步核验的 Wallpaper Engine scene、video、web 路径。

WE 作者参数从公开声明读取并在侧栏编辑。Lucy 粒子开关的即时关闭、恢复已经观察；rc.52 的首次自动显示六项参数已经观察。未把它扩称为全部参数、全部壁纸或长期稳定通过。自动播放资格仍只有 Lucy，其它目标手动实验；available 只代表登记条件满足。

WE 集成需要 Windows、已安装的 Wallpaper Engine、对应壁纸和 .NET 10 运行时。仓库不分发壁纸本体，不操作原桌面 WE 的身份或进程。

## 这份源码不是可直接发布的 rc.52 包

本目录的 package.json 仍是 rc.30／private=true，原生资产基线未提升，源码含 Trace。**不得用本目录整体打包冒充日常 rc.52，也不得直接 npm publish。** 实际 rc.52 文本源码和完整指纹见[固定快照](../release-sources/rc52/README.md)，二进制保留在已审原包。后续发行需独立发布副本、完整资产与许可核对，不覆盖同版本归档。

开发源码、固定发行快照、生产安装／Profile 分开；修改共享目录不代表已安装。编译和单测不能替代实际桌面效果验收。

## 尚未解决

三体源窗口的运动节奏突变；UI 文案与布局继续迭代；任务栏入口初始闪现／完整隐藏行为。另保留宿主 bad port 启动事件和低优先级滚动异常。application 壁纸、通用输入转发、音频及全类型兼容未开放验收承诺。

## 开发检查

`npm run check` 检查语法及 CSS 模板。`qa/*.test.mjs` 和 `qa/wallpaper/*.test.mjs` 为分组单测入口；运行前核对替身、独立输出、阶段和总期限，历史浏览器／实机检查不自动执行。原生源码在 `qa/wallpaper-probe`，生产资产在 `assets/wallpaper`，两者按固定包审计，不能随意重建替换。

[项目状态](../docs/PROJECT_STATUS.md) · [历史说明](../docs/history/20261027/plugin-readme-before-maintenance.md) · [整理与推送记录](../docs/WORKSPACE_MAINTENANCE_20261027.md)
