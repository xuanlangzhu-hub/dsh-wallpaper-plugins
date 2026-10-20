# rc.37实机发现：Edge自动登录提示与吸附清理查询失败

最新接续：[主端收尾确认补修已通过](COMPANION_DISPOSE_ORDER_REPAIR_REVIEW_20261019.md)，24项专项/31项回归通过；[rc.38候选已独立核包](RC38_COMPANION_REPAIRS_CANDIDATE_REVIEW_20261019.md)，日常rc.35保持、未安装。下文“待补”是当轮发现历史，以本条及新报告为当前结论。

最新阶段：[R2源码补修通过](COMPANION_R2_CIM_SOURCE_REPAIR_REVIEW_20261019.md)；[R1隔离访客短验及源码补修通过](COMPANION_R1_GUEST_SOURCE_REPAIR_REVIEW_20261019.md)，用户确认无提示、80与吸附关闭，自有资源清理确认。另发现主端dispose认证顺序竞争待离线补修；日常rc.35保持，旧rc.37不含修复。以下为此前实机发现与拒绝历史，不覆盖最新结论。

2026-10-19，Codex；关联[本轮短验与恢复](RC37_CATALOG_INITIALIZATION_SHORT_TEST_20261019.md)。**亮度80在两端一致获用户确认，但吸附清理未通过；不保留rc.37日常、不继续播放、不覆盖固定归档。已恢复rc.35和本轮设置，用户确认重开正常、外观布局正常、播放停止。**

## 实机证据与范围

用户在弹出独立窗后观察到Edge自动登录/同步浏览数据提示，吸附后主界面出现“窗口关闭待确认”错误。两张截图保存在本轮私有证据 `.tmp/rc37-detachable-short-trial-20261019-a69050a2/incident-diagnosis/user-screenshot-1.png` / `user-screenshot-2.png`。截图含个人账号，报告与交付不要复制账号文本、不要发布原图。

“80没有问题”仅确认设置同步；独立页能显示并执行修改已有用户实机证据，**吸附资源清理、Lucy播放/停止、其它功能仍未验收**。此前开始按钮可用的用户反馈保持。上轮笼统的“Windows信息收集消息”不能追溯断言与本次Edge提示相同。

## R1：临时Edge配置仍出现账号/同步提示

真实启动参数包含独立 `--user-data-dir`、`--app`、`--no-first-run`、`--no-default-browser-check`、`--disable-extensions` 和 `--disable-background-networking`。已有参数没有在本机阻止这项提示，不能把新目录或无首启参数称为账号隔离保证。

微软[ImplicitSignInEnabled官方文档](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/ImplicitSignInEnabled)说明，未关闭隐式登录时Edge可以依据操作系统登录情况尝试浏览器登录；这是与本次现象相容的机制线索，尚未采集该临时配置或策略状态来证明本机具体触发链。[BrowserSignin官方文档](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/browsersignin)还区分浏览器登录与同步，并标记该策略非逐配置生效。因此不能从弹窗断言实际上传了什么，也不能靠修改全局注册表/组策略来修插件。

补修要求：研究只作用于本插件新建临时配置/当前受控进程的登录与同步抑制方式，给出可验证来源与适用Edge版本；保留本机日常Edge设置、账号、Profile和系统SSO。不得自动点击同意、访问个人历史/凭据、把 `--disable-sync` 等未经本机验证的旗标写成“已解决”。若没有可靠局部方案，明确交付限制和备选方案供用户决定，不擅自换窗口宿主或安装新依赖。

离线验收至少覆盖真实launch spec和适配器调用链、参数唯一性/转义/新配置范围、配置初始化失败不启动与不破坏原Profile；实机无提示/不隐式登录只能在新一轮方便确认后的可见短验判定。本轮不再启动Edge。

## R2：生产默认CIM查询未正确序列化Windows路径（阻断）

冻结本轮固定rc.37中的 `detachable-edge-adapter.js` / `detachable-contract.js`。`queryWindowsProcessesByProfile`只对单引号做重复，直接把Windows反斜杠路径插入 `CommandLine like '%...%'`，再嵌在PowerShell双引号中。实机错误包含 `0x80041017`（无效查询），与生产生成命令一致。

Codex原生只读最小复现：`incident-diagnosis/cim-probe.mjs`，使用不存在的合成临时路径，不启动浏览器、不操作日常进程或配置，实际调用本机powershell.exe/Get-CimInstance。结果 `cim-results.json`：

1. 冻结原函数、原命令序列化：ok=false，HRESULT `0x80041017`，进程正常退出。
2. 只在底层执行边界把该合成路径的反斜杠转义：ok=true，pids=[]，进程正常退出。

