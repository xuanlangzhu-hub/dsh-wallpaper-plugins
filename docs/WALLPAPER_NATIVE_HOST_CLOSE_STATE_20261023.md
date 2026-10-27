# 原生侧栏：Host只读关闭状态与生命周期观察

2026-10-23，接续[统一播放命令记录](WALLPAPER_NATIVE_CLOSE_COMMAND_STATE_20261023.md)。本轮仅补Host的本地状态观察；客户端、侧栏、来源提交及按钮均保持。

## 实现与协议

`registerWallpaperRoutes`新增 `readCloseState()`，同时提供只读 `GET /whale-wallpaper/close-state`，返回JSON并保持cache-control:no-store。读取不调用旧statusPayload，不扫描目录、不检查文件、不探测进程或窗口，不开始／停止／归档会话。

| 字段 | 含义 |
| --- | --- |
| version / hostInstanceId | v1、本次Host注册的独立UUID；重建Host后不同，不是访问凭据 |
| revision / generation / cancelGeneration | 观察修订与既有运行／取消代次；生命周期活动A→B→A也会改变修订 |
| lifecycle | active或disposed，卸载即失效 |
| state | absent、active、closed、unconfirmed、unknown、pending或disposed |
| session | 当前保留会话的状态；与操作是否结束分别表达 |
| pendingCount / pending / pendingTruncated | 所有已进入Host、尚未落定的操作数；明细最多16项，截断仍保留真实总数 |
| ownership | 当前旧门禁的start／stop或null；不能用它代替全部操作集合 |
| uncertain / quiescent | 当前状态是否有未知，以及在这次读取时已到达的操作是否静止 |
| scope / canCommit | 固定arrived-operations、false；当前观察不是来源提交许可 |

返回对象、明细数组和项均冻结；状态不变时复用同一快照。正常调用从现有claim加入记录，在settle所有收尾（包括媒体lease释放）后移除。closeSession直调和嵌套关闭也独立记录；因此pendingCount是**操作数**，不等于HTTP请求数。记录只含序号／种类／代次，不暴露路径、位置、PID／HWND、原始异常、源标题或命令文本。

一次stop可以替换当前ownership，但不能覆盖较旧仍在清理的记录。请求体尚未读完的start／restart也保留在集合中；旧stop回包的pending:false仍沿用旧含义，新接口不会据此误报静止。

有会话时，明确cleanup.closed:true与isClosed:true一致才能观察为closed。没有会话且从未关闭过运行时为absent，两者不混为同一种证明。读取自然结束的会话只更新观察缓存和修订，不把它从Host中删除；旧路径随后正常归档仍保持正确记录。

## 归档证明的负例

新增第28项先造出：会话cleanup.closed:true，但isClosed:false。新读取最初正确给出unconfirmed；随后旧status读取按既有规则归档该会话，早期观察实现仅凭cleanup记为closed，导致此负例失败。

修补仅约束新观察记录：归档时安全读取原会话的isClosed，并与**实际**cleanup同时确认；缺证明、异常或矛盾的归档使unverifiedRetirement锁存，之后不能靠“当前已无session”洗成absent／closed。读取isClosed异常不会向旧生命周期路径抛出新异常。

旧closeSession以及创建失败路径中的兼容fallback结果保持原样，但新记录使用fallback之前的实际cleanup；不能把补出的 `{closed:true}` 当作真实证明。旧停止／开始／重启的回包、错误分支与原取消规则保持。本轮没有借此修改旧归档策略或声称历史fallback根因已修复。

## 请求边界

这份观察只覆盖**已到达本次Host的操作**。测试保留明确反例：读取absent／quiescent:true后，再到达的旧格式start仍能正常开始。GET没有锁住Host，也没有给后续请求加意图栅栏；因此canCommit始终false。

Host重建、客户端重建、未到达Host的旧请求、网络未知或读取与提交之间的新动作，都不能仅靠一次快照排除。后续必须与前端命令记录、同轮身份和意图修订比对，并明确旧请求栅栏／拒绝未知的规则。revision不是单独的授权票据，不能保存一次空状态以后随时set none。

