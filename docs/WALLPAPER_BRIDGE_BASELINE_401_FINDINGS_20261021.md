# 桥接既有401：完整入口隔离对照记录

2026-10-21，Codex。在[原生侧栏完整入口整合复核](WALLPAPER_NATIVE_RIGHT_SIDEBAR_INTEGRATION_20261021.md)中发现；本轮记录，不扩展到桥接修复或日常运行操作。

## 证据与判断边界

证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-sidebar-integration-20261021-1c97d523`。使用真实Whale `apply`、真实`createDetachableHttpHost`与正式鉴权，独立测试端口/凭据及内存输入，无伴随窗口。

修改前`before/dsh-whale-mist/src/client.js` SHA256 `7D08DE24611F9552751D754B73404061B6F2A266379DE9183D2864F68C590305`；该旧入口的`baseline-dispatch-report.json`与新入口`auth-dispatch-report.json`、`final-entry-report.json`均出现完全相同的两条请求错误：

| 请求 | 响应 | 请求发出时观察 |
| --- | --- | --- |
| `POST /api/main/snapshot`，generation=1 | 401 | 尚无main注册，此前未连接成功 |
| `POST /api/main/disconnect`，generation=1 | 401 | 当时已无main注册，此前连接成功过；发生于显式卸载/收尾流程 |

每轮对应两条浏览器资源加载401错误，无page error。第一次仅旧入口启动/整体收尾的`baseline-auth`只有snapshot错误；补上与新入口相同的显式插件卸载后才得到可比的两条错误，不能把两种生命周期混作同一个对照。

这说明**两条告警在本隔离环境的旧入口已有，不是本轮侧栏接线新增**。请求时序为调查线索，尚未独立定位桥接所有权/发送顺序的完整根因；不证明日常用户必然遇到、也不证明全部401都可忽略。侧栏整合范围通过保留`cleanLog:false`，严格比对固定错误与条件，不放过新增错误。

## 后续单项调查与验收

后续[亮度/遮罩接入复核](WALLPAPER_NATIVE_RIGHT_SIDEBAR_APPEARANCE_CONTROLS_20261021.md)补充：原request回调中的`mainRegisteredAtDispatch`仅是Playwright事件送达Node时的观察，不是服务端鉴权时的证明；新一轮曾读到true但响应仍401。用本轮修改前只读源码重放设置写入序列，两个路径的响应正文均为`unauthorized-main-token`，新源码最终相同。原观察表作为历史记录保留，不再据此推断完整注销/鉴权因果；该桥接问题仍未修复。

后续如安排桥接专项，最小范围应为注册完成前snapshot及卸载后disconnect的发送时序/所有权，先稳定重放上述两条路径，再区分未注册、已注销、旧generation及真实鉴权失败。

验收要求：合法冷启动和明确卸载流程不产生预期外401或重复disconnect；未知结果不自动重发；旧generation/错误token/错误Origin仍被正式Host拒绝。保留单main租约及期限，不能通过关闭鉴权、吞所有401、隐藏控制台错误或改生产浏览器设置换取通过。需要实际日常日志时另取用户方便确认，本记录不授权采样DSH。
