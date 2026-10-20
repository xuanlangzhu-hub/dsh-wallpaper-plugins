# R3 同一MP4可见无采集源观察：黑屏与路径编码线索（2026-10-20）

后续：[ASCII副本可见无采集源能正常播放](RC39_VIDEO_R3_ASCII_SOURCE_RESULT_20261020.md)，用户窗口操作导致13.019秒提前收尾，清理/原WE/设置及用户正常重开闭合。支持路径兼容线索，内部转码边界未定；下一项仅离线桥接补修，不自动继续实机。

## 结论

**本轮同一MP4在DSH退出、没有采集时，WE可见源窗口本身就是黑屏。** 用户明确回复“黑屏”并提供本轮窗口标题截图。原生窗口管理正常收尾，原WE身份保持；用户已正常重开DSH并确认“重开正常，外观布局正常，播放停止”，日常外观rc.38保持。

随后只读WE日志发现：原rc.39失败轮与本轮源观察都记录了同一媒体打开失败，Media Foundation返回 `80070002`；日志文件名与“原中文文件名以GBK编码后被错误当UTF-8解码”的结果逐字符完全相同。**这是路径转码的强线索，尚未证明损坏发生在真正文件打开前，还是仅发生于日志输出。** 没有按此猜测修改生产代码、系统代码页、解码器或GPU策略。

R1/R2已离线修复，R3不再只写“采集表面静止、源情况完全未知”；当前优先定位视频打开/文件名传递。当前观察说明这一黑屏不需要DSH或采集参与即可出现，不排除后续仍有其它捕获/呈现问题，也不能概括所有视频都不能播放。

## 授权、新备份与实际执行

用户本轮明确确认“已正常退出，可以做无采集源观察”，不是复用前轮授权。使用[已审运行器](RC39_VIDEO_R3_SOURCE_ONLY_PREPARATION_20261020.md)，封存脚本指纹一致后执行。

- 新备份：`C:\Users\HP\.dsh\backups\video-r3-source-preparation-20261020-f8213375`，5个Profile、9个Local Storage文件，逐项哈希一致。
- 日常rc.38的35个安装文件及原归档核验一致，没有安装插件或改变版本。
- 新location：`WhaleWallpaperProbe-video-261020023012-52c6dbb7`；HWND `7670110`。当轮原WE为PID11980，完整路径和创建FILETIME `134369309316465382`实时核验，不仅比较旧PID。
- 实际helper argv：`--we-open <本轮location> <原批准中文MP4路径> 1280 720`。没有 initial-offscreen、pipe/capture、taskbar worker或全局play/pause。
- 读回窗口外框 `[114,114,1416,890]`、客户区1280×720、工作区 `[0,0,2560,1368]`；visible且非iconic/cloaked，位于屏内。
- 从ready到closing **20.004秒**；正常 `--window-ensure-closed <location> 5000 --expect-pid 11980`，关闭结果closed。两次helper调用均退出0且exit已确认；监督worker退出0，无超时。
- 关闭后只读核验源消失、原WE身份一致、无DSH/capture/伴随任务，rc.38及全部本轮设置与新备份一致。没有覆盖写回设置，因为没有变化需要恢复。
- 用户随后正常重开并确认原外观/布局、播放停止。重开后可能自然产生的新存储数据不按旧备份覆盖。

以上管理/清理证据不等于媒体播放通过；媒体实际结果由用户报告和截图确认是黑屏，没有采集/保存WGC帧。

## WE日志的新证据

只读 `E:\SteamLibrary\steamapps\common\wallpaper_engine\log.txt`，仅保存匹配批准项目3790716675的错误段；没有读取其它壁纸预览或修改WE设置。

| 时刻（UTC） | 对应轮次 | 记录 |
| --- | --- | --- |
| 01:37:11 | 原rc.39视频失败轮 | DirectShow/Media Engine失败80004005，Media Foundation失败80070002 |
| 02:30:26–27 | 本轮无采集可见源 | 同一媒体、相同5条后端失败，Media Foundation仍80070002 |

