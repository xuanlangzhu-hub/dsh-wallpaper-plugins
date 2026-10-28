# 首个 GitHub Release 准备

## 当前材料状态（本轮补录）

用户继续后，公开图标声明已精简，回忆／工具细节保留审查记录；当前外层d轮ZIP固定文本LF、原RTF字节，SHA256已核对。
发行材料83260ab已推送，[带附件的GitHub预发行草稿](RC53_GITHUB_PRERELEASE_DRAFT_20261028.md)已创建并下载复核。
当前draft=true／prerelease=true、未公开、无正式tag；公开发布在用户最终决定后处理。

用户随后要求继续准备，已完成[本地下载包与许可核对](RC53_FIRST_RELEASE_BUNDLE_20261028.md)：
原tgz字节不变，外层ZIP包含说明、完整许可、8个未修改NuGet DLL的来源指纹和校验清单。
SDK两个DLL的再分发清单与完整条款已核对，不能将它们归为项目MIT。
用户随后回忆白鲸ICO由DeepSeek蓝鲸／Harness黑鲸标志改白并对眼睛、腹部镂空透明，
具体原图与生成工具已无法确认；已如实写入随包署名和来源清单，不标为独立原创或项目自有MIT标志。
**资料已备好，仍未公开，`publicReleaseReady=false`；下一步按用户的GitHub预发行安排处理提交与发布，不发布npm。** 本轮没有应用操作。
下文保留推送阶段发现和材料形成前的检查背景，其“尚需收集许可”现由该核对报告接续。

2026-10-28。用户当前授权为“先推送”，并希望接下来准备仓库的第一个Release。**本轮提交推送源码／QA／交接和固定rc.53文本快照；没有创建Release、标签或npm发布。** 日常rc.53保持，不为发行准备操作DSH／WE、Profile或生产资产。

## 已具备的基础

- 远端：`xuanlangzhu-hub/dsh-wallpaper-plugins`，公开仓库、默认main；本轮开始远端main为`9e036e3dcffec299da2a38a4a6bd08b7758bec53`，与本机一致。GitHub CLI只读查询返回Release列表为空，确为本仓库首个Release准备。
- [rc.53日常交接](RC53_DAILY_TRIAL_20261028.md)已闭合；用户先确认限定短验的切换／Float时钟效果，再确认另行日常安装重开正常。不因当前通过宣称长期稳定或所有壁纸支持。
- 固定候选原包43文件，SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`，7,261,385字节。当前只有client／版本／README相对rc.52变化，四个就绪运行文件及14资产继承，Trace未混入。
- [release-sources/rc53](../release-sources/rc53/README.md)新增29份原包文本、完整43文件清单和实际整合的构建用侧栏模块。原包client与侧栏源片段字节核对通过，三诊断接点保留；不把共享rc.30开发树冒充日常包。
- 本轮运行生成片段一致性、npm run check、20项选择／参数ID单测、固定快照client／模块语法检查，均通过。既有984／58／最终169及实际包SDK15场景按未变输入指纹复用，不机械重跑或累加数量。

## 版本与附件方案

建议首个GitHub版本仍标为 **Pre-release（预发行）**，以实际固定候选`0.6.0-rc.53`为参考；拟定tag `dsh-whale-mist-v0.6.0-rc.53`，尚未创建。不要直接命名为稳定0.6.0，也不要为了好看给已验包换版本而不记录。

预期交付：安装包／带必要说明和许可的下载包、SHA256校验文件、简短安装说明、已知限制。**附件方案尚未最终核验，当前本机tgz不能直接当“发行材料已齐”。** 原tgz保持原名、字节与哈希，不同版本／新增发行载荷另存，不覆盖已验归档。

GitHub自动生成的Source code.zip／tar.gz是整个开发仓库，含历史QA、共享rc.30 manifest及Trace开发源码，不能当作插件安装附件。安装说明必须指向明确的已审附件。仓库不包含Wallpaper Engine、壁纸本体、官方DSH安装器或用户Profile。

## 尚需完成的发行材料

本轮实际检查发现：仓库原先只有package.json的`license:MIT`字段，没有根LICENSE；本次按既有MIT声明补入项目[LICENSE](../LICENSE)。**已验rc.53原tgz内仍没有LICENSE或第三方NOTICE文件**，没有因为仓库补文件而改写原tgz。

实际`WallpaperProbe.deps.json`和本机对应NuGet元数据给出以下清单，属于版本来源核对，不等于完成法律条件或完整再分发审查：

| 包／随包文件 | 版本 | 本机NuGet声明／来源 |
| --- | --- | --- |
| Vortice.Direct3D11、DXGI、DirectX | 3.8.3 | MIT；Amer Koleci and Contributors；Vortice.Windows commit `9e609cb9439c9872aa1b339f177e40ec96f77239` |
| Vortice.Mathematics | 2.1.0 | MIT；Amer Koleci and Contributors；commit `fa05ec6dcba48f3f7331791da6dc7f3d866b2ad6` |
| SharpGen.Runtime、SharpGen.Runtime.COM | 2.4.2-beta | MIT；NuGet列Alexandre Mutel、Jeremy Koritzinsky、Amer Koleci版权；commit `6990bcafe124a4c22515ad19cee5a081da8db67b` |
| Microsoft.Windows.SDK.NET.dll、WinRT.Runtime.dll | runtime pack Microsoft.Windows.SDK.NET.Ref 10.0.19041.57 | NuGet指向[Windows SDK许可](https://aka.ms/WinSDKLicenseURL)，没有MIT表达式；不能把这些文件一概归入项目MIT |

下一步收集相应许可原文／NOTICE，并核对Windows SDK具体随包文件的再分发条件，再固定下载包结构；不要只复制一个MIT文本就称所有二进制声明完成。若只增加外层说明／许可，保留已验tgz不变；若必须改变插件归档载荷，则另起可追溯发行候选，保存差异及最小必要验证，不同字节不冒充同一个固定包。

GitHub Release与npm为两件事。`private:true`不阻止在GitHub提供附件，但当前不是可直接npm publish的配置。npm账号已登录不等于包名、访问权、private字段、内容和预发布标签已审核；本次不进行npm操作。

## 公开说明草案与下一步

面向用户的[发布说明草案](releases/0.6.0-rc.53-draft.md)已准备，列出实测范围、依赖、安装方向及已知限制，未创建在线草稿或发送公告。完成许可证／附件核对、选定包含固定快照的提交、重新确认用户发布安排后，再建tag和首个预发行。

日常先继续使用rc.53，有反馈先修复。三体源端节奏、任务栏初始入口、滚动和宿主bad port事件仍按已有边界保留；不把“首个Release”写成这些问题已解决。
