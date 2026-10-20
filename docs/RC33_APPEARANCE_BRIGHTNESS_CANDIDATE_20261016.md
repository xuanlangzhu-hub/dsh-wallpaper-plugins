# rc.33背景亮度与遮罩候选：已核包，未安装

2026-10-16后续进展：[临时安装与实测已完成](RC33_APPEARANCE_BRIGHTNESS_SHORT_TEST_20261016.md)，用户认为150%已过曝、200%过强，改定120%上限且遮罩保持；日常rc.31和原设置已恢复并重开确认。**下文“未安装”为核包时快照，当前按[120%补修任务](GEMINI_NEXT_APPEARANCE_BRIGHTNESS_120_REPAIR_20261016.md)推进，rc.33原归档不覆盖。**

2026-10-16，Codex。基于[外观复审](APPEARANCE_BRIGHTNESS_REVIEW_20261016.md)，使用不可变rc.31原包独立组装rc.33。**候选已准备并审计通过，日常安装仍rc.31；尚未备份本轮设置、安装或操作DSH/WE。**

## 归档与内容

- 路径：`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.33.tgz`。
- SHA256：`48052B724F8737BD7C26B095731928979CD16405999DDDA8D6E807B23C207DBC`。
- 大小：7,385,290字节；28文件。
- 相对rc.31仅`README.md`、`package.json`、`src/client.js`不同。manifest仅版本变为0.6.0-rc.33；README新增候选说明并标明下文旧快照边界。
- client严格只合入5处已复审改动：亮度上限100→200及中英文各两条亮度/遮罩提示；不是将含Trace的工作区client整份替换入包。默认70、20下限、1步长、旧合法数值/存储语义及mask范围默认保持。
- 12个原生运行文件逐字节等同rc.31，P4等待保持；Host、帧处理和其它25个包内文件保持。没有混入rc.32逐帧Motion Cadence Trace，也未新增QA/证据文件。
- 基线rc.31归档SHA256仍为`F1C5B2A3ADCD2BA9B67CC3D432CDB8637B140ADDEDFD520D19CA0BB1B11965DB`。

亮度100%是媒体滤镜基准，150/200分别映射1.5/2；遮罩仍叠加主题底色。200%不保证无过曝或恢复纯黑细节，后续人眼效果尚未确认。

## 候选验证与保护

验证针对独立暂存目录的实际候选client，而非只复跑工作区源码：

- 10个包内JS语法检查通过，实际候选CSS模板守卫通过。
- 使用冻结的现有appearance harness与隔离headless Edge，候选63/63断言通过；含控件150/200、投影、保存、200重载及reset、媒体/主题既有检查。
- 测试驱动只改读取client的路径，指向`package-stage/src/client.js`；既有harness内容不改。测试不截图、不接日常DSH/WE。覆盖范围仍按[复审澄清](APPEARANCE_BRIGHTNESS_REVIEW_20261016.md)理解。
- `npm pack --ignore-scripts --json`在独立package-stage执行，最终tgz逐文件与stage一致，文件集合与rc.31一致，仅上述3文件不同。
- 核包时347个工作区跟踪文件、3份任务/交付/复审输入、5Profile、日常rc.31的28安装文件及原25个归档指纹保持。没有原生重编译、生产assets替换、Profile/Local Storage写入或真实应用查询/操作。
- 工作区manifest/生产assets仍为rc.30冻结基线；后续入口文档更新不改变生产源码或旧候选。

## 最小短验及回退准备

已适配本轮`closed-settings.ps1`与`verify-installed.py`，默认预演、AST/语法及当前rc.31安装核验通过。计划新备份：`C:\Users\HP\.dsh\backups\rc33-brightness-candidate-20261016-eb1e95d4`，**目前尚未创建**。

下一阶段先确认用户届时方便、助手暂停且DSH无任务，正常停止并菜单退出；确认DSH/capture/worker退出、原WE身份保持后，备份当次5Profile和完整关闭Local Storage。只用官方CLI临时安装固定rc.33，检查28安装文件和存储未变后，才由用户正常重开。

短验只看同一背景100/150/200的提亮变化及遮罩说明，不改窗口外观布局；不要求性能测量、三体轨道匀速或长测。若调整遮罩，注意其为主题底色叠加，界面卡片仍有独立底色。停止后核验清理，记录实际效果，不能用隔离测试通过代替人眼确认。

**默认短验后恢复日常rc.31及本轮原设置；用户明确选择保留rc.33时再改为日常试用。** 回退前先正常退出并保留CLI重装前的测试时Profile，再用官方CLI恢复rc.31、核验后恢复本轮设置；不回退到旧日常rc.28、不复用上轮备份。设置工具保留测试数据，不删除用户存储。

实机便利确认及真实退出状态不能由本报告代替。当前不自动安装、重开、设置新默认或调整原WE；没有新性能编码任务、提交推送或跨会话消息。

## 本机证据

目录：`F:\dsh-wallpaper-plugins\.tmp\rc33-brightness-candidate-20261016-eb1e95d4`。

`before.json`、`prepare.json`记录固定输入及指纹；`brightness-only.patch`是从原rc.31到候选的5处代码差异；`package-stage/`、`qa-check/`、`candidate-syntax.json`、`candidate-appearance.log`记录实际候选验证；`npm-pack.json`、`audit-candidate.py`、`package-audit.json`记录打包审计；设置工具及`settings-preview.json`、`installed-daily-preflight.json`记录后续备份/回退准备。原始证据保留，release归档不覆盖。
