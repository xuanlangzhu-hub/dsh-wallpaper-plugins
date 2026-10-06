# B rc.12 复审：竖排问题已修复，自动播放行需小范围收尾

日期：2026-10-06。结论：**L1 原来的逐字换行问题已修复并独立复现验证；还剩一个自动播放复选框布局问题，应小范围修正后再安排实机。** 不返工播放实现，不扩大范围。

## 已确认通过

- 新包 `release/plugins/dsh-whale-mist-0.6.0-rc.12.tgz`，SHA256 `6B95DCC5255E71BDC6024AE3414478CB4F29D4FF5838447DDDDE1DAAC94C24CD`；26 个文件全部与当前源码/资产逐字节一致。
- 相对 rc.11，包内只有 `src/client.js` 和 `package.json` 改变。客户端变化仅为 WE 专用 class、CSS 与说明注释；控制器回调和播放语义没有改变，Host/原生/资产未变。
- 原始布局复现脚本在**宽视口 1280px、窄面板 400/480/560/640/720px**上重跑：文字列已使用整个面板宽度，说明高 18px；控件可以换行，行 scrollWidth 等于容器宽度，没有原来的 0 宽文字列。
- DS 新增的实际 DOM 几何回归独立重跑通过，包含上述五个宽度、长说明文字和 640px 窄视口；按钮中心点命中测试通过。
- `npm run check`、`git diff --check` 通过；独立重跑外观回归 **30 项**、WE 设置逻辑回归 **136 项**，均通过（`appearance-regression.log`、`wallpaper-regression.log`）。

## U1 [P2]：自动播放行继承 column/stretch，复选框变成整行宽

位置：`dsh-whale-mist/src/client.js:1731`、`:2485`、`:2520`；新增 QA 的漏检点在 `qa/appearance-wallpaper-layout.mjs:337`。

`autoStartRow` 也加入了 `wm-wallpaper-row`，因此继承 `flex-direction: column; align-items: stretch`。后面的自动播放专用规则只设置文字/复选框的 flex，没有恢复行方向或约束复选框的横向尺寸。

独立几何结果：面板 400/480/560/640/720px 时，checkbox 分别也是 **400/480/560/640/720px 宽**。400px 时，文字在上，复选框元素为 400×13px，在下方；浏览器把实际方框画在整行中央。交付文档所述“自动播放行保留两列”与当前 DOM 不符。

隔离截图（不是用户真实 DSH）保存在：

- `F:\deepseekharness\.tmp\b-daily-rc12-review-20261006-192406\auto-row-before.png`：现有布局，方框在文案下方中央。
- 同目录 `auto-row-css-proof.png`：只在后台测试页面补专用横排与 16px 方框后的对照，文案在左、方框在右；**没有修改实现代码**。
- 同目录 `auto-row-proof.json`：现状 column/stretch、checkbox 400×13；页面内 CSS 对照 row/center、checkbox 16×16。

原 QA 仅断言 checkboxWidth > 0 且没有越出面板，因此整行拉伸仍通过。这一项不影响已确认的 L1 修复，但应该在进入下一轮安装前收尾。

## 给 DS 的最小修正与交付

1. 只修自动播放行的 class/专用 CSS。使文案与复选框关系明确、方框保持正常大小；可移除该行的通用 `wm-wallpaper-row`，或通过专用规则恢复横排。窄视口允许有意堆叠，但方框仍不能 stretch 成整行宽。不要把 WE 主设置行改回旧的两列挤压布局。
2. 补实际 DOM 断言：宽视口下自动播放行文案/方框位置符合设计，checkbox 宽高有合理上限（例如 12–24px；具体以采用尺寸为准）；400/480/560/640/720px 面板与窄视口均不拉伸、不溢出、文案可读。
3. 保留全部真实按钮回调、checkbox 的“只影响下次启动”语义、模式切换与取消/清理行为。不改 Host、原生或其它设置区。
4. `check` 与受影响布局回归通过后，新打候选（rc.13 若未占用，否则递增）；更新交付报告中的自动播放行描述和证据。原 rc.12、已有报告和原始证据保持不变，不覆盖同版本归档。
5. 不自行安装、退出 DSH、操作鼠标、开真实 WE 窗口或提交/推送。交审后先由用户核对实机布局，再继续 35 分钟与自动播放/清理验收。

## 本轮环境与证据边界

本轮证据：`F:\deepseekharness\.tmp\b-daily-rc12-review-20261006-192406`。
包含 `package-comparison.json`、`client-rc11-rc12.diff`、`original-layout-repro.json`、`layout-regression.json`、`auto-row-proof.json`、两张截图及独立运行日志。

只使用隔离后台浏览器和模拟 Host，未安装候选、未重启/操作真实 DSH、未运行真实壁纸。日常安装仍是 rc.1，四份 Profile 文件哈希与上轮恢复备份一致（`environment-unchanged.json`）。

**代码/几何检查不等于官方 DSH 实机验收；35 分钟长跑、完整重开自动播放、资源开销与闪窗仍未验收。**