由此确认当前Windows路径的反斜杠序列化缺陷；第二项只是诊断对照，**不是已审生产修复**，不能据此忽略单引号、PowerShell双引号/美元符/反引号、WQL LIKE通配符及名字含特殊字符的路径。空查询只在成功且解析可信时成立；当前原函数的失败返回虽然带pids=[]，ok=false必须沿全链保留，不能转成可删除或可信无人占用。

交付要求：

- 在独立副本修生产默认查询，不依赖把 `execCommand` 换成总返回[]的QA。序列化须分别处理PowerShell与WQL/LIKE边界，或采用不插入路径的查询设计；后者必须说明扩大查询集合后如何保留保守归属和缺失数据边界。
- 维持PID/完整可执行路径/精确user-data-dir/严格CreationDate及再次身份复核，不允许路径前缀误判、PID回收误关、原浏览器误关或全局taskkill。
- 所有查询/关闭/退出确认有阶段上限和外层截止；查询异常、损坏输出、超时、身份未知时维持待确认并保留配置，不吞错为成功或先删目录。
- 用真实本机只读CIM解析覆盖HP普通路径、空格/中文/单引号/美元符/反引号/方括号/百分号/下划线等合成路径；用受控夹具证明精确归属、同前缀不同目录及缺失身份/回收/迟到结果。每个用例有断言与截止，不拉起Edge/DSH/WE。
- 真实适配器 close/资源组检查完整路由回放应覆盖父已退出/孩子存活/零进程/查询失败/已确认终结等路径；动作IO可以替身，默认命令生成和真实CIM解析必须另外覆盖，标清两类证据。

## 协作及交付约束

Grok仅在独立快照中给出小范围提案/QA与报告，由Codex复审后再决定提升。先R2最小补修，再独立给R1方案和证据；不得假称R1已修。日常rc.35、manifest/assets rc.30、固定rc.35/36/37原包及原有Trace/P1A/脏改动保持。不整体打包、不升级安装、不操作用户应用、不发DSH模型请求、不改系统/Edge全局设置、不提交推送/清理、不恢复定时。用户后续方便确认前不做可见实机验收。

## Grok两版提案独立复核：均未通过，未提升源码

Grok实际接收并完成两次隔离REPORT文件编辑：`rc37-cim-serialization-proposal-867f70a7`（约84.4秒）及 `rc37-cim-three-repair-d8ee12aa`（约42.8秒），各90秒总限、无终端/应用/真实仓库写权限，均正常退出，无常驻等待。输入/原提案/补修提案和失败结果均保留，不因工具任务ok就判产品修复通过。

Codex用受监督的自有Node子进程作为身份夹具，给其真实命令行传入合成user-data-dir；真实本机CIM返回ProcessId/可执行路径/命令行/CreationDate后交给冻结的生产分类器。没有启动Edge或扫描/关闭日常浏览器，夹具都在finally中结束，外层40秒截止未触发。九组路径必须精确找回自有PID，不能只断言命令退出0或空数组。

- 首版普通、空格、美元符、反引号、百分号、下划线6/9组成功；中文和方括号路径查询ok却漏查，单引号路径仍InvalidQuery。证据 `proposal-native-results.json`、`proposal-check-result.json`，约10.4秒。
- 第二版补WQL单引号、右方括号处理及当前PowerShell进程UTF-8输出后，8/9组成功，仍在单引号路径漏查真实进程，拒绝提升。证据 `proposal-native-v2-results.json`、`proposal-check-v2-result.json`，约10.1秒。首次测试副本读取漏指定utf-8而被Windows默认GBK拒绝，只修测试文件读取方式；不改产品迁就。
- 原生附加取证 `apostrophe-parser-result.json` 确认：CIM已经返回自有夹具进程，但真实 `extractUserDataDir` 把未加双引号的 `...apostrophe's` 截断为 `...apostrophe`，最后query竟返回ok=true/pids=[]。这是路径参数解析的另一处缺口，**仅修WQL模板不足以闭合R2**。修复必须按Windows命令行的引号语义保留未引用参数中的字面单引号，保留原有双引号/空格/前缀和身份门禁，再复核真实close/资源组完整路径；不能把本负例删掉或改成期望空集。

因此目前只有“原始错误已复现、补修方向和负例已具体化”的结论，R2尚未解决；R1亦未修复。尚未修改生产适配器、未做新包。下一次只派本节单引号解析最小补修及原有路由回归，不从头重复大范围调查。
