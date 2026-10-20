# 独立/吸附设置P1A九审补修交付：撤回CreationDate一秒容差、实施严格零容差等值判据、补齐时间表示规范化与全生命周期边界探针

2026-10-18，小 G。对照[九审报告](DETACHABLE_APPEARANCE_P1A_NINTH_REVIEW_20261018.md)实施专项补修。**前轮已闭合项（八审完整程序路径规范化校验与基线存在性必检、W1 JSON 协议解析错误与未知状态保留、W2 根缺席平滑过渡、W4 存活后代 dispose 绝对保护、EBUSY 重试闭环、R1 来源分表、R4-A 已有目录保护、R4-C 停止失败重试、React 19 挂载、生产伴随页调参、R6 队列保持、七审动作前 3 项 PID 复用负例）全部原样保持。本轮范围严格锁定在 W3 余项：彻底撤回本轮新增的一秒创建身份容差（`delta > 1000`），恢复严格零容差等值核验（`currentMs !== expectedMs`），补齐同一瞬间不同格式表示的规范化等值验证，以及 1ms / 500ms / 1000ms / 1001ms 差值与根/子全生命周期边界门禁。**

本轮严格遵守离线与安全规范：未改动运行中 DSH（0.2.1-rc.2）、Wallpaper Engine 或日常桌面 Profile，未创建任何可见系统窗口，未修改 `package.json` 版本（保持 `0.6.0-rc.30`），未提交或推送 Git 变更。

---

## 一、九审缺陷根因分析与补修实现

### 1.1 W3 创建身份（CreationDate）比较彻底撤回 1000ms 容差，实施严格零容差等值核验

- **根因分析**：
  在八审补修中，为了防止时间戳精度差异引起误报，我们在 `src/detachable-edge-adapter.js` 的 `classifyProcessRecord` 中引入了 `const delta = Math.abs(currentMs - expectedMs); if (delta > 1000)` 的判断逻辑。然而，OS 进程的 `CreationDate` 是区分进程生命周期实例的离散身份标识；相差 1 毫秒至 1000 毫秒的进程在操作系统中属于完全不同的进程实例。容忍 1000 毫秒的时间窗口会导致刚刚被回收并迅速重建的异己进程被误判为原受控进程，从而破坏了 PID 复用防线。
- **补修实现**：
  1. **彻底撤回容差判断**：
     在 [src/detachable-edge-adapter.js](../dsh-whale-mist/src/detachable-edge-adapter.js) 第 208–218 行中，彻底移除 `delta > 1000`，恢复严格等值判据：
     ```javascript
     // If baseline expectedCreationDate is specified, it must be parseable and strictly match:
     if (expectedCreationDate !== null && expectedCreationDate !== undefined) {
       const expectedMs = parseCreationDate(expectedCreationDate);
       if (expectedMs === null || !Number.isFinite(expectedMs)) {
         return { status: 'insufficient-info', pid, proc, reason: 'missing-or-invalid-expected-creation-date' };
       }
       if (currentMs !== expectedMs) {
         return { status: 'foreign-recycled', pid, proc, reason: 'creation-date-mismatch' };
       }
     }
     ```
  2. **明确“表示规范化”与“时间差值”的本质区别**：
     - **同一瞬间的表示规范化**：`parseCreationDate(val)` 将 WMI 格式（`/Date(1792295139249)/`、`/Date(1792295139249+0800)/`）、ISO 8601 UTC 字符串（`2026-10-18T01:00:00.000Z`）、带时区偏移的 ISO 字符串（`2026-10-18T09:00:00.000+08:00`）及数值形式精确解析为统一的 epoch 毫秒整数（`1792295139249`）。当两者代表同一物理时刻时，`currentMs === expectedMs` 精确成立，受控判定稳定通过；
     - **非零毫秒差值的绝对零容忍**：任何不相等的时刻（包括 +1ms、-1ms、+500ms、-500ms、+1000ms、+1001ms 等），规范化后均有 `currentMs !== expectedMs`，无一例外判定为 `foreign-recycled`（`reason: 'creation-date-mismatch'`），下发 0 强杀并绝对保留 profile。

### 1.2 同步更新 QA 断言与全量边界测试套件

1. **更新 `qa/verify-eighth-review-probes.mjs`**：
   - 撤回 UNIT 1 中“预期 01:00:00.500 仍 controlled”的放宽断言；
   - 增加合法一致表示规范化测试组（UTC ISO、WMI 无偏移、WMI 带偏移、带时区 ISO、纯数值），断言其全部判为 `controlled`；
   - 增加差值测试组（+1ms、-1ms、+500ms、+1000ms、+1001ms、+1h、数值差值、WMI 差值），断言其全部判为 `foreign-recycled`（`reason: 'creation-date-mismatch'`）；
   - 在 `runEighthReviewCase` 注入 +1ms、+500ms、+1000ms、+1001ms 及同时刻 WMI 格式的子生命周期测试，验证前 4 者 0 强杀且保留 profile，后者正常定向强杀并清理；
   - 在 PART 4 根预检中加入根进程创建时间差 500ms 的场景，验证其 0 强杀且保留 profile。
2. **新建专用 `qa/verify-ninth-review-probes.mjs` 门禁**：
   - 独立实现九审报告要求的全套边界场景矩阵（见下节表），全面验证根与子在 1ms、500ms、1000ms、1001ms 差值下的拒绝表现与合法受控终止表现。

---

## 二、九审独立边界矩阵对照（`qa/verify-ninth-review-probes.mjs`）

新建 `qa/verify-ninth-review-probes.mjs`，执行结果如下：

