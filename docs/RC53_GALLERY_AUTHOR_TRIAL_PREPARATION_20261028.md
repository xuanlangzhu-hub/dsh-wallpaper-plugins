# rc.53 图库与非 Lucy 参数：短验准备

日期：2026-10-28。**备份／恢复工具已准备并完成纯离线门禁检查，等待用户当时方便及正常退出确认。没有安装、没有生产备份或实机授权文件。** 日常仍rc.52，公开发布暂停。

固定候选与范围见[核包报告](RC53_GALLERY_AUTHOR_CANDIDATE_20261028.md)。候选SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`；默认回退固定rc.52原包 `93553C4C6E4DD8DCB4C433D9066DBF0814C21341BF7D519B9DE24A0EB14362C4`。不回退到rc.48，也不重建共享开发树。

## 新一轮工具

工具目录：`.tmp/rc53-gallery-author-short-trial-20261028-a/`。新备份目标为 `C:\Users\HP\.dsh\backups\rc53-gallery-author-short-trial-20261028-a`，**当前尚不存在**。配置中`profileWritesAuthorized:false`，不把打包许可当安装确认。

从上一轮rc.52实际使用后的32个脚本模板生成新副本，保存来源／改后指纹至`source-adaptation.json`；没有复制旧authorization、备份、端点发现、PID／HWND或步骤结果。保留当时核实的安装前证明、恢复前进程／窗口负证据、WE身份时间精度、媒体恢复与运行核对修正。新工具的候选版本／指纹改为rc.53，日常与回退改为rc.52；两个归档从配置生成新的43文件清单。旧工具和证据原样保留。

将来正常退出后，工具才会查询关闭状态和原WE身份，备份当前顶层Profile文件、关闭状态Local Storage、安装包及日常安装副本、布局／Preferences／Local State、IndexedDB／blob存储。恢复前先保留测后文件，核对当前无任务进程／源窗口及原WE身份，再恢复本轮数据；目录移动仍使用校验后的绝对路径和原生PowerShell。

## 纯离线检查及边界

证据：工具目录`offline-preparation-report.json`；父监督结果`.tmp/rc53-gallery-author-candidate-20261028-a/offlineTrial-result.json`。运行13685ms、成功退出、未超时。

| 检查 | 结果 |
| --- | --- |
| PowerShell解析 | 25脚本通过；Python／Node脚本语法同时检查 |
| 授权对象校验 | 10项，只在内存使用合成对象，没有创建真实authorization |
| 恢复身份时间精度／负证据 | 5项；微小时间差、空进程快照、未证明查询均拒绝 |
| 切换后的清理绑定 | 7项；A旧location／capture PID、仍有采集／源窗、未知closed、字符串布尔均拒绝，最终B正确证据可通过 |
| 无授权入口负例 | 17个安装／备份／恢复／采样入口在首个门禁拒绝，没有查询现场或写生产数据 |
| 工具依赖与保护 | 22个runner脚本引用存在，32来源模板及283保护输入指纹不变，两个归档版本／路径／指纹一致 |

工具目录没有authorization、closed-backup、preflight、restore-preflight或旧现场结果，生产备份目录未创建。另行只读核对日常安装43文件及官方ASAR，见`readonly-daily-check.json`、`readonlyDaily-result.json`；这不查询进程、窗口、Profile配置或外观存储。

这些检查没有实际执行备份／恢复，不宣称已验证本轮运行时关闭或真实效果。备份文件数／大小、进程身份与端点均须用户确认后现取。

## 操作顺序与验收

确认方便／无任务并正常退出后，才记录本轮用户确认与UTC时间；随后按runner前置证明执行新备份、归档／安装副本保留、媒体及布局核对、临时安装rc.53和关闭状态核验。重开后由助手代点，用户只确认实际效果。

先验证全年龄图库的点选留页、参数／更换导航，再验证Lucy A播放时选B仍保持A，显式播放才切到B。合适的非Lucy scene／web应按自己的ID显示公开支持字段；只改含义明确、可逆且可观察的参数并恢复。自动播放名单仍只有Lucy；不把声明默认值／插件记录称为WE当前值回读。

为切换链保留不同文件：`snapshotInitial`记录A；`snapshotSelected`记录选B但仍播放A；`snapshotPlaying`的规范`playing-status.json`必须记录最终B，最后停止清理的证明与B对应，不能复用A快照。切换中还需独立核对A源已退出；最终全局进程／窗口恢复门禁不因单个B清理通过而跳过。

停止后保留测后数据、正常退出，再恢复本轮rc.52与原设置；默认不保留rc.53日常。异常即停，不重复点击；若未形成播放证明，采用明确的quiescent恢复分支核对当下静止，不解释成“从未启动”。本轮工具中没有自动发起DSH模型请求、自动重开应用或结束原WE的动作。
