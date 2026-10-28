# 首个 GitHub 预发行草稿已准备

2026-10-28。用户要求继续后，完成公开署名精简、发行资料提交推送、创建带附件的 GitHub
预发行草稿及下载复核。**目前仍未公开发布；没有正式 tag，没有 npm 发布。**
日常 DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2 保持，本轮无应用／Profile／WE操作或清理。

## 固定提交与在线草稿

- 发行材料提交：`83260aba3c8e87b6d3f2e152163aee724f88d840`，19文件，已推送并核对远端main。
- 插件运行载荷仍是此前验收的rc.53原tgz；此次不重建、不改变内部43文件。
- [GitHub草稿](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/releases/tag/untagged-880d61fdd0e6c3b448e6)，Release ID `426340728`。
- 名称：Whale Appearance 0.6.0-rc.53；拟定tag `dsh-whale-mist-v0.6.0-rc.53`。
- `draft=true`、`prerelease=true`、`published_at=null`，目标提交固定为上面的材料提交。
- 草稿阶段查询远端未出现该tag引用。草稿链接需有仓库管理访问权，不能当公开下载链接。
- 本交接报告的后续提交不自动改变草稿target；公开前如有新改动，先复核差异再决定是否更新target。

## 附件与检查

| 附件 | 字节 | SHA256 |
| --- | ---: | --- |
| dsh-whale-mist-0.6.0-rc.53-windows-x64.zip | 7,013,702 | AFF40FFEA48298066403F6FE7EDF9E67888FC90CE2706549EB90B63678F99C24 |
| dsh-whale-mist-0.6.0-rc.53-windows-x64.zip.sha256 | 109 | 2E6810A64212C91B0428FF7EDCF96B8887E2579F4938D038C1AF7960E8D42DC4 |

本机附件目录 `release/rc53-first-prerelease-20261028-d/`，旧a／b／c轮保留。
ZIP内部14条目和13个校验条目已核对，完整Git暂存区文本另行导出重建，与实际ZIP逐字节一致；
SDK RTF保留原文并按Git binary管理，外层文本统一LF，插件tgz不作文本转换。
原tgz SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。
361项开发／固定快照保护输入不变，无需重跑代码或实机验收。

创建草稿只发起一次写请求，返回成功后读取API核对草稿属性、目标、两附件大小及服务端digest，
再用GitHub CLI下载两附件逐字节比较，均一致。没有以“上传成功”替代内容核对。
现有GitHub连接器没有创建Release能力，因此使用已登录CLI；未读取或输出登录凭据。

公开第三方声明现在仅写DeepSeek鲸鱼标志的白色／透明镂空改动及无背书说明；
用户回忆、原图及工具未知等详细证据保留在[本地附件核对报告](RC53_FIRST_RELEASE_BUNDLE_20261028.md)，
没有将AI工具猜测写成确定来源，也不因此宣称得到额外商标授权。

本机证据 `.tmp/rc53-release-draft-20261028-a/` 保存暂存检查、重建、提交／推送、创建意图、
草稿回执、下载比对与tag检查。原许可RTF空白检查失败的原因和修正记录保留，未改许可原文。

## 下一步

用户此前暂停公开发布，本轮已做到可核对的在线草稿；最后只需用户决定是否公开这版预发行。
在收到决定前不设置 `draft=false`、不创建正式tag，不发布npm，不另做安装或实机。

若用户同意公开：先重新只读核对Release ID／目标提交／两附件digest／说明未被修改，
再发布该同一草稿为Pre-release，核对published_at、最终tag指向和公开附件。
若反馈新问题，保留草稿与证据，先按范围修复，不以旧校验为新字节背书。
