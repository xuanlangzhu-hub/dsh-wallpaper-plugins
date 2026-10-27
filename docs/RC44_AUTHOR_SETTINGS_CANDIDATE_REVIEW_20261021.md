# rc.44 作者设置候选核包

2026-10-21。按[最小候选任务](WALLPAPER_AUTHOR_SETTINGS_CANDIDATE_TASK_20261021.md)，从固定rc.42最小整合[P0参数读取](WALLPAPER_AUTHOR_SETTINGS_P0_DELIVERY_20261021.md)、[P1A双端草稿](WALLPAPER_AUTHOR_SETTINGS_P1_DRAFT_DELIVERY_20261021.md)及[P1B定向下发](WALLPAPER_AUTHOR_SETTINGS_APPLY_DELIVERY_20261021.md)。**rc.44核包通过，未安装、未调用真实WE参数命令，作者实际效果仍待短验。** 日常DSH0.2.1-rc.2/外观rc.42/Git Bash0.1.1保持。

## 固定来源和差异

- 来源：`release/plugins/dsh-whale-mist-0.6.0-rc.42.tgz`，SHA256 `A9B8044CB9C11CCC8B5FAB5309814B3616F267F9F15479484CCE79D714F70CB8`。
- 候选：`release/plugins/dsh-whale-mist-0.6.0-rc.44.tgz`，SHA256 **`AC64390E3FA2C4791059816851FB927EA2E4FA33F0C7149BA4F1F7B31F95D433`**，7194701字节，42个普通文件。
- 相比rc.42：11个既有文件变化（package/README、client、contract、detachable-host、index、companion JS/HTML、catalog/library、session），新增5个作者模块，其余26个文件相同。14个assets均相同，其中原生运行文件12个逐项一致；没有cadence-trace模块或诊断二进制。
- 使用冻结P0/P1A前版本至本轮已审源码的逐段差异移植，**没有复制整个开发client/session**。session仅移入windowStartUtc状态字段。`author-delta.json`记录每段前后内容；反向撤销9个运行文件的作者差异后，其余内容与固定rc.42完全一致（仅归一换行比较）。5个作者模块与受审冻结源码字节一致。
- 工作区manifest/生产assets仍rc.30；日常安装37项文件及rc.42归档在核包前后只读核验一致，没有改Profile设置或读取活动Local Storage。没有提交、推送或清理。

## 实际tgz验证

证据根：`.tmp/rc43-author-settings-candidate-20261021-810f7b62/verified`；指针`.tmp/current-rc44-author-settings-candidate.txt`。目录名保留首轮尝试历史，最终`archives.json`明确指向rc.44。

| 检查 | 结果与范围 |
| --- | --- |
| 实际rc.44解包主回归 | **335/335**，16.850秒，PID43132正常退出；QA在解包后附加，未进入发布包，没有覆盖42项包内文件 |
| 销毁专项 | **24/24**，7.002秒，PID864正常退出 |
| 真实Cordis隔离载体 | 460ms，PID41464正常退出。真实SDK/index/认证引导入口；admission为替身、未扫描目录、隔离模式不启用真实下发器 |
| Win32 RAW参数接收器 | 324ms，父PID38764正常退出；接收程序读取A/W命令行验证中文、emoji、引号和反斜线的JSON转义边界，未启动WE |
| 自有子进程收束 | 412ms，父PID43088正常退出；良性Python挂起/超限输出的本轮子进程确认收束，不操作DSH/WE |
| 静态/闭包 | 22项JS语法、33条包内相对导入闭包、共享表单生成`--check`及CSS模板通过；Node adapter不进入伴随窗静态白名单 |
| 输入保护 | 198项源码/QA/scripts/assets/manifest/patch指纹保持；实际候选42项、日常37项及固定归档均一致 |

`applyVerified-result.json`、`dispose-result.json`、`sdk-result.json`、`raw-command-result.json`、`owned-timeout-result.json`均记录退出确认且无父监督超时。主QA40秒/45秒、SDK8秒/12秒、隔离接收器5秒/7秒监督保持。测试中的WE命令与窗口身份IO为替身，DOM/React钩子也为替身；不等同真实WE属性响应或所有壁纸参数验收。既有目录/分级、预设、独立窗/吸附、scene/video/web、Lucy-only自动播放及清理门禁保持。

## rc.43失败尝试保留

首轮rc.43（同一根目录的`archives.json`、build和解包目录保留）虽335/335及24/24通过，但共享表单生成字节门禁失败：差异移植把122处CRLF统一为LF，归一后内容完全相同，见`bundle-audit-failure.json`。未放松门禁、覆盖旧归档或安装它。

rc.44精确保留生成器输出的换行。相对rc.43仅client生成闭包换行、README候选号和manifest版本三项变化，语义不变；重新从新tgz解包跑上述检查。rc.44首个审计脚本仍断言旧候选号43，修正为44后审计通过；候选本身未再改动。rc.43归档及失败证据保持，不作为可安装候选。

## 接续短验

已用本轮实际候选的library/schema，只读核对已批准Everyone的Lucy：7项支持参数，含“粒子/Particles”（key=`particles`，作者默认true）。`approved-settings-plan.json`仅保存该批准样例的安全投影，不读取WE当前值、不打开预览或执行脚本。

按[本轮短验准备](RC44_AUTHOR_SETTINGS_SHORT_TEST_PREPARATION_20261021.md)先确认用户当时方便、无任务并正常退出DSH；取得确认后另做新备份，临时安装rc.44。计划只测粒子开关的保存/应用/可见变化及停止，默认测后恢复rc.42和本轮原设置。原WE保持，不用历史PID/退出状态。当前未取得新的安装/实机授权。
