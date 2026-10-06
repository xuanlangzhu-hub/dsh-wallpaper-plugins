# 0.6.0-rc.1 官方 Desktop 验收收尾

日期：2026-10-04（Asia/Shanghai）。本轮完成候选版的第一轮官方 Windows Desktop 验收，
随后恢复到用户原来的外观并正常退出应用。候选包保留给下一轮继续验证。

## 已确认

- 安装前备份：`C:\Users\HP\.dsh\backups\official-desktop-before-appearance-rc1-20261004-000437`。
- Profile 当前引用：`file:F:/deepseekharness/release/plugins/dsh-whale-mist-0.6.0-rc.1.tgz`。
- 官方设置页真实显示了深海、石墨、暗紫、墨绿四个深色配色。
- 四个配色在官方窗口中实际切换，颜色变化可见。
- 原生文件选择器成功导入 `wallpaper-test.jpg`，图片背景显示在聊天页面。
- 聊天文字、侧栏、输入卡片仍可读，输入卡片保持不透明。
- 图片导入后显示亮度、遮罩、模糊和界面不透明度滑块。
- 切换思考强度 Off → Max 后，背景和主题仍保留；Max 已恢复。
- 关闭背景后，图片副本仍保存在插件自己的 IndexedDB 中，但不再显示。
- 使用官方 Windows 文件选择器导入 `fixture.webm`，视频背景在聊天页实际播放。
- 视频播放期间聊天文字、侧栏和输入卡片保持可读；最小化后恢复窗口，页面继续正常工作。
- 正常退出 DSH 后重新启动，视频文件选择仍保留，说明 IndexedDB 保存和冷启动恢复有效。
- 恢复后的当前外观为：Whale Abyss / 深海、柔雾、均衡侧栏、标准玻璃、无背景。
- DSH 正常退出后，DeepSeek Harness 和 Whale 图标辅助进程均为 0 个。

## 本轮未完成

- 没有做大文件和长时间视频播放验收；最小化恢复已完成短时检查，未测后台暂停的实际资源占用。
- 没有把 Wallpaper Engine 接入正式 0.6.0 外观入口；WE 仍停留在 QA 可行性样机。
- 没有启用桌宠，因此本轮没有把候选版与桌宠共存写成已验收。

## 保留给下一轮的材料

- 候选安装包：[dsh-whale-mist-0.6.0-rc.1.tgz](../../release/plugins/dsh-whale-mist-0.6.0-rc.1.tgz)
- 候选 SHA256：`1FE677232C3EC8A710F97F3BD62F119E69BF5F42A3550CD64520B82542A02E80`
- 本轮临时媒体与验收记录：`F:\deepseekharness\.tmp\appearance-acceptance-20261004`
- 现有正式 0.5.2 包未覆盖；官方 EXE 和 `app.asar` 未修改。

下一轮优先验证桌宠共存与大文件/长时负载，然后再决定是否把候选版改成正式版本。

本轮后续补验已完成视频选择、播放和冷启动恢复；下一步改为桌宠共存与大文件/长时负载，
WE 内存传输的后续结果见 [内存流验证报告](wallpaper-memory-stream-20261004.md)。
