# rc.51 作者首次读取就绪补修：最终交付报告 (Round C)

交付日期：2026-10-27\
执行会话：Gemini 3.8 Flash Medium/Turbo\
隔离修复目录：`F:\dsh-wallpaper-plugins\.tmp\rc51-gemini-readiness-repair-20261027-c\`\
复审基线：`F:\dsh-wallpaper-plugins\docs\RC51_AUTHOR_READ_READINESS_REPAIR_SECOND_REVIEW_20261027.md`

---

## 1. 交付结论与双监督验收矩阵

本轮严格依据 Codex 二次复审要求，在独立排他目录 `rc51-gemini-readiness-repair-20261027-c` 中完成了 **R1（响应边界完整身份绑定与漂移拒绝）** 与 **R2（QA阶段监听注册单截止与快速失败清理负例）** 的最小补修与离线断言验证。

所有测试均在具有父进程外监督器（关闭 stdin、超时硬杀、退出状态确认、独立 wx 报告写盘）下运行并通过。

| 检验项目 | 进程与监督耗时 | 退出状态 | 关键断言与验收证据 |
|---|---|---|---|
| **normal/run-normal.cjs** (8/8 正常全量用例) | 1055ms | 退出 0 | 8/8 通过，`allPassed: true`，`cleanupSuccessfulForAll: true`。同一次 GET 成功等待首帧就绪，单次 GET、0 次 POST、0 次原生 IO。 |
| **fault/run-fault.cjs** (真实清理故障注入) | 1093ms | 退出 0 (子退出 1) | 7/8 通过，Case 1 真实 helper 返回 `closed: false`，自然触发 `Session must be verified closed` 断言失败；`cleanupSuccessful: false`，逻辑失败带干净清理被拒绝。 |
| **verify-response-gap.mjs** (R1 响应边界 5 字段漂移) | ~140ms | 退出 0 | `control` 组 `targetActive: true`；`hwnd`、`pid`、`startUtc`、`helper`、`session` 五组在 `waitForReady` resolve 后的同一轮事件循环中发生漂移，Host 均成功拦截并输出 `targetActive: false`。 |
| **test-registration-timeout-negative.mjs** (R2 阶段超时负例) | 161ms | 退出 0 | 监听注册等待受 150ms 单一阶段预算约束，超时抛出阶段错误；`finally` 块安全回收 Server/Host/Session，确认 `session.isClosed() === true`，无挂起、不依赖父级 25s 强杀。 |
| **verify-counterexamples.mjs** (事件前漂移与生命周期负例) | 554ms | 退出 0 | 事件前四字段漂移、`session_changed` 消费、Host `targetActive=false`、`adapter.dispose()` 立即解绑全部通过。 |
| **verify-inputs.mjs** (保护输入哈希核验) | ~200ms | 退出 0 | 12 项保护输入 SHA256 逐项匹配，`allMatch: true`。 |

---

## 2. 补修根因与实现细节 (R1 & R2)

### R1：响应边界完整身份贯穿与绑定 (`author-properties-apply.js` & `author-properties-host.js`)

- **问题根因**：
  在 round b 中，虽然 `waitForReady` 内部冻结了初始身份并在事件回调时完成了比对，但在 `author-properties-host.js` 的 `await waitForReady` 之后，Host 仅调用了 `canApply(id, generation)`，丢失了对“具体 session 引用”及“各字段是否与刚才绑定的身份完全同一”的校验。若在 await 续体执行前微任务微隙发生属性漂移，Host 仍可能返回 `targetActive: true`。
- **补修实现**：
  1. 在 `author-properties-apply.js` 中新增：
     - `isBoundTargetCurrent(bound)`：严格比对当前 `readTarget()` 与 `bound` 的完整属性：
       - `currentRaw.session === bound.session`（必须为同一具体 session 实例）
       - `currentRaw.stopping !== true` 且 `currentRaw.busy !== true`
       - `wallpaperId`、`generation`、`location`、`hwnd`、`pid`、`helper` 严格相等
       - `startUtc` 时间戳等价（`areStartUtcsEquivalent`）
       - `captureStarted === true`
     - `currentBoundIdentity()`：提取并归一化包含 `session` 引用的当前有效绑定身份。
     - `waitForReady` 返回值携带 `boundIdentity`：`{ ok: true, target: initial.target, boundIdentity }`。
  2. 在 `author-properties-host.js` 中：
     - `readSchemaForGet` 在 `await waitForReady` 之后立即使用 `applyAdapter.isBoundTargetCurrent(boundIdentity)` 进行二次核实。
     - 在 `handler` 中，`await readSchemaForGet` 续体运行后、向客户端 `send(200, ...)` 之前，再次调用 `isBoundTargetCurrent(boundIdentity)` 最终核实。
     - 在 `state` 构造函数中，以 `isBoundTargetCurrent(boundIdentity)` 作为 `application.targetActive` 的最终门禁。
  3. **效果**：
     一旦发生任何字段漂移（`hwnd`、`pid`、`startUtc`、`helper`、`session`），即使 `waitForReady` 之前曾判定通过，最终响应中的 `application.targetActive` 亦立刻置为 `false`，绝不向客户端下发可编辑状态。

### R2：QA 阶段监听注册单截止与受控快速失败负例 (`test-readiness-repair.mjs`)

- **问题根因**：
  原 `test-readiness-repair.mjs` 中的 4 处 `while (session.stats().captureReadyListeners === 0)` 循环虽然单次 `setTimeout(10)` 受 `bounded` 约束，但外层 `while` 无总时长上限。若因故障导致监听永远无法注册，测试将持续自旋，直到父级监督器 25s 硬杀。
- **补修实现**：
  1. 封装带总预算上限的等待辅助函数：
     ```javascript
     export const waitForListenerRegistration = async (session, ms = 800) => {
       const start = Date.now();
       while (session.stats().captureReadyListeners === 0) {
         if (Date.now() - start > ms) {
           throw new Error(`waitForListenerRegistration timeout after ${ms}ms (stage deadline exceeded)`);
         }
         await new Promise(r => setTimeout(r, 10));
       }
     };
     ```
  2. 替换 Case 6（2处）与 Case 7（2处）的所有无界 `while` 循环为 `await waitForListenerRegistration(session, 800)`。
  3. 新增受控负例 `test-registration-timeout-negative.mjs`：
     - 在未触发请求（监听永远为 0）的情况下执行 `waitForListenerRegistration(session, 150)`。
     - 验证其在 161ms 内快速抛出明确的阶段超时异常 `waitForListenerRegistration timeout after 150ms`。
     - 在 `finally` 块中执行 `host.dispose()`、`server.close()`、`session.stop()`。
     - 确认清理后 `session.isClosed() === true`，监听数归 0，生成 `registration-timeout-negative.json`（`{ flag: 'wx' }`），退出码 0。

---

## 3. 保护输入 SHA256 哈希核验表 (12项)

经 `verify-inputs.mjs` 校验，12 项输入文件哈希完全一致：

| 输入文件路径 | 预期 SHA256 | 实际 SHA256 | 状态 |
|---|---|---|:---:|
| `.../unpacked/src/index.js` | `5970769F31A0A0AF9EE87F0C5F0ABDF14741181CC947BBB271305E5E5F2875D4` | `5970769F31A0A0AF9EE87F0C5F0ABDF14741181CC947BBB271305E5E5F2875D4` | MATCH |
| `.../unpacked/src/client.js` | `62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8` | `62F95BCBAF8DDE48F7C8467D1E6EF7AB772CFCC3C57216F6BE973219E65E71B8` | MATCH |
| `.../unpacked/src/wallpaper/session.js` | `BFD991CF034B590CDF4740A0771E62C23D9C865834611D29F1CC491FA2149E01` | `BFD991CF034B590CDF4740A0771E62C23D9C865834611D29F1CC491FA2149E01` | MATCH |
| `.../unpacked/src/wallpaper/author-properties-apply.js` | `14799F8598F0093DF4916B535B62995FC522991BCADFA847EC7DA973E360ADD9` | `14799F8598F0093DF4916B535B62995FC522991BCADFA847EC7DA973E360ADD9` | MATCH |
| `.../unpacked/src/wallpaper/author-properties-host.js` | `E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` | `E261A6D472C2A7F6CD7009EBD7FC7F3A58214DC1A2818F41FB700366132BEC97` | MATCH |
| `.../unpacked/src/wallpaper/managed-window.js` | `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86` | `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86` | MATCH |
| `.../unpacked/src/wallpaper/scenes.js` | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` | MATCH |
| `.../unpacked/package.json` | `3C8D61C4786B614E5E01CC359C5242F4E6F8AB7C0D009BD1BD84268D5D0CA189` | `3C8D61C4786B614E5E01CC359C5242F4E6F8AB7C0D009BD1BD84268D5D0CA189` | MATCH |
| `docs/RC51_AUTHOR_READ_READINESS_REPAIR_TASK_20261027.md` | `1B6F497A89D813C839E9FAB878914CD97CB965FBD570477B25AA75E63165E8B3` | `1B6F497A89D813C839E9FAB878914CD97CB965FBD570477B25AA75E63165E8B3` | MATCH |
| `docs/RC51_TARGET_UNVERIFIED_OFFLINE_CLOSEOUT_20261027.md` | `9F1383C2E128C264A5B967E4FA0BFA13A8815E59BF627E022C0E67240E8C6789` | `9F1383C2E128C264A5B967E4FA0BFA13A8815E59BF627E022C0E67240E8C6789` | MATCH |
| `docs/RC51_AUTHOR_READ_READINESS_REPAIR_REVIEW_20261027.md` | `F8CF023550F7E7ABE8C53D8CB17B8807A61F944F5A2CD8AE8F3C7A583A5E586A` | `F8CF023550F7E7ABE8C53D8CB17B8807A61F944F5A2CD8AE8F3C7A583A5E586A` | MATCH |
| `docs/RC51_AUTHOR_READ_READINESS_REPAIR_SECOND_REVIEW_20261027.md` | `12701F561C6E9A79CE5B2735BBDFF4763E4436031905A0C5CD27B706BEB5DABC` | `12701F561C6E9A79CE5B2735BBDFF4763E4436031905A0C5CD27B706BEB5DABC` | MATCH |

