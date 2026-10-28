# rc.53 首个预发行：本地附件与许可核对

2026-10-28。承接用户“继续”准备首个 GitHub 预发行，本轮只制作本地附件和资料。
**没有创建 tag／GitHub Release／npm 发布，没有安装、操作或查询日常 DSH／WE／Profile。**
日常仍 rc.53。开始时 main 为 `b8554cbe14b192507657378a66baff11ab596957`，工作区干净；
本轮新增文件尚未提交推送。

## 实际附件

当前本机目录 `release/rc53-first-prerelease-20261028-d/`（固定文本换行；旧a／b／c轮保留）：

- `dsh-whale-mist-0.6.0-rc.53-windows-x64.zip`：7,013,702 字节，14 个条目。
- SHA256：`AFF40FFEA48298066403F6FE7EDF9E67888FC90CE2706549EB90B63678F99C24`。
- 同名 `.zip.sha256` 和本机 `audit.json`，后者不打入下载 ZIP。

ZIP 内是原 tgz、INSTALL.md、项目 LICENSE、第三方 NOTICE、6 份许可／条款文件、
43 文件 manifest、第三方 DLL 清单、许可来源清单及 SHA256SUMS。
不含备份、用户 Profile、真实桌面截图、壁纸预览／本体、WE、DSH 安装器、
共享 rc.30 开发树或 Trace。没有改写 tgz 内保留的历史 README；当前安装说明在外层。

