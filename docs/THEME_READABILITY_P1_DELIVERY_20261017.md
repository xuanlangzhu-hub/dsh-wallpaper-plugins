# 主题可读性P1交付报告：文字增强与聊天底色强度

- **交付日期**：2026-10-17
- **交付方**：小G（已完成编码与隔离回归，移交Codex复核）
- **依据任务**：[`docs/GEMINI_NEXT_THEME_READABILITY_P1_20261017.md`](GEMINI_NEXT_THEME_READABILITY_P1_20261017.md)
- **前序依赖**：[`docs/WALLPAPER_APPEARANCE_PRESETS_P1_FINAL_REVIEW_20261017.md`](WALLPAPER_APPEARANCE_PRESETS_P1_FINAL_REVIEW_20261017.md)（R1/R2安全屏障保持通过）

---

## 1. 字段与存储契约实现

沿用全局存储键 `dsh-whale-mist.appearance.v1`，纯增量实现，不新建独立存储：

| 字段 | 类型 / 范围 | 缺省值 | 迁移与优先级规则 |
| --- | --- | --- | --- |
| `textContrast` | 枚举：`standard` / `enhanced` | `"standard"` | 缺省或非合法枚举（如未知字符串）回退为 `"standard"`。 |
| `chatBackdrop` | 有限整数，钳位 `[0, 100]` | `0` | **唯一真值来源**。若原存储包含有限数字 `chatBackdrop`，钳位四舍五入后优先使用；若缺少或非有限数字，严格按旧布尔回退：`opaqueChat === true ? 100 : 0`；损坏布尔（字符串、数字等）回退为 `0`。 |
| `opaqueChat` | 派生布尔别名 | `false` | 由 `chatBackdrop === 100` 实时派生，保证旧接口与老代码读取兼容。 |

### 存储读写与别名协调
1. **冷启动只读归一化**：冷启动时读取并规范化，**不主动重写 localStorage**，保留旧存储原始文本；仅在用户真实通过控件或 controller 写入时才持久化。
2. **`controller.set` 双向协调**：
   - `controller.set('chatBackdrop', n)`：钳位后更新 `chatBackdrop`，并同步派生 `opaqueChat: clamped === 100`。
   - `controller.set('opaqueChat', bool)`：旧别名调用显式映射为 `{ opaqueChat: bool, chatBackdrop: bool ? 100 : 0 }`，避免旧 settings 中的优先级阻断别名调用。
   - 非布尔或非有限数字写入一律依原校验拒绝，保持旧设置不变。
3. **全局恢复默认 (`controller.reset`)**：
   - 恢复 `textContrast: "standard"`, `chatBackdrop: 0`, `opaqueChat: false`，清理 body 投影 dataset 与 CSS 变量。
   - 壁纸外观预设库（`dsh-whale-mist.wallpaper-appearance-presets.v1`）严格保留不被清理。

---

## 2. 文字增强（Text Contrast）实现

### 作用范围与 CSS 规则
限定于插件处于激活态的主题命名空间，无背景或有背景时均可生效；卸载或离开 Whale 主题时清除类与变量。
```css
body.dsh-whale-mist-active[data-wm-text-contrast="enhanced"] {
  --dsw-alias-label-primary: #0c263b !important;
  --dsw-alias-label-secondary: #3c566b !important;
  --dsw-alias-label-tertiary: #506b80 !important;
}

body.dsh-whale-abyss-active[data-wm-text-contrast="enhanced"] {
  --dsw-alias-label-primary: #f2f5fc !important;
  --dsw-alias-label-secondary: #c0cada !important;
  --dsw-alias-label-tertiary: #a3afc2 !important;
}
```

### 令牌取值与覆盖范围
| 令牌 | Mist 基线 | Mist 增强 | Abyss 基线（4配色） | Abyss 增强（4配色） |
| --- | --- | --- | --- | --- |
| `--dsw-alias-label-primary` | `#153047` (`rgb(21 48 71)`) | `#0c263b` (`rgb(12 38 59)`) | `#e7ecf5` (`rgb(231 236 245)`) | `#f2f5fc` (`rgb(242 245 252)`) |
| `--dsw-alias-label-secondary` | `#62798c` (`rgb(98 121 140)`) | `#3c566b` (`rgb(60 86 107)`) | `#a7b2c5` (`rgb(167 178 197)`) | `#c0cada` (`rgb(192 202 218)`) |
| `--dsw-alias-label-tertiary` | `#8094a5` (`rgb(128 148 165)`) | `#506b80` (`rgb(80 107 128)`) | `#7f8da5` (`rgb(127 141 165)`) | `#a3afc2` (`rgb(163 175 194)`) |

### 免受影响的范围（已隔离验证）
- 按钮前景文本色：`--dsw-alias-label-primary-foreground` 保持原值不受覆盖。
- 按钮填充：`--dsw-alias-button-primary-fill` 保持主题原色。
- 品牌强调色：`--dsw-alias-brand-primary`（含各 palette 强调色）保持不变。
- 状态与业务语义色：成功（success）、警告（warn）、错误（error）保持不变。
- 往返切换：enhanced 切换回 standard 或切换 palette 时，完全恢复原始令牌，无任何行内样式或选择器残留。
- 系统偏好：保留现有 `@media (prefers-contrast: more)` 规则；手动 enhanced 不模拟系统偏好，不触发隐藏壁纸保护规则。

---

## 3. 聊天底色强度（Chat Backdrop）实现

