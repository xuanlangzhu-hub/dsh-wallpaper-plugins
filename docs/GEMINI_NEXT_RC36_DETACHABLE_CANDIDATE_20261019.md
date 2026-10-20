# 给小G：rc.36隔离候选整合，不安装

2026-10-19，用户在[P1B-2五审离线通过](DETACHABLE_APPEARANCE_P1B2_FIFTH_REVIEW_20261019.md)后明确同意继续。**本轮授权从固定rc.35基底构建并离线验证独立rc.36候选；尚未授权操作日常DSH/WE或安装。** Codex负责边界/独立复审，你负责隔离整合交付，不并行修改生产实现。

## 当前完成范围与本轮产物

已有P1A十审、B清理恢复六审、P1B1六审、P1B2五审离线成果；本轮将必要已审增量带入同一个干净候选，不新做功能。目标包括顶栏入口、独立/吸附外观、共享控件、图库/详情、三类年龄筛选和B恢复链路。作者专属壁纸参数、滚动A、三体、GPU/性能均不加入。B只是异常后恢复门禁，首次断流根因仍未知。

生成独立stage、可重复执行的组装/核包脚本、完整逐文件哈希/来源与差异说明、候选tgz、实际候选QA证据，以及`docs/RC36_DETACHABLE_CANDIDATE_DELIVERY_20261019.md`。交付后停下等Codex复审，不自行安装或推进新专项。

## 不可变基底与已准备材料

- 固定原包：`F:/dsh-wallpaper-plugins/release/plugins/dsh-whale-mist-0.6.0-rc.35.tgz`，SHA-256 `20D35ED1A63E2272FF50E44A9A38891F1D973994BED446FB19D79B0A9E6FAE58`。本轮Codex重核一致，28文件；14个assets文件，其中assets/wallpaper为12个运行文件。
- 目标版本`0.6.0-rc.36`，本次核对正式归档名尚未占用。只在新的隔离stage修改版本，**工作区package.json仍rc.30、生产assets不变**。已有归档全部保留；如目标名意外已被占用，报告事实并保留两者，不覆盖。
- 最新已审完整源码/QA：`.tmp/detachable-p1b2-fifth-review-20261019-af4d4200/dsh-whale-mist/`。本轮158项当前输入与五审指纹一致。不要整份复制其src，里面仍有Trace。
- 本轮准备目录：`.tmp/detachable-candidate-preparation-20261019-703f459d`，preparation.json有原包28项哈希、B对应版来源、客户端patch及指纹；reviewed-source-before.json/protected-before.json分别保护158项输入和42项资产归档。rc35-base/package只是原包解开副本，未写候选。

## 按来源白名单整合

| 文件/组 | 来源及准入要求 |
| --- | --- |
| assets全部14文件、src/windows/WhaleDesktopIcon.cs、cordis.patch.yml | rc.35原包逐字节保持；不编译/替换任何原生文件，不改patch其它插件 |
| src/wallpaper/frame-hub.js、frame-protocol.js、probe-log.js、scenes.js | rc.35原包保持；不复制工作区观测/传输增量 |
| src/wallpaper/session.js | B六审冻结的rc.35对应修复版：`.tmp/wallpaper-cleanup-b-sixth-review-20261018-48d3821a/rc35-delivery/rc35-repaired/src/wallpaper/session.js`；SHA-256 `2AF9E5011933844E2B4DCE53D99E867E49C1AFB8DF67CC3B499244155EE4E4E5`。不要用工作区带Trace的session替代 |
| src/wallpaper/managed-window.js | 同一B六审rc35-repaired对应文件，SHA-256 `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` |
| src/index.js、src/wallpaper/catalog.js、src/wallpaper/library.js | 从五审冻结src挑入已审接入/共享库/预览分级实现；逐项核对依赖闭包及无Trace，记录与基底差异 |
| 新增detachable-contract.js、detachable-bridge.js、detachable-host.js、detachable-edge-adapter.js及companion三文件 | 从五审冻结src逐字节挑入，记录源/目标哈希。保留主端唯一controller、token/instance/lease、严格创建身份与有界清理、不安全状态保留，不因候选整合放宽门禁 |
| src/client.js | 以rc.35不含Trace的client为底，仅应用下述已准备产品差异；不要复制工作区整份client或用模糊正则“删掉Trace” |
| package.json | 从rc.35manifest派生，只更新stage版本及必要新增文件白名单（四个detachable JS和companion文件）。保留rc.35 engines.dsh和全部peerDependencies的新宿主0.2.1-rc.2支持、原注入/exports/权限声明；不拿工作区rc.30 manifest覆盖 |
| README.md | 从rc.35说明最小更新：新增功能/三分级默认Everyone、unknown无图、实验性质、实际验收边界、.NET/Edge依赖及回退rc.35。不可声称原生窗/吸附或B实机已验 |

新包预期为rc.35原28文件加四个detachable JS和三个companion文件，共35文件。若工具引入不同文件集合，解释并审计，不为了凑数吞掉必要文件；不打入QA、机器路径证据、私有图片、缓存、Profile、node_modules或诊断脚本。

### 客户端差异已做干净应用预检

