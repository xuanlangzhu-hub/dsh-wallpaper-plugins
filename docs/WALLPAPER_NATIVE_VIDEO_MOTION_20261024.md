# 原生侧栏：普通本地视频播放策略

2026-10-24，接续[普通本地视频入口](WALLPAPER_NATIVE_LOCAL_VIDEO_20261023.md)。仅为原生侧栏的普通本地视频接入既有motion“失焦暂停／始终播放”选项，未改变播放引擎、媒体存储、WE模式或原有暂停保护。源码及隔离SDK检查通过；未打包、安装或操作日常DSH／WE，未做用户桌面焦点切换／主观视觉验收。日常DSH0.2.1-rc.2／外观rc.42／Git Bash0.1.1保持，manifest／生产assets仍rc.30。

## 控件和实际行为

“本地视频”区域仅在当前来源确为video时显示“播放策略”选择框，跟随宿主字体、颜色和宽度。只有两个原有值：focus＝失焦暂停，always＝始终播放。改变选项即调用现有controller设置接口，没有保存／应用按钮，也没有新的成功说明段落。

无背景、图片、WE来源不展示此控件；旧事件即使仍持有handler，也不能为这些来源修改motion。没有当前会话、真实主题不匹配、旧设置页占用、来源操作处理中、活动身份／关闭状态不明或已有待清理时禁用并拒绝。未知motion不猜成默认值，显示不可用占位；非法值不能绕过原有枚举。

控件复读权威偏好；拒绝或抛错时显示关联控件的短错误。写入后抛错仍显示实际新值，不伪造回滚；重复相同值不重复调用setter。普通setting入口保持只接受数值范围，motion使用单独入口，不扩大通用setter的输入白名单。

复用原`createBackdrop.shouldPlay`：页面可见且系统未要求减少动态时，always忽略失焦，focus要求`document.hasFocus()`。页面隐藏或减少动态优先暂停，两种策略都不绕过。提示放在选择框title中，避免把“始终”误解为忽略这些保护。静音、循环和内联保持。

切换策略只更新现有视频节点的播放／暂停，不重新加载Blob、不新建video、不重开源窗口、不更改WE日常／预览或自动播放资格、不发WE start／stop／restart。

## 实现边界

只改`src/sidebar/native-appearance-sidebar.js`及生成client内对应块，新增`qa/native-sidebar-motion.test.mjs`。client在`WM_NATIVE_SIDEBAR`生成块之外与开工文件**逐字一致**，包括原来的媒体解码／背景load、motion执行器、存储、Host交接和作者块。前轮Preview资源修复保持。

新入口复用现有`controller.set('motion', value)`与权威snapshot，未改全局`persistSettings`吞存储异常的既有行为。正常存储路径已在真实IndexedDB／localStorage SDK中核对；当前控件值与运行时播放状态不单独证明存储故障时仍能跨重启保存，没有新增“已保存”承诺。若后续要覆盖全部外观持久化失败反馈，应另作最小修复，不能在本次控件迁入中隐去此限制。

## 验证

证据：`.tmp/native-video-motion-20261024-2583ed1a`，以`validation-summary.json`、两份SDK报告、保护指纹和`snapshot`为准。所有检查均有阶段与总期限、自有子进程退出检查。

| 范围 | 结果 |
| --- | --- |
| 新motion检查 | 18项：两个主题的合法值、所有未改字段、同值无重复写、非法／损坏值、只读controller、主题／会话／旧页／卸载、写前／写后异常、外部更新、来源切走、未知generation／活动身份／待清理、真实控制器媒体替换期间禁止改策略 |
| 合并回归 | **18新＋913旧＝931项通过，49阶段通过**；含图片／视频、安全关闭／启用、Preview资源、作者参数、预设、图库、主题和生成块／语法／CSS。有效阶段子进程用时合计21.543秒；全部确认退出，无超时 |
| motion实际SDK | `motion-sdk-report.json`，**19项通过**，7.777秒；沿用前轮13个真实文件选择／WebM解码／IndexedDB／移除恢复用例，增加6项策略与播放节点检查 |
| 既有实际SDK | `sdk-regression-report.json`，**111项通过**，24.694秒；原HTTP401／409及资源错误严格门禁保持，没有放宽白名单 |

