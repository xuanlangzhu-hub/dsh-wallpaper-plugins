# R8 诊断进展复审：未修复，先修探针和临时目录清理

2026-10-08。基线 `8193ba9` / rc.20。**没有 rc.21，src/client.js 无改动；此次交付不能按闪字修复通过。** DS 如实记录未建立可见失败循环，这个结论保留；自我反省中的具体错误可以作为排查记录，但不构成验收证据。

## 必须先修的检查问题

### D1 扫描的是输入框上方，不是用户报告的下方

`qa/scroll-clip-frames.mjs:268` 扫描 `card.top - 90 <= y < card.top`。当前记录 cardTop=552、cardBottom=672，所以报告中 516–526 与 540–550 的两行在卡片上方，原本允许显示。此区域像素不随裁剪改变，不能推出下方不会泄漏。

改为每个实际渲染帧的滚动视口/卡片坐标：卡片两侧从 cardTop 开始、卡片底部到 scrollport.bottom，另保留上方可见区作对照。不要按固定 x=200 判是否侧栏；当前夹具侧栏宽 160，x=180 已属于聊天列，必须用实际列边界。截图、scrollTop 和后面读到的几何不能算同一时刻；不能用 rAF 内的一次几何采样替代最终绘制像素。

### D2 每次 start 留下旧 RAF 循环，计数不是唯一渲染帧

`scroll-clip-frames.mjs:77-78` 的 tick 总会再次 requestAnimationFrame，stop 只切 recording=false。下一次 start 创建新 tick，旧 tick 同时看到 recording=true，后续第 n 段可以每帧采 n 次。当前“32/202、48/633 等帧数”是回调样本数，不能当真实帧数或比例。

start/stop 保存并取消唯一 request id，tick 在 recording=false 时不重排；记录浏览器 RAF timestamp/绘制帧 ID 去重。采样回调还可能位于裁剪更新回调之前，但后者仍在同一帧绘制前执行；因此“采到旧值”不等于“用户看见了一帧旧值”。重算全部数据，再用渲染帧/有效负对照证明可见闪字。

### D3 自动清理会删掉默认报告

scroll 脚本 283 行默认输出 `join(profile,'scroll.json')`，308 行 finally 又 removeProfile(profile)。pixels 的 result.json、regions 的 regions/supplement.json、sidebar-band 的 band.json 同样仍放在 profile 中。只有部分检查迁到仓库 .tmp，不能说所有证据已保留。

所有报告、截帧、时间线和错误记录先保存到浏览器 profile **外**的独立本轮目录，校验落盘后再清缓存；环境变量自定义输出也不能无声落到待删 profile 内。新增“默认运行后报告仍存在”与失败分支证据保留验证。

### D4 recursive rm 缺少所有权与路径边界

`qa/temp-profile.mjs:33` 对任意传入 directory 做 recursive rm，没有验证是否本次 createProfile 创建、是否位于解析后的系统 Temp、是否被换成符号链接/重解析点。当前调用多数使用受控变量，但这个新 helper 不能防止再次传错目录误删。

只接受本次创建登记的精确目录；验证解析后的绝对范围、拒绝 Temp 根/工作区/用户数据和未登记目录，检查重解析点；确认所属浏览器结束后再删。历史 708 目录不在本次所有权内，不批量清。对调用方误传路径要拒绝，而不是吞掉并返回成功。

本次仅用两个自行分配、验证位于 Temp 内的合成目录验证：一个 profile 内合成 report 被清掉；一个非 createProfile 登记的合成 sentinel 目录也被 helper 删除。没有拿真实工作区/旧证据/用户文件做删除实验。复现脚本见本轮 check-cleanup.mjs。

## 报告方向也要更正

已提取的官方 0.2.0-rc.2 `ConversationBody` 实际在同一个 scrollBody 中渲染 `[Views, composerSeat]`；常规 active 状态 composer sticky，不能把“消息独立滚动视口、composer 在外面”称为已经确认的官方真实结构。overlay/其它视图分支另行读实际代码，不凭猜想重构滚动容器，也不直接移动 React 管理节点。

getBoundingClientRect 保留元素布局盒，不说明 clip 后的可见区域；与 elementFromPoint 不同不是矛盾证据。将这两类信息区分后，再分析所谓固定行/裁剪有效性。

## 本次验证与结论

只读源码检查确认生产 client 未改；以 WM_KEEP_TEMP=1、输出到本轮独立目录运行诊断，观测到 80 个潜在裁剪滞后回调样本，但因 D1/D2 不能认定 80 个可见泄漏帧。没有操作 DSH/Profile/WE，没有运行新增清理去删除历史缓存。

证据：`F:\deepseekharness\.tmp\r8-diagnostic-review-20261008-135718`，含源码快照、scroll-observation.json/log、合成清理复现。新增 QA/清理改动暂不合并，原 DS 文件留在工作树供修正；只有本报告及接续文档提交。无需安装或实机重试。

下一轮 DS 先完成 D1–D4、修正报告中的层级和帧数说法，再建立真正“下方有文字”的旧版/延迟负对照。有效失败循环建立后才改实现、出 rc.21（若未占用）。不要继续写反省段落代替这个结果；不回退顶部/角点/侧栏，不添加宽黑罩，不扩大 GPU/闪窗任务。
