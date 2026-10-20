# 独立强调色 P1 补修交付报告（2026-10-17）

## 1. 概述与问题定位

本补修针对 [`docs/THEME_ACCENT_P1_REVIEW_20261017.md`](THEME_ACCENT_P1_REVIEW_20261017.md) 中提出的复审缺口：
- **A1 [P2] 设置页选中按钮没有接入自定义强调色**：
  - 定位：`dsh-whale-mist/src/client.js:3679` 的 `.wm-settings-option.is-selected` 在 baseline 下为中性色（`color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1);`），未被 custom 作用域规则接管，导致设置面板中已激活的分段按钮未能跟随用户自定义的强调色变化。

---

## 2. 最小补修实现

在 [`dsh-whale-mist/src/client.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/client.js) 的 `backdropCss` 中新增如下作用域覆盖规则：

```css
${accentSelector} .wm-settings-option.is-selected,
${accentPaletteSelector} .wm-settings-option.is-selected,
${accentDeepSidebarSelector} .wm-settings-option.is-selected {
  color: var(--wm-custom-ink) !important;
  background: var(--wm-custom-interactive-active) !important;
}
```

### 设计与边界细节
1. **轻底与文字接入**：
   - 背景色接入 `--wm-custom-interactive-active`（即 `rgba(raw, 0.20)`），与侧栏导航项和交互激活态保持视觉层级一致。
   - 前景文字接入 `--wm-custom-ink`，确保在深浅背景及 20% alpha 底色上均保持对比度 $\ge 4.5$ 的高可读性。
2. **零布局跳动（Zero Layout Jump）**：
   - 保持原有 `border: 0`、`padding: 4px 10px`、`border-radius: 8px` 及 `min-width: 64px` / `min-height: 30px`，未添加物理边框，切换选项或改变颜色时尺寸完全稳定。
3. **焦点保护**：
   - 键盘聚焦时由 `${accentSelector} :focus-visible` 接管，保持 `outline: 2px solid var(--wm-custom-ink) !important; outline-offset: 2px !important;`。
4. **跟随主题与卸载恢复**：
   - 仅在 `accentMode === "custom"` 且激活 Whale 主题时生效；切回 `theme` 模式时，`${accentSelector}` 不命中，立即恢复为基准中性底色（`bg-layer-1`）与文字（`label-primary`）；卸载或离开 Whale 活跃状态时无全局污染。

---

## 3. 隔离 QA 扩展（Section 3d）

在 [`dsh-whale-mist/qa/appearance-harness.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/appearance-harness.js) 中追加真实选中按钮计算样式套件（Section 3d）：

1. **真实组件 VNode 属性挂载**：
   - 调用 `fixture.controls()` 获取 `fixture.settingsComponent` 实际返回的 `custom` 选中节点和 `theme` 未选中节点，同步其真实 `className`（`wm-settings-option is-selected` vs `wm-settings-option`）及 `aria-pressed` 属性挂载到隔离真实 DOM 中。
2. **独立数值预期（不使用被测派生函数）**：
   - 采用硬编码的独立期望色值表：
     - **Red (`#ff0000`)**：Mist `#cd0000` (`rgb(205, 0, 0)`)；Abyss Ocean `#ff4d4d` (`rgb(255, 77, 77)`)；Graphite `#ff4949` (`rgb(255, 73, 73)`)；Violet `#ff4242` (`rgb(255, 66, 66)`)；Jade `#ff5555` (`rgb(255, 85, 85)`)；底色 `rgba(255, 0, 0, 0.2)`。
     - **Green (`#00ff00`)**：Mist `#007600` (`rgb(0, 118, 0)`)；Abyss 4 调色板均为 `#00ff00` (`rgb(0, 255, 0)`)；底色 `rgba(0, 255, 0, 0.2)`。
3. **完整覆盖维度**：
   - **红绿区分与响应**：验证 Red 与 Green 下选中按钮底色及文字计算样式完全不同，且分别命中红/绿对应色。
   - **主题矩阵**：覆盖 Mist 以及 Abyss 4 款调色板（Ocean, Graphite, Violet, Jade）。
   - **层叠胜出**：Graphite deep sidebar 状态下验证覆盖规则仍稳固生效。
   - **对比度增强独立性**：`textContrast === "enhanced"` 状态下验证选中按钮底色与文字不受普通正文增强覆盖。
   - **状态对比**：验证未选按钮保持透明底色（`rgba(0, 0, 0, 0)`）；聚焦状态轮廓命中 ink。
   - **无跳动**：验证 `borderWidth === "0px"` 且 `padding === "4px 10px"`。
   - **主题模式还原**：切回 `accentMode === "theme"` 验证立即恢复为非红绿的中性底色与文字。

---

## 4. 验证命令与实际输出

全部在独立临时 profile 与无头 Edge 隔离环境中执行：

1. **静态代码与 CSS 模板守卫**：
   ```powershell
   npm run check
   ```
   *结果*：`0` 错误，css template checks passed (2 template literals)。退出码 `0`。

2. **完整外观回归测试**：
   ```powershell
   npm run test:appearance
   ```
   *结果*：**495 项**断言通过（较上轮 458 项净增 37 项），退出码 `0`。

3. **英文语言与隔离套件**：
   ```powershell
   node qa/appearance-regression.mjs --english-suite
   ```
   *结果*：**491 项**断言通过（较默认套件少 4 项尾部媒体 runner 检查，符合预期），退出码 `0`。

4. **场景选择受限守卫**：
   ```powershell
   node qa/appearance-regression.mjs --scene-selection-only
   ```
   *结果*：场景选择行为对照通过，退出码 `0`。

5. **Codex 独立审查探针复跑**：
   ```powershell
   node F:\dsh-wallpaper-plugins\.tmp\theme-accent-p1-review-20261017-21a90fbc\probe\appearance-regression.mjs --accent-review
   ```
   *结果*：
   - `41` 项强断言通过；
   - `actual-settings-selected-accent` 探针输出：
     - Red: `color: rgb(255, 77, 77)`, `background: rgba(255, 0, 0, 0.2)`
     - Green: `color: rgb(0, 255, 0)`, `background: rgba(0, 255, 0, 0.2)`
     - `borderWidth: 0px`
     - **`regressionObserved: false`**（回归缺口已完全闭合！）。
   - 退出码 `0`。

6. **基线配对与边界测试**：
   ```powershell
   npm run test:check-pairing
   npm run test:temp-profile-boundaries
   ```
   *结果*：8/8 通过，11/11 通过，退出码 `0`。

---

## 5. 交付边界

- 零改动 Host、零改动原生代码、不触碰 `app.asar` 或官方桌面程序。
- 工作区 manifest 与 assets 保持 `rc.30`，用户日常试用版本保持 `rc.31`。
- 不打包、不安装、不推送、不向其他会话发消息。
- A1 选中态补修已完整闭合，等待 Codex 与用户复核。
