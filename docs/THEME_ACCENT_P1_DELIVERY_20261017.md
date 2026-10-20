# 独立强调色 P1 交付报告（2026-10-17）

## 1. 概述与任务目标

依据 [`docs/GEMINI_NEXT_THEME_ACCENT_P1_20261017.md`](GEMINI_NEXT_THEME_ACCENT_P1_20261017.md)，本轮已在 `dsh-whale-mist` 完成“独立强调色 P1”（Independent Accent Color P1）的前端设置校验、确定性颜色派生、CSS 变量层叠投影、双语言交互设置界面与隔离自动化回归验证。

本轮严格遵守既定边界：
- 仅修改 `dsh-whale-mist/src/client.js`、`dsh-whale-mist/qa/appearance-harness.js` 及必要的 runner/文档。
- 零改动 Host、零改动原生代码、不触碰官方桌面文件（`app.asar`、官方 EXE）。
- 不执行打包、不安装新包、不热更应用，工作区 manifest/assets 冻结在 `rc.30`，日常试用保持在 `rc.31`。
- 壁纸预设（`dsh-whale-mist.wallpaper-appearance-presets.v1`）严格锁定四字段（`brightness`, `mask`, `blur`, `surface`），强调色设置绝不进入预设。
- 保持既有状态语义色（warn/success/error/idle）、文字对比度增强（textContrast）、聊天底色透明度（chatBackdrop）完全独立。

---

## 2. 字段规范与存储迁移

### 2.1 字段定义与默认值
全局存储 key 维持 `dsh-whale-mist.appearance.v1`，新增两个顶层字段：
- `accentMode`: `"theme"` | `"custom"`，默认值 `"theme"`（跟随主题）。
- `accentColor`: 严格 6 位十六进制色值（小写归一化），默认候选值 `"#8c72f2"`（Abyss Ocean 的紫色强调色）。

### 2.2 校验与归一化（`normalizeSettings` / `isValidSetting`）
- **格式校验**：严格正则 `^#[0-9a-fA-F]{6}$`。拒绝 3 位/8 位 hex、rgb()、非字符串或带有非法字符的值。
- **存储补全**：若本地存储中缺失字段，`accentMode` 默认 `"theme"`，`accentColor` 默认 `"#8c72f2"`。
- **容错防污染**：
  - 若 `accentColor` 格式损坏，自动回退到 `"#8c72f2"`；
  - 若 `accentMode === "custom"` 但存储中的 `accentColor` 格式非法，`accentMode` 自动降级为 `"theme"`，防止无效颜色污染界面。
- **冷启动与候选保留**：在 `"theme"` 模式下，用户曾输入的合法 `accentColor` 会保留在配置中，但在切回 `"custom"` 之前不会产生 CSS 投影。
- **Controller 保护**：`controller.set('accentMode', invalid)` 或 `controller.set('accentColor', invalid)` 直接拒绝并返回原设置，不触发持久化或重投影。

---

## 3. 确定性颜色派生与可读性算法

所有派生函数均为确定性数学计算，无随机性、不依赖 DOM 测量或浏览器私有 API：

### 3.1 相对亮度与对比度（WCAG 2.1）
1. **sRGB 到线性空间**：
   $$C_{lin} = \begin{cases} \frac{C}{12.92} & C \le 0.04045 \\ \left(\frac{C + 0.055}{1.055}\right)^{2.4} & C > 0.04045 \end{cases} \quad (\text{其中 } C = c / 255)$$
2. **相对亮度 $L$**：
   $$L = 0.2126 \times R_{lin} + 0.7152 \times G_{lin} + 0.0722 \times B_{lin}$$
3. **对比度 $CR$**：
   $$CR = \frac{\max(L_1, L_2) + 0.05}{\min(L_1, L_2) + 0.05}$$

