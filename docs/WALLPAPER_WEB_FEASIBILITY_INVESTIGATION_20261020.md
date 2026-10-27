> 后续更新：本报告保留调查/准备时状态。[源观察已完成](WALLPAPER_WEB_SOURCE_ONLY_RESULT_20261020.md)，用户确认动态正常并重开；[源码接入及 rc.41 候选离线核验已完成](WALLPAPER_WEB_OFFLINE_DELIVERY_20261020.md)，未安装。下文“当前未开放/未开窗”均指调查时基线；实际日常 rc.40 仍未开放 web。调查执行器探针曾误用不存在的 PLAY 常量，现改用真实 START_WALLPAPER 与完整输入，并加 video 正例确认实际到达类型门禁；修正后源码/实际 rc.40 的12项重跑通过，原结果与 corrected 监督日志均保留。此 QA 修正不影响真实源观察。

# web 壁纸只读调查与无采集观察器准备

2026-10-20。结论：**web 有官方独立窗口路线及本机Everyone样例，值得进入无采集源窗口验证；当前插件仍未开放web，尚无真实播放通过结论。** 日常仍为DSH0.2.1-rc.2/外观rc.40/Git Bash0.1.1。本轮没有安装、启动WE/壁纸/浏览器、修改日常配置或执行壁纸脚本。

本轮证据：`F:\dsh-wallpaper-plugins\.tmp\web-feasibility-20261020-839147ca`。新交付前仓库干净，当前起点`072cdc5`。218项保护输入及实际日常37安装文件核对保持。

## 官方依据及范围

