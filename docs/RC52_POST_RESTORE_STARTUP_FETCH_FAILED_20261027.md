# rc.48 恢复后重开：Host 启动 fetch failed

2026-10-27，Codex。用户补充：恢复后重开弹出“DeepSeek Harness is unavailable”，点击 Restart 后正常重开。**已定位失败调用和底层错误；本次具体端口及其选择原因未留证，不宣称完整根因已解决。** 本轮仅只读诊断、补正文档，没有重开、退出、禁用插件、改端口或重装。

## 实际证据

- 原始日志：`C:\Users\HP\AppData\Roaming\@deepseek-ai\dsh-desktop\logs\crash-2026-10-27T11-25-50-181Z-host.log`，1205字节。`phase: startup`，宿主0.2.1-rc.3，shell PID21652，UTC11:25:50.181（本地19:25:50）。
- 异常为 `TypeError: fetch failed`，`cause: Error: bad port`，栈经内置undici `mainFetch` → `authenticateWebHost` → 宿主backend.start。没有renderer错误被捕获；这不代表所有组件绝无问题。
- 只读解析当日日常安装 `resources/app.asar` 的 `lib/main.js`：8230–8236行的authenticateWebHost对Host上报URL执行fetch，换取认证cookie；12191–12193行先await host.start()，再执行该认证。错误发生在桌面壳认证后台这一具体调用，不是截图所暗示的Windows系统崩溃，也不是日志已证明的模型服务请求或壁纸参数错误。
- 安装携带的undici实现 `resources/runtime/primary-runtime/dependencies/pnpm/dist/node_modules/undici/lib/web/fetch/util.js` 的requestBadPort按HTTP(S)端口限制表拒绝请求。这里是旁证说明bad port语义，不把携带的pnpm依赖冒充Electron内置undici的同一版本。具体失败URL／端口未出现在崩溃报告，不能据此填写端口号，也尚未证实选择算法或端口分配竞争。
- 本轮恢复留证 `restored-final-runtime.json` 已证明rc.48恢复、官方EXE／ASAR／WE保持、Profile无变化。失败发生在恢复后重开阶段，不能直接归罪于临装rc.52或认定恢复文件损坏。
- 已留的 `restored-live-endpoint-discovery.json`：UTC11:26:03.798新桌面主进程PID12552，后端PID39012，随后11:26:25发现新后端；`restored-stopped-status.json` 于11:26:34记录active=false、session空、capture空、failed=false、无错误。结合用户Restart陈述，这是失败之后恢复的那次运行，不能用它抹去11:25:50的失败。

## 结论与接续

当前已由用户确认恢复正常，可以继续日常使用。现有证据不要求重装、禁用插件或恢复旧Profile，也没有数据损坏证据；不等同于排除全部风险或永久修复。

原短验记录“工具未取到窗、只读发现正常启动”的解释不完整，现补正为：**恢复重开真实失败一次，用户Restart后恢复，之后Host状态和外观确认正常。** Lucy首次自动显示6项参数的观察与关闭状态文件恢复核验仍有效；“恢复后首次无异常启动”不成立。

若再次发生，优先保留当次crash日志和启动阶段实际URL的脱敏端口、后台ready/退出时间，核实是否命中受限端口及宿主选择路径，再决定是否向官方报告或安排隔离复现。当前没有复现循环或修复验证，不将Restart恢复写成根因解决。rc.52仍未作日常；后续切换前先复核该宿主启动事件是否需要单独处理，不自动升级或再试验。

原始日志及当轮源码片段／指纹只读留存于 `.tmp/rc52-post-restore-startup-20261027-a/`；原短验封口文件不改写，新增证据单独存放。
