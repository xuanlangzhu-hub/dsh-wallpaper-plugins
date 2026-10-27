# rc.45 作者参数计数竞态候选核包

2026-10-21。结论：**最小候选核包通过，未安装、未实机验收**。日常仍为DSH0.2.1-rc.2/外观rc.42/Git Bash0.1.1。下一步只安排Lucy粒子短验，侧栏与即时应用改版不混入本包。

## 原包及差异

- 候选：`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.45.tgz`，7194710字节，42个常规文件。
- SHA256：`BAD91155A95C457AF0FB52E8C52BC58A765F9F23ACABDA7DD2F6C11F83FDFBCC`。
- 来源固定rc.44，SHA256 `AC64390E3FA2C4791059816851FB927EA2E4FA33F0C7149BA4F1F7B31F95D433`。旧rc.43失败尝试和rc.44实机未通过原包均保持，不覆盖。
- 仅3个文件变化：`src/wallpaper/author-properties-host.js` 合入已复核的计数竞态修复，package.json更新包版本，README说明补修及验收边界。无新增/删除运行文件，其余39项保持原字节。
- client、独立页HTML/JS/CSS、其余Host/会话/桥接均保持rc.44；14项资产（含12项原生运行文件）不变，无Trace混入。工作区manifest和生产assets仍rc.30，不整体打开发目录。

本次修复只将无关的renderer总revision移出作者请求上下文比较，仍验证revision输入格式、草稿expectedRevision及真实owner/壁纸/分级/生命周期。见[原因与源码修复](AUTHOR_SETTINGS_PLAYBACK_REVISION_FIX_20261021.md)。界面仍沿用先保存草稿再应用，不宣称勾选即生效或右侧栏重做已交付。

## 实际归档核对与测试

从实际新tgz重新读取并安全解包，检查路径、重复成员、文件集合及42项SHA256。额外QA/scripts在解包验证目录内单独冻结，不装入候选。

- 实际解包运行作者schema/表单/认证HTTP/下发适配器与20项上下文回归，**109/109通过**。父监督正常退出，未超时；不是复用工作区源码测试结果冒充包内检查。
- 22个包内JS语法、33处相对导入闭包通过；作者表单生成字节一致性及CSS检查通过。
- 除README和包manifest外40个文件，与[独立页3正例/9负例](AUTHOR_SETTINGS_COMPANION_CHAIN_REVIEW_20261021.md)实际受测fixed输入逐项一致，包含完整Host补修。这是包与已有真实DOM/lease/SSE/HTTP证据的字节绑定，本轮未重复运行12场景，也不混记为新增用例。
- 392项源码/QA/生产资产/manifest/既有归档/冻结QA输入保护指纹保持；日常安装rc.42的37个文件及完整集合仍与固定原包一致。未读写活动外观存储或Profile设置，未调用DSH模型或真实WE属性命令。

本轮没有重复旧包335项主检查、24项销毁或原生接收器实验：改变的是作者上下文比较，当前运行109项相关回归；资源/原生文件逐字节保持。旧证据仅为继承范围，不能称本轮重新全量通过。

证据：`F:\dsh-wallpaper-plugins\.tmp\rc45-author-revision-candidate-20261021-a4d019c7`，重点为archives.json、static-audit.json、author.stdout.log、两个父监督result及candidate-ready.json。实际归档及旧证据均保留，未提交推送或清理。

## 下一小步：短验准备

1. 先取得届时方便/无任务及DSH正常退出确认，原WE保持；新建本轮备份，不沿用rc.44旧轮退出状态或恢复其旧设置。日常回退固定rc.42，SHA256 `A9B8044CB9C11CCC8B5FAB5309814B3616F267F9F15479484CCE79D714F70CB8`。
2. 核对电脑操控在用户重启Codex后能否正常初始化，若失败如实说明，不声称已代点。关闭状态备份Profile、Local Storage、布局和rc.42原安装，再临时安装固定rc.45并核验42项。
3. 用户正常重开确认原外观布局，选择Lucy日常模式、自动播放关闭。只测particles关闭、恢复；同一播放轮记录请求/身份/退出及页面提示，区分“已发送”与用户确认的可见效果。不混改scheme color等其它参数，步骤分段，不要求用户长串操作。
4. 失败不自动重试。停止清理、正常退出后先保留测后数据，再恢复本轮rc.42及原设置/布局，37项核验及用户正常重开收尾。默认不保留rc.45日常。

离线拒绝缺陷已修复不等于用户当时全部根因已解决，也不等于作者真实响应已验证。当前只完成核包，任何安装/开窗/实机操作都仍待当时确认。
