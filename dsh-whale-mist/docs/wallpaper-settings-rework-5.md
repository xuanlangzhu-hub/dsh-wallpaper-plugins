# rc.6 复审返工：B1 按钮回调修复与新候选包 0.6.0-rc.7

日期：2026-10-06。范围：只修 `wallpaper-settings-rc6-review.md` 的 B1，未加功能、未安装包、未创建真实 WE 窗口、未退出宿主。
交付包：`release/plugins/dsh-whale-mist-0.6.0-rc.7.tgz`
SHA256：`BC88C734887B801A140429882A3CD430E0307ED5348B4E78A20B5A67FE0583D2`（26 文件，6.93 MB；rc.6 及更早包全部保留）。

## 1. B1 [P1] 设置按钮读取其它函数中的局部变量

**根因**：我在 rc.6 给「开始/重新开始」加的图层准备逻辑写在了设置组件里，却读了三个不属于它的名字：
`selectionRevision`（`apply` 作用域）、`reconcile`（`createBackdrop` 作用域）、`themeActive`（主题状态，未通过接口传入）。
点击任何预览按钮都会先抛 `ReferenceError: selectionRevision is not defined`；而且这次读取发生在
`try/finally` **之前**，`setPreviewBusy(true)` 已经把按钮置忙，异常后不会复位——三个按钮共用该回调，全部受影响。

**修法**：

1. 设置组件不再触碰任何外层闭包：`runPreview` 只用公开的 `controller.wallpaper[action](scene)`，
   并把它**整体放进 try/finally**，任何失败都会复位忙碌状态；
2. 撤掉重复的 UI 图层准备逻辑——渲染路径（rc.6 已验证）会在本轮第一帧到达时自建缺失的画面层，
   所以按钮路径不需要也不应该再去 reconcile；这样既修掉错误，也去掉了两处配置漂移的可能；
3. 控制层自身的失败通过设置组件内的 `previewActionError` 状态显示在状态行里，失败后按钮立即恢复可用，
   不吞掉错误、不改用全局变量。

**反向复现**（复审的 `button-action-repro.mjs`，以副本运行、输出到本轮目录，读取真实按钮的 `props.onClick`）：

| 指标 | rc.6 | rc.7 |
| --- | --- | --- |
| wallpaper-start 点击 | `ReferenceError: selectionRevision is not defined` | **ok** |
| wallpaper-restart 点击 | 同上 | **ok** |
| wallpaper-stop 点击 | 同上 | **ok** |
| 按钮发出的 POST 请求数 | 0 | **3** |
| 直接调用控制器的重复开始 | 正常 | 正常（未回归） |

## 2. 回归：改为执行真实按钮回调

新增第 5d 组（并加了一条静态守卫），全部通过真实 `props.onClick` 驱动，不再绕过按钮：

- **开始 → 停止 → 再开始**：断言按钮真的有 click 回调、点击后确实向 Host 发出请求、状态行离开「未开始」、
  出现画面且 `data-wm-backdrop="wallpaper"`；运行中「开始」禁用、「停止」可用；停止后画面移除且「开始」恢复可用；
  再次点击开始立刻有画面（不需要改任何设置），并且是本轮自己的计数与计时；
- **重新开始**：点击后画面保持；
- **失败后仍可重试**：让 Host 拒绝开始，点击后不留下运行实例、按钮恢复可用、状态行给出原因且无 `undefined`，
  随后再点击开始可以成功；
- **静态守卫**：扫描打包后的 `client.js`，断言设置组件（`WhaleAppearanceSettings` 到 `WhaleSessionStatus` 之间，
  已剔除注释）不出现 `selectionRevision`、`themeActive`、`reconcile(`、`backdrop.update`、`backdrop.stop`，
  且只使用白名单内的公开控制器成员（`read/media/wallpaper/set/reset/importMedia`）。
  这条守卫正是为了让「点击才报错」这类跨作用域错误在无窗口检查里就暴露。

## 3. 检查结果（无窗口）

| 检查 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm run test:sdk-contract`（真实 Cordis Context） | 通过（退出码 0） |
| Host 测试 | 34 项通过 / 0 失败（session 17 + routes 17） |
| 浏览器侧（WE） | **99 项断言通过**（rc.7 前为 66；新增按钮点击与静态守卫），stall / recovery / healthy 输出未变 |
| 原有外观回归 | 30 项断言通过 |
| `git diff --check` | 无行尾空格 |

重复显示、每轮计数与中英文文案的既有行为全部保持（对应断言仍全部通过）。
原生采集、Host 生命周期与功能范围未改动。

## 4. 包与一致性

- `release/plugins/dsh-whale-mist-0.6.0-rc.7.tgz`，SHA256 见文首；`0.5.0`、`0.5.2`、`0.6.0-rc.1`–`rc.6` 全部保留。
- 包内 10 个文本文件与源码逐文件 SHA256 一致；`assets/wallpaper/WallpaperProbe.exe` 与 `qa/wallpaper-probe/bin` 一致。
- 原生依赖与样例范围不变（框架依赖、需 .NET 10；仅 Lucy）。

证据目录：`.tmp/wallpaper-settings-rework-20261005/`（`button-action-after-fix.mjs` 与 json、
`rc6review-button-action-after-fix.json`、历史复现输出、`sdk-contract.json`）。
本轮未创建真实窗口，`wallpaper64` 与桌面壁纸未受影响，日常 Profile 仍是 rc.1，未提交未推送。

## 5. 复测范围

复审通过后只需复测真实设置点击的受影响场景（开始、停止、再开始、重新开始、失败后重试与入口文案），
前一轮的播放与退出清理证据可继续引用。
