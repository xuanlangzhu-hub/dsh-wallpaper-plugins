# Wallpaper 背景：分阶段计划与第一阶段调查

调查日期：2026-10-03（Asia/Shanghai）。开发仓库为 `F:\deepseekharness`。
本次完成只读环境和接口调查；未实现背景功能，未打开测试窗口，未安装插件包或修改 Profile。

## 阶段与验收门槛

| 阶段 | 工作 | 验收门槛 | 状态 |
| --- | --- | --- | --- |
| 1 | 安装环境、样本和插件接口调查 | 找到真实安装与可用样本，区分已知与待验证能力 | 调查完成，样本暂定 |
| 2 | WE 独立渲染 → 窗口采集 → DSH 临时背景 | 连续动态画面可见，遮挡不冻结，不抢焦点，可完整停止 | 最小链路及 DSH 最大化采集已验证；30 fps、隐藏和正式生命周期未完成 |
| 3 | Whale 主题背景层与基本控制 | 聊天可读，输入/选字/滚动正常，主题恢复与桌宠共存 | 未开始 |
| 4 | 音频反应与鼠标交互 | 分别验证音频反应、声音输出、移动、点击；聊天优先 | 未开始 |
| 5 | 图片/视频、配色、设置持久化与降级 | 切换、重启、文件丢失、WE 不可用时行为正确 | 未开始 |
| 6 | 性能、生命周期、打包与实际桌面验收 | 资源占用可接受、无持续增长/残留，保留旧包可回退 | 未开始 |

## 本机环境证据

- 正在运行的 `wallpaper64.exe` 位于 `E:\SteamLibrary\steamapps\common\wallpaper_engine`。
- EXE 文件版本为 `2.8.0.485`，同目录 `version.json` 为 `2.8.485`。
- Steam app id 为 `431960`；本机 appmanifest 记录 beta 分支和 build id `24783785`。
- Windows build `22631.3593`，DisplayVersion `23H2`。注册表旧 ProductName 不用作系统代际判断。
- GPU 枚举包含 Intel UHD Graphics 和 NVIDIA GeForce RTX 4060 Laptop GPU。
  Intel 条目报告 2560×1440、239 Hz；这不证明 WE 或未来采集实际使用哪块 GPU。
- PATH 中找到 Node 和 dotnet，未找到 ffmpeg。未安装或下载任何新依赖。
- 当前主题源码为 `dsh-whale-mist` 0.5.2；官方 Desktop 的开发与运行边界继续保持。

## 当前配置与首个样本

只读取 WE `config.json`，没有写回。配置的 monitor detection 为 `layout`，最近选择的显示位置为
`MonitorPositionL0T0`。该位置的 `selectedwallpapers` 指向：

`E:\SteamLibrary\steamapps\workshop\content\431960\3521337568\scene.pkg`

同目录 `project.json` 确认：

- 名称：**Cyberpunk: Edgerunner-Lucy[4K]**。
- 类型：`scene`，主场景封装在 `scene.pkg`，约 31.3 MiB。
- `general.supportsaudioprocessing: true`：声明支持音频处理；实际反应尚未验证。
- 时间组件有 `newproperty4`（可拖动）选项：可用作后续交互样本；实际交互尚未验证。
- 同时存在开场动画、光照、时间/日期组件等设置。

该壁纸暂定为第一张测试样本。配置中还有 `Monitor0`、`Monitor1` 的其它路径，
不能据此认定目前有三个活动显示器。

执行官方只读查询 `-control getWallpaper` 和 `-control getWallpaper -monitor 0` 未获得路径。
后者通过隐藏进程、重定向 stdout/stderr 查询，退出码为 0，两路输出为空。
因此本次只确认“配置指向这张壁纸”，没有把它写成已确认的当前屏幕画面。
后续可尝试按配置中的 location 查询；若仍为空，保留明确选择的样本路径进行实验。

备用样本来自配置的最近使用记录：

| 样本 | Workshop id | 已确认类型 | 用途 |
| --- | --- | --- | --- |
| Deepseek鲸鱼娘萌物！ | 3785592362 | web | 第二轮验证不同渲染类型 |
| 麻匪 泠泠泉心 21:9 16:9 | 3746422401 | scene | 后续较大场景及声音输出验证 |

