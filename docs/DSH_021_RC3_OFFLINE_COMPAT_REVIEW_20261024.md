# DSH 0.2.1-rc.3 离线兼容核对

2026-10-24。用户确认先核对新宿主兼容。**当前开发源码及日常rc.42客户端的已覆盖运行路径未发现接口阻断，但两个日常插件的兼容声明均未包含rc.3，必须先准备兼容候选，不能原样宣称支持并直接升级。** 本轮没有改实现、版本、生产assets、日常安装或Profile；未运行安装器、操作DSH／WE、提交推送、清理、派发或定时。作者状态／反馈改版保留为原UI接续，不混入宿主兼容过渡包。

## 官方目标与变化

[官方rc.3发布](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.3)发表于2026-10-23 15:26:39 UTC，即北京时间23:26:39。主要变更是左右侧栏及会话视图的“更多”菜单、未发送草稿恢复，以及API Key模式的模型列表更新。

[rc.2至rc.3固定提交范围](https://github.com/deepseek-ai/deepseek-harness/compare/687f282e8625c6b8d11ff58211a90524be2e4317...1f81c047fc48fa190a683e469daa699857e9afe8)含6个提交。比较接口的文件清单达到300项上限，因此未将该截断列表当成全仓无变化的证据；另读取4个功能提交的完整清单（219／51／50／57项）和关键源码目录的Git tree。

右侧栏新增`sidebar.right.tab.guide.actions`及其菜单owner props，开始页引入More菜单与入口状态；原tab正文／标题、注册、打开和生命周期路径仍可用。会话头部的`conversation.session.header.actions`和`conversation.session.header.corner`在实际rc.3制品中仍有渲染位置。头部布局确实变化，静态接口保持不代表全部视觉已经通过。

以下7个`src`目录在两个固定commit中的tree SHA相同：ui-theme、ui-layout、ui-renderer、client/modules、pwsh-sandbox、tool-bash、agent-preset。完整哈希见`source-audit.json`。部分旧Windows与新制品的CSS类名／构建路径不同，没有据此判定接口变化，也未把源码相同扩称所有构建字节相同。

## 日常版本声明问题

| 实际日常插件 | 当前声明 | rc.3结果 |
| --- | --- | --- |
| Whale 0.6.0-rc.42 | `engines.dsh`为`0.2.0-rc.2 || 0.2.1-rc.2`；6项DSH UI peer的显式列表也只到rc.2 | 不覆盖rc.3 |
| Git Bash 0.1.1 | 同样的engine列表；agent-preset／pwsh-sandbox／tool-bash 3项peer只列rc.2及更早已支持版本 | 不覆盖rc.3 |

使用真实semver库确认旧声明允许当前rc.2、拒绝rc.3。只在隔离JSON提出追加精确`0.2.1-rc.3`的方案；原版本、dsh配置和其它依赖不变，rc.4／正式0.2.1／0.2.2仍不宣称支持。这只是`metadata-proposals.json`，**尚未构建新tgz、安装或发布**，也没有修改工作区rc.30清单。

## 实际制品与验证

证据根：`.tmp/dsh-rc3-compat-20261024-180eaf63`。

- 从npm官方registry取得15个精确rc.3包，逐个验证发布元数据中的SHA512并保存归档／文件清单。没有执行npm安装或postinstall。
- [官方Windows更新源](https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml)本轮为rc.3；GitHub release的assets为空，Windows目标依据实际更新源核对。下载289,415,960字节安装器，SHA512匹配feed，Authenticode为Valid，签名者Hangzhou DeepSeek Artificial Intelligence Co., Ltd.。安装器从未执行；仅用已有隔离7za解出`resources/app.asar`，退出0。SFX列表中已有归档尾部警告不被当作安装验收。
- 安装器SHA256：`1E3876BAAA20C3F26371DBA7B6873BB70C3EF9B91403F6D3F87D2B27D4FD1E3A`；解出的app.asar SHA256：`04B32E3A872826BA15CFB2081C6A929A8D4ECAA65E09A2543E5A6B30E2EFF1F0`。实际Windows内相关14个包版本均为rc.3。
- 两套SDK检查分别使用npm制品和上述已签名Windows包内的真实模块／前端。Windows组没有混用旧rc.2 SDK。完整Whale apply、实际renderer／右侧栏／会话／主题与新增entry-customization模块均执行；“创建插件”和浏览操作的服务被禁止，未发模型请求。

| 检查 | 结果与边界 |
| --- | --- |
| 当前开发版＋npm rc.3 SDK | **128项通过**，35.097秒；包含前轮126项及实际新More菜单／provider恢复后单次注册2项 |
| 当前开发版＋Windows实际rc.3 SDK | **128项通过**，37.534秒；同一行为范围。最终URL创建／释放50／50、撤销时DOM消费者0，订阅／refs／pins／命令／DOM和活动URL均为0，自有浏览器／server／桥接正常退出，无强杀 |
| 精确日常rc.42客户端冒烟 | npm和Windows各**3项通过**，2.390／2.466秒：完整入口启动、原主题与亮度／遮罩存储投影、新More菜单共存及清理。客户端来自与日常37文件一致的固定rc.42；不冒充rc.42有新原生侧栏，也未在本组测试真实播放 |
| Git Bash及声明 | **11项通过**，0.315秒。9项路径／委托／权限边界用实际0.1.1的executor-core和父执行器／schema替身；受限调用提前拒绝，显式完全访问才委托，逐次策略不被默认值覆盖。另2项验证旧声明拒绝rc.3及隔离方案只增加精确rc.3 |

两套128项与两套3项是不同分发输入下重复的覆盖范围，不能加成262个独立功能。未改产品代码，因此没有机械重跑与宿主输入无关的原生编译／性能矩阵。所有新测试首次通过；旧401／409精确门禁保持，没有允许额外Blob／认证错误或扩大超时。

SDK的底层WE／窗口／预览是合成IO，文件／会话上下文由fixture提供，**没有加载完整真实会话输入编辑器或重放整套桌面文件页**；会话头部插槽做了实际制品静态核对。Git Bash没有在DSH中启动真实shell，父执行器源码tree一致不代替新宿主实机命令验收。fixture直接装载JS，也不等于真实插件安装时的声明门禁已通过。

## 现场保护与升级准备

281项工作区保护输入保持。实际宿主磁盘版本仍0.2.1-rc.2，app.asar SHA256仍为此前核验的`47874618BF5B3011FCAAC10CD4C85F69DA333E70D4F99B921207C78D0999512A`；日常Whale37项和Git Bash7项文件均保持。原rc.2安装器也仍在此前独立证据目录，SHA256=`72E4A8579F11B5428DD0A1506532777924ADBA7ECAACC710A7E429085796537F`并匹配旧下载记录。没有读取活动存储、沿用旧退出状态或覆盖旧备份。

接下来按以下边界推进：

1. 从固定日常rc.42和Git Bash0.1.1原包独立准备只改兼容声明／说明的过渡候选，保留同时支持旧、新宿主；不把工作区Trace、未安装原生侧栏或未视觉验收的UI改版顺手打入。
2. 核对真实tgz的文件集合、最小差异及声明；未来若整合新侧栏，另走其候选与视觉检查，不能拿本轮冒烟代替。
3. 真正安装前取得当时方便／无任务及正常退出确认，原WE保持；在关闭状态做本轮完整新备份，包含所有Profile、会话／附件／存储／媒体数据、Electron userData、旧安装器与实际插件来源。
4. 先在旧宿主安装同时兼容两边的过渡插件，再按已核验来源升级官方宿主；当时重新核验签名、哈希及退出状态，不能拿本轮只读检查当新退出确认。
5. 重开后分步确认原外观／布局／目录、停止与清理，再安排最小播放短验。真实Git Bash命令需另核准具体动作，不自动改变会话权限模式。
6. 失败先保留新现场及新增数据，再按当轮新备份处理；换回宿主二进制不代表升级后数据可直接向后兼容。

本轮到“离线核对闭合、声明补修范围明确、已签名Windows目标及旧来源保留”为止。尚无兼容过渡候选、关闭状态新备份、安装或新宿主用户验收。
