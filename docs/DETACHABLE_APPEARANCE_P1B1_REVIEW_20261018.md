# P1B-1首次复审：控件主体保留，R1–R4补修后再收尾

2026-10-18，Codex独立离线复审。依据[P1B-1任务](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B1_20261018.md)及[小G交付](DETACHABLE_APPEARANCE_P1B1_DELIVERY_20261018.md)。

结论：四项画面调节、界面控件、三组布局已经接入，实际React挂载和基本同步正常；本轮暂不通过。发现独立页快照倒退、预设显示门禁不完整、预设动作抢跑和吸附页失败无提示四项。保持P1A/B已有成果，只补这些边界，不重做架构，不进入P1B-2或候选安装。滚动A继续低优先级。

## 输入、检查与证据范围

证据根目录：`.tmp/detachable-p1b1-review-20261018-6d9c2310/`。冻结完整src/qa/scripts及package到其`dsh-whale-mist/`，交付探针复制到`.tmp/probes/`，交付报告另存`delivery.md`。`inputs.json`记录158项src/qa指纹，检查结束无漂移。

与P1A十审161项基底比较，仅client及companion三文件和此前B的session/managed-window不同；不把B历史变化算本轮修改。59项生产资产/归档保持，见`preservation.json`。本次未修改实现、包版本、生产assets或日常安装/Profile，不操作DSH/WE；自有无界面Edge使用新profile，只关闭本测试创建的进程。定时仍PAUSED，无提交推送或清理工作区。

关键输入SHA256：

| 文件 | SHA256 |
|---|---|
| src/client.js | A21CDE78BC078987AB179162C7423457C349B36599939AF83857724F2DF9AF72 |
| src/companion/companion.js | AFB7C0279807EAF120ECAB9F71BA525AA93CF941EB90A7EF037A490645509D05 |
| src/companion/companion.css | 164DF2656361AB54D3179743BFD0AD83FCAF1C1D34CDA0B6BB3CAC39B7F35D82 |
| src/companion/index.html | 6437306924C2D8A430162594CF3994825BD36EE9C4E129D9D4E964E032280D3C |
| src/detachable-contract.js | 76E89D5EF916798B82545CD422B3446D59A8B43FC86502D8B9C3388E91E2A147 |

复跑结果：

| 检查 | 结果及证据 |
|---|---|
| npm run check | 退出0，check.log |
| 交付10探针 | 10/10，g-probes.log；这不抵消下列负例 |
| P0+P1A | 20/20，p0-p1a.log |
| 旧双Tab链路 | 11项，dual-tab.log；测试的是contract客户端，不是完整新companion控件页 |
| 独立边界探针 | independent-boundaries.mjs，7/7成功复现预期缺陷/正例，independent-boundaries.log；不是修复通过 |
| 实际React19.2.0挂载 | real-react-panel.mjs/log，真实生产组件/controller，假宿主服务；亮度70→113投影、点击Mist同步均正常，无React错误；另复现R4并核对真实controller的mismatch/scene-unconfirmed |

独立边界探针仅替换DOM与transport收发时序，运行冻结的真实companion.js与createCompanionClient；没有替换快照处理/队列逻辑。React探针使用历史隔离依赖及appearance-harness的假DSH服务，将React替身替换为实际React/ReactDOM；预设失败由controller公开动作返回失败注入，用于检验真实组件的错误显示。真实controller门禁用合法`we-0123456789abcdef01234567`场景ID及受控状态读取核验。初次附加门禁探针误用`other`，被真实设置校验归一成Lucy；失败记录保留为`real-react-panel-invalid-scene-fixture.log`，修正后退出0，不把该次无效探针算产品问题。

未做真实独立系统窗口、吸附拖动、多屏DPI及主观视觉验收。交付PROBE9是手写React树替身、PROBE10是CSS字符串断言，不能分别称实际React挂载和宽窄布局行为通过。本轮实际React基本挂载已有独立补证，宽窄布局几何/关键动作可达仍需小G补轻量隔离验证，不要求多套截图。

## R1：独立页绕过单调快照门禁，旧回包仍能覆盖新显示（高）

位置：`src/companion/companion.js:193`的applySnapshot，以及set-setting响应分支346/351、三个预设响应454/470/486和连接返回处理。

createCompanionClient已拒绝倒退revision，但app又直接applySnapshot(res.snapshot)，没有版本检查。独立复现：发brightness80，先推送rev3的mask60，再返回rev2的mask45；client仍rev3，app变rev2，滑块显示45。预设成功响应同样可倒退。风险首先是UI/本地比较依据失真，不能据此声称真实controller已被覆盖。

另一同源表现：brightness80在途，用户继续拖100；80响应到达后把滑块拉回80，100仍在发送，直到下一响应才回100。当前活跃数字框的特殊跳过也要考虑失焦后恢复权威值，不能无限停在陈旧输入。

