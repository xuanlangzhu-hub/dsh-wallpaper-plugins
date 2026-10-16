# 给 Gemini：只补运动节奏的逐帧观测与离线回放

日期：2026-10-15。用户已授权继续这一步，仍采用 Gemini 实现、Codex 独立复审的协作顺序。先读 AGENTS.md、NEXT_TASK.md、[新症状与只读结果](MOTION_CADENCE_SYMPTOM_20261015.md)及[P4短测结果](COMPLEX_SCENE_P4_FOREGROUND_RESULT_20261015.md)。

**本轮交付是观测工具和真实调用路径的离线回放，不是播放调度修复。** 暂不安装、操作 DSH/WE、开窗或实采。完成后交 Codex 复审，通过后另定独立候选及针对性短测；不要自动进入下一阶段或自动向其它助手发消息。

## 1. 要回答的问题与验收边界

用户看到三个球突然加速、减速、再加速，桌面原三体运动更平顺。用户说 rc.31 和目前恢复的 rc.28 似乎都有。这个现象与原先接近一秒停住不同，不能用平均 FPS 或“无长停顿”替代运动均匀性验收，也不能先定为 P4 回归、传输积压或壁纸本身。

旧 rc.31 鼠标段 618 个相邻采集轮间隔为 32.65–34.50ms，记录组装间隔约25–41ms；静止段有少数更长间隔。当前缺每一帧 HTTP 到达、解码和真实 draw 时刻，也没有球的位置轨迹，所以尚未复现/定位该视觉症状。

本轮先建立可回答以下问题的时间线：

- 画面所对应的源时间是否均匀推进？
- 哪一层把平稳输入变成了集中到达、重复、跳过或不均匀输出？
- 解码完成和真实 canvas 调用的间隔怎样；Host 背压与 latest-frame 跳过怎样关联？
- 哪些证据仍不足以区分独立源壁纸的内部运动变化与传输/绘制节奏？

离线合成/回放验证的是工具和调用接缝；即使能重现某种不匀，也不等于已证明本机用户症状由该原因造成。drawImage 返回仍不是物理呈现，WGC 时间戳仍不是球的位置或模拟时间。

## 2. 已固定的基线与运行环境

交接目录：

F:\dsh-wallpaper-plugins\.tmp\motion-cadence-handoff-20261015-160022-bd6a53e7

before.json 和 source-before/ 固定 27 份客户端/Host/原生源码；交接时前次26份P4复审输入与54份保护文件仍匹配。日常 rc.28 的28个安装文件与活动包一致；另记录当时五份Profile及 rc.28/29/30/31 四归档哈希。

- 日常安装仍为 rc.28；用户目前可能正在播放，不要套用上轮“保持停止”的旧状态。
- 开发工作区 manifest/assets 是 rc.30 基线；已验过的 rc.31 是独立暂存构建的不可变归档。
- 版本、生产 assets、四个 tgz、实际安装、Profile/Local Storage、官方 EXE/app.asar 和原 WE 都不动。只在本仓库 .tmp 新目录构建/落证据，不覆盖旧输出。
- before.json 是当前输入凭据，不是任意信任一份新自报哈希的许可。交付列出哪些源码在允许范围内改变，其余保护按原记录核对。若用户运行期间合法更改 Profile，只记录事实，不盲目恢复。
- 已通过的 NativePacingDelay、KernelWaitTimer、ParentStopChannel、NativePacingTracker 语义、P3的22字段、P2的36字段/旧metrics载荷边界、WHL1的24字节头与二进制协议保持。

## 3. 改动范围与实际接缝

允许新增窄 trace 收集/分析辅助类及 QA；生产文件只为插入可关闭的观测钩子做必要局部修改：

| 边界 | 实际位置 | 最小观测 |
| --- | --- | --- |
| 原生 | qa/wallpaper-probe/Program.cs、必要的旁路辅助类 | sequence、WGC源时间、读取/编码/FramePipe.Write前后单调时刻 |
| Host收帧 | src/wallpaper/frame-hub.js 的真实 FrameDecoder 回调 | 完整帧解析完成时刻、序号、流身份 |
| Host发送 | 同文件 streamFrames 的真实 pump/write/drain/close | write开始/返回、返回背压标记、drain及已知跳序 |
| 会话与持久化 | src/wallpaper/session.js 的实际当前会话入口 | 配置开关、run/连接关联、有界批次导出、停止收尾 |
| 客户端 | src/client.js 的实际 decoder/accept、paint、paintWallpaper | 完整帧accept、RAF/timeout触发、解码起止、真实draw起止及结果 |

允许修改 CaptureArguments 等共享入口的唯一情形是明确的观测开关传递确实需要；必须保留原参数/工具CLI/worker无额外副作用，并补真实解析回归。优先减少协议和入口改动。不要改 FramePipe 的 WHL1 framing 来夹带日志，也不能往二进制 stdout 写诊断。

不改RAF/timeout调度、latest策略、解码并发、背压行为、P4等待、30fps目标、截断/最低1ms/空帧2ms、JPEG/尺寸/设备、主题、裁剪、scene/自动播放名单或任务栏生命周期。这里不是插帧/缓冲/降帧/视频链路改造任务。

## 4. Trace 契约

