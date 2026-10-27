# 原生侧栏：首次目录确认与取消接入

2026-10-22，Codex。承接[播放主控交付](WALLPAPER_NATIVE_RIGHT_SIDEBAR_PLAYBACK_CONTROLS_20261022.md)。本轮只推进开发源码与隔离检查，日常DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1保持，未安装或采样日常环境。

## 已实现

从顶栏明确打开Whale原生侧栏后，若没有已确认目录，复用原engine的`readLibrary({ensure:true,signal})`读取；读取完成通过原library订阅更新标题与播放资格。无需先进入通用设置，也不再靠QA预置缓存才能验证首次路径。页面本身仍只含当前对象、播放主控及亮度/遮罩，尚未迁入完整图库。

| Before | After | Why |
| --- | --- | --- |
| 原生页依赖其它入口准备目录 | 明确打开时进行一次ensure读取，已有ready缓存直接复用 | 补齐首次打开路径 |
| 未加载时只有禁用提示 | 读取中有短状态；失败或取消后提供一个重试入口 | 避免无响应和无路可走 |
| 目录操作的取消尚未迁移 | 关闭最后可见页、折叠、切会话或provider撤回取消自己的读取 | 界面消失后不继续等待或回写旧结果 |
| 取消后普通读取仍可能写缓存 | engine对已取消的非refresh读取拒绝发布迟到成功或失败 | 防止旧回包污染共享缓存 |

正常成功不显示常驻成功文字。目录异常不禁用正在播放对象的停止/清理操作。内容分级仍默认Everyone，不请求缩略图、不自动选择、更换或开始播放壁纸。

## 生命周期与范围

- 明确打开或点击重试才发起读取，使用GET `/whale-wallpaper/library?ensure=1`，不发送`refresh`。render、订阅通知、可见性恢复、状态变化和折叠不自动扫描或重试。
- 本原生侧栏实例只有一个自己的在途读取和4秒期限；重复打开合并到该在途请求，ready缓存无请求/期限。其它入口已标记loading的刷新不被替换或取消。
- 超时取消自己的AbortController，释放在途槽位，显示短提示；请求失败/同步异常同样收束。不自动重试，需用户明确再开或重试。
- 使用真实`useTabInfo().tab.signal/visible`绑定页生命周期。两个页同时可见时，关闭其中一个不取消共享读取；最后可见页退出或所有页隐藏才取消。只重新展开时不偷偷读取，取消提示保留明确重试入口。
- provider撤回取消旧实例读取、释放视图/信号监听；provider恢复本身不读取，下一次明确点击打开才重新确认。旧Promise的finally不能清掉新请求的期限或错误。
- 不根据Promise返回值另造缓存或手动提升ready，实际资格仍读取原controller的权威缓存。HTTP失败即使携带loaded/ready也不作为成功。

单次在途规则限定本原生侧栏的读取，不声称统一了所有历史入口的普通读取。外部refresh仍保留自己的signal/生命周期。GET ensure可能按现有Host政策补齐目录，但本轮后端为夹具，未进行真实磁盘扫描或全部壁纸验证。

## 最小源码修改

证据：`F:\dsh-wallpaper-plugins\.tmp\native-sidebar-catalog-20261022-aeef0c47`。

1. `src/sidebar/native-appearance-sidebar.js`：有界目录协调器、明确打开/重试、缓存状态与页生命周期接线。
2. `src/client.js`：既有生成器更新的侧栏块；原`readLibrary`仅增加两个发布条件及一行说明。取消的普通ensure/cache读取不再发布迟到成功或abort失败；显式refresh分支行为本轮不改。
3. 两份既有侧栏/播放QA仅补React `useRef/useEffect`夹具能力，新增`qa/native-sidebar-catalog.test.mjs`。

