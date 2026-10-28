# rc.53 图库选择与非 Lucy 参数短验

2026-10-28。用户确认当前方便、DSH已正常退出后，临时安装rc.53；本轮操作与参数效果通过，用户反馈“切换和时钟效果正常”。**已按约定恢复日常rc.52并正常重开，用户最终确认“原外观和布局正常，播放停止”，本轮闭合。** 没有保留rc.53日常或公开发布。

## 现场与备份

候选43文件与[核包报告](RC53_GALLERY_AUTHOR_CANDIDATE_20261028.md)固定归档一致，SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。底座DSH0.2.1-rc.3／GitBash0.1.2保持。新备份在 `C:\Users\HP\.dsh\backups\rc53-gallery-author-short-trial-20261028-a`，包括5个顶层Profile文件、10个关闭状态Local Storage文件、日常安装与两个归档、布局／Preferences／Local State、IndexedDB／blob媒体存储。备份后均核对指纹，没有沿用旧备份覆盖当前数据。

工具／证据根目录：`.tmp/rc53-gallery-author-short-trial-20261028-a/`，恢复机器核验 `restored-awaiting-user-confirmation.json`，用户最终确认与闭合记录 `closed-out.json`。备份／安装／实测／恢复各步有父监督、阶段期限和退出确认。电脑操作按computer-use技能，按钮由助手代点，没有请求DSH模型或操作其它助手。初次打开及恢复重开均因原有自动播放设置启动Lucy，随后正常停止，没有修改该设置。

## 实际验证

| 动作 | 结果与证据 |
| --- | --- |
| 停止时点选多张图库卡片 | 仍留图库，选中标记更新，不跳参数页；“壁纸参数”进入详情，“更换”回图库；仅全年龄勾选 |
| 显式播放Lucy | 带文字“▶ 播放”可用，图库保留并显示播放标记；初始快照尚在captureStarted:false启动期，不当作就绪证据 |
| Lucy播放中选绯雪 | 所选对象改变，但实际仍为Lucy、原location／采集PID保持；播放和单独停止按钮并存；`selected-b-active-a-status.json`此时captureStarted:true |
| 显式播放绯雪 | 成功切换到`we-3b752f12097114fe05a18acf`，新源／采集身份就绪；`playing-status.json` |
| 旧Lucy清理 | 旧source location与采集PID均不存在，新源唯一；`old-source-absence.json` |
| 绯雪参数 | 首次自动读取后显示“暂无可直接应用的参数”，没有手动重试或读取报错；不把空参数状态当通用参数验收 |
| Float参数验收 | 在同一轮改选全年龄Float，显式切换后打开参数，首次自动显示24/12 Hour、Bloom、Film Grain、Clock四开关，没有点刷新；`float-author-first-ui.txt` |
| Float Clock关闭／恢复 | 两次即时下发均显示确认；助手观察顶部时钟消失后恢复，用户也确认正常；`float-clock-off-ui.txt`、`float-clock-on-ui.txt` |
| 停止与清理 | 最终Float播放身份`we-cd2f34f937ae717ba3dfa5de`；停止后Host inactive、session空、capture0、源窗0、cleanup.closed:true、原WE保持；`live-cleanup-verified.json` |

本轮非Lucy真实参数下发验收目标为Float的Clock。其它字段／scene／web、全部壁纸、WE真实当前值回读没有因此验收。作者默认值／插件记录的来源说明保留，自动播放资格仍只有Lucy。没有启动三体专项。

## 证据适配与有限失败

绯雪无可直接应用字段，因此加选Float完成同一授权范围内的非Lucy参数验证，保留Lucy／绯雪全部既有证据。最终播放保存为独立 `final-playing-status.json`，清理与恢复前置证明明确改绑 `snapshotFinal`／最终Float身份；原绯雪 `playing-status.json`不覆盖、不冒充最终清理证明。修改前四脚本备份、精确指纹和理由在 `final-target-evidence-adaptation.json`，新脚本解析通过，原纯恢复校验函数保持。

一次额外只读旧采集查询用了空管道序列化，空输出使JSON解析失败，未将其当可信空集。修正为显式数组输入序列化后重新查询，得到合法空数组；helper窗口查询也独立成功，才写旧源退出证明。没有根据失败输出清理或停止进程。

初次及恢复的端点发现记录均捕获了停止过程中的旧capture1快照；这不是最终清理结论。后续完整停止查询分别证明capture0／session空／closed:true；各过渡快照保留。启动期／异步刷新时短暂旧树或旧画面不能当最终状态，电脑操作均重新观察后行动。

## 恢复结果

停止后通过DSH应用菜单正常退出；恢复前核对全局相关进程／源窗负证据、原WE身份及最终Float播放／清理的同轮证明，`restore-preflight.json`为played模式，明确不证明“从未启动”。先保留测后数据，再恢复日常rc.52与本轮原设置。

- rc.52安装43文件与固定原包一致；5个Profile、10个外观存储文件恢复并校验，关闭状态Profile变化集为空。
- 布局／Preferences／Local State核对一致，IndexedDB／blob恢复，测后媒体与存储保留而非删除。
- 官方EXE／ASAR、原WE身份不变；283个源码／QA／资产／旧归档保护输入保持，未改共享manifest／assets或提交推送。
- 正常重开rc.52后停止原自动播放，后台最终inactive／session空／capture0／closed:true，核对侧栏已收起，界面输入处于空闲；`restored-stopped-status.json`。没有遇到启动错误。

用户已最终确认原外观／布局正常、播放停止，本轮闭合。若考虑日常切换到rc.53，需要用户另行决定并重新正常退出、新备份，不能复用本轮授权和旧备份直接安装。公开Release／npm继续暂停。