## 验证与证据

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-host-close-state-20261023-c8472b16`。

新增 `qa/wallpaper/close-state.test.mjs` 使用产品registerWallpaperRoutes／真实handler、ownership和取消代次，28项通过；包含新身份、缓存／冻结、GET只读、POST拒绝、挂起请求体、旧pending:false、并发拒绝、创建中、清理成功／失败／显式重试、自然结束、旧成功记录、新会话、异常／缺证明／矛盾归档、直调关闭、并发新owner先结束而旧操作仍等待、24项操作与16项明细截断、restart／卸载、修订ABA，以及未到达请求的边界。

其中一项启动自有回环HTTP服务器，实际fetch新GET并核对JSON／no-store／公共字段及体积，随后有界关闭连接和服务器。其余请求体／response为底层IO替身，会话factory、原生窗口与进程IO为替身；没有打开真实源、运行采集或操作DSH／WE。

| 最终分组 | 结果 | 父监督时间 |
| --- | --- | --- |
| host-state-final | 新28项通过 | 0.559秒 |
| host-routes-final | 原routes／session／cleanup-recovery-b／media-bridge共113项通过 | 17.560秒 |
| host-syntax | session.js语法通过 | 0.146秒 |

合计**141项测试通过**。原113项包含实际Host路由、真实createPreviewSession及媒体桥接文件系统／清理链，原生helper／子进程／窗口／CIM／ACL均沿用其IO替身，不将会话替身单测冒充原生执行。新运行器20秒单阶段截止／25秒收束；HTTP连接／关闭各有期限，所有受控挂起在finally中释放，自有进程退出确认。

原输入先运行新检查，接口不存在时失败；25项实现通过后补并发／明细上限检查至27项。第28项矛盾归档负例先失败，修补后最终28项及原113项均通过。初始报告／stdout／stderr保留，没有修改旧QA、放宽断言或重复同一输入求绿。

本轮客户端指纹与上轮完全相同，未重复694项前端／125项SDK、P2或节奏测试；它们是上轮结果，不作为新Host端原生／实机验收。历史snapshot400与Edge收尾超时仍未定因，本轮没有运行浏览器。

## 输入保护与下一步

开工267项既有输入中，仅 `src/wallpaper/session.js`变化，其余**266项保持**；新增28项QA。client、侧栏、全部旧QA、作者执行器、生成器、manifest／生产assets和官方冻结输入保持。session.js的改动限制在路由注册函数及randomUUID导入；原生createPreviewSession、窗口／worker清理实现、帧解析与其它模块逐字保持，详见change-audit.json。

下一小步：给前端增加**显式、有界、可取消的Host关闭状态读取**，严格解析、绑定本次engine／Host身份／命令与意图修订，拒绝旧回包、服务替换和未知。读取不发stop、不写偏好；先验证两侧状态组合，暂不把quiescent直接变成提交许可。随后才做零额外stop的来源提交及最小关闭入口。

本轮未构建打包、安装发布、操作日常DSH／WE、改Profile／版本／生产assets、提交推送清理、联系其它助手或恢复定时。日常DSH0.2.1-rc.2／rc.42／Git Bash0.1.1保持，开发manifest／生产assets仍rc.30；代码／路由测试不等于原生或视觉验收。


## 后续接续：前端有界读取完成

见[前端有界读取与同轮状态核验](WALLPAPER_NATIVE_HOST_CLOSE_READ_20261023.md)。显式有界GET与严格解析已进入开发client，绑定Host身份／命令／偏好／意图／主题事件，取消与迟到结果不发布；752项测试、119项完整SDK及P2／节奏离线通过。Host源码与本报告协议保持。两侧静止仍只是arrived-operations观察，canCommit仍false；下一步先明确旧请求／未知的提交约束和专用零额外stop提交，再接关闭入口。历史根因未定项及失败证据保持，不扩称实机通过。
