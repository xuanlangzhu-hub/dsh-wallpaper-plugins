# MP4受控ASCII桥接：实现与离线复核（2026-10-20）

后续：[rc.40候选核包及补充复核](RC40_VIDEO_ASCII_BRIDGE_CANDIDATE_REVIEW_20261020.md)已完成，重复create守卫前覆盖lease的问题新增红例并修正，共享桥接QA扩至40项；旧38项为当时范围。实际新包249项分组检查通过，未安装，日常rc.38保持。

本轮[离线任务](RC39_VIDEO_ASCII_BRIDGE_OFFLINE_TASK_20261020.md)完成，6项源码/QA已从隔离副本核对指纹后提升。新增38项桥接检查通过，相关Host、目录、模式控件、独立窗回归分别通过。Windows现有用户目录的只读ACL/重解析点查询也通过；没有创建生产缓存、安装、打开或采样DSH/WE。

日常仍为DSH0.2.1-rc.2 / 外观rc.38 / Git Bash0.1.1；manifest、生产assets及所有固定归档未变。此结论只覆盖源码、合成文件、底层进程替身与下文只读Windows元数据检查，**不代表视频在DSH/WGC中已播放通过**。下一步是从固定基底最小整合新候选并核包，届时再取得方便确认短验，不重装失败的旧rc.39。

## 输入与协作边界

证据：`F:\dsh-wallpaper-plugins\.tmp\video-ascii-bridge-offline-20261020-d2a7f6de`。

- `git-status-before.txt`保留当轮脏改动；`protected-before.json`含214项源码/QA/scripts/assets/package/递归release归档的SHA256。
- `frozen/`是原输入，`dsh-whale-mist/`是独立工作副本。先在副本实现和检查，提升前214项原输入均未漂移，见`pre-promotion-check.json`、`promotion.json`和最终核验。
- `accepted-source-fingerprints.json`绑定6项精确交付字节；`changes.patch`仅描述本轮差异，不将相对于git HEAD的历史脏改动误算成本轮新增。
- 不提交、推送、清理旧证据或恢复定时；不改官方安装、Profile、Local Storage、原媒体、WE设置、系统代码页、解码器或GPU配置。

Grok通过已有隐藏CLI派发，真实工作区没有交给CLI写入。完整模块请求180秒超时、权限小任务违规尝试工具而失败、完整源码审阅150秒未形成报告；这三次均保留失败且确认自有进程退出。最终小范围纯文本审阅37.060秒正常返回，指出源替换和迟到IO/残留锁两类风险。它没有交付可用核心代码或完成源码背书；实现与真实模块负例由Codex完成。见`grok-attempts.json`、`grok-focused-review.json`。未读取或公开CLI认证/用量签名。

## 逐文件交付

| 文件（均在dsh-whale-mist下） | 本轮变化 |
| --- | --- |
| `src/wallpaper/media-bridge.js` | Host受控复制、完整哈希、空间/并发预算、租约与安全释放；导入时无IO |
| `src/wallpaper/media-bridge-permissions.js` | 有界隐藏PowerShell中调用.NET只读ACL及完整路径重解析属性检查，不依赖模块自动加载，不修改权限 |
| `src/wallpaper/library.js` | 新增私有`resolveForPlayback`，同次实际复核返回原声明与媒体身份；保留旧resolveSelection形状 |
| `src/wallpaper/session.js` | 真正routes/start/restart/stop/unload与session/helper接缝，缓存所有权移交及退出证明；未改变原生捕获参数 |
| `qa/wallpaper/media-bridge.test.mjs` | 38项实际模块/合成FS/底层IO替身负例；有界临时夹具及删除边界 |
| `qa/wallpaper/library.test.mjs` | 既有两项MP4检查改用真实桥接，核实ASCII路径/实际字节，ACL和原生窗口仍明确替身 |

既有R1的null身份修复、R2的新面板模式/自动播放控件、年龄过滤和Lucy-only自动播放名单不变。scene/Lucy仍走原项目文件；浏览器请求只投影原ID/模式/时长，不接收entry、缓存根或lease。

## 数据流和限制

