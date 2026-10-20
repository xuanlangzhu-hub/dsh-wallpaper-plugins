# 伴随窗R1：隔离访客短验与源码补修复审

最新接续：[主端收尾确认补修已通过](COMPANION_DISPOSE_ORDER_REPAIR_REVIEW_20261019.md)，24项专项/31项回归通过；[rc.38候选已独立核包](RC38_COMPANION_REPAIRS_CANDIDATE_REVIEW_20261019.md)，日常rc.35保持、未安装。下文“待补”是当轮发现历史，以本条及新报告为当前结论。

2026-10-19，Codex。用户确认：“没有提示，改成80并吸附后窗口已关闭”。**本机本轮新访客App窗口的账号提示观察、亮度80桥接、吸附关闭及自有资源清理通过；已将同一启动参数合入开发源码，31项相关回归通过。此次没有连接日常DSH，不代表新的DSH候选整合验收。** 日常仍DSH0.2.1-rc.2 / 外观rc.35 / Git Bash0.1.1，旧rc.37不含本轮R1/R2补修。

## 可见实验与范围

承接[准备记录](COMPANION_R1_GUEST_EXPERIMENT_PREPARATION_20261019.md)及[R2源码补修](COMPANION_R2_CIM_SOURCE_REPAIR_REVIEW_20261019.md)。用户本轮重新确认方便、DSH无任务后，只启动一个全新临时配置的隔离Edge窗口。运行文件来自含R2补修的冻结生产Host/桥接/静态页；controller为测试内存，壁纸播放拒绝，不读取用户壁纸目录或访问外部页面。标题/页头明确标注隔离短验。

生产启动参数末尾只附加一次 `--guest`，保留原App地址、独立配置、shell:false和其余参数。没有更改日常浏览器、操作系统策略、账号或同步设置，也没有自动点击账号提示。用户的“没有提示”是本次可见观察，不能扩称所有Edge版本/设备都无提示，或据此证明底层账号/网络行为。

证据根：`.tmp/companion-r2-source-review-20261019-b60d9f3f`。

| 证据 | 实际结果 |
| --- | --- |
| guest-live-authorization.json | 保存本轮方便确认 |
| guest-live-supervision.json | 正常退出code0、27,515ms、无超时、确认退出 |
| guest-live-result.json | companionConnected、brightnessReached80、docked均true；自有进程0、配置0 |
| guest-live-postcheck.json | 用户反馈已补齐；临时配置不存在、对应进程0；6个原运行身份保持，变化为空 |

真实关闭使用已审R2原生适配器，因而比合成Node/CIM夹具多覆盖了本机受控Edge的生产关闭与配置回收。主端仍是内存测试载体，**没有执行日常DSH内的真实吸附或Lucy播放**。原始live-result在写盘时尚待用户反馈，其pending字段不回写；以postcheck追加的实际用户回复为准。

## 源码修改与独立复审

Grok任务 `r1-verified-guest-flag-c21fa1da` 约28.260秒正常完成，交付一处精确替换，只编辑隔离REPORT。Codex在独立副本复核后提升到 `dsh-whale-mist/src/detachable-contract.js`：在原有参数数组末尾追加 `--guest`。保留原换行格式，无额外标志、配置策略或认证改动。

| 项目 | SHA-256 |
| --- | --- |
| 提升前 | `5F1BD327FEDA0B835FACFD40C14C07E809E615422E8E64187CB0B9709DBCB2D7` |
| 提升后 | `EDC0C1EFC46644922FA88A22FFD56BD861D1F3B3FBDE7D5E5DFFE83EEF896650` |

`r1-production-patch/launch-comparison.json` 比较冻结的实验前工厂与新工厂：普通路径、空格/中文/单引号、混合特殊字符共3组，新args严格等于旧args末尾追加guest，其余字段逐项相同，guest与user-data-dir均唯一，shell:false、参数冻结保持。此项是实际launch spec结构比对，没有再开窗口。

`r1-production-patch/regression-results.json`：语法检查通过，P0/P1A/目录初始化31项通过；外层15秒期限未触发，子进程均正常退出。提升后文件与已测副本字节相同。`promotion.json`记录206项保护输入中只有contract这一项变化，R2适配器及既有QA、manifest、生产assets、固定归档不变。

## 单独保留：主端收尾认证顺序余项

真实实验的主端 `dispose()` 返回 `{ok:false,error:"unauthorized-main-token"}`，随后Host stop成功、受控Edge与临时配置清理确认。**退出码0不等于所有子阶段都成功，本报告不将该错误吞作通过。**

`dispose-order-probe.mjs` 是另一次纯loopback、有界且无浏览器的生产Host诊断：将disconnect POST调度到服务器收到主端SSE关闭之后。`dispose-order-result.json`记录调用dispose时主会话存在，发送POST前会话已消失，POST返回401；最终主会话确实不存在、Host stop成功。该证据定位到当前客户端先中断SSE、服务端随即撤销主会话、再发送disconnect认证可能失败的顺序竞争；控制调度验证的是可发生路径，并不证明所有调度都失败。

该认证确认余项**尚未补修**，不属于账号提示再现，也不能只归为替身缺陷。下轮先离线补有界、幂等的主端收尾顺序与竞态回归：覆盖SSE先关、disconnect先到、并发/重复dispose、会话代次变化、真实无效token仍拒绝；不能把任意401改成成功、放宽认证或破坏资源归属。资源释放结果与协议确认分别验收，不能仅加process.exit掩盖挂起。

## 当前接续

本轮隔离访客观察及R1/R2已审源码修复结果保留；先补上述收尾确认余项，再单独整合/审计新候选，之后才安排DSH内整合短验。此次不产包、不安装、不改日常Profile、版本或生产assets，不提交推送/清理；rc.35/36/37原包和证据保留。定时仍PAUSED，Grok本轮任务已结束，无闲置自动唤醒。A/三体/GPU暂缓。