Codex找到rc.34构建时的已审`approved-workspace-client.js`（当时含Trace，但外观功能已齐），与五审冻结最新client比较，得到**21个hunk、变更行不含Trace符号**的产品patch：`.tmp\detachable-candidate-preparation-20261019-703f459d\approved-product-client.patch`，SHA-256 `8CCBB338BB010BD233A37084143030C19CC8630014CD10E289756336EC4DD909`。

`git apply --check`在rc.35解包副本通过（exit0），只做预检，尚未应用/构建候选。Windows Git的--directory要使用正斜杠，本轮最初反斜杠路径被Git拒绝，转换后预检通过，日志client-overlay-check.log保留当前结果。

请在你自己的新stage应用该patch，记录实际命令/结果；再在验证副本反向应用同一patch，恢复rc.35 client逐字节一致。反向恢复证明差异可追溯，不代替功能回归。候选最终需独立扫描无`cadenceTrace`、`CADENCE_CLIENT`、`cadence-trace`及Trace路由/导入/环境开关，保留整体差异供复审。若上下文变了，不用--reject/fuzz强行吞冲突，先报告差异并只作有依据的隔离合并。

## 实际候选离线检查

所有测试必须绑定**候选stage或解包后候选自身代码**，不能仍导入工作区或五审源然后声称候选通过。为测试提供独立外部QA/fixture，不把它们装进包。

1. 核对所有本地imports、静态页清单、引导路由、manifest注入/compatibility及35文件闭包；对candidate JS语法与CSS模板运行适用守卫。排除Trace，保留原28项中不应变化文件的逐字节比较。
2. 复用已审P0/P1A、共享控件/权威动作和P1B2实际HTTP/分级/图片生命周期测试，最小覆盖绑定candidate。U1/U2的原负例、分级读取0及相应合法200必须对candidate跑一次，不仅复制历史PASS。
3. B恢复用六审的rc.35对应默认解析/完整路由负例及两个事故回放验证candidate session+managed-window；只替换底层进程/CIM/窗口IO，保留离线guard，不执行真实PowerShell/taskkill/WE。不可把B对应版与工作区全量session测试不兼容当成原生故障。
4. 挑一轮真实隔离headless + React生产panel + 生产认证桥接 + 实际候选Host/临时库短路径：Everyone默认可解码、全不选0新增读、显式Mature无害夹具可解码；确认挂载/参数修改和预设仍走权威controller，不把MockElement手填width或假useState blob当成真实解码。沿用已有依赖，不新造平台、不反复截图/跑无关长矩阵。
5. 用本地已有官方0.2.1-rc.2 SDK/声明逻辑做必要接缝验证；index.apply只允许隔离环境与记录路由的webServer/窗口IO替身，严禁启动日常宿主/图标helper或实际壁纸。不发模型请求，不扫描/加载用户成人图片。

**所有QA必须有阶段/总期限和独立外层监督，退出/close/fetch/CDP有界，清理只针对自己创建的进程/服务/profile并确认。** 复用safe-qa-runner SHA-256 0128591FA1C8115FEA2B4ACAF83D98E3BBB2306D284E6BE95E5EC9B17B34B66A。不要把“每个子脚本15秒”说成“全套30秒”。一次只跑有界检查，不启动无限watch、npm test常驻、无返回脚本或靠用户提醒停止；硬超时/清理不明非零并保留证据，不全局结束node/Edge。

## 包与交付

仅在隔离stage执行无安装/生命周期脚本的打包（例如npm pack --ignore-scripts --json），不在工作区直接pack。用明确可追溯的包文件路径核验，审计归档无路径穿越/链接、每个包内文件与stage字节一致，生成新增/变化/保持清单和全量SHA256。原生运行文件12项、其它assets与图标源码需逐项保持rc.35。

成功后独占写入`release/plugins/dsh-whale-mist-0.6.0-rc.36.tgz`，如同名存在不覆盖；不npm publish、不写任何安装目录。保留stage/脚本/patch/原始日志/真实cleanup结果，不清理旧证据。记录可重跑的候选QA入口，不用“全量已通过”替代命令/路径/退出码/期限。

交付报告须列：基底指纹、候选指纹/大小/文件数、逐文件来源与diff、保留原生运行文件、无Trace证明、actual-stage QA与替身/真实浏览器边界、workspace/旧归档前后保护、尚未验收的真实系统窗/吸附/长期效果，以及未来短验的备份/默认恢复rc.35计划（只写计划，不执行）。

完成后停止，等待Codex独立核包。**日常安装仍DSH0.2.1-rc.2/外观rc.35/Git Bash0.1.1，工作区manifest/assets仍rc.30，不操作DSH/WE/Profile、不发模型请求、不提交推送清理；A低优先级、三体/GPU暂停、定时PAUSED。** 新阶段只放行隔离候选产物，不沿用历史实机授权。

转达记录：已向Antigravity原对话44d9b078-56c9-47a4-aa8a-a1f673d23d0e发送一次候选整合任务，核验新用户消息、输入清空及Working/Cancel；Gemini 3.8 Flash High保持。候选交付后再独立核包，未恢复定时或启动日常操作。
