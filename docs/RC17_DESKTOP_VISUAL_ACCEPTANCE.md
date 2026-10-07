# rc.17 短实机：仅卡片遮挡与消息裁剪通过

日期：2026-10-07。候选源码提交 `3d416f0`。结论：**本机官方 Windows Desktop、单 Lucy、鲸渊主题的 R5 短实机观感与所测交互通过。** 本轮不重跑已通过的 rc.13 长期播放/自动播放全流程，也不将短实机称为所有场景通用验收。

## 用户确认

用户方便、没有运行中的任务，DS 和其它界面助手暂停。全部点击、退出和重开由用户完成；Codex 仅后台准备和核验。

1. 临时安装 rc.17，WE 日常模式、自动播放关闭，不透明度最低附近（提示约 40%）。用户确认「卡片外围壁纸可见，没有大片黑底；顶部和按钮正常」。
2. 同一轮长消息滚动经过输入区，增加多行测试文字、不发送，缩放并打开模型下拉菜单。用户确认「旧字不透；多行输入、缩放、选字和菜单正常」。
3. 点停止后恢复普通主题，新增 Wallpaper 入口消失，随后用户正常退出 DSH。
4. 撤回候选、恢复日常 rc.1 和测试前外观，用户重开确认「日常状态正常，没有实验自动播放」。

这轮没有采集真实页面截图或 DOM 坐标，观感结论来自用户上述确认；不额外声称测过所有缩放比例、最大化/最小化、浅色主题、所有菜单或所有会话节点形态。

## 后台证据

- 同轮 native PID 79272、源窗口 `WhaleWallpaperProbe-261007102047-57f9`；检查时唯一源窗口、daily/`--forever`、无 failure、解码错误 0。
- 停止后的 native 总结：230.1885093 秒、4665 帧、4651 变化帧，reason=`parent-stop`；客户端末次观测 rendered=4409、decodeErrors=0。这是交互短验，不作性能或长时稳定性结论。
- 只读观察器确认捕获进程退出、源窗口为 0、关闭结果 closed=true，原 WE PID 11020 与起点启动身份一致。观察到清理完成约 1595ms；计时起点是发现停止/捕获结束，不是用户点击的精确时刻。
- 观察器在停止清理时记录 DSH 仍活着；随后恢复脚本另核验 DSH 已正常退出后才修改 Profile。不能把停止观察快照中的 desktopExited=false 当退出失败。

## 恢复与保存

起点备份：`C:\Users\HP\.dsh\backups\official-desktop-before-visual-rc17-20261007-181555`。

测试后四份 Profile 与完整 Local Storage 另存于该备份的 `profile-after-rc17-visual-test`、`electron-local-storage-after-rc17-visual-test`。通过官方 CLI 恢复 rc.1，再恢复原四份 Profile 与 9 个外观存储文件，逐项哈希一致；保留旧会话、IndexedDB、草稿数据备份、源资产和所有归档包。

官方 EXE 哈希未变、签名 Valid。用户恢复确认后只读核验：rc.1、四份 Profile 一致、捕获为 0、实验源窗口为 0、原 WE 保留。rc.1 不带实验 helper，所以最终窗口查询使用源码仓库既有 helper 的只读 `--window-find`，没有重新安装候选。

## 归档和下一步

证据：`F:\deepseekharness\.tmp\wallpaper-visual-rc17-desktop-20261007-181555`，包括 baseline/installed、9 文件存储 manifest、两次用户确认与运行快照、cleanup-stop/result、post-restore-before-reopen、post-restore。

候选 `release/plugins/dsh-whale-mist-0.6.0-rc.17.tgz` SHA256：`38747414F45AF520515D1CE817199F7B5E434B8B6B0565D38313A7591D8A4B06`。原包不重打、不覆盖；源码修复与隔离正/负对照见 [rc.17 后台记录](RC17_HISTORY_CLIP_REVIEW.md)。本轮只补验收文档，没有改实现或版本号。

R5 收尾。后续先安排启动闪窗的小验证及 GPU 增量对照，再扩 A 多壁纸/E 打包复现。源窗口/任务栏入口、鼠标交互与音频、官方内部 DOM 更新风险仍按既有边界保留；本轮没有证明完全隐藏或低开销。
