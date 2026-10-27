# 原生右侧栏：开发源码最小整合与完整入口隔离复核

2026-10-21，Codex。承接[实际SDK装载复核](WALLPAPER_NATIVE_RIGHT_SIDEBAR_SDK_REVIEW_20261021.md)及[用户改版要求](WALLPAPER_SETTINGS_SIDEBAR_REQUIREMENTS_20261021.md)。本轮完成只读侧栏的开发源码整合；未打包、安装或操作日常DSH/WE。

## 结论

**顶栏Whale入口已改接宿主原生右侧栏，整个Whale `apply`在实际SDK隔离环境中执行，12项主流程检查通过。** 新增10项适配器检查、49项相关回归和生成/语法/CSS检查通过。桥接日志有两条与修改前入口完全一致的401，另立[问题记录](WALLPAPER_BRIDGE_BASELINE_401_FINDINGS_20261021.md)，不称日志全绿或问题已修复。

当前正文仅显示当前壁纸、播放状态和亮度，无编辑控件。旧浮层不再作为本开发入口注册；旧组件实现/导出和独立窗链路保留，尚未完成可编辑侧栏、弹出互斥、主题透明度视觉或即时作者参数改版。日常仍为DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1，本轮未刷新日常运行状态。

## 实际修改

| 文件 | 作用 |
| --- | --- |
| `dsh-whale-mist/src/sidebar/native-appearance-sidebar.js` | 从已验证原型提升只读适配器；增加可选依赖子模块，复用原有唯一控制器 |
| `dsh-whale-mist/scripts/build-native-sidebar.mjs` | 将单一ESM实现嵌入ModuleLoader客户端，支持`--check`，避免维护两份实现 |
| `dsh-whale-mist/src/client.js` | 嵌入适配器、绑定原控制器、替换顶栏注册、删除旧`shell.overlay`注册 |
| `dsh-whale-mist/qa/native-sidebar.test.mjs` | 新增缺服务/无会话/迟到回调/循环重载/部分失败回滚/生成一致性检查 |

根`inject`仍为`theme/slots`。右侧栏服务通过`ctx.inject(['sidebarRightTabs','sidebarRight'], ...)`只控制一个子模块；服务撤回时禁用入口并释放侧栏资源，不卸载主题或播放器。服务恢复仍使用原控制器，不创建第二份播放器。没有服务或会话时不退回浮层、不开独立窗、不创建会话。

正文以缓存快照读取状态，不扫描图库、不请求预览、不发播放/停止/属性命令。标题遵守既有内容分级；本轮不扩大默认Everyone预览范围。关闭页签仅结束视图生命周期，不等于停止壁纸。

## 实际SDK隔离复核

证据：`F:\dsh-wallpaper-plugins\.tmp\native-sidebar-integration-20261021-1c97d523`。

- 官方模块沿用上一轮21项指纹提取件；本轮另外使用当前官方归档的真实ThemeRuntime，`theme-client.js` SHA256为`4A6C83650C063F639FF468D766C794C82998C411FFB7DCC7EBB282E1F61923D0`。
- 运行真实ModuleLoader、官方平台种子React/ReactDOM/Cordis/槽位/dockkit、renderer、layout、UiSession、sidebar-right及ThemeRuntime。共享开发`client.js`完整`apply`执行；不是只截取适配器函数，也不是用替身右侧栏API替代宿主。
- 使用真实`createDetachableHttpHost`及正式注册/snapshot/SSE/disconnect路由，独立本机端口和测试凭据；window adapter为空，不开伴随窗，不放宽鉴权。
- 底层会话controller/远端/权限/资源/快捷键/locale和壁纸Host状态仍为夹具，主题偏好与浏览器存储独立。并非完整DSH桌面端、原生采集或真实壁纸验收。
- 订阅计数在既有桥接构造后包裹原订阅方法，统计的是本侧栏新增订阅，不能称整个应用始终只有一条订阅。

`final-entry-report.json`的12项覆盖：完整Whale入口、DOM点击打开宿主页、同pane重复打开复用、共享亮度变化渲染、折叠/重开、切会话与返回、无会话入口禁用、provider撤回、provider恢复、关闭页、插件卸载释放。provider撤回/恢复期间Whale实例和原控制器身份保持。无作者设置/播放/停止/窗口命令；壁纸请求仅一次`/whale-wallpaper/status`。

本轮先按零控制台错误门禁运行，`full-entry`因两条401失败，原日志保留；随后用冻结的修改前入口做`baseline-auth`及显式卸载对照`baseline-dispatch`，并用新入口`auth-dispatch`核对请求发出时状态。最终门禁只接受与冻结基线**完全相同**的两条错误及其请求条件，其他错误仍失败。最终`cleanLog:false`、本次侧栏整合范围`passed:true`，不以修改门禁掩盖新增错误。

最终运行约2.48秒；自有浏览器退出、HTTP桥接关闭和服务器关闭均已确认。页面订阅、refs、pins、远端监听、DOM子节点归零。浏览器阶段有界，独立父监督45秒、收束51秒；回归逐阶段20秒、总期限60秒，无超时触发，不依赖用户结束脚本。

## 可复用回归及保护核对

`regressions-report.json`：新增`qa/native-sidebar.test.mjs` 10项，相关`qa/detachable-catalog-init.test.mjs`、`qa/wallpaper/ui-library.test.mjs`、`qa/author-properties-context.test.mjs`共49项通过；两个生成器`--check`、3项语法检查及CSS guard通过。旧UI测试中保留的旧组件调用不当作新顶栏注册验收；新注册由上述完整入口运行覆盖。

`change-audit.json`核对本轮开始时233项源码/QA/manifest/assets/归档：仅预期`src/client.js`变化，其余232项保持。精确撤去本次生成块和三处接线后，`client.js`恢复到开工快照的完全相同字节，既有Trace和换行保留；没有整体替换开发客户端。

| 最终输入 | SHA256 |
| --- | --- |
| client.js | `738CC029953A914504FD83D80A7F16B981036E811E800E4C185C941F5F6FA1A8` |
| native-appearance-sidebar.js | `62D92AA24C1742815B6D1D2E8B580C23A82CB86AAA4D7BFF0A6A49465692C7E4` |
| build-native-sidebar.mjs | `BA51D12C79D0373E2D5BDDF5A73167BB5231D37F817194A8D9486F151B8F580E` |
| native-sidebar.test.mjs | `44AB61071B29B53BE04AB72B82B0AD94841549998CDD6B8AE29D18D98ABD7BA9` |

## 下一小步

按[既定层级规划](WALLPAPER_NATIVE_RIGHT_SIDEBAR_PLAN_20261021.md)先接“壁纸画面”的**亮度与遮罩两个控件**，继续复用同一controller；只验证本地设置更新、其他入口同步、重载/多视图无重复订阅，不混入作者即时下发。先补有界离线验证，再按阶段决定后续图库、播放主控与作者参数迁移。

当前只读侧栏是开发中间态，不能发布为旧完整设置页的成品替代。未来候选需从固定归档独立整合并明确声明真实右侧栏包加载依赖/顺序；当前冻结manifest/生产assets仍rc.30，本轮不热改。用户UI要求中的整体视觉、透明度、窄宽度、弹出互斥和即时参数均另验，不将此逻辑结果替代主观验收。

Opus暂缓、不重试；定时保持暂停。未提交、推送、清理或联系其他助手。
