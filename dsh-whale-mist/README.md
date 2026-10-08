# Whale Appearance / 鲸系外观

DeepSeek Harness Web UI 的一组可安装主题，包含浅色 `Whale Mist / 鲸雾` 与
深色 `Whale Abyss / 鲸渊`。它使用官方 `ctx.theme`、Settings
扩展槽位和公开 `--dsw-*` 设计令牌，保留官方侧栏、工作区、会话、输入框、
审批、问题和 Trajectory 的数据与交互。

本插件继续维护。原 Whale Tauri 桌面壳已冻结，Windows 的当前使用入口为官方
DeepSeek Harness Desktop；后续主题和其他插件按需求独立迭代。

## 0.6.0-rc.19 日常播放候选版（实验）

当前源码新增深海、石墨、暗紫、墨绿四种深色配色，本地图片/视频背景，以及
**Wallpaper Engine（实验）** 背景来源。本机日常 Desktop 仍使用已安装的旧版；
候选包只在人工协作的实机复测中临时安装，随后撤回。

- 设置入口沿用“通用 → 鲸系外观”，提供文件选择、背景亮度、主题色遮罩、模糊和界面不透明度。
- 图片上限 64 MiB，视频上限 1 GiB；实际可保存大小受本机存储配额限制。
- 文件以 Blob 保存在当前应用来源的 IndexedDB，无任意文件读取路由，也不会上传。
  浏览器与官方 Desktop 的数据各自独立；清理应用站点数据会移除已保存的背景。
- 视频静音循环，默认失焦暂停；“始终播放”也会在页面隐藏或系统偏好减少动态效果时暂停。
- 恢复默认会关闭背景并恢复原配色，保留已选文件；“移除”只删除插件保存的副本，不改原文件。
- 损坏替换文件先经过解码检查；解码、配额和存储错误会提示，原有已保存文件保留。
- 输入卡片和菜单保持不透明；减少透明度或高对比度偏好下隐藏背景。
- 四种背景来源互斥；选中 Wallpaper Engine 后由用户点“开始播放”，不会自动开始。

### Wallpaper Engine（实验）的边界

- 只支持已验证的 **Lucy** 场景；场景白名单在 Host 侧（`src/wallpaper/scenes.js`），
  前端只能提交场景 id、播放模式和预览秒数，不能提交路径、命令或窗口句柄。
- **两种播放模式**：
  - **日常**：没有定时结束，持续播放到你停止、切换来源、插件停用或退出宿主；
    状态行显示已运行时间与本轮帧数，不显示倒计时。
  - **预览（默认，限时）**：默认 180 秒、最大 300 秒后自动停止，供受监督的试验使用。
- **可选自动播放**：默认关闭。开启后只影响**下一次 DSH 启动**，且在“日常模式 + WE 来源 + 主机就绪”都满足时
  只创建一轮；同一次运行中手动停止后不会自己重新开始，改亮度或重挂组件也不会。
- 停止、切换来源、插件停用与宿主退出都会清理本轮唯一命名的源窗口与采集进程；
  关闭结果会被核对，未确认的关闭会在界面上提示重试。
- 需要 **.NET 10** 运行时：`assets/wallpaper` 内的 helper 是框架依赖构建。
- 源窗口收在屏幕外，但**仍可能在任务栏 / Alt-Tab 留下入口**；音频与鼠标交互尚未接入。
- 逐帧日志是有界的（保留最近一段并抽样更早的记录，上限约 1200 条），不会随运行时长无限增长。
- 实机证据与仍待验收项见 [Desktop 验收记录](docs/wallpaper-settings-desktop-acceptance.md)。

rc.13 已通过代码/隔离 DOM 短复审和本机单 Lucy 场景的核心实机验收：真实布局、同轮至少 35 分钟、限时预览、自动播放及正常清理。见 [实机记录](../docs/B_DAILY_PLAYBACK_RC13_DESKTOP_ACCEPTANCE.md) 与 [代码复审](../docs/B_DAILY_PLAYBACK_RC13_REVIEW.md)。启动仍闪出独立窗口、任务栏入口仍可能保留；GPU 数据包含原桌面与源窗口，不能据此宣称低开销。多场景和数小时/数天运行尚未验收。

rc.16 的短实机被反馈为「渐变的大片黑」，见 [rc.16 实机记录](../docs/RC16_DESKTOP_VISUAL_REVIEW.md)；
rc.17 改为仅输入卡片不透明、外围与底部显示壁纸，并按卡片在滚动区内的实际位置裁剪消息内容层，
已通过 [rc.17 短实机](../docs/RC17_DESKTOP_VISUAL_ACCEPTANCE.md)。

rc.18 加入**区域底色**：两个独立复选框，分别决定左侧项目／会话栏与聊天区是否用自己的主题实色盖住壁纸，
默认都不勾选（视觉与 rc.17 相同）。rc.19 按短实机反馈修两处：

- **聊天区范围**：勾选后覆盖整个右侧聊天列，包括会话标题与「对话／轨迹」标签栏（rc.18 只画了正文，
  标题栏仍透出壁纸）；文案同步为「聊天区（含会话标题与标签栏）」。
- **侧栏底部暗带**：透明壁纸态下，官方会话列表底部的 24px 渐隐会再叠一层半透明侧栏色，
  形成一条带硬左右边界的暗矩形（实测亮度 39.3 → 32.4）。该渐隐只在「背景激活且侧栏仍透出壁纸」时移除；
  侧栏选择实色或不使用背景时，宿主原样保留。