1. 实际library先重新验证批准根、类型、声明及entry，再进入桥接；桥接只接受本地MP4 video。源与project分别检查逻辑路径每一组件、物理路径精确一致、单链接常规文件及Windows全部ReparsePoint属性；不通过UNC/设备路径找替代。
2. 缓存根固定为Host环境的`LOCALAPPDATA\Whale Appearance\media-bridge`，完整路径必须ASCII。无用户目录、Unicode、权限或重解析异常即失败；无其它盘/公共目录回退、无前端指定路径。检查所有权为当前用户；写/删/改权限只容许当前用户、SYSTEM、Administrators。额外只读ACL不被误当写权限。
3. 默认受控复制，不启用8.3、不做源文件硬链接、改名或移动。此前现场GetShortPathNameW已返回原中文长路径，未得到ASCII别名；本轮没有重复操作实测源。源文件只读句柄贯穿复制，fd和路径的dev/ino/size/mtimeNs/ctimeNs/birthtimeNs前后相符；project完整SHA256和再次真实声明复核也必须相符。
4. 每轮新UUID目录和不可复用owner标记。跨实例`budget.lock`排他创建，无重试/偷锁；目录遍历按条读取且有上限，未知文件/损坏owner拒绝。文件用wx创建；最终副本用`COPYFILE_EXCL`排他复制而非可能覆盖目标的rename。部分文件及最终副本均作完整字节数/SHA256验证，验证成功后才交给helper。
5. 单媒体默认上限512MiB，总媒体预留1GiB，同时至多2个租约；剩余磁盘还需16MiB余量。发布阶段可能同时持有partial和clip，**每个租约按媒体大小两倍预留**，成功删除partial后仍保守保留该预留直至释放。因此接近512MiB的活动视频可能没有空间再预备重启，失败会保留原活动源。Host覆盖只允许降低上限。
6. 准备/再次验证/释放各有30秒操作期限，锁解开不另起30秒预算；每个句柄收束最多再等1秒（源/目标两个句柄合计最多再等2秒）。真正挂起的底层IO不能假装取消成功：停止继续工作、保留文件/配额/锁，晚到句柄只在原IO落定后关闭，绝不让晚到复制重新开源。
7. restart先完成新选择验证、模式校验与复制，再关闭旧源。start/stop/unload代次贯穿复制、输出目录准备及最终session开源。真实session拒绝没有匹配lease的MP4；helper最终只接收复核后的ASCII副本，同时保留原ID及既有1280×720、初始屏外、FPS、等待与采集链路。
8. token尚未交给session时，只能按neverOpened释放；移交后归同一实际session生命周期。只有源关闭且capture/worker退出证明通过才释放文件，自动结束也走此路。窗口身份变化、worker未知、helper关闭失败时保留，正常重试证明后再释放。状态轮询不做复制或异步清理。
9. 清理只检查并删除同一owner目录的已知文件，不递归扫描删除历史目录；额外文件、替换inode、硬链接、改动标记或未知锁均保留。错误采用稳定MEDIA_BRIDGE代码，不将新增源/副本路径或原始IO异常放入公共状态。没有终止原WE或绕过原身份门禁。

## 独立验证与失败保留

运行器为证据目录`run-checks.cjs`：每个Node测试文件25秒截止，父监督30秒到期只结束本轮子树，35秒最终落定；所有执行均保存退出码、超时和exitConfirmed。没有仅靠process.exit闹钟、无限等待或全局杀进程。

| 检查 | 实际结果/证据 |
| --- | --- |
| 桥接专项最终版 | **38/38**，`bridge-accepted.result.json`，8.422秒，自有Node退出0且已确认 |
| Host/目录/MP4/UI/P0/P1A/目录初始化 | **223/223**（包含当时38项桥接），`accepted-final.result.json`，15.389秒；ACL实现最后补修后又执行上述38项及下列真实只读检查 |
| 独立窗释放专项 | **24/24**，`dispose-followup.result.json`，6.966秒，实际本地HTTP/SSE，自有Node退出0 |
| 语法及CSS | 6个交付JS/MJS语法和既有CSS模板保护通过，见`static-final.json`、`static-checks.json` |
| PowerShell语法 | 生成的两段编码脚本经Windows解析器检查无错误；不是执行验收 |
| 实际Windows只读IO | **1/1**，`windows-readonly-fixed.result.json`，0.726秒：真实.NET ACL/重解析查询仅作用现有LOCALAPPDATA，不创建缓存/操作应用 |

