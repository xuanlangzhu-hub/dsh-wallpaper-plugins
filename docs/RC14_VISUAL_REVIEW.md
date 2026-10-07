# rc.14 视觉复审未通过：整框架遮挡与测试假通过

日期：2026-10-07。结论：**暂不安装 rc.14。V2 生产样式方向正确，V3 常用宽度按钮已变大，但仍有 R1–R3 需小范围返工。** 本轮不改实现，由 DS 修复后出新候选再交审。

候选 SHA256：`F94D429BDE366303E238E03F9D058EE1E15AE804A6B20CC0DE218A0DE69EFCE8`。
包内 26 文件；相对 rc.13 只有 `src/client.js`、`package.json`、README 改变，Host/原生/资产未变。当前源码与包仅 README 不一致，代码和资产一致；下轮打包后记录最终 README/包一致性，不覆盖旧归档。

证据：`F:\deepseekharness\.tmp\b-visual-rc14-review-20261007-111030`。独立临时浏览器、只读官方 CSS，无真实 DSH/WE 操作；日常仍 rc.1。

## R1 [P1]：顶栏修复把整张壁纸遮掉

`src/client.js:2490–2492` 同时给 `.BynINW_frame` 和其 `::before` 设置不透明背景。但真实宿主 `.BynINW_frame` 是 **height:100% 的整个应用框架**，不只是顶栏。

独立对照使用只读取得的官方完整 layout/conversation CSS、真实层级 `#wm-backdrop` 在后、`#root > .BynINW_frame` 在前，1000×600 视口、35% surface、亮洋红测试壁纸：

| 项 | rc.13 | rc.14 |
| --- | --- | --- |
| frame 范围 | 0,0,1000,600 | 同左，覆盖整个应用 |
| frame 背景 | rgba(15,23,38,.35) | rgb(8,11,20)，完全不透明 |
| 聊天空白区实际像素 (500,200) | 171,8,179，可见壁纸 | 8,11,20，只剩实色 |
| 侧栏实际像素 (100,200) | 116,13,129，可见壁纸 | 10,15,26，没有壁纸 |

见 `independent-rc13.json/png`、`independent-rc14.json/png`、`pixel-proof.json`。未宣称真实 DSH 截图，但宿主尺寸规则和层级参与了对照。

DS 遮挡检查也通过，却断言 `frame.a===1`（`qa/appearance-wallpaper-overlay.mjs:304`），把全框架不透明当成成功；只看 sidebar 自己 alpha=.35，忽略其下方已被父框架实色覆盖。

**修正**：保护实际顶栏/拖拽区域或局部顶部背景带，保留内容区壁纸可见；不能给整应用 frame 填完全实色。需要时保护真实会话顶部，但必须限定矩形范围。新增完整父子层级的像素/截图检查，同时要求顶栏遮住源装饰、聊天空白与侧栏仍可见测试壁纸；不把“自身计算透明”当成合成后可见。

## R2 [P2]：渐变 alpha 检查仍会把透明当不透明

`qa/appearance-wallpaper-overlay.mjs:208,213` 的 `/\s+/` 位于普通模板字符串中，实际发给浏览器变成 `/s+/`；已经解出真实页内表达式，见 `actual-page-expression.js`。
`stripLength` 因此没正确去掉末尾 `36px/100%`，`colorAlpha`（170 行起）把带长度的整个 stop 赋给 `style.color`，无效赋值被忽略，再从 span 读到继承的前景色，返回 alpha 1。

**隔离负对照**只撤掉 composerSeat/overlay 的遮挡规则，保留 V1 与内卡片实色，原测试仍 exit 0：

```
seatBackgroundImage = linear-gradient(color(srgb 0 0 0 / 0) 0px, rgba(0,0,0,0) 36px)
seatBackgroundColor = rgba(0,0,0,0)
seatEndAlpha = 1
```

见 `mask-regressed-client.js`、`mask-regressed-test.mjs`、`mask-regressed-output.json/log`。这不是生产源码修改。

加载完整旧 rc.13 时两套 DS 测试确实失败、新版通过（`ds-negative-controls.json`），但旧版 overlay 首先失败在 V1 选择器，不证明 V2 能独立捕获原缺陷。

**修正**：避免模板吞转义，或在独立页脚本里定义解析；赋值前检查 `CSS.supports('color', value)`，拒绝无效颜色，不允许继承色兜底。加 0/.35/1 的颜色和渐变解析 sanity check；必须保留“仅移除外围遮挡、内卡片仍不透明”的负对照，透明末端应为 0 且检查失败。V2 生产保护保留，不因测试修理恢复整个 body 实色。

## R3 [P2]：按钮组漏 display，gap/flex 实际没有生效

`src/client.js:1719` 去掉了原 `wm-media-actions` class，该类原本提供 display:flex；2535 行的新 `.wm-wallpaper-actions` 只有 flex-wrap/align-items/gap，没有 display。

独立量测：新组为 **display:block**。560/400px 下三个 96×36 按钮能放下，但实际间距为 **0px**，`flex:1 1 0` 不工作；280px 下开始/重启同排，停止又单独换下一排（`independent-rc14.json`）。DS 检查只测 400–720px、未断言容器 display/真实 gap，所以通过。

**修正**：明确用 flex/grid 布局与实际间距，正常宽度等宽同排；极窄宽度采用有意的完整布局，例如整组单列，而不是停止落单。回归至少检查 560/400/280px、真实间距、按钮高度/字号、运行与清理失败状态；不要通过移除窄宽度用例让测试变绿。保留三个真实回调和 disabled/busy/重试语义。

## 下轮交付

1. 仅 R1–R3 小范围修复。Host、原生、长期帧循环和资源归属不改；不重建未改资产、不重跑同一 35 分钟。
2. 新候选 rc.15（先确认未占用），新 tgz 与 SHA256；原 rc.14/rc.13 与原始证据全部保留。
3. `check`、受影响逻辑/布局/遮挡回归；同时证明旧版/独立缺陷负对照失败、修复版通过，以及内容区壁纸可见。三处实际形状/可见性都要看，不能只看规则命中与自身背景 alpha。
4. 当前代码用了 BynINW/Dc7zOa/RlGAzG 哈希类名，注释所称“不是 hashed class”不准确；注明当前宿主约束或使用可靠限定，不把版本私有类名称为公开稳定钩子。
5. 交付最终包/源码一致性与针对性证据，明确隔离 DOM 不等于真实宿主验收。DS 完成后交审；不自行安装、退出 DSH、开真实 WE 窗口或抢鼠标。

本轮 `npm run check`、DS 布局/遮挡回归通过，但因上述实际回归与检查假通过，不构成视觉验收通过。无需用户现在重启或操作日常应用。