### 3.2 按钮前景与悬停色派生
- **按钮前景 `deriveButtonForeground(rawRgb)`**：
  - 分别计算 raw 颜色对纯黑（`#000000`, $L=0$）和纯白（`#ffffff`, $L=1$）的对比度。
  - 选择对比度较大的一方；平局时偏向纯黑。
  - *实测验证*：纯红 `#ff0000` 亮度为 0.2126，对黑对比度 5.25，对白对比度 4.00，因此选用黑色前景；纯蓝 `#0000ff` 选用白色前景；纯绿 `#00ff00` 选用黑色前景。
- **悬停背景 `deriveButtonHover(rawRgb, fgHex)`**：
  - 优先向所选前景色方向线性混合 12%：$H_1 = \text{round}(raw \times 0.88 + fg \times 0.12)$。
  - 检查 $H_1$ 与前景色对比度是否 $\ge 4.5$。若满足，则采纳 $H_1$。
  - 若不满足（例如纯红向黑混合 12% 导致对比度降至 4.12 < 4.5），则自动向反向终点混合 12%：$H_2 = \text{round}(raw \times 0.88 + opp \times 0.12)$，确保悬停态文字始终满足 $\ge 4.5$ 对比度（纯红的悬停结果为 `#ff1f1f`，对比度 5.47）。

### 3.3 界面文字/链接 Ink 派生（`deriveInkColor`）
为防止浅色或深色强调色在不同背景上无法看清，算法使用主题关联的 6 个参考表面：
- **Mist 参考表面**：base `[239, 247, 254]`, l1 `[255, 255, 255]`, l2 `[230, 242, 251]`, l3 `[252, 254, 255]`, sidebar `[228, 240, 249]`, deep sidebar `[207, 229, 246]`。
- **Abyss 参考表面**（根据当前 palette）：
  - Ocean: base `[8, 11, 20]`, l1 `[15, 23, 38]`, l2 `[23, 34, 54]`, l3 `[28, 40, 62]`, sidebar `[15, 23, 38]`, sidebarDeep `[10, 16, 28]`。
  - Graphite / Violet / Jade：使用各 palette 定义的表面基准。
- **派生逻辑**：
  - 若 raw 色值在所有 6 个参考面上均满足 $CR \ge 4.5$，直接保留 raw。
  - 若不满足，在 Mist 下向纯黑插值，在 Abyss 下向纯白插值，逐级步进（factor = $k / 255$）找到首个使得所有参考面 $CR \ge 4.5$ 的颜色。

---

## 4. CSS 令牌白名单、消费者与层叠特异性

### 4.1 实际覆盖的 17 项令牌与对应消费者
在 `accentMode === "custom"` 且当前激活 Whale 主题时，通过私有 CSS 变量 `--wm-custom-*` 覆盖以下白名单令牌：

| CSS 令牌 | 映射值 | 消费者 |
| --- | --- | --- |
| `--dsw-alias-button-primary-fill` | `var(--wm-custom-raw)` | 主按钮正常填充、设置页预览主按钮 |
| `--dsw-alias-button-primary-hover` | `var(--wm-custom-btn-hover)` | 主按钮悬停填充 |
| `--dsw-alias-label-primary-foreground` | `var(--wm-custom-btn-fg)` | 主按钮内部文字及图标前景（黑/白） |
| `--dsw-alias-brand-primary` | `var(--wm-custom-ink)` | 品牌主色、活动滑块 track、设置单选边框 |
| `--dsw-alias-brand-primary-new-colorprimary-new-color` | `var(--wm-custom-ink)` | 官方次级品牌主色兼容别名 |
| `--dsw-alias-link` | `var(--wm-custom-ink)` | 普通 Markdown 超链接 |
| `--dsw-alias-markdown-citation` | `var(--wm-custom-ink)` | Markdown 引用来源标签 |
| `--dsw-alias-state-business-primary` | `var(--wm-custom-ink)` | 业务高亮、状态主色 |
| `--dsw-alias-state-business-tertiary` | `rgba(raw, 0.20)` | 业务高亮浅底色 |
| `--dsw-alias-button-info-fill` | `rgba(raw, 0.18)` | 信息类轻按钮底色 |
| `--dsw-alias-button-info-hover` | `rgba(raw, 0.26)` | 信息类轻按钮悬停底色 |
| `--dsw-alias-button-ghost-active-fill` | `rgba(raw, 0.20)` | 幽灵按钮激活底色 |
| `--dsw-alias-interactive-bg-primary` | `rgba(raw, 0.16)` | 交互主背景（如选中高亮） |
| `--dsw-alias-interactive-bg-hover` | `rgba(raw, 0.12)` | 交互悬停背景 |
| `--dsw-alias-interactive-bg-active` | `rgba(raw, 0.20)` | 交互按下背景 |
| `--dsw-specific-sidebar-nav-item-active` | `rgba(raw, 0.16)` | 侧边栏活动导航项底色 |
| `--dsw-specific-sidebar-nav-item-active-accent` | `var(--wm-custom-ink)` | 侧边栏活动导航项左侧/强调标记 |
| `--dsw-focus-ring-color` | `var(--wm-custom-ink)` | 官方焦点环变量 |