[官方CLI文档](https://help.wallpaperengine.io/en/functionality/cli.html)明确给出`openWallpaper`的独立窗口选项`playInWindow`、唯一窗口名和尺寸，也列出web的HTML入口。通用file参数另允许项目JSON。由此可设计两个入口方案，但不能将文档支持等同本机可见播放成功。

[官方web创建文档](https://docs.wallpaperengine.io/en/web/first/gettingstarted.html)说明HTML与所依赖的资源构成完整项目，根目录存在项目JSON。当前web应优先由WE自己的渲染环境承载，避免在DSH会话页面执行作者脚本；单复制HTML不能代替整个资源依赖。

[官方调试文档](https://docs.wallpaperengine.io/en/web/debug/debug.html)说明web采用CEF；其旧远程调试端口说明与[2.8官方公告](https://steamcommunity.com/app/431960/announcements/)关于改用内置DevTools的描述存在版本差异，因此本轮不以开启调试端口为前提，也不改WE设置。本机仅只读取得wallpaper64.exe文件版本`2.8.0.485`，不把此文件版本直接等同某一公告中的显示版本。

## 本机受限目录结果

只读检查既有受限库的一层26个project.json，逐项限512KiB、总16MiB、目录上限512、单次总截止20秒，拒绝链接和变化中的文件；没有读取预览图或图片载荷，没有搜索其它盘符。

| 原始type声明 | 数量 | 本轮结论 |
| --- | ---: | --- |
| `scene` | 15 | 保持现有范围 |
| `Scene` | 2 | 当前严格枚举会映射unknown，属于另一个已确认的兼容缺口，尚未补修 |
| `video` | 8 | 仍只有当前受限MP4接入范围，不扩称全部已验 |
| `web` | 1 | Everyone，具备本地HTML与直接资源依赖 |
| `application` | 0 | 受限目录中没有样例，不能声称已验 |

web样例：“Deepseek鲸鱼娘萌物！”，ID `we-04cfda7edaf159881d4a383d`，目录`3785592362`，声明`file=index.html`、`type=web`、`contentrating=Everyone`。项目JSON SHA256为`1AB1F27439644F13134D46A63898118CC920849A08A9E348FBE7F3F740356113`。项目和HTML入口路径均为ASCII。

只作为文本检查index.html及styles.css/config.js/manifest.js/app.js，四个直接依赖均存在且哈希已留存，未执行JS、读取图片或访问作者URL。样例包含粒子动画、秒钟和localStorage使用，适合看秒数与动画是否连续。静态检索中的W3C URL是SVG命名空间，不能据此认定页面发出了网络请求；同样不能凭静态扫描宣称全部动态资源或运行期网络已验。

## 当前实现门禁：源码及实际日常均核对

1. catalog可登记web元数据，但available=false、reason=playback_type_not_supported；verifyCatalogEntry只接scene/video。
2. library.resolveForPlayback在创建session前拒绝未获准条目；不能只伪造前端type/project路径绕过。
3. 主/从执行器及主面板、独立窗均只允许scene/video开始，需成套接入，不能只放开按钮。
4. 当前JS命令校验及C#源码只允许JSON/MP4路径，不接受直接HTML。首轮源观察因此使用**样例project.json**，沿已有JSON调用形状，不修改原生helper或日常包。是否能由该项目文件打开web必须实测，不预写成功。
5. MP4桥只处理受控单文件视频，不应复用于HTML：web有整个目录的依赖，需保留项目目录和资源相对位置。

以合成项目分别回放工作区源码及实际安装rc.40，12项检查通过：登记/禁止播放、library拒绝、Host完整start路由拒绝伪造字段且零session/native调用、执行器拒绝伪造available web、JSON/HTML参数边界，以及application/大写Scene现有分类。见offline-probes-result.json和父监督结果；没有为这些检查启动真实helper或窗口。

## 有界无采集观察器已准备，尚未执行

- 独立复制固定rc.40归档中的12项helper运行文件，原包哈希和每项helper哈希已绑定；不构建或覆盖生产assets。
- 复用已审source-only状态机，改为本轮web唯一location和rc.40基线。默认模式仅输出计划，必须有新的“方便/无任务、正常退出”确认和本轮关闭备份才允许执行。
- 开窗前重新验证Everyone/type/entry、项目及五个直接文本依赖、准备脚本、实际安装和备份。只启动批准project.json；不启用采集、不控制桌面壁纸、不执行未知程序。
- 新备份须含本轮5个Profile/关闭Local Storage，另复制活动rc.40原包及原布局设置，再建立当轮WE身份与唯一location；旧PID/旧备份不作新授权。
- 观察20秒，外部观察上限25秒，内部启动/关闭均有界，父监督65秒、外层总期限90秒；Esc/停止文件可终止。关闭仅限本轮匹配窗口，不终止原WE。
- 仍要求窗口进程与本轮原WE的PID/可执行路径/精确启动身份一致；**不默认信任CEF或其它同目录进程**。若实际web窗口由其它进程承载，观察器会拒绝关闭并留证，需要人工正常关闭并另审归属方案，不能扩大PID/时间容差绕过。这是当前受限试验的已知条件，不是通用web进程支持已实现。
- 观察器41项离线检查通过，含新增HTML冒充JSON、分级/声明/依赖漂移及外来web进程不误关负例；含真实自有Python挂起/崩溃/缺报告的父监督回放，所有原生/WE边界均为替身。默认计划和真实批准文本输入纯读取另已验证，未创建live基线或启动真实窗口。

操作顺序已准备：fresh backup → retainBefore → baseline → observe → verifyAfter。相关脚本均在本轮独立证据目录，输入指纹见prepared-inputs.json。真正开窗前需用户当时方便并正常退出DSH；观察后原设置若核验一致不覆盖，保留测后证据，再请用户正常重开rc.40。

## application 的初步调查

[Wallpaper Engine官方2.8.42公告](https://steamcommunity.com/app/431960/announcements/)明确停止Application类型在公开创意工坊的上传/下载，同时说明本地自定义应用仍可运行。这两点并不等于DSH已经可以归属并安全关闭任意EXE窗口。

本机现有限定库没有application项目，当前实现仍将其视为未知类型/不可播放。本轮不为了补齐类型下载或执行程序；待web试验有结果后，将“本轮不支持及原因”作为应用类可行性的明确结论候选。如果用户有具体本地应用壁纸需求，再按单独样例审查入口、权限、窗口/子进程归属及正常退出，不能将缺少样例记为通过。

## 后续顺序

先执行上述web无采集观察，确认入口、可见动态与受限清理。源正常后再拆最小Host/主从接入及候选采集短验；源异常先定位，不重复MP4式盲改UI。web之后收束application可行性结论，再进入作者公开参数。两份大写Scene声明的分类缺口单列为兼容补修，不随本次只读调查静默放行。
