# 给Gemini：C1动作异步执行，保持捕获出帧（仅QA编码）

先读AGENTS.md与[C1本机短验](C1_TASKBAR_DESKTOP_SHORT_TEST_20261012.md)。
当前DeleteTab路线本机Lucy能移除入口，调用后仍有动态；问题是主捕获循环同步执行RunWorker，产生一次3069ms接收间隔。
用户日常rc.24未动。此文是后续编码范围，不是此刻开窗/安装授权。

## 最小范围

只改dsh-whale-mist/qa/taskbar-hide及简短交付记录，不改src、accepted原生、assets、版本、Profile/外观、SDK、活动tgz。
不安装/退出DSH、调用真实Shell/WE、开窗、推送或清理任何证据。输出使用全新目录，保留现有改动。
不实施owner/TOOLWINDOW、DeleteTab重试/恢复矩阵、全局GPU/FPS调整或重新测性能。

## 要求

- 有效帧及最短基线后只启动一次worker，捕获循环继续编码/发布，不同步等worker启动/枚举/COM完成。
  仍用同一GraphicsCaptureItem/session，不把停止/重启/丢弃旧日志当修复。
- worker隔离、STA创建/调用/释放、调用前后身份与停止复核、真实HRESULT和窗口事实均保留。
  异步任务的触发时间与完成时间分开，完成前不写成动作已成功；不把旧帧当调用后的新画面。
- 策略状态、报告写入和关闭路径在并发下有明确归属；一次动作，不重复启动/关闭，报告不并发截断。
- 停止、Esc、stdin断开、采集异常或到期时，先处理本轮pending动作：传播停止、有界等待/终止，并确认worker退出。
  在未确认时拒绝关源、记未确认并非零。不得fire-and-forget后直接Finish，也不得无限await或放弃退出门禁。
- 失败归因/未执行或未知字段、证据写失败非零、已不存在/身份变化处理均保留。

## 离线验证

用假worker阻塞等待，验证动作pending期间真实捕获调用接缝仍能连续处理/发布多帧；不能只测后台Task返回很快。
覆盖并发到期/停止/取消/异常、未确认worker拒绝关源、动作只启动一次、报告序列化和原R1/R3/Release回归。
可用无窗口控制台假worker；禁止以真实桌面调用证明单元测试。
生成入口与实际runtime需共同验证，避免生产入口在等待、测试helper却跳过等待。

交付只报修改点、新证据、检查退出码、accepted与保护范围哈希未变及真实效果未验收。
完成后交Codex复审，再由用户明确方便时做一次独立短验，不自动进入Host接入。
