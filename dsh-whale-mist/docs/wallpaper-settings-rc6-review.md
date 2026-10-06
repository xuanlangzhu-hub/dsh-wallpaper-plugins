# rc.6 复审：D1–D3 控制器路径通过，按钮回调存在一个阻塞

日期：2026-10-06。结论：rc.6 暂不安装，只修 B1 后交回复审。
本轮没有改实现、安装包、操作鼠标或创建真实 WE 窗口。
证据目录：F:\deepseekharness\.tmp\wallpaper-settings-rc6-review-20261006-095402。

## 已验证内容

- 独立隔离浏览器直接调用真实控制器：停止后再开始无需改参数就能呈现画面，
  第二轮绘制 1 帧时已有画面层，前一轮为 13 帧；本轮计时重新开始。
- 背景选项实际文字为 Wallpaper Engine（实验）。
- npm run check 通过；现有 66 项浏览器断言及 stall/recovery/healthy 输出通过。
- rc.6 包 SHA256：EEA57B4327B7144E6B9025036FF3FECF3653F59FCA8E47B797A3F5835DDC9305。
  解包后 26 文件逐一与源码一致；Host session 与已验收 rc.5 字节相同。
- 日常仍为 rc.1，未安装 rc.6。原包与旧证据保留，新增复现使用新目录。

## B1 [P1] 设置按钮读取其它函数中的局部变量，点击立即报错

位置：src/client.js:1581–1594（WhaleAppearanceSettings 内的 runPreview）。

新增逻辑先读取 selectionRevision，再调用 reconcile() 并检查 themeActive。
selectionRevision 定义在 apply 内，reconcile 定义在 createBackdrop 内，
themeActive 也不是此设置组件可访问的对应状态。
这些不是 WhaleAppearanceSettings 的闭包变量，也没有通过 controller 传入。

点击会首先抛 ReferenceError: selectionRevision is not defined。
且读取发生在 try/finally 前，previewBusy 已被置为 true，
真实组件可能一直保持忙碌；开始/重新开始/停止三个按钮共享该回调，全部受影响。

独立复现：button-action-repro.json。
读取 fixture.controls 返回的真实设置按钮，直接 await props.onClick()：
三种动作均抛上述 ReferenceError，POST 请求数为 0。
同一实例直接调用 controller.wallpaper.start/stop 可以运行，
证明问题在设置按钮路径，而不是采集或传输层。

现有 66 项回归仅直接调用 controller.wallpaper，没有执行按钮回调，
所以可以全部通过而真实点击不能工作。

## 修复与检查要求

- 使用当前公开 controller 接口协调状态；若需额外准备方法，
  在拥有来源/主题/选择代号的控制器或 backdrop 内实现并通过明确接口暴露。
  渲染路径已能自建缺失层，可评估撤掉重复的 UI 准备逻辑。
- 不读取外层不可见局部变量，不通过共享全局变量或吞掉 ReferenceError 掩盖问题。
- 确保一切可能失败的操作也处于 try/finally 内，失败后按钮恢复可用并显示原因。
- 回归必须执行真实按钮 props.onClick，而非绕过按钮直接调用控制器：
  开始 → 停止 → 再开始、重新开始、停止，以及模拟失败后仍可重试。
- 重复显示、每轮计数与中英文文案保持此次已修正行为。
- 不改原生采集、Host 生命周期或扩大功能；不重新跑会弹真实窗口的整套测试。

只修 B1，另打 rc.7（若已有则递增），不覆盖 rc.6。
交付相对 rc.6 的变更、按钮回归、包 SHA256，再交 Codex 复审。
通过后只复测真实设置点击的受影响场景，前一轮播放与退出清理证据可继续引用。

