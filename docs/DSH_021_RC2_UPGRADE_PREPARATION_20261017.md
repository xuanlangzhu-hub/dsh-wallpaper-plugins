# DSH 0.2.1-rc.2升级准备：安装与回退材料已核验，先适配两项插件

最新接续：[rc.35与Git Bash0.1.1候选复审](DSH_021_RC2_COMPAT_CANDIDATE_REVIEW_20261017.md)已通过核包、声明和实际新版SDK离线检查，可以安排当时方便确认、新备份和升级短验；尚未安装或进行真实新宿主验收。下文“尚无候选/门禁拒绝”描述的是原rc.34及Git Bash0.1.0的准备阶段，原包保持不可变。

2026-10-17，Codex。按用户“等小G修好先把更新dsh排在前面”“准备一下看看怎么更新dsh”进行离线准备。本页接替[rc.1初评](DSH_021_RC1_UPGRADE_INITIAL_ASSESSMENT_20261017.md)的升级目标，历史调查保持。

**建议目标改为0.2.1-rc.2；目前先不直接点击更新。** 官方Windows nightly源已指向rc.2；rc.2新增Flash-1017以及DeepSeek Search/Fetch支持。但新宿主实际兼容函数会拒绝现有鲸系外观rc.34与Git Bash 0.1.0。需先做兼容候选，不用独立设置P0开发代码替换日常包。

## 版本与来源

- [官方rc.2发布](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2)：2026-10-17 08:16:33 UTC（北京时间16:16），发布说明明确上述两项新能力。
- [rc.1发布说明](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.1)仍是从0.2.0-rc.2到0.2.1系列的大部分变更依据，含字体、插件热重载与兼容规则变更。
- 当前安装目录的官方`resources/app-update.yml`指向`https://download.deepseek.com/dsh-desk/feeds/win-x64/`的nightly频道。本次保存的nightly.yml为0.2.1-rc.2，releaseDate为2026-10-17T09:22:23.750Z（北京时间17:22）。GitHub两版release的assets均为空；实际Windows包以官方更新源及签名为证据，不把空assets理解为没有安装包。
- 新包实际package.json：0.2.1-rc.2，dshBuildDirty=false，dshBuildCommit=`332895e0f7c9d4dbfb29729f5eb367fa263ff986`。发布标签网页与打包commit不混写成完全相同。

## 安装包及回退材料已准备

证据根：`.tmp/detachable-appearance-p0-sixth-review-20261017-a7fc57b6/upgrade`。此目录保留，不属于可清理构建缓存。

| 材料 | 文件/校验 |
| --- | --- |
| 新安装包 | `deepseek-harness-0.2.1-rc.2-win-x64.exe`，289,385,456字节 |
| 新包SHA256 | `72E4A8579F11B5428DD0A1506532777924ADBA7ECAACC710A7E429085796537F` |
| 新包SHA512 | 与本次官方nightly.yml一致，见`0.2.1-rc.2-download.json` |
| 旧安装包 | `deepseek-harness-0.2.0-rc.2-win-x64.exe`，289,313,640字节 |
| 旧包SHA256 | `D61CD8882F8B8A1251144320493AD27920D15139503EBA2465B9579EEE720CFC` |
| 两包签名 | Authenticode均Valid，DeepSeek官方发布者；证书指纹`84032578657219876E273E0D1BD303CFE1B82E6F`，见`signatures.json`的Status=0 |
| 旧包内容核对 | 只解包旧app.asar，SHA256=`983CA71114E6DFD353FC79AF5A1F9481A250EE64C2A3C757673029B811B23BC2`，与当前安装磁盘文件逐字节哈希一致 |
| 新包app.asar | SHA256=`47874618BF5B3011FCAAC10CD4C85F69DA333E70D4F99B921207C78D0999512A` |

下载来源均为`https://download.deepseek.com/dsh-desk/bin/win-x64/`下对应版本。安装器从未执行，仅用独立7za解包指定resources文件做源码检查；7zip-bin工具归档经npm发布元信息SHA512核对。`extract-rc2.log`与`extract-old.log`退出0；解包器列出自解压归档警告，文件解出成功，该警告不作为安装验收。

## 实际兼容门禁：两项需适配，两项仅声明检查通过

只读核对当前Desktop Profile的4个第三方依赖和它们引用的固定tgz；未写Profile，也未运行其插件代码。

使用**新安装包实际**`@deepseek-ai/dsh-app-boot/lib/index.js`的兼容函数原文与同包semver，在隔离目录调用；非仅凭版本号猜测。原文提取副本为`compatibility-check.mjs`，结果为`compatibility-results.json`。

