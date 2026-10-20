# rc.40视频路径兼容候选：最小整合与核包（2026-10-20）

**rc.40候选已生成并核验，未安装。** 实际tgz解包后的225项主检查及24项独立窗释放检查通过，17个JS语法、CSS及18条静态相对导入闭包通过。当前日常仍为DSH0.2.1-rc.2 / 外观rc.38 / Git Bash0.1.1。DSH中的视频画面、音频、循环和长期行为尚待短验，不能把本报告当成实机通过。

## 不可变归档与来源

| 项目 | 结果 |
| --- | --- |
| 新归档 | `release/plugins/dsh-whale-mist-0.6.0-rc.40.tgz` |
| SHA256 | `E83255202DCE92EB1FC1C37345827544729AA769BCB669CB61169024ABA4F1FB` |
| 大小/文件数 | 7,169,289字节 / 37个regular文件 |
| 直接基底 | 固定rc.39，SHA256 `FBF1B015A93403F6B3E1F442AE105DBCCF0163C0EEC1045713D85C06DB2D6121`；只取已审文件，不重试安装旧包 |
| 更早来源 | 固定rc.38与已审MP4原生/JS局部差异，详见[rc.39构建审计](RC39_VIDEO_MP4_CANDIDATE_REVIEW_20261020.md) |
| 相对rc.39 | 8项既有文件变化、2项新增、27项保持、0删除 |
| 原生运行时 | 12文件全部逐字节等于固定rc.39，无复编、无Trace；其它生产资产也未从开发工作区复制 |
| 工作区 | manifest/package仍rc.30；生产assets和32个原归档保持，仅提升下文一处守卫补修及两项新增QA断言 |

证据根：`F:\dsh-wallpaper-plugins\.tmp\rc40-video-bridge-candidate-20261020-44b8e534`。`archive-audit.json`含37项逐文件SHA256、18条导入闭包及相对两个基底的变化表。`archive-publish.json`记录排他写入release归档及哈希；旧rc.39、rc.38未覆盖或修改。

包内变化严格限于：README、package版本、`src/client.js`、独立窗JS/HTML/CSS、`src/wallpaper/library.js`、`src/wallpaper/session.js`；另新增`media-bridge.js`及`media-bridge-permissions.js`。manifest解析后只有版本变化，兼容声明、权限、exports/main/files保持。没有QA、用户视频、预览图、Profile、存储、PDB、凭据或开发诊断产物。

## 最小移植与本轮发现

UI只移植[已审R1/R2](RC39_PLAYBACK_UI_GROK_REPAIR_REVIEW_20261020.md)的前后差异：活动身份不误报null，吸附/独立页补原有日常/预览及下次启动自动播放控件。桥接以[源码离线复核](RC39_VIDEO_ASCII_BRIDGE_OFFLINE_REVIEW_20261020.md)的前后指纹为输入。没有整份复制含Trace的开发client/session。

初次26组上下文精确移植成功，6组因固定基底无Trace及旧收尾形状不同而拒绝。没有带冲突继续打包。`transplant-conflicts.json`保留原失败；`adapt.py`和`context-adaptations.json`逐一记载适配：

- import、worker错误保护、真正开源前lease.verify、路由工厂签名，只去掉基底原本不存在的Trace上下文，不引入Trace参数、collector或异步导出。
- 固定基底原先直接写`cleanupResult.closed`，而副本释放现在是异步操作。移植已审源码的局部`nextCleanupResult`提交段，完成media lease释放后才发布最终结果；源关闭但副本释放尚未确认时继续保留session所有权。窗口/worker原验证链保持。
- 新增“自动结束时，副本删除尚未落定不得释放session/允许新start”的实际生命周期负例；仅以底层unlink gate替身控制时序，实际routes/session/bridge均执行。

另发现上一轮源码把`mediaLease = preparedMedia`重复放在existing-run守卫之前和之后。正常首次create不受影响，但重复调用create先替换了活动lease，再抛“already started”，可能造成错误释放/保留原副本。先在冻结副本建立红例（39项中38通过、1失败，错误foreign release实际发生），删除守卫前的重复赋值后39/39通过；补上上述自动结束时序检查后共享QA为40/40。修复和QA经前指纹核对后提升至开发源码；没有降低守卫、清理或身份标准。证据见`source-fix/`、`source-fix-promotion.json`及`shared-qa-promotion.json`。

