# 作者设置 P1A：正式认证与双端草稿离线交付

2026-10-21。本轮完成 P1 的认证、双端表单和共享草稿部分；**P1 整体尚未完成，真实 WE 参数下发未接入**。日常仍为 DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1。本轮没有打包、安装、启动或操作日常 DSH/WE，没有模型请求，也没有写 Profile、活动存储、原壁纸或 WE 配置。

## 实现结果

- `index.js`保留唯一 wallpaper API，并把其实际代次、活动ID、location、操作占用及清理状态交给原 detachable Host。独立窗和主侧栏没有各建一个控制器或播放管线。
- 原 loopback Host 内新增 `/api/author-properties/schema`、`/draft`，复用已认证主端注册及伴随窗 lease。主端 token/instance/generation、伴随窗 lease/generation 与各自 Origin 均重验；分级、所选ID来自已注册主控制器快照，活动窗口状态来自真实 Host，均不接受参数请求体声明。
- 主端和伴随窗共用 `main:<generation>` 内存草稿，具有修订冲突保护；主端换代/销毁清除旧 owner。读取前后校验连接、选择、策略、修订及播放代次；过期 lease、停止及重注册后的迟到结果拒绝。沿用P0受限读取、body超时/大小、并发占位、schema漂移和默认值增量保护。
- `author-properties-panel.js`是两端共用的真实表单。主端 ModuleLoader 无ESM导入，因此通过 `scripts/build-author-panel.mjs`生成明确标记的契约/表单闭包；独立窗直接导入同一源文件。`--check`核对生成结果，避免两套实现漂移。
- 参数位于所选壁纸详情下，支持开关、滑块与数值、颜色、类型保持的选项、有限文本；提供搜索、分组折叠、独立滚动与安全文本渲染。作者 group/text 作为结构，条件参数明确显示暂不支持，不执行条件表达式或HTML。空参数和不支持项有不同说明。
- 明确显示“草稿”“作者默认值不代表壁纸当前值”。保存只发本地改动增量；冲突后刷新保留本地未提交修改；恢复作者默认草稿需独立勾选确认。非法数值输入阻止保存，避免错误显示值与旧有效值错配。草稿不持久化到磁盘，主连接结束即清除。
- 切换、隐藏分级、断连或卸载取消旧表单请求。每次请求最多4秒；即使transport忽略abort，表单也能返回。没有轮询或自动重试循环；未因无关外观修订反复读取作者元数据。
- 正式静态清单仅加入浏览器表单、共享契约和managed-window导入闭包。Node schema/Host、index.js、任意文件不开放。

## 明确未完成

“应用到当前壁纸（待接入）”保持禁用，正式入口不开放`plan`或`apply`。P0只读计划仍仅供内部离线检查。本轮没有任何WE属性命令，更没有实际值回读或视觉效果验收；不能把中文草稿HTTP传输通过等同于WE命令Unicode传参通过。选择B而播放A时仅能编辑B草稿，不改变A。

后续按[定向参数下发任务](WALLPAPER_AUTHOR_SETTINGS_APPLY_TASK_20261021.md)推进，完成单独离线审查后才考虑固定rc.42来源的最小候选。当前不具备新一轮安装/实机授权。

## 检查及证据

独立冻结目录：`.tmp/author-settings-p1-20261021-7f5b1e90`；指针`.tmp/current-author-settings-p1.txt`。源码/QA/资产188项冻结；提升7个既有文件、4个新增文件，181个其余输入保持。`before.json`、`audit.json`、`promotion-before/`及`promotion.json`保存前后指纹。manifest/生产assets未改，日常rc.42固定归档SHA保持，安装37项逐项一致；没有读取活动Local Storage。

| 检查 | 结果及实际边界 |
| --- | --- |
| 最终主回归`p1verified` | 301/301，9.752秒，PID1936正常退出；包含P0、目录/scene/video/web、Host清理、播放UI、独立窗及16项新接入检查 |
| 销毁专项`dispose` | 24/24，6.794秒，PID36328正常退出；现有共享客户端销毁链保持，新嵌入主端连接失效另由新接入检查覆盖 |
| 新接入检查 | 真实HTTP认证/双端草稿冲突/禁止apply、分级/选择/停止/注册/lease漂移、生产静态导入闭包；实际共享DOM表单、主端ModuleLoader组件及其已确认代次transport、独立窗app连接/销毁。DOM、React钩子和底层metadata为替身，未运行Chromium或真实窗口 |
| 实际Cordis载体`author-properties-sdk.mjs` | 官方Electron以Node模式隔离加载真实Cordis和本轮index，bootstrap拒绝/允许、主端注册、作者入口及Host生命周期接线通过；认证admission是替身。未扫描本地目录，合法作者请求因目录未加载返回`author_library_unavailable`，不是已读取真实作者参数。PID28704、405毫秒正常退出 |
| 静态检查 | 10项JS/QA/生成脚本语法、共享生成一致性及CSS模板检查通过 |

测试外层40秒watchdog、45秒退出未知兜底；SDK外层8秒/12秒。所有本轮测试子进程正常退出，未触发强制收束；没有全局结束Node/Edge/WE。各轮日志分别保留，不把重复跑测相加计数。

首次新专项14/15：reset替身返回的revision仍为0，低于已刷新到1的草稿，被真实模型正确拒绝；修正替身为新revision2，保留`p1.stdout.log`失败证据。后续300/300、连接断开补充后301/301、阶段等待增加500毫秒期限后最终301/301。静态审计曾因Windows路径分隔符比较报错，统一比较格式后通过；没有放宽文件白名单或门禁。

实机布局、作者代码响应、真实值回读、Unicode命令边界及长期表现尚未验收。A滚动、application、三体、性能/GPU和定时均未推进；本轮未提交、推送或清理。