`80070002`按 [HRESULT_FROM_WIN32](https://learn.microsoft.com/en-us/windows/win32/api/winerror/nf-winerror-hresult_from_win32) 映射至Win32错误2；微软[错误码表](https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-)将2定义为ERROR_FILE_NOT_FOUND。该错误可能涉及媒体或其依赖，不能单凭数字断言一定是哪一个路径。

字节/文本检查：

- log相关行可以严格UTF-8解码，行内已经含字面U+FFFD替换字符，不是本次Python用errors=replace临时制造的乱码。
- 原文件名：`[绯莎]蓝色大肥鱼 deepseek娘化.mp4`。
- 日志文件名：`[�ɯ]��ɫ����� deepseek�ﻯ.mp4`。
- `original.encode('gb18030').decode('utf-8', errors='replace')`与日志名称完全相等；磁盘上原名文件存在，损坏名字不存在。
- 只读GetACP返回936，未改系统区域/UTF-8设置；这支持检查ANSI/UTF-8边界，但未证明具体是哪一层转换。
- 原生helper使用Unicode版CreateProcess，实际开窗stdout回执也保留正确中文路径。因此优先怀疑后续WE命令接收/转交或日志路径，但还不能把helper、WE各内部边界彻底排除。
- 只读GetShortPathNameW返回的仍是中文长路径，没有可用于严格同文件英文路径对照的纯ASCII短名；没有启用8.3、改名或修改原Workshop资产。

## 下一项对照已离线准备，尚未执行

为验证路径线索，新建隔离工具根：`F:\dsh-wallpaper-plugins\.tmp\video-r3-ascii-source-20261020-7367e3a9`。

将同一批准媒体复制为该目录的 `clip.mp4`，完整路径为ASCII；没有改原文件或项目声明。原/副本均43,235,218字节，SHA256相同：

`27f9251e96e20bedbd0b2e7c1ef6f0e63ffd3bba90d7a6deb52d850a90c87364`

该工具从本轮已验源观察工具复制，仅改新备份/证据根和允许的副本路径；执行前除原门禁外，额外核验原媒体与ASCII副本完整SHA256都等于封存值，拒绝任一变动。34项离线检查通过（原33项+副本完整性门禁，含正常、原文件变化、副本变化），默认plan/语法通过，10项脚本/输入指纹及12项隔离helper封存。没有新baseline、开窗、采集或新备份；未安装。

建议下一次只用同一helper开ASCII副本的普通可见源窗约20秒，保留无采集、相同尺寸与正常关闭流程，再核对本轮WE错误日志：

- 若ASCII副本正常，说明文件字节本身能经该源路径播放，支持路径相关问题；还需缩小到Unicode、目录/驱动器或访问语义，不能直接宣布唯一编码根因。
- 若ASCII副本仍黑屏且同样失败，需继续查WE打开/媒体解码与环境；不能因此否定所有编码问题。
- 副本由E盘项目移至F盘证据目录，目录/驱动器也变了；这项是路径相关性的初筛，不是对“只有中文字符不同”的严格因果证明。后续如需更严格同卷/同目录对照需另选安全方案，不修改原Workshop文件。

用户已重开DSH。下一轮必须重新取得当时方便/正常退出确认，另做届时新备份；不能复用本轮closed-backup或旧ready-baseline，也不自动继续捕获、屏外、codec/GPU或其它视频试播。

## 证据与保护

本轮实测工具/证据：`F:\dsh-wallpaper-plugins\.tmp\video-r3-source-preparation-20261020-f8213375`。

- `live-authorization.json`、`closed-backup.json`、`backup-result.json`、`ready-baseline.json`：本轮授权/新备份/实时身份。
- `events.jsonl`、`ready.json`、`helper-01/02-claim.json`及result/stdout：实际开窗/关闭与20.004秒观察。
- `worker-result.json`、`supervisor-result.json`、`post-source-verification.json`：退出及真实收尾核验。
- `user-feedback.json`、`user-source-black-window.png`：用户黑屏截图及重开确认。
- `we-selected-log-excerpts.json`、`we-selected-log-decoding.json`、`filename-encoding-evidence.json`、`system-codepage-readonly.json`、`short-path-readonly.json`：错误与路径编码检查。
- `live-trial-summary.json`、`live-closeout.json`：实测汇总及保护核验。

ASCII下一轮工具根中的 `ascii-copy-proof.json`、`ascii-final-exit.json`、`ascii-final.stderr.log`、`prepared-inputs.json`为准备证据。复制媒体只在隔离目录，没有打包进插件。

214项开发源码/QA/scripts/assets/manifest/固定归档无漂移；本轮没有产品修复、整体打包、安装、推送、清理或Grok新请求。开发版本/assets仍rc.30，日常rc.38保持。原rc.39失败归档继续保留，不能因为窗口管理正常就标记视频通过。
