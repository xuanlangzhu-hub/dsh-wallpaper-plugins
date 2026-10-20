# 0.6.0-rc.36 独立/吸附外观与分级图库候选整合交付报告

日期：2026-10-19\
执行者：Antigravity (Pair Programming Assistant)\
依据规范：
1. [rc.36 隔离候选整合任务说明](GEMINI_NEXT_RC36_DETACHABLE_CANDIDATE_20261019.md)
2. [P1B-2 五审通过结论报告](DETACHABLE_APPEARANCE_P1B2_FIFTH_REVIEW_20261019.md)
3. [B清理恢复六审复审报告](WALLPAPER_CLEANUP_RECOVERY_B_SIXTH_REVIEW_20261018.md)
4. [AGENTS.md 检查与交付守则](../AGENTS.md)

---

## 1. 交付产物与指纹摘要

本轮严格遵照任务指令，**在全新隔离 stage 中基于不可变 rc.35 基底构建并验证了 0.6.0-rc.36 候选包**。未整份打包开发工作区，未改动工作区 `package.json`（保持 `0.6.0-rc.30`）及生产 assets，未向日常 DSH / WE 进行任何安装或热改。

- **基底归档**：`release/plugins/dsh-whale-mist-0.6.0-rc.35.tgz`
  - **SHA-256**：`20D35ED1A63E2272FF50E44A9A38891F1D973994BED446FB19D79B0A9E6FAE58`
  - **文件数**：28 个文件
  - **大小**：7,458,458 字节
- **候选产物**：`release/plugins/dsh-whale-mist-0.6.0-rc.36.tgz`
  - **SHA-256**：`DCF07386808BC5DD50522AF9143A3840E0B485F6881907D640F744D80B0DF8D5`
  - **文件数**：35 个文件（原 28 项基底 + 7 项新增已审文件）
  - **大小**：7,477,137 字节
- **隔离 Stage 与构建脚本**：
  - Stage 目录：`.tmp/rc36-candidate-stage-20261019-38b4f10a/candidate-stage/`
  - 组装与反向审计脚本：`.tmp/rc36-candidate-stage-20261019-38b4f10a/build-stage.mjs`
  - 打包与全量审计脚本：`.tmp/rc36-candidate-stage-20261019-38b4f10a/pack-and-audit.mjs`
  - 候选全量 QA 监督套件：`.tmp/rc36-candidate-stage-20261019-38b4f10a/candidate-qa/run-candidate-qa.mjs`

---

## 2. 候选 35 项文件来源与 SHA-256 全量清单

归档内 35 项文件按来源白名单整合，并由 `pack-and-audit.mjs` 解包后逐字节比对，未引入任何外部文件、未发生路径穿越或符号链接：

### 2.1 保持 rc.35 基底逐字节完全一致文件（20 项）