| 当前插件 | 对旧0.2.0-rc.2 | 对新0.2.1-rc.2 | 实际下一步 |
| --- | --- | --- | --- |
| dsh-whale-mist 0.6.0-rc.34 | 通过 | 拒绝，6项UI peer均未覆盖新版 | 从rc.34不可变归档做独立兼容候选，核对实际API/槽位/主题后声明 |
| dsh-whale-gitbash 0.1.0 | 通过 | 拒绝，agent-preset/pwsh-sandbox/tool-bash精确锁旧版 | 核对新标准工具组合及执行器接口，另做兼容候选 |
| dsh-reasoning-effort 0.8.0 | 通过 | 声明检查通过 | 仍待真实新宿主验证控件、模型与档位 |
| dsh-pet 0.3.0 | 通过 | 声明检查通过 | 仍待新宿主显示/状态核对，不扩大为已验通知与全部功能 |

新规则优先`engines.dsh`，未声明则检查全部DSH peer；semver含includePrerelease=true。`engines.node`不代替`engines.dsh`。现有Profile没有本次新增版本豁免。本次检查不写入豁免，也不通过忽略门禁解决。

实际`loadProfileDirectory`在1025行调用此函数，不兼容bundle会进入skippedBundles，非自动证明整个应用必定无法启动。直接升级有丢失主题/自定义Git Bash预设的明确风险，不能建议用户点完再碰运气。

**通过声明门禁也不等于运行兼容。** 旧插件可能有布局、参数、服务/工具契约变化；不能只扩大peer范围就称完成。给小G的具体范围见[兼容准备任务](GEMINI_NEXT_DSH_021_RC2_COMPAT_PREP_20261017.md)。

## 新宿主窗口与设置路线

已只读核对新包`lib/main.js`及`lib/preload-app.cjs`：主窗口仍有contextIsolation/sandbox及setWindowOpenHandler限制；preload仍为专用IPC能力。本次未发现可直接替代P0路线的通用插件新建系统窗口入口，不将“新版”视为自动解决独立窗问题。后续正式接入仍需按新宿主接口核对。

## 具体升级顺序（尚未执行）

1. 先完成两个插件的兼容候选、审计和离线检查，保护日常rc.34原包；独立设置P0 H1/H2按[六审](DETACHABLE_APPEARANCE_P0_SIXTH_REVIEW_20261017.md)单独补修，不混进兼容候选。安装前重新确认更新源，若已再发新版则只报告变化，不擅自更换已审目标。
2. 具体材料就绪后，再询问用户当前方便/无任务、暂停其它助手、停止壁纸并通过菜单正常退出DSH。原WE保持；历史退出回复不能复用。
3. **关闭后新备份**当前Desktop Profile（含锁文件/完整依赖状态的恢复范围）、Electron userData `C:\Users\HP\AppData\Roaming\@deepseek-ai\dsh-desktop`，以及`.dsh`中的会话、附件、存储、配置、凭据及相关插件数据。升级范围大于单插件短验，不只备份旧5Profile/11个外观文件；不把明文凭据打印到日志或文档。`.dsh/backups`本身不递归嵌套备份，缓存/运行时是否纳入按实际清单与可重建性决定，保留已有原件。
4. 保留当前宿主安装信息、旧官方安装器、当时固定tgz及新备份指纹。先在旧宿主按审计过的方式安装同时兼容旧/新宿主的插件候选；再用官方rc.2安装器或已确认目标的官方更新流程升级，保持原安装路径。实际先后需依候选验证结果最终确定，不在此阶段改安装目录或Profile。
5. 用户正常重开，先核对新宿主版本和插件未被跳过、原外观/布局、模型/推理控件、Git Bash预设存在；保留播放停止。选一个已存在会话做只读显示/恢复检查，不为确认升级自动发送模型请求；Lucy仅做必要短播放/停止清理，不重做性能专项。新Search/Fetch是否开启另由用户决定，不自动改变付费服务/模型设置。
6. 如异常，先留现场证据并正常退出，再按当轮新备份及旧安装器回退。**旧app.asar一致仅证明宿主二进制来源可恢复，不证明升级后数据自动向后兼容**；升级后的新数据另保留，不盲目用旧快照覆盖新增会话，也不假定换回插件包就能回退宿主。官方更新器`allowDowngrade=false`，回退需保留旧安装器并按已核对流程处理，不能依赖更新按钮自动降级。

## 本轮边界

准备工作已完成到“确认目标/取得签名安装器与回退来源/实际兼容门禁定位/提出适配与升级步骤”。尚无兼容候选、关闭后新备份或新宿主实机验收，因此当前不进入安装确认。只改本仓库任务文档和隔离证据，未启动安装器、改官方EXE/app.asar、写活动Profile/存储、操作真实DSH/WE、提交推送清理或跨会话消息。当前磁盘宿主仍0.2.0-rc.2，日常插件原包仍rc.34。