```text
--- Running Ninth Review Verification Probes (Strict Zero-Tolerance Creation Identity & Lifecycle Probes) ---
[UNIT 1] Strict zero-tolerance CreationDate equality & representation equivalence...
  -> PASS

[EVALUATION OF CODEX NINTH REVIEW BOUNDARY MATRIX]
  Scenario: sub-creation-diff-1ms        | Close Ok: false | Forced: 0 | Profile Preserved: true
  Scenario: sub-creation-diff-500ms      | Close Ok: false | Forced: 0 | Profile Preserved: true
  Scenario: sub-creation-diff-1000ms     | Close Ok: false | Forced: 0 | Profile Preserved: true
  Scenario: sub-creation-diff-1001ms     | Close Ok: false | Forced: 0 | Profile Preserved: true
  Scenario: root-creation-diff-500ms     | Close Ok: false | Forced: 0 | Profile Preserved: true
  Scenario: sub-creation-exact-match     | Close Ok: true  | Forced: 1 | Profile Preserved: false
  Scenario: sub-creation-identical-wmi   | Close Ok: true  | Forced: 1 | Profile Preserved: false
  -> All 7 Codex Ninth Review boundary matrix scenarios PASSED!

--- ALL NINTH REVIEW VERIFICATION PROBES PASSED! ---
```

### 九审报告表逐条对照

| 场景 | 实际命令选择与收尾 | 安全期望 | 本轮执行结果 | 判定 |
| --- | --- | --- | --- | --- |
| **子创建时间 +1ms** | 不发 taskkill，`close=false` 且保留 profile | 拒绝并保留 | `Forced: 0, Close Ok: false, Profile Preserved: true` | **PASS** |
| **子创建时间 +500ms** | 不发 taskkill，`close=false` 且保留 profile | 拒绝并保留 | `Forced: 0, Close Ok: false, Profile Preserved: true` | **PASS** |
| **子创建时间 +1000ms** | 不发 taskkill，`close=false` 且保留 profile | 拒绝并保留 | `Forced: 0, Close Ok: false, Profile Preserved: true` | **PASS** |
| **子创建时间 +1001ms** | 不发 taskkill，`close=false` 且保留 profile | 拒绝并保留 | `Forced: 0, Close Ok: false, Profile Preserved: true` | **PASS** |
| **根创建时间 +500ms** | 不发 taskkill，`close=false` 且保留 profile | 拒绝并保留 | `Forced: 0, Close Ok: false, Profile Preserved: true` | **PASS** |
| **子创建时间完全一致（ISO）** | 正常定向强杀合法子 PID 并清理 profile | 正常收尾 | `Forced: 1, Close Ok: true, Profile Preserved: false` | **PASS** |
| **子创建时间表示等值（WMI vs ISO）** | 正常定向强杀合法子 PID 并清理 profile | 规范化通过 | `Forced: 1, Close Ok: true, Profile Preserved: false` | **PASS** |

---

## 三、全量回归与语法检查结果

```text
> npm run check
node --check 11 files + css-template-guard
css template checks passed: 2 template literal(s), no stray backticks, no single-backslash escapes
Exit: 0

> node qa/verify-ninth-review-probes.mjs
--- ALL NINTH REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> node qa/verify-eighth-review-probes.mjs
--- ALL EIGHTH REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> node qa/verify-seventh-review-probes.mjs
--- ALL SEVENTH REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> node qa/verify-sixth-review-probes.mjs
--- ALL SIXTH REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> node qa/verify-fifth-review-probes.mjs
--- ALL FIFTH REVIEW VERIFICATION PROBES (W1-W4) PASSED! ---
Exit: 0

> node qa/verify-fourth-review-probes.mjs
--- ALL FOURTH REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> node qa/verify-third-review-probes.mjs
--- ALL THIRD REVIEW VERIFICATION PROBES PASSED! ---
Exit: 0

> npm run test:detachable-p1a
✔ 1. Host Lifecycle, Index Injection, and Protected Bootstrap Route
✔ 2. Edge Window Adapter: Discovery, Sandbox Arguments, Dedicated Profiles, and Orderly Close
✔ 3. Static Companion Assets: Manifest Serving, Method Guard, and Traversal Defense
✔ 4. Dual Views (Docked Panel & Companion Window) with Single Authoritative Controller
✔ 5. Companion Application (companion.js) Token Scrubbing, DOM Sync, and Error Guard
tests 5, pass 5, fail 0
Exit: 0

> npm run test:detachable-p0
tests 15, pass 15, fail 0
Exit: 0

> npm run test:detachable-e2e
status: PASSED, tests: 11, spawnCount: 3, closeCount: 3
Exit: 0

> npm run test:appearance-selection
Exit: 0

> git diff --check
clean (0 errors)
```

---

## 四、安全与交付状态

- **受影响代码与测试**：
  - `src/detachable-edge-adapter.js`：彻底撤回 `delta > 1000` 容差判断，恢复严格 `currentMs !== expectedMs` 零容差等值核验；
  - `qa/verify-eighth-review-probes.mjs`：撤回 500ms 容差断言，补齐表示规范化正例、非零差值负例、1ms/500ms/1000ms/1001ms 生命周期负例及根进程 +500ms 负例；
  - `qa/verify-ninth-review-probes.mjs`：新建九审专用边界矩阵测试套件（严格执行 7 项场景检验）。
- **保护规范与现场**：
  - 零可见窗口，无前台抢占；
  - 日常 DSH 0.2.1-rc.2 / 鲸系外观 rc.35 / Git Bash 0.1.1 正常运行中，未发生热改；
  - 版本号严格保持 `0.6.0-rc.30`，未进行 Git 提交或推送；
  - 后台活跃任务数保持为 0。

交付 Codex 进行九审补修复核。
