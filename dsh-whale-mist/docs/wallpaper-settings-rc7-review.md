# rc.7 按钮修复复审通过

同日补记：短实机复测已通过，临时候选版已撤回，日常 rc.1 与外观已恢复并由用户确认。
最新结果见 wallpaper-settings-desktop-acceptance.md 末尾「rc.7 短实机复测」；以下为安装前复审记录。

日期：2026-10-06。结论：B1 已修复，D1–D3 的无窗口回归保持正确，可进入短实机按钮复测。
这不是完整正式发布验收；rc.7 尚未安装，日常仍为 rc.1。
本轮未改实现、未操作鼠标、退出 DSH 或启动真实 WE 窗口。

## 独立核验

- 读取真实设置控件，逐一 await 开始、重新开始和停止按钮的 props.onClick：
  三种动作均正常执行，没有 ReferenceError，向 Host 发出 3 次 POST。
- 设置回调仅使用公开 controller 接口；失败处理和忙碌复位在 try/catch/finally 中。
- 同一实例停止后再开始，无需改参数就有画面层；
  前一轮绘制 14 帧，下一轮为本轮 1 帧，计时独立。
- 背景来源按钮实际文字为 Wallpaper Engine（实验）；中英文文字检查通过。
- npm run check、99 项浏览器断言及 stall/recovery/healthy 输出通过。
  检查包含真实按钮回调、失败后重试及运行时按钮可用性。
- git diff --check 通过。
- 新包内 26 文件与源码逐一一致。
- 日常 Profile 四份文件与实机验收前备份一致，没有安装候选包。

证据目录：F:\deepseekharness\.tmp\wallpaper-settings-rc7-review-20261006-101422。
独立按钮复现在 button-action-repro.json，包与环境核对在
package-comparison.json 和 profile-unchanged.json。
临时测试使用独立目录与浏览器 profile，旧证据未清理或覆盖。

## 包

F:\deepseekharness\release\plugins\dsh-whale-mist-0.6.0-rc.7.tgz。
SHA256：BC88C734887B801A140429882A3CD430E0307ED5348B4E78A20B5A67FE0583D2。
原生采集/Host 生命周期未变，仍为单 Lucy 场景、.NET 10 框架依赖的受监督预览。

## 剩余实机复测范围

用户确认当前方便、DS/其它助手暂停后，外部助手备份并临时安装 rc.7，用户重开。
仅需通过真实设置按钮检查：
1. 选项名称清楚，开始后直接显示动态画面。
2. 播放 20–30 秒后停止，直接再次开始，无需调透明度/亮度。
3. 每轮计数与倒计时从本轮开始；再点重新开始应直接恢复画面并重置指标。
4. 最后停止并确认无本轮采集/窗口残留，保留原桌面壁纸。
5. 恢复起点日常状态；若用户明确选择保留候选版，记录该选择。

失败后的按钮重试、中英文文案有隔离浏览器证据，
无需为此次按钮修复强行破坏真实场景或切换日常语言。
长时播放、停止/退出清理可引用 wallpaper-settings-desktop-acceptance.md，
除非再次修改相应实现。不开新功能、不重复隐藏方法调查或整套真实窗口测试。
实机完成后在原验收报告中追加 rc.7 结果，更新 NEXT_TASK.md。
