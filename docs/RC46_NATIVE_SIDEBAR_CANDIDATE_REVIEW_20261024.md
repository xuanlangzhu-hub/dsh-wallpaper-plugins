# rc.46 原生外观侧栏候选：实际核包复审

2026-10-24，接续[隔离候选源](WALLPAPER_NATIVE_SIDEBAR_CANDIDATE_SOURCE_20261024.md)。结论：**新tgz实际解包、静态／声明／SDK与适用回归通过，未安装或实机验收。** 日常DSH0.2.1-rc.2／外观rc.42／Git Bash0.1.1保持；共享manifest／生产assets仍rc.30。

## 固定候选

- 文件：`release/plugins/dsh-whale-mist-0.6.0-rc.46.tgz`。
- 字节数：**7,555,097**；43个常规文件，解包总字节28,186,991。
- SHA256：`E44108B008CB4D022136BD2568F4F02C75E303D0FF13678AAEE74F411E24DB7E`。
- 原生底座固定rc.45，14项资产（含12项原生运行文件）逐字保持，无编译、无开发Trace或新采集DLL。
- 归档经全部检查后才以排他新建复制到release；与实际受测tgz哈希相同。没有覆盖同版本包，原38个release归档保持。

本包的开发源来自前轮冻结43文件，**41文件原字节继承，仅package.json和README变化**；相对固定rc.45为5文件变化（上述两项及client／session／作者Host）和close-fence一项新增，其余37个底座文件保持。

## 元数据与说明

隔离build中版本改为0.6.0-rc.46；没有修改共享开发包的版本。README重写为本候选真实范围，去掉底座历史标题与已过期说明；明确目前未安装、未全面实机及独立窗迁移／其它作者目标等边界。

宿主兼容声明收窄为**0.2.1-rc.2**，只声明已验证宿主。原6项客户端依赖和peer范围保持，新增`@deepseek-ai/dsh-client-ui-sidebar-right`客户端inject及对应peer **0.2.1-rc.2**；版本来自冻结官方右侧栏manifest。运行时可用服务的可选生命周期仍在child inject内，没有因此把整个共享播放器挂到可替换的服务上，也没有缺服务时退回旧overlay。

官方`dsh-client-modules/lib/index.js`中的原始`optionalStringArray／parseDshClient`代码已直接用于验证实际归档声明，7项inject通过，3个损坏声明负例拒绝。SDK夹具从**实际解包manifest**取得右侧栏模块名再加载，报告另绑定manifest哈希；不是只沿用源码阶段硬编码的模块名。

这覆盖官方声明验证和隔离SDK加载，不是完整安装器／真实宿主启动验收。预检读取旧6依赖的逐包manifest时，发现冻结SDK仅存部分manifest、所尝试路径不存在；该只读预检停止，未改产品或生成包。随后以实际保存的官方右侧栏manifest及官方声明解析器作依据，不虚构未保存文件或扩大兼容范围。

## 构建与实际归档审计

从上一轮固定43文件复制到独立build，仅允许上述两项元数据／说明变化。使用本机Node／npm以`pack --ignore-scripts --offline`生成tgz，父监督5.009秒正常退出，未联网取包、未执行打包生命周期脚本。

随后读取这一个实际tgz，检查成员类型、package根、路径／大小、重复与大小写冲突、精确文件集合，再安全解包。结果：

| 门禁 | 结果 |
| --- | --- |
| 实际43文件 | 每项SHA256均与独立build匹配；close-fence.js确实在包内 |
| 固定源／底座保护 | 实际包相对冻结源只改README／manifest，14项资产等同rc.45 |
| Trace与额外材料 | 无Trace模块／API／开关／参数名称；不含qa、scripts或ESM sidebar源；ESM已作为client内单一来源生成块校验 |
| npm清单／完整性 | 实际成员与npm JSON的43项清单相同，SHA1／SHA512 integrity、大小和解包总字节一致 |
| 导入／语法 | 34条相对JS导入闭合，实际包23个JS全部语法通过；生成块和CSS检查通过 |
| 实际Trace路由 | 直接加载解包Host，即使传旧Trace选项，GET／POST Trace路径均404；关闭读数和dispose正常，native IO为0 |

