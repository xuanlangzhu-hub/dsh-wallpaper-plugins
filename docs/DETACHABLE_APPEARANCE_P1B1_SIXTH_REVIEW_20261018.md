# P1B-1六审：G1闭合，源码与QA离线阶段收尾

2026-10-18，Codex独立复审[五审补修交付](DETACHABLE_APPEARANCE_P1B1_FIFTH_REPAIR_DELIVERY_20261018.md)，对照[五审唯一余项G1](DETACHABLE_APPEARANCE_P1B1_FIFTH_REVIEW_20261018.md)。

**结论：通过。** 硬截止已同步锁定为timeout，后续exit/error不能抢先改判；有界终止结果termRes在返回前被消费并保留。正常退出0与工作错误非零保持。P1B-1生产源码及相关QA的本轮离线范围收尾，不再要求小G返工，不启动新的测试矩阵。

## 独立输入与验证

证据目录`.tmp/detachable-p1b1-sixth-review-20261018-e7104a93/`。冻结本轮交付QA/报告及生产src快照，新输出不覆盖旧证据。safe-qa-runner SHA256为`0128591FA1C8115FEA2B4ACAF83D98E3BBB2306D284E6BE95E5EC9B17B34B66A`，与交付一致。

逐项核对上轮158项src/qa输入完全不变，59项生产资产/归档保持；package.json和cordis.patch.yml也与上轮冻结内容一致。见`preservation.json`、`qa-inputs.json`、`final-evidence.json`。回放测试只将导入调整到冻结目录，该项意图差异单独记录；实际监督器未替换其判断/汇总实现。

独立验证：

| 检查 | 结果 |
|---|---|
| 交付专项及F1回归 | 9/9，约1.46秒，replay-qa.log |
| Codex直接调用实际runSupervisedScript | 6/6，约2.9秒，independent-supervisor.mjs/log |

六项独立检查覆盖：

1. 真实自有短命Node正常exit0，timedOut=false/code0。
2. 真实自有短命Node工作错误exit42，timedOut=false/code42。
3. 真实自有有限忙循环Node，180ms硬限触发后定向终止，timedOut=true/code1且termRes.terminated=true。
4. 底层ChildProcess替身在kill时exit0：仍返回timedOut=true/code1，保留termRes.exitCode=0，不误报成功。
5. 底层替身exit/error竞争：超时事实保持，唯一最终结果含终止证据。
6. **实际runSupervisedScript入口**配合拒绝退出的纯替身，约1.84秒有界返回timedOut=true/code1/termRes.terminated=false，保留清理未确认告警；不只单测safelyTerminateProcess helper。

仅spawn/ChildProcess IO在纯替身场景替换，监督判断、事件处理和结果汇总均使用冻结真实实现。真实worker是本轮创建的独立Node，自身忙循环也有1200ms上限；单测试3.5秒/测试进程4秒限制。未启动顽固真实浏览器，无全局taskkill，不触碰其它助手或日常应用进程。

本轮仅QA汇总变化，未机械重跑未变生产实现的check/P0/P1A/HTTP/React/几何/E2E；五审的生产检查与F1实际HTTP/SSE证据因指纹一致继续保持，不把引用写成本轮新跑。实现者本轮浏览器短路径结果保留为其交付证据，不冒称Codex本轮实测。

## P1B-1离线范围汇总

此前已过的独立/吸附外观分组、全量控件接入、权威设置与四字段预设门禁、动作顺序/在途协调、独立错误反馈，以及总截止/迟到回包拦截保持。本轮补齐QA监督结果可信性后，**P1B-1当前源码与QA离线阶段可以收尾**。

通过不代表候选已构建或已安装，也不代表真实Edge App系统窗、吸附交互、多屏DPI与日常实机体验完成。生产manifest/assets仍rc.30冻结，源码含Trace/P1A/B及后续工作，禁止直接整体打包。日常仍DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，本轮未安装、改Profile或操作DSH/WE，无模型请求、提交推送或工作区清理，定时g保持PAUSED。

## 接续

通知小G本阶段通过，停止本轮实现和QA，保留证据等待后续安排。后续产品主线是P1B-2壁纸预览库/详情页；真实系统窗口/候选验收也仍待排。它们不是本次复审自动启动的任务，不为收尾恢复A、三体/GPU专项或定时任务。

转达记录：23:30通过computer-use向同一小G新对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次六审通过/本阶段停止通知；核验新用户消息、输入清空及Working/Cancel，Gemini 3.8 Flash High保持。未派发下一阶段实现，定时PAUSED。
