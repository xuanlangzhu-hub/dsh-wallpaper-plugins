# 可分离/吸附外观设置 P0 五审：主流程通过，收尾补代次注册与失败状态

2026-10-17，Codex。复审[四审补修交付](DETACHABLE_APPEARANCE_P0_FOURTH_REPAIR_DELIVERY_20261017.md)，对照[四审F1/F2/F3](DETACHABLE_APPEARANCE_P0_FOURTH_REVIEW_20261017.md)。

**结论：暂不通过，范围已收窄。四审主流程及原有负例大部分闭合，保留这次统一执行器和窗口所有者的实现；剩G1主端注册代次/并发、G2失败模式确认、G3窗口动作schema。** 不重做架构、不扩完整P1，也不因此前TS讨论启动整体语言迁移。

## 已验证的进展

独立证据目录：`.tmp/detachable-appearance-p0-fifth-review-20261017-57f90aec`。含冻结输入、`check.log`、`p0-tests.log`、`browser-e2e.log`、补充探针及结果。

- `npm run check`：退出0。
- 冻结P0测试：13/13，退出0。
- 冻结真实headless Edge双Tab E2E：11项声明检查通过，退出0，spawnCount=3、closeCount=3。实际controller、SSE双向更新、旧revision拒绝、指纹去重、预设失败透传、正常吸附/断开及主Tab导航离开后的窗口关闭均有本轮证据。
- 公开默认mainToken已移除；不同instanceId的旧主/旧lease隔离测试通过。普通弹出去重和正常清理计数问题不再按四审旧缺陷描述为未修。
- client.js、appearance-regression.mjs、appearance-harness.js与四审冻结输入逐字节相同；沿用此前570/566/场景选择和实际controller证据，不机械重复。

补充`session-transition-probes.mjs`复现3项边界，`close-failure-fifth-review.mjs`用实际双Tab/controller复现1项模式问题；退出0表示缺陷复现断言成立，不能当作验收通过。

## G1 [P1，F3余项] 注册generation只被记录，未成为请求权限；整段注册存在等待后覆盖

位置：`src/detachable-host.js:217–249,297–354,461–481`；`src/detachable-contract.js:806–817`及主端请求构造。

### 同一instanceId重连，旧代次仍可写/注销

当前Host返回注册generation，客户端保存currentGeneration，但后续主端端点只核对共用mainToken和instanceId，未核对当前注册代次/租约。instanceId相同的再次connect也是当前公开API允许的操作。

本轮复现：

1. 注册same-main，generation=1、revision50；再次注册同ID，generation=2、revision1。
2. 带generation1的旧请求发送revision51快照，返回200，覆盖新会话。
3. 带generation1的旧disconnect同样成功，把generation2会话清空。

现有Test13覆盖的是不同ID的main-A/main-B，不覆盖同ID的两次注册。因此不能称注册代次已经强制隔离。

### 异步注册的等待结束后直接安装旧意图

另一个确定性探针：A的spawn在途；B注册请求进入，注销A后等待窗口清理；此时mainSession=null，较后到达的C注册绕过等待并成功成为当前主端。释放A的spawn后，B继续执行，未核对期间的当前会话/注册意图，**把已经注册成功的C覆盖为B**。原请求的等待结果不能直接操作之后建立的新会话。

补修：为主注册建立独立的注册代次/当前连接能力，所有主端snapshot/action-result/actions/detach/dock/disconnect（含pagehide/beacon）必须绑定当前有效注册；旧代次即使instanceId相同也拒绝。整段注册替换进入同一串行流程，或在每个await后核对注册意图/当前代次，迟到请求返回superseded，不能无通知覆盖当前新会话。窗口弹出代次与主注册代次分别管理，避免共用递增变量混淆语义。

验收：同ID generation1→2的旧快照/注销/回执/流回调拒绝；A在途→B等待→C注册的确定性测试明确顺序，并确认最终有效会话及旧连接、在途请求和owned资源已收束。保留已有跨ID负例。不要仅把探针改成每次换不同instanceId绕过重连问题。

## G2 [P2，F2余项] 窗口模式发布早于关闭结果，主端无法反映失败

位置：`src/detachable-host.js:748–755`先发送`event:dock`再执行close；`src/detachable-contract.js:880–884`接事件直接置docked。

本轮实际双Tab测试将adapter.close设为失败：伴随requestDock得到正确`ok:false/window-close-failed`；Host正确保留owned handle、unconfirmedCleanup=true和mode=docking。**但主renderer已经收到dock并显示mode=docked**。主端没有对应错误/未确认清理状态更新，无法区分“关闭完成”与“关闭失败但当前视图已回主端”。资源门禁这次没有失效，剩余问题是确认状态不一致。

探针还记录：伴随已成功连接后、主端再次操作前，mainBridge.getMode仍为detaching；Host在握手时变为detached，却没有把该转换发布给主端。

补修：向主端发布有代次的权威窗口状态，覆盖detaching/detached/docking、关闭成功以及清理失败/未知。可以在切换时先冻结旧view，但完成事件需在确认close成功后发；失败时主端须能显示真实错误和门禁，不能仅凭意图改成完成态。迟到模式通知不能覆盖新一轮。伴随握手成功也更新主端模式。

验收：正常连接后两端模式一致；延迟close期间不报完成，close失败保留错误，主端与Host都能观察未确认清理；重试确认成功才清理错误/门禁。窗口动作的成功/失败回执和现有资源保留测试继续通过。

## G3 [P2，F1余项] Host直接执行窗口动作仍跳过统一schema必填字段

位置：`src/detachable-host.js:727–773`。

普通动作已通过executeAuthoritativeAction严格校验，但request-dock/close-window仍走Host直接执行分支，仅在expectedRevision非空时比较版本。

本轮复现：合法当前lease发送`{action:{type:'request-dock'}}`，缺clientActionId和expectedRevision，仍返回ok=true并调用close一次。validateDetachableAction明明要求这两项；不同执行路径的载荷契约仍不一致。

补修：窗口动作在进入队列、改变模式或关闭资源前使用同一schema验证，并落实已有版本/指纹/去重语义；窗口资源执行仍属于Node唯一所有者，不把原生操作移到renderer。非法/缺失revision、缺ID、篡改重复载荷不能产生关闭副作用。捕获当前有效会话/注册代次，排队后执行前再核对，防止旧请求作用新窗口。

验收：缺ID、缺/非法/旧revision、重复与改载荷动作的正反例跑在实际HTTP remote路径；非法请求closeCount不增，正常request-dock和close-window仍返回真实最终结果。

## 接续边界

下一轮只补G1/G2/G3，再复审P0；已通过的统一执行器/窗口所有者、13项专项与11项浏览器主流程保持。交付逐项给原始证据，不能先在状态入口写“所有负例已覆盖”。正式ctx.webServer路由/静态页/生产加载仍拟接入，不把本轮离线通过扩成已安装验收；后续[库/详情UI方向](DETACHABLE_APPEARANCE_UI_DIRECTION_20261017.md)保持。

本轮保护清单180个源码/QA/package/资产/归档文件未改；Codex只新增独立证据与文档、更新接续。未查询/操作真实DSH/WE/伴随窗口，未打包安装/提交推送/清理；日常rc.34继续，DSH 0.2.1-rc.1按用户决定暂缓。由用户转交，不跨会话发消息。

交付报告两处措辞另修正：工作区本来就有多轮未提交改动，不能写“Git树干净”；“5 Profile/11字段存储”应区分历史备份文件数与字段数，且用户仍在使用应用，不能保证活动数据冻结。正确说法是本轮未主动写入或恢复日常环境。
