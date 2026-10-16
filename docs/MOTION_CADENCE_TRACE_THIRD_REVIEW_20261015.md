# 逐帧节奏观测三审：成功路径改善，失败与收尾边界仍须补修

日期：2026-10-15。Codex 对照 [二次复审 F1–F4](MOTION_CADENCE_TRACE_SECOND_REVIEW_20261015.md)、[原任务书](GEMINI_NEXT_MOTION_CADENCE_TRACE_20261015.md)及最新 [Gemini交付](MOTION_CADENCE_TRACE_DELIVERY_20261015.md)独立复核。

**结论：暂不通过，不进入候选或安装实验。** 这次 ACK 环形覆盖误删、350 条成功尾批、draw 按连接/代次分组、已签发集合非空时的外来连接拒绝、临时写入超时后的清理均有进展，保留不返工。F1–F4 剩余项见下文，均属于原任务的身份、数据可信性和有界收尾范围。三体忽快忽慢尚未定位或修复。

本轮没有修改生产实现、版本、assets、Profile、安装或系统设置，没有操作 DSH/WE、打包、提交推送或自动消息。只在新的仓库 `.tmp` 构建/回放并写文档。另查阅 Fetch 官方规范核对 keepalive 传输限额，没有打开浏览器或现场验证 DSH。

## 1. 本次已确认的补修与回归

独立目录：`F:\dsh-wallpaper-plugins\.tmp\motion-cadence-third-review-20261015-181219-2b1f15be`。

| 项目 | 本轮结果 |
| --- | --- |
| 原七类 motion cadence 套件，冻结副本执行 | 全通过，包含真实客户端流入口/WHL1/生产 paintWallpaper 接缝，Steady/Burst/Jitter 实际 draw 序号与 off/on 控制 |
| 当前 helper 隔离编译与自测 | 0 警告/错误；trace 自测、P4 等待54项、P3实际快照22键通过 |
| `npm run check` / Host / P2 / P3 | check、Host106、P2十类、P3五类全通过；P3 使用本轮实际构建 helper，断言不改，仅调整路径和证据保留 |
| 已签发集合非空时，真实 POST 路由 | 外来连接400、缺核心 schema400、合法记录204 |
| 独立 ACK 覆盖控制 | 发 seq1..150 期间再覆盖150条，ACK 后队列头仍为151，8192条保留；原误删已闭合 |
| 独立成功尾批控制 | 停止时350条全部提交、缓冲归零；原只发150条已闭合 |
| 独立客户端 draw 隔离/外来时钟控制 | 多连接 draw 正确为33ms；外来时钟降级；原 draw 标量混算已改善 |
| Host 临时 write 挂起，超时后释放 | 超时已标 degraded，迟到写入会清理 tmp，最终 JSON 不发布；保留该修复 |

VM 的 canvas 是假画布，结论是生产 drawImage 调用接缝有效；不是屏幕呈现或本机运动均匀性验收。

## 2. F3：停止失败后无截止重发，旧轮回调还能触发新轮尾批（P1）

位置：`dsh-whale-mist/src/client.js:550–621, 1090–1120`。

`finally` 在停止且仍有记录时无条件继续 `flushCadenceTrace({isStop:true})`。网络失败、409 或其它未移除记录的响应，都立即进入下一轮，没有次数、退避、截止或终止丢弃状态。单在途锁只能限制同时请求数，不能限制停止后的请求总数/持续时间。Host 路由在会话已关闭时明确返回409，属于真实可发生的边界。

独立控制只保留1条记录，连续响应409：立即发出第9次请求，队列仍是原记录。为让离线用例结束，第9次由测试主动挂起；生产函数没有该门槛。规范限额模拟的 network rejection 也产生同样续发，详见下文。不是已经在 DSH 上实测重试风暴。

此外，回调捕获的是旧 `r`，续发函数却重新读取全局 `activeRun`。独立控制：旧轮请求挂起→停止旧轮→启动新轮并记录→旧轮204迟到，触发新轮的一次 `isStop:true` 请求，而新轮 `running=true`。这不是旧事件混入新记录，但确实把旧轮收尾作用到了新轮。

### 大尾批还超过 keepalive 的浏览器边界

