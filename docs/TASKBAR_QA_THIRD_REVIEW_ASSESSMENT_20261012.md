# 对 Gemini 第三轮复审的核验与接续范围

2026-10-12，Codex。已读原报告、反例源码/JSON、生成入口及当前QA实现。
复制反例工程到全新`.tmp/taskbar-third-assessment-a79e784a`独立复跑，3个输出与Gemini一致；18个构建输入哈希与当前源码一致。
本轮只核验和写接续文档，未改实现、未操作真实WE/Shell/DSH、未安装或推送。

## 确认成立，需要补修

**R1接管空档与测试范围不足。** runtime已创建，但TakeOwnership在标准流/停止源准备后；这些前置操作若抛错，
外层finally只写not-owned，不执行本轮源关闭。独立反例确实得到closeCalls=0、假源仍在。
这是源码上的本地清理缺口，不能由假源测试升级成“真实桌面已观察到孤立泄漏”。
报告举的EnsureDefaultDesktop失败会抛错不准确：当前函数catch所有异常并返回false；输出目录校验也在TakeOwnership之后。
这些例子不成立，并不消除标准流等早期准备位于接管前的事实。

check-generated检查了实际调用点是否位于外层try，执行的是抽出的真实catch/finally配合成中间体。
8个标签均在接管后同一抛错点触发，不能声称逐项跑过WGC初始化；之前修复记录已声明不是WGC实测，但覆盖仍应前移到早期接管边界。

**R3失败归因写错。** 两个真实策略反例复跑得到action.call=Verify/HrInit、deleteTab=null，
failure.stage却为delete-tab，notes说DeleteTab失败。各调用HRESULT本身没有丢，但文字/阶段误导排错，需修正。

## R2需要区分事实与推断

- 事实：worker没有读取父采集进程的stdin取消令牌；只读stop.txt/Esc。父监视器会读真实取消回调，终止并确认worker退出。
  所以当前实现是“父进程监控取消并有界终止”，不是“worker内部协作取消”。可以补显式协作通道，但不能称取消完全未处理。
- 未证实：“强杀导致真实Explorer COM脏状态”。微软说明强制终止可能影响被终止进程的DLL数据，且终止是异步、需等待确认；
  这支持谨慎与退出确认，不证明本实现已损坏Explorer。见[TerminateProcess官方说明](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess)。
  独立worker本来就用于隔离挂起调用；协作停止不能替代超时终止兜底，不能把源关闭移到worker确认退出之前。
- 多次枚举为事实，性能影响待测。50ms是轮询间隔，生产worker等待上限为30,000ms；不能把50ms当超时预算。
  报告只数FindExactTitle与VerifyExpectedWindow，漏了Snapshot里的ZOrderIndexOf再次枚举；固定“四次”不完整。
  目前没有真实耗时/超时竞争数据，不因此删除动作前后身份复核，也不扩展成GPU/性能调查。

报告里的异步Shell_TrayWnd投递、Explorer重建时立即失效等实现细节未附来源或实验。
[DeleteTab官方契约](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist-deletetab)只承诺删除任务栏项目，
没有承诺Alt-Tab隐藏、窗口完全隐藏或多屏效果；继续把这些留给实机分别观察，不把报告中的绝对描述当已验证行为。

## 给下一位实现者的最小任务

1. R1：已接受本轮任务并创建runtime后，在标准流/取消源等准备之前确立清理责任；清理仍必须经HWND/location/PID/StartTime身份门禁。
   保留未接管/参数拒绝语义，不靠“只要存在就关”绕过门禁。回归检查实际生成入口的早期故障与接管次序，不能先手动接管再模拟所有异常。
2. R3：failure.stage使用实际action.Call，只有deleteTab确实执行时才写相应失败说明；覆盖Verify、HrInit、Worker及真正DeleteTab失败。
3. R2先明确术语与证据。如果本轮要补协作停止，使用本轮专用通道及离线父子进程检查，保留超时/异常终止与退出确认。
   禁止为了协作退出而无限等待、去掉worker清理门禁或删除必要身份校验。

仅修改qa/taskbar-hide及交付文档，使用全新证据目录；保留日常rc.24、生产源码/资产/Profile、旧证据。
修后先复审再约用户做C1独立短验，不自动安装、开真实窗口或推送。没有必要重写整套工具。
