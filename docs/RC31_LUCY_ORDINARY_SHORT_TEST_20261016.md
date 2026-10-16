# rc.31 Lucy常规短验完成：反馈流畅，停止清理与rc.28恢复通过

2026-10-16，Codex。用户确认当前方便/正常退出后，按[候选就绪记录](RC31_ORDINARY_WALLPAPER_READINESS_20261016.md)临时安装既有rc.31；本轮Lucy反馈：**“画面和操作流畅，已停止并完成清理”。** 后端与生命周期核查通过。随后正常退出，恢复日常rc.28及本轮设置，用户确认“重开正常，外观布局正常，播放停止”。

**P4本轮实现/候选/真实等待改善及普通壁纸短验可收尾，小G无需继续改等待代码或加诊断。** 当前日常仍rc.28；rc.31可以作为用户后续选择的日常试用候选，本轮没有自动永久保留。三体变速专项保留未解决、暂不推进，不作为这次常规短验的通过条件。

## 条件与原始证据

- 候选为不可变rc.31归档，SHA256 `F1C5B2A3ADCD2BA9B67CC3D432CDB8637B140ADDEDFD520D19CA0BB1B11965DB`。没有新包或混入rc.32逐帧Trace，既有轻量P2/P3计数保持。
- 本轮证据：`F:\dsh-wallpaper-plugins\.tmp\rc31-ordinary-readiness-20261016-f841a31e`；本轮新备份：`C:\Users\HP\.dsh\backups\rc31-ordinary-readiness-20261016-f841a31e`，不复用之前任一备份。
- 用户确认退出后，初始检查仍见退出中的DSH进程；等待后确认DSH/capture/worker全为0，再备份5个Profile与10个Local Storage文件，未强杀。
- 官方CLI临时安装核验28文件匹配候选、10个关闭存储未变。live-baseline.json记录当轮原WE路径/启动FILETIME及旧run列表，明确不使用旧日志。
- 新run为 `2026-10-16T082324-ef32-lucy`，用户选择“Lucy（已验证样例）”；location `WhaleWallpaperProbe-261016082325-5781`，capture PID5632、源HWND12192534，原WE PID11992且启动身份保持。
- 要求用户日常模式/自动播放关闭/原窗口外观，前台约20–25秒，其中缓慢移动鼠标约10秒，直接停止再回复。**实际原生Summary全生命周期18.4015429秒，短于请求时长且包含收尾；鼠标/前台具体动作边界未独立计时，不冒充足额20–25秒或严格静止/鼠标A/B。** 不因此补跑凑时长，保留实际短验范围。

## 结果与边界

| 核查项 | 本轮结果 |
| --- | --- |
| 用户画面/操作反馈 | 流畅，已停止并完成清理 |
| 实际等待后端 | kernel-highres-worker，highResolution=True |
| 原生全生命周期帧记录 | 492 |
| 491个已计成功周期的均值 | 33.746ms |
| 491次等待实际值减请求值的均值 | 0.430ms |
| 末次客户端报告 received / drawCount | 472 / 395 |
| 末次客户端报告丢旧帧 | 77（解码时46、等待回调时31） |
| 解码/同步/绘制错误 | 均0 |
| 最终Host | running=false、failure=null、源cleanup.closed=true |
| 原生收尾 | parent-stop，源closed=true、safeToCleanUp=true |
| 任务栏worker收尾 | action-done、cleanupSafe=true |

实际后端诊断来自本轮preview-final的diagnostics消息，不借用昨日结果。周期/等待是软件阶段计数，**不是源渲染或屏幕呈现FPS**；Native全周期包含启动/停止，末次客户端报告也不保证覆盖全部收尾帧，不据此把计数差叫作传输丢包。

77个丢旧帧说明前端仍使用latest策略处理排队，不能宣称零丢帧/完全无积压，也不能单凭它否定用户的流畅反馈。本轮没有分出稳定静止与鼠标时间段，不作鼠标因果或净性能提升推断；不声称功耗、长期稳定性、所有scene/video/web兼容已验收。结合此前[三体P4短测](COMPLEX_SCENE_P4_FOREGROUND_RESULT_20261015.md)，确认已完成P4局部等待改善及本轮Lucy基本可用性检查，无须再追三体求解器才能收尾。

## 停止清理、恢复和最终状态

1. 用户停止后，本轮preview-final与summary同location/源PID绑定；Native source outcome=closed（waitedMs1020），Host随后outcome=absent、closed=true，均无failure。额外原生枚举专属源为0、capture/worker为0，原WE身份保持。证据复制至 `stopped-run-evidence/`，未改原日志。
2. 用户菜单正常退出；初始检查仍在退出中，等待后确认DSH/capture/worker为0且源已不存在，不强杀。先把CLI重装前的测试时5Profile保存在新备份内 `profile-before-daily-reinstall/`。
3. 官方CLI恢复rc.28，再恢复本轮5Profile/10存储；设置工具另保留重装后Profile与测试时存储，没有递归删除用户数据。`restored-daily.json`证明28安装文件、5Profile、10存储与关闭备份一致。
4. 用户按日常方式重开，确认外观/窗口布局正常、播放停止。`final-verification.json`证明28安装文件/5Profile一致、capture/worker及自有源为0、原WE路径/启动身份保持；10存储的逐字节恢复证明来自DSH关闭时，不在重开后拿活跃存储硬作相同哈希假设。
5. 34复审输入、54保护、29打包源、19原生源码、旧24归档及rc.32保持；工作区仍rc.30，rc.31原归档保持，日常rc.28。没有改生产/QA、全局计时器/FPS/品质/演算参数或持久启动环境，没有新包、提交推送、自动消息或GPU长测。

当前P4收尾完成，下一步由用户决定是否将既有rc.31作为日常试用；若选择，届时另确认方便/退出并保存当轮设置，再安装核验，不自动重用本轮退出授权。保留rc.28可恢复基线与所有证据，三体源端调查不自动恢复推进。
