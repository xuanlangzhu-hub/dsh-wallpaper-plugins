# 原生侧栏：统一播放命令记录与只读关闭状态

2026-10-23，接续[关闭背景顺序核对](WALLPAPER_NATIVE_BACKGROUND_CLOSE_PLAN_20261023.md)。本轮完成状态基础，**没有接关闭按钮、来源提交或修改Host协议**。

## 实现

在原 `createWallpaperEngine` 的唯一command函数记录实际发出的start／restart／stop，覆盖原生、旧页、controller直调、自动开始和代次过期后的补偿停止。不另建播放器，也不把记录仅挂在原生UI的12秒任务门禁上。

- 发请求前登记，JSON解析及异常落定后移除；每项只含递增ID、动作、代次及是否补偿，不包含路径、原始异常或请求体。
- 保留所有未落定项及最后一条完成摘要，不保存无限增长的已完成历史；busy拒绝且没有实际请求的动作不制造命令记录。
- 迟到start／restart的必要stop仍会执行，显式标为compensating；不减少、合并或额外发送播放命令。
- 网络拒绝、同步transport抛错、JSON解析失败、标量／数组／null等损坏结果使uncertain锁存。同一engine内后续正常stop和原生服务重建都不能偷偷清除它。仍挂起的真实fetch一直算pending，UI截止时间不等于请求已终止。

引擎新增稳定、冻结的 `getCloseSnapshot()` 和可释放的 `subscribeCloseState()`。状态为unverified／pending／unknown／active／closed-observed／disposed。等待帧的running源仍为active，不能看起来已空闲。订阅者抛错不影响播放命令，dispose后停止通知，但迟到命令及其补偿仍计入原engine记录。

controller新增 `readBackgroundCloseState()`，在上述快照上附当前background、选择ID、用户动作修订、来源选择修订与controller销毁状态。它不发请求、不写存储、不停止或切换壁纸；动作A→B→A仍能从修订变化识别，不能只比较最后的选择值。

## 观察与许可分开

`closedObserved:true`只表达：当前代次、最后发出的明确非补偿stop回包包含本次 `cleanup.closed === true`，没有矛盾的活动源／session／pending／failed字段，所有本地命令均已落定，当前状态不再活动或清理，且没有unknown锁存。

以下均不会形成该观察：缺cleanup、只有旧lastCleanup、关闭失败、损坏状态字段、较旧命令迟到、新动作启动、同轮仍有未落定命令、补偿stop或已dispose。无会话时合法的cleanup:null记录为no-proof，不伪造成closed，也不一概改成损坏。

**所有快照的canCommit仍固定为false、reason为host-proof-unavailable。** 本地闭合观察不证明Host全部ownership已经释放、跨请求取消已经完成，不能据此调用set none。新接口也不是授权票据，不能缓存它以后直接关闭来源。

原stop的兼容判据、状态呈现、lastCleanup回退、取消代次和错误处理保持，未借此全局收紧旧流程；set(background,none)提前保存、先stop再set重复命令的旧问题仍在，因此新侧栏仍不提供这条路径。原网络command仍没有独立AbortSignal／截止时间，本轮没有把UI超时包装成底层取消，也没有自动重试或调大期限。

