# 外观背景亮度提亮与遮罩说明交付文档

**交付日期**：2026-10-16\
**对应任务**：[GEMINI_NEXT_APPEARANCE_BRIGHTNESS_20261016.md](GEMINI_NEXT_APPEARANCE_BRIGHTNESS_20261016.md)\
**执行角色**：Gemini（小G）\
**复审目标**：Codex 复审\

---

## 1. 任务背景与目标

针对此前用户反馈“亮度拉满仍不够亮”，原 `src/client.js` 中 `brightness` 范围限制在 `20–100`，100% 仅代表壁纸自身滤镜不调暗，但叠加的主题遮罩与界面底色仍会降低可见亮度，且原中文提示“只调暗壁纸本身”容易引起误解。

本次变更目标：
1. 将背景亮度范围由 `20–100` 拓展至 **`20–200`**，步长 1，CSS 变量投影按现有比例映射（20→0.2、100→1、150→1.5、200→2）。
2. 保持 `brightness` 字段名、存储键（`dsh-whale-mist.appearance.v1`）、归一化流程与默认值 70 不变。
3. 同步修改中英文提示文案，说明 100% 为原亮度基准、可继续向上提亮，并澄清遮罩是叠加主题底色。
4. 保持 `mask` 范围（0–90/默认 45）、`blur`、`surface` 等不变；亮度调整不重建媒体、不重新解码图片、不重启播放。
5. 补充 QA 测试断言（含真实控件回调、持久化与投影），通过离线隔离测试。

---

## 2. 修改文件与内容

### 2.1 `dsh-whale-mist/src/client.js`
- **`RANGE_SETTINGS`**：
  - 将 `brightness: Object.freeze([20, 100])` 修改为 `brightness: Object.freeze([20, 200])`。
  - `clampRange`、`isValidSetting`、设置控件属性（`min`/`max`）自动同步更新至 20–200。
- **中文文案**：
  - `brightnessHint`：`"100%保留原亮度，可继续提亮；最终效果还受遮罩和界面底色影响"`（原为 `"只调暗壁纸本身"`）。
  - `maskHint`：`"叠加主题底色；数值越大，主题底色覆盖越强，0%关闭这层遮罩"`（原为 `"用主题底色压低壁纸，提升文字可读性"`）。
- **英文文案**：
  - `brightnessHint`：`"100% preserves original brightness, higher values brighten further; final look is also affected by scrim and surface opacity"`（原为 `"Dims only the wallpaper"`）。
  - `maskHint`：`"Overlays the theme base colour; higher values cover more, 0% turns this scrim off"`（原为 `"Tints the wallpaper with the theme base for readable text"`）。
- **CSS 投影与滤镜规则**：
  - `PROJECTED_VARIABLES` 保持 `(value) => String(value / 100)`，自然支持 150→`"1.5"`、200→`"2"`。
  - `.wm-backdrop-media` 的 CSS `filter: brightness(var(--wm-bg-brightness, .7)) blur(...)` 原生支持大于 1 的倍率，无需变动 CSS。
  - `backdrop.update` 在亮度改变时仅执行 `updatePlayback()` 与 CSS 变量重映射，不触发重新加载、重解码或播放器重启。

### 2.2 `dsh-whale-mist/qa/appearance-harness.js`
- **默认值与旧值保持**：
  - 增加无明确亮度设置时回退默认值 70、遮罩回退 45 的断言。
  - 增加旧存储值（20、70、100）原样保留并可设置的断言。
- **边界夹取与类型检查**：
  - 更新越界夹取断言：999 夹至新上限 200，并投影 `--wm-bg-brightness: 2`。
  - 验证下限夹取：10 夹至 20，并投影 `--wm-bg-brightness: 0.2`。
  - 验证直接调用 controller 接受 150 与 200，分别投影 1.5 与 2。
  - 验证非法输入（`NaN`、`Infinity`、字符串 `'150'`、`__proto__`）被拒绝，保持当前有效设置。
  - 验证遮罩独立性：遮罩 0 投影 0，遮罩 90 投影 0.9，均不影响当前亮度值与投影。
- **真实 UI 滑块控件链路**：
  - 从 `fixture.controls()` 中获取真实渲染的 `range` 控件，断言 `data-wm-setting="brightness"` 的 `min === 20`, `max === 200`, `step === 1`。
  - 触发真实 `onChange` 回调传递 150：断言 controller 读取值为 150、CSS 变量为 `"1.5"`、localStorage 持久化为 150、`<output>` 显示 `"150%"`。
  - 触发真实 `onChange` 回调传递 200：断言 controller 读取值为 200、CSS 变量为 `"2"`、localStorage 持久化为 200、`<output>` 显示 `"200%"`。
  - 检查设置项中的提示文案节点，断言中/英提示文案与规范完全一致。
- **持久化重启重载与重置**：
  - 断言新插件实例启动（`fixture.boot()`）后从 IndexedDB/localStorage 重载出保存的亮度 200 并投影为 `"2"`。
  - 断言 `controller.reset()` 恢复默认亮度 70 并投影为 `"0.7"`。

---

## 3. 实际检查与测试结果

所有检查均在隔离工作区与独立临时 profile 下执行，未触碰日常环境：

| 检查项 | 命令 | 结果 | 关键产物 / 备注 |
|---|---|---|---|
| 语法与模板守卫 | `npm run check` | **PASS** | 语法检查通过，CSS 模板无散落反引号与非法转义 |
| 外观完整回归套件 | `npm run test:appearance` | **PASS** | **63/63** 全部通过（含 Edge headless 隔离 profile） |
| 场景选择回归 | `npm run test:appearance-selection` | **PASS** | 场景切换逻辑正常 |
| 壁纸区域背景检查 | `npm run test:appearance-wallpaper-regions` | **PASS** | 4 种区域底色组合与像素断言通过 |
| 侧栏底条消除检查 | `npm run test:appearance-sidebar-band` | **PASS** | 壁纸下无黑条，宿主淡出正常 |
| 聊天覆盖与裁剪检查 | `npm run test:appearance-wallpaper-overlay` | **PASS** | 15 项多场景与像素检查全部通过 |

---

## 4. 未验收部分与边界说明

1. **日常运行环境**：
   - 当前用户日常环境为 **rc.31 试用**，本次未操作或重启日常 DSH/WE 进程，未安装新包，未修改用户数据与 Profiles。
2. **版本冻结与发布打包**：
   - 工作区 manifest 与原生 assets 保持冻结在 `rc.30`，未改动版本号，未重新构建 native assets，未打包新的 tgz，未覆盖历史归档。
3. **视觉观感确认**：
   - 已完成离线无头浏览器的真实 DOM、CSS 变量投影、UI 滑块回调与持久化验证；
   - 200% 高亮度下的显示效果（如白色文字对比度、过曝表现、不同壁纸配合遮罩的实际视觉效果）属人眼感知范畴，待 Codex 复审后与用户适时确认。
4. **功能边界保留**：
   - 保持按壁纸保存独立外观预设、公开参数等功能留作未来规划，本次不扩展设置字段与数据结构。

---

## 5. 结论

本阶段外观亮度范围扩展（20–200）与遮罩说明修改已全部完成，源码改动精简收敛，QA 测试已完整覆盖真实控件回调与重载链路，全部测试通过。已准备就绪，提交 Codex 复审。