38项不是字符串拼接检查：真实注册→扫描/verify→桥接→createPreviewSession→helper argv，只有ACL元数据和native helper/capture底层替身。涵盖源/声明变化、同尺寸替换、删除、junction、非MP4/类型/批准根、Unicode/不可写/占用缓存根、配额/磁盘/跨实例租约、部分/损坏副本、复制及发布超时、迟到IO/close、锁删除失败、并发start/stop/unload、成功/失败restart、helper出错路径不外传、worker及窗口身份未知保留、最终正常清理、额外文件/错误owner/硬链接/未知目录和轮询无副作用。年龄/隐藏和自动播放门禁沿用相关实际controller/目录/UI回归，不把Host目录可用等同人工播放验收。

保留的失败及处置：

- 初始专项因进程替身没有真实子进程句柄维持事件循环，unref定时器导致测试被取消；增加测试范围内的受监督keep-alive后通过，没有改产品等待机制。重启夹具曾错误返回第一轮旧窗口名，修正为当前轮。
- “外来root目录存在就必须阻止删除自己lease”的过严断言修正：允许清理已完整证明归属的本轮文件，同时实测外来目录保持。硬链接/外来lease内文件仍拒绝删除。
- 合并`all-final`为243/245，两项旧dispose用例报undici `bad port`，没有当作成功。源码使用port:0；当时精确随机端口未记录，不能断言唯一环境根因。追加仅记录host/port、不含凭据的有界单项复核，24/24通过且未再出现；失败日志完整保留，未混改独立窗Host端口策略。
- 第一次**真实只读**ACL检查失败，诊断为`CouldNotAutoloadMatchingModule`；当前父环境继承的PowerShell模块路径使cmdlet加载失败。ACL本身只读核对符合策略。已去掉Get-Acl/Get-Item/Import-Module依赖，改用.NET GetAccessControl/GetAttributes；同一只读检查通过，专项同时约束不得重引模块依赖。未改执行策略或ACL。
- Grok的三个失败任务不抵消最后真实完成的设计反馈，也不算代码交付；全部按监督截止收束。源码和相关测试不依赖Grok成功状态。

## 保留风险与下一步

- Windows ACL和源/worker窗口操作是不同层。只读ACL通过，没有执行正式安装Host中的真实缓存创建、helper打开/捕获或用户视觉验收；解码、音频、帧率、长循环、所有视频均未证明。
- 用户态路径/身份/hash/ACL和协作锁用于发现普通文件变化及并发错误，不是Windows内核沙箱，也不声称可防同账户恶意程序或管理员在检查间隙改写。超时底层FS尚未退出时宁可保留未知，不能宣称OS IO已被强制取消。
- 失败/取消的准备可能保留partial、owner和锁，并继续占配额；没有后台过期回收或“清空所有缓存”按钮。达到限制需先按owner及进程事实单独安排安全回收，不能要求用户盲删、偷锁或误用源关闭成功解除未知IO。此处只提供明确失败与有限磁盘占用，不扩张清理任务。
- 原中文路径黑屏、日志损坏和同SHA ASCII副本正常支持路径兼容问题；副本也换了目录/盘符，具体内部转码边界仍未定。没有承诺桥接能解决全部视频问题。
- 下一步从不可变rc.38/已审视频差异最小整合**新版本候选**，合入此前UI R1/R2及本轮桥接。原生12文件沿固定已审P4基底，禁止把当前开发Trace/P1A/GPU其它差异整体打包；独立核对版本、逐文件资产、无Trace及实际入口。旧rc.39保持不可变。
- 候选核包通过后，重新取得用户当时方便/无任务确认，按新备份→临时安装→同一批准Everyone视频→停止清理→必要时恢复的顺序短验。当前“继续”只推进已授权离线实现，不代替未来真实应用操作确认。

独立设置UI、作者参数、web/application、A滚动、三体/GPU专项仍按原排期后置。
