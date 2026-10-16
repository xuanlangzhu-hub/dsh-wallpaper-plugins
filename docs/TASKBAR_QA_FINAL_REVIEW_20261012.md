# C1 QA Gemini补修复核与离线收尾

2026-10-12，Codex。核对Gemini第三轮补修、当前源码及独立输出后，**离线复核通过，可以准备用户参与的C1独立短验**。
这不是任务栏实际隐藏通过：本轮未开真实壁纸窗口、未调用真实Shell/WE、未安装或改变日常rc.24、未提交/推送。

## Gemini修复确认

- R1：生产TaskbarQaRuntime.Create在返回前TakeOwnership，早于生成入口的标准流/取消源准备。
  接管的是本轮清理责任，不代表初始窗口观察一定通过；关闭仍受身份、worker退出确认门禁约束。
  缺失目标直接记已结束，身份变化不关源，未接管/参数拒绝语义保留。
- R3：Verify、HrInit、Worker、Create、Release、DeleteTab按真实call归因；Verify/HrInit未执行DeleteTab时不再写其失败。
- 原worker监视器、停止传播、退出门禁保持；未引入真实窗口实验、协作停止新架构或全局设置。

初次独立构建及复跑得到90/90自检、13/13生成入口检查，与Gemini交付一致。
检查仍使用假原生边界/合成初始化体，不代表13个真实WGC硬件故障逐一验收。

## Codex顺手补的一个诊断边界

在真实共同COM流程中，DeleteTab已调用后Dispose/Release抛错，最终call为Release，但原说明的兜底分支仍写
“DeleteTab was not attempted”。新增调用后/调用前释放失败两项回归，修前为91/92，调用后释放失败稳定失败。

仅在策略说明里优先检查execution.DeleteTab是否存在：若已尝试，说明Release发生在其后并指向独立调用结果；
没有执行则保留未执行说明。最终92/92通过。HRESULT与执行行为未改，生产源码/资产未改。

## 独立验证

证据根：`F:/dsh-wallpaper-plugins/.tmp/taskbar-gemini-final-review-95b8441a`。
gemini-source-snapshot与GEMINI_DELIVERY.md保留接手前源码/交付；release-red-build与红色自检保留失败；
final-build、final-selftest.json、final-generated-check、final-worker-check为最终结果。
初次未补释放边界的独立构建另位于`.tmp/taskbar-gemini-final-review-bogus`，不覆盖任何旧证据。

| 检查 | 结果 |
| --- | --- |
| 最终隔离构建 | 退出0，无警告，accepted来源/资产未变 |
| 同一可执行程序自检 | 92/92，含两种Release边界 |
| 生成入口/外层生命周期 | 13/13，早期准备、拒绝、身份变化、未接管等假场景 |
| 真正生产Create工厂 | 1项通过：原生窗口/WE边界为桩；不使用CreateOffline、不手动TakeOwnership，模拟返回后的流准备失败，真实Finish关假源一次 |
| 无窗口假worker真实进程 | 4/4，成功/坏协议/超时/取消，均退出，无迟到标记 |
| 受保护范围 | 13项源码/资产/tgz/Profile与基线相同；安装版本rc.24 |

actual-factory工程链接真正生产Create/runtime/RealWindowProbe，原生查询与关源由桩替代，进程StartTime仅读取测试控制台自身。
这补充了CreateOffline默认接管无法独自证明生产工厂接管的检查边界；没有触碰真实窗口。

## 下一步与范围

无需再让Gemini或DS重做R1/R3。保留当前QA工具，用户方便时做一次C1独立短验，分别记录真实任务栏入口、Alt-Tab、
焦点、DeleteTab调用前后动态帧与结束清理。视觉字段继续未知，直至有人工结果。
不自动装进日常包，不重跑GPU/长时性能流程，不修改官方EXE或结束原WE，不提交/推送。
