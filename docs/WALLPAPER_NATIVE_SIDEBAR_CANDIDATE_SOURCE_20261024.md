# 原生侧栏首版：隔离候选源整合与复核

> 后续：[rc.46实际核包](RC46_NATIVE_SIDEBAR_CANDIDATE_REVIEW_20261024.md)已通过；发布候选与本报告的未定版本隔离源分开保存。下一步是另取当时方便确认后的分组短验，当前仍未安装。

2026-10-24，承接[首版清单](WALLPAPER_NATIVE_SIDEBAR_FIRST_RELEASE_CHECKLIST_20261024.md)。固定rc.45原包的独立副本已合入侧栏必需改动并排除Trace，候选源范围验证通过。**本轮没有制作tgz、更新发布版本或安装；日常仍为DSH0.2.1-rc.2／外观rc.42／Git Bash0.1.1。** 共享开发源码、manifest／生产assets和旧归档保持。

## 输出与范围

证据根：`.tmp/native-sidebar-candidate-source-20261024-b96ec2a7`。

- `base`：原rc.45归档的42文件安全解包，逐成员核对，无链接／路径越界／重复文件。
- `reviewed`：本轮读取的已审源码副本；`integrate.py`记录确定的整合与底座恢复步骤。
- `candidate`：**43个运行文件的隔离源码树**，无QA／开发Trace／新增采集二进制。
- `verify/dsh-whale-mist`：与candidate的43运行文件逐项相同，额外带223项QA／单一来源侧栏／生成器材料；这些材料不是候选运行载荷。
- `STAGING_ONLY.md`明确不可安装或发布。package.json和README仍为底座rc.45原字节，当前只是加载与源验证环境，不能包装成同版本新包覆盖原归档。到核包阶段再确定候选版本与说明。

底座原包：`release/plugins/dsh-whale-mist-0.6.0-rc.45.tgz`，SHA256 `BAD91155A95C457AF0FB52E8C52BC58A765F9F23ACABDA7DD2F6C11F83FDFBCC`。

## 最终差异：3改、1增、39继承

| 运行文件 | 本次隔离整合 |
| --- | --- |
| src/client.js | 原生生成块与正式顶栏入口、共享controller及旧页互斥、图库／作者即时应用及恢复、预设、来源关闭／启用、本地图片／视频和motion；保留必要校验和状态发布修补。作者表单仅增加所需验证函数导出，减少透明度样式补充实际属性选择器 |
| src/wallpaper/session.js | Host关闭状态／命令结算／关闭证明路由与生命周期；与Trace交织的原生采集段恢复为底座 |
| src/wallpaper/author-properties-host.js | 已审的投递状态、本地待发送记录恢复、结构刷新及旧记录确认；保留rc.45作者计数竞态修复、身份／分级／单执行器门禁 |
| src/wallpaper/close-fence.js（新增） | 客户端来源交接所依赖的实际Host关闭证明模块，已纳入运行树 |

底座其余**39文件逐字继承**。14项资产全部等同固定rc.45，含12项原生运行文件；没有使用工作区不同的WallpaperProbe.dll，没有编译。detachable-contract、companion.js、companion HTML的纯格式差异不带入，旧桥／独立窗及其它运行文件也保持底座字节。

共享开发树本身继续保留Trace及原脏改动，本轮没有反向覆盖它们。真正Windows独立窗迁移、其它壁纸作者参数扩展、全局reset迁移、三体／GPU／性能专项不在首版内。

## Trace剥离的正面证明

本轮不是简单删除导入或全局搜索替换：

1. 客户端run context、reportMetrics至command前的完整收帧／解码／调度／绘制处理路径，以及主背景paintWallpaper，均逐段恢复为rc.45底座并作字节等同比较。必要的命令账本、close fence及本地结束整理保留。
2. Host的registerWallpaperRoutes之前原有内容整体来自底座，仅增加crypto及close-fence两个路由级导入；去掉这两行后与底座整个前缀逐字一致。原createPreviewSession、原生helper参数、写报告、worker释放与采集时序都没有跟随开发Trace改动进入候选。
3. frame-hub.js逐字等同底座；无cadence-trace.js新模块。运行JS中无Trace模块／API／环境开关／helper参数名称，记录导出、停止时flush／等待、流连接Trace和Trace HTTP路由均排除。
4. 在**直接加载candidate Host模块**的独立门禁中，即使显式传入旧cadenceTrace选项，GET／POST `/whale-wallpaper/cadence-trace`都返回404；关闭状态路由正常，探测未改变Host关闭状态，native IO为0，Host正常dispose。