隔离页检查不能替代官方 Desktop 实机验收。

候选版检查与打包：

```powershell
npm run check
npm run test:appearance
npm run test:appearance-wallpaper
npm run test:appearance-wallpaper-layout
npm run test:appearance-wallpaper-pixels
npm run test:appearance-wallpaper-regions
npm run test:appearance-sidebar-band
npm run test:wallpaper-host
npm run test:sdk-contract
npm run build:client-protocol
npm run build:desktop-icon
npm pack --pack-destination ../release/plugins
```

`test:appearance` 与 `test:appearance-wallpaper` 使用独立临时 Edge Profile，真实验证 DOM、CSS、
IndexedDB、媒体解码与设置按钮回调，用轻量替身提供 DSH 服务和 React 设置树；
`test:wallpaper-host` 与 `test:sdk-contract` 在 Node 内验证 Host 生命周期、route 时序和官方 Cordis 注入契约。
`test:appearance-wallpaper-pixels` 加载真实客户端与记录的官方 CSS 子集，比较同位置隐藏/显示消息的
截图像素，覆盖长消息滚动、多行输入、窄高窗口、会话替换、图片/视频共享规则和撤销清理。
通过 `WM_PIXEL_MUTANT=unclipped/solidSeat/solidFrame` 可运行应失败的对照；`WM_CLIENT_SOURCE`
可指定旧客户端进行对照。`test:appearance-wallpaper-overlay` 转发此检查，不转发其它通过项。
这些都不接触日常 Profile、不创建真实 WE 窗口，也不代替官方桌面验收。
接续记录见 [外观候选版](docs/appearance-candidate-20261004.md) 与
[设置入口候选包](docs/wallpaper-settings-candidate.md)。

从干净检出重新打出的安装包与原包不同，原因是 `assets/whale-icon-helper.exe` 属于构建产物
（`npm run build:desktop-icon` 生成，仓库按策略忽略），且文本文件的行尾取决于本机 `core.autocrlf`。
发布包以 `release/plugins` 下的归档为准，源码与包内容的逐文件一致性由交付报告记录。

## 安装

在本目录的上一级运行：

```powershell
npx --yes @deepseek-ai/dsh plugin --profile web add ./dsh-whale-mist
```

重新启动 `npx --yes @deepseek-ai/dsh web` 后即可使用。插件默认激活
`whale-abyss`；在“设置 → 通用 → 鲸系外观”中可随时切换“鲸雾/鲸渊”。
选择会保存在本机浏览器，并在模型或推理强度切换引发宿主重新同步主题时自动恢复。

## 设计原则

- 鲸雾使用淡蓝渐变画布；鲸渊使用深海蓝黑画布、墨蓝侧栏和略亮的输入层。
- 鲸渊以 `#8C72F2` 紫色作为选择、焦点和推理光效强调色，不把整张界面做成霓虹紫。
- 玻璃只用于分层表面；长会话上方的输入卡片使用不透明渐变，滚动文字不会穿透。
- 官方“设置 → 通用”中提供主题、背景层次、侧栏层次和玻璃强度四组简洁选项。
- 标题旁的白鲸只在 Agent 运行或刚刚完成时出现；旧版 Harness 仍会显示会话快照提供的“等待确认”状态。`0.1.5-rc.1` 不再公开该字段，因此插件会安全降级，不影响标题栏和会话输入区。
- 系统字体栈与明确行高保持中文排版稳定。
- 高频交互没有装饰性进场动画；按钮只有 120ms 的按压反馈。
- 可选的 `dsh-reasoning-effort` 在鲸雾下使用蓝白静态轨道，已激活区域以淡紫—深紫波浪表达强度；鲸渊保留插件原版深色紫色辐射效果。
- 支持 `prefers-reduced-motion`、`prefers-reduced-transparency` 和高对比度。

`0.5.0` 增加了官方 Windows Desktop `0.2.0-rc.2` 的兼容声明；原 Whale Desktop 的 `0.1.5-rc.1` 以及更早的 peer 范围继续保留。官方新版仍提供主题注册、通用设置和会话标题槽位。桌面端安装使用应用内的“插件 → 添加插件”，选择本目录打出的安装包。已在官方 Desktop `0.2.0-rc.2` 实测鲸雾/鲸渊切换、设置项、会话与输入卡片，以及配合 `dsh-reasoning-effort` `0.8.0` 的 Off/High 滑块样式。

`0.5.2` 为官方 Windows Desktop 增加透明白鲸运行时图标。单改 `.lnk`
不能保证运行中的任务栏图标变化，因此插件启动时会为官方壳进程的窗口设置
大小图标和 Windows 任务栏重启图标属性，保留 `com.deepseek.dsh` 身份。
官方 EXE、签名和 `app.asar` 保持原样。Windows 原生辅助程序随 Host 退出，
插件停用时恢复窗口的原始图标与属性；浏览器、WSL 和原 Tauri 版本不会启动它。
辅助程序源码在 `src/windows/WhaleDesktopIcon.cs`；在 Windows 上运行
`npm run build:desktop-icon` 编译并验证真实窗口的设置/还原，再运行 `npm pack`。

## 回归检查

在正式 `3080` 服务运行时执行：

```powershell
node qa/official-regression.mjs
```

脚本会用真实鼠标验证侧栏展开/收起/再展开、鲸雾/鲸渊切换与主题恢复，打开一个
已有会话，确认输入卡片是不透明覆盖表面，并进入独立的 Trajectory 视图。
