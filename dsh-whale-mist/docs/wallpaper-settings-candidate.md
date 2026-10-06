# Wallpaper Engine 设置入口候选版：dsh-whale-mist 0.6.0-rc.2

日期：2026-10-05。范围：源码实现、针对性检查、候选包交付。**未安装、未改日常 Profile、未创建真实 WE 窗口、未退出宿主。**
本机实机验收（安装、重启、用户点击）留待下一轮人工协作，报告见 `wallpaper-desktop-integration.md`（0.0.7 实验包那轮）。

## 1. 相对本轮起点的改动

起点：`7eca301`，工作区 12 项未提交改动全部保留；本轮只在下表列出的文件上增量工作，未提交、未推送。

| 文件 | 改动 |
| --- | --- |
| `src/wallpaper/scenes.js`（新增） | 纯模块：已验证场景白名单、预览时限、窗口尺寸、可用性原因；不含 Node 内建，Host 与前端共用同一份列表 |
| `src/wallpaper/session.js`（新增） | 主题侧 Host：单轮会话、路由、日志轮转、可用性判定；复用 0.0.7 已验证的生命周期 |
| `src/wallpaper/frame-hub.js`、`frame-protocol.js`、`probe-log.js`、`managed-window.js`（新增，逐字复制自 `qa/wallpaper-preview`） | 已验证的背压/取帧、WHL1 解码、stderr 信封、窗口身份与唯一名校验；不维护第二套实现 |
| `src/index.js` | 在原图标辅助程序之外注册预览路由；Host 服务、helper、样例缺失时只告警并禁用预览，不影响主题 |
| `src/client.js` | 新增 Wallpaper Engine 背景来源、预览传输、画面层、设置控件、文案与 CSS；内联 WHL1 解码器 |
| `scripts/build-wm-protocol.mjs`（新增） | 把 `src/wallpaper/frame-protocol.js` 注入 `client.js`（幂等） |
| `assets/wallpaper/*`（新增 12 个文件） | 框架依赖版原生 helper 及其运行依赖，逐文件与 `qa/wallpaper-probe/bin` 一致 |
| `package.json` | 版本 0.6.0-rc.2；files 增加 `src/wallpaper`、`assets/wallpaper`；新增 check/build/test 脚本 |
| `qa/wallpaper/session.test.mjs`（新增） | Host 侧 17 项针对性检查 |
| `qa/appearance-wallpaper-regression.mjs`、`qa/appearance-wallpaper-fixture.js`（新增） | 真实主题客户端的无窗口浏览器检查（30 项断言） |
| `qa/appearance-harness.js` | 原回归改为按所选来源断言文件输入（选择来源才挂载对应控件） |

未改动：正式主题既有配色/画布/侧栏/玻璃逻辑、`qa/wallpaper-preview` 与 `qa/wallpaper-probe` 源码、
0.0.7 与 0.6.0-rc.1 归档、官方 EXE/app.asar、用户 Profile 与外观设置。

## 2. 设置与行为

- 背景来源新增「Wallpaper Engine（实验）」，与无/图片/视频并列；默认仍是「无」，安装候选包本身不开始采集。
- 选中后提供**开始预览 / 重新开始 / 停止预览**三个受约束动作与一行状态（未开始 / 创建源窗口 / 等待首帧 / 预览中·帧率·时限 / 暂时中断 / 已停止）。
- 复用现有亮度、主题色遮罩、模糊、界面不透明度与 cover 缩放；没有为 WE 另做一套外观参数。
- 同一时刻只有一种活动的背景：切到图片/视频/无时先请求 Host 停止本轮，再呈现所选背景；切回 WE 不会自动开始。
- 选择与参数（含场景）存入原有 `dsh-whale-mist.appearance.v1`，重载后保留；首版仍由用户点击开始。
- 每次开始都由 Host 建立新实例与新唯一窗口名；重复开始、快速切换、启动途中停止都不会留下额外资源。
- 停止、到达时限、失败、停用插件与退出宿主都清理本轮源窗口与采集进程（沿用 0.0.7 已验证的关闭路径）。
- 失败时聊天界面保持可用、用户参数保留、状态行给出原因与重试入口；不无限自动重启。
- 非 Windows、非官方 Desktop、Host 服务缺失、helper 缺失或样例缺失时：主题其余外观功能不受影响，设置行说明不可用原因。

## 3. 实现边界与资源归属

