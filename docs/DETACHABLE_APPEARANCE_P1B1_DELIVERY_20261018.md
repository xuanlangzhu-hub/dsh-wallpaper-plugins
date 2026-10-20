# 独立/吸附设置窗 P1B-1 交付报告：外观控件分组与响应式布局

2026-10-18，小 G 交付。依据 [GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B1_20261018.md](GEMINI_NEXT_DETACHABLE_APPEARANCE_P1B1_20261018.md) 与 [独立窗UI方向](DETACHABLE_APPEARANCE_UI_DIRECTION_20261017.md)。

---

## 1. 交付结论与排期收敛

- **排期与优先级调整**：遵从用户最新决策，滚动 A 调查降为低优先级，不再阻塞插件产品主线；A 调查产物已安全退出并保留在 `.tmp/scroll-a-third-repair-20261018/`。全面回到独立伴随窗/主端吸附窗产品主线推进 P1B-1。
- **P1A 架构保持**：P1A 十审（Host 路由、静态伴随页服务、窗口生命周期、唯一权威 controller、单调递增 revision 门禁、安全清理）已在源码离线范围通过，本轮不重做架构，严格复用既有契约。
- **P1B-1 交付范围**：
  1. 将独立伴随页（Edge App）与主端吸附视图由两滑块原型扩展为实际可用的完整控件分组：“画面调节 (Visual)”、“界面定制 (Interface)”、“壁纸预设 (Presets)”；
  2. 实现宽视口（双栏并排）与窄视口（单栏纵向卡片）自适应响应式布局；
  3. 四项画面参数（背景亮度、遮罩、模糊、界面不透明度）支持拖动中即时投影与双向同步，默认值 100% 由权威快照提供，彻底消除 HTML 内硬编码假默认值；文案严格修正为“背景亮度”，杜绝冒充全局界面明度；
  4. 界面定制接入主题、深色配色、文字可读性、聊天区底色与强调色模式/取色器；
  5. 四字段预设复用权威场景确认与动作门禁，仅保存四项画面参数，不自动套用、不保存界面颜色，在清理中/转场中/不匹配时严格遵守门禁禁止越权。
- **验证结论**：新建独立证据目录 [`.tmp/detachable-p1b1-20261018-7b9e1102`](../.tmp/detachable-p1b1-20261018-7b9e1102/)，10 项独立功能/边界探针全部通过（10/10）；`npm run check` 退出码 0，P0 专项（15/15）、P1A 专项（5/5）、无界面双 Tab E2E（11/11）全量回归通过。
- **环境安全**：未进行整体打包、未安装发布、未修改生产 manifest / assets 版本号；日常 DSH 0.2.1-rc.2 / 外观 rc.35 / Git Bash 0.1.1 纯净未碰；未操作 DSH/WE 进程，定时巡检任务 `g` 保持 `PAUSED`。

---

## 2. 结构草案与字段映射表

### 2.1 宽窄响应式布局结构草案

```
+---------------------------------------------------------------------------------+
|                                 Companion Header                                |
|  [Whale Badge] 独立外观设置                                [Status Pill: 已连接] |
+---------------------------------------------------------------------------------+
|                               [Error Banner (动态展示)]                          |
+---------------------------------------------------------------------------------+
|  Wide View (>= 580px 双栏并排)           |  Narrow View (< 580px 纵向卡片堆叠)   |
|  +-------------------+-------------------+  |  +---------------------------------+  |
|  |   画面调节 Card    |   界面定制 Card    |  |  |         画面调节 Card           |  |
|  | - 背景亮度 (滑块)  | - 主题 (分段选择)  |  |  +---------------------------------+  |
|  | - 遮罩 (滑块)      | - 深色配色 (色块)  |  |  |         界面定制 Card           |  |
|  | - 模糊 (滑块)      | - 文字可读性 (标准)|  |  +---------------------------------+  |
|  | - 界面透明度 (滑块)| - 聊天底色 (滑块)  |  |  |       壁纸外观预设 Card         |  |
|  |                   | - 强调色 (模式/色值)|  |  +---------------------------------+  |
|  +-------------------+-------------------+  |  |       Companion Footer          |  |
|  |            壁纸外观预设 Card (跨栏)     |  |  | [吸附回主窗口]    [关闭窗口]     |  |
|  |  目标信息: Lucy（已保存预设）           |  |  +---------------------------------+  |
|  |  [保存当前外观]  [应用已保存]  [删除]   |  |                                       |
|  +---------------------------------------+  |                                       |
+---------------------------------------------------------------------------------+
|                                 Companion Footer                                |
|                 [Button: 吸附回主窗口]         [Button: 关闭窗口]                |
+---------------------------------------------------------------------------------+
```