原 tgz 仍为 7,261,385 字节，SHA256
`8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。
外层补资料不改变插件版本、运行代码或已验资产。

可复现配方为 [build-release-bundle.py](../release-sources/rc53/build-release-bundle.py)。
只读入指定原归档及白名单资料，输出目录必须不存在；不调用 npm pack、原生构建或安装器。
它检查归档及43文件逐字节指纹、路径和条目类型、版本／private 字段、8个DLL指纹，
再以固定时间戳生成 ZIP 并读回全部14条目核对。不要以此脚本绕过下面的公开发布待办。

## 第三方材料核对

[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)区分项目 MIT、上游 MIT 和 Microsoft SDK 条款。
[DLL清单](../release-sources/rc53/third-party-inventory.json)保存包版本、NuGet归档指纹、匹配条目、DLL指纹与版权。
本轮对实际候选的8个DLL和本机原始 nupkg ZIP 条目直接做 SHA256 比较，全部相等，未执行DLL。

- Vortice.Windows 3.8.3、Vortice.Mathematics 2.1.0：保留 nuspec 对应固定提交的 MIT 原文。
- SharpGen.Runtime／COM 2.4.2-beta：保留固定提交的 MIT 原文，同时单列 NuGet 更完整的作者／年份，不修改上游文本冒充原文。
- Microsoft.Windows.SDK.NET.Ref 10.0.19041.57：两个 DLL 都匹配 `lib/net8.0` 原文件。
  微软官方 [REDIST清单](https://learn.microsoft.com/en-us/legal/windows-sdk/redist)明确列出这两个文件，
  允许未修改地随调用 WinRT API 的程序分发。它们未被归入项目 MIT。

SDK NuGet 的许可链接 `https://aka.ms/WinSDKLicenseURL` 最终指向
[原始RTF](https://download.microsoft.com/download/0/F/F/0FF2B061-47DD-4F55-89B6-FD1D8C44F14D/sdk_license.rtf)。
保留原始246,945字节，SHA256 `DD07EB178E00C6BBA4148457FC00FF77CD4887EB521D504186FE59C9EC8BBE62`。
原文 EULAID 为 `WIN10SDK.RTM.AUG_2018_en-US`；链接下载文件的修改日期是2025年，不把它解释为包版本号。
初次 aka.ms HTTPS 连接失败证据留存，随后从最终微软 HTTPS 地址成功获取，未关闭TLS校验或更改网络设置。

已阅读原文中再分发权利／条件／限制与许可范围等内容：须添加主要功能、保留通知、
要求下游与外部最终用户接受足够保护组件的条款、Windows 平台限制、不暗示微软背书，
以及原文的责任和赔偿等条件。随包 [Microsoft组件条款](../licenses/Microsoft-components-terms.md)
要求接受完整原文并保留下游约束；不把本报告当作微软额外授权或法律保证。
微软 SDK 整套、.NET 运行时和构建工具不在本包中。

## ICO 来源记录（用户随后补充）

`assets/DeepSeek-Harness.ico` 指纹 `B57A303C586154AD1741EB5D478BB80EAE8231495BD08995854BE7E711EEE5B8`。
本机旧 dsh-desktop 历史可追溯到 `32d1ec928690919c7faffae87ea3b304c6f2c48f`（style: refresh desktop icon），
本仓库导入提交为 `c640c22fb64d1e0e47684faf9e30f80703990563`。
这是透明白鲸转换资产，不是官方 rc.3 `tray-windows.ico` 的同一字节文件；
官方 rc.3 该 ICO 为15,698字节，本地为28,881字节。图形相似或附上上游 MIT 文本不能证明最初转换来源。

用户随后回忆：当时拿 DeepSeek 蓝鲸 logo 或 DeepSeek Harness 黑鲸 logo，由 Grok 或
Codex 辅助生成／转换为白色，同时将眼睛与肚子镂空为透明通道。具体是哪个原图、哪个工具
已记不清，原图可能已遗失。该说明作为用户回忆补齐衍生关系，不冒充已核对的精确上游文件。

第三方声明和机器可读来源清单已改为“DeepSeek 标志的改色／透明处理衍生图标”，
不称完全原创，也不因AI辅助处理将其归为项目自有MIT标志。已附 DeepSeek Harness 固定
rc.3 提交 `1f81c047fc48fa190a683e469daa699857e9afe8` 的 MIT 文本作为上游项目署名，
但不将其声称为这张遗失原图的逐文件授权证明或商标授权。

此前“等用户补充来源”的动作已完成；精确原图无法核实的限制保留在随包说明中，
不再反复要求用户寻找已遗失的同一文件。本轮只据此更新外层资料，原ICO／tgz字节保持。
当前 `publicReleaseReady=false` 表示仍未取得本次公开发布决定；资料已备好不等于已经公开，
也不表示对未找回原图的权利范围作了额外保证。

## 检查与下一步

本轮只做资料、归档与内容校验；不重复984／58／169等既有代码测试、不增加实机验收声明。
独立读回13个校验条目通过；第二个新目录重建ZIP与首份逐字节一致；配方语法通过，
361项开发／固定快照保护输入全部不变；外层说明／JSON／许可未发现本机HP用户路径。
原始证据、两轮本地ZIP和失败请求记录保留于 `.tmp/rc53-first-release-materials-20261028-a/`。
用户补充后b轮仅更新NOTICE、license-sources.json和相应SHA256SUMS，内部tgz及其余外层文件保持。
b轮独立读回校验、限定差异和361项保护输入检查通过，见 `.tmp/rc53-icon-lineage-20261028-a/verification.json`。
c轮将公开声明精简为来源、改动与无背书说明，用户回忆／工具未知的细节保留在本报告，
不再出现在公开NOTICE与机器可读来源清单中。相对b轮仅NOTICE、来源清单和SHA256SUMS变化；
原tgz、13个校验条目、361保护输入及配方语法核对通过，证据在 `.tmp/rc53-release-draft-20261028-a/`。
d轮进一步固定外层文本为Git标准LF，跨Windows换行检出可复现；原tgz和RTF保持原始字节。
暂存检查最初因原RTF自带空白失败，未修改微软原文，改为对该原始格式文件使用Git binary属性；
其余文本继续接受空白检查。实际发行以d轮及其校验文件为准。

下一步：选定包含这些材料与来源说明的提交、
经用户决定创建首个 **Pre-release** `dsh-whale-mist-v0.6.0-rc.53`，仅上传明确附件和校验文件。
npm 单独安排，`private:true` 保持。不要发布未闭合的候选或自动安装／重跑实机。
