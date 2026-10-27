# 原生侧栏：缩略图资源提前释放复现与补修

2026-10-23，接续[本地图片入口中的资源日志门禁](WALLPAPER_NATIVE_LOCAL_IMAGE_20261023.md)。本轮已在实际SDK里复现同样的 `net::ERR_FILE_NOT_FOUND`，定位到缩略图可见性与Blob URL释放时序，并完成最小补修及前后对照。**未接本地视频、未构建候选或操作日常DSH／WE。** 日常DSH0.2.1-rc.2／rc.42／Git Bash0.1.1保持，manifest／生产assets仍rc.30。

## 复现与证据边界

独立证据目录：`F:\dsh-wallpaper-plugins\.tmp\native-preview-resource-20261023-63b240e7`。采用diagnose流程，先固定反馈回路、保留失败，再改产品；未循环盲跑原111组碰绿灯。

第一组只驱动实际原生图库搜索／翻页／年龄筛选／收起与重开，固定12轮、总截止及阶段监督：`preview-baseline-report.json` 没出现原日志，但捕到1次URL撤销时仍有可见img引用，naturalWidth为1。仅把合成PNG从1×1换成896×896／3,213,208字节的合法预览后，`preview-large-payload-report.json` 也未直接出现原日志。因此没有据此宣布复现或先改实现。

随后把输入缩到“预览返回的同一microtask窗口内，IntersectionObserver报告离开视口”。只控制底层可见性通知时序，不替换实际Preview／React／侧栏／浏览器Blob读取。`preview-viewport-timing-report.json` 在2.442秒内失败，记录到：

1. Blob URL创建于691.0ms；692.1ms被撤销。
2. 撤销时仍有connected、visible的Lucy img引用该URL，naturalWidth为0，尚未读完。
3. 浏览器的requestfailed及console location同时指向**同一个Blob URL**，错误正是 `net::ERR_FILE_NOT_FOUND`。
4. 普通播放0，作者命令0；正常收尾、URL创建／回收1／1、浏览器及server退出已确认。

这确认了一条真实生产组件路径可以产生与历史失败相同的错误。历史 `sdk-regression-accepted-report.json` 没有保留错误URL，仍不能证明当时那一条必然且唯一来自本路径；不能倒填其缺失证据。本轮对已复现路径完成因果验证和补修，原失败记录不删除。

## 原因和最小改动

旧Preview只根据url和failed渲染img。near／visible／目录版本变化后，旧URL仍可能出现在本轮render中；passive effect随后清理并撤销URL，浏览器却还在读取该DOM资源。只在effect里setUrl(null)不能保证先移除消费者再释放资源。

本轮只改变 `src/sidebar/native-appearance-sidebar.js` 的Preview函数，并通过原生成器同步client内片段：

- 每个预览用资源对象绑定URL、壁纸ID和目录版本。render要求visible、near、hasPreview及当前owner对象身份全部一致，旧资源在passive cleanup之前已退出DOM。
- 以URL作为img key，避免新旧资源复用一个图片节点。
- 清理先撤销本轮owner资格，再只释放它自己的URL，不以一个公共字符串代替所有权。
- 迟到的旧img错误回调若已不是当前owner，直接忽略；当前img错误先移除src，再撤销自己的URL，避免释放新一轮预览或留下仍引用已释放URL的消费者。

请求队列／并发2／期限／年龄过滤／Host协议／播放／本地图片存储均未修改。没有新增回退重试、延长超时、延迟释放等待计时器或错误白名单。

## 验证

| 组别 | 结果与覆盖 |
| --- | --- |
| 固定时序原样前后对照 | `preview-viewport-timing-report.json`失败；`preview-viewport-fixed-report.json`通过。两轮browser-test及fixture哈希完全相同，仅产品变化；修复后撤销记录images为空，不再出现Blob读取错误 |
| 新资源专项 | `qa/native-preview-resources.test.mjs` 7项。从真实原生侧栏element树取得实际Preview，hook驱动器分开render与passive effect阶段，使用真实Node Blob URL、底层reader替身。修复前5失败／2通过，修复后7通过，覆盖near、hidden、目录版本、迟到旧error、当前error释放、迟到响应及重新进入视口 |
| 受控SDK与重入视口 | `preview-fixed-reentry-report.json` 2项通过，2.406秒；真实官方冻结SDK／React／Blob读取，底层IntersectionObserver时序替身。离开时不渲染旧资源，返回后新预览正常读取 |
| 正常交互SDK | `preview-fixed-interactions-report.json` 14项通过，4.888秒；固定12轮搜索／翻页／筛选／收起重开，撤销时仍有DOM消费者的记录为0 |
| 大PNG交互SDK | `preview-fixed-large-report.json` 14项通过，6.229秒；相同交互，唯一替换预览为896×896合成PNG，保持4MiB门禁；DOM仍引用已撤销URL的记录为0 |
| 原完整SDK回归 | `sdk-regression-fixed-report.json` **111项及日志门禁通过**，父监督25.500秒。保留原401／409精确门禁，未放宽ERR_FILE_NOT_FOUND；普通播放3次与作者IO仍是既有合成后端 |
| 最终合并回归 | `final-regressions-report.json`：47组，**7新＋876旧＝883项通过**，阶段均确认退出、无超时；子进程用时合计23.273秒。含本地图片／首次配置、关闭与重新启用、作者／预设／图库／主题、生成块／语法／CSS |

本轮修复后SDK覆盖 **141项（2＋14＋14＋111）**。受控可见性输入不冒充真实鼠标／窗口事件；两组12轮交互使用实际浏览器／原生侧栏，不是无限压力循环。所有SDK使用合成全年龄预览，不访问真实私密图片或壁纸。没有额外P2／Cadence／原生编译：本轮没有改播放／draw／主图片层／原生二进制。

四组自有headless Edge、server、桥接及订阅正常关闭，未强杀；页面清理计数及活动URL归零。URL创建／回收分别3／3、28／28、27／27、8／8。除原111组的既有合成普通播放外，专项组普通播放／作者命令均0。

旧受控失败发生在已完成page cleanup后的日志门禁；后续catch在已卸载root上读取observation产生的二次诊断错误一并保留。它不抵消主错误，也不把已另行确认的资源收尾改写成成功前提。所有失败、诊断、最终输入副本都在独立证据目录，不清理历史证据。

## 输入保护与后续

277项开工保护输入逐项一致。本轮仅原生模块及其生成client变化，**275项保持**；新增资源QA1项，最终278项。`input-delta.json`逐字断言：原生模块除Preview函数外保持；client除原生生成块外保持。因此Host、媒体事务、来源保存、作者生成块、原生生成器、manifest／生产assets均保持。

最终client SHA256：`6C471F8209EFBD3D729B9C355F27FFA678058830A67279B57301BFB9FA682EE0`。
原生侧栏 SHA256：`A821D2CC84E6F5407DDD9D8CE2EABA66F3F399B10D860FF65FAEF2BEC4AA78CE`。

资源创建／撤销及requestfailed诊断仅存在于明确标记的 `.tmp/native-preview-resource-20261023-63b240e7` 夹具；产品没有调试日志或调试入口。没有提交推送、清理、派发、恢复定时或日常应用操作。

本专项离线范围收尾。下一小步恢复既定顺序：接普通本地视频选择／移除，再单独接motion失焦暂停／始终播放；仍不整体打包开发树或自动安装。历史缺QA EXE及其它未覆盖验收保留；这次不扩大所有图库／格式／日常长期表现的承诺。
