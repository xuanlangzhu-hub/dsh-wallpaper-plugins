# rc.25 选择失败修正与 rc.26 双场景短验通过

**最终状态（2026-10-12）：rc.26 短实机通过；已恢复日常 rc.24 和当天测试前设置，用户重开确认正常。**
本轮没有把 rc.26 留作日常，没有提交或推送。以下保留失败、修正和打包过程，最终验收见文末。

2026-10-12，Codex。用户协作rc.25短验：首次列表自动加载、布局正常、自动播放关闭；Lucy可动态显示。
用户点击另一张scene「绯雪」后，名称和高亮仍为Lucy。本轮实际只播放了Lucy，**没有完成第二张scene验收**。
用户停止并正常退出后，已恢复日常rc.24：5份Profile和9个外观存储文件与当天备份哈希一致，原WE身份与官方EXE/Valid签名保留。
这一失败轮结束时DSH仍退出；本轮没有把失败rc.25留作日常。

## 根因与最小修正

选择按钮正确调用update('weScene', id)，但真实controller.set先用isValidSetting检查，
其中只有通用枚举、布尔、数值设置，漏掉了weScene；合法id也被拒绝，存储和高亮都不更新。
Host登记/白名单边界不是本次失效原因。

rc.26在校验中单独允许isSceneId(value)，仍拒绝路径、坏ID和非字符串；Host启动前照常按ID复核，不因此放宽路径权限。
选择动作同时增加既有userActionRevision，取消尚在等待的自动播放，避免Lucy→其它scene→Lucy的选择往返被迟到Host答复自动应用。
不停止当前画面，不立即开启下一张；实际切换仍必须手动重新开始。

## 验证

用生产点击回调→**真实外观controller**→localStorage→重新实例化→再次渲染的隔离浏览器检查：

- 修前：在「点击第二张后真实controller选择应改变」断言失败，复现用户行为。
- 修后：点击、保存、高亮、重载保留、非法值拒绝、回选Lucy均通过；整体外观检查40项通过。
- 自动播放小对照：延迟就绪且不改选择，正常启动1次；选择往返后启动0次。
  新增test:appearance-selection入口使用真实controller与mock Host，无真实WE调用。
- npm run check与Host85/85通过；未改Host/catalog/原生/渲染CSS，未重跑GPU、R8或长时实验。

旧的选择检查大多mock了controller或只检查表达式，没覆盖真正的设置校验。
新回归保留该真实controller接缝，防止“列表能显示”被误当“选择能保存”。
首次实验fixture未挂载WE区域的失败只是夹具问题，修正挂载后才在真实选择断言复现；
所有前后日志均保留，不把夹具失败计为产品证据。

## 新候选

- rc.26：F:/dsh-wallpaper-plugins/release/plugins/dsh-whale-mist-0.6.0-rc.26.tgz。
- SHA256：30FD0E23571D7ED6F8D197CC5FBFCBA2111985E16D6F7FE2B35A35871C430E9C。
- 28文件，7,313,694字节。与rc.25只差README/package/client；全部包文件与工作区一致，Native/图标/依赖未变。
- 打包时尚未安装rc.26；后续已在用户协作下临时安装并短验，最后恢复rc.24。原rc.25/rc.26归档均不覆盖，未提交/推送。

证据：.tmp/rc25-desktop-20261012-092321（安装/用户失败/真实Lucy日志/前后复现/恢复），
.tmp/rc26-candidate-20261012-013822（新pack与逐文件核验）。
当天备份：C:/Users/HP/.dsh/backups/official-desktop-before-wallpaper-selection-rc25-20261012-092321。
活动rc.24 SHA256仍为86021352502A1DBBD76B0A0B6D4B831967D3A271FA9D61E7F9C5CF01A61B6B02。

## 正式 Desktop 短验

用户明确同意临时安装rc.26，所有界面操作由用户完成，其它助手暂停。安装的28个文件与候选包逐字节一致。

1. Lucy开始后，只点击绯雪：本次选择和高亮变为绯雪，当前播放和画面仍是Lucy，没有立即切换。
2. 重新开始后，用户确认绯雪动态播放、当前名称正确，缩放、长消息滚动和多行输入正常，无白条、闪字或大片黑底。
3. 回选Lucy并重新开始，画面和名称恢复Lucy；停止后普通主题恢复，Wallpaper入口消失。
4. 停止状态只选绯雪，自动播放保持关闭，正常退出并重开：绯雪选择和高亮保留，没有动态壁纸或新入口。
   后台没有新增运行目录，采集进程为0。这是选择持久化和不自动开始的用户确认，不是绯雪自动播放验收。

| 运行 | Host收到帧数 | 客户端已绘制 | 解码错误 | 最终源窗口清理 |
| --- | ---: | ---: | ---: | --- |
| 首轮Lucy | 702 | 572 | 0 | closed，890ms |
| 绯雪 | 2160 | 1394 | 0 | closed，946ms |
| 回到Lucy | 1425 | 884 | 0 | closed，510ms |

三轮failure均为null，最终采集进程退出，原WE仍是PID11732及同一StartTime。
帧计数仅记录链路收到/绘制情况，不视为壁纸源渲染FPS或成本对照。
绯雪登记ID为`we-3b752f12097114fe05a18acf`，本次只确认其手动短播放，不修改代码中的自动播放验证名单；Lucy仍是自动播放已验证样例。

## 恢复与证据

用户再次正常退出后，通过官方CLI恢复rc.24，并恢复本轮备份：

- 日常安装包26个文件与rc.24归档逐字节一致；活动引用回到原rc.24 tgz。
- 5份Profile文件、9个Local Storage文件哈希与测试前一致。测试后的数据移入本轮备份，未删除。
- 原WE身份保留，官方EXE哈希一致且签名Valid；用户重开确认日常主题、背景、输入区和桌面正常，无实验自动播放。
- rc.26原包保留，未因验收文档更新重新打包或覆盖。归档README是打包时的待验收快照，最终状态以本记录为准。

独立试验目录：`F:/dsh-wallpaper-plugins/.tmp/rc26-desktop-20261012-094148`。
备份：`C:/Users/HP/.dsh/backups/official-desktop-before-wallpaper-selection-rc26-20261012-094148`。
三轮日志完整副本在各`*-final-evidence`目录；汇总为`stopped-before-persistence-relaunch.json`，
重开记录为`persistence-relaunch-confirmed.json`，恢复记录为`restored-before-reopen.json`和`restored-package-verification.json`，
最终用户确认在`daily-reopen-confirmed.json`。rc.25失败证据另存，未覆盖。

## 接续边界

A2最小列表、手动选择/重启切换与选择记忆已完成本机Lucy和绯雪短验。
日常仍rc.24，不自动升级到rc.26；如用户要日常使用多壁纸选择，再明确安排候选切换。
未验证全库、其它机器或长时运行；video/web、缩略图、任务栏/Alt-Tab隐藏、壁纸属性、音频与鼠标交互均不在此次完成范围。
后续按产品路线推进，下一项是源窗口入口隐藏的独立方案调查，不直接照搬曾导致采集失败的hide/TOOLWINDOW写法。
DS当前没有新的编码任务；不自动安装、开窗或推送。