## 实际归档验证

| 检查 | 结果与边界 |
| --- | --- |
| 实际解包的Host/库/会话/清理/MP4/UI/P0/P1A/目录初始化 | **225/225**，`actual-package/archive-main.result.json`，13.441秒、exit0已确认；含40项桥接及29项播放UI，进程/ACL/DOM为明确底层替身 |
| 实际解包的主端/独立窗销毁 | **24/24**，`actual-package/archive-dispose.result.json`，6.921秒、exit0已确认；实际loopback HTTP/SSE，不是Edge/DSH窗口 |
| 共享开发源码新增守卫/收尾QA | **40/40**，`source-fix/shared-qa-final.result.json`，11.473秒；不把重复执行累加进归档249项 |
| 语法/CSS/导入闭包 | **17个产品JS**、CSS模板守卫、**18条相对导入**通过，`static-checks.json`和`archive-audit.json` |
| 归档结构/解包 | regular-only，拒绝链接、重名/大小写冲突、绝对/穿越/ADS；实际解出37项逐字节匹配审计成员 |
| 原生/Trace | 12个原生文件逐字节等于rc.39；所有包内文件检查Trace特征字节及UTF16形式均无命中。未运行WGC/开源窗口或重复GPU/原生长测 |
| Grok小范围复核 | 28.978秒正常完成、worker退出0；复核给定收尾代码的最终结果发布时序，无新增问题。仅作意见，不能替代上述实际链路检查 |

测试导入`actual-package/dsh-whale-mist`中由tgz真实解出的产品文件；QA另外复制，未写入tgz。逐文件再次匹配归档SHA256，防止把测试旁支误认成包内代码。运行器单文件25秒、父监督30秒、35秒最终落定；测试与Grok由父监督记录自有PID/exit确认；一次性Python构建使用15秒spawnSync截止并保留实际退出码，静态检查各有独立短截止。无遗留等待任务。没有全局结束进程。

本轮没有新的bad port失败；前轮历史失败仍在原证据中，本报告不宣称系统端口问题已修复。Windows只读ACL/.NET查询已在前轮用相同字节的permissions模块验证，本轮未再创建生产缓存或操作现有应用。文件元数据/副本IO的测试不等同WE实际解码或显示。

## 范围与下一次短验

继承的限制保持：本地MP4手动实验，scene原路；Lucy-only自动播放，默认Everyone，隐藏年龄不预览，web/application/其它容器不支持。Host固定ASCII用户缓存目录；512MiB单媒体、1GiB总预留、2租约、发布两倍空间预留、有界复制及同轮退出证明。失败/未知IO保留，不能盲删或偷锁，详见[桥接复核](RC39_VIDEO_ASCII_BRIDGE_OFFLINE_REVIEW_20261020.md)。

下一步只安排一次合并短验，**本轮还没有当前方便/正常退出确认**：

1. 按[AGENTS](../AGENTS.md)确认现在方便、暂停其它助手、DSH无任务；停止播放并通过菜单正常退出，先不重开，原WE保持。
2. 退出后新备份当时实际Profile/关闭存储/布局、活动rc.38安装和归档、原WE身份；不能复用此前旧备份覆盖新增数据。
3. 官方CLI临时安装固定rc.40，逐一核对**37项**；正常重开确认原外观/目录和新面板模式控件，先保持停止。
4. 仅Everyone中此前本人批准的同一MP4，日常模式、自动播放关闭，手动约20秒后停止。实际核对缓存副本/源/采集/worker属于同轮，观察画面是否连续；失败即停并保留，不反复重试或翻看隐藏分级。
5. 停止清理闭合后，做一次Lucy短切换回归；默认正常退出后保存测后证据，再恢复本轮rc.38及原设置并核验。用户正常重开确认。是否保留新候选日常另定，音频/长期循环不在此轮范围。

本轮没有安装、关闭、重开、采样DSH/WE或读取其运行任务，没有模型请求、推送、清理旧工作区、改codepage/codec/GPU或恢复定时。候选归档和文档已就绪，真实操作等待当时确认。