| 序号 | 包内相对路径 | SHA-256 | 来源与属性说明 |
|---|---|---|---|
| 1 | `assets/DeepSeek-Harness.ico` | `B57A303C586154AD1741EB5D478BB80EAE8231495BD08995854BE7E711EEE5B8` | rc.35 原包保持，主应用图标 |
| 2 | `assets/whale-icon-helper.exe` | `77C9BDCD3E7179A46C21782FA9D6036A3AB766EDB35EEBECB57E822307C30906` | rc.35 原包保持，原生图标助手 |
| 3 | `assets/wallpaper/Microsoft.Windows.SDK.NET.dll` | `0EC371D93798852E36461C8ADDDBEADCE0F963A04752F0B64E54FE19C1C834A7` | rc.35 原包保持，原生运行组件 (1/12) |
| 4 | `assets/wallpaper/SharpGen.Runtime.COM.dll` | `35282958014C210BFDE28399C9FA3841B6D51F81FF1DA23AD0EDAD985DFA5B0C` | rc.35 原包保持，原生运行组件 (2/12) |
| 5 | `assets/wallpaper/SharpGen.Runtime.dll` | `0DC12AB829852555CCC9D8193E4422CD4CA389741DE0A54A189DE8A1C9B6BF4A` | rc.35 原包保持，原生运行组件 (3/12) |
| 6 | `assets/wallpaper/Vortice.Direct3D11.dll` | `EAD89D0F9C475527ABCB373C10B1D04C2BFA727070F126105430040B525AE2BC` | rc.35 原包保持，原生运行组件 (4/12) |
| 7 | `assets/wallpaper/Vortice.DirectX.dll` | `100B3A02EA5FD5BB8DB39C24DD58DEAD5669FA5A46D1EBCD61D4A9D82F812C12` | rc.35 原包保持，原生运行组件 (5/12) |
| 8 | `assets/wallpaper/Vortice.DXGI.dll` | `6E381EAAB77257EE63C20A654A2AC51875BD38F24C5A7D44DD2E4B8E122E8623` | rc.35 原包保持，原生运行组件 (6/12) |
| 9 | `assets/wallpaper/Vortice.Mathematics.dll` | `A553C1C90D2D8BDE2D7613306B994B585ACF22284BE009F4151381F7308476CB` | rc.35 原包保持，原生运行组件 (7/12) |
| 10 | `assets/wallpaper/WallpaperProbe.deps.json` | `8356139AA4F13D3C11051CEB2DF5C22B1AC7F9A0E87CDAE003095960698EEB95` | rc.35 原包保持，原生运行配置 (8/12) |
| 11 | `assets/wallpaper/WallpaperProbe.dll` | `5CD02541DC6C7F252168E100E17A77D47947EACF66068055F7ACD57508294C90` | rc.35 原包保持，原生运行组件 (9/12) |
| 12 | `assets/wallpaper/WallpaperProbe.exe` | `C2727F2BAD7CA64F97059BE781F4E2DE5214440BD94B704D58993FD0A1C12731` | rc.35 原包保持，原生采集执行体 (10/12) |
| 13 | `assets/wallpaper/WallpaperProbe.runtimeconfig.json` | `3E965CD7CFD553C2FF4E842D8D8019AAAE2DA0A21D92FF85A87573DD8D1B95C6` | rc.35 原包保持，原生运行配置 (11/12) |
| 14 | `assets/wallpaper/WinRT.Runtime.dll` | `BCF3A14E8712A90837FC5C0D8C8A24696AF2BD7F74E9767597EC81EDEDFB23DB` | rc.35 原包保持，原生运行组件 (12/12) |
| 15 | `src/windows/WhaleDesktopIcon.cs` | `F35EEEDDA1F67CA68D3CCA36CD03F3074579A369E9D324753E3091E06D185653` | rc.35 原包保持，桌面图标原生源码 |
| 16 | `cordis.patch.yml` | `E37C9096465EAB2DB253E3B3EF7D6A60FA7DB89899B4C9D96AAF51AF64621A07` | rc.35 原包保持，Cordis 服务载入声明 |
| 17 | `src/wallpaper/frame-hub.js` | `93386920898555DE5362176E505E107E7651A3895B510FBDF1BCB0A5B113ECE4` | rc.35 原包保持，画面采集转发中枢 |
| 18 | `src/wallpaper/frame-protocol.js` | `074AB958CFA6E9D0050067BA8AD5B280605671D9630615194ACB282DCD79DED9` | rc.35 原包保持，帧传输协议 |
| 19 | `src/wallpaper/probe-log.js` | `3E49A454180A249AA7C49912C428E524385C8A7C2A532E825147C25819F99C82` | rc.35 原包保持，日志记录 |
| 20 | `src/wallpaper/scenes.js` | `0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90` | rc.35 原包保持，场景定义（Lucy名单保持） |

### 2.2 B-清理恢复对应版文件（2 项）

| 序号 | 包内相对路径 | SHA-256 | 来源与属性说明 |
|---|---|---|---|
| 21 | `src/wallpaper/session.js` | `2AF9E5011933844E2B4DCE53D99E867E49C1AFB8DF67CC3B499244155EE4E4E5` | B 六审 rc35-repaired 对应版（带独立 taskbar-action 恢复与严格时间判定，不含 Trace） |
| 22 | `src/wallpaper/managed-window.js` | `703BA70EE6C8C30BB01FB606A7BFAED3C1CC6805AB3DF510F4F244EC7FEABF1A` | B 六审 rc35-repaired 对应版（原生窗口形状归一化，不含 Trace） |

