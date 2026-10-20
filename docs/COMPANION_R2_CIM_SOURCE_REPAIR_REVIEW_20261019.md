# 伴随窗R2：CIM路径与身份检查补修，源码离线通过

2026-10-19，Codex独立复审Grok交付。承接[rc.37实机两项发现](RC37_COMPANION_LIVE_FINDINGS_REPAIR_TASK_20261019.md)。**R2的默认查询、编码与单引号解析缺口已补修并合入开发源码；39项检查、31项主回归及5组历史探针通过。此结论不是DSH实机吸附通过；日常仍rc.35，旧rc.37不含本修复。R1随后完成[隔离访客可见对照](COMPANION_R1_GUEST_SOURCE_REPAIR_REVIEW_20261019.md)，结果与主端收尾确认余项分开记录。**

## 补修与来源

本轮Grok任务 `rc37-cim-parser-complete-eae36ffd` 在约54.6秒正常交付4处精确替换，3分钟总限未触发。Grok只读隔离输入并编辑REPORT，不执行终端或写真实仓库。Codex先在独立副本验证，再将已审修改提升；没有重新接受前两版失败提案。

- WQL LIKE字面量分别处理反斜杠、单引号、左方括号、百分号和下划线；右方括号按WQL实际语义保留。完整filter编码为UTF-8 base64，由本次PowerShell进程解码，避免第二层引号/美元符/反引号插值。
- 资源组查询与单PID身份查询均显式使用本次PowerShell进程的UTF-8输出，避免中文命令行被Node按错误编码解读；未修改任何系统或用户编码配置。
- 未加双引号参数中的字面单引号不再截断；保留原支持的双引号、单引号包装及空格参数形式。
- 单PID查询改用ErrorAction Stop。只有成功查询确实为空时产生的专用exit2判为不存在；code1、超时、错误文本中的not found/absent和空stdout均保持未知/错误。真正成功的进程记录继续走原PID/完整路径/精确配置目录/严格CreationDate分类。

源码 `dsh-whale-mist/src/detachable-edge-adapter.js`：

| 项目 | SHA-256 |
| --- | --- |
| 本轮补修前 | `651E0AD5F2A1D74A6D7B4E3AE2AB3FF69593E1C4F66E1EC25223CC56C060BC2D` |
| 已审并入后 | `BA8B4C708E06FF5877FD323E0D3266BFC473E4C75042FAB355C185AB01C8E5E7` |

证据 `.tmp/companion-r2-source-review-20261019-b60d9f3f`：原始输入、proposal.json、adapter-after.js、独立review-plugin、native-results.json、各回归日志、qa-rebindings.json和promotion.json。并入前保留全部原文件于promoted-before；实际生产适配器与测试过的副本字节相同。

## 验证范围与测试修正

39项检查中，22项实际调用本机Windows CIM：10种合成路径的精确PID查询与单PID身份匹配、1毫秒创建时间变化拒绝、夹具退出后的明确不存在。其余17项为参数形态解析与错误/损坏输出替身断言。10个自有Node子进程仅作为真实命令行/创建时间夹具，均确认退出；没有启动Edge、DSH或WE。普通、空格、中文、单引号、美元符、反引号、方括号、百分号、下划线及混合路径均通过，不再只以命令成功/返回空数组作验收。

新增便携QA `dsh-whale-mist/qa/detachable-cim-native.mjs`，Windows可手动运行：

```powershell
node qa/detachable-cim-native.mjs --output <本轮独立输出JSON路径>
```

它自带75秒外层截止/80秒兜底，每次CIM查询3秒、自有夹具45秒寿命及有界退出等待；不全局结束Node或浏览器。非Windows明确跳过，不把跳过写成原生通过。输出参数须指定本轮新文件路径，保护旧证据。

P0/P1A/目录初始化31项回归通过；五、六、七、八、九审5组历史查询/身份/close/dispose探针通过，覆盖查询失败保留、父已退出、孩子仍活、受控孩子终止、回收身份拒绝、严格创建时间等。原生动作在这些历史路由探针中使用IO替身，真实CIM解析由上面的22项单独补齐。实际源码提升后31项及CSS守卫再次通过，适配器语法检查通过。

旧IO夹具依赖未编码命令文本和“空输出即不存在”，本轮同步更新：识别base64中的逻辑filter，匹配身份用完整合成记录，已不存在用exit2；W4夹具明确隔离资源组生命周期，避免意外执行真实系统查询。**六个旧QA文件的assert行逐项保持，没有删负例或改通过标准**。初轮31项中1项及五审旧夹具先失败，首错日志保留；只纠正夹具协议后通过，不修改产品迁就错误测试。

## 保护与下一阶段

入场205项源码/QA/manifest/assets/归档保护输入，只有已审适配器和6个旧QA文件变化，另新增1个便携QA；其余输入不变。manifest/assets仍rc.30，rc.35/36/37固定归档保持。没有打包、安装、发布、日常应用操作、系统/Edge设置变更、提交推送或清理。

用户已确认本轮恢复后的rc.35正常重开，外观布局正常、播放停止。R2真实Edge关闭与DSH吸附体验不能由Node夹具代替；下一步先做[R1局部访客会话对照](COMPANION_R1_GUEST_EXPERIMENT_PREPARATION_20261019.md)，不必重新安装DSH插件，但任何可见窗口须重新确认当时方便。账号隔离和R2原生关闭应分别记录结果，再决定是否整合新候选；不为每个字符补修机械产包。定时PAUSED，A/三体/GPU暂缓。

## 后续隔离Edge关闭补充（同日）

R1本轮真实访客窗口使用该已审R2适配器，用户完成亮度80及吸附，生产关闭路径确认自有进程/临时配置为0，原运行身份保持。此为本机隔离Edge生产关闭证据，主端controller为测试内存，不扩称日常DSH吸附或Lucy播放通过。另有主端dispose认证顺序竞争待补，见[R1实际复审](COMPANION_R1_GUEST_SOURCE_REPAIR_REVIEW_20261019.md)。本报告上文“下一步”是实验前历史，当前接续以上述实际复审为准。