---

## 4. 拟交付的 4 个生产修复文件列表

所有生产修改严格局限于以下 4 个文件，未修改 `client.js`、`package.json`、`scenes.js` 或任何外部资产：

1. `src/wallpaper/author-properties-apply.js`：
   - 补齐 `isBoundTargetCurrent` 与 `currentBoundIdentity`。
   - `waitForReady` 冻结归一化完整目标并绑定具体 `session` 实例，解决响应边界漂移。
2. `src/wallpaper/author-properties-host.js`：
   - `readSchemaForGet` 沿用单一总预算并与 `waitForReady` 共享（无 reset）。
   - 请求全链路贯穿 `boundIdentity`，在微任务续体及 `state` 构造时严格检验同一性。
3. `src/wallpaper/session.js`：
   - `onCaptureReady` 事件发布与注销机制。
   - 统计追踪 `captureReadyListeners`。
4. `src/index.js`：
   - 导出 `createWallpaperReadTarget` 与 `createWallpaperReadLifecycle`，供 Host 和 Adapter 正确获取绑定 session 与生命周期。

---

## 5. 边界与运维约束承诺

1. **离线隔离原则**：本轮所有补修与 QA 测试均在 `.tmp/rc51-gemini-readiness-repair-20261027-c\` 独立目录中完成，未污染开发树 `dsh-whale-mist/` 或解包目录。
2. **日常环境零干扰**：日常 DSH 0.2.1-rc.3、Whale rc.48、WE 原生壁纸、GitBash 保持运行未触碰；既有 228 项脏改动保持受保护状态。
3. **未越权操作**：未构建 npm 包、未安装包、未更新版本号、未修改生产 assets 或 manifest。
4. **后续流程**：等待 Codex 独立复审。待复审通过并获用户明确授权后，方可进入候选合并或构建阶段。“▶ 播放”及客户端 UI 变更继续后排。
