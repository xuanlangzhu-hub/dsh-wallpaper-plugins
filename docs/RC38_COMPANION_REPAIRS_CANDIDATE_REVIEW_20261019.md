# rc.38伴随窗补修候选：独立整合与实际核包通过

最新现场：[rc.38本轮独立窗/吸附与Lucy合并短验通过](RC38_COMPANION_SHORT_TEST_20261019.md)，10月20日已按约定恢复rc.35和本轮原设置，用户已确认恢复后正常重开、外观布局正常及播放停止，前轮恢复收尾完成。用户随后另行选择[rc.38日常试用](RC38_DAILY_TRIAL_20261020.md)，已按本轮新备份安装核验，用户确认重开正常、原外观布局正常及播放停止，保留rc.38日常；下文“未安装”为核包阶段历史。

2026-10-19，Codex。**R1 guest、R2清理查询与[主端收尾补修](COMPANION_DISPOSE_ORDER_REPAIR_REVIEW_20261019.md)已从不可变rc.37基底单独整合；实际tgz离线核包与55项相关测试通过，尚未安装。** 日常DSH0.2.1-rc.2 / 外观rc.35 / Git Bash0.1.1保持。

| 项目 | 结果 |
| --- | --- |
| 候选 | `release/plugins/dsh-whale-mist-0.6.0-rc.38.tgz` |
| SHA-256 | `B417B73F93973564522839CE803AF1BB0AAA2072D35C24E5ACEF0E2C42CF0DEA` |
| 字节 / regular文件 | 7,160,300 / 35 |
| 相对固定rc.37 | 31项逐字节不变，仅README、package.json、detachable-contract.js、detachable-edge-adapter.js变化；无增删 |
| 基底SHA-256 | `F0958CEF5FD89ECD7B289921A0EBCC4FE6859E7421D83338AA116555B14D8ED8` |
| 实际包校验 | 15个JS语法、CSS守卫、16条静态相对import与manifest闭包、无Trace标识 |

证据：`.tmp/companion-dispose-review-20261019-7a800b30/rc38-candidate`。build-and-audit.py直接读取/验证原包regular成员，拒绝链接、重复、大小写冲突、绝对路径和穿越；仅在新目录落地。contract逐字节等同本轮已审源码SHA `B2688A771A3A525A8E5BA1E1772A3DDD1E0E5AA5B2B6FD8A1703B794A6A96BB6`，adapter等同[R2已审源码](COMPANION_R2_CIM_SOURCE_REPAIR_REVIEW_20261019.md)SHA `BA8B4C708E06FF5877FD323E0D3266BFC473E4C75042FAB355C185AB01C8E5E7`。原包contract/adapter也先对照各自修复前指纹，避免混入后续未审代码。

manifest解析后只有version变化，宿主engines、六项peer、权限、main/exports/files声明保持。client、Host认证、companion静态页面、图库分级与B恢复链路逐字节等同rc.37；12项原生运行文件与另外assets保持，没有打包开发工作区Trace或QA、Profile、用户图片。新归档排他创建，不覆盖rc.35/36/37。

## 实际解包验证

- 从新tgz解出的candidate-stage运行24项主端dispose专项和P0/P1A/目录初始化31项，**55/55通过**；所有监督子进程正常退出，无截止触发。
- 15个JS逐项语法及CSS模板守卫通过。24项含真实loopback Host，窗口/进程IO是明确替身，不启动浏览器或DSH/WE。QA复制在解包目录旁支，不在tgz内；相对导入绑定实际候选。
- 208项源码/QA/manifest/assets/旧归档保护输入漂移0，源码manifest仍rc.30。final-audit.json保存完整结果，archive-audit.json保存35文件哈希/大小。
- 构建准备阶段快照助手曾因缺少局部sha定义报NameError，未改任何产品输入。已先核对原206项仅有已批准contract提升，再冻结当前208项后执行候选检查；preparation-note.json留证，没有重写旧包或迁就测试。

本轮只重复受变化影响的相关检查。未变Host/图库/SDK/原生模块沿用rc.36/37已审来源与历史证据，不伪写成新浏览器、实机或全矩阵验收。[R1本机隔离访客观察](COMPANION_R1_GUEST_SOURCE_REPAIR_REVIEW_20261019.md)不等于安装后的DSH整合已通过。

## 下一轮受控短验（尚未执行）

1. 重新确认当前方便、其它助手暂停、DSH无任务；正常停止播放并菜单退出，原WE保持。退出后建立本轮新备份，按当时实际集合保存Profile/关闭状态外观存储、活动包和安装文件，保护新增会话/附件。
2. 用已核验的官方CLI安装固定rc.38，核对35项安装文件；正常重开确认原外观布局，先保持播放停止。宿主和Git Bash不升级。
3. 顶栏打开外观，首次目录自动出现、Lucy可选、按钮按当前状态启用。默认仅Everyone，不勾成人分级、不打开用户成人图片。
4. 一次独立窗→亮度80→吸附，观察无账号提示、两端同步与无清理报错；有异常立即停。再做Lucy约20秒手动播放/鼠标/停止清理，用户反馈画面和操作。尽量合并步骤，免反复折腾。
5. 默认测后正常退出，用本轮备份恢复rc.35与原设置，再正常重开核验；是否保留rc.38日常由用户另行明确选择。不沿用之前的退出授权、PID/HWND或老备份覆盖新数据。

本轮未安装、退出/重开或操作日常DSH/WE，没有模型请求、系统策略变更、提交推送或清理。定时PAUSED，A/三体/GPU暂缓；原始壁纸断流根因未知，短验不扩称长期稳定。