`change-audit.json`绑定237项开工输入：上述4项既有输入变化，其余233项保持，新增目录QA单独指纹。精确去除生成块和readLibrary两处条件/注释后，client其余字节与开工快照完全一致。manifest/生产assets仍rc.30，归档、Host/原生采集/作者参数实现及Trace保持，不整体替换client。

| 最终输入 | SHA256 |
| --- | --- |
| client.js | `462AB4BF8F744BA4913477A685E34698DD9591A13411E32A3C5E21A250474BDB` |
| native-appearance-sidebar.js | `7A654D3F1546823566D451B3640D91714719CFFBE4E295552C689B61467A18DD` |
| native-sidebar-catalog.test.mjs | `ADEE1C649F6E768C4CE9A2879A4A9E3078B16F1B0B79B6AEAE94AE5A9EF10E43` |

## 验证与证据边界

`accepted-regressions-report.json`：目录专项21项、播放25项、侧栏20项、相关目录/旧UI/作者上下文49项，共115项通过；两个生成器一致性、3项语法和CSS guard通过。目录专项含15项协调器替身及6项实际engine/底层fetch替身回放：取消/超时后无新请求时的迟到成功、abort失败不覆盖已有缓存、新旧请求竞争、成功复用，以及外部refresh所有权。

`catalog-accepted-report.json`：完整Whale入口及真实SDK的26项流程通过。真实ModuleLoader/React/Cordis/槽位/layout/UiSession/rightbar/ThemeRuntime和正式桥接运行；底层会话/权限/壁纸HTTP仍为隔离夹具，不是真实DSH桌面或WE采集。

- 首次真实DOM点击顶栏，实际客户端engine发GET ensure并写入缓存，主控随之可用；未调用旧QA的seedLibrary。
- 初次成功后多次打开、重渲染/本地值变化不重复读取。取消后只展开也不读取，失败后点击明确重试才再次请求。
- SDK流程共记录11次GET ensure：6次ready、1次模拟失败、4次因折叠/关闭页/切会话/provider撤回取消。没有refresh或缩略图请求。
- 使用真实宿主signal/visible和React effect验证取消，不是仅直接调用cancel函数。迟到且忽略abort的底层情况由实际engine+fetch替身负例独立覆盖。
- 上轮播放与清理场景继续通过：1条start、2条stop均由明确操作产生，空stream只验证连接状态，无真实视频帧或壁纸效果。其它禁止的夹具服务调用为0，不把这个0误写成整个测试无HTTP命令。
- settings/status/library新增订阅、refs、pins、远端监听、DOM子节点及测试stream最终归零；自有浏览器退出、服务器和桥接关闭确认。实际SDK最终运行约3.24秒，未触发超时。

协调器4秒期限由虚拟时钟负例覆盖；QA有阶段期限、总期限和独立父监督（SDK45秒/收束51秒，回归每阶段20秒/总60秒）。本轮首轮与最终检查均通过；后续补上取消后重试入口及provider回放后形成accepted输入，旧输出保留，不无理由重复测试。

21项官方SDK快照和当前官方app.asar指纹核验保持。桥接[既有两条401](WALLPAPER_BRIDGE_BASELINE_401_FINDINGS_20261021.md)仍未修复，最终`cleanLog:false`；响应字段只接受既有固定负例，不隐藏新增错误或放宽鉴权。逻辑检查不代替实际视觉、源身份/退出及长期稳定验收。

## 下一小步

接“更换壁纸”的图库视图：先做目录卡片/搜索/分级筛选与明确选择，和当前播放对象分开。选择不自动开播或应用作者参数；缩略图按允许分级按需请求，不能先加载隐藏分级再遮挡。刷新、取消与迟到结果继续沿用有界规则，不把图库全量渲染混进首屏。

作者即时下发、更多界面项、独立窗互斥与整体视觉仍分别推进。开发侧栏继续是中间态；未来候选从固定归档独立整合，实际安装/短验另取当时方便确认。本轮未打包、安装、改日常Profile、提交推送清理、联系其它助手或恢复定时。
