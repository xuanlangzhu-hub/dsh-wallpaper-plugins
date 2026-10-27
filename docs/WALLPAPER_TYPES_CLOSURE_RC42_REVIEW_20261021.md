> 后续状态：[用户授权rc.42日常切换](RC42_DAILY_TRIAL_20261021.md)已完成新备份、安装及37项核验，用户重开确认“都正常，未播放”，保留日常rc.42。下文“未安装”指候选审计时状态。

# 壁纸类型可行性收束与 rc.42 兼容候选

2026-10-21。**application 可行性结论已收束为当前不接入；Scene 大小写缺口已完成源码补修及本机只读重验，rc.42 实际归档270项检查通过，未安装。** 日常保持 DSH0.2.1-rc.2 / 外观rc.40 / Git Bash0.1.1。前轮[rc.41批准web/Lucy实机短验及恢复](RC41_WEB_SHORT_TEST_20261020.md)结论保持；本轮没有操作日常DSH/WE。

## application：保持不支持，有明确阻碍

[Wallpaper Engine官方2.8.42公告](https://steamcommunity.com/app/431960/announcements/)说明已停止Application壁纸在公开工坊的上传/下载，仍允许本地自定义应用。公告并未说所有本地application都无法运行，也不能据此认定本插件已支持。[官方CLI文档](https://help.wallpaperengine.io/en/functionality/cli.html)的通用项目JSON/独立窗参数，没有替任意应用提供本轮所需的实例归属、子进程和退出证明。

本轮重新只读受限库26个project.json（113415字节）：15 scene、2 Scene、8 video、1 web、0 application；未读取预览或媒体正文，未下载/运行应用样例。当前没有可复核的本地application入口、单独实例、窗口/子进程归属及正常退出证据。

现有源码可确认三层边界：catalog只接已知scene/video/web，Host每次经ID重验后才建session，主/从动作拒绝伪造available application；通用JSON输入不是绕过类型门禁的授权。当前原生窗口归属C#实现又限定wallpaper64名称、同轮location/PID/启动身份，不能把任意作者EXE窗口当作原WE窗口。此处是源码边界分析，不是已完成application二进制或实机验收。

因此本阶段维持application禁用（目录仍映射unknown），不扩展任意EXE入口、不降低窗口身份标准。若将来确有本地需求，先由用户指定可信项目，单独设计受限启动、进程树/窗口归属、正常退出/迟到结果方案，再另行确认真实操作。当前无需为了凑齐类型继续等待未知样例；可进入作者设置阶段。可行性收束不等于application功能完成。

## Scene 根因、补修和本机复核

catalog扫描与开始前重验各自使用区分大小写的枚举，`Scene`变unknown。实际两张项目声明scene.json而发布内容是scene.pkg；类型误判还使合法scene.pkg回退失效，因此原理由显示为missing_content，而不只是unknown_type。不是仅改前端按钮可以解决。

新增共享catalogType，仅对真正字符串的小写形式匹配scene/video/web，扫描与重验都使用它。接受已知类型的大小写变化，拒绝前后空白、近似/全角拼写、非字符串和application。仍保留类型实质变化、声明变化、缺失、越界/链接和旧活动会话保护；ID/分级/路径、Lucy-only自动播放及原生链保持。

合成项目先跑红例：9项中6失败、3通过，Host Scene开始409且unknown_type；只补类型解析后8/9通过，剩余是新QA误读resolveForPlayback的id字段，应为sceneId。修正QA后9/9通过，失败均保留。完整源码分组246项、销毁24项通过。

只读同一受限根，与固定rc.41实际解包catalog对照：

| 项目目录 | 旧结果 | 补修结果 |
| --- | --- | --- |
| 2871049687 | unknown / unavailable / missing_content | scene / available，批准根入口重验通过 |
| 3649881593 | unknown / unavailable / missing_content | scene / available，批准根入口重验通过 |

两条均Everyone，目录ID保持，playbackVerified仍false；其余24条完整记录保持。未读取预览载荷、未实播这两张；available只代表登记与重验条件满足。证据：`F:\dsh-wallpaper-plugins\.tmp\type-closure-20261021-a714c162`，含local-metadata、local-catalog-comparison、红绿测试与前后源码。无新增调试日志；合成脚本/隔离副本明确保留于.tmp证据目录。

## 源码提升与 rc.42 固定归档

前后指纹核对后仅提升1项既有产品文件catalog.js，新增1项type-normalization QA；保留前轮web等脏改动。220项保护输入中除明确catalog变化外219项保持，未改工作区manifest/生产assets/旧归档。日常rc.40安装37项仍匹配固定包，未读取活动Profile存储或连接日常任务。

| 项目 | 结果 |
| --- | --- |
| 新归档 | `release/plugins/dsh-whale-mist-0.6.0-rc.42.tgz` |
| SHA256 | `A9B8044CB9C11CCC8B5FAB5309814B3616F267F9F15479484CCE79D714F70CB8` |
| 大小 / regular成员 | 7169434字节 / 37项 |
| 固定基底 | rc.41，SHA256 `DB920CCD4E0436AF384F3C68E00DE60F7275A20422F0BB8DB9FF01CC4EACB03A` |
| 与rc.41差异 | catalog.js、README、package版本3项变化；34项相同，0增删 |
| 原生/播放链 | 12个原生文件及其它播放模块逐字节相同，无复编/Trace |
| 实际解包回归 | **246/246**，13.803秒，PID29112，exit0已确认，无超时 |
| 实际解包销毁 | **24/24**，6.816秒，PID36848，exit0已确认，无超时 |
| 静态 | 17个产品JS语法、CSS模板、18条相对导入闭包通过 |

证据：`F:\dsh-wallpaper-plugins\.tmp\rc42-types-candidate-20261021-c812bd65`。从固定rc.41只应用上述类型解析补丁，不整份打开发工作区。包内catalog等于已测隔离源码，manifest解析后仅版本变化。regular-only成员校验拒绝穿越/ADS/链接/大小写冲突，成员名单与rc.41相同，无QA/媒体/Profile/凭据；实际解包后37项再次核对，排他归档不覆盖旧包。Trace特征按既有名单检查字节及UTF16形式无命中。

QA使用实际catalog/library/Host路由及权威动作，原生session、worker、窗口IO为明确替身；application的EXE文件是惰性文本，零session/native启动。新QA含Scene规范化、大小写双向重验、合法回退、实质变型、越界/链接、Host按ID忽略前端路径、application拒绝及执行器正例。测试内部30秒、外层40/45秒期限；Python构建15秒、静态单项3秒、元数据对照20秒截止，子进程退出均确认。

## 接续

rc.42候选具体可审，尚未安装或改作日常。若用户选择日常切换，先确认当时方便、DSH无任务并正常退出，新备份本轮rc.40/Profile/关闭存储与布局，安装后37项核验并正常重开确认目录与外观。无需为纯元数据解析补修机械重跑已由相同播放链完成的web/Lucy短验；两项Scene本身仍未宣称实播通过。遇异常保留现场，按本轮新备份回退。

壁纸类型排期本阶段已得出边界：scene与受限MP4已有批准样例实机结果；web批准样例rc.41短验通过；application本阶段不接入，其它视频容器/音频/交互及三体变速不扩称完成。下一步按[作者设置P0任务](WALLPAPER_AUTHOR_SETTINGS_P0_TASK_20261021.md)先做受限元数据与表单契约，不操作日常实例。