### 2.3 P1B-2 五审已审接入与分级图库文件（3 项）

| 序号 | 包内相对路径 | SHA-256 | 来源与属性说明 |
|---|---|---|---|
| 23 | `src/index.js` | `0CE08E6E8DCAE3771E737BBD864E2E07EC7159EC4F711E608311E22AC3CEAE67` | 五审冻结，导出 `inject=['webServer']`，注册 `/whale-appearance/bootstrap` 与 detachable host |
| 24 | `src/wallpaper/catalog.js` | `56EC5C6B25120446FD66E74142E775C461ECB6BA05B6EC6875504BF921E4EC61` | 五审冻结，支持 WE 分级字段解析与免读图 `verifyCatalogItemRating` |
| 25 | `src/wallpaper/library.js` | `598624207BE6AF7DD30A91AFE0400CF7AC1BD65A9CC4EE2EB351CEEABF6E5DAE` | 五审冻结，透传 signal 并暴露 `resolvePreviewRating(sceneId)` 门禁 |

### 2.4 P1B-2 五审已审新增核心模块与 Companion UI（7 项，全部为 rc.36 新增）

| 序号 | 包内相对路径 | SHA-256 | 来源与属性说明 |
|---|---|---|---|
| 26 | `src/detachable-contract.js` | `5F1BD327FEDA0B835FACFD40C14C07E809E615422E8E64187CB0B9709DBCB2D7` | [新增 1] 跨窗口协议契约、分级白名单解析、损坏偏好安全回退 Everyone |
| 27 | `src/detachable-bridge.js` | `18F17C2E82BEFBCC1A9EEECFFB681BFAD83F1704B0945AFA1E6750343669215F` | [新增 2] 主端桥接客户端、认证请求生成、SSE 同步与 50ms 动作超时 |
| 28 | `src/detachable-host.js` | `910814C8937A86DB20990162E6F55FB5100289F82737F464518402EB9932AF10` | [新增 3] 独立 HTTP 宿主、8路并发前置门禁、全生命周期3s单一超时、每次await后会话/分级重核 |
| 29 | `src/detachable-edge-adapter.js` | `651E0AD5F2A1D74A6D7B4E3AE2AB3FF69593E1C4F66E1EC25223CC56C060BC2D` | [新增 4] Edge 独立系统窗口适配器、有界启动与强身份管理 |
| 30 | `src/companion/companion.js` | `046A07957807BB8E1C8A03EA1A85B8F2C360E4FBA7E156EA38BA989841F0C0DE` | [新增 5] 吸附与独立窗口 Companion 应用，分级收紧独立 abort、三 Epoch 隔离 |
| 31 | `src/companion/index.html` | `0BE5D6C5AB4C630004A9D029DC1DB0930CC2AC80B63647F3001903C511FDC5D5` | [新增 6] 静态宿主页面、安全元标签与 DOM 挂载入口 |
| 32 | `src/companion/companion.css` | `70E08FEF78DDBDAC523195BB77DE2B927EA764AD98FD8A5B96662152F6EDE91A` | [新增 7] 独立与吸附面板样式表，无溢出响应式布局 |

### 2.5 客户端与候选元数据（3 项）

| 序号 | 包内相对路径 | SHA-256 | 来源与属性说明 |
|---|---|---|---|
| 33 | `src/client.js` | `207A8C771B70359166570FAD6A64BDF5686DD755C0FD2AE275E79680E0E580DA` | 由 rc.35 原版 client 应用 21-hunk `approved-product-client.patch` 得到，无 Trace，反向可完全恢复基底 |
| 34 | `package.json` | `6B54399008FE283DD889404016753053840E3E30A43344147DF7926F0E9C6E93` | 从 rc.35 派生，版本提升为 `0.6.0-rc.36`，白名单增加 7 项新增文件，保留 DSH 0.2.1-rc.2 依赖 |
| 35 | `README.md` | `509224F0F186394716DF74234882289EF9FC4E4278A528E71C0E9A35F71ECD63` | 最小更新说明：独立/吸附外观与分级图库候选、实验性质、实机未验声明与回退 rc.35 说明 |

