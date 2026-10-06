# 项目状态与接续入口

更新：2026-10-06。仓库：`xuanlangzhu-hub/dsh-wallpaper-plugins`。本机独立检出：`F:\dsh-wallpaper-plugins`。

## 当前完成的阶段

Whale Appearance 源码版本为 `0.6.0-rc.7`。真实开始、停止后再次开始、重新开始均无需调参数就直接出图，每轮计数和倒计时正常，停止恢复主题并清理本轮源窗口、采集进程。

代码与无窗口复审、短实机复测均通过。详见 [rc.7 复审](../dsh-whale-mist/docs/wallpaper-settings-rc7-review.md) 与 [Desktop 验收](../dsh-whale-mist/docs/wallpaper-settings-desktop-acceptance.md) 末尾的 rc.7 记录。

实机验收结束后已撤回临时候选版，用户日常仍使用 rc.1，外观与 Profile 恢复并由用户确认。现有安装包继续留在 `F:\deepseekharness\release\plugins`，Profile 仍引用原路径；迁移源码仓库不移动或覆盖这些文件。

## 下一阶段

当前阶段完成，下一阶段范围等待用户确定。先制定范围与验收条件，再让实现者开始；不要把旧计划中的“下一轮”当成当前指令。

现有 WE 功能限于单 Lucy 场景、.NET 10 依赖、默认 180 秒 / 最大 300 秒的手动预览。源窗口仍可能有任务栏 / Alt-Tab 入口；音频、鼠标交互、多壁纸兼容性、长期播放没有新增验收。全屏桌面坐标锚定的背景想法仍被推迟。

## 本机历史资料

- 原工作区 `F:\deepseekharness` 保留，用于历史源码、资产、归档与验收证据。
- rc.7 证据：`F:\deepseekharness\.tmp\wallpaper-settings-rc7-desktop-20261006-102024`。
- rc.7 起点备份：`C:\Users\HP\.dsh\backups\official-desktop-before-settings-rc7-20261006-102024`。
- 官方程序与 `.dsh` 属于运行环境，不作为源码开发目录。

这些是本机历史路径，不能复用旧 PID、窗口名或证据目录。新检查写入本轮独立目录，保留旧证据。

## 拆分来源

原工作区的插件提交为 `bbab190`、`c838b82`、`8aab3e2`、`a986196` 和 `ff19f3b`；本仓库以最后一项的已提交插件快照为起点。迁移后原工作区的来源历史与正在引用的包均保留。
