# rc.53 npm 发行

2026-10-28。用户在首个GitHub预发行完成后明确要求上传npm，本轮授权只用于这次npm预发行。
日常DSH0.2.1-rc.3／Whale rc.53／Git Bash0.1.2保持，GitHub附件与正式tag不变。

## 版本与内容

原GitHub tgz为固定rc.53，private=true且许可在外层ZIP；不能直接上传或改写该归档。
从同一固定归档构建独立npm副本 `dsh-whale-mist@0.6.0-rc.53.npm.1`，使用 `next` 标签。
版本后缀表明这是npm发行材料修订，不宣称新增运行功能。

- 原归档SHA256：`8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。
- npm副本53文件：原43文件中41项运行代码／资产逐字节一致；修改README、package.json，增加10项许可／来源文件。
- manifest保留宿主engine／peerDependencies／exports，去除private=true与缺源开发scripts，增加明确文件白名单、公开next配置和仓库链接，声明Windows x64。
- 本机包 `release/npm-rc53-20261028-a/dsh-whale-mist-0.6.0-rc.53.npm.1.tgz`，7,611,545字节。
- SHA256：`7970984F984530F9E0FBBC5A5665AD7088AF3A7A06E2257499F266092652D7E9`。
- npm SHA1：`e1fbdb132082e8390c81ae5b41f489ba4741160b`。
- SHA512 integrity：`sha512-CRfNVb23ZOt/udmn4YRMB3MR/icJVMiATUclUgC9sM/vHongQLtdNiD9liQFwJ42JMlKsvxtFwwF2gtnh5nV5w==`。

配方与完整清单见[固定npm材料](../release-sources/npm-rc53/README.md)。没有从开发树整体npm pack。

## 身份与检查

当前npm CLI11.16.0；开始whoami返回401，用户重新完成Windows命令行登录，之后核对账号为ccosia。
公共registry查询包名返回404，未发现已存在的公开dsh-whale-mist版本；发布前仍需新鲜核对。
没有读取、打印或修改访问令牌，没有关闭2FA。

实际npm pack的53文件白名单／逐字节比对、publish dry-run、23JS语法与361项工作区保护输入通过。
首次dry-run分析脚本按错误JSON形状读取而失败；实际dry-run退出0，随后直接分析原始嵌套结果通过，
没有重跑发布或把失败当成成功。打包不执行生命周期scripts，没有安装／运行日常宿主或壁纸。

本机证据 `.tmp/rc53-npm-publish-20261028-a/` 保存身份结果、包名查询、预演及检查。
旧包／GitHub外层ZIP／Profile／原WE均保持，没有清理现场。

## 发布结果

当前材料已核对，准备以精确tgz单次发布至 `https://registry.npmjs.org/`，公开访问、`next`标签、ignore-scripts。
此段在实际registry结果核对后更新，不以pack或dry-run冒充上传成功。

如果npm要求新的网页登录／2FA，保留具体已验包等待用户完成，不绕过认证、不无限等待或盲目重复publish。
成功后核对registry版本、标签、maintainer、SHA512／SHA1和匿名下载字节，再更新安装入口及交接。