SDK共**130项（19＋111）**。官方冻结SDK的真实renderer、会话／右侧栏服务、完整Whale apply、真实WebM解码器、DOM与localStorage运行；Host证明走真实路由，原生窗口／普通WE播放IO仍为明确替身，没有本机WE或采集操作。

新增SDK检查实际操作选择框，并核对：focus在受控失焦后同一视频暂停、播放位置90ms不推进；always立即恢复同一节点并正常写入motion，所有其它偏好保持；回focus再次暂停；受控页面隐藏优先于always；浏览器`prefers-reduced-motion`仿真优先暂停；恢复可见／减少动态设置或焦点后按策略恢复。比较video对象身份及URL计数，确认切换未重新加载，且没有新增关闭证明请求或WE命令。

**证据层级**：焦点与`document.hidden`由测试显式替换底层DOM读数并派发事件，减少动态用浏览器媒体仿真；视频play／pause、节点、存储和控件是真实的。这证明策略链路及保护条件，不冒充真实Windows切换窗口／最小化验收。素材为独立合成全年龄WebM，不访问用户素材；MP4逐codec及日常长期表现仍未覆盖。

两组页面清理后订阅、refs、pins、DOM及活动URL归零，URL创建／撤销分别13／13、11／11。自有headless Edge、server和桥接正常退出，未强杀、无后台等待。生成块外逐字断言及最终指纹均通过。

## 首轮负例与修正

首轮16项检查有两项失败，原`motion-unit.stdout.log`保留：

1. 一个产品边界：`canEditVideo`也允许无背景导入，因此不能直接作为“可改策略”的完整条件。初实现遗漏当前background必须为video，旧handler在none下仍进入setter。补上明确video来源条件后，无／图片／WE／未知来源均拒绝且零写入。
2. 一个夹具问题：首次标签关联断言从两次独立render取节点，桩`useId`每次递增，导致跨render ID不一致；改为同一树内比对label与select，未放宽标签关联断言。

修正后17项通过，再补真实媒体替换进行中的第18项；最终合并49阶段及两组SDK通过。没有重复运行相同失败输入、提高超时或放宽错误门禁。

## 输入保护与接续

开工280项保护输入与上一轮全部一致；只改原生侧栏模块及生成client，**278项保持**。新增motion QA1项，最终281项。`protected-before.json`／`protected-frozen.json`／`protected-after.json`绑定本轮；3个相关输入副本已存`snapshot`。Host、媒体事务、作者模块、旧QA、manifest、生产assets、旧候选与历史证据保持。

最终client SHA256：`5E0B48171C06CE5CB386947A31D8EAED10174F44B67620374902742D2D396FF3`。
原生侧栏 SHA256：`A6608E5A13BC706AF22108A33CE06E2EA704E25D6C33E78CA15626AC09A35F3D`。

下一小步先做一次简短的侧栏剩余动作／验收清单更新：区分已迁字段、低频动作不迁的决定、Lucy以外作者参数边界及首版候选应包含的范围，避免继续机械增加按钮。引用[旧入口盘点](WALLPAPER_NATIVE_REMAINING_ENTRIES_20261023.md)时以本轮及中间实现更新为准，旧“背景／motion尚缺”已是历史。暂不直接打包整个开发树、不安装或操作日常应用；候选与实机另按届时范围推进。历史15项缺QA EXE、旧挂起／失败、滚动A低优先级、三体／性能专项暂停等边界保持。未提交推送、清理、派发消息、操作其它助手或恢复定时。
