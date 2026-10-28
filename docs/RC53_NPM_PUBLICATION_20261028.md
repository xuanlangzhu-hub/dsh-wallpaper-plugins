# rc.53 npm 发行

**已公开并下载核对：** [dsh-whale-mist@0.6.0-rc.53.npm.1](https://www.npmjs.com/package/dsh-whale-mist/v/0.6.0-rc.53.npm.1)。
当前next和npm首发自动生成的latest均指向该rc版本；尝试移除latest返回HTTP400，未更改版本或重复发布。

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
第二个独立输出目录重建npm tgz逐字节一致，7,611,545字节和三个哈希保持。
首次dry-run分析脚本按错误JSON形状读取而失败；实际dry-run退出0，随后直接分析原始嵌套结果通过，
没有重跑发布或把失败当成成功。打包不执行生命周期scripts，没有安装／运行日常宿主或壁纸。

本机证据 `.tmp/rc53-npm-publish-20261028-a/` 保存身份结果、包名查询、预演及检查。
旧包／GitHub外层ZIP／Profile／原WE均保持，没有清理现场。

## 发布结果

以精确tgz单次执行publish，目标 `https://registry.npmjs.org/`，公开访问、`next`标签、ignore-scripts，
关闭自动浏览器弹出和网络自动重试，父监督180秒截止。npm要求单独的网页身份验证，用户完成后
命令退出0，返回 `+ dsh-whale-mist@0.6.0-rc.53.npm.1`，并提示服务端仍在处理。
没有复用已失效登录、绕过认证或重复上传。

最初公开registry仅显示 `0.0.0-stage` 占位版本；约5分钟时真实版本仍不可见，
查询绕过CDN缓存，返回CF-Cache-Status=MISS；认证后的 `npm stage list dsh-whale-mist --json` 返回空数组，
没有证据要求用户再批准一次人工stage。此时仅可确认提交被接收，不能称目标版本已可下载。
临时latest指向系统占位版本，不把它冒充本项目稳定版，也不在目标版本未出现时盲改标签。

npm官方[发布时扫描说明](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/)
说明发布成功和可安装之间存在服务端处理延迟。仅按有界间隔查询，不用重复publish推进扫描，
不改变内容或声明来绕过处理；实际可用结果以下次registry及匿名下载核对为准。

如果npm要求新的网页登录／2FA，保留具体已验包等待用户完成，不绕过认证、不无限等待或盲目重复publish。
成功后核对registry版本、标签、maintainer、SHA512／SHA1和匿名下载字节，再更新安装入口及交接。

## 最终公开结果

- 用户完成本轮网页登录验证，单次publish返回0；服务端处理后公开真实版本。
- registry版本时间：`2026-10-28T07:18:56.000Z`（北京时间15:18:56）。
- 包名／版本：`dsh-whale-mist@0.6.0-rc.53.npm.1`，maintainer核对为`ccosia`。
- 匿名registry查询中的SHA512 integrity、SHA1均匹配本地审计，匿名下载7,611,545字节tgz与本地逐字节一致。
- 原GitHub rc.53包、ZIP和正式tag未修改；日常仍原rc.53，不因npm上传另做安装或实机。

`--tag=next`实际已生效，但首个包放行时npm还自动将latest从占位版本指向本次rc版本。
为落实原计划“仅next”执行一次有界 `npm dist-tag rm dsh-whale-mist latest`，用户完成独立网页验证后
服务端DELETE返回HTTP400。随后匿名核对latest未移除，未把CLI失败记录成成功。
最终两标签均为 `0.6.0-rc.53.npm.1`。npm上游[同类首包问题记录](https://github.com/npm/cli/issues/8490)
也报告了首发额外latest与删除400；该报告作旁证，不把评论猜测当强制规则或本包唯一原因。
本轮保留实际状态，不反复认证／删除、不改成稳定版本号。安装说明明确指定预发行版本。

最终只读状态见本轮证据中的 `registry-verification-final.json`；原publish、阶段查询、
下载、latest失败与标签证明均保留。没有访问或复制认证密钥，认证链接不纳入仓库／发行包。
源码和交接随后提交推送，工作区保护输入保持；后续npm版本或标签调整另按用户安排。
