## Whale 外观 0.6.1

- 新增「跟随桌面壁纸」，随 Wallpaper Engine 主显示器的当前选择更新 DSH 背景。
- 新增「固定取景」，窗口移动或缩放时显示对应区域。合并同一浏览器刷新内的绘制，缓解快速拖窗时的短暂停顿。
- 修复窄窗下外观侧栏透出会话文字的问题。侧栏统一为原生外观入口，移除独立的「此壁纸预设」区。
- 适配 DSH 0.2.2-rc.5，并支持为自定义 Steam 库设置 `WM_STEAM_LIBRARY`。

Windows x64。Wallpaper Engine 集成需要 .NET 10 x64 运行时。固定取景在单屏 2560 × 1440 上用场景、MP4 和网页壁纸做了代表性实测。跟随查询限于已验证的 Wallpaper Engine 可执行文件版本，鼠标输入转发暂未开放。

下载 `dsh-whale-mist-0.6.1-windows-x64.zip` 及同名校验文件，解压后按 `INSTALL.md` 安装。