---

## 3. 客户端 Patch 与零 Trace 严格验证

1. **正向应用命令与结果**：
   ```bash
   git apply --directory=.tmp/rc36-candidate-stage-20261019-38b4f10a/candidate-stage .tmp/detachable-candidate-preparation-20261019-703f459d/approved-product-client.patch
   ```
   - **退出码**：`0`（21 个 hunk 全部干净合入，无冲突，未用 `--reject` 或 `--fuzz`）。
2. **反向恢复验证（逐字节等同基底）**：
   在隔离副本中执行反向打补丁：
   ```bash
   git apply -R --directory=.tmp/rc36-candidate-stage-20261019-38b4f10a/client-patch-verify .tmp/detachable-candidate-preparation-20261019-703f459d/approved-product-client.patch
   ```
   - **退出码**：`0`。
   - 反向恢复后文件 SHA-256 为 `4B81E383D72645225ADBE4A85B31A870F998E653592F11E2E20AC4555038CD1C`，与 rc.35 基底 `client.js` **逐字节完全一致**。
3. **零 Trace 扫描**：
   对候选包内全部 35 个文件全文扫描 `cadenceTrace`、`CADENCE_CLIENT`、`cadence-trace` 等 Trace 符号，**检出次数严格为 0**。

---

## 4. 实际候选离线 QA 执行记录

