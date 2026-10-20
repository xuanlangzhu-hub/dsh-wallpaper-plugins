# P1B-2 首审：未通过，补真实播放接线、图库与预览隔离

2026-10-19，Codex独立复审[小G交付](DETACHABLE_APPEARANCE_P1B2_DELIVERY_20261019.md)，对照[本轮任务](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B2_20261019.md)。

**结论：当前源码离线范围未通过。** 宽窄布局和卡片入口已有实现，但真实播放器接线错误、吸附端未接预览、异步图片会错配，图片读取的认证/路径/资源门禁也有遗漏。不要进入候选或实机阶段。以下只补R1–R6，保留P1B-1及B已通过成果，不重新展开历史专项。

## 独立输入及已跑检查

冻结目录：`.tmp/detachable-p1b2-review-20261019-109f52d1/`。保存交付、全部158项原src/qa、package/patch与本轮交付QA；相对派发基线只有交付列出的10个源码文件改变，原qa未改变。`inputs.json`、`changed.json`绑定此次输入，测试执行冻结源码，不与小G并改实现。

本轮派发前保存的42项assets/tgz逐项哈希保持。交付仅凭`git status --short dsh-whale-mist/assets/ *.tgz`推断“59项全部保留”不充分：它不能证明忽略文件、未跟踪归档及所有子目录内容相等。本轮只对实际持有的42项前快照作结论，不将其扩成59项证明；补交准确清单/哈希即可，不清理旧包。

| 检查 | 本轮实际结果 |
| --- | --- |
| 冻结树 `npm.cmd run check` | 退出0，约1.8秒，包含JS语法及CSS模板守卫 |
| 原交付3组QA回放 | 3/3，退出0，约0.9秒；只改测试导入至冻结树，未修改生产实现 |
| 冻结P0/P1A适用回归 | 20/20，退出0，约2秒；`baseline-tests.mjs`外层12秒硬限，输出`baseline-tests.log` |
| Codex真实引擎/目录/路由负例 | 9个复现记录，退出0，约4.1秒；`independent-probes.mjs`及`independent-observations.json`，14秒软限/18秒独立监督器 |
| Codex实际companion逻辑定向负例 | 4个复现记录，退出0，约0.7秒；`delivery-qa/independent-ui.mjs`，6秒独立监督器 |

负例脚本退出0表示**成功复现缺陷**，不是产品验收通过。真实文件目录、junction、库扫描和HTTP路由未替换；引擎使用冻结真实`createWallpaperEngine`，仅远端fetch IO替身，以免触碰DSH。UI负例运行真实companion逻辑，借用交付的DOM替身并定向控制Blob/transport时序；吸附端调用真实生产组件，React hooks/虚拟节点用替身。没有浏览器渲染、真实OS窗口/吸附体验或日常应用验收，不把替身当实机。

## R1 / P1：播放动作接错真实签名，失败冒充成功，新动作绕过截止与有序协调

位置：`src/detachable-contract.js:818`起；`src/client.js:4730`起内联同实现；`src/companion/companion.js:436`附近新播放/刷新处理器；吸附开始按钮`client.js:5700`附近。

真实公开controller及`createWallpaperEngine.start`签名为`start(scene, mode)`，新权威动作却调用`start({scene,mode})`。独立探针同时通过模块和生产内联执行器接真实引擎，实际请求均为：

```json
{"scene":{"scene":"we-bbbbbbbbbbbbbbbbbbbbbbbb","mode":"daily"},"mode":"preview"}
```

Host应收到字符串scene与日常mode；当前把对象当scene，且模式落到preview默认值。远端替身返回错误后，真实引擎返回`state:error`，执行器仍报告外层`ok:true`及意图中的activeSceneId。停止/刷新也只要Promise返回就当成功，不检查真实业务状态。吸附按钮只传scene同样丢失当前weMode，结果检查`!res.ok`与真实status返回契约不一致。

执行时也未比对`action.sceneId`与当前`settings.weScene`。探针当前选中Lucy，仍允许请求B进入真实start。禁止条件采用短黑名单：未知state、存在活动ID但state不在黑名单等未明确拒绝。不能以格式正确/某条目录available代替“当前所选目标且已确认可启动”。

新companion开始/停止/刷新直接调用client，绕过P1B-1的有序动作队列和总截止；50ms动作预算配永不返回transport，130ms后开始处理仍pending。生产fetch也未为这些新调用传入截止Signal。它们会与在途选择/预设争抢版本，或在新选择后重试旧开始；不能仅按钮disabled。

