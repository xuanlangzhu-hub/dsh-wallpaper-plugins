# 原生侧栏：关闭背景与明确重新启用

2026-10-23，接续[专用关闭提交](WALLPAPER_NATIVE_BACKGROUND_CLOSE_COMMIT_20261023.md)。开发侧栏已接入成对的关闭／重新启用入口及反馈，源码离线范围通过，**尚未构建候选或在日常 DSH 验收**。日常 DSH0.2.1-rc.2／外观 rc.42／Git Bash0.1.1 保持；manifest／生产 assets 仍 rc.30。

## 本轮行为

- Wallpaper Engine 来源下提供次级“关闭背景”，原来的开始／停止主控保留。关闭先准备清理栅栏，最多再检查一次；只有当前 controller 的一次性许可才能同步提交 `background:none`。不额外发送普通 stop，不用全局重置代替关闭。
- Host 仍在清理时显示“检查关闭”，清理未确认时提供“重试关闭”。后续检查／重试必须再次点击，不轮询或自动补发；pending 时仍允许只读检查，不能把恢复入口禁用到无法继续。检查成功不等于保存成功。
- 无背景下原有启用按钮改接 `enableBackgroundSource`，不再调用旧 `set('background','wallpaper')`。冷启动先读真实 Host 静止证明；关闭后的重新启用先对当前 owner 明确 inspect／activate，再严格保存来源。保存本身不调用播放；保留已选壁纸、播放模式、自动播放选择及其它外观，仍需手动开始。
- 启用保存失败后，已确认的 activation 不会重复发。新点击重新读 Host 并核对本地 admission 后才重试保存。未知 activation 仍锁存不确定性，迟到成功不能被用来继续保存；不把 inspect 当成清除写未知的办法。
- 再次关闭已重新启用的来源会建立新一轮栅栏。保存会使旧观察变 stale，但不会抹去私有 released admission；不能因此永远检查已释放的旧 owner。

按钮以 disabled／aria-busy 和动作后的控件切换反馈，正常状态不增加协议说明。错误局部显示短句，不暴露路径、存储原文或原始异常。保存后抛错但回读确认时展示实际来源，并提示“设置已保存，请核对当前状态”；只有投影失败才提示显示更新未完成，不伪造回滚。

来源动作绑定当前可见 occurrence、会话和主题，持有独立的 AbortController；隐藏、卸载、会话／主题切换、旧页占用都会撤销未完成动作。显示→隐藏→重新显示也撤销旧点击票据。来源操作期间禁止重复来源动作及普通播放按钮；controller 继续核对偏好对象、选择／意图／主题修订，迟到结果不能覆盖新选择。

关闭与启用复用严格的单字段保存：先解析／比对当前存储，保留扩展字段，只写 background，精确回读；未确认写入保留本轮目标和上下文，仅新的明确检查可确认采用，不能重复写或猜测成功。保存／投影后的通知仍发布实际设置；重入的新设置优先。当前仍是单 controller 的已观察数据核对，不提供跨独立 renderer 的分布式 CAS。

## 验证与证据