停止分片从150条放宽至1000条，仍设置 `keepalive:true`。用生产 newLocation、正常成功 draw-end 字段构造1000条，实际 JSON 是 **227,099 bytes**，虽小于 Host 的262,144限额，却大于65,536。Fetch 标准在 keepalive 请求体加同组在途 keepalive 总量超过64KiB时要求返回网络错误；因此不能只按 Host body 上限判断可发送。[Fetch Standard：HTTP-network-or-cache fetch](https://fetch.spec.whatwg.org/#http-network-or-cache-fetch)

这是按规范和实际载荷大小得出的传输边界推断，未操作当前 DSH/浏览器验证其现场实现。离线按该规范模拟 rejection，1000条原样重发至测试第9次挂起，仍剩1000条；现有成功 fake fetch 总是204，覆盖不到这个边界。

**只补：** 尾批必须绑定明确的 run 对象，旧轮完成不操作 activeRun；明确总预算/请求数、可中止请求和失败结论，409等终态停止续发，网络失败不得立即无限重发。按实际字节与 keepalive 在途配额分片，成功与失败/未发数量都通过独立健康状态结清；不能为了 trace 延迟原播放清理。将真实 Host 收尾/409和停止时有在途、旧轮迟到、新轮开始串起来验证。保留已正确的稳定批次ID与 ACK 过滤。

## 3. F2：只分开 draw，Host write/客户端 accept 仍混流；新健康字段未参与结论（P1）

位置：`dsh-whale-mist/qa/perf/analyze-motion-cadence.mjs` 的 getFrame、Host/client处理、runFrames累计及 isDegraded。

这次 `clientDraws` 进入独立连接/代次分组，原 draw 反例已修。但 Host write、client accept/decode/schedule仍写入 run+seq 的最后标量；统计继续使用这些标量，没有使用各连接独立时间线。因而不能宣称各阶段都已隔离。

独立输入：同 run，连接A的seq1/2为1000/1033ms，连接B仅有seq1=0。当前输出：

```text
state=available
clientDrawIntervals.mean=33ms       （本次修复有效）
hostWriteIntervals.mean=1033ms      （仍跨连接拼接）
clientAcceptIntervals.mean=1033ms   （仍跨连接拼接）
```

更直接影响覆盖判断的是健康字段：真实 POST 路由已将 `overflowCount=150, droppedCount=10, trailingUnsentCount=200` 摄取成导出中的 `clientOverflowCount/clientDroppedCount/clientTrailingUnsentCount`；将该实际 collector 快照送入当前 align/analyze，结果仍 `state=available`、reportedOverflow=0。分析器只读原来的 overflowCount/droppedBatchRecords等，没有读取这三个新字段。交付“分析器正确呈现客户端溢出/丢弃/未发”的说法不成立。

**只补：** Host每连接write、client每连接/generation的accept、schedule、decode和draw均使用对应时间线，native/Host完整收帧等共享信息单独关联，不能复用最后标量跨流统计。将当前真实导出的客户端健康字段纳入元数据、覆盖说明和 degraded/unknown 判断，按对应流/代次归属；有覆盖/丢弃/未发不能报成完整 available。补实际路由摄取→快照/落盘→分析的健康反例，而不是只给分析器构造原字段。保留本次已修好的 draw 分组与正常跳帧代理。

## 4. F4：在途门禁在超时返回时释放，rename 与 native Publish 仍可迟到（P2）

位置：`dsh-whale-mist/src/wallpaper/session.js:165–245`；`qa/wallpaper-probe/CadenceTrace.cs:107–177`。

Host token 检查已能拦住“tmp write 等待之后”的提交；但已进入的 `await rename` 不受这些前后检查取消。`cadenceWriteInFlight` 绑定的是 Promise.race，200ms到期便在finally置null，底层writeTask可能仍在等待；所以门禁没有覆盖真实 I/O 的存活期。

本轮真实 createPreviewSession + 注入文件操作/假进程/假窗口控制：

| 故障 | 超时返回时 | 释放挂起后 |
| --- | --- | --- |
| tmp write 挂起，源关闭未确认后再 stop 重试一次 | 已有 **2** 个未结清 write；live degraded=true | 均清理，无最终文件：迟到write拦截有效，但真实在途上限失效 |
| host rename 挂起 | stop已返回，live degraded=true，最终文件尚无 | host最终JSON迟到出现，client最终JSON缺失；已发布host快照 `degraded=false` |

native 仍是 `AtomicFile.Publish` 与 Task.Delay 竞争，Token只作用于Delay；`_flushInFlight` 也在等待超时的finally清零，而非 Publish 结束后清零。原样编译当前 CadenceTrace.cs，配假 Publish：第一次20ms超时后pending=1；同实例再次Flush又超时后pending=2；释放后两份文件均迟到出现，第一份payload的flushFailed还是false。20ms是离线控制预算，未更改生产默认500ms。

Program 的 Warning 与 Summary cadenceTrace.flushFailed 这次已接入，保留；它们不能替代实际 I/O 的结清，也不能令超时前序列化的最终文件自动具备最新失败状态。Host去掉非原子直接覆盖回退也是正确方向，保留。

**只补：** 区分“调用方有界返回”和“底层任务真正完成”，在真实I/O结清前持有在途状态，重试不能不断叠加新任务。对不可取消且已开始的rename/Publish，明确管理迟到完成、清理/隔离输出与最终健康状态，不能发布一对不完整却标为正常的诊断文件。可使用trace专用可取消发布接缝，不改受保护的共享AtomicFile/P4等待/源身份与worker门禁。覆盖write、rename、native Publish挂起及重试，不能只测一次tmp write。

## 5. F1：空签发集合仍放行，可选字段类型仍被改写（P2）

位置：`dsh-whale-mist/src/wallpaper/session.js:1129–1131`；`src/wallpaper/cadence-trace.js` 的连接检查与可选字段拷贝。

已签发集合非空时的400拒绝与核心schema验证已经有效，不再返工。余下两个明确反例：

- 两处均用 `issued.size > 0` 才验证成员。会话刚建立、尚无流连接时，集合为空反而放行 `connectionId=never-issued`，真实POST返回204并保留记录。空集合应表示尚无合法连接。
- 合法连接下，`success:"false", durationMs:-5` 的记录返回204，record()把字符串转成 `success:true` 并保留负耗时。白名单event和核心序号/时刻通过，不等于整个事件schema正确。

**只补：** 必须验证的签发集合为空也拒绝未知连接；按事件约定验证可选字段类型、有限非负耗时及作用域一致性，不能把无效字段强制转换成成功。拒绝有明确计数，正常握手和合法字段仍放行。不要扩成鉴权/UI/协议重写。

## 6. 交付证据应如实标注

客户端 Section3 这次确实走流头/WHL1/真实生产canvas接缝，并记录序号；这是有效改进。仍需收敛两处声明：

- Section3 POST只是存入 postedBatches并总回204；Section4.2仍为手工构造合法连接/批次。Section5里的native/Host时间线由固定33.3ms数值fixture生成。它们可以证明各自局部接缝，不能称native→Host→client→POST→Host导出全部是同一次真实回放实测。给出一条受控完整链的证据，并将合成域明确标为synthetic。
- 原生collector自测不等于生产 FramePipe.Write 前后/取消/故障观测的实际调用验证。仍按原任务用共用实际发送方法配假I/O补窄接缝，不开WGC/WE，不复制发送实现；不重跑GPU/旧实机矩阵。

## 7. 证据与保护收尾

- `before.json`、`source/`：本轮32输入；相对二审有8份实现/QA及1份交付变化，包含Program的失败日志接入；其它输入稳定。
- `author-suite.log`、`check.log`、`host.log`、`p2.log`、`p3.log`：上述现有回归均通过。P3路径适配与patch保留，没有更改其断言。
- `review-cases.mjs`、`counterexamples-final.json`、`counterexamples-final-v3.log`：正常签发/ACK/350成功尾批/draw隔离正例，及停止失败、旧轮迟到、空集合/字段类型、其它阶段混流、真实路由健康摄取→分析反例。规范限额用例是合成边界，不是浏览器现场证据。初期脚本语法错误输出另留，不作结论依据。
- `export-faults.mjs/json/log`：Host write重试与rename挂起的实际生产session故障控制；全部文件在本轮.tmp，helper/child为假对象。
- `native-fault/`、`native-fault-build.log`、`native-fault.log`：原样collector+假Publish，编译0警告/错误，证明超时后门禁与迟到发布边界；没有调用WGC或WE。

开头与收尾after.json已确认：32输入在复审期间零变化；工作区仍rc.30；12原生运行资产、rc.28/29/30/31四归档、五份Profile、日常rc.28的28安装文件保持。旧54保护50份匹配，另外4份仍是任务书获准修改的观测接入文件。原P4四个核心等待/停止/统计文件与WHL1 framing未漂移；审查与接续文档空白检查通过。

**下一步：用户手动交小G，仅补上述F1–F4剩余边界与第6节必要证据，再由Codex复审。** 不再返工已闭合的ACK误删、正常尾批、draw分组或原等待/P3/P2；不准备候选、不打包安装、不操作DSH/WE或改Profile/系统设置、FPS/RAF/latest/尺寸，不提交推送或自动消息。视觉症状根因仍未定位，不能用这些离线通过代替实机匀滑验收。