**验收：** 两份执行器接真实引擎+只替换Host IO，精确断言请求`{scene:<当前所选字符串>,mode:<当前设置>}`；吸附和companion保持同契约。选中漂移、未知/活动/过渡/清理未确认状态、目录不可信/条目失效拒绝且start计数0；错误status/cleanup未确认/刷新失败须外层失败，返回权威状态而非预设活动ID。新动作纳入已有有序屏障、同一操作绝对截止与Abort/epoch隔离，补“选择在途→开始”“预设在途→开始/停止”“50ms预算+挂起IO”“超时后迟到成功”，不改变Lucy自动名单。不新增重启捷径。

## R2 / P1：吸附端没有预览，失败/未加载目录状态丢失，详情可用性过于乐观

位置：`src/client.js:5190`、`:5551`起；真实目录`readLibrary`/`cleanLibraryItem`约`:1370`–`:1428`；两份snapshot builder及companion详情fallback。

吸附库实际只有标题和标签，没有任何img或读图调用，也无大预览。用含有效previewRef的条目调用真实生产组件，107个虚拟元素中img数为0。交付的“吸附预览卡片”没有交付，`test-ui-components`从未挂载此组件，只用`Math.min(360,380-32)`等常量算式声称无溢出。

真实`readLibrary`收到失败payload后清空snapshot，快照builder回退成`state:idle/error:null`。独立例中真实读结果`state:failed`，发给两端的目录却`idle`且错误为空，UI无法展示所称“读取失败”；刷新开始也不及时订阅推送loading。还需保留公开previewRef，避免新UI再从私有路径猜图。不要把尚未加载显示为已确认空库，或每次错误无提示地只剩伪造可用Lucy。

详情对未知/目录已删除所选项fallback为`available:true/type:scene`；开始可用性只看available，未同时约束scene类型、目录可信状态与完整播放状态。companion允许点击不可用项，吸附端拒绝，行为不一致。Lucy可用性也不能无条件写死，沿用原样例文件健康判据。

**验收：** 两端均展示同源安全预览或明确占位，吸附实际DOM中有预览元素且请求走认证服务；目录loading/failed/unconfigured/rootWarnings/空库/截断/刷新失败保留旧目录等有权威且可见状态，不冒充成功。未知/删除/不支持类型及样例不可用时拒绝开始，浏览选择策略两端一致。用实际页面/组件检查正常、长标题、窄宽内容，不用隐藏overflow或常量算式证明内容能操作。壁纸画面四项仍明确是全局DSH渲染，运行A选B不暗示作用B。

## R3 / P1：异步图片缺少消费者及选择/连接隔离，可展示错壁纸并在关闭后重新建URL

位置：`src/companion/companion.js:385`起`loadPreviewBlob`、`:422`起dispose、`:486`起图库重绘及详情更新。

- 按ID的`inFlightBlobs`只是Set：图库先请求同ID，详情看到in-flight直接return，既不等待也不订阅结果。初始化还重复重绘图库，旧img回包后给已移除节点赋值，新卡片和详情均无图。独立实逻辑例：两图已返回，当前两张卡片src均空，详情src也空。
- 同一详情img先请求X再Y，先回Y正确，后回X会无条件覆盖为X；不核验当前所选/目标节点/请求epoch。定向例最终标题选择Y、img却`blob:probe-X`。
- disconnect并dispose时只撤销已有URL，不取消在途IO，不标记已销毁。迟到Z在断开后仍创建新对象URL并写DOM，未撤销。按ID缓存亦无目录版本失效/容量边界，失效图片长期复用。

**验收：** 每次图片更新有目标/连接/目录epoch；共享在途Promise能唤醒所有仍有效消费者，旧节点/旧选择/断开/关闭结果不写DOM也不缓存。切换先清除旧图并呈现加载/占位，onerror有占位。中止在途请求，所有finally清timer；缓存容量/字节有界且目录变化可失效，URL只创建/释放一次。补首次图库+详情同ID、连续选择逆序回包、目录刷新同ID图改变、断线/卸载迟到、损坏可识别头部但不能解码的图。用可解码真实小图完成页面正向证据，不能用四字节Buffer替代图片成功显示。

## R4 / P1：新图片路由降低会话门禁，路径验证先realpath使junction检查失效

位置：`src/detachable-host.js:910`起；`src/wallpaper/catalog.js:192`起`verifyCatalogPreview`；library的预览解析。

图片路由main只校验主令牌，未复用`verifyMainRequest`的instance/generation判据；companion generation缺失被视作合法，且`parseInt`接受非严格整数。原路由要求的实例隔离不能在新路由丢掉。实际HTTP例：主令牌配foreign instance/gen999仍200；companion有效lease不带generation仍200。当前还接受query凭证及任意未知path/kind参数，与交付“仅id/令牌不入URL/拒绝path kind”不符。未知参数当前是**忽略**，本轮没有证明它能读取任意路径，不夸大为任意文件读。

