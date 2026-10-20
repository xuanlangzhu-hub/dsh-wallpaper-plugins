# P1B-1独立复审补修交付：R1–R4边界修复与真实分层验证

日期：2026-10-18
执行者：Antigravity (Pair Programming Agent)
依据规范：[P1B-1首次复审报告](DETACHABLE_APPEARANCE_P1B1_REVIEW_20261018.md)

---

## 1. 交付概述

本轮严格遵照 Codex 首次独立复审意见，**不重做 P1A/B 架构，不扩展 P1B-2（壁纸缩略图/详情页签）或作者专属参数，保持滚动 A 低优先级**，最小化精准补修 R1–R4 四项核心边界缺陷：
1. **R1**：单调快照接收与在途意图保护（解决迟到回包回滚 snapshot/DOM、在途 80→100 抖动、数字输入失焦恢复与断连清除）；
2. **R2**：权威预设目标门禁对齐（快照下发 `presetTarget`，独立页严格等效推导，彻底杜绝 mismatch/stopping/unconfirmed 放行及盲猜 Lucy）；
3. **R3**：调参与预设动作统一序列化队列（解决拖完即保存并发抢跑/stale-revision，杜绝目标或连接改变后重放旧意图）；
4. **R4**：主端吸附面板（`WhaleDockedAppearancePanel`）独立动作反馈区（解耦 `unconfirmedCleanup`，错误信息真实可见且可清除）。

全套修改通过了独立边界探针、真实 React 19.2.0 挂载与错误断言、生产伴随页双视口响应式几何以及全量 P0/P1A/E2E 回归测试。

---

## 2. 核心文件指纹与修改对照

### 2.1 关键文件 SHA256

| 文件路径 | 修改后 SHA256 | 说明 |
|---|---|---|
| `dsh-whale-mist/src/client.js` | `557B9C8CE67B9E73FA040CA33A593610BC6ACF18E988BCF31A9E08B6CD9DA769` | R2 快照下发 presetTarget、R4 独立动作错误区域与回调重置 |
| `dsh-whale-mist/src/detachable-contract.js` | `5E894F62BFFEE1F9640EBAD5862E12E48E8FE2251834E29EB0914993065D80AD` | R2 导出 isSceneId 与 buildAppearanceSnapshot 下发 presetTarget |
| `dsh-whale-mist/src/companion/companion.js` | `6314476614A8A4064BD0D4FDA92AA3F847F653D08C889244936E8E9F04AC5CAE` | R1 单调门禁/在途保护/失焦恢复、R2 目标门禁推导、R3 串行化动作队列 |
| `dsh-whale-mist/src/companion/companion.css` | `164DF2656361AB54D3179743BFD0AD83FCAF1C1D34CDA0B6BB3CAC39B7F35D82` | 保持不变（宽窄响应式布局） |
| `dsh-whale-mist/src/companion/index.html` | `6437306924C2D8A430162594CF3994825BD36EE9C4E129D9D4E964E032280D3C` | 保持不变（独立页骨架） |

---

## 3. 修复详情

### R1：独立页单调快照接收与在途意图保护
- **单调性校验**：在 `companion.js` 的 `applySnapshot(snap)` 入口增加严格单调判定：
  ```javascript
  const snapRev = Number.isInteger(snap.revision) ? snap.revision : 0;
  const currRev = Number.isInteger(currentSnapshot?.revision) ? currentSnapshot.revision : 0;
  const clientRev = Number.isInteger(client?.getCurrentRevision?.()) ? client.getCurrentRevision() : 0;
  if (currentSnapshot && (snapRev < currRev || snapRev < clientRev)) return;
  ```
  即使网络或预设响应中包含迟到的旧 revision 快照，也坚决丢弃，绝不覆盖本地更新的高版本快照。
- **在途意图保护**：在更新 DOM 控件值时，检查 `!pendingSettings.has(field)`。当用户由 80 继续拖到 100 时，中间 80 的响应回包到达不会将滑块回弹至 80，保持平滑且权威确认。
- **失焦恢复机制**：为 5 项数字输入框（`inputBrightness`, `inputMask`, `inputBlur`, `inputSurface`, `inputChatBackdrop`）注册 `blur` 事件监听器，失焦且不在在途队列时，立即恢复为当前快照的已确认权威值，不滞留未确认字符。
- **断连/失败清理**：断连或失败时清空队列，调用 `revertFieldToAuthoritative` 恢复控件至确认态。

### R2：预设门禁对齐与禁止盲猜
- **快照下发权威解析**：在 `detachable-contract.js` 及 `client.js` 的 `buildAppearanceSnapshot` 中增加下发只读字段：
  ```javascript
  presetTarget: controller.presets?.resolveTarget
    ? Object.freeze({ ...controller.presets.resolveTarget() })
    : null
  ```
- **等效共享推导规则**：在 `companion.js` 中实现 `resolvePresetTargetFromSnapshot(snap)`：
  1. 优先使用宿主快照直接下发的 `snap.presetTarget`；
  2. 若快照无该字段（离线或旧版测试），则执行与 `resolvePresetTarget` 100% 对齐的 fallback 逻辑：
     - `cleanupPending` 或 `['starting', 'connecting', 'waiting', 'stopping'].includes(wpState)` 判定为 `transition`；
     - `playing` 状态下校验 `activeScene` 与 `selectedScene`，不匹配报 `mismatch`；未知/null 报 `unknown-scene`，严禁盲猜 Lucy；
     - `idle` 状态下非 Lucy 场景若未确认报 `scene-unconfirmed`；
     - 其余非法状态报 `state-disallowed`；
