# rc.51真实首帧／首次读取接缝复审：离线因果核验通过，报告更正后收尾

2026-10-27，Codex。复审`RC51_TARGET_UNVERIFIED_GEMINI_FINAL_SEAM_DELIVERY_20261027.md`。结论：**指定离线因果链及正常／清理故障核验可接受；不是现场全量定因或已修复。** 不再要求重做旧7项／SDK，最后仅更正文档证据口径。无生产代码修改，日常DSHrc.3／Whalerc.48／GitBash0.1.2不动。

## 独立复核与结论

独立目录`.tmp/rc51-target-unverified-final-review-20261027-a/`，准备时固定归档SHA及43文件一致，281项共享源码／QA／资产保持，冻结交付11文件，JPEG夹具62886字节的来源／哈希单独记录。未启动原生进程或实机窗口。

原脚本与normal／fault父监督均未改字节，复制至本轮独立目录，正常及故障仍各自排他写出完整报告。本轮外监督正常830ms、fault817ms退出0；内部正常7／7、677ms退出0；fault父监督确认其子退出1及Case1真实清理失败。每个本轮子进程退出已确认，无超时。

接缝已从自写ClientPlaybackSeam改为固定完整client的实际createWallpaperEngine和从固定源提取的AuthorSwitches函数体。有效外层WHL1先经真实session FrameHub解析，再以**acceptFrame入口手动交付**给实际renderer；paint调用底层createImageBitmap替身成功后，由产品emitStatus发playing；状态订阅驱动测试hook环境执行原版effect，而非自行写playing或直接调用ensureLoaded冒充首次触发。

实际记录：

- 红例实际renderer=playing、captureStarted=false；首次结果为target.unverified，随后stderr就绪后手读ready，作者POST=0。
- 绿例先就绪，再交付帧，首次读取ready。
- 零帧例100ms观察窗：renderer=connecting、hubReceived=0、schemaCalls=0、authorPhase=idle。它是有界窗口的反事实，不代表所有未来时刻都不会读取。

故障监督器额外用**实际未改父监督源码**在VM中替换child／文件／计时IO做3项独立对照（163ms）：真实清理失败接受并父退出0；逻辑失败且清理成功拒绝并父退出1；缺报告拒绝并父退出1。scope及结果见fault-validator-controls.json。不冒充真实进程超时实验。

可以确认：该产品实现有一条可重复的离线失败路径——播放状态先于采集身份就绪到达时，首次读取命中target门禁并保持blocked，稍后就绪不会自行恢复，手动读可恢复。当前实际现场只捕获粗粒度target.unverified，仍未在首读瞬间区分application.available／targetActive，也未保留windowStartUtc，因此不能排除其它已知候选。前次默认查询错误与精确PID／ISO正对照仍适用，不重跑。

## 最后只改报告的四处事实

1. **第4节13项指纹表不对应实际输入。** client列填的是整个tgz的A8AA...而非实际client的62F95B...；index列应来自input-hashes.json实际597076...。preview-session.js、author-apply-adapter.js、author-properties-library.js、author-switches-client.js等并非本固定包的实际文件路径。请从现有input-hashes.json逐条转写真实source／expected／actual／match，任务冻结副本和后来追加文档分清；不要手填或猜哈希，不运行新命令／测试来重新生成。实际运行输入已由Codex独立核过，不把错误文档表称成执行输入变更。
2. **WHL1协议描述更正。** 实际24字节：0处WHL1 magic大端；4处sequence、8处payload length小端uint32；12处时间戳小端int64；20／22处宽高小端uint16；随后JPEG。没有报告写的format=1／flags=0字段，不能概括为全大端。
3. **完整链与替身边界。** 实际stream响应是空ReadableStream，帧由测试在session.hub接受后通过engine.acceptFrame交付，并未通过完整HTTP stream消费链；React为自写hook执行器，运行的是实际AuthorSwitches函数体与effect，不是官方SDK／真实ReactDOM挂载。createImageBitmap固定回给1920×1080，没有原生JPEG解码；本组没有真实canvas绘制调用，不能声称ctx.drawImage已经通过。真实JPEG来自既有工坊预览，可记录原件／标记及来源，不能把底层解码替身当硬件证明。这些不否定本次指定状态／effect接缝，但要准确写明。
4. **完成和截止的口径。** schemaSignal仅表明请求包装器已读到响应，后续靠10ms轮询观察控制器终态；无帧仅100ms窗口。脚本内schemaSignal、reading轮询／fetch本身没有独立阶段deadline，依靠外层25秒及kill后2秒兜底，不称每阶段均有截止，也不声称全部客户端physical作业结束／绝无闪烁。正常close及指定清理故障已验，真实卡死／kill后未知退出未实测；该兜底未知出口目前只console.error+非零，未写结构化失败run报告，不概括为全收尾分支已闭环。后续新增QA须复用既有完整有界监督工具，不再扩这个诊断脚本做大套件。

上述只更正文档及接续，不运行任何命令／测试，不改源码／脚本、不生成新候选或开始生产修复。保留旧证据和更正说明，准确引用Codex独立目录，不把错因VM对照归成Gemini原实跑证据。更正后原会话回复即可，Codex轻量核对文档收尾。

## 后续范围

离线诊断阶段已有足够证据评估最小修复：就绪状态与同代首次读取的合同需要明确，不能用固定延时／无限重试或删除target门禁解决。本轮先收尾，下一次用户继续后再单独安排最小修复设计／实现及相关回归；不会自动安装或再试播。原实机与本次VM因果回放分清，日常rc.48及本轮前后备份保持。

最后四处文档更正已单次发送至原Scroll A Investigation Q1-Q3 Repairs（44d9b078-56c9-47a4-aa8a-a1f673d23d0e），保持Gemini3.8FlashMedium／Turbo；新用户消息、空输入及Working已核实。只允许文件读取／编辑，不运行新命令、测试或实现。见本轮独立目录dispatch.json、doc-correction-task.txt。Codex不并行改实现，不创建自动监控。
