# rc.34日常试用交接：安装与重开核对完成，已保留日常

2026-10-17，Codex。rc.34[功能短验及rc.31恢复](RC34_APPEARANCE_FEATURES_SHORT_TEST_20261017.md)收尾后，用户对采用rc.34日常建议回复“ok，那就继续吧”，随后明确确认“已正常退出，可以安装并保留rc.34日常试用”。**本轮已新备份、安装核验并由Codex正常重开核对，现保留rc.34作为日常试用，不自动恢复rc.31，不重复临时功能短验。**

## 固定输入与准备

- 安装使用已有、已审计且已短验归档`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.34.tgz`；SHA256 `8DDB36C86FEDA3DACAAB2904A49414E5DFDAEB2E7D0CC05F71BCAB67AC23EA75`，28文件。未重新构建或覆盖同版本包。
- 安装前已只读核对归档及rc.31安装：28文件等同固定rc.31。rc.34相对rc.31仅README/manifest/client三个文件变化，12原生运行文件及Host保持，无Trace；不机械重复已通过的功能/性能检查。
- 新证据目录：`F:\dsh-wallpaper-plugins\.tmp\rc34-daily-trial-20261017-c7e29b40`。
- 本轮新备份：`C:\Users\HP\.dsh\backups\rc34-daily-trial-20261017-c7e29b40`，**已创建并核验**，包含5Profile、11个完整关闭外观存储文件及rc.31原包。没有复用临时短验旧备份或退出状态。
- `closed-settings.ps1`默认预演，AST语法检查通过；`verify-installed.py`和`trial-preservation.py`已适配本轮purpose并做Python语法检查，当前rc.31只读核验通过。工具中的`daily`比较项代表安装前rc.31回退基底；交接成功后的实际日常为rc.34，以安装结果和本报告更新为准。

## 安装及保护核验

退出后实际DSH/capture/worker为0；本轮WE为PID12236、启动时间2026-10-17 08:54:54.320927 +08:00、固定WE路径，安装前后身份保持。官方CLI执行`plugin --profile desktop add`固定rc.34退出码0；28安装文件逐字节一致，DSH关闭时11个外观存储保持。5Profile仅package.json和pnpm-lock.yaml发生安装所需变化，其它3个文件保持；package除插件归档依赖外结构不变。安装后5Profile另存`profile-after-rc34-install/`。

407个仓库/归档保护输入在安装阶段一致，官方EXE/app.asar、WE EXE、原归档与rc.31本轮备份保持。证据：`closed-backup.json`、`backup-result.json`、`trial-before-install.json`、`install-result.json`、`installed-rc34-closed.json`、`post-install-preservation.json`及`closed-after-install-processes.json`。外观存储没有覆盖回旧轮，日常迁移采用本轮原值。

## 正常重开与日常保留

Codex沿用用户此前明确的电脑操作委托，经官方既有EXE正常启动DSH，没有重复安装或开始播放。使用本轮新窗口HWND3935838核对正常会话界面、原布局/尺寸、设置加载正常；进入通用设置只读查看后关闭设置面板，DSH保持打开。

- 原四项为亮度100、遮罩0、模糊0、界面不透明度40，未擅改成默认70/45；原所选三体scene保持，未切Lucy或恢复三体调查。
- 新文字可读性与聊天底色控件正常加载，聊天底色0；未在本次重新调整或测试。旧设置迁移的观感与原主题一致，本机功能覆盖仍以前次短验为准。
- 界面当前播放为“未播放”，状态“未开始。点击「开始播放」创建本轮源窗口”，开始可用、停止禁用；实际capture/worker为0。原自动播放偏好保持，未验证scene仍不自动播放，不更改验证名单。
- 重开后rc.34的28文件仍与固定归档逐字节一致，原WE身份保持，官方EXE/app.asar及WE EXE不变。本次重开由Codex操作观察，不虚构用户另作反馈；长期稳定仍待日常实际使用积累。

证据：`reopen-ui-verification.json`、`installed-rc34-after-reopen.json`和`reopen-process-verification.json`。关闭时11个外观存储保持的结论有效；运行后存储可正常更新，不拿活跃文件强比关闭备份或回写。本轮没有执行恢复脚本。

最终`final-verification.json`确认重开后5Profile与安装后快照一致，407个仓库/归档保护输入仅9个接续/交接文档变化，旧归档、生产/QA/资产及官方文件保持；`final-process-check.json`确认capture/worker为0、原WE身份保持。`git diff --check`通过。接续入口已改为日常rc.34，历史候选/临时短验报告已链接至本次交接，避免旧“日常rc.31”快照被当作现状。

下列流程现已完成：

1. 按AGENTS.md的实机约定确认当前方便、其它助手暂停、DSH无任务，正常停止并菜单退出；原WE保持。用户当前退出确认到达后再核对实际退出及本轮WE身份。
2. 备份当次5Profile、完整关闭Local Storage与rc.31原包，逐项核验。只用官方CLI安装固定rc.34，再核对28安装文件、仅安装所需Profile变化和原外观存储保持。
3. 正常重开并核对外观布局、设置迁移和播放停止，完成日常交接。不重做Lucy预设/底色短验或性能测量。

## 后续与回退

当前已保留rc.34，接下来以日常体验积累问题，不自动新增功能或恢复三体/性能专项。如出现异常，先记录现场，再按实际问题和当时方便确认处理。回退须重新备份届时数据并正常退出，再用固定rc.31归档核验安装、按明确范围恢复本轮原设置；不要直接把本轮旧关闭备份覆盖之后新增数据。

rc.31与rc.28旧归档、所有候选、旧备份及用户/小G源/QA改动均保留。本轮不动官方EXE/app.asar、原WE或全局设置，没有提交推送、清理或跨会话消息。工作区manifest/生产assets仍rc.30冻结，日常安装来自既有固定rc.34，不能直接将含Trace的整个工作区打包。
