# A2 壁纸选择复审：4 项返工，暂不安装

2026-10-11，Codex。审查 DS 的 A2 源码与 dsh-whale-mist/docs/WALLPAPER_SELECTION_DELIVERY.md。
结论：**现有检查通过，但独立复现确认 F1–F4，不进入候选打包/实机。** 保留现有实现，局部修正后再交审查。

## 已确认的基础

- npm run check 通过；catalog 16/16、Host 69/69 复跑通过。
- 独立 Cordis SDK 组成检查通过，使用当前检出与隔离标志，没有连接日常 DSH 或创建真实壁纸窗口。
- 列表快照、刷新合并、Host ID 解析、当前播放/下一次选择分离、未验证项手动实验等结构已有。
- 本轮只做审查、fixture 和文档；没有改产品源码、版本、包或 Profile，没有安装、提交、推送。

## F1：首次进入没有加载壁纸库（P2）

位置：src/client.js:1633、src/wallpaper/session.js 的 library GET 分支。
设置挂载仅 loadLibrary(false) → GET cached list，而库初始化没有任何首次扫描。
独立运行真实设置函数的挂载效果并调用真实 route：扫描次数 0，loaded=false，列表只有前端补出的 Lucy。
用户必须自己猜到先点刷新，才能看到已经存在的其它壁纸；交付中的「列表加载」断言实际验证了未加载的空缓存。

修正：首次打开 WE 区域时按需完成一次有界加载。可由 Host 提供 ensureLoaded，或者客户端在未加载时请求首次刷新；
并发仍合并，状态轮询/render 不扫描，已有快照重开区域不重复扫描。缺根/失败明确显示，读取成功不能永远停在未加载空态。
添加真实初次挂载→route→scan→返回列表的行为断言，再重开/轮询确认不重复扫描。GET 是否扫描的旧断言应围绕新的明确契约修改。

## F2：新壁纸仍被 Lucy 文件存在性阻塞（P2）

位置：src/wallpaper/session.js:483、570，probeAvailability:42–49。
两处仍用默认 SCENES（仅 Lucy）判定整个播放服务可用，没有使用所选目录记录。
独立 fixture 有完整第二张 scene，refresh/list 显示 available=true；仅把 exists(Lucy) 设为 false，启动立刻返回
409 / wallpaper engine preview is unavailable: scene，session 创建次数 0。
用户取消订阅 Lucy 时，其它完整场景全不能用，与多壁纸选择目标相冲突。

修正：把平台/Host/helper 就绪与具体选择的文件可用性分开。非 Lucy 用其受限记录复核，Lucy 用原样例校验；
status 不再以唯一样例缺失否定整个库。保持缺 helper 等原错误，不能直接删除所有检查。
新增「Lucy 缺失但第二张完整 scene 可启动」和「第二张缺失拒绝、Lucy 独立可启动」的 route 到最终 mock helper 行为回归。

## F3：已显示不可用警告，但开始/重启仍可点（P2）

位置：src/client.js:2138–2143；runPreview 也没有选择可用性保护。
独立设置树注入一个 available=false 的已存选择：出现「所选壁纸已不可用」，但 start.disabled=false、
restart.disabled=false；调用按钮确实向 controller 发出了 restart。
现有 UI 测试还要求三个按钮表达式均不能出现 library/loading，掩盖了应保护开始/重启的条件。
重启路由先关旧源，再验证新项；选中项失效时这样会让可用的旧背景被无意义关闭。

修正：开始/重新开始需要已确认有效的选择，必要时在 action 层再防护；缺项/不可用/尚未知不能提交切换。
**停止/重试清理独立于库状态**，加载/失败/所选项失效都不能封锁停止。刷新期间旧有效选择可保持使用，
不要把所有按钮粗暴禁用。添加实际点击无 helper/controller 启动调用、旧播放不因无效切换被关闭的检查；
同时确认有效 B 选择能显式重启，停止在每一种列表状态下仍可操作。

## F4：启动前复核放宽了越界声明（P1）

位置：src/wallpaper/catalog.js:156–159，verifyCatalogEntry。
localParts(data.file) 对 ../、绝对路径、ADS 等都抛 unsafe_path；新 catch 把 scene 的该错误一律转成 declared=null，
然后改用 scene.pkg。它混淆了「合法相对文件缺失」与「声明本身不安全」。
独立 fixture 首先正常登记，之后把 file 改成 ../outside.scene：verifyCatalogEntry 没有拒绝，仍返回项目供启动。
没有启动 WE；因此证据只说明校验被绕过，不声称真实 WE 已读取越界资产。

修正：只有**合法相对声明解析成功，但实际文件 ENOENT** 才能走既有 scene.pkg 回退；
unsafe_path/link_refused 等必须拒绝，不能通过包回退掩盖。保持原 catalog 与新启动前复核相同边界，
重新判定不可用记录（例如危险 preview）时也不能因为存在 scene.pkg 就把它升级成 available=true。
新增「扫描后 metadata 改成 ../、绝对路径、ADS/坏声明」拒绝且零启动调用；
「合法 scene.json 缺失但 scene.pkg 存在」仍通过。不要靠缓存 available 字段掩盖文件变更。

## 证据与验证范围

本轮独立目录：F:/dsh-wallpaper-plugins/.tmp/selection-review-20261011-092147。

- repro.mjs：生产设置函数的元素树/持久 hook 槽位，加实际库/route 和 fixture。无真实 React 调度、官方布局或 WE 渲染证明。
- findings.json：F1–F4 的独立观测；运行后四项都复现，退出 0 表示该复现脚本准确捕获预期缺陷，不表示产品通过。
- sdk-contract.json：独立 SDK 组成结果。
- 复跑 fixture 输出：catalog-check-KgugPN、Temp/wm-library-9D5VXE、Temp/wm-ui-library-JJ0hhL，全部保留。

运行独立例子（仓库根）：node .tmp/selection-review-20261011-092147/repro.mjs。
该目录包含本轮 fixture；重新运行会重写**本轮例子的** fixture/输出，DS 返工应复制到全新目录，勿覆盖原证据。

## DS 下一轮范围

只局部修 F1–F4：catalog/library/scenes/session/client 中必要部分、相应检查和交付文档。
UI 的 9 项新检查主要是源码表达式/字符串断言，不能替代有状态加载/点击/route 整合；本轮补正确行为接缝，
不把 fixture 的立刻 effect cleanup 当真实挂载/异步更新。不要继续扩测试框架或只改断言让它变绿。

无需重做 GPU、R8、35分钟或其它产品阶段。完成后跑登记、check、Host 和新行为回归，只有相关样式改动才追加布局检查。
完整交付记录的任务链接应改指向根 docs/DS_NEXT_WALLPAPER_SELECTION.md（当前同目录相对链接不存在）。
保留日常 rc.24、所有活动 tgz、Profile/原 WE/官方 EXE；不改版本、打包、安装、开真实窗口、提交推送。
完成后提供简短修正与检查结果，再交 Codex 审查。