### 4.2 插件既有焦点与状态规则接入
- **焦点环（`:focus-visible`）**：
  ```css
  body:is(.dsh-whale-mist-active, .dsh-whale-abyss-active)[data-wm-accent-mode="custom"] :focus-visible {
    outline: 2px solid var(--wm-custom-ink) !important;
    outline-offset: 2px !important;
  }
  ```
- **会话状态标志（`.wm-status-mark`）**：
  - 普通运行态与品牌标记接管为 `background: var(--wm-custom-raw)` 与 `color: var(--wm-custom-btn-fg)`。
  - `.wm-session-status-running .wm-status-mark::after` 呼吸边框接管为 `border-color: var(--wm-custom-interactive-primary)`。
  - **语义状态保护**：通过 `:not(.wm-session-status-waiting):not(.wm-session-status-complete)` 严格排除 waiting（警告黄）与 complete（成功绿），保留其原有语义底色和图标。

### 4.3 CSS 特异性与层叠胜出证据
原样式由 `css + paletteCss + backdropCss` 拼接，其中 palette 包含 `body[data-wm-palette][data-wm-sidebar]`。
本轮自定义规则位于 `backdropCss` 顶端，并采用多层复合选择器：
```css
body:is(.dsh-whale-mist-active, .dsh-whale-abyss-active)[data-wm-accent-mode="custom"],
body:is(.dsh-whale-mist-active, .dsh-whale-abyss-active)[data-wm-palette][data-wm-accent-mode="custom"],
body:is(.dsh-whale-mist-active, .dsh-whale-abyss-active)[data-wm-palette][data-wm-sidebar][data-wm-accent-mode="custom"] {
  --dsw-alias-button-primary-fill: var(--wm-custom-raw) !important;
  ...
}
```
其选择器特异性达到 `(0, 4, 1)` 且带 `!important`，并在样式表物理顺序上位于 `paletteCss` 之后。经测试在 Mist、Abyss 4 款调色板以及 deep sidebar 状态下均 100% 胜出。

### 4.4 未改色与隔离范围
- **严格未变**：
  - 普通正文、二级文字、弱化文字（`--dsw-alias-label-primary`, `--dsw-alias-label-secondary`, `--dsw-alias-label-tertiary`）不被染色；
  - 成功色（`--dsw-alias-state-success-*`）、警告色（`--dsw-alias-state-warn-*`）、错误色（`--dsw-alias-state-error-*`）保持语义；
  - 文件类型图标（PNG/PDF/DOC 等）、diff 增删色、ToolRow 展开箭头（DisclosureRow 使用 label-secondary/tertiary）保持原状；
  - 壁纸预设（`presets.v1`）无任何强调色字段。

---

## 5. 设置界面与双语言支持

在 `WhaleAppearanceSettings` 的调色板（Abyss）/ 主题提示（Mist）下方新增“强调色”（Accent color）配置区：
- **分段选择器**：跟随主题（Follow theme） / 自定义（Custom）。
- **自定义色选择器与只读 Hex 显示**：当且仅当切换至自定义时渲染原生 `input[type="color"]` 及 6 位 hex 文本。
- **实时预览胶囊（Preview Badges）**：
  - `data-wm-preview="button"`：采用 `--dsw-alias-button-primary-fill` 与 `--dsw-alias-label-primary-foreground` 的静态主按钮预览；
  - `data-wm-preview="link"`：采用 `--dsw-alias-link` 的静态超链接预览。
