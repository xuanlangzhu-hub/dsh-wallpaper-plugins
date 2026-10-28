# 首个 GitHub 预发行已公开

2026-10-28。用户明确同意公开已核对的 rc.53 草稿后，发布同一 Release，未重传或替换附件。

- [公开发布页](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/releases/tag/dsh-whale-mist-v0.6.0-rc.53)
- 名称：Whale Appearance 0.6.0-rc.53，**Pre-release**。
- Release ID：`426340728`；`draft=false`、`prerelease=true`。
- 发布时间：`2026-10-28T06:52:41Z`，北京时间14:52:41。
- 正式 tag：`dsh-whale-mist-v0.6.0-rc.53`，指向已核对发行材料提交 `83260aba3c8e87b6d3f2e152163aee724f88d840`。
- `make_latest=false`，没有标为稳定版。后续交接文档提交不移动tag或替换发行内容。

## 附件

| 附件 | 字节 | SHA256 |
| --- | ---: | --- |
| dsh-whale-mist-0.6.0-rc.53-windows-x64.zip | 7,013,702 | AFF40FFEA48298066403F6FE7EDF9E67888FC90CE2706549EB90B63678F99C24 |
| dsh-whale-mist-0.6.0-rc.53-windows-x64.zip.sha256 | 109 | 2E6810A64212C91B0428FF7EDCF96B8887E2579F4938D038C1AF7960E8D42DC4 |

ZIP内仍为原始已验43文件tgz与外层安装说明、完整许可及校验材料。
原tgz SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。
GitHub自动Source code归档是开发仓库，不当作插件安装附件。

## 实际操作与验证

发布前重新核对草稿ID、目标、完整说明、两个附件的大小／digest及本地字节，确认工作区干净。
4099002相对发行目标只有6份交接文档差异，没有运行载荷变化；发布请求只修改同一草稿的
`draft`、`prerelease`和`make_latest`状态，不改变目标提交或附件。

API返回成功后，再通过**未登录的公开API**核对非草稿／预发行／published_at，
并匿名下载两附件，与本机d轮文件逐字节一致，服务端digest也匹配。
`git ls-remote`确认正式tag指向83260ab，未将main的后续文档提交误用为发行目标。
没有重复发布或用成功状态替代下载内容检查。

本机证据 `.tmp/rc53-first-release-publish-20261028-a/` 保存用户本次授权、发布前对象、
单次PATCH请求／结果、匿名API及下载结果、远端tag证明。
361项开发／固定快照保护输入继续保持；本轮不重复代码测试或实机验收。

## 日常与后续范围

日常DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2保持，没有退出／重开／采样应用，
没有改Profile、安装资产、媒体缓存或原WE，没有清理现场。
**没有npm发布。** npm配置、包名及其发行方式仍需另行安排，不能直接对共享rc.30开发树publish。

三体源端节奏、UI后续调整、任务栏初始入口等已知限制仍见发布说明；
首个预发行不代表长期稳定或全部壁纸／参数兼容。后续先收集日常反馈，再按具体问题推进。

准备过程与草稿历史：[附件核对](RC53_FIRST_RELEASE_BUNDLE_20261028.md)、[草稿回执](RC53_GITHUB_PRERELEASE_DRAFT_20261028.md)。
旧本地audit中的published=false／pending字段是当时生成包时的记录，不代表当前在线状态；
不为更改这些历史标志重打已公开的同版本附件。
