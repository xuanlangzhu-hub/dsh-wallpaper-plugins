> 后续实机结果：[rc.41 批准 web/Lucy 短验及恢复交接](RC41_WEB_SHORT_TEST_20261020.md)通过，用户确认恢复后正常重开；日常保持 rc.40。下文“未安装/待短验”指候选核验时状态。

# 本地 web 最小接入与 rc.41 候选核验

2026-10-20。**源码离线接入及 rc.41 实际归档检查通过，未安装。** 前轮[无采集源观察](WALLPAPER_WEB_SOURCE_ONLY_RESULT_20261020.md)中，用户确认“Deepseek鲸鱼娘萌物！”的秒钟和粒子持续变化，并已正常重开 DSH、原外观布局正常、播放停止。当前日常仍 DSH 0.2.1-rc.2 / 外观 rc.40 / Git Bash 0.1.1；本报告不代表 DSH 内 web 采集、显示和停止已实测通过。

## 最小改动与范围

- catalog 仅将批准根内、非空普通 HTML/HTM 入口的已登记 web 列为可手动实验；实际开始前重读 project.json，复核类型、声明、入口与物理路径。缺失 HTML 不借用 scene.pkg 回退。
- 主面板、嵌入式与独立窗执行器的类型门禁一致加入 web。前端仍只提交 ID，伪造 type/project/file 不进入原生启动参数。
- 实际 Host/library/session 继续向既有 helper 传原项目 JSON，保留网页资源目录；web 不进入 MP4 ASCII 单文件桥。library/session/helper/原生资产不需改动。
- 保持默认 Everyone、隐藏分级不预览、选择与播放分离、清理未确认锁，以及 Lucy-only 自动播放名单。application、非 MP4 video、两项大写 Scene 兼容缺口另排；不展开作者参数、输入转发或音频。

只重验项目入口与现有路径边界，不承诺审计每个动态资源或约束作者运行期网络；路径校验不等于网页运行时沙箱。批准样例的源窗口成功不代表其它 web 均成功。

## 隔离验证及源码提升

隔离证据：`F:\dsh-wallpaper-plugins\.tmp\web-offline-integration-20261020-950fd0bb`。

实际执行 catalog、library、Host start/restart/stop 路由、session、主面板和权威动作；原生 helper/worker/管道为明确的底层 IO 替身。合成 HTML 不渲染，不启动 WE、浏览器或 DSH。新 12 项覆盖 HTML/嵌套 HTM、非 HTML 拒绝、删除/类型/声明/越界变化、无 scene.pkg 回退、JSON 启动而非 MP4 桥、清理失败阻塞、失败重启保留 Lucy、实际动作与面板可用性及自动播放名单。

首轮 237 项中 234 通过、3 失败，证据保留：旧 UI 表仍预期拒绝 web；新 QA 调用了不存在的 snapshot；向 harness 误传源码内容而非文件路径。修正 QA 后主回归 **237/237**、销毁 **24/24** 通过。随后把嵌套 HTM fixture 修成真实嵌套目录，再独立 **12/12** 通过；最终候选又完整执行下表测试，不把重复执行累加为新增覆盖。

提升前冻结并核对原文件指纹，目录初始化 QA 另与 HEAD 核对，7 项源码/QA逐项提升：4 个产品 JS、2 个既有 QA、1 个新增 web QA。`promotion-before/`、`source-before-complete.json`、`promotion.json`保留前后证据。218 项保护输入按明确的 6 项既有变更核对，其余 212 项保持；新增 QA 单列。工作区 package/manifest 仍 rc.30、生产 assets 和旧归档保持，没有整体复制隔离树。

## 固定 rc.40 最小制作 rc.41

候选证据：`F:\dsh-wallpaper-plugins\.tmp\rc41-web-candidate-20261020-315ae872`。

| 项目 | 结果 |
| --- | --- |
| 新归档 | `release/plugins/dsh-whale-mist-0.6.0-rc.41.tgz` |
| SHA256 | `DB920CCD4E0436AF384F3C68E00DE60F7275A20422F0BB8DB9FF01CC4EACB03A` |
| 大小 / regular 文件 | 7,169,438 字节 / 37 |
| 固定基底 | rc.40，SHA256 `E83255202DCE92EB1FC1C37345827544729AA769BCB669CB61169024ABA4F1FB` |
| 差异 | 6 项既有文件变化、31 项相同、0 新增/删除 |
| 变化文件 | README、package 版本、catalog/client/detachable-contract/companion JS |
| 原生 | assets/wallpaper 的 12 项逐字节等于固定 rc.40，无复编、无 Trace |

构建只对固定 rc.40 的 4 个产品 JS应用逐项计数的精确补丁，另改说明和候选版本；未把含 Trace 的开发 client/session 整份带入。manifest 解析后仅版本变化，兼容声明、权限和 exports/files 保持。归档仅 regular 成员，拒绝路径穿越、ADS、链接、重名与大小写冲突；无 QA、Profile、存储、媒体、预览图、PDB、凭据或开发诊断文件。按现有名单搜索 Trace 特征字节与 UTF16 形式均无命中。

| 实际 tgz 解包检查 | 结果 |
| --- | --- |
| web/库/Host/会话/清理/MP4/桥接/UI/P0/P1A/初始化 | **237/237**；10.484 秒，PID29748，exit0 已确认，无超时 |
| 独立窗释放/销毁 | **24/24**；6.910 秒，PID33292，exit0 已确认，无超时 |
| 静态检查 | 17 个产品 JS语法、CSS 模板守卫、18 条静态相对导入闭包通过 |
| 逐文件核验 | 测试后实际解包 37 项仍匹配归档；排他写入 release 后 SHA256 一致 |
| 现场保护 | 日常安装 rc.40 的 37 项仍匹配固定 rc.40；未读取或覆盖重开后的活动存储 |

QA 另放在真实解包目录旁，导入真实包内产品文件，没有写进 tgz。测试内部 30 秒期限、外层 40 秒中止/45 秒最终报告；仅按本轮自有子进程收束。构建 Python 15 秒截止，静态子进程每项 3 秒截止。释放检查有实际 loopback HTTP/SSE，但不是真实 Edge/DSH 窗口。原生启动、WGC 和物理显示不在离线覆盖内。

## 下一步实机范围

候选已具体可审，下一步需重新确认当时方便、DSH 无任务并正常退出；前轮用户已重开，不能复用旧退出状态。新备份当时 rc.40、Profile、关闭存储及布局后，临时安装 rc.41并逐文件核验。仅 Everyone 中批准的同一 web，日常模式、自动播放关闭，手动约 20 秒观察秒钟/粒子后停止，核对同轮源/worker/采集清理；随后做一次 Lucy 短回归。默认正常退出后保留测后证据，恢复本轮 rc.40 和原设置，正常重开确认。若异常即停并留证，不循环重试。

本阶段没有新安装、开窗、退出、重开或采样日常 DSH/WE，没有模型请求、提交推送、清理历史证据、修改系统代码页/解码器/GPU或恢复定时。前轮无采集源观察的授权和动作单独见源观察报告。