- 前端只提交 `start` / `restart` / `stop` 与场景 id；**没有**接受任意 helper 路径、输出目录、命令或 HWND 的接口。
- Host 从插件自身打包位置解析 helper（`assets/wallpaper/WallpaperProbe.exe`），不依赖 TEMP 配置、`F:` 开发目录或历史 PID/HWND。
- 日志写在 `%LOCALAPPDATA%\Whale Appearance\wallpaper-preview\<时间戳>-<随机>-<场景>\`，只保留最近 8 个运行目录；
  每次运行只写 `preview-status.json` / `preview-final.json`，不写 JPEG 帧文件。
- 停止的关闭调用带本轮唯一窗口名与 PID，并在 `closed!==true` 时记录为失败，不把进程退出码当成清理成功。
- 未把 QA 实验包里的高优先级透明规则复制成永久覆盖：主题侧的透明与遮罩仍由原有变量控制，只在真实画面到达后才生效。

## 4. 检查与结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 语法 | `npm run check` | 通过（client / index / session / scenes） |
| 协议注入幂等 | `node scripts/build-wm-protocol.mjs` | 第二次运行报告 already up to date |
| Host 侧针对性检查 | `npm run test:wallpaper-host` | **17 项通过 / 0 失败** |
| 浏览器侧针对性检查 | `npm run test:appearance-wallpaper` | **30 项断言通过**（真实主题客户端 + 模拟 Host，无真实窗口） |
| 原有外观回归 | `npm run test:appearance` | 通过（含图片/视频、存储故障、减少透明度、快速切换、卸载） |

Host 侧覆盖：唯一命名与新实例、只在 `captureSource=window` 后收起窗口、非本轮来源不动作、重复停止只关一次、
建窗途中停止仍关窗、helper 报错后晚到窗口仍回收、采集错误上报、`closed:false` 记为失败、
单实例拒绝第二次运行、场景白名单与样例缺失、可用性四种原因、日志轮转、路由只接受受约束动作、
并发开始只建一个实例、重新开始先停旧实例、停用插件停本轮、运行数据只落受控目录。

浏览器侧覆盖：不可用时状态可见且不建实例、选中来源不自动开始、三个控件与场景选择存在、
画面层不接收鼠标事件、亮度/模糊/遮罩确实作用于 WE 画面、清晰画布保持透明、输入卡片保持不透明、
未复制 QA 专用透明类、切到图片先停本轮、切回不自动开始、重新开始走受约束路由、停止后画面层移除、
请求不离开 `/whale-wallpaper` 前缀、卸载后画面层移除、缺少样例时给出原因。

未运行（按入口要求）：会反复创建真实窗口的整套 `npm test`、`capture-journal`、`managed-session.e2e`。

## 5. 候选包

- 文件：`release/plugins/dsh-whale-mist-0.6.0-rc.2.tgz`
- SHA256：`8BB9F1ABE6E9B581978235B50C38CA7BDE63C6F91CB1A76E2D5AB62ADEA3529C`
- 大小：6.93 MB（26 个文件）；0.6.0-rc.1 与 QA 0.0.7 归档保留，未覆盖任何旧包。
- 一致性：包内 10 个文本文件与源码逐文件 SHA256 一致；`assets/wallpaper/WallpaperProbe.exe` 与
  `qa/wallpaper-probe/bin` 一致（`8584655D915ADF36CF25E1588ED695C0C8E7AC2E98AAECBA7728188407129593`）。

### 原生运行依赖（必须写明）

包内 helper 是**框架依赖**构建：需要 `Microsoft.NETCore.App 10.0`（本机已安装 10.0.10）。
带上的 DLL 是 WinRT/SharpGen/Vortice 运行时（`Microsoft.Windows.SDK.NET.dll`、`WinRT.Runtime.dll`、
`SharpGen.Runtime*.dll`、`Vortice.*.dll`）与 `deps.json`/`runtimeconfig.json`。
缺少 .NET 10 运行时时预览会启动失败并报 `helper`/启动错误；主题其余功能不受影响。
本轮没有改成自包含发布以控制体积，这是明确记录的候选包限制。

### 本机样例依赖

- 场景：Lucy，`E:\SteamLibrary\steamapps\workshop\content\431960\3521337568\project.json`
  （精确路径见 `src/wallpaper/scenes.js`）。文件不存在时设置行报 `scene`，不暴露任意路径执行能力。
- Wallpaper Engine：`E:\SteamLibrary\steamapps\common\wallpaper_engine`（由原生 helper 自行调用）。

### 预览时限

30–300 秒，Host 侧强制；默认 180 秒。UI 明示「受监督预览，最长 5 分钟」。
长时间持续运行与启动后自动播放不在本轮。

## 6. 实机尚未验收（下一轮交接）

1. 安装 rc.2 到日常 Desktop、正常退出并冷启动后，设置入口在官方界面里的实际观感（本轮只有隔离浏览器证据）。
2. 用户点击开始后 DSH 内真实动态画面、聊天文字与输入卡片可读性（亮度/遮罩/不透明度在真实表面的表现）。
3. 停止、重新开始、切换来源、停用插件、正常退出 DSH 各场景的真实清理与 10 秒界限。
4. 减少透明度/高对比度偏好下的表现（本轮只断言了 CSS 变量与层可见性，未在系统偏好开启时人工确认）。
5. 多实例/多会话下的表现与长时间运行；其它 WE 壁纸类型仍未支持。
6. .NET 10 运行时缺失的机器上，是否改为自包含发布。

DS 不自行退出宿主、不操作鼠标：以上需要用户点击、外部助手核验。