全部测试通过由 `safe-qa-runner.mjs`（SHA-256 `0128591FA1C8115FEA2B4ACAF83D98E3BBB2306D284E6BE95E5EC9B17B34B66A`）监督的调度器 [run-candidate-qa.mjs](file:///F:/dsh-wallpaper-plugins/.tmp/rc36-candidate-stage-20261019-38b4f10a/candidate-qa/run-candidate-qa.mjs) 运行，所有代码路径绑定到 `candidate-stage/`，子进程均设独立超时，测试进程与服务资源在退出时确认干净释放。

```text
====================================================
   rc.36 Detachable Candidate Offline QA Suite
====================================================

>>> Running Test 1: Candidate Structure, Syntax, CSS & Whitelist Closure...
>>> [Test 1.1] Verifying 35-File Closure & Whitelist...
✓ 35-File closure and package.json metadata verified.
>>> [Test 1.2] Byte-for-Byte Preservation of rc.35 Base Assets & Native Files...
✓ Verified 20 base files preserved byte-for-byte.
>>> [Test 1.3] Verifying B-Cleanup Recovery Files...
✓ B-Cleanup recovery session.js and managed-window.js match sixth-review hashes.
>>> [Test 1.4] Running node --check on all 15 Candidate JS Files...
✓ All 15 candidate JS files passed node --check.
>>> [Test 1.5] CSS Template Literal Static Guard...
✓ CSS template guard passed: 2 templates checked, 0 errors.
>>> [Test 1.6] Strict Trace Keywords Scan Across All 35 Files...
✓ Strict Trace scan passed: 0 trace keywords found.
>>> [Test 1.7] Candidate Local Imports Closure Audit...
✓ Candidate local imports closure verified.

=== [Test 1] Candidate Structure, Syntax, CSS Guard & Whitelist ALL PASSED ===
[PASS] Test 1: Candidate Structure, Syntax, CSS & Whitelist Closure (code 0, 2026ms)

>>> Running Test 2: Candidate P0/P1B-2 HTTP & Age Rating Boundaries (U1/U2)...
>>> [Test 2.1] Contract & Action Validations on Candidate...
✓ Age rating contract and validation verified on candidate.
>>> [Test 2.2] Starting Candidate Detachable HTTP Host & Connecting Session...
✓ Authentication and Origin guards verified on candidate.
✓ Pre-fetch rating filter returned 403 with strictly 0 underlying reads.
>>> [Test 2.3] U1: 9-concurrency limit + bounded timeout + slot retention...
✓ U1 concurrency gate, bounded 3s timeout and slot retention verified.
>>> [Test 2.4] U2: Permission & Session Race Defenses...
✓ U2.1 verified: Policy tightened during Stage 1 metadata returns 403 with 0 reads.
✓ U2.2 verified: Policy tightened during Stage 3 metadata returns 403.
✓ U2.3 verified: Session replaced during Stage 3 metadata returns 403 session-invalidated.
>>> [Test 2.5] Legitimate 200 Request on Candidate Host...
✓ Legitimate 200 preview returned valid PNG binary data.

=== [Test 2] Candidate P0/P1B-2 HTTP & Age Rating QA ALL PASSED ===
[PASS] Test 2: Candidate P0/P1B-2 HTTP & Age Rating Boundaries (U1/U2) (code 0, 3596ms)

>>> Running Test 3: Candidate B-Cleanup Recovery & Proof Verification...
>>> [Test 3.1] Parser verification on invalid raw stdout...
  ✓ parser correctly rejected empty-object -> process-query-missing-process-id
  ✓ parser correctly rejected missing-pid -> process-query-missing-process-id
  ✓ parser correctly rejected invalid-row -> process-query-contains-invalid-item
>>> [Test 3.2] Strict ISO Time Equivalence & Calendar Contract...
  ✓ zero-fraction-control -> areStartUtcsEquivalent=true (expected true)
  ✓ nonzero-fraction-omitted -> areStartUtcsEquivalent=false (expected false)
  ✓ invalid-calendar -> areStartUtcsEquivalent=false (expected false)
  ✓ timezone-equivalent -> areStartUtcsEquivalent=true (expected true)
>>> [Test 3.3] Session default query and proof verification on Candidate...
  ✓ Probe case valid-control passed session lifecycle & proof verification (closed=true).
  ✓ Probe case iso-equivalent-control passed session lifecycle & proof verification (closed=true).
  ✓ Probe case zero-fraction-control passed session lifecycle & proof verification (closed=true).
  ✓ Probe case nonzero-fraction-omitted passed session lifecycle & proof verification (closed=false).
  ✓ Probe case invalid-calendar passed session lifecycle & proof verification (closed=false).
  ✓ Probe case past-birth-mismatch passed session lifecycle & proof verification (closed=false).
  ✓ Probe case foreign-location-control passed session lifecycle & proof verification (closed=false).
>>> [Test 3.4] Two Incident Replays on Candidate...
  ✓ Incident replay mode 'timeout-force-killed' successfully recovered.
  ✓ Incident replay mode 'normal-exit-missing-summary' successfully recovered.

=== [Test 3] Candidate B-Cleanup Recovery QA ALL PASSED ===
[PASS] Test 3: Candidate B-Cleanup Recovery & Proof Verification (code 0, 217ms)

>>> Running Test 4: Candidate Real Headless Edge + React + Bridge Raster Decoding...
REPORT INITIAL: {"errors":[],"images":[{"complete":true,"width":1,"src":true},{"complete":true,"width":1,"src":true}],"cards":["lucy","we-ef273cfa143cbdcd05e24324"],"startDisabled":false,"overflow":false}
PASS actual React + production authenticated bridge + HTTP + decoded images {"errors":[],"images":[{"complete":true,"width":1,"src":true},{"complete":true,"width":1,"src":true}],"cards":["lucy","we-ef273cfa143cbdcd05e24324"],"startDisabled":false,"overflow":false}
PASS actual page empty ratings no images/read {"images":0,"cards":0,"text":true,"newReads":0}
PASS actual page opt-in benign Mature fixture {"images":[{"complete":true,"width":1},{"complete":true,"width":1},{"complete":true,"width":1}],"cards":["lucy","we-a7d85024102276a2aac5d803","we-ef273cfa143cbdcd05e24324"],"errors":[]}
CLEANUP {"processResult":{"terminated":true,"exitCode":null,"signalCode":"SIGTERM"},"serverResult":{"closed":true},"hostResult":{"ok":true},"profile":"retained-in-evidence"}
[PASS] Test 4: Candidate Real Headless Edge + React + Bridge Raster Decoding (code 0, 2131ms)

>>> Running Test 5: Candidate Cordis Plugin Application & Host Route Seam...
>>> [Test 5.1] Cordis Service Dependency & Library Roots Declaration...
✓ inject and WALLPAPER_LIBRARY_ROOTS verified.
>>> [Test 5.2] Cordis Context Registration & Seam Verification...
✓ __WHALE_DETACHABLE_BOOT__ published port: 9264
✓ Authenticated bootstrap route verified: fail-closed 401 and valid 200 payload.
✓ Dispose emitted, resources cleaned up.

=== [Test 5] Local Cordis Plugin Application & Host Route Seam ALL PASSED ===
[PASS] Test 5: Candidate Cordis Plugin Application & Host Route Seam (code 0, 478ms)

====================================================
                 QA Suite Summary
====================================================
- Test 1: Candidate Structure, Syntax, CSS & Whitelist Closure: PASSED (code=0, timedOut=false, 2026ms)
- Test 2: Candidate P0/P1B-2 HTTP & Age Rating Boundaries (U1/U2): PASSED (code=0, timedOut=false, 3596ms)
- Test 3: Candidate B-Cleanup Recovery & Proof Verification: PASSED (code=0, timedOut=false, 217ms)
- Test 4: Candidate Real Headless Edge + React + Bridge Raster Decoding: PASSED (code=0, timedOut=false, 2131ms)
- Test 5: Candidate Cordis Plugin Application & Host Route Seam: PASSED (code=0, timedOut=false, 478ms)
====================================================

All rc.36 Candidate Offline QA Tests Passed Successfully!
```
- **总体退出码**：`0`
- **全套总耗时**：约 8.4 秒（各子进程均受 15s/25s 独立超时硬限监督，无无限等待，未超时）。

---

## 5. 未经验收边界与未来短验回退计划声明

1. **未经验收范围声明**：
   - 本候选包仅完成离线整合与隔离 QA 验证，**尚未在实际生产 DSH 中安装**；
   - 真实的 Windows 独立系统窗口弹出、吸附边界对齐、跨显示器拖拽、多壁纸库加载及长期资源稳定性**未作实机验收**；
   - 自动播放验证名单仍保持仅 Lucy，未扩充其他未测壁纸。
2. **未来实机短验与回退计划（仅列计划，本轮不执行）**：
   - **备份准备**：实机测试前对当前日常 5 个 Profile 及外观存储执行完整新备份；
   - **安全安装**：通过官方扩展机制离线解开候选 tgz 进行定向短验（检查独立窗口、吸附入口与 Lucy 播放）；
   - **回退机制**：若发现窗口异常或渲染停顿，立即重置并重新安装已冻结的基底版本 `release/plugins/dsh-whale-mist-0.6.0-rc.35.tgz`，完全恢复原外观状态。

---

## 6. 环境约束维持

1. **工作区环境冻结**：
   - 工作区根目录未执行打包，`package.json` 保持 `0.6.0-rc.30`；
   - 42 项受保护 assets 与历史证据未改动，现有 Git 脏改动完整保留。
2. **日常运行环境零干扰**：
   - 日常 DSH `0.2.1-rc.2 / 鲸系外观 rc.35 / Git Bash 0.1.1` 保持不动，未重启或终止 DSH/WE 进程；
   - 零外部 AI 模型 API 请求，零网络请求。
3. **任务状态**：
   - A 卷低优先级、三体/GPU 专项暂停，后台定时器维持 PAUSED。

---

**交付结论**：0.6.0-rc.36 隔离候选产物已独占写入 `release/plugins/dsh-whale-mist-0.6.0-rc.36.tgz`，全量 35 项文件审计、零 Trace 扫描及 5 组端到端离线 QA 全部通过。本轮工作在此停下，等待 Codex 独立核包。


## Codex独立核包补注（2026-10-19）

[候选离线复审通过](RC36_DETACHABLE_CANDIDATE_REVIEW_20261019.md)。rc.35实际大小为7,392,549字节；第5组mockCtx缺ctx.effect造成壁纸路由初始化降级，不能扩称真实Cordis接入，Codex已对解包候选以实际官方SDK补验通过；“零网络”不包含隔离loopback。未来短验采用当轮新备份、官方CLI安装、默认测后恢复rc.35，不能直接热覆盖或无备份重置。上述勘误不改已冻结归档，不需重建候选。
