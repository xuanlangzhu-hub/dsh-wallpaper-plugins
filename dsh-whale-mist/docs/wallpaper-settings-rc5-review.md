# rc.5 代码与无窗口复审通过

日期：2026-10-06。结论：U1–U2 的针对性修复通过独立复现，可进入受控实机验收。
本结论不代表官方 Desktop 效果已经验收；候选包尚未安装，日常版本仍为 rc.1。
本轮未修改实现、提交或推送，未操作鼠标、退出 DSH、创建真实壁纸窗口或清理旧证据。

## 已核验结果

- U1：连续出帧的健康流在客户端时钟推进 30 秒后仍为 playing/running=true，
  绘制 1→33 帧，Host stop=0；首帧期限仅用于尚未得到首帧的阶段。
- 无帧和首帧后停帧仍能撤销画面、报告失败并请求 Host 清理。
- U2：真实 createPreviewSession 的报告定时器在停止后由 1→0，close 监听归零，源已确认关闭。
- 路由并发正文、正文期间 stop/unload、关闭失败实际重试、自然结束后新 start 等前轮独立复现均通过。
- 34 项 Host 检查通过（17 项 session + 17 项 routes）。
- 47 项浏览器断言及 stall/recovery/healthy 输出通过。
  加速健康运行检验绘制 12→112 帧，状态 playing、没有额外 Host stop。
- npm run check 与 git diff --check 通过。原 SDK 服务声明入口与 rc.4 逐字节一致，沿用已有真实 Context 契约证据。
- Node 测试的写入位置与临时目录均适配到本轮自有目录，未改被测实现。
- 全部新增复现放在独立目录，没有覆盖前轮证据。

证据目录：F:\deepseekharness\.tmp\wallpaper-settings-rc5-review-20261006-085443。
host-repro-with-timer.json、browser-repro-current-result.json 为独立复现结果；
package-comparison.json、profile-unchanged.json 为包与环境核对。

## 候选包与限制

包：F:\deepseekharness\release\plugins\dsh-whale-mist-0.6.0-rc.5.tgz。
SHA256：CADED49E93589D4C8C7CA7DBF2BC1BF766F5FEF9DB9E071C42321ACB3017C2EB。
包内 26 个文件与当前源码逐一一致。原生 helper/DLL、单 Lucy 样例与 .NET 10 依赖不变。
各版 tgz 与原始素材保留。

仍是手动开始的受监督预览，默认 180 秒、最大 300 秒；
长期持续运行、自动播放、壁纸库、音频/鼠标交互、任务栏入口移除和全屏锚定均不属于已验收能力。

## 下一步与恢复

按 next-wallpaper-settings-acceptance.md 做官方 Desktop 人工协作验收，
至少观察 45–60 秒的真实持续播放，确认超过 20 秒仍正常。
安装前重新确认用户方便、DS 已暂停、没有其它 AI 操作；先备份当前 Profile，
保留安装中引用的 rc.1 归档。用户负责所有界面点击，外部助手负责后台操作和核验。

本轮四份日常 Profile 文件与上一轮恢复备份哈希一致，
rc.5 未安装；实机步骤尚未执行。