原始壁纸资源只读引用，不解包、改写或复制进插件包。

## 会影响实验的现有设置

WE 配置为 `fps: 180`、`playbackfocus: run`、`playbackmaximized: pause`、
`playbackfullscreen: pause`、`playbacksleep: stop`。

- 独立壁纸窗口是否受这些暂停规则影响，需要专门测试；不改用户全局设置来掩盖问题。
- 720p/30 帧是采集和传输的初始目标，不代表已经能独立限制 WE 源渲染帧率。
- 必须同时记录源渲染与采集/传输的额外占用，不能只看背景页面帧率。

## 插件接入依据

1. 主题客户端 `src/client.js` 已使用 `ctx.theme`、`ctx.slots` 和 `ctx.effect`。
   设置槽位为 `settings.general.item`，已有 localStorage 设置和主题恢复逻辑。
   背景层可在插件生命周期内挂载和清理；具体层级、透明度和交互需阶段 3 验证。
2. 主题 Host `src/index.js` 已通过 `spawn(..., { windowsHide: true })` 管理原生图标辅助程序，
   并在 `dispose` 时通知退出。可参考生命周期设计，但图标辅助程序不直接承担采集任务。
3. 已安装 dsh-pet 0.3.0 的 `src/host/index.ts:948` 使用 `ctx.webServer.register` 注册前缀路由，
   客户端使用同源相对路径请求资源，说明现有插件有 Host 到客户端的数据通道。
4. 只读检查官方 `app.asar` 内源码：
   - `dsh/node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js:177` 注册路由并返回移除函数；
     第 235 行附近把请求交给 route handler。
   - `lib/main.js:11542` 附近将 `dsh-app://app` 下的动态请求转发给 Host。
   - `lib/main.js:7461` 的 `forwardWebRequest` 通过 `new Response(response.body, ...)` 转发响应体，
     不是预先读取完整 body 后再返回。
   这为流式画面提供候选传输路径；不等于已验证 MJPEG、视频编码或浏览器解码兼容性。

以上只读访问官方安装目录和已安装插件作为接口依据；没有修改 EXE、app.asar 或安装目录。

## 第二阶段的具体顺序

1. 开始可见窗口实验前确认用户当前方便；以暂定的 Lucy 场景为样本。
2. 使用唯一窗口名，例如 `WhaleWallpaperProbe-<本次标识>`，以 1280×720 独立运行。
   官方参数形式为 `-control openWallpaper -file <project.json> -playInWindow <name> -width 1280 -height 720`。
   启动行为是否抢焦点也属于测试项。
3. 先核对原生窗口中的动画和功能，再逐项测试失焦、遮挡、隐藏、最小化，以及 DSH 最大化状态。
   每项记录“渲染状态 / 采集状态 / 额外占用”，避免混淆源暂停和采集故障。
4. 验证原生窗口采集，在独立诊断输出中先证明画面持续变化，再接 DSH 临时背景。
   首轮传输形式根据采集结果选择；正式性能方案不在本阶段预先锁定。
5. 测试结束仅对本次唯一窗口执行 `closeWallpaper -location <name>`，清理本次辅助进程。
   禁止无目标 closeWallpaper；不使用影响全部壁纸的 pause/stop/mute；不终止用户 WE 主进程。
6. 任何实验包使用新版本、新文件名；接入实际 Profile 前备份，保留现有 tgz。

通过标准：DSH 中显示真实、连续的复杂场景画面；正常聊天和遮挡时不冻结，
源窗口不抢输入；可停止且不影响原桌面壁纸。音频反应与输入转发另列结果，
不从画面成功推导兼容所有壁纸或与桌面逐帧同步。

官方控制接口参考：<https://help.wallpaperengine.io/en/functionality/cli.html>。

2026-10-03 后续：[第二阶段采集报告](wallpaper-capture-20261003.md)。

同日续：[性能对比与 DSH 最小接入报告](wallpaper-integration-20261003.md)。

2026-10-04：[内存流验证报告](wallpaper-memory-stream-20261004.md)，已替换逐帧文件/客户端轮询，
官方 DSH 实测约 21 fps 实际绘制，停止按钮和子进程清理通过；源窗口隐藏与 30 fps 仍待完成。
