# rc.52 日常切换

2026-10-27，Codex。**日常切换已闭合：用户确认正常重开、原外观／布局及侧栏目录正常、播放停止；只读Host和安装文件核验通过，保留rc.52日常试用。** 当前日常为DSH0.2.1-rc.3／Whale0.6.0-rc.52／GitBash0.1.2，不重复Lucy播放或作者参数短验。

## 原包与范围

- rc.52：`.tmp/rc52-author-read-readiness-candidate-20261027-a/dsh-whale-mist-0.6.0-rc.52.tgz`，SHA256 `93553C4C6E4DD8DCB4C433D9066DBF0814C21341BF7D519B9DE24A0EB14362C4`，43文件。
- 当前rc.48回退原包：`release/plugins/dsh-whale-mist-0.6.0-rc.48.tgz`，SHA256 `93290398BEAFBDCB5B01CB4273D4759A92D4325934CD2FBFA2D1FC26B88CAEAE`，43文件。
- rc.52首次自动显示6项作者参数已在[临装短验](RC52_AUTHOR_READ_READINESS_SHORT_TEST_20261027.md)观察；这不等于全部参数、全部壁纸或长期稳定通过。
- 上轮恢复rc.48后曾出现宿主startup／authenticateWebHost／fetch底层bad port，用户Restart后恢复，见[启动事件](RC52_POST_RESTORE_STARTUP_FETCH_FAILED_20261027.md)。现有证据没有把错误指向rc.52；本次不顺带修改宿主、端口或网络设置，若重现则保留新证据，不自动多次重试。

## 本轮准备

独立轮次：`.tmp/rc52-daily-trial-20261027-a/`。新备份预定：`C:\Users\HP\.dsh\backups\rc52-daily-trial-20261027-a`，当前不存在。

从已完成短验工具复制30个明确脚本，按新轮路径／purpose适配；没有复制旧authorization、进程身份、Profile、存储、备份或通过证明。install依赖本轮正常preflight／verifyBefore标签，其它备份、授权、关闭、原WE身份及回退门禁保持。语法核对、10项纯合成授权检查、4个实际变更入口缺授权拒绝通过。两个实际tgz文件集合／哈希已读核对，当前安装rc.48的43文件及官方rc.3 ASAR只读核对一致；439项保护输入保持。

仅检查文件，没有查询日常进程、窗口或Host，没有生成真实授权、生产备份或安装。证据：本轮`daily-preparation.json`、`source-adaptation.json`、`archives.json`、`readonly-daily-check.json`及独立命令结果。共享开发树／版本／生产assets不改，固定候选不重建。

## 确认退出后的步骤

1. 获得本次无任务、其它助手暂停、壁纸停止并正常退出的直接确认；原WE保持。届时生成本轮授权，核实当时关闭状态与原WE身份。
2. 新备份当时Profile、关闭状态Local Storage、媒体存储及布局、活动rc.48与原包；实际集合和哈希按本轮现状记录，不能套用上轮数量或备份。
3. 安装固定rc.52，核对完整43文件、原设置／布局、官方宿主与WE保持。
4. 正常重开，只确认原外观、布局及右侧栏目录，播放保持停止。不为本次切换重复播放或改作者参数；遇启动失败先保留报告再决定，不把用户Restart恢复记成无异常启动。
5. 用户确认和限定后台状态核对完成后保留rc.52，不自动恢复rc.48。未来若需回退，先保护届时新增数据并确认当时方便，不能直接覆盖日常期间产生的数据。

当前日常仍DSH0.2.1-rc.3／Whale0.6.0-rc.48／GitBash0.1.2。无提交推送、清理、定时或跨会话派发；“▶ 播放”及后续UI另排。

准备检查补记：首轮父端按UTF-8解码Windows stderr失败，尚未完成四入口取证；保留offline-check-encoding-failure.json，改为原始字节采集后四个实际缺授权拒绝全部完成，未改子门禁或生成授权。

## 本轮安装完成，待重开确认

用户直接确认“已正常退出，可以安装并保留 rc.52 日常试用”，据此创建新授权并核实当时关闭状态和唯一原WE身份。新备份位于`C:\Users\HP\.dsh\backups\rc52-daily-trial-20261027-a`：Profile5文件、Local Storage10文件、媒体9文件，另有原布局三目标、活动rc.48及两个原包。安装固定rc.52后43文件集合／哈希、关闭状态存储与布局均通过，官方EXE／ASAR／WE及原WE身份保持，Profile变化仅为记录中的['package.json', 'pnpm-lock.yaml']，439保护输入保持。

证据为installation-summary.json及本轮各step独立退出结果。安装前发现备份manifest目的标签仍写临时短验，仅更正为retain-rc52-daily，留前后指纹及旧保护清单；授权／关闭／原WE门禁不变。旧临装record-installed.py未执行，避免其旧重试依赖及临时恢复语义误用于日常，本节和新installation-summary.json为当前记录。未写任何旧轮关闭／通过证明。

下一步请正常重开，确认原外观、布局及右侧栏目录；播放保持停止。遇新startup错误保留日志，不自动多次重启。此次安装成功不替代重开验收；不会默认恢复rc.48。此前“未安装／备份不存在”为准备阶段历史，当前由本节更新。

## 日常交接完成

用户确认“重开正常，外观布局和侧栏目录正常，播放停止”。随后只读发现当次DSH及子进程监听端口，唯一Host于`2026-10-27T11:43:39.0535398Z`返回active=false、session为空、failed=false、无错误，目录ready／26项，采集进程0，原WE启动身份保持。实际安装43文件完整集合／哈希、两原包与官方rc.3 ASAR再核对一致，439保护输入保持。此轮授权之后的日志目录未发现新的crash报告，用户也确认重开正常；不据此扩称宿主bad port事件永久解决。

证据：discover-result.json、live-endpoint-discovery.json、daily-handoff-summary.json。安装后、重开前的关闭状态设置／媒体／布局核验与用户重开观感确认分开记录；不以运行中存储哈希代替视觉验收。没有再次启动播放、改参数或操控窗口。本轮已封口closed-out.json，保留rc.52，不自动恢复rc.48；新备份、原活动rc.48、固定原包和此前失败见证均保留。未来若需回退，先保护届时新增数据并确认当时方便。

后续为日常观察及用户另选UI小项（“▶ 播放”等），不自动开新专项、长测、提交推送、清理或定时。前文未安装／待重开的表述为分阶段历史，由本节最终结论替代。
