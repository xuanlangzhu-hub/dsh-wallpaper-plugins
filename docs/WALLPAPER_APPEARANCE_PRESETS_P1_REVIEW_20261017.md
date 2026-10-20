# 外观预设P1复审：暂不通过，补R1/R2

2026-10-17，Codex。复核[任务](GEMINI_NEXT_WALLPAPER_APPEARANCE_PRESETS_P1_20261016.md)、[小G交付](WALLPAPER_APPEARANCE_PRESETS_P1_DELIVERY_20261016.md)及实际diff。**语法/CSS守卫和原104项隔离外观断言通过，但真实停止异步过程及可用性边界存在两个已复现问题，本轮暂不通过。** 保留已完成的四字段预设、数据隔离和120%亮度，不扩大到主题扩展或发布。

## R1 [P2] 停止清理未完成时，预设已当作可编辑

定位：`dsh-whale-mist/src/client.js:4110`的idle/stopped放行分支；需结合`:1238`在发出Host stop请求前即发布stopped/idle的既有行为。

`resolvePresetTarget()`只看状态字符串，未确认是否还有stop/cleanup在途。因此“背景已隐藏/界面已显示停止”被误当成“源已完成清理”。

本轮通过真实controller、真实`wallpaper.start/stop`和延迟假Host回复复现，**未替换getStatus**：

1. 假Host接受Lucy启动、保持active，流处于connecting；选择合法可用B，预置B亮度90。
2. 调用真实stop，将其Host回复挂起。此时源在假Host侧仍active，stop Promise尚未结束。
3. 客户端getStatus已是stopped；预设resolveTarget却返回`ok=true/targetId=B`，保存/应用/删除三个按钮均enabled。
4. 调用save成功，以当前亮度115覆盖B原90，尽管Lucy源仍在停止/清理中。
5. 释放stop回复、确认closed后，本可正常编辑B的正向场景仍存在；问题是提前开放，不是停止后永远不能编辑预设。

**补修要求**：controller与UI共享真实的过渡/待清理判断；停止请求在途一律拒绝预设操作，清理失败保持拒绝，仅在本轮清理成功/无待清理播放时开放。不要只看旧lastCleanup或只给按钮加previewBusy；直接controller调用、reset/离开WE背景、内部停止等路径也必须遵守，旧请求迟到不能解开新轮的屏障。优先在现有前端状态接缝补最小状态，不改Host/原生清理规则。

## R2 [P2] 未确认目录项可保存，已知不可用项也能绕过UI写入

定位：`dsh-whale-mist/src/client.js:2847`的`!selectionKnownUnusable()`；以及`:4111`仅验证ID语法就放行的controller分支。

“暂未确认可用”并不等于“已确认可用”。当前UI排除了已知unusable，却仍放行pending；controller则完全不知道目标可用性，所有合法格式ID均可操作。

本轮复现：

- 以合法目录ID B启动设置，目录仍未加载/确认，真实UI保存按钮已enabled，controller.save返回ok并写入B。
- 假Host通过真实readLibrary返回B为`available=false`；将该快照用于组件后UI三个按钮正确禁用，但直接controller.save仍返回ok。

这不会启动WE或授予文件访问，但违反“仅当前可用的已选scene”和controller边界要求，UI与底层行为不一致。

**补修要求**：只读使用受限目录/Host已确认的快照，把“未知/读取中/不可用”与“已确认可用”区分，UI和controller统一拒绝不满足者。保留Lucy既有独立样例/回退规则，但Host明确报告Lucy不可用时不能放行。复用现有读取及请求版本边界，不为每次保存/应用/删除扫描目录或查询真实窗口；刷新/迟到回复不能把旧快照套到新目标。

## 本轮验证与证据

- `npm run check`通过；`npm run test:appearance`原104项通过。未重复场景选择、GPU/性能/像素或长测。
- 新增本机隔离反例使用真实生产client、现有fixture/控件，只有Host HTTP及组件目录快照受控；R1没有monkeypatch getStatus，明确保留未结束的stop Promise。没有连接真实DSH/WE、开真实源或截图。
- 复跑前后408个输入/保护文件指纹一致，包含347个工作区跟踪文件、任务/交付、26个旧归档、当前日常安装文件和5Profile。没有修改生产/QA实现或日常数据，manifest/assets保持，日常文件仍rc.31。
- 小G当前测试用直接替换getStatus验证静态starting/mismatch/cleanup-failed，能证明这些分支，但未覆盖真实异步停止窗口；原104项通过不能代替上述反例。

本轮目录：`F:\dsh-wallpaper-plugins\.tmp\wallpaper-appearance-presets-p1-review-20261017-b766789f`。

`before.json`、源码/QA快照、`check.log`、`appearance.log`保存原回归；`probe/probe-expression.js`及隔离runner保存复现步骤，`boundary-probe.log`给出两项`regressionObserved=true`，`review-verification.json`记录结论及保护核验。

复现命令：`node <证据目录>/probe/appearance-regression.mjs --preset-review`。它用于展现当前缺陷，不是修后自动通过门禁；正式回归须改成期望拒绝且用修后真实状态接口，不能把当前提前stopped的缺陷写成固定正确值。

## 给小G的最小补修与下一步

只补R1/R2及相应隔离回归，保持四字段/手动语义、默认值、120%上限、存储和reset隔离、已通过部分。至少证明：

1. 真实stop挂起时UI三按钮禁用、controller三操作拒绝；成功清理后可操作，失败后仍拒绝；reset/背景切换触发的清理也不留空窗。
2. 目录未确认/读取失败/项目不可用或被移除时UI及controller均拒绝；已确认可用的A/B能正常保存/应用/删除，Lucy回退不被误伤。
3. 保留A播放B已选的mismatch、持久化、存储失败和dispose检查；新增回归使用真实状态变化与假Host延迟，不只直接返回一个假getStatus。

补修交付写入`docs/WALLPAPER_APPEARANCE_PRESETS_P1_REPAIR_DELIVERY_20261017.md`，列实际命令/结果、覆盖的生命周期接缝及证据。无需重做已通过功能、主题/强调色、120独立候选、三体/GPU或实机流程；不改版本/assets，不打包安装、不提交推送、不操作应用或向其它会话发消息。

主题可读性/阅读底色/强调色的[只读设计记录](THEME_READABILITY_ACCENT_DESIGN_NOTES_20261016.md)保留，待P1补修复审闭合后再拆下一小步。日常仍rc.31；昨晚“停止/方便”不能作为今天真实应用操作授权。
