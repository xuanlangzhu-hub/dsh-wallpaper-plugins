# rc.50 作者参数首次读取：离线诊断与窄探针

2026-10-26。接续[真实短验失败与恢复](RC50_NATIVE_UI_SHORT_TEST_20261026.md)。**已建立原包调用链的离线分段复现，当前 Lucy 参数声明与真实目录读取均可成功；现场唯一根因仍未确定。隔离副本中的窄诊断通过验证，尚未提升共享源码、打包或安装。** 日常 DSH 0.2.1-rc.3／Whale rc.48／Git Bash 0.1.2 保持，本轮没有采样或操作日常应用。

用户新增反馈：这次观感好了很多，但尚未上手体验；播放应呈现为“▶ 播放”，不要只有单个 ▶。已记录为参数问题之后的呈现待办，本轮不改按钮，不把正面观感扩成实际使用／整体设计验收。

## 本轮固定输入与复现接缝

证据目录：`F:\dsh-wallpaper-plugins\.tmp\rc50-author-initial-read-diagnosis-20261026-a`。固定实际 rc.50 tgz，SHA256 `F6D1BA78A3B08974BCC18410B1692CADDFAB4A72CB0070903D0B74A33C3B78D7`，重新独立解包，43 文件保持原哈希。

测试使用实际包的 main transport、原生作者控制器、HTTP Host／作者 schema 路由；VM 仅增加测试导出和失败码观察点，不替换业务判断。HTTP 仅绑定本次独立 loopback，拒绝其它 origin／目标；元数据、窗口就绪和生命周期按场景定点替身。读取当前 Lucy 已验证项目的声明作为额外冻结输入，另用原包 library 对**仅 Lucy 单目录**做一次有界只读扫描和正式 metadata 校验。没有预览／场景内容字节采集、原生窗口／子进程命令、模型请求或日常 Profile／存储读取。

所有控制器首次读取结果、实际请求路径／状态、固定分类错误码、字段数量和清理证明均可重复输出。正常合成正例、Lucy 声明正例及真实 library 正例分别成功；不只依赖“没报错”判定。

## 已确定的结论

1. 当前 Lucy 项目含 19 项声明；用固定 rc.50 解析并经实际控制器接受后，得到 6 个支持的控件。同一内容的真实单目录 library 路径也返回 schema 200、targetActive=true，控制器进入 ready。声明文件只读前后 SHA256 一致。该事实不证明现场当时收到完全相同响应，也不能替代实机连接／生命周期证据。
2. **多个不同故障确实被压成同一句“未能读取设置，请重试”。** 连接前拒绝和 snapshot 非成功都折成 author-disconnected；schema 错误返回折成 request-failed；响应结构错误为 response-invalid；未验证目标为 target-unavailable。现场截图仅有最终文案，不能从它判定请求是否到达 Host。
3. 生命周期 busy 会由真实 Host 返回 author_cleanup_pending；读取期间生命周期变化会返回 author_context_changed；动作 SSE 提前结束时则在发 schema 前被桥接拒绝。这些都可确定复现相同用户可见失败，**并非证明现场就是其中任何一个**。
4. 从上一轮原始源日志另存 4 个文件，核对 location、PID、HWND 与 playing 证据一致；任务栏动作记录中有完整、有效的源进程启动时间。它削弱“根本没有任何源身份记录”的笼统解释，不能反推首次作者请求瞬间的 targetActive 或 ownership。

故本轮没有按某一猜测修改 ready／鉴权／身份门禁、增加延时、自动重读或放宽响应校验，也没有声称参数问题已修复。

## 可验证方向与本轮结果

按 diagnose 流程先建反馈环，再给出三条方向，逐个定点验证：

| 方向 | 可证伪预测 | 本轮得到的证据 |
| --- | --- | --- |
| 启动／就绪边界 | Host 仍 busy 或目标未验证时自动读会失败；完全就绪正例可读 | 同症状可复现；尚无现场请求时序，不能定案 |
| 桥接连接 | 动作流先结束时，schema 不会发送，故单看后端 schema 日志会漏掉原因 | 实际 bridge 的连接前门禁可复现，schema 请求数为零 |
| 目录／响应边界 | 稳定本机 metadata 或 schema 若仍失败，能得到与连接前拒绝不同的阶段 | 当前 Lucy 声明和真实单目录 library 均成功；故仍需现场响应来确认 |

