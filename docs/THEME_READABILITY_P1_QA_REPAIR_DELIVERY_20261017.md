# 主题可读性P1 QA1最小补修交付报告

- **交付日期**：2026-10-17
- **交付方**：小G（已完成 QA1 测试修正与双语言全量回归，交 Codex 复核）
- **依据复审**：[`docs/THEME_READABILITY_P1_REVIEW_20261017.md`](THEME_READABILITY_P1_REVIEW_20261017.md)
- **前序交付**：[`docs/THEME_READABILITY_P1_DELIVERY_20261017.md`](THEME_READABILITY_P1_DELIVERY_20261017.md)

---

## 1. 补修背景与问题定位

Codex 在复审中确认主题可读性 P1 的生产实现、数据迁移、样式计算与预设隔离完全通过，并在额外 45 项隔离断言中全部绿灯。
唯一发现的缺陷为 **QA1（测试预期不一致）**：
- 在 `dsh-whale-mist/qa/appearance-harness.js` 中，原英文测试预期写入了过时短语（`Increases distinction...` 与 `Preserves the theme...`），且按该模糊片段查找节点；
- 生产代码（`src/client.js:2448–2449`）实际文案为：
  - `textContrastStandardHint`: `"Preserves original theme text and follows system high contrast"`
  - `textContrastEnhancedHint`: `"Increases separation between body text, secondary notes, and normal tool rows without altering semantic states"`
- 导致在独立英文环境（`navigator.language = 'en-US'`）执行 `fixture.run()` 时出现断言失败；而实际英文界面渲染正常。

---

## 2. 最小补修实施内容

遵循复审意见，**生产代码（`src/client.js`）零改动**，仅修复 QA 查找与双语言覆盖：

### 2.1 结构化定位替代脆弱的文本模糊查找
在 [`dsh-whale-mist/qa/appearance-harness.js`](../dsh-whale-mist/qa/appearance-harness.js) 中：
- 定位特定设置行：`controls.find(n => (n.props && n.props.key === 'textContrast') || n.key === 'textContrast')`；
- 从行内的 `wm-settings-copy` 下精确获取 `wm-settings-label` 与 `wm-settings-hint` 文本节点；
- 彻底摆脱对过时文本子串模糊匹配与固定槽位的依赖。

### 2.2 显式双语言（zh-CN / en-US）全量控件与动态文案校验
在同一隔离页面中遍历 `['zh-CN', 'en-US']`：
1. **受控语言桩**：使用 `Object.defineProperty(navigator, 'language', { configurable: true, get: () => item.lang })` 切换语言环境，并在 `finally` 块中严格恢复原始 `navigator.language`，避免污染后续媒体与生命周期测试。
2. **完整双语断言**：
   - 行标签：中文 `"文字可读性"`、英文 `"Text readability"`；
   - 分段按钮文本：中文 `["标准", "增强"]`、英文 `["Standard", "Enhanced"]`；
   - 点击 `Enhanced`：控制器切换为 `enhanced`、按钮获得 `.is-selected` 与 `aria-pressed="true"`、提示动态刷新为真实增强文案；
   - 点击 `Standard`：控制器切回 `standard`、按钮获得选中状态、提示动态刷新为真实标准文案。

### 2.3 增加 `--english-suite` 回归开关
在 [`dsh-whale-mist/qa/appearance-regression.mjs`](../dsh-whale-mist/qa/appearance-regression.mjs) 中补充 `--english-suite` 支持，直接支持通过 CLI 执行全量英文无头回归。

---

## 3. 验证结果与证据

### 命令 1：语法与模板守卫
```powershell
npm run check
```
- **输出**：`css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes`
- **状态**：通过，退出码 0。

### 命令 2：默认环境（zh-CN）外观与隔离回归
```powershell
npm run test:appearance
```
- **输出**：`"passed": 294`
- **状态**：通过，全部 294 项断言绿灯。

### 命令 3：英文环境（en-US）外观与隔离回归
```powershell
node qa/appearance-regression.mjs --english-suite
```
- **输出**：
  ```json
  {
    "language": "en-US",
    "passed": 294,
    "isolatedProfile": "C:\\Users\\HP\\AppData\\Local\\Temp\\whale-appearance-qa-iutOQ7"
  }
  ```
- **状态**：通过，退出码 0，英文分支真实跑通并记录证据。

### 命令 4：受控场景选择检查
```powershell
node qa/appearance-regression.mjs --scene-selection-only
```
- **输出**：
  ```json
  {
    "sceneSelection": [
      { "changed": false, "starts": 1, "bodies": [{ "scene": "lucy", "mode": "daily" }] },
      { "changed": true, "starts": 0, "bodies": [] }
    ]
  }
  ```
- **状态**：通过，正反两例均符合预期。

---

## 4. 断言数量口径明确说明

依据复审要求，对断言数量统计口径作清晰区分与修正：
- **前序预设 P1 最终复审基线**：`160` 项 passed。
- **本轮实际 passed 最终计数**：**`294`** 项。
- **净增断言执行数**：`294 - 160 = 134` 项（其中双语言控件循环 13×2=26 项，Abyss 4 配色循环 6×4=24 项，其余为单项契约验证）。
- **静态代码中的 `assert(...)` 语句数**：共计 `250` 处。与 294 的差值源于循环展开执行的实际测试项。此前报告“140+141”为估算口径误差，现按实际基线 160 统一修正。

---

## 5. 现场边界与状态保持

1. **零生产变更**：`src/client.js` 与所有生产资产未作任何增删，已审功能与样式保持不变。
2. **约束严格遵守**：
   - 保持工作区 manifest/assets 为 `rc.30`，日常安装为 `rc.31`。
   - 未打包、未安装、未修改版本号、未执行 Git commit/push、未向真实 DSH/WE 端点发送命令。
   - 旧复审、原交付文档及证据目录完整保留。

---
请 Codex 进行最终确认与归档。