- **自适应断点**：采用 CSS Grid 与媒体查询 `@media (min-width: 580px)`：
  - 宽视口下画面区与界面区自动等宽左右并排，预设管理区在下方跨栏展开，空间利用充分；
  - 窄视口（如默认伴随窗 380px 或移动/吸附视口）自动回退为优雅的单列纵向流，内容容器支持平滑自定义细滚动条，保证在任何高度下底栏操作按钮绝对可达。
- **主端吸附面板 (`WhaleDockedAppearancePanel`)**：
  - 同样组织为清楚的“画面调节”、“界面定制”、“壁纸外观预设”三个清晰卡片组；
  - 面板最大宽度 `calc(100vw - 32px)`，内部提供 `overflow-y: auto` 纵向滚动容器，与独立伴随页共享同一快照和同一交互逻辑。

### 2.2 字段映射与边界规则表

| 分组 | 字段 Key | 控件形态 | 合法范围 / 枚举 | 权威快照默认值 | 标签与提示文案 | 校验与门禁依据 |
|---|---|---|---|---|---|---|
| **画面** | `brightness` | 滑块 + 数值框 | `20` ~ `120` (%) | `70` | **背景亮度**：100%保留原亮度，可继续提亮；最终效果还受遮罩和界面底色影响 | `RANGE_BOUNDS.brightness` |
| **画面** | `mask` | 滑块 + 数值框 | `0` ~ `90` (%) | `45` | **遮罩**：叠加主题底色；数值越大，主题底色覆盖越强，0%关闭遮罩 | `RANGE_BOUNDS.mask` |
| **画面** | `blur` | 滑块 + 数值框 | `0` ~ `24` (px) | `0` | **模糊**：柔化壁纸细节，视频较大时会增加显卡负担 | `RANGE_BOUNDS.blur` |
| **画面** | `surface` | 滑块 + 数值框 | `40` ~ `100` (%) | `82` | **界面不透明度**：侧栏与卡片；菜单和输入卡片保持不透明 | `RANGE_BOUNDS.surface` |
| **界面** | `theme` | 分段按钮 | `mist`, `abyss` | `abyss` | **主题**：在 Whale Mist 与 Whale Abyss 之间切换 | `ALLOWED_ENUMS.theme` |
| **界面** | `palette` | 色块分段单选 | `ocean`, `graphite`, `violet`, `jade` | `ocean` | **深色配色**：Whale Abyss 的底色；跟随主题时也决定强调色（标明仅深色有效） | `ALLOWED_ENUMS.palette` |
| **界面** | `textContrast` | 分段按钮 | `standard`, `enhanced` | `standard` | **文字可读性**：增强模式提高正文与辅助文本反差，保留高对比度语义 | `ALLOWED_ENUMS.textContrast` |
| **界面** | `chatBackdrop` | 滑块 + 数值框 | `0` ~ `100` (%) | `0` | **聊天区底色**：0%保留壁纸透光，100%完全不透明；调节整个聊天列底色 | `RANGE_BOUNDS.chatBackdrop` |
| **界面** | `accentMode` | 分段按钮 | `theme`, `custom` | `theme` | **强调色模式**：跟随主题或自定义强调色 | `ALLOWED_ENUMS.accentMode` |
| **界面** | `accentColor` | 取色器 + 16进制文本 | 正则 `^#[0-9a-fA-F]{6}$` | `#8c72f2` | **自定义色值**：仅在强调色为自定义时生效；按钮与高亮自适应可读性 | `HEX_COLOR_PATTERN` |
| **预设** | `SAVE_PRESET` | 动作按钮 | `sceneId` 合法场景 | -- | **保存当前外观**：仅保存上述 4 项画面参数；无合法场景/清理未确认/转场中禁用 | `controller.presets.save` |
| **预设** | `APPLY_PRESET` | 动作按钮 | `sceneId` 合法场景 | -- | **应用已保存外观**：手动应用 4 项画面参数，不自动套用、不修改界面色彩 | `controller.presets.apply` |
| **预设** | `REMOVE_PRESET` | 危险动作按钮 | `sceneId` 合法场景 | -- | **删除预设**：从本地存储移除目标壁纸预设条目，不重置当前画面值 | `controller.presets.remove` |

---

## 3. 实际修改明细

