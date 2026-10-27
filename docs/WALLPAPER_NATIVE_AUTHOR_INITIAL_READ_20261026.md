# 作者参数首次自动只读

2026-10-26。接续[作者区呈现整理](WALLPAPER_NATIVE_UI_POLISH_STEP3_20261026.md)。打开合格的正在播放壁纸详情时，作者参数自动读取一次；失败保留重试，不轮询、不自动下发。日常仍为DSH0.2.1-rc.3／Whalerc.48／GitBash0.1.2；未打包安装或操作日常DSH／WE，按用户要求最后集中看。

## 行为与范围

- 沿用既有Lucy作者参数资格：选中项与活动对象相符、目录／主题／分级／会话及代次有效，且不在忙碌或清理状态。新增自动入口还要求播放状态为playing、壁纸详情可见；界面页、图库、隐藏面板、停止／连接等待状态不自动读取。未开放其他壁纸作者参数。
- 同一有效上下文只自动尝试一次。读取成功后，重渲染、帮助弹层及壁纸／界面页往返不重复读取；手动读取也消耗本上下文的首次资格。真正切换选中对象或播放会话／代次后，新上下文可以重新读取。
- 复用现有串行读取通道与4秒逻辑期限。多个可见视图不重复发起；隐藏／切目标／停止会取消逻辑请求，迟到结果不能写回新上下文。底层尚未结束的读取仍占物理槽，不能因逻辑超时再开一条并发请求。
- 失败或取消后不因重新显示而自动重试。没有可用字段时显示“重试读取”，由用户显式重试；已有未完成编辑不被自动入口取消。
- 自动链路只调用schema GET，读取结构及本机记录，不调用draft／refresh-schema／discard／plan／apply。既有Host GET可建立内存记录／缓存；本轮没有改Host，也不把“只读”夸大成Host绝无内存变化。
- 干净旧记录若与新结构不符，自动入口显示“参数结构已变化，请手动重新读取以更新本机记录”，不会执行手动load原有的refresh-schema写入。显式重读仍保留原有更新语义。
- 同结构脏记录、旧结构待处理记录及not-sent／unknown／pending结果保持既有恢复范围和锁定语义，只展示，不自动清除、刷新或重放。读取不是WE实际参数回读；展示的值仍来自作者默认值或插件本机记录。

## 实现与边界核验

隔离工作／证据目录：`.tmp/ui-author-initial-read-20261026-a`。冻结318项已有源码、QA、脚本、生产资产及归档；提升前逐项确认共享输入未变。

本轮确实修改了作者控制器：新增ensureLoaded入口、上下文尝试标记、只读模式及旧结构阻挡分支；不能沿用上一步“控制器未变”的结论。UI仅新增可见／playing自动入口及失败重试名称。提升两个产品文件：`src/sidebar/native-appearance-sidebar.js`和同步生成的`src/client.js`；新增两份首次读取QA，并适配既有作者呈现SDK检查的自动读取预期。

原discard至控制器末尾的写入／编辑API逐字保持；四类复杂输入编辑组件整体逐字保持；client原生生成块外逐字保持。Host／adapter／资格投影、生产assets、manifest及版本未改，仍为开发rc.30。315项非允许既有输入保持，五份提升文件与已测隔离副本哈希一致。记录见`boundary-audit.json`、`promotion-verification.json`及`protected-before.json`。

日常rc.48安装目录仅做文件读取，与固定`release/plugins/dsh-whale-mist-0.6.0-rc.48.tgz`的43文件集合和哈希一致；没有写Profile、Local Storage、媒体缓存或运行设置。

## 验证

| 检查 | 结果／输出标签 | 证明范围 |
| --- | --- | --- |
| 相关单元回归 | 703／703，`initial-read-units-final`，约10秒 | 原685项加18项首次读取负例；无跳过或取消 |
| Windows官方rc.3 SDK联动 | 47／47，`focused-initial-read-windows-accepted`，约24.7秒 | 前序布局／菜单／分组36项及首次读取11项 |
| 新页面独立首次读取 | 11／11，`focused-initial-clean-windows-v1`，约9秒 | 不依赖前序UI用例产生的状态 |
| 新页面作者呈现回归 | 9／9，`focused-presentation-auto-windows-v1`，约4.8秒 | 来源帮助、原名、安全标签、编辑中重读、键盘／窄栏及名称单次切换 |
| 生成与静态检查 | 两个生成器check、npm run check通过 | 生成同步、JS语法、CSS模板guard |

SDK三组存在覆盖重合，不相加成67项独立覆盖。使用实际官方Windows SDK、产品client／控制器／Host路由；原生窗口、WE命令和元数据IO为明确替身。自动请求没有参数下发命令。测试包含选中其他对象再返回、双视图共享通道、超时物理槽、隐藏／停止后迟到、代次／ABA变化、错误响应、干净旧结构及脏记录恢复；单元用受控计时器验证取消与期限，SDK脚本有父进程45秒期限及51秒兜底。

负例有精确边界：一次schema响应被替换为损坏的HTTP200，必须进入重试状态且不循环；解除替身后显式重试走实际Host。另一次是测试主动编辑后，原生身份替身拒绝apply，产生唯一预期的POST409 author_target_unverified，以建立真实Host脏记录；随后自动读取不能再发POST或命令。它不是自动apply。既有bootstrap snapshot／disconnect的401单独按原有基线核验，没有笼统忽略HTTP错误。呈现专项中的两次切换只证明Mock命令与交互正确，不证明实际粒子效果。

三组均确认自有headless Edge退出、HTTP关闭、bridge断开、Host夹具释放；订阅／引用／DOM／活动URL为0。联动30／30、独立9／9、呈现4／4 URL全部回收，没有带消费者撤销。日志、精确请求、源码指纹、进程退出结果及清理统计均保留在上述目录，不删除先前过程输出。

[自动读取后的作者区](previews/author-initial-read-20261026/initial-read-ready.png)、[失败重试](previews/author-initial-read-20261026/initial-read-failure.png)、[旧记录恢复](previews/author-initial-read-20261026/initial-read-recovery.png)为隔离SDK及合成元数据示意，不是用户桌面或真实壁纸视觉验收。

## 下一小步

继续剩余UI呈现：先核对少量选项改分段控件、配色改色块的范围，再处理图库密度／分页和播放与选中标记、短标题及chevron一致性。分步保持原设置动作、未知状态与恢复边界，最后再固定候选集中看；不自动安装、推送清理、派发或开启定时任务。
