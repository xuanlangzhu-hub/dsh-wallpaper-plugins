# 独立强调色 P1 第二轮补修交付：A1 跟色保留，A2 选中标签普通 Primary 文字与合成参考面对比闭合

2026-10-17，小G。根据 [A2 补修复审要求](THEME_ACCENT_P1_SECOND_REVIEW_20261017.md)，完成了选中设置按钮标签对比度的最小局部修复与全面 QA 覆盖。**A1 跟色特性完整保留，A2 叠色文字对比度问题彻底闭合。**

---

## 1. 契约修正与生产代码局部 Diff

按 Codex 修正后的最小契约：
- 选中设置控件的标签改用普通主文本色 `var(--dsw-alias-label-primary) !important`，不再强求呈现彩色 ink。
- 保留已跟色的 raw-alpha（20% alpha）轻量背景 `var(--wm-custom-interactive-active) !important`。
- 焦点状态和非文字标记仍使用 ink。
- 不修改链接 ink 派生算法、主按钮前景/hover 算法、全局状态色或主题底色。

### `dsh-whale-mist/src/client.js` 局部变更（约 4069–4074 行）：

```diff
       ${accentSelector} .wm-settings-option.is-selected,
       ${accentPaletteSelector} .wm-settings-option.is-selected,
       ${accentDeepSidebarSelector} .wm-settings-option.is-selected {
-        color: var(--wm-custom-ink) !important;
+        color: var(--dsw-alias-label-primary) !important;
         background: var(--wm-custom-interactive-active) !important;
       }
```

- 仅一行 CSS 属性调整。保留了选择器的高优先级与 custom 作用域限制。
- 未改动 border（保持 0px）、padding（保持 4px 10px）、圆角与布局尺寸，无任何布局抖动。
- 切换至跟随主题（`theme`）或卸载插件时，该规则自然失效，无任何残留。

---

## 2. A1 选中态跟色保留证明

1. **红绿选中底色依然跟色且互不相同**：
   - Mist 纯红 `#ff0000`：选中背景为 `rgba(255, 0, 0, 0.2)`。
   - Mist 纯绿 `#00ff00`：选中背景为 `rgba(0, 255, 0, 0.2)`。
   - 两者背景色完全不同，且与普通主题底色不同。
2. **未选中项保持透明**：
   - 背景为 `rgba(0, 0, 0, 0)`。
3. **焦点环表现强调色**：
   - 聚焦于选中按钮时，`outlineColor` 保持与各自主题派生的 ink 一致（例如 Mist 绿色为 `rgb(0, 118, 0)`，Abyss 为 `rgb(0, 255, 0)`）。
4. **Codex A1 历史探针复跑**：
   - 执行 `node .tmp/theme-accent-p1-final-review-20261017-9439d1c8/probe/appearance-regression.mjs --accent-review`：
   - **41 项强断言全部通过**，`actual-settings-selected-accent.regressionObserved: false`。

---

## 3. A2 合成背景对比度验证

### 3.1 Codex 独立探针复跑结果

执行 `node .tmp/theme-accent-p1-final-review-20261017-9439d1c8/probe/appearance-regression.mjs --selected-contrast-review`：

| 主题 / 配色 | 选中文字 (Primary) | 未着色 Layer 2 参考底 | 20% 纯红叠色合成底 | 对叠色合成底对比度 | 门槛 $\ge 4.5$ 判定 |
| --- | --- | --- | --- | --- | --- |
| **Mist** | `rgb(21, 48, 71)` | `rgb(230, 242, 251)` | `rgb(235, 193.6, 200.8)` | **8.4463** | 通过（无回归） |
| **Abyss Ocean** | `rgb(231, 236, 245)` | `rgb(23, 34, 54)` | `rgb(69.4, 27.2, 43.2)` | **12.2188** | 通过（无回归） |
| **Abyss Graphite** | `rgb(231, 236, 245)` | `rgb(31, 31, 36)` | `rgb(75.8, 24.8, 28.8)` | **12.1286** | 通过（无回归） |
| **Abyss Violet** | `rgb(231, 236, 245)` | `rgb(35, 25, 50)` | `rgb(79, 20, 40)` | **12.1070** | 通过（无回归） |
| **Abyss Jade** | `rgb(231, 236, 245)` | `rgb(20, 39, 33)` | `rgb(67, 31.2, 26.4)` | **12.1998** | 通过（无回归） |