`source-audit.json`记录上述8个边界断言、43项最终哈希和34条相对JS导入闭包。没有据静态闭包就承诺其它SDK／真实宿主能力，另由实际SDK链路验证。

## 验证绑定的是候选源

| 检查 | 本轮实际结果 |
| --- | --- |
| 候选源回归 | **977项通过，51阶段通过**；包括原931项加本次46项基础播放UI／Host路由检查。阶段子进程用时合计28.510秒；全部确认退出，未超时 |
| 生成／静态 | 两处生成块一致；候选全部23个JS语法通过，34条相对导入闭合，CSS检查通过。额外语法组父监督3.690秒正常退出 |
| 真实SDK媒体／motion | `candidate-motion-sdk-report.json`，**19项通过**，6.435秒；使用候选client、候选Host关闭证明及已审ESM侧栏，真实WebM解码、文件选择、IndexedDB、来源恢复和同一video策略切换 |
| 真实SDK完整原生流程 | `candidate-full-sdk-report.json`，**111项通过**，24.514秒；原生容器／作者参数／预设／图库等旧回归，原HTTP401／409及资源错误门禁保持 |
| Trace运行边界 | `trace-boundary-report.json`，旧Trace两路由404、关闭读数与生命周期正常、native IO为0 |

两组SDK共**130项（19＋111）**。报告中productClient哈希必须等于candidate client；ESM侧栏与reviewed副本相同，媒体专项proofHostInput必须等于candidate session哈希。运行文件在verify与candidate中逐项相同，全部266项verify输入在测试后保持；不是拿共享工作区测试结果冒充此次候选通过。

隔离官方冻结SDK的实际renderer／会话／右侧栏服务和完整Whale apply运行；DOM、WebM、IndexedDB与普通存储是真实的。窗口／WE／作者命令底层IO仍是明确替身；motion焦点与隐藏读数受控，减少动态用浏览器仿真，不冒充Windows实际切窗、采集或视觉效果验收。

两组页面卸载后订阅、refs、pins、DOM与活动URL归零；URL创建／撤销分别13／13、8／8。自有headless Edge、server和桥接均正常关闭，无强杀或后台等待。测试只使用合成全年龄素材，没有触碰用户壁纸、日常DSH／WE、Profile或已安装插件。

没有运行全量旧原生／性能矩阵；固定二进制的既有验收按字节继承。历史15项缺QA EXE、旧超时、首次断流、三体变速及低优先级滚动等结论不被本轮测试抵消。

## 保留的失败记录

- 整合脚本首次严格断言预期有两个finalize调用，但恢复底座render段已移除其中一个，实际只剩一个。断言在改写candidate client之前停止；核对冻结源码后修正为准确计数，从不可变base／reviewed重新生成，未放宽Trace零残留与底座等同断言。
- Trace边界脚本首轮传相对路径，但父监督cwd已改到verify，导致启动前模块路径不存在；改为绝对路径。下一轮底层response桩缺Node的setHeader，实际路由入口抛错；补齐response契约后通过。原始stderr／退出结果保留；没有修改产品路由以迎合夹具，也未提高期限或白名单。

最终51阶段和两组SDK均通过，失败轮不计入通过数量；本轮未发现需回改共享源码的新产品缺陷。

## 保护、指纹与下一步

开工281项共享源码／QA／资产指纹与前轮一致，收尾全部保持。原rc.45归档、base42文件、候选43文件、verify266输入均分别核对；原生模块仍等于前轮`A6608E5A13BC706AF22108A33CE06E2EA704E25D6C33E78CA15626AC09A35F3D`。

| 隔离运行文件 | SHA256 |
| --- | --- |
| client.js | 3A9B3E298014F903D9A3AEDA40F38E452640F77D1B0DF4C0D879F52E1B248A91 |
| session.js | BFD991CF034B590CDF4740A0771E62C23D9C865834611D29F1CC491FA2149E01 |
| author-properties-host.js | E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97 |
| close-fence.js | 2977C6500FDF09508E43836008E9F9CC442AB1920E7767F91F60F79FC6A7B4C9 |

下一小步：以此**固定43文件候选源**确定新候选版本与README范围，在独立位置制作tgz，再对实际解包内容做文件集合／资产／Trace／导入／加载及适用回归复审。不能直接打开发树，也不能把本次源检查当成将来的tgz核包。仍不安装；实际短验需届时方便／无任务确认、新备份，默认恢复当轮原设置和rc.42。普通外观持久化吞异常、非Lucy作者参数、当前壁纸小预览、窄窗／长列表与实机焦点等未完成边界沿用首版清单。

本轮仅新建隔离材料及报告、更新接续文档；manifest／生产assets仍rc.30。未提交推送、清理、派发消息、操作其它助手或恢复定时。