Trace剥离的底座正面断言继承上一轮：客户端完整收帧／解码／调度／绘制路径与run context、背景绘制、frame-hub和原生createPreviewSession主体来自固定底座。它们在本轮实际包中又逐文件绑定到已审源，不把“搜索不到Trace”单独当作完整证明。

## 解包后重新执行的验证

证据：`.tmp/rc46-native-sidebar-candidate-20261024-9a58b3f2`，重点为archive-audit、npm-integrity-report、metadata-parser-report、candidate-ready、actual SDK报告及父监督结果。

| 范围 | 本轮结果 |
| --- | --- |
| 业务／回归及生成检查 | **977项、51阶段通过**；实际解包的关闭／作者Host、client与其单一来源侧栏参与。阶段子进程用时合计27.845秒，均确认退出且无超时 |
| 媒体／motion实际SDK | **19项通过**，5.888秒，真实WebM解码／文件选择／IndexedDB／来源失败恢复／同一video策略，实际解包Host关闭路由 |
| 完整原生流程实际SDK | **111项通过**，24.161秒；正式Whale apply、官方renderer／会话／右侧栏服务、图库／作者类型及恢复／外观／预设／入口互斥等旧流程 |
| 额外静态／边界 | 官方声明解析3负例、23JS语法、实际Trace路由边界通过；不额外计作977项业务用例 |

两组SDK共**130项**。productClient、packageManifest和authorHost指纹均必须等于实际tgz解包内容，媒体组proofHostInput等于包内session。verify内43个运行文件与实际包相同，另223项QA／ESM／生成器材料仅供验证；测试前后266项verify输入保持。没有将上一轮源通过结果替代本次包检查。

原HTTP401／409与资源错误门禁保持，未延长期限或放宽白名单。两组自有headless Edge、server及桥接均正常关闭、未强杀；卸载后订阅、refs、pins、DOM和活动URL为0，URL创建／回收分别13／13、7／7。所有素材为合成全年龄内容。

真实DOM、媒体与存储不等于实机通过：WE／窗口／作者命令底层IO仍为替身，motion焦点／页面隐藏是受控输入，减少动态用浏览器仿真。没有启动DSH或WE，没有用户桌面采样／截图、模型请求、属性命令、包安装或Profile写入。历史15项缺QA EXE、旧超时及首次断流／三体／滚动结论均保留。

## 下一步：分组短验准备

本轮核包离线范围收尾。下一步确认届时方便、无任务，用户暂停其它助手、停止播放并正常退出DSH；不能沿用过去的退出确认。确认后另做完整新备份，核对当时宿主版本、日常安装及本轮候选，再临时安装43文件。

首轮以原生最右侧容器／原外观、Everyone目录与最少外观交互、Lucy粒子即时关闭／恢复和停止清理为主；分小组，能代点的由Codex操作，用户只分次确认真实效果。新的Windows独立窗迁移、所有格式／主题矩阵不混入。普通本地视频真实焦点／最小化另分组，不能拿已有受控DOM结果直接勾通过。

默认测后恢复**当轮原设置／布局与rc.42**，先保留测后数据再恢复，只处理本轮安装差异。用户正常重开确认；是否保留新包作为日常另行决定。旧备份／旧包及用户后续数据保护不变。

普通外观持久化吞存储异常、Lucy之外作者设置、当前壁纸小预览、窄窗／长列表最终视觉及长期表现等仍按[首版清单](WALLPAPER_NATIVE_SIDEBAR_FIRST_RELEASE_CHECKLIST_20261024.md)保留，不因打包而宣布完成。

## 收尾保护

281项共享源码／QA／生产资产保持；上一轮43文件隔离源保持；原38个归档和21项冻结官方输入保持。新归档已复制到release供下一轮核对，原测试输出和实际解包目录保留。

本轮仅新增候选包／隔离验证材料／报告并更新接续入口，没有提交推送、清理、派发消息、操作其它助手或恢复定时。日常rc.42未改，开发manifest／生产assets仍rc.30。
