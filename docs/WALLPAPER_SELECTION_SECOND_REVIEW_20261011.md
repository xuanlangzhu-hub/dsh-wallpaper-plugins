# A2 第二轮复审：只补 R1/R2，暂不安装

2026-10-11，Codex。前轮 F1–F4 的主体修正已读；check、登记16/16、Host77/77、隔离SDK组成复跑通过。
独立例子确认首次 ensure 加载只扫描一次、缺 Lucy 时其它完整 scene 能启动、不安全声明拒绝且合法包回退保留。
F3 对已列出不可用项/非空列表缺项已有按钮与 action 双保护。**尚有两个已复现边界，不进入安装。**
这不是要求重做已完成部分；只局部补下面 R1/R2。

## R1（P1）：重启预检没有操作归属，停止/卸载后仍重新启动

位置：dsh-whale-mist/src/wallpaper/session.js:743–761。
新 restart 分支在 readJsonBody 和 await verifySelection(body) 之前没有 claim，也没有保存/检查该次请求的 generation。
它仅在函数入口查过 ownership。等预检结束，又调用 stopNow 并用当时最新 generation 新 claim('start')，
因此停止/卸载期间产生的取消记录被遗忘，迟到的旧请求获得了新的有效归属。

独立复现使用真实 route，慢 verifyScene 和 fake sessions：

| 顺序 | 实际结果 |
| --- | --- |
| Lucy播放→restart预检等待→用户stop成功→放行预检 | 旧会话已关，但迟到restart返回200，新会话创建，active=true |
| Lucy播放→restart预检等待→执行插件dispose→放行预检 | dispose已关旧会话，但迟到restart同样创建新会话并返回200 |

预检等待时 api.ownership() 均为 null。没有打开真实源窗口；这是生产 route 的隔离生命周期证据。
实际场景中停止、切换背景或停用插件都应取消待完成重启，不能在清理结束后另开源。

修正要求：

- restart 在读取 body **之前**取得归属，归属覆盖读body→验证下一项→关闭旧项→创建新项。
- 每个异步边界检查原请求仍有效。外部stop/dispose取消后晚结果直接拒绝，不允许为旧请求另取最新 generation 并启动。
- 内部关闭旧项必须与该操作的 token 衔接，不能因复用stopNow而把取消状态冲掉；也不要自等待自身promise导致死锁。
- 保留「新项无效不关闭旧画面」和「旧项清理未确认不创建新源」。start/restart并发应有界拒绝，不能预检期间放进另一个切换操作。
- 新增慢restart预检期间stop、dispose，以及读body期间取消/两个restart并发的行为检查。
  外部stop/dispose完成后，放行旧请求不能增加create/helper调用；正常restart仍可完成。
- 本次传入preVerified在startWithToken里又被无条件覆盖；若保留两次校验请明确用途，别写“复用”却实际未使用。

## R2（P2）：空列表/未加载时仍把未知选择当可用

位置：dsh-whale-mist/src/client.js:2069、2074。
selectionUsable 在找不到所选项时，用 loaded && items.length>0 才返回false；
所以已经扫描完且空库、目录不可用、或者首次加载尚未确认时，都把未知catalog ID当作可用。
selectionKnownUnusable同样只在非空列表才给缺项警告。空库正是订阅全被移除/库盘暂时不在时常见的状态。

独立执行生产设置组件及实际按钮回调（合法存储ID，不在列表）：

| 状态 | 开始/重启disabled | 缺项警告 | 点击开始的controller调用 |
| --- | --- | --- | --- |
| 初始未加载 | false / false | 无 | 已发出 |
| 已加载、空列表 | false / false | 无 | 已发出 |
| 已加载、非空但缺所选项 | true / true | 有 | 未发出 |
| 已列出不可用项 | true / true | 有 | 未发出 |

后两种已修，不需要重复返工。前两种尚未满足“开始需要已确认有效选择”。
现有ui-library测试还把 null+loaded=false 应为true当作期望，需要修正契约而不是维持这一错误。

修正要求：

- catalog ID 尚未确认存在/available=true时，禁用开始/重启，action层也不提交；显示“正在加载/等待确认”，不用在初始加载就误报删除。
- loaded=true却找不到项时，无论列表是否为空都显示“所选壁纸已不可用”并禁用开始/重启。
- 刷新期间可继续使用已确认可用的旧记录，别因为loading就把已知选择粗暴失效；Lucy按其实际样例可用状态单独处理。
- 停止/重试清理仍独立于库健康状态，已运行/清理失败时保持可用。
- 用实际设置树/事件补空库、未加载、失败、刷新保留旧有效项的回归，不只匹配selectionUsable字符串存在。

## 证据与本轮边界

独立目录：F:/dsh-wallpaper-plugins/.tmp/selection-rereview-20261011-093750。
review.mjs / results.json 记录已修项及 R1/R2；sdk-contract.json记录隔离组成检查。
元素树检查不模拟真实React调度/官方CSS；fake session不构成真实WE出帧或清理验收。
复跑登记证据为 .tmp/catalog-check-EL00Cc；Host/UI fixture输出均保留。

只新增审查脚本/fixture/文档，产品源码未修改，没有打包、安装、连接运行中的DSH、开真实壁纸窗口或提交推送。
日常rc.24活动tgz指纹另记source-hashes.json；仍不得覆盖或自动恢复旧Profile。

## DS 接续

只修R1/R2，保留F1/F2/F4与其它已验行为。完成后交付简短修正、命令、结果与新证据目录，
跑catalog、check、Host及新增竞态/UI行为检查；SDK路由改动用新输出文件复核。
不改版本、不打包、不安装、不开窗、不碰原WE/官方EXE/Profile，不展开任务栏隐藏/完整选择器/GPU/R8。
