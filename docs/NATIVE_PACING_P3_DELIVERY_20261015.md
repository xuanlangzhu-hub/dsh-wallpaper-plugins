# 原生采集节奏局部观测 (P3) 交付记录

- **交付日期**: 2026-10-15
- **任务依据**: [GEMINI_NEXT_NATIVE_PACING_P3_20261015.md](GEMINI_NEXT_NATIVE_PACING_P3_20261015.md)
- **复审依据**: [NATIVE_PACING_P3_REVIEW_20261015.md](NATIVE_PACING_P3_REVIEW_20261015.md) (Codex 复审 R1–R3 修补)
- **对应前序基线**: [COMPLEX_SCENE_P2_FOREGROUND_RESULT_20261015.md](COMPLEX_SCENE_P2_FOREGROUND_RESULT_20261015.md)
- **工作区**: `F:\dsh-wallpaper-plugins`
- **日常基线**: 严格保留 `0.6.0-rc.28`，不改动生产包、不改调度策略、不改动视频流水线、不作提高帧率承诺。
- **构建隔离**: 仅在独立目录 `F:\dsh-wallpaper-plugins\.tmp\p3-probe-build\` 中生成调试探测二进制，未覆盖 `dsh-whale-mist/assets/wallpaper/` 下的生产程序。

---

## 1. 任务背景与三个待检验假设

在 P2 实测（1302×776，目标 30fps，前台静止/鼠标两段原生 21.49 / 21.56 fps）中，观测到原生采集循环的平均完整连续输出间隔为 46.54ms / 46.38ms，而 `encodeMs`（含 CPU 读回与 JPEG 编码）仅为 13.98ms / 15.93ms，剩余约 30~32ms 间隔余量。

本轮 P3 实施高精度的单调时钟观测，专门解耦并量化以下三个假设：
1. **调度恢复偏差 (Scheduling Discrepancy)**: `Task.Delay` 请求等待时间与系统计时器实际恢复时钟的偏差（`actualWait - requestedWait`）。
2. **记录后与状态发布工作 (Post-Record Work)**: 帧编码完成且 `record` 组装完成之后、进入等待前的额外工作（包括 `log.FlushAsync`、`status.json` 原子发布、窗口状态检查等），以及状态发布帧与普通帧的耗时差异。
3. **WGC 空帧重试与供帧节奏 (WGC Empty Frame Retries)**: `TryGetNextFrame() == null` 时触发的重试计数与等待耗时，严格与正常 pacing 等待解耦。

---

## 2. 复审补修 (R1–R3) 实施说明

根据 Codex 复审报告 [NATIVE_PACING_P3_REVIEW_20261015.md](NATIVE_PACING_P3_REVIEW_20261015.md)，本轮集中修补了 R1–R3 三处：

### R1：恢复原等待截断算法与即时工作扣除
- **原问题**: 首轮实现将等待请求改为了 `Math.Round` 四舍五入，并用 `beforeSleep` 取代了等待点即时读取的时钟，导致调度请求算法偏离既有实现。
- **修正**:
  1. 在 `NativePacingTracker.cs` 中实现 `ComputePacingRequested(int fps, double elapsedSinceStartMs)`，严格恢复原 `(int)` 截断与 `Math.Max(1, ...)` 规则：
     $$\text{pacingRequested} = \max(1, \lfloor 1000.0 / \text{fps} - \text{elapsedSinceStartMs} \rfloor)$$
  2. 在 `Program.cs` 等待发生点即时读取 `elapsedBeforeWait = clock.Elapsed.TotalMilliseconds - start`，确保等待预算计算口径与既有基线 100% 一致。
  3. 增加数值控制回归，锁定非整数边界的截断输出：30fps 下 15.6ms $\to$ 17ms，15.3ms $\to$ 18ms，17.8ms $\to$ 15ms，34.0ms $\to$ 1ms。

### R2：修复样本过滤逻辑，严禁因个别字段异常掩盖回退
- **原问题**: 分析器此前在进入段分析时使用 `samples.filter(s => typeof p?.pacingWaitCount === 'number')`，当中间样本的 `pacingWaitCount` 异常（经 `sanitizeStatus` 转为 `null`）时整条样本被过滤，导致该样本中发生的计数回退（如 `postRecordCount: 0`）被跳过未检，段仍被误判为有效。
- **修正**:
  1. 区分“旧 helper 日志无 P3 对象”与“P3 日志存在但字段缺失/错误”：若全段没有任何 pacing 字段，则按旧日志兼容处理（`available: false, valid: false`，不阻断段有效性）；
  2. 若段内存在 P3 pacing 支持，则严格保留所有 `validStatusSamples`；
  3. 遍历全部有效状态样本，若任何样本缺少必需计数或存在非有限数/负数，标记 `hasInvalidPacingMetric = true`；
  4. 遍历所有相邻样本对进行单调性校验，若检测到计数减小，标记 `pacingRollback = true`；
  5. 出现回退或异常时，`nativePacing.valid = false`，记录具体原因（`native_pacing_counter_reset` 或 `native_pacing_invalid`），将段标为 `valid = false`，抑制 `comparison.nativePacingDeltas`（赋值为 `null`），并置 `dataReady = false`。
  6. 在 `check-native-pacing.mjs` 中完整引入 Codex 复现反例作为永久回归用例。

### R3：补充测量接缝注入、实际二进制端到端核验与固定 SHA-256 资产防护
- **原问题**: 此前测试主要使用 JS 手造计数，CLI 自测未执行新增计时代码，资产保护断言仅比较了 mtime。
- **修正**:
  1. 在 `NativePacingTracker.cs` 中抽取小型可注入测量方法：`ExecutePacingWaitAsync`、`ExecuteEmptyRetryWaitAsync`、`MeasurePostRecord`，原生循环主流程与测试调用同一套底层方法；
  2. 为 `WallpaperProbe` 增加 `--self-test-native-pacing <outDir>` CLI 诊断入口，在真实 C# 环境中注入虚拟单调时钟，验证请求 10ms / 实际 25ms、记录后 20ms / 总工作 35ms、3 次空帧重试（请求 2ms / 实际 5ms）、状态帧落盘与 Summary 输出，原子写入真实 `status.json` 与 `summary.json`，并通过 `ProbeJournal` 发送 Status/Summary 日志；
  3. 在 `check-native-pacing.mjs` Test 5 中执行该真实二进制，捕获并解析其输出，经由真实 `sanitizeStatus` 和 `analyzePlayback` 运行段分析，确认分析器准确得出 10ms / 25ms / 偏差 +15ms 等数值；
  4. 资产保护升级为固定 SHA-256 哈希校验：验证 `dsh-whale-mist/assets/wallpaper/WallpaperProbe.dll` 严格等于基线哈希 `1B33B274593259BD5F913469A7202F454ED48B9B3E08A44CF470781B9E255A2E`，且与隔离构建文件哈希严格不相等。

---

## 3. 修改文件清单与 SHA-256 指纹

| 文件路径 | 修改类型 | 职责与变更说明 |
|---|---|---|
| `dsh-whale-mist/qa/wallpaper-probe/NativePacingTracker.cs` | 新增核心辅助类 | 封装单 run 专有、有界的原生节奏统计追踪器，维护 22 项累加计数与最大值；提供 `ComputePacingRequested`（R1 截断）、可注入时钟的 `ExecutePacingWaitAsync` / `ExecuteEmptyRetryWaitAsync`，以及 `--self-test-native-pacing` 离线校验实现。 |
| `dsh-whale-mist/qa/wallpaper-probe/Program.cs` | 核心循环埋点 | 1. 接入 `pacingTracker.ExecuteEmptyRetryWaitAsync`；<br>2. 接入 `pacingTracker.MeasurePostRecord`；<br>3. 在等待点即时计算 `elapsedBeforeWait` 并调用 `ExecutePacingWaitAsync`，恢复 R1 截断规则；<br>4. CLI 入口增加 `--self-test-native-pacing`。 |
| `dsh-whale-mist/qa/perf/watch-playback.mjs` | 观测采样器 | 在 `sanitizeStatus` 与 `sanitizePreviewStatus` 中增加 `sanitizePacing` 校验，解析并安全保留 22 项 pacing 计数，缺字段保持 `null`，非有限数值/负数抛出 `BadInput`。 |
| `dsh-whale-mist/qa/perf/analyze-playback.mjs` | 离线分析器 | 1. 修复 R2 样本过滤缺陷：遍历全部状态样本检测缺失/非法指标与跨样本回退，回退时将段与 pacing 均标为无效，并抑制 `nativePacingDeltas`；<br>2. 初始化 `comparison.nativePacingDeltas = null`；<br>3. 准确计算段均值、实际等待偏差 `discrepancyMs` 与节奏步调 FPS `cadenceFps`；<br>4. 报告渲染：在 Section 2 渲染“原生采集节奏与延迟分解 (P3 Native Pacing)”表格，在 Section 5 Diff 中渲染节奏差值对比表。 |
| `dsh-whale-mist/qa/perf/check-native-pacing.mjs` | 专项验收套件 | 覆盖 5 大类测试，包含 R1 截断表回归、R2 缺失计数隐藏回退反例回归、R3 C# 自测执行与端到端分析接缝验证，以及生产资产固定 SHA-256 完整性断言。 |

### 源码与隔离构建 SHA-256 指纹

```text
Hash : A93EB92582A2139D3821075B8AC1DE84CAD5982DD6CDDC02149BAE36373886CD
Path : F:\dsh-wallpaper-plugins\dsh-whale-mist\qa\wallpaper-probe\NativePacingTracker.cs