## 离线验证

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-close-command-state-20261023-9d61c3a7`。

新增 `qa/wallpaper-command-state.test.mjs` 通过完整client的公开engine导出执行，不复制实现。20项覆盖只读／快照冻结、挂起、并发stop、过期回包、重新明确stop、关闭失败、缺证明／旧证明、矛盾及损坏字段、网络／解析未知、busy、start／restart与补偿、等待帧、订阅异常、dispose与摘要保留边界。transport／空stream／时钟和定时器为替身，退出前挂起均明确释放，计时器归零。

原输入先跑新增19项，因接口不存在失败；实现后通过。检查时再补等待帧的第20项，确实暴露新枚举将waiting误归unverified；只补状态分类为active后通过。原始失败输出均保留，不修改旧QA。

最终 `verified-regressions-report.json`：20项新增加原674项，**694项测试通过**；40个有界阶段包含旧侧栏／作者／选择／播放相关回归、两个生成同步检查、语法和CSS检查。前端阶段P2与Motion Cadence纯离线回归也通过，分别1.050秒与10.778秒；不代表本轮做过性能实测。

| 完整client／实际官方SDK组 | 流程 | 父监督时间 | 下层属性IO替身 | 合成播放HTTP |
| --- | --- | --- | --- | --- |
| verified-existing-sdk | 原111 | 21.119秒 | 60次 | 3次 |
| verified-ledger-sdk | 原9项现状核对加5项读接口／命令记录检查，共14 | 6.403秒 | 0次 | 20次（5次start、15次stop） |

两组共**125项流程通过**，使用完整Whale入口、真实官方React／ThemeRuntime／会话／原生右栏／dockkit、实际controller／engine、伴随Host与回环HTTP。播放Host响应／空流与原生窗口IO为替身，真实WE命令0。新组验证只读不发播放命令／不写偏好、挂起stop、意图A→B→A、旧start在较新stop后仍可见、补偿及未知跨原生服务重建保持。合成请求数包含刻意重放的旧路由，不能称它们为关闭功能通过。

两组页面异常0、未知HTTP错误0；settings／status／library／preset订阅、refs／pins、远端监听、DOM、stream和活动Blob URL归零，两个服务正常关闭，自有headless Edge正常退出，无强制退出。原111组本轮创建7个URL、释放7个。

保留原精确匹配的首次可选snapshot401、disconnect401，以及原111组3项故意作者409，cleanLog:false。无额外400，不放宽匹配；历史stale-revision400仍未定因。

新组第一次在第14项调用qa.restartRight时，没有先卸载已有服务，脚本因sidebarRightTabs重复注册失败；此前13项完成，原输入、失败和收尾证据保留。改为先unloadRight再restartRight后重跑；没有通过改产品规避重复注册。最终输入另做完整重跑。

上一轮自有Edge正常关闭超时也保留为未定因。本轮正常退出未修改浏览器清理顺序／期限，不能据此认定上一轮超时已修好。本轮SDK父监督仍45秒／51秒，单阶段20秒／25秒、回归总60秒；未延长期限或重复同一输入求绿。

## 变更保护

开工266项既有输入中，只有client变化，其余**265项保持**；新增20项QA，全部旧QA、Host／作者执行器、侧栏模块、两个生成器、manifest／生产assets与官方冻结输入保持。审计按当轮开工副本比对，不拿脏工作区直接对git HEAD推断本轮改动。

client变化限制为原引擎的命令观察／状态读取及controller的只读方法；移除这两处后与开工文本逐字相同，两个生成片段逐字保持。因此四字段预设apply的finally通知修补、旧setter／reset、CSS／主题／透明度和全部UI都保持。

最终client SHA256：`94F57C44737EAD906F3490B0AAF7C815A8FAB3FECE1E4CE20DFB0593CB10F27A`。两组verified SDK绑定此指纹，完整清单与审计见 `change-audit.json`。

## 下一步

补**Host端最小只读生命周期／ownership证明**及对应取消边界核对，再设计可原子核验且不额外发stop的来源提交。仅新增busy或复用pending:false不够；需要区分当前无会话、关闭已证、旧请求未落定、未知传输以及Host／controller更换。对尚未到达Host的旧请求尤其不能仅凭一次空状态读取放行，需明确代次／意图栅栏或继续拒绝未知。

先把真实Host与客户端这组边界离线闭合，再接最小关闭按钮；不先在UI中伪造许可，也不顺带做完整来源选择器、导入、全局恢复或独立窗迁移。

本轮未构建打包、安装发布、操作日常DSH／WE、改Profile／版本／生产assets、提交推送清理、联系其它助手或恢复定时。日常DSH0.2.1-rc.2／rc.42／Git Bash0.1.1保持，开发manifest／生产assets仍rc.30。源码与离线通过不等于实机、视觉或长期验收。


## 后续接续：Host只读状态完成

见[Host只读关闭状态与生命周期观察](WALLPAPER_NATIVE_HOST_CLOSE_STATE_20261023.md)。本次新增Host UUID／修订／全部到达操作集合与纯读GET，141项离线测试通过，客户端及其统一命令记录保持。只证明当前已到达请求的状态，不阻止之后到达的旧请求，canCommit仍false；先接显式有界读取与两侧同轮核验，再做来源提交和关闭按钮。历史fallback、snapshot400和Edge收尾未定因部分保持，不扩称实机通过。