### 3.1 独立伴随页面与样式
1. [`dsh-whale-mist/src/companion/index.html`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/companion/index.html)：
   - 彻底清除旧 HTML 内 hardcoded 的 `value="70"`、`value="40"` 假默认值；
   - 扩展完整结构：`<main class="companion-content">` 内建立 `.companion-grid` 网格容器；
   - 包含画面调节卡片（4 滑块）、界面定制卡片（主题/配色/对比度/底色/强调色）、壁纸预设卡片（目标信息/状态角标/门禁提示/三动作按钮）；
   - 补充完整语义属性：`aria-labelledby`、`role="group"`、`aria-live="polite"`、`aria-label`。
2. [`dsh-whale-mist/src/companion/companion.css`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/companion/companion.css)：
   - 建立响应式网格布局：默认 1 列，`@media (min-width: 580px)` 自动切换为 2 列（预设卡片 `grid-column: 1 / -1` 跨栏展示）；
   - 内容区 `.companion-content` 采用 `overflow-y: auto` 配合细滑块样式，底部按钮条 `.companion-footer` `flex-shrink: 0` 保证固定可达；
   - 添加分段按钮 `.segment-group` / `.segment-btn`、四配色色块 Swatch（Ocean/Graphite/Violet/Jade 渐变）、取色器 `.color-picker` 及预设状态徽章样式；
   - 零 CDN、零外部 URL 依赖，完全契合 Whale Abyss / Mist 玻璃拟态设计规范。