5 个主题在纯红最严苛条件下的叠色对比度均在 8.44–12.22 之间，全部远高于 4.5，探针返回 `regressionObserved: false`。

### 3.2 正式 QA 全矩阵验证（5 主题 $\times$ 7 代表色）

在 `dsh-whale-mist/qa/appearance-harness.js`（Section 3d）中建立了严密的合成底面对比度回归套件：
- 合成公式：`composite[i] = bg[i] * alpha + surface[i] * (1 - alpha)`，其中 `alpha = 0.2`，`surface` 取已知不透明 Layer 2 参考面。
- 7 种代表色：纯黑 `#000000`、纯白 `#ffffff`、中灰 `#808080`、默认紫 `#8c72f2`、纯红 `#ff0000`、纯绿 `#00ff00`、纯蓝 `#0000ff`。
- 5 种主题环境：Mist、Abyss Ocean、Abyss Graphite、Abyss Violet、Abyss Jade。

**测试核算数据汇总**：
- Mist（前景 `rgb(21, 48, 71)`）：
  - `#000000`: 12.43
  - `#ffffff`: 12.01
  - `#808080`: 10.37
  - `#8c72f2`: 10.15
  - `#ff0000`: 8.45
  - `#00ff00`: 11.23
  - `#0000ff`: 8.87
- Abyss 4 Palettes（前景 `rgb(231, 236, 245)`）：
  - 纯黑至纯蓝在 4 个深色主题上的合成对比度区间为 **6.92 至 14.34**（最低点为 Jade + 纯白底色，对比度 6.92，远超 4.5）。
- **文字增强模式（textContrast: enhanced）**：
  - Mist（前景增强为 `#0c263b`）：在纯红合成底面上对比度保持 $\ge 4.5$。
  - Abyss（前景增强为 `#f2f5fc`）：在纯红合成底面上对比度保持 $\ge 4.5$。
- **深色侧栏（deep sidebar）在 Graphite 下**：
  - 纯红选中底保持 20% alpha，文字为主文本色，对比度保持 $\ge 4.5$。
- **跟随主题（theme）恢复**：
  - 背景恢复为中性 Layer 1 色，文字恢复为中性主文本色。

---

## 4. 完整测试执行记录

所有测试在干净、隔离的环境下执行，结果如下：

| 测试命令 | 预期 / 涵盖内容 | 实际结果 |
| --- | --- | --- |
| `npm run check` | 语法检查、模板字符串反引号与转义安全检查 | **通过** (0 退出码) |
| `npm run test:appearance` | 默认外观全量套件（包含预设、可读性、强调色及 35 组叠色对比断言） | **通过 (570 项通过)** |
| `node qa/appearance-regression.mjs --english-suite` | 英文环境界面与全量套件 | **通过 (566 项通过)** |
| `node qa/appearance-regression.mjs --scene-selection-only` | 场景切换取消延迟自启与正向控制 | **通过** (0 退出码) |
| `node .tmp/.../probe/appearance-regression.mjs --selected-contrast-review` | Codex A2 稳定终态选中态叠色对比度独立探针 | **通过 (5 主题全部 regressionObserved: false)** |
| `node .tmp/.../probe/appearance-regression.mjs --accent-review` | Codex 41 项消费端强调色强断言探针 | **通过 (41/41 通过, regressionObserved: false)** |
| `npm run test:check-pairing` | 时钟配对算法回归 | **通过 (8/8 通过)** |
| `npm run test:temp-profile-boundaries` | 临时 Profile 隔离边界回归 | **通过 (11/11 通过)** |

---

## 5. 边界承诺与现场保护

1. **最小修改原则**：仅修改了 `.wm-settings-option.is-selected` 的文字颜色为 `var(--dsw-alias-label-primary)`，以及 QA 检验逻辑。未修改任何其他按钮、链接、状态色或派生算法。
2. **冻结约束保持**：
   - 生产 manifest 和 assets 保持在 `0.6.0-rc.30`。
   - 未打包、未安装、未操作真实 DSH/WE 实例。
   - 用户的日常运行基线保持在 `rc.31`。
   - 历史归档、测试证据和临时文件完好保留。
