# 主端收尾：认证顺序与迟到连接补修复审

2026-10-19，Codex。承接[R1隔离访客短验](COMPANION_R1_GUEST_SOURCE_REPAIR_REVIEW_20261019.md)中发现的main dispose认证401。**开发源码补修及离线复审通过：24项专项、31项相关回归、语法/CSS守卫通过；Host认证规则与R1/R2修复保持。** 本轮无可见窗口、DSH/WE操作或安装。随后已独立整合[rc.38候选](RC38_COMPANION_REPAIRS_CANDIDATE_REVIEW_20261019.md)，日常仍rc.35。

## 根因与实际修复

旧客户端先abort主SSE，真实Host的SSE close立即撤销mainSession，随后发送的disconnect失去会话认证。旧代码还存在第二次dispose提前返回ok:true、catch吞网络/JSON异常、非2xx或非法确认值未经核验，以及请求无截止等缺口。不是Edge账号提示再次出现，也不以放宽认证解决。

- 每实例发布唯一dispose Promise，再进入回调，覆盖并发、重复和同步退订重入；所有调用等待同一实际结果，失败不被后一次改写成成功。
- 冻结发起代次；先发已有token/instanceId/generation认证的disconnect，fetch与JSON合计3秒截止，finally才abort SSE。即使底层fetch忽略signal、JSON体永不结束，也由Promise.race有限落定；定时器清除。
- HTTP与JSON只在2xx且严格ok:true时确认成功；真实ok:false保留。网络、超时、坏JSON、空/非法ok和伪成功的非2xx均失败；失败不擅自改成docked或清token。
- dispose后不能再次connect或恢复SSE。连接迟到时，用其**实际返回且有效的正整数代次**单独请求有界清理，不猜代次、不重新开流。该清理仍走原Host认证；替换代次/实例拒绝结果保留，不能撤销新会话。迟到连接本身返回bridge-disposed及cleanup结果，未确认时不宣称释放。

仅改 `dsh-whale-mist/src/detachable-contract.js`，没有改Host、原生适配器、权限或生产assets。

| 项目 | SHA-256 |
| --- | --- |
| 本轮前（已含R1 guest） | `EDC0C1EFC46644922FA88A22FFD56BD861D1F3B3FBDE7D5E5DFFE83EEF896650` |
| 本轮后 | `B2688A771A3A525A8E5BA1E1772A3DDD1E0E5AA5B2B6FD8A1703B794A6A96BB6` |

## 交付过程与独立负例

Grok初任务 `companion-dispose-order-d0306376` 在181,336ms总限收束，REPORT已落盘但无正常完成，不记为完整交付。另一次60秒纯文字建议任务 `dispose-late-connect-review-44c2b8ea` 同样超时（60,988ms），没有继续重试；两轮受控进程均确认退出。没有打开前台Grok、改模型、读凭据或放开真实仓库写权限。保留的首份报告仅是待核实提案，不因文件存在就自动通过。

Codex先在冻结源码构造20项红例：17失败/3通过，约9.2秒正常退出。初版候选20项通过后，新增真正Host迟到注册负例发现**孤立mainSession残留**：22项中21过/1失败，故未直接提升。Codex在独立副本补按返回代次清理、共享有界请求、退订重入保护与非法代次拒绝，再独立通过24项。最终源码提升前对照206项保护输入无并发漂移；只有已审contract变化，新增两份QA，其余既有输入不变。

初轮诊断测试曾在fetch替身内断言，被旧产品catch吞掉，因此将关键会话断言移到dispose返回之后，再冻结20项红例。初日志保留，最终red-final.log才是更正后的红基线；没有削弱产品判据来迁就测试。

## 验证范围与截止

证据：`.tmp/companion-dispose-review-20261019-7a800b30`。

| 检查 | 结果与边界 |
| --- | --- |
| 24项专项 | 15项HTTP/JSON/超时/生命周期IO替身；9项真实loopback Host，其中2项以窗口IO替身覆盖资源关闭等待与失败。无Edge/DSH、无原生关窗 |
| 实际源码便携入口 | `node qa/detachable-dispose-check.mjs`，24/24通过，6,855ms正常退出。新QA相对导入实际源码，不依赖本机绝对路径 |
| 外层挂起负例 | 同一QA监督入口运行自有while(true)子任务；25秒截止触发，26,343ms以非零返回且确认退出，未留下需用户终止的任务 |
| P0/P1A/目录初始化 | 31/31，独立副本实际源码、offline-guard禁止遗漏替身后执行真实进程查询 |
| 语法/CSS | contract语法、CSS模板守卫通过；相关子进程正常退出 |

`red-final.log`、`late-connect-proposal-red.log`、`final-24.log`和对应supervision.json分别保存红例/追加红例/最终结果；`reviewed-source.patch`、`promotion.json`绑定最终字节。实际源码QA的完整控制台在本任务工具证据，actual-source-qa-summary.json记录该次结果。QA入口25秒硬限/31秒未知兜底，各测试6秒，产品单次disconnect 3秒；异常终止只针对本轮自有测试树，不全局结束Node/Edge。两个无限Promise是无IO纯替身，未用于宣称真实网络已释放。

真正无效token仍401，旧generation/instance仍拒绝；调用前已断流的dispose仍可返回明确401失败，**没有把所有401改写成幂等成功**。这与本轮修复的“自己先断SSE造成认证失败”不同。资源关闭成功与认证回执分别验证，不将code0当全阶段通过。

## 接续

收尾认证顺序离线余项已闭合，R1本机隔离访客观察与R2实际CIM证据保持；日常DSH内整合体验仍待[rc.38受控短验](RC38_COMPANION_REPAIRS_CANDIDATE_REVIEW_20261019.md)。不复用旧方便/退出回复，安装前新备份，测后默认恢复rc.35。manifest/assets仍rc.30、旧归档不变；本轮不提交推送或清理，定时PAUSED，A/三体/GPU暂缓，首次壁纸断流根因仍未知。