3. [`dsh-whale-mist/src/companion/companion.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/companion/companion.js)：
   - `applySnapshot(snap)`：全量解析 4 画面字段、6 界面定制字段及预设快照，按权威值渲染 DOM；
   - 通用序列化即时更新 `applySettingSerialized(key, targetVal)`：对滑块（`input` 事件实时派发）、枚举按钮、色值等全量字段提供队列防抖与单调递增 revision 防冲突保护；
   - 接入四字段预设生命周期与权威门禁：实时解析活动场景目标（`snap.wallpaper.activeSceneId` 或 `snap.settings.weScene`），严格在 `cleanupPending`、`starting`、`connecting`、`waiting`、`cleanup-failed` 或场景不匹配时禁用预设按钮并展示明确原因，彻底杜绝按钮强行可点带来的非法越权；
   - 保持所有 P1A 十审函数签名及导出对象兼容性（`handleBrightnessChange`、`handleMaskChange`、`handleBlurChange`、`handleSurfaceChange` 等）。

### 3.2 主端吸附视图升级
1. [`dsh-whale-mist/src/client.js`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/src/client.js) (`WhaleDockedAppearancePanel`)：
   - 由原有 2 滑块扩展为与独立伴随页完全一致的三卡片结构（画面调节、界面定制、壁纸预设）；
   - 订阅 `controller.presets` 快照与 `controller.wallpaper` 状态，复用主端 `resolvePresetTarget()` 门禁；
   - 采用弹性最大高度 `maxHeight: 'calc(100vh - 80px)'` 与内部纵向滚动，在屏幕空间受限时整洁可达；
   - 在 `isDetached === true` 状态下，各控件自动施加 `opacity: 0.45` 与 `pointerEvents: 'none'`，并展示弹出引导条与“吸附回主界面”快捷动作。

---

## 4. 基底指纹与约束留存

### 4.1 关键文件哈希

| 文件路径 | SHA256 哈希 | Git Hash | 说明 |
|---|---|---|---|
| `dsh-whale-mist/src/companion/index.html` | `6437306924C2D8A430162594CF3994825BD36EE9C4E129D9D4E964E032280D3C` | `24531e51fbada17d791dd18f7d2ad6f985d0ef9e` | 扩展三卡片结构与自适应网格 |
| `dsh-whale-mist/src/companion/companion.css` | `164DF2656361AB54D3179743BFD0AD83FCAF1C1D34CDA0B6BB3CAC39B7F35D82` | `676cb6668e9d45a607e05d95b3769e368e72a660` | 响应式媒体查询与外观组件样式 |
| `dsh-whale-mist/src/companion/companion.js` | `AFB7C0279807EAF120ECAB9F71BA525AA93CF941EB90A7EF037A490645509D05` | `80f97da1bf174d5a7df02353055fb9e6165d0583` | 全字段双向同步、防抖与预设门禁 |
| `dsh-whale-mist/src/client.js` | `A21CDE78BC078987AB179162C7423457C349B36599939AF83857724F2DF9AF72` | `ec5ce0d355d4d259de456217706f4c7dce12ccdd` | 吸附面板三卡片与滚动升级 |
| `dsh-whale-mist/src/detachable-contract.js` | `76E89D5EF916798B82545CD422B3446D59A8B43FC86502D8B9C3388E91E2A147` | `1a2fc734179d7af381da016d7cb9213876fc9a67` | 保持不变（已具备全量字段契约） |

### 4.2 环境与安全红线核验

- **日常现场环境**：保持 DSH 0.2.1-rc.2 / 鲸系外观 0.6.0-rc.35 / Git Bash 0.1.1 纯净未碰；
- **工作区状态**：manifest 与生产 assets 维持 rc.30 冻结状态，禁止整体打包；
- **进程与服务**：未操作退出、重开、采样 DSH / WE，未发送 DSH 模型请求，未触碰原生采集程序；
- **通信与任务**：定时巡检任务 `g` 保持 `PAUSED`，未进行跨会话通信；
- **Git 状态**：工作区所有既有未暂存脏改动与历史文档/探针完全完好受保护，未执行任何未授权提交或清理。

---

## 5. 验证命令与独立证据

所有本轮验证证据均隔离保存在 [`.tmp/detachable-p1b1-20261018-7b9e1102/`](../.tmp/detachable-p1b1-20261018-7b9e1102/) 目录下：

### 5.1 验证命令与执行输出

1. **语法与模板检查 (`check.log`)**：
   ```powershell
   npm --prefix dsh-whale-mist run check
   ```
   *结果*：退出码 0，CSS 模板守卫与各 JS 语法检查全绿。
2. **P1B-1 独立综合探针矩阵 (`p1b1-probes.log`)**：
   ```powershell
   node --test .tmp/detachable-p1b1-20261018-7b9e1102/verify-p1b1-probes.mjs
   ```
   *覆盖明细*：
   - ✔ PROBE 1: `index.html` 包含全量画面/界面/预设元素，无虚假硬编码默认值，权威快照初始灌装正确；
   - ✔ PROBE 2: 4 项画面参数（亮度/遮罩/模糊/透明度）拖动中实时派发与双向同步；
   - ✔ PROBE 3: 界面定制（主题、配色、文字对比度、聊天底色、强调色模式/Hex）双向同步；
   - ✔ PROBE 4: Echo-loop 与防抖防护，同值修改不产生冗余派发或持久化；
   - ✔ PROBE 5: 越界值（亮度>120、模糊>24、透明度<40）、非法 Hex 色值及未声明键严格拒绝，不污染 controller；
   - ✔ PROBE 6: 陈旧 revision 拒绝，单字段修改不回滚其他已修改字段快照；
   - ✔ PROBE 7: 4 字段预设边界严格验证（仅保存 4 项画面值，严格不存主题/强调色/聊天底色；应用时不篡改界面色彩；`cleanupPending`/转场时门禁严格生效，不可越权）；
   - ✔ PROBE 8: 断连时禁止写入并清晰展示断连状态，服务端错误透明展示于警告条；
   - ✔ PROBE 9: `WhaleDockedAppearancePanel` React 组件挂载验证，三组控件均正确响应并在 DETACHED 状态下锁定；
   - ✔ PROBE 10: `companion.css` 580px 响应式网格断点与零 CDN/零外链审查全绿。
   *结果*：10/10 项全部通过，退出码 0。
3. **P0 基础契约专项回归 (`p0.log`)**：
   ```powershell
   npm --prefix dsh-whale-mist run test:detachable-p0
   ```
   *结果*：15/15 项全部通过，退出码 0。
4. **P1A 生产链路专项回归 (`p1a.log`)**：
   ```powershell
   npm --prefix dsh-whale-mist run test:detachable-p1a
   ```
   *结果*：5/5 项全部通过，退出码 0。
5. **无界面双 Tab 浏览器 E2E 回归 (`browser-e2e.log`)**：
   ```powershell
   npm --prefix dsh-whale-mist run test:detachable-e2e
   ```
   *结果*：11/11 项全部通过，退出码 0。

---

## 6. 未覆盖项与后续安排

1. **未覆盖项**：
   - 真实系统窗口（独立 Edge App 真实拖拉窗口尺寸、Windows 多显示器高 DPI 缩放表现）属实机交互体验，需在后续有真实开窗授权时人工核验；
   - 离线测试通过仅代表代码、协议、状态机和响应式布局通过，不等于真实系统窗口已全部验收。
2. **后续阶段（不在本轮混入）**：
   - **P1B-2**：按 [独立窗UI方向](DETACHABLE_APPEARANCE_UI_DIRECTION_20261017.md) 推进缩略图壁纸库与详情页签（受限后端缩略图服务真实审计，禁止直接给浏览器本地绝对路径）；
   - **壁纸作者专属参数**：另拆专属 schema 与单项目标隔离，不使用全局画面项冒充。
3. **完成状态**：
   - 本轮 P1B-1 工作已全部完成并闭环，现停下等待 Codex 复审。