- **提示文案与状态对应**：根据具体错误类型显示“播放状态切换中”、“请先停止当前播放或切换到所选壁纸”、“壁纸目录未确认，预设暂不可用”等准确说明，预设三按钮一致禁用。

### R3：预设动作与调参统一序列化队列
- **动作统一排队**：在 `companion.js` 中建立串行化动作循环 `runActionQueue()`，所有 `setSetting` 调参请求与预设动作（`SAVE_PRESET`, `APPLY_PRESET`, `REMOVE_PRESET`）统一排队调度。
- **调参完成才发预设**：当用户拖动滑块至 100 紧接着点击保存预设时，`save-preset` 在队列中等待 `set-setting` 获得响应并在 `client` 吸收 rev 2 之后，才以最新的 `expectedRevision: 2` 派发，彻底杜绝并发抢跑与 `stale-revision` 拒绝。
- **执行时目标再次确认**：预设动作在出队即将派发时，重新检查当前快照目标是否与点击时一致；若在途期间壁纸切换或断连，立即取消并返回 `target-changed` 或 `not-connected`，绝不自动向新壁纸重放旧意图。

### R4：吸附面板独立动作错误反馈
- **解耦清理警告**：在 `WhaleDockedAppearancePanel` 中，将 `actionError` 与 `unconfirmedCleanup` 明确拆分：
  - `unconfirmedCleanup` 依然以 `id="whale-docked-cleanup-error"` 仅在清理未确认时呈现；
  - `actionError` 呈现为独立的告警卡片 `id="whale-docked-action-error"`，具备 `role="alert"` 和 `aria-live="assertive"`，并提供关闭按钮；
- **各动作失败可见**：保存、应用、删除预设以及弹出（detach）或吸附（dock）失败时，即使 `unconfirmedCleanup === false`，错误文案也能立刻展现；
- **成功与下一动作清理**：所有动作在点击发起时先清空旧错误；操作返回 `res.ok === true` 时确保清空错误。

---

## 4. 真实分层验证与证据记录

本轮测试产物全部留存在新建的独立目录：
`.tmp/detachable-p1b1-repair-20261018-b2e1f409/`

### 4.1 测试分层与结果一览

| 检查层级 | 测试脚本 / 探针 | 范围与说明 | 结果 | 日志路径 |
|---|---|---|---|---|
| **代码语法与 CSS 守卫** | `npm run check` | 检查 11 个生产核心文件语法及模板字面量守卫 | 退出 0 | `.tmp/detachable-p1b1-repair-20261018-b2e1f409/npm-check.log` |
| **独立边界回归 (12 项)** | `repaired-boundaries.test.mjs` | 纯单元测试覆测 R1 单调吸收/80→100在途/失焦恢复；R2 门禁7场景/不猜Lucy/host快照；R3 串行调参后保存/目标变化防重放/断连取消 | 12/12 通过 (155ms) | `.tmp/detachable-p1b1-repair-20261018-b2e1f409/repaired-boundaries.log` |
| **真实 React 19.2.0 应用层** | `verify-react-docked-panel.mjs` | 加载生产 React 19.2.0 / ReactDOM，真实 controller 挂载吸附面板；验证参数同步(113)、R4 保存失败/应用失败/分离失败独立可见、关闭按钮有效、操作成功清空错误；验证真实 controller 门禁 | 全部通过 (2.4s) | `.tmp/detachable-p1b1-repair-20261018-b2e1f409/verify-react-docked-panel.log` |
| **伴随页几何与关键动作** | `verify-companion-geometry.mjs` | 无头 Edge 打开生产 `index.html`；分别测试 380px 窄视口（单列、无横向溢出、关键按钮可见）与 720px 宽视口（双列、预设卡通栏、无横向溢出） | 全部通过 (2.2s) | `.tmp/detachable-p1b1-repair-20261018-b2e1f409/verify-companion-geometry.log` |
| **P0 架构契约回归** | `detachable-appearance-p0.test.mjs` | 模式切换、单源快照、协议安全等全部 15 项基线 | 15/15 通过 | `.tmp/detachable-p1b1-repair-20261018-b2e1f409/p0.log` |
| **P1A 生产链路回归** | `detachable-p1a-production.test.mjs` | 真实生命周期、适配器、生产资产等全部 5 项基线 | 5/5 通过 | `.tmp/detachable-p1b1-repair-20261018-b2e1f409/p1a.log` |
| **双 Browser 进程 E2E** | `detachable-browser-e2e.mjs` | 主渲染器与伴随页双上下文真实 HTTP/SSE 交互 11 项 | 11/11 通过 | `.tmp/detachable-p1b1-repair-20261018-b2e1f409/browser-e2e.log` |

---

## 5. 环境状态与边界守则

1. **日常环境零污染**：日常 DSH 0.2.1-rc.2、日常外观 rc.35、Git Bash 0.1.1 保持不变；工作区 manifest 与生产 assets 依然冻结于 rc.30。
2. **进程操作零触发**：未操作退出、重开或采样日常 DSH / WE 进程；未向 DSH 发送任何模型推理请求；未关闭任何正在运行的用户应用。
3. **任务与仓库约束**：定时任务 `g` 保持 `PAUSED`；未执行 `git commit`、`git push` 或工作区清理。
4. **范围克制**：未进入 P1B-2（壁纸库缩略图/详情页签）或作者专属参数；滚动 A 保持低优先级。

补修工作已全部完成，等待 Codex 独立复审。
