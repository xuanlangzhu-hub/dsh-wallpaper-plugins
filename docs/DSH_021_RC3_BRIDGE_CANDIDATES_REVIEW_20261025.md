# DSH rc.3 兼容过渡包核验

2026-10-25完成，接续[rc.3离线兼容核对](DSH_021_RC3_OFFLINE_COMPAT_REVIEW_20261024.md)。两个本地候选已独立构建、重新解包核验并保存到release；**尚未安装或发布**。日常仍为DSH0.2.1-rc.2／Whale rc.42／Git Bash0.1.1。工作区清单／生产assets不改，不提交推送、清理、派发或定时。

## 候选与来源

| 候选 | 固定底座 | 真实包内容 |
| --- | --- | --- |
| `release/plugins/dsh-whale-mist-0.6.0-rc.47.tgz` | 日常rc.42原tgz，原包37文件与实际日常完全一致 | 37文件；仅package.json、README变化，其余35项逐字节保持，含14项assets及全部既有运行代码 |
| `release/plugins/dsh-whale-gitbash-0.1.2.tgz` | `F:/deepseekharness/release/plugins/dsh-whale-gitbash-0.1.1.tgz`，7文件与实际日常一致 | 7文件；同样仅清单／README变化，其余5项保持，3个JS、预设补丁和LICENSE均不改 |

Whale rc.47 SHA256：`21792EBCD902F64AF2F4C4266F6EACC6F92C815634BCCEEDA1925EC3449B4176`。

Git Bash0.1.2 SHA256：`551034FA82E0513B28C77D943D35EE899D97B48F3023B6A54DB9572AAD7FCEE2`。

rc.47是**从日常rc.42派生的兼容过渡版**，不是rc.46的新侧栏合集；没有引入rc.43–rc.46候选、作者参数、当前对象小预览、工作区Trace或未实机视觉验收的UI。没有从整个开发树打包、编译原生资产或执行npm生命周期脚本。

清单只改候选版本、在`engines.dsh`追加精确`0.2.1-rc.3`，并给Whale6项／Git Bash3项DSH peer同步追加该精确版本。其余字段、入口、exports、依赖、scripts、dsh注入配置及包文件集合保持。继续覆盖原有旧宿主，不扩大到rc.4、正式0.2.1或0.2.2。

## 对实际tgz的独立检查

证据：`.tmp/dsh-rc3-bridge-candidates-20261024-74e0bf29`。目录日期沿用本轮开始时间；包含原包／候选文件哈希、builder、独立audit、实际解包、官方门禁来源、原样测试脚本／fixture与release归档核对。

1. Builder直接读取固定旧tgz，核对已安装文件集合后修改清单／说明，写入确定性gzip归档。没有把工作区JS复制进候选。
2. 独立audit重新读取旧tgz及新tgz，检查路径、重复项、文件集合、清单字段和每项字节；只允许README／package.json两项差异。再从实际候选解包供后续测试使用，全部20个JS语法通过。
3. 明确检查Whale候选中不存在`src/sidebar/`、author-properties运行文件和`WM_NATIVE_SIDEBAR_BEGIN`；仅声明兼容，不把尚未日常使用的功能塞入包。

## 官方兼容门禁与冒烟

从此前已验签的官方rc.3 Windows安装器内app.asar，提取`@deepseek-ai/dsh-app-boot/lib/index.js`的纯兼容判断区段，保留函数体原字节与来源／区段SHA256。只加ESM测试入口和semver绑定，以显式版本调用；没有启动app-boot、CLI或安装器，没有读活动Profile，也没有配置`allow-version`豁免。

官方规则是：**有engines.dsh时由它单独决定DSH兼容门禁；没有它时才逐项检查DSH peer。** 因此peer同步更新供依赖解析使用，不能误称DSH会在engine通过后再执行一次相同peer门禁。

| 检查 | 实际结果 |
| --- | --- |
| 官方函数及负对照 | **7项通过**：两个候选允许原已支持宿主和rc.3；拒绝未知未来版本；同一函数拒绝原包；撤回新engine声明仍能捕获；去掉engine后peer回退能捕获漏项；保留engine优先级；损坏字段／版本被拒绝。全部不使用豁免 |
| 实际Git Bash候选 | **9项通过**：从实际解包导入executor-core，检查路径、MSYS识别、继承／argv／UTF8环境、受限调用提前拒绝、显式完全访问才委托、逐次策略不被默认值覆盖。父执行器和schema仍是替身，不执行真实shell、不改变权限模式 |
| 实际Whale候选＋Windows rc.3 SDK | **3项通过**，3.374秒：实际解包client及Host的入口启动、原亮度／遮罩和存储投影、新More菜单共存与清理。使用已签名Windows包内真实SDK／前端及实际entry-customization模块，市场／模型操作禁止；不是用当前开发client替换候选 |

共16项门禁／执行器检查，0.321秒，子进程正常退出。三项冒烟中订阅、refs、pins、命令、DOM和URL残留均为0，URL创建／释放0／0；自有headless Edge、server和桥接正常退出，未强杀。原401认证错误的精确边界保持，未增加错误白名单或等待期限。所有本轮检查首次通过。

候选运行代码与日常原包相同，前轮已对rc.3做两套128项开发SDK回归；本轮没有重复与只改清单无关的整个UI／原生／性能矩阵。三项冒烟没有播放真实壁纸、运行完整桌面聊天／文件页或安装依赖；Git Bash真实命令及新宿主用户验收尚未进行。纯门禁函数通过不替代实际CLI安装／依赖解析／实机结果。

## 归档与下一步

核验成功后才把两个候选原样复制到release路径，复制前后SHA256一致。281项工作区保护输入、40个旧归档、日常Whale37项／Git Bash7项及原宿主app.asar保持；未修改两个源仓库的实现／清单，也未触碰活动存储或媒体数据。

下一步准备本轮升级执行清单与新备份／恢复流程，再取得当时方便、无任务、正常退出确认。安装时先使用同时兼容旧／新宿主的过渡候选，核对CLI实际结果和文件，再升级已核验的官方rc.3；仍需重新核验当时目标、签名及关闭状态。原WE保持，真实窗口／播放和Git Bash命令分步安排，不自动改变权限。

目前没有关闭状态的新备份、安装或新宿主用户验收。旧备份／旧退出确认不复用；未来回退先保留届时新数据，不能只换回旧二进制就假定数据已回退。原生侧栏及作者反馈UI继续作为独立后续任务。