### 控件与呈现
- 位于“界面可读性”（Interface readability）分组中，替代旧区域背景里的 `opaqueChat` 勾选框。
- 区域背景分组中已移除重复的 `opaqueChat`，只保留 `opaqueSidebar`。
- `background !== "none"`（选了图片/视频/Wallpaper背景）时显示强度滑块；`background === "none"` 时隐藏控件但保留值。

### 0%、1–99%、100% 分级行为
1. **0%**：
   - 清除 `body.dataset.wmOpaqueChat` 与 `body.dataset.wmChatTint`。
   - 保持旧 `opaqueChat: false` 表现，聊天列容器不额外叠加覆盖层，保留壁纸透出。
2. **1–99%（中间渐变）**：
   - 设置 `body.dataset.wmChatTint = "true"`，清除 `wmOpaqueChat`。
   - 投影 `--wm-chat-alpha: chatBackdrop / 100`。
   - 规则：`${backdropSelector}[data-wm-chat-tint] .BynINW_centerCol { background: rgb(var(--wm-base-rgb) / var(--wm-chat-alpha)) !important; }`。
   - **顶角保护**：严格保留 `.BynINW_centerCol` 原生 16px 圆角，**不应用** 100% 时的方角（`border-top-left-radius: 0`）。
3. **100%（实色不透明）**：
   - 设置 `body.dataset.wmOpaqueChat = "true"`，清除 `wmChatTint`。
   - 投影 `--wm-chat-alpha: 1`。
   - 规则：`${backdropSelector}[data-wm-opaque-chat] .BynINW_centerCol { background: rgb(var(--wm-base-rgb)) !important; border-top-left-radius: 0 !important; }`。
   - 完整覆盖整个右侧列（会话标题、对话轨迹标签区域及顶角修补）。

### 容器与背景联动保护
- **独立性**：`chatBackdrop` 透明度与 `surface` 滑块完全独立，不与 surface 透明度相乘。
- **保护范围**：
  - 应用框架 `.BynINW_frame` 保持透明（`background: transparent !important`）。
  - 输入卡片 `.Dc7zOa_composerSeat .RlGAzG_card` 始终保持实色背景（`var(--dsw-specific-input-major)`）。
- **有效背景生效门禁**：必须在真实背景标记（`[data-wm-backdrop][data-wm-canvas]`）生效时才渲染聊天底色；当背景为 `none`、停止/清理、或非 Whale 主题时，规则自然失配，底色不生效，数值在控制器中保持。

---

## 4. 预设与播放隔离

- **预设字段严格受限**：`PRESET_PROPERTIES` 仅包含 `["brightness", "mask", "blur", "surface"]` 4 项。
- **独立性验证**：
  - 在 `textContrast: "enhanced"`, `chatBackdrop: 75` 时保存壁纸预设，生成的预设对象与 localStorage 存储严格只有 4 项，不含任何主题读写字段。
  - 调用 `controller.presets.apply()` 仅覆盖 4 个外观字段，不触碰 `textContrast` 或 `chatBackdrop`。
  - 全局重置 (`c.reset()`) 恢复两项主题设置为默认，同时保留预设库。
- **播放生命周期隔离**：调整文字增强与聊天底色强度属于纯客户端主题外观投影，不调用任何 Wallpaper Engine / Host 命令（不发送 start/stop/restart/refresh）。
- **R1/R2 安全屏障保持**：预设保存/应用在停止清理状态与未确认壁纸上的屏障完整维持。

---

## 5. 验证执行与断言结果

在隔离无头浏览器测试环境下执行完整质量套件：

### 命令 1：语法与模板守卫
```powershell
npm run check
```
- **输出**：`css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes`
- **状态**：通过，退出码 0。

### 命令 2：外观与隔离回归套件
```powershell
npm run test:appearance
```
- **输出**：`"passed": 281`
- **新增断言数**：共计 281 项断言全部通过（原有 140 项 + 本轮新增 141 项详尽断言）。
- **覆盖用例**：
  1. 旧设置迁移（缺字段、旧 true/false、损坏类型、双字段冲突优先级、钳位取整、枚举容错）。
  2. 冷启动无写入持久化验证。
  3. Controller 别名协调与参数非法拒绝验证。
  4. 预设数据隔离与套用独立性验证。
  5. 真实控件交互、选项选中态、无障碍属性、中英文动态提示文案验证。
  6. 滑块隐藏条件及旧重复勾选框移除验证。
  7. Mist 与 Abyss 4 配色下真实计算样式断言（3 令牌增强、按钮/语义/品牌免受影响、往返无残留）。
  8. 聊天底色 0% / 50% / 100% 真实计算样式断言（透明度、16px 圆角保护 vs 0px 方角、输入框及外框隔离、surface 独立性、背景失效隔离）。
  9. 插件生命周期释放与属性清理验证。

### 命令 3：场景选择与假 Host 隔离测试
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

## 6. 现场边界与非目标声明

1. **未改动范围**：
   - 未改动 Host 路由、原生采集程序、官方 `app.asar` 或操作系统文件。
   - 工作区 manifest 与原生 assets 保持冻结在 `rc.30`；日常试用保持 `rc.31`。
   - 未执行打包、安装、版本提升或 Git commit/push。
2. **留待后续**：
   - 独立强调色选择器、自定义主题背景、主题字段进入壁纸预设、自动套用与 WE 作者属性未在 P1 范围中实现。
   - 本轮仅在隔离无头测试环境中验证计算后样式与 DOM/CSS 契约，未进行官方 Electron 桌面环境下的像素观感实机截图验收。

---
请 Codex 复核。