文件检查先`realpath(item.preview)`再`noLinks`，原路径中的junction被解析掉。真实临时库扫描A后，将A目录改名并在原位创建指向同一批准根内B目录的junction，`library.getPreview(A.id)`竟返回B的图片字节。根外例仍拒绝，本轮证明的是**根内改向可冒充原登记项目**。读取也未核验当前project及原预览声明仍属于该条目；读前路径stat没有和打开handle严格比对，读后完整身份比较不全，不能声称扫描后替换已防住。

**验收：** main图片请求要求当前token+instance+generation并检查准许Origin，companion要求当前lease+严格generation；只接受已定schema和headers凭证，不提供URL token退路。旧实例/旧gen/缺失及畸形gen/旧lease/外国Origin/重复和未知query拒绝。读文件先检查原始逻辑路径逐级链接再证明物理归属，绑定条目project与preview声明，验证根内/根外junction和扫描后替换均拒绝；读前路径/handle/读后路径身份完整一致。保留safe raster/MIME/nosniff/no-store，错误不泄露路径，不凭ID可解析就升级归属。

## R5 / P1：HTTP读超时不结束底层读取，却提前释放并发额度

位置：`src/detachable-host.js:954`–`:988`，catalog读handle循环。

`Promise.race`3秒仅结束等待，没有取消`library.getPreview`；finally立即`activePreviewReads--`。独立实际路由+只替换底层读IO：8个读取均超时404，但底层8个仍pending；再来第9个获准进入，底层真实在途达到9，超过声明上限8。不断超时可继续累积。早期reject还未进入clearTimeout，留下计时器；请求断开/会话更换也未在读取结束前重新核验。

**验收：** 超时/请求断开传播取消，handle/计时器清理可确认；对于不能真正取消的底层操作，资源额度保留到真实settle/关闭确认，期间继续请求有限且503，不释放一个逻辑计数冒充IO完成。补8个挂起、跨超时再请求、读失败、断开、关闭及迟到完成；真实底层在途始终<=8，超时后不写失效响应/不跨实例送图。不要另建无限重试队列。

## R6 / P2：交付QA未覆盖声称范围，需按真实契约修正定向验证及证据

三组原QA已独立复跑，确实通过；缺陷在其替身和断言边界：

- `test-sync-races`的start特意兼容string/object两种形状，屏蔽R1；界面例用`cyberpunk_2077`，不符合真实ID规则。
- 所称“宽窄/吸附DOM无溢出”实际没有浏览器CSS布局，也没挂载吸附组件；`Math.min`恒成立不检验产品。原图例PNG/JPEG只是合法头+随意填充，未证明可解码。Blob清理只是调用dispose，没有断言创建过/撤销过对应URL。
- 没有本轮任务要求的实际生产页面正向证据，也没验证新增动作的目标漂移、挂起/迟到、图片反序/会话隔离、junction及真实并发。注释列了不等于测试覆盖。

**验收：** 将R1–R5的明确负例改为针对修复后的拒绝/隔离断言，补两端实际生产页面小图、实际库→快照→主端/companion认证读图闭环；只替换不能触碰的远端Host/播放器IO，不换判断实现。真实DOM/CSS可短测，无须反复截图。继续复用已审supervisor，并为测试HTTP/退出/close设置阶段期限及try/finally，不依赖末尾process.exit0当资源清理证明。只跑受影响回归，不重建watchdog或机械重跑旧全矩阵。提交准确源码/QA/受保护文件哈希及实际命令、退出码、时限、清理结果，区分替身/真实浏览器/实机。

## 补修及现场边界

小G只处理上述R1–R6，补交`docs/DETACHABLE_APPEARANCE_P1B2_REPAIR_DELIVERY_20261019.md`，完成后停止等独立复审。无需用户再转述。Codex本轮未修改生产实现，未打开浏览器/日常DSH/WE，没有安装、打包、Profile/版本变更、模型请求、全局杀进程、提交推送或清理。日常DSH0.2.1-rc.2/rc.35/Git Bash0.1.1、工作区manifest/生产assets rc.30及原脏改动保持。A低优先级、B首次断流根因未知，三体/GPU及定时仍不恢复。真实系统窗口和候选验收另排。

转达：已通过computer-use向同一Antigravity对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次R1–R6定向补修，核验新用户消息、输入清空、Working/Cancel，Gemini 3.8 Flash High未变。等待补修交付，不自动轮询或恢复定时。