原始 rc.50 的回放共 7／5 两组（含正例重叠）；这是分类复现，不是修复验收。`replay-report.json`、`replay-vtwo-report.json` 含具体阶段数据。

## 隔离窄诊断副本

`client-read-diagnostic-probe.js` 只改两处：既有 requestAuthor 传输和既有原生作者控制器。客户端其它代码逐段比较保持；候选包和共享源码未改。VM 测试导出／观察 hook 只存在于另一个测试副本，不进入诊断客户端。

诊断仅在本次读取失败时给原有错误文案附固定阶段码；正常读取不显示额外文字、不增加按钮或轮询。错误分类不写 Local Storage／文件，不发额外请求，不加请求头，不保存原始 token、URL、路径、错误堆栈、壁纸值或后台正文。

| 隔离场景 | 诊断码 |
| --- | --- |
| 尚未连接／动作流已结束 | bridge.disconnected |
| snapshot HTTP 非成功 | snapshot.http.409（状态值取有界整数） |
| snapshot 网络失败 | snapshot.transport |
| schema 网络／JSON 失败 | schema.transport／schema.json.200 |
| schema 权限／上下文／超时／元数据拒绝 | schema 加固定 reason 分类和有效状态码 |
| 响应结构不合法 | validation.shape |
| 目标未验证 | target.unverified |

reason／stage 来自封闭枚举，后端未知错误进入 rejected 或 unknown，不能把任意后台文字带到 UI。probe 不把失败改成功，不再发 ensureLoaded，不 apply／重放草稿；错误后是否手动重读仍由用户决定。

这是**供下一轮取证的隔离副本**，尚未独立核成候选，不可直接覆盖日常或当前共享生成块。不能把诊断文本改进记成首次读取 bug 已解决。

## 核验与失败记录

- 诊断副本的 13 个实际 transport／HTTP Host 场景通过预期：正常合成和真实 library 成功；故障返回明确分类并保持 blocked；每上下文没有自动第二次调用，author 命令为 0。包括模拟私有错误文本的网络／JSON 故障，UI 不显示原文。13 项包含之前分段场景的重叠，不累加成独立大总数。
- 18 项首次读取控制器回归通过：跨视图共享、取消、迟到、ABA、超时物理占位、旧／脏记录、手动重读和编辑保护保持。正常首次 GET 不保存／apply 默认值；只有原有、显式手动刷新测试会触发模拟 draft，不能把所有回归场景统称完全无 POST。
- 首次把这 18 项迁入 VM 时，5 项 deepStrictEqual 因跨 realm 原型不同失败，数据结构相同；失败结果与原测试副本保留。仅隔离测试对 payload 使用 structuredClone、对 keys 使用 Array.from 消除 realm 边界，再独立运行通过；未删断言或改业务门禁，不声称首次全绿。
- 12 个脚本语法、原包 43 文件、325 保护输入核验通过。每次隔离 Node 有 20 秒父监督、退出确认和超时状态；所有测试子进程正常退出，Host／主连接／控制器逐场景清理，无真实原生进程。

证据入口：`validation-summary.json`、`diagnostic-privacy-report.json`、`native-regression-vtwo.stdout.log`、各 `*-run.json`、`probe-fingerprints.json` 和 `retained-real-run/`。原 a／b 实机轮次证据及固定 release 包均保持。

## 下一步与验收边界

下一小步先独立复核窄诊断副本在实际 SDK／UI 中的错误输出、取消和可见性边界，再决定是否整合仅用于取证的固定候选；不得夹带“▶ 播放”、其它布局、性能或新作者资格。

若必须再取现场证据，先备妥具体候选与新备份／恢复流程，另确认当时方便／无任务。仅做一次 Lucy 首次读取、记录阶段码后停止；不让用户重复完整 UI 流程。拿到实际分段原因后，针对该接缝写失败回归、补修，再核对原场景。现场根因未确认以前，不以重启／手动重读可恢复来宣称根因解决。

本轮无生产设置修改、候选打包／安装、日常 DSH／WE 操作、提交推送、清理、跨会话派发或定时任务。日常仍 rc.48，开发 manifest／生产 assets 仍 rc.30。