补修：所有入口共用单调接收路径，优先使用client已接纳快照，区分权威已确认值与在途编辑，不能让旧回包或本字段前一响应覆盖更新意图。保持跨字段推送及时同步，不为保护拖动而冻结整个页面。错误/断连后要清楚恢复或标明未确认，不能把乐观值当确认结果。

验收：实际companion应用层覆盖成功/失败/预设/连接的迟到快照、跨字段推送、80→100在途、聚焦数字输入后外部修改/失焦；app/client版本一致且不倒退，最后真实controller与两端显示一致，无过期队列重放。

## R2：预设按钮另算门禁，未遵守权威目标确认（中）

位置：`src/companion/companion.js:142`updatePresetsView。只检查若干state，不检查活动/所选场景不一致、目录确认/available、非法/未知scene；stopping和未知state还默认放行。playing无活动身份会猜所选值或Lucy。

独立复现：selected为合法we-ID、active为Lucy，独立页save/apply仍启用；相同真实controller的resolveTarget返回mismatch。idle所选we-ID未确认时，真实controller返回scene-unconfirmed，独立页仍可保存；stopping/未知state也启用。权威动作仍会拒绝，这不是已证实绕过底层保存安全门禁，但违反一致UI门禁并给用户无效按钮。

补修：把真实controller.presets.resolveTarget的只读结果作为可安全序列化的权威快照信息提供两端，或等效复用既有规则；不得在独立页复制不完整推算或凭空补Lucy。保持底层动作在执行时再次校验，避免只修按钮。任何快照契约调整需同步嵌入client版本与模块版本，不破坏P1A兼容或扩大能力。

验收：真实controller配合生产独立页，覆盖selected/active mismatch、未知active、目录未确认/available=false、cleanupPending、starting/connecting/waiting/stopping/cleanup-failed/error/未知state、合法idle/playing正例；错误原因可见，两端目标及按钮一致，失败不写预设。

## R3：预设动作绕过调参队列，拖完即保存会抢跑（中）

位置：`src/companion/companion.js:309`设置队列与446/462/478直接dispatch的预设动作。

独立复现：brightness100写入尚未回复就点击保存，set-setting和save-preset均带expectedRevision1同时发出；前者提交rev2后，保存收到stale-revision，正常“调节后保存”失败。相反处理顺序也可能先保存旧四字段值。当前只有set-setting串行化，不能据其通过断言整体动作有序。

补修：保持用户操作顺序，使保存明确发生在之前调参确认后；应用/删除也要与在途设置有确定顺序。可统一有界动作队列或在动作期间禁用并明确状态，不能无限重试陈旧请求。不要在场景/连接已改变后自动重放此前预设意图；目标在点击与执行时均应确认，冲突需明确拒绝或重新确认。

验收：在可控延迟的真实动作路径覆盖连续拖动→立即save、apply与设置交错、场景切换/断连、拒绝后恢复。保存的四字段必须是用户操作所对应已确认值，主题/聊天/强调色保持；结果不能静默保存旧值，也不能要求用户反复点按钮碰运气。

## R4：吸附页一般动作错误没有显示位置（中）

位置：`src/client.js:5054`actionError、5063 lastError、5292显示条件，以及save/apply/remove和detach/dock回调。

actionError虽setState，却只在unconfirmedCleanup为true的“窗口关闭待确认”条中显示。一般预设失败时该标志为false，用户看不到任何反馈。实际React挂载证据：save按钮启用，公开保存动作返回`review-preset-save-failed`；事件执行并渲染后，body不含此错误，React无异常。不是仅通过源码猜测。

补修：增加独立动作反馈区域（合适aria-live/alert），区分窗口清理错误和普通设置/预设错误；明确成功或下一动作清理旧错误，避免陈旧bridge.lastError永久压住新错误。失败不改变确认状态，不把所有错误都称窗口关闭待确认。

验收：实际React挂载，预设三动作与detach/dock各至少一个失败可见；cleanup=false也可见，成功后错误合理清除；控件禁用及键盘状态仍正确。补修报告准确标注实际React、DOM替身、CSS静态和浏览器几何测试各自范围。

## 交付与下一步

小G只补R1–R4及相应真实应用/React层回归，交`docs/DETACHABLE_APPEARANCE_P1B1_REPAIR_DELIVERY_20261018.md`，使用新独立证据目录，保留旧交付和负例。不要求重跑A/三体/GPU/全部历史QA。不同时扩P1B-2、作者参数或打包安装。日常DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1保持，工作区manifest/生产assets仍rc.30；不操作日常应用、不提交推送清理，定时PAUSED。补修完成停下等独立复审。

转达记录：21:29通过computer-use向小G新对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次R1–R4任务；已核验新用户消息、输入清空及Working/Cancel，模型仍Gemini 3.8 Flash High。等待补修，定时PAUSED。
