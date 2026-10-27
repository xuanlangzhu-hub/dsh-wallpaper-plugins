# rc.51 作者首次读取就绪补修：QA资源收束最终交付报告 (Round D)

交付日期：2026-10-27\
执行会话：Gemini 3.8 Flash Medium/Turbo\
隔离修复目录：`F:\dsh-wallpaper-plugins\.tmp\rc51-gemini-readiness-repair-20261027-d\`\
复审基线：`F:\dsh-wallpaper-plugins\docs\RC51_AUTHOR_READ_READINESS_REPAIR_FINAL_REVIEW_20261027.md`

---

## 1. 核心结论与双监督验收矩阵

本轮遵循 Codex 最终复审要求，**严格未改动四个运行源码**（与 `review-evidence.json` 中的 SHA256 逐字节保持一致），专注于收束与修复 QA 测试套件在真实在途请求失败分支下的资源清理机制（`test-readiness-repair.mjs` 中的 `executeCaseCleanup`）。

所有测试均在全新排他目录 `rc51-gemini-readiness-repair-20261027-d` 中执行，原 a/b/c 目录及历史产物完整保留未覆盖。

| 检验项目 | 执行耗时 | 进程退出码 | 关键断言与验收证据 |
|---|---|---|---|
| **Case 6 真实在途失败窄回放**<br>(`registration-failure-supervisor.cjs`) | 388ms | 父退出 0<br>(子退出 1) | **`expectedFailureConfirmed: true`**。真实 HTTP GET 在途时注入永不注册，阶段 150ms 超时快速失败；`finally` 优先 abort 客户端请求并 dispose Host，Server 瞬时关闭无挂起；`cleanupSuccessfulForAll: true`，主错误精准保留为 `waitForListenerRegistration timeout after 150ms`（消除了之前的 `Timeout: server.close exceeded 2500ms`）。 |
| **Subcase 6B 双 Host/Server 失败边界**<br>(`verify-subcase6b-failure.mjs`) | 210ms | 退出 0 | 覆盖在 Subcase 6B 中第二套 Host2/Server2 建立并在途时超时的场景：两套 Host、两套 Server、客户端控制器及 Session 均被独立安全释放，确认 `serverClosed: true`、`server2Closed: true`、`sessionClosed: true`。 |
| **normal/run-normal.cjs**<br>(8/8 正常全量用例) | 926ms | 退出 0 | 8/8 全过，`allPassed: true`，`cleanupSuccessfulForAll: true`。同一次 GET 成功等待首帧就绪，单次 GET、0 次 POST、0 次原生 IO。 |
| **fault/run-fault.cjs**<br>(真实清理故障注入) | 846ms | 父退出 0<br>(子退出 1) | 7/8 通过，Case 1 真实 helper 返回 `closed: false`，自然触发 `Session must be verified closed` 断言失败；`cleanupSuccessful: false`，逻辑失败带干净清理被拒绝。 |
| **verify-response-gap.mjs**<br>(R1 响应边界 5 字段漂移) | ~140ms | 退出 0 | `control` 组 `targetActive: true`；`hwnd`、`pid`、`startUtc`、`helper`、`session` 五组在 `waitForReady` resolve 后的同一轮事件循环中发生漂移，Host 均成功拦截并输出 `targetActive: false`。 |
| **verify-counterexamples.mjs**<br>(事件前漂移与生命周期负例) | 548ms | 退出 0 | 事件前四字段漂移、`session_changed` 消费、Host `targetActive=false`、`adapter.dispose()` 立即解绑全部通过。 |
| **verify-inputs.mjs**<br>(13 项保护输入核验) | ~200ms | 退出 0 | 包含本次复审文档在内的 13 项保护输入 SHA256 逐项匹配，`allMatch: true`。 |

---

## 2. 负例与失败见证口径精准区分

本报告明确区分三个维度的证据，绝不混淆或包装：

1. **Gemini 原无请求负例 (`test-registration-timeout-negative.mjs`)**：
   - 特征：未发起实际 HTTP 请求，Session 未与真实 Host 连接绑定。
   - 证明范围：仅证明 `waitForListenerRegistration` 辅助函数自身在无事件到达时能在 ~150ms 内超时并退出。
   - 局限：不能证明有在途网络连接与 Host 等待器时，`finally` 是否能干净回收资源。
2. **Codex 实际失败见证 (`.tmp/rc51-readiness-repair-final-review-20261027-a/`)**：
   - 特征：在原 Case 6 入口真正发起真实 HTTP GET 请求，走真实 Host/adapter，将 `session.onCaptureReady` 置为 no-op 制造永不注册。
   - 失败事实：由于原代码在 `finally` 中先 `await bounded(server.close)`，活跃的客户端连接未断开导致 `server.close` 挂起并在 2500ms 超时；该异常覆盖了原始阶段超时错误，且跳过了后续 `host.dispose()`，导致 `expectedFailureConfirmed: false`、总耗时达 3057ms。
3. **Round D QA 修复与验收 (`.tmp/rc51-gemini-readiness-repair-20261027-d/`)**：
   - 特征：保留 Codex 构造的真实请求与注入条件，重构清理顺序与独立保护逻辑。
   - 验收事实：子进程在 388ms 内退出 1，Server 瞬时关闭；父外监督 497ms 确认通过；`expectedFailureConfirmed: true`，证明在途失败不仅有界退出，且底层资源被完全回收。

---

## 3. QA 资源收束技术实现 (`executeCaseCleanup`)

在 `test-readiness-repair.mjs` 中抽象并落实了严格的资源清理合同：

```javascript
export async function executeCaseCleanup({
  bodyError = null,
  c,
  abortControllers = [],
  hosts = [],
  servers = [],
  sessions = [],
  engines = []
}) {
  const cleanupErrors = [];
  const cleanupDetails = {};

  // 1. 优先取消客户端在途请求（释放连接并结束流等待）
  for (let i = 0; i < abortControllers.length; i++) {
    const ctrl = abortControllers[i];
    if (ctrl && typeof ctrl.abort === 'function') {
      try { ctrl.abort(); } catch (err) { cleanupErrors.push({ step: `abort[${i}]`, error: err.message }); }
    }
  }

  // 2. 停止引擎
  for (let i = 0; i < engines.length; i++) {
    const engine = engines[i];
    if (engine && typeof engine.stop === 'function') {
      try { await bounded(engine.stop(), `engine[${i}].stop`, 1500); } catch (err) { cleanupErrors.push({ step: `engine[${i}].stop`, error: err.message }); }
    }
  }

  // 3. 优先 dispose Host（立即终止 Host 端在途请求，注销 adapter 等待并向客户端发送终态响应）
  for (let i = 0; i < hosts.length; i++) {
    const h = hosts[i];
    if (h && typeof h.dispose === 'function') {
      try { h.dispose(); } catch (err) { cleanupErrors.push({ step: `host[${i}].dispose`, error: err.message }); }
    }
  }

  // 4. 关闭 Server（显式关闭活跃连接，有界等待 server.close）
  for (let i = 0; i < servers.length; i++) {
    const srv = servers[i];
    if (srv && typeof srv.close === 'function') {
      try {
        try { srv.closeAllConnections?.(); } catch {}
        await bounded(new Promise(resolve => srv.close(resolve)), `server[${i}].close`, 1500);
        cleanupDetails[`server[${i}]Closed`] = true;
      } catch (err) { cleanupErrors.push({ step: `server[${i}].close`, error: err.message }); }
    }
  }

  // 5. 停止 Session
  for (let i = 0; i < sessions.length; i++) {
    const sess = sessions[i];
    if (sess) {
      try {
        const stopRes = await bounded(sess.stop(), `session[${i}].stop`, 2000);
        const sessClosed = sess.isClosed() === true;
        const stopClosed = stopRes?.closed === true;
        cleanupDetails[`session[${i}]Closed`] = sessClosed;
        cleanupDetails[`session[${i}]StopClosed`] = stopClosed;
        if (!sessClosed || !stopClosed) {
          cleanupErrors.push({ step: `session[${i}].stop`, error: 'Session must be verified closed' });
        }
      } catch (err) { cleanupErrors.push({ step: `session[${i}].stop`, error: err.message }); }
    }
  }

  cleanupDetails.errors = cleanupErrors;
  c.cleanupDetails = cleanupDetails;
  c.cleanupSuccessful = (cleanupErrors.length === 0);

  // 关键错误保留逻辑：若测试主逻辑已抛出阶段错误（如超时），不被清理错误覆盖；
  // 仅在主逻辑正常、但收尾出现未预期清理失败时，才抛出清理异常以标记 Case 失败。
  if (!bodyError && cleanupErrors.length > 0) {
    const msg = cleanupErrors.map(e => `${e.step}: ${e.error}`).join('; ');
    throw new Error(msg);
  }
}
```

### 关键设计优势

1. **破除 Server 挂起闭锁**：通过先 `abortCtrl.abort()` 与 `host.dispose()`，在途的 HTTP 连接立刻得到 503 终态响应并关闭，避免了 `server.close()` 因等待存活 socket 而遭遇 2500ms 超时。
2. **独立隔离防护**：每一步清理均独立 `try...catch`，任一资源出现问题不会跳过其余资源的回收。
3. **主错误保护**：Case 6 阶段超时作为测试主体失败被忠实抛出到 `runTestCase`，而清理结果单独记入 `cleanupSuccessful: true`，精准满足外层监督器的核验契约。
4. **覆盖多套服务边界**：Case 6 将 `host2`、`server2` 提升至外层作用域并在 `finally` 中全量收束；`verify-subcase6b-failure.mjs` 独立验证了 Subcase 6B 阶段超时的安全释放。
5. **对等保护 Case 7**：Case 7 双在途请求（`reqA`、`reqB`）及双会话（`sessionA`、`sessionB`）沿用完全相同的清理保护机制。

---

## 4. 运行源码 SHA256 哈希一致性证明

本次严格未触碰生产与运行代码，四个运行文件 SHA256 与 Codex `review-evidence.json` 保持 100% 一致：

| 运行源码相对路径 | 本轮实际 SHA256 (Round D) | `review-evidence.json` 预期 | 状态 |
|---|---|---|:---:|
| `src/index.js` | `82BE5602DC1B3215176CC3F40C080EB0E82F3E0E29C485B8FDB6716BD1E399C6` | `82BE5602DC1B3215176CC3F40C080EB0E82F3E0E29C485B8FDB6716BD1E399C6` | MATCH |
| `src/wallpaper/author-properties-apply.js` | `0DE2CF9949C471781AFBC3CD4651414D1C792EA4A2FAC697AA963CD865278154` | `0DE2CF9949C471781AFBC3CD4651414D1C792EA4A2FAC697AA963CD865278154` | MATCH |
| `src/wallpaper/author-properties-host.js` | `926693DF1AF8A61D6A422F135F53592AF4979B63AAFFA27BED431FF2C058E68F` | `926693DF1AF8A61D6A422F135F53592AF4979B63AAFFA27BED431FF2C058E68F` | MATCH |
| `src/wallpaper/session.js` | `9E6BCD86188C2E2B35A8A826099662A341BD8763BB087701C959ECFF81C8C498` | `9E6BCD86188C2E2B35A8A826099662A341BD8763BB087701C959ECFF81C8C498` | MATCH |

---

## 5. 保护与边界承诺

1. **环境与数据零侵扰**：
   - 281 项共享源码／QA／assets 保护项、43 项固定解包 candidate 保持不变。
   - 既有 230 项脏改动受保护。
   - 日常环境 DSH 0.2.1-rc.3、Whale rc.48、WE 原生壁纸、GitBash 保持运行未触碰。
2. **禁止越权**：
   - 未构建 npm 包、未安装包、未修改版本号、未更新生产 assets 或 manifest。
   - “▶ 播放”及客户端 UI 变更继续后排。
3. **后续对接**：
   - 本轮 QA 资源收束已完全闭合，等待 Codex 独立复审核验。
