# C1 QA R1–R3 修复与离线验收

2026-10-12，Codex。用户授权接手第二轮复审剩余三项，修复仅涉及隔离QA工具及接续文档。
**日常安装仍为rc.24；未开真实窗口、未调用真实Shell/WE、未安装或改生产资产、未提交/推送。**

## 修复

- R1：生成程序在最外层try外保存runtime，最外层finally统一Finish。CreateDevice/CreateItem/帧池/会话/StartCapture/发布及资源释放失败都在此范围内。QA禁用原accepted父断开关闭分支，保留无QA的原分支。已接管源只清理一次；未接管写not-owned/closed=null；已确认不存在直接记already-gone，不再按名字关闭；身份变化拒绝关闭并非零。
- R2：独立worker监视器记录Started/Exited/TimedOut/Cancelled/TerminationRequested/Terminated。异常、停止、超时都收敛到终止并确认退出，不以Dispose代替结束，不解析错误文本猜状态。策略进入执行器前即把清理标为未确认，明确返回退出事实后才放行；未确认或执行器抛错时，真实runtime禁止关源且非零。stdin停止/断开、stop.txt、Esc接到主监视器；worker侧最后复核读取stop.txt/Esc及当前身份/可见状态。worker的STA调用不使用抛弃线程的超时，父进程负责截止与终止。
- R3：runtime直接使用带失败返回效果的写入边界；写入异常记report-write-failed、保持非零，同时完成必要清理。旧文件存在不能掩盖本次写失败，报告初次以CreateNew保留归属。HrInit/DeleteTab由实际共同COM流程各自记录，再经worker完整JSON传回；未调用/未知字段为null。COM创建、调用、释放留在同一STA，真实接口槽位不变。

runtime从build.mjs长字符串移到独立QA源文件，生成项目直接链接它，使检查与实际运行用同一份代码。
F1参数绑定、发布后帧触发及生产源码均保留；无QA命令不再被强行按捕获请求预解析，保留accepted工具命令入口。

## 验证与证据

全新目录：`F:/dsh-wallpaper-plugins/.tmp/taskbar-qa-repair-c2acac7d`。before保留接手前源码；旧复审/DS目录未覆盖。
先前真实runtime反例保存在第二轮复审目录，修前会漏关源/错误成功退出；新生成入口检查运行于旧构建时也拒绝缺失外层finally。

| 检查 | 结果与边界 |
| --- | --- |
| 隔离构建 | final-build，退出0，accepted源码/资产未变；不替换生产helper |
| 同一QA可执行文件自检 | 88/88；包含真实runtime清理门禁/报告写失败、共同COM流程及假worker监视器；无窗口/Shell调用 |
| check-generated.mjs | 8个故障/正常/停止场景通过；检查实际生成调用点，抽取原样外层catch/finally配假初始化执行；不是WGC硬件验收 |
| check-worker.mjs | 4/4；真实控制台子进程的成功/坏协议/超时/取消，均确认退出，无迟到标记；COM边界为假对象 |
| 受保护文件 | 13项源码/资产/tgz/Profile哈希与接手前基线相同；安装版本rc.24 |

两次初始编译失败日志保留，原因分别是CloseResult.WaitedMs为long的类型适配遗漏；修正后最终构建无警告。
上述结果证明隔离工具的接线与离线边界，不证明真实DeleteTab可移除任务栏按钮，更不证明Alt-Tab隐藏、帧连续性或无闪窗。

可重放命令（每次使用全新输出）：

```powershell
node qa/taskbar-hide/build.mjs --output <全新构建目录>
$env:WM_TASKBAR_SELFTEST_OUT = '<全新证据文件>'
<构建目录>/native/WallpaperProbeTaskbarQa.exe --taskbar-self-test
node qa/taskbar-hide/check-generated.mjs --build <构建目录> --output <全新检查目录>
node qa/taskbar-hide/check-worker.mjs --output <另一全新检查目录>
```

## 下一步

R1–R3离线阻塞已补齐，先以本记录及新源码复核，再与用户约C1独立短验。保留日常rc.24与原WE，先确认用户方便；
实测需分别观察任务栏、Alt-Tab、焦点、调用前后动态帧、退出清理，视觉字段不能由HRESULT填成通过。
本轮不继续安装、开窗、收集真实性能或推送。避免并行修改这套QA，DS无需再重做R1–R3。

## 第三轮复审接续记录

根据第三轮复审及核验评估（见 [TASKBAR_QA_THIRD_REVIEW_ASSESSMENT_20261012.md](file:///F:/dsh-wallpaper-plugins/docs/TASKBAR_QA_THIRD_REVIEW_ASSESSMENT_20261012.md)），已完成 R1（接管时机前移至 Runtime 创建）与 R3（真实失败阶段归因与如实说明）的局部补修及 13 阶段完整离线回归，消解全部 3 个反例；详见 [TASKBAR_QA_THIRD_REVIEW_REPAIR_20261012.md](file:///F:/dsh-wallpaper-plugins/docs/TASKBAR_QA_THIRD_REVIEW_REPAIR_20261012.md)。