1. **默认关闭、显式启用。** 开关来自Host本地诊断配置，仅影响明确的当前trace run；不新增普通设置UI，不改用户Local Storage。记录enabled状态和schemaVersion，关闭时不创建写入器/后台循环/trace数组，不做逐帧日志、HTTP请求、对象序列化或新线程。
2. **按帧与作用域对齐。** 每条/每行明确 runId（可复用本轮location）、sequence、clockDomain、事件或边界、atMonoMs。多HTTP连接、重连、前端generation分开；旧run的迟到decode、draw、report不能写入新run。使用当前流校验，不能接受浏览器传来的任意文件路径、命令或伪造会话来落盘。
3. **正确记录终点。** 接收必须是完整WHL1帧被解析；draw必须包住实际canvas.drawImage，包括成功/失败或未执行原因。不能将rendered++、emitFrame开始或订阅者回调被调用当成成功draw。sourceSequence和generation要随该帧走到draw终点；新run不能继承旧序号间隔。
4. **单调时钟分域。** Native QPC/Stopwatch、Host单调时钟和客户端performance.now分别声明。先在同域算相邻间隔/阶段耗时，通过run/seq关联；禁止直接相减不同原点的时钟伪造队列延迟。WGC源时间优先从原生旁路记录关联；capturedAt的UTC取值/精度和时钟调整要注明。
5. **明确有界。** 本轮不保存JPEG/截图/聊天内容。每域按帧环形记录容量应足够覆盖一次20–30秒短窗口（例如2048帧），持久化/传输只做有大小限制的增量批次，避免每帧I/O和HTTP。列明内存、批次字节、磁盘、首尾序号、覆盖/溢出计数；覆盖截断不能伪装成真实丢帧或平滑。
6. **低侵入与有界收尾。** trace故障不能改变播放/丢帧/停止策略；提供一次明确降级诊断及丢弃计数，避免无限积压或静默写错。停止导出有界，不增大Host超时、不干扰已通过的worker/源身份与退出门禁。不因记录每帧而引入每帧Task.Run/线程/无限Promise队列。
7. **独立于旧指标。** trace放单独、受限的schema/旁路输出；不把整个trace附进现有metrics、preview-status或P3对象，不扩写旧22/36字段以绕过保护。确需增加独立导出入口时沿用现有会话/请求边界，限制body/记录数，不影响旧路由。

## 5. 最小离线分析

输入为有界trace导出及必要的既有原生帧记录，原样保留；输出逐帧对齐表、各同域间隔分布和覆盖/缺口说明，不只输出平均FPS。

至少报告：

- 源时间增量；原生发送、Host完整收帧/各连接write、客户端accept、decode与draw的相邻间隔。
- decode耗时、RAF/timeout路径、背压/drain、明确的latest覆盖、失败/未绘制的原因。
- 对两个相邻且可验证的已绘制帧，分别算源时间推进量和客户端draw时间推进量，作为**采样/呈现节奏代理**；不是球真实速度。
- 缺失、逆序、重复、跨run/clock、溢出与稀疏覆盖不能先过滤再报“valid”；保留原始异常并限制结论。
- 缺trace的旧数据为 unavailable/unknown，不是0延迟、均匀通过或自动用累计max回退。
- 不同域未建立时钟映射时，只给间隔/关联，不给未经测量的绝对分段耗时。

可用很小的数值fixture证明平均速率掩盖问题：源相邻步长33/33/34ms；draw间隔33/33/34ms与10/10/80ms总时长相同，但间隔分布不同。必须标为synthetic，并以同一分位数规则从原始值重算；不将这些数字冒充本机实测。

## 6. 必须跑的真实调用回放与控制

复用现有 qa/perf/check-frontend-stages.mjs、qa/appearance-harness.js 等可控时钟/画布接缝的经验，不复制一份“看起来一样”的新播放器。实际生产类/函数应被执行；原生变动用真实编译方法配合假输入，不打开WGC或WE。

- 平稳到达、同均值但成批/分块到达、解码耗时变化；真实WHL1解码器→accept→调度→decode→实际canvas钩子全部走通。
- 对每种输入比较 trace关闭/开启：请求序列、实际绘制序号、bitmap释放、错误与停止结果一致。记录可以不同，播放策略不能被trace改变。
- Host实际FrameHub/streamFrames覆盖write=false、drain、已知跳过、连接关闭和重连；关联到正确连接，不能把write返回当浏览器已收到。
- 停止/重启时迟到decode和上报、RAF句柄0/取消、丢帧原因、draw失败/缺canvas、trace批次异常、容量溢出和不完整覆盖等边界中，实际受本次改动影响的路径必须有反例/正例。
- 原生若增加发送时刻，验证before/after真实写调用及取消/故障的记录含义；实际helper独立构建0警告错误，P4的54项等待与P3实际22键保护保持。
- 运行npm run check，以及受影响的Host/前端/P3回归。不要机械重跑所有历史套件；交付列明命令、为什么相关、原始结果及输出目录。
- 保留trace-disabled的运行行为证据和trace资源上限证据。数值/离线通过只证明工具与接缝，不作为运动匀滑修复结论。

## 7. 交付与后续

给出简短交付报告，包含实际改动、如何显式启用/关闭、schema与资源上限、时钟含义、off/on控制、真实调用覆盖、仍无法判断的部分、输入/保护指纹、新证据目录。原始样本、合成fixture和离线回放输出分清楚，不能把特制输入称为已复现用户视觉问题。

版本保持工作区rc.30；生产assets、四归档和日常rc.28不变，不打包/安装/操作DSH或WE、改Profile/系统设置、提交/推送。Codex复审后才准备独立新候选；真实短测另确认届时方便、保存当前设置。不要覆盖rc.31，不预先写“加速减速问题已解决”。

任务书由用户手动交给小G；本轮没有自动发送消息，也没有派生代理实现。