独立证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-background-source-actions-20261023-72cbf92a`。首次失败、修正、最终输入和输出全部保留。

| 检查 | 结果与实际覆盖 |
| --- | --- |
| 新 controller 专项 | `background-source-enable.test.mjs` 20项：实际 ModuleLoader factory／apply／controller 和实际 Host handler，底层 DOM／storage／原生 session IO 为替身；包括冷启用、成对循环、带新 admission 手动 start／stop、保存故障、上下文变化、重入及超时／迟到响应 |
| 新侧栏成对交互 | `native-sidebar-background-actions.test.mjs` 14项：真实侧栏模块＋实际 controller／Host，React hook 为替身；包括 busy、防重、pending→检查、unconfirmed→明确重试、视图取消和反复关闭启用 |
| 旧来源策略 | 原21项保留策略场景，更新为等待异步专用启用接口、真实视图票据；controller 在这组中是明确替身，不以此组证明持久化或 Host 协议 |
| 最终回归 | `frozen-regressions-report.json`：45组、**34新＋815旧＝849项通过**，各组退出确认、无超时；合计子进程用时13.223秒。包含原24项关闭提交、39项前端栅栏及既有作者／布局／图库／预设／生成块／语法／CSS检查 |
| 原实际 SDK 回归 | `sdk-regression-frozen-report.json`：**111项通过**，父监督12.285秒。唯一有意调整的断言为来源为wallpaper时首屏按钮2→3，并严格要求新增关闭按钮恰为1；仍保留原HTTP负例白名单，未放宽错误门禁 |
| 新实际 SDK 交互 | `sdk-source-feedback-final-report.json`：**8项通过**，父监督2.293秒。官方冻结SDK／实际React渲染、UiSession、原生侧栏、实际完整客户端、实际localStorage及实际Host关闭路由；4 GET／13栅栏POST，prepare3、inspect7、activate3，Host代次最终3，普通播放／作者命令均0 |

本轮实际 SDK 共 **119项**。原111组的普通播放3次及作者IO为既有合成后端；新8组的关闭／重新启用使用真实Host路由，但 sessionFactory 明确禁止被调用，不能当作原生窗口或采集验收。真实带 admission 的 Host start／stop 由新增 controller 专项覆盖，原生 session IO 仍为替身。

SDK两组均正常关闭自有 Edge、loopback server、桥接及订阅，未使用强杀；页面清理计数归零。原111组 Object URL 创建／回收4／4，新组0／0。未启动或操作日常 DSH／WE，未读取壁纸私密预览。受控计时器注入验证超时后的状态机；真实父监督另有阶段／总截止，不能把前者宣称为真实原生耗时验证。

### 本轮发现与修正

1. pending Host 清理使侧栏把“检查关闭”一同禁用。实际侧栏＋Host 负例失败后，将只读检查与清理写动作的准入区分；检查仍须后端证明才能取得提交许可。未放宽提交门禁。
2. 实际 SDK 发现保存后的旧 released 观察变 stale，导致第二次关闭反复 inspect 而不开新轮。侧栏改用 engine 对私有 admission 的核验结果选择新 prepare；补了两个完整关闭／启用循环的实际 controller＋Host 回归。
3. 首次新 QA 缺少 React.useState 替身，以及 activation 取消注入订阅时机早于请求，分别修正夹具和底层响应注入；未以删断言或放宽实现取得通过。
4. SDK旧脚本自指文件名未同步，启动时缺 browser-test 输入；修正为其独立文件后，旧按钮数量断言因新增关闭按钮失败，按明确新增控件更新并保留该断言。没有增加超时或重跑相同输入碰运气。

历史15项缺QA EXE失败及先前超时仍保留，本轮没有新增相关二进制输入，不重复盲跑或将上述范围称为全仓绿灯。

## 输入保护

`protected-before.json` 的273项开工逐项一致。本轮旧输入仅改 client、原生侧栏模块、原21项来源QA，**270项保持**；新增来源fixture／controller专项／侧栏专项3项，最终276项。Host session、close-fence、原24项关闭提交QA、作者生成块、原生生成器、manifest及生产资产保持。client 的原生侧栏生成块已由原生成器同步并通过 `--check`。

最终 client SHA256：`68B57529AE1E028F0E0CC537A0B4FA9698C5BC8378303CB707E7BC938A6391AA`。
原生侧栏 SHA256：`1BA11E33C9D173196ABE15FE93CAE7C3A6C3C1814BBDEAA185CE5B75C2545907`。
完整指纹与冻结源码／QA在证据目录；提交推送、清理、派发、恢复定时均未执行。

## 下一小步

成对来源动作已落地，不继续加只读层或扩展关闭协议。接下来按[剩余入口盘点](WALLPAPER_NATIVE_REMAINING_ENTRIES_20261023.md)补**最小本地图片入口**：先核对既有媒体存储／导入／移除与安全来源交接，再实现单项图片选择及移除，保持WE图库与本地媒体分开。普通视频及motion策略后续另一步；全局reset、独立窗迁移、整体视觉布局和非Lucy作者参数不同时展开。

旧通用设置的来源setter／import／reset仍保留兼容路径，不宣称所有来源入口均已迁移。当前结果不自动授权候选打包、安装或真实窗口验收。