- **完整双语言文案**：
  - `zh-CN`: 强调色、跟随主题、自定义、说明“按钮使用所选颜色；链接、高亮和焦点会随主题调整深浅以便识别。跟随主题恢复原配色”、自定义颜色、说明“仅使用 6 位十六进制色值；自动调整文字与焦点对比度”、主按钮、链接。更新鲸渊提示为“鲸渊的主题底色；跟随主题时同时决定强调色”。
  - `en-US`: Accent color, Follow theme, Custom, "Buttons use the selected color; links, highlights, and focus rings adapt to maintain readability across themes. Follow theme restores default colors.", Custom color, "6-digit hex color only; text and focus contrast adjust automatically", Primary button, Link. 更新 paletteHint 为 "Base color for Whale Abyss; also decides accent color when following theme".

---

## 6. 自动化回归与验证结果

执行了全套隔离行为测试，在独立的无头 Chromium/Edge 浏览器环境中运行：

### 6.1 测试命令与执行输出
1. **语法与模板检查**：
   ```powershell
   npm run check
   ```
   *输出*：
   ```
   > dsh-whale-mist@0.6.0-rc.30 check
   > node --check src/index.js && node --check src/client.js && node --check src/wallpaper/session.js && node --check src/wallpaper/scenes.js && node --check src/wallpaper/catalog.js && node --check src/wallpaper/library.js && node qa/css-template-guard.mjs

   css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
   ```
   *退出码*：`0`。

2. **完整外观回归测试（包含强调色全套套件）**：
   ```powershell
   npm run test:appearance
   ```
   *输出*：
   ```
   {
     "passed": 458,
     "isolatedProfile": "C:\\Users\\HP\\AppData\\Local\\Temp\\whale-appearance-qa-..."
   }
   ```
   *退出码*：`0`。通过断言数：**458 项**（上一轮 298 项，净增 160 项强调色测试）。

3. **英文语言与隔离套件**：
   ```powershell
   node qa/appearance-regression.mjs --english-suite
   ```
   *输出*：
   ```
   {
     "language": "en-US",
     "passed": 454,
     "isolatedProfile": "C:\\Users\\HP\\AppData\\Local\\Temp\\whale-appearance-qa-..."
   }
   ```
   *退出码*：`0`。通过断言数：**454 项**（较默认套件少 4 项 runner 尾部非语言媒体检查，完全符合预期）。

4. **场景选择受限守卫**：
   ```powershell
   node qa/appearance-regression.mjs --scene-selection-only
   ```
   *输出*：
   ```
   {
     "sceneSelection": [
       { "changed": false, "starts": 1, "bodies": [{ "scene": "lucy", "mode": "daily" }] },
       { "changed": true, "starts": 0, "bodies": [] }
     ],
     "isolatedProfile": "C:\\Users\\HP\\AppData\\Local\\Temp\\whale-appearance-qa-..."
   }
   ```
   *退出码*：`0`。

5. **时钟校准与临时配置文件边界守卫**：
   ```powershell
   npm run test:check-pairing
   npm run test:temp-profile-boundaries
   ```
   *输出*：`pairing checks: 8/8 passed`，`boundary regression: 11/11 passed`。全部退出码 `0`。

---

## 7. 交付边界与后续计划

1. **未修改事项**：
   - 未改动版本号（`0.6.0-rc.30`）或 manifest。
   - 未打出新 release 包，不覆盖任何历史 tgz 归档。
   - 未修改 `app.asar` 或启动官方 DSH。
   - 未向其他会话或外部发消息。
2. **待 Codex 复核与后续任务**：
   - 本交付报告提供完整的断言计数、颜色数学证据与 CSS 特异性验证。
   - 强调色字段未进入壁纸预设，此边界与需求完全吻合。
   - 下一步等待用户与 Codex 审阅结果，视需要决定是否集成进后续整体功能候选包。
