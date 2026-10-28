# rc.53 日常试用切换

2026-10-28。用户已决定“切换成日常使用版本，我先用一会再发布”。**日常切换已完成：固定rc.53安装43文件核验一致，正常重开并检查目录、停止状态，用户确认“额，好，重开正常”，保留rc.53日常试用。** 公开Release／npm继续暂停，后续由用户决定发布时间。以下准备阶段“尚未安装／备份未创建”为当时记录，以末节为最终状态。

## 固定来源与范围

- rc.53：`.tmp/rc53-gallery-author-candidate-20261028-a/dsh-whale-mist-0.6.0-rc.53.tgz`，SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`，43文件。
- 当前rc.52及回退来源：`.tmp/rc52-author-read-readiness-candidate-20261027-a/dsh-whale-mist-0.6.0-rc.52.tgz`，SHA256 `93553C4C6E4DD8DCB4C433D9066DBF0814C21341BF7D519B9DE24A0EB14362C4`。
- [短验](RC53_GALLERY_AUTHOR_SHORT_TEST_20261028.md)已完成卡片留图库、显式切换及非Lucy Float首次四参数显示、Clock关闭／恢复，用户确认效果及rc.52恢复正常；这不代表全部壁纸／参数或长期稳定通过。
- 本轮只切日常，确认重开外观、布局与目录；不重复播放／参数短验，不改官方宿主／Git Bash，不整体重建共享rc.30／Trace开发树，不提交推送、清理或公开发布。

## 新一轮准备

工具：`.tmp/rc53-daily-trial-20261028-a/`。新备份目标 `C:\Users\HP\.dsh\backups\rc53-daily-trial-20261028-a` 尚不存在。由上轮32个明确工具模板生成，保留来源／适配后指纹；只换本轮目录、备份路径及`retain-rc53-daily`目的标签，安装前置证明使用本轮正常preflight／verifyBefore标签。两个包、候选版本及回退版本保持，不复制旧authorization、备份、PID／HWND、端点或通过结果。

纯离线检查通过：23个PowerShell脚本解析、Python／Node语法、10项合成授权对象校验、7个实际入口缺授权拒绝；32来源模板及283保护输入指纹不变。日常rc.52完整43文件与官方rc.3 ASAR只读核对一致。没有查询进程／窗口／Host，没有生成真实授权或生产备份。证据：本轮`daily-preparation.json`、`source-adaptation.json`、`archives.json`、`readonly-daily-check.json`、`offlinePreparation-result.json`，父监督确认5039ms成功退出、未超时。

## 本次退出后的流程

1. 等用户当前方便、无任务、其它助手暂停、壁纸停止并正常退出；原WE保持。记录这次直接确认，再核实关闭状态及原WE身份，不能沿用刚完成的短验退出状态。
2. 新备份当时Profile／关闭状态Local Storage、两个包及活动rc.52、布局／Preferences／Local State和IndexedDB／blob存储。实际数量与指纹现取，不套用上轮数量。
3. 安装固定rc.53，核对43文件、原设置与布局、官方宿主和原WE身份保持。若安装失败，先保留证据，按当前状态恢复，不继续试播。
4. 正常重开，确认原外观／布局及侧栏目录，播放先保持停止。若原自动播放触发则正常停止，不改该设置；遇启动错误停在错误处取证，不反复重开。
5. 用户确认及限定只读状态核对通过后保留rc.53日常试用。后续回退需先保留届时新增数据、确认当时方便，不能直接覆盖这次备份之后的新数据。

安装准备不等于安装完成或重开验收。此前短验工具已closed-out，不执行旧轮安装或旧轮恢复；本轮新工具目前没有实机authorization、closed-backup或closed-out。

## 日常交接完成

用户直接确认“已正常退出，可以安装并保留 rc.53 日常试用”后，本轮才记录新授权并核实DSH／采集／独立窗关闭和唯一原WE身份。新备份实际保留Profile5文件、Local Storage10文件、媒体9文件、原布局三目标、活动rc.52及两个固定原包，位于`C:\Users\HP\.dsh\backups\rc53-daily-trial-20261028-a`。

安装固定rc.53后，43文件完整集合／哈希一致，关闭状态原存储及布局核对通过，官方EXE／ASAR／WE及原WE身份保持。Profile仅package.json／pnpm-lock.yaml因版本切换变化；283个开发源码／QA／资产／旧归档保护输入保持。没有重建或覆盖固定包。安装器仍有既有peer dependency提示，实际宿主／侧栏操作正常，本轮未擅改宿主依赖。

助手通过正常启动方式重开DSH，未遇启动错误。原自动播放设置触发Lucy后正常点停止，没有更改偏好或重复播放／参数短验。侧栏与全年龄图库显示正常，带文字播放按钮和“壁纸参数”入口可见；随后收起核对面板。只读最终Host inactive／session空／capture0／cleanup.closed:true，目录ready、26项登记（全年龄图库23项），原WE保持。端点发现的初始capture1是停止期间快照，未当最终清理结果；后续`stopped-status.json`确认capture0。

用户最后反馈“额，好，重开正常”。`daily-handoff-summary.json`及`closed-out.json`已记录，保留rc.53，不自动恢复rc.52。安装／备份／布局及后台证据在本轮独立工具目录，各step成功退出且未超时。没有写回旧短验的授权或证明，没有公开发布、提交推送或清理。

当前日常：DSH0.2.1-rc.3／Whale0.6.0-rc.53／GitBash0.1.2。后续先日常观察，发现问题按用户反馈修复，用户决定发布时再做发行检查。未来若需回退，先保护届时新增数据并确认当时方便，不能直接把这次备份覆盖到使用一段时间后的环境，也不能重跑已closed-out的旧轮。