Hash : BF0FE0F661B385DB78F053D66120A0542AA1D2638DD2E3E3613814C2A962FC1C
Path : F:\dsh-wallpaper-plugins\dsh-whale-mist\qa\wallpaper-probe\Program.cs

Hash : C7F918CF2E1DD47C6905263BE4E070463FF6C0E796EFDFF360052FBF995C4AF1
Path : F:\dsh-whale-mist\qa\perf\watch-playback.mjs

Hash : 314F1FBA51F099C5BFEBBD001B50F7CED1835A86B60E1467C9A17F5A5663E812
Path : F:\dsh-wallpaper-plugins\dsh-whale-mist\qa\perf\analyze-playback.mjs

Hash : F7744C5F3F1CA7D2BAFAA2CAA8751653CF63CD9760849833DBB184A3ECDF5AD2
Path : F:\dsh-wallpaper-plugins\dsh-whale-mist\qa\perf\check-native-pacing.mjs

Hash : FD8AB2500F41525F7244CD4B7E72D58D6598259549829C7896C2AB01495C4071
Path : F:\dsh-wallpaper-plugins\.tmp\p3-probe-build\WallpaperProbe.dll

Hash : C2727F2BAD7CA64F97059BE781F4E2DE5214440BD94B704D58993FD0A1C12731
Path : F:\dsh-wallpaper-plugins\.tmp\p3-probe-build\WallpaperProbe.exe
```

### 生产资产完整性指纹 (Assets Baseline Preservation)

```text
Hash : 1B33B274593259BD5F913469A7202F454ED48B9B3E08A44CF470781B9E255A2E
Path : F:\dsh-wallpaper-plugins\dsh-whale-mist\assets\wallpaper\WallpaperProbe.dll
```

---

## 4. 指标契约与字段定义 (共 22 项累计/极值键)

原生探测器通过 `status.json`、`summary.json` 以及 `record` 上报完整的 `pacing` 字段对象（共 22 个键）：

```json
{
  "pacingWaitCount": 0,
  "pacingWaitRequestedSumMs": 0,
  "pacingWaitRequestedMaxMs": 0,
  "pacingWaitActualSumMs": 0,
  "pacingWaitActualMaxMs": 0,
  "postRecordCount": 0,
  "postRecordSumMs": 0,
  "postRecordMaxMs": 0,
  "statusPublishCount": 0,
  "statusPublishSumMs": 0,
  "statusPublishMaxMs": 0,
  "emptyRetryCount": 0,
  "emptyWaitRequestedSumMs": 0,
  "emptyWaitRequestedMaxMs": 0,
  "emptyWaitActualSumMs": 0,
  "emptyWaitActualMaxMs": 0,
  "cycleIntervalCount": 0,
  "cycleIntervalSumMs": 0,
  "cycleIntervalMaxMs": 0,
  "totalWorkCount": 0,
  "totalWorkSumMs": 0,
  "totalWorkMaxMs": 0
}
```

### 计时区间边界说明

- `encodeMs`: 单帧捕获开始（`start`）到图像写入/哈希完成的时长（管道模式下 pipe 发送已在此前完成）。
- `recordAssembledAt`: `record` 对象组装完成的单调时间戳。
- `postRecordMs`: 从 `recordAssembledAt` 到 `beforeSleep`（进入 `Task.Delay` 前）的耗时。包含日志追加、状态帧 `status.json` 发布、TaskbarHide 检查与交换链尺寸重建等。
- `totalWorkMs`: 从循环起点 `start` 到 `beforeSleep` 的总活动耗时。注意：由于中间包含 `record` 组装及日志开销，`totalWorkMs` 在数值上通常略大于 `encodeMs + postRecordMs`。
- `pacingWaitRequestedMs`: 等待发生前即时计算的请求值 $\max(1, \lfloor 1000.0 / \text{fps} - (\text{now} - \text{start}) \rfloor)$。
- `pacingWaitActualMs`: `await Task.Delay` 前后单调秒表实际测得的时长。
- 偏差: 分析器求出 $\text{discrepancyMs} = \text{meanActualMs} - \text{meanRequestedMs}$。

---

## 5. 验收测试执行结果

在 `F:\dsh-wallpaper-plugins\dsh-whale-mist` 下执行完整回归验证套件：

1. **语法与静态检查**:
   - `npm run check`: **0 errors**, 通过。
2. **C# 隔离生成**:
   - `dotnet build qa/wallpaper-probe/WallpaperProbe.csproj -c Release -o ../../.tmp/p3-probe-build`:
     - **0 个警告，0 个错误**。
3. **P3 专项验收测试 (`check-native-pacing.mjs`)**:
   - Test 1 (10ms vs 25ms 请求/实际等待分离与偏差 +15ms): **PASSED**
   - Test 2 (+20ms 记录后工作与连续 3 次空帧重试解耦): **PASSED**
   - Test 3 (零值 null 语义、异常负数门禁、R1 截断表回归、R2 缺失计数隐藏回退反例回归): **PASSED**
   - Test 4 (端到端观察器到分析器管道与 Markdown 生成): **PASSED**
   - Test 5 (真实 WallpaperProbe.exe 执行 `--parse-check`、`--self-test-lifecycle`、`--self-test-native-pacing`，端到端落盘与分析器数值接缝验证，资产固定 SHA-256 完整性): **PASSED**
4. **全量回归**:
   - `npm run test:wallpaper-host`: **105/105 passed** (0 fail)。
   - `node qa/perf/check-playback.mjs`: **9/9 categories passed** (含全部历史反例)。
   - `node qa/perf/check-compare.mjs`: **40/40 passed**。
   - `node qa/perf/check-frontend-stages.mjs`: **10/10 passed**。

---

## 6. 保留边界与承诺遵守

- [x] **rc.28 日常基线保持**: 未修改生产安装包，未修改 `assets/` 生产二进制（SHA-256: `1B33B274...`），未修改用户配置。
- [x] **未改动调度算法**: R1 已完全恢复原 integer 截断及等待点即时计算。
- [x] **不破坏既有前端 P2 阶段指标**: 前端 36 项指标字段、Markdown 结构及既有校验全部无损保留。
- [x] **不更改原生策略与运行环境**: 未调整 30fps 目标、JPEG 格式、采集尺寸，未请求 `timeBeginPeriod`，未引入自旋/忙等，未修改 GPU 驱动或全局设置。
- [x] **不擅自启动真实桌面或真实壁纸**: 纯离线与隔离构建验证，无未决后台进程。
- [x] **未执行 git commit 或 git push**。

---

## 7. 后续建议

R1–R3 均已修复并通过专项反例回归与全套工程测试。代码已就绪，可供 Codex 进行下一轮复审。复审通过后，可根据安排进行后续的受控短实机验证。
