# 作者参数请求被播放计数更新打断：离线复现及最小修复

2026-10-21。本轮完成一个小范围：定位并修复一项确定的请求拒绝缺陷；**尚未证明它是rc.44实机未见效果的唯一原因，未重新实机验收**。日常rc.42保持。

## 现象与原因

实际主端每次收到wallpaper.subscribeStatus通知都会增加renderer snapshot的revision并推送Host；播放引擎每次渲染都会emitStatus，即使壁纸、窗口和权限没有变化。作者服务原先把这个总revision包含在异步操作前后上下文的全量比较中。

因此，读取元数据、保存或应用期间只要正常播放状态刷新一次，作者服务就会返回author_context_changed。应用前发生时不会发送属性命令。表单提示“选择、播放状态或连接已变化”，不能让用户区分正常计数刷新与真正换了目标。这是一项真实代码缺陷，不能以“用户没有按顺序点”解释。

## 可重复证据

证据根：`F:\dsh-wallpaper-plugins\.tmp\rc44-author-click-chain-20261021-7e8b62d0`。

从不可变rc.44归档解包42个文件，SHA256 `AC64390E3FA2C4791059816851FB927EA2E4FA33F0C7149BA4F1F7B31F95D433`。运行真正的无界面Edge DOM按钮点击、包内main renderer transport、认证HTTP Host与作者适配器。控制器状态通知与原生窗口/进程IO为注入替身，不启动DSH、WE或可见浏览器窗；参数声明只使用fixture的particles布尔字段，不加载真实作者场景代码。

固定20ms状态通知、40ms异步元数据/身份IO，以确定性方式暴露竞态；这些时间是复现条件，不是实际机器帧率或实机测量。

| 场景 | 原rc.44链路 | 最小修复副本 |
| --- | --- | --- |
| 目标稳定，无计数更新 | 保存成功，受控属性命令1次 | 同样通过，1次 |
| 保存期间持续更新播放计数 | author_context_changed，命令0次 | 保存及应用通过，1次 |
| 先保存，再在应用期间更新计数 | author_context_changed，命令0次 | 应用通过，1次 |

原包复现见click-chain-report.json，修复副本见click-chain-fixed-report.json，准确对照摘要见promotion-verification.json。报告中的属性命令次数是注入接收器记录，**真实WE命令为0**。两个浏览器运行均完成context/browser/Host/static server收尾，拥有的浏览器退出得到确认；Node父监督正常退出、无超时。未用截图作视觉验收。

## 修复内容与门禁

只改 `dsh-whale-mist/src/wallpaper/author-properties-host.js` 的作者上下文比较投影：仍验证输入revision格式，但不再把整个renderer的revision作为作者操作的失效条件。owner、selectedId、allowedRatings及生命周期generation、activeSceneId、location、cleanupPending、busy仍参与比较。作者草稿自己的expectedRevision继续用于并发写冲突检查；原生PID/HWND/UTC身份检查保持原实现。

新增 `qa/author-properties-context.test.mjs`：保存/应用两个阶段，各覆盖计数revision单独变化可成功，以及选择、owner、分级、撤权、代次、location、活动目标、停止、busy变化必须拒绝，共20项。保留原作者schema/表单/HTTP/适配器89项，实际源码合计109/109通过。先在隔离副本通过相同109项，再提升最小改动并在实际源码重跑109项；两个阶段分别保留输出，不称为一次运行218项。

275项保护输入中仅预期Host源码变化，另外274项保持；新QA单独登记。未改client、生产assets、manifest、原生二进制、固定归档、日常Profile或安装。只读核对日常rc.42仍37文件与固定归档一致。未打包、安装、提交、推送或清理。

## 结论与下一小步

已证明“普通播放计数使请求失效”可复现，并验证最小修复。未重放用户当时实际请求，不能宣称已锁定全部实机根因；命令接收器成功也不代表Lucy作者效果已验证。

下一小步先把相同播放计数竞态补到独立窗的完整真实DOM/HTTP链，核对不会因移除无关revision而漏掉真实切换/权限/停止变化；本步暂不改UI、不整体核包或重复335项。后续若进入候选及实机，另按届时方便确认、新备份和恢复流程执行。侧栏/直接应用/反馈改版要求继续按[UI要求](WALLPAPER_SETTINGS_SIDEBAR_REQUIREMENTS_20261021.md)规划，不混入本次修复。

## 独立窗后续复核

相同竞态已补生产独立页真实DOM/lease/SSE/HTTP链：原包2例拒绝复现，最小Host修复3正例+9真实状态失效负例通过；319项保护输入及日常rc.42保持。见[独立窗复核](AUTHOR_SETTINGS_COMPANION_CHAIN_REVIEW_20261021.md)。本轮未再改实现，作者视觉效果仍待后续实机确认；下一小步只整理最小候选。
