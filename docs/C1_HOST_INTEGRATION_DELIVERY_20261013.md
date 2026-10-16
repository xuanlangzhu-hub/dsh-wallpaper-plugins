# C1 任务栏入口隐藏接入正式 Host 交付报告（第三轮复审返工补修版）

日期：2026-10-14\
交付分支/工作区：`F:\dsh-wallpaper-plugins`\
基线包版本：`0.6.0-rc.26`（日常安装仍保持 `rc.24`）\
执行原则：无真实窗口、无安装、无推送；纯自动化与隔离候选验证；交由 Codex 复审打补丁包。

---

## 1. 第三轮复审两处剩余边界补修（F1 屏障 / F2 提前停止终态）

根据 Codex 在 `docs/C1_HOST_INTEGRATION_THIRD_REVIEW_20261013.md` 中指出的两处剩余边界缺陷，已精准定位并完成最小改动补修，此前已确认通过的失败处理、父丢失检查、完整 close 等待、状态兼容、A2 选择及单次非阻塞帧策略全部保留：

### F1 剩余 / P1：建立 worker 执行前屏障，防止父进程建立监督前进入 Shell/COM 动作

1. **父侧创建同步屏障并受控授权**：
   - 在 `TaskbarWorker.cs:RealWorker` 中，在启动子进程（`_process.Start()`）前，先创建并持有跨进程命名同步事件 `_authEvent = new EventWaitHandle(false, EventResetMode.ManualReset, authName)`（名称基于 `TaskbarList.GetSupervisionAuthEventName(request.StopFile)` 派生），并在创建后强制 `Reset()`。
   - 只有在 `_process.Start()` 成功且 `JobObjectContainer.Assign(_jobHandle, _process.Handle)` 确认绑定成功后，父侧才调用 `_authEvent.Set()` 正式授权 worker 执行动作。
   - 若 `Assign` 失败（或创建失败），绝不调用 `_authEvent.Set()`，立即终止子进程并释放句柄，抛出 `InvalidOperationException`。
   - `_authEvent` 在 `RealWorker.Dispose()` 中安全释放，生命周期与 worker 托管对象完整对齐。
2. **子侧在建立监督前绝对禁止执行动作**：
   - 在 `TaskbarList.cs:RunWorkerEntry` 中，在通过 `parentProcess` 存活性与 `parentLostOrStop` 检查后，进入执行前屏障等待父侧授权事件。
   - worker 打开该同步事件，并在 8 秒超时内等待授权信号；期间每 10ms 严密轮询 `parentLostOrStop()`。
   - 若在授权前父进程丢失、绑定失败导致进程被杀、或超时未收到授权，worker 绝不进入 `RunTrace`，绝不调用 `verify()` 身份校验，绝不调用假/真 `ICalls` (`HrInit`/`DeleteTab`)，立即记录 `CallTrace.NotCalled("Verify", "parent-supervision-not-authorized-or-lost")` 并退出返回 `1`。
   - 在父侧故意延迟绑定并失败的反例调度下，假 `ICalls` 调用次数严格为 0。

### F2 回归 / P2：10 秒前停止的真实终态安全接纳与再次启动恢复

1. **正式 runtime 提前收尾产出“安全未启动”终态**：
   - 在 `qa/wallpaper-probe/TaskbarHideStrategy.cs:SettlePending` 中，当在 10 秒前被停止（`pending is null` 且尚未触发 worker，`!_attempted`），且当前处于 `observing` 或 `armed` 时，明确将 `_stage` 转换为 `stopped-before-action` 并记录说明 `"a stop was requested before the action; no button was removed"`。
   - `Finish()` 随后调用的 `WriteReport` 与 `GetSummary()` 产出终态：
     `{"stage":"stopped-before-action","attempted":false,"cleanupSafe":true,"warning":null}`。
2. **Host 端精确基于 final Summary 接纳真实未启动终态**：
   - 在 `src/wallpaper/session.js` 中更新终态判定门禁：
     ```javascript
     const validNotStarted = th.attempted === false && ['armed', 'disabled', 'stopped-before-action', 'observing'].includes(th.stage);
     const validSettled = ['action-done', 'action-failed', 'failed', 'done', 'success', 'armed', 'stopped-before-action'].includes(th.stage);
     workerCleanupSafe = Boolean(validNotStarted || validSettled);
     ```
   - 若 `th.attempted === false` 且 `th.cleanupSafe === true`，Host 充分接纳无论是 `stopped-before-action` 还是 `observing` 的真实无动作未启动终态，正常执行关源；会话安全解绑并允许后续开始。
   - 若 `th.attempted === true`，则必须进入 `validSettled` 严格列表，`observing` 绝不可混充；周期性的非 Summary 状态和 `cleanupSafe !== true` 依然全数拒绝。

---

## 2. 改动文件清单

| 文件路径 | 变更类型 | 职责与补修衔接 |
| --- | --- | --- |
| `dsh-whale-mist/qa/wallpaper-probe/TaskbarWorker.cs` | 核心补修 | `RealWorker` 创建跨进程授权事件，在 `AssignProcessToJobObject` 成功后才发送 `Set()` 授权信号；失败绝不授权并立即杀灭。 |
| `dsh-whale-mist/qa/wallpaper-probe/TaskbarList.cs` | 核心补修 | 实现 `GetSupervisionAuthEventName` 与 `RunWorkerEntry` 执行前屏障；在获得父侧确认前绝不进入 `RunTrace`/`verify`/COM 动作。 |
| `dsh-whale-mist/qa/wallpaper-probe/TaskbarHideStrategy.cs` | 核心补修 | `SettlePending` 在未触发 worker (`!_attempted`) 提前收尾时将 stage 转换为 `stopped-before-action`，产出明确的安全未启动终态。 |
| `dsh-whale-mist/src/wallpaper/session.js` | 核心补修 | `validNotStarted` 放行 `th.attempted === false && th.cleanupSafe === true` 下的 `observing` 与 `stopped-before-action`，确保提前停止干净解绑。 |
| `dsh-whale-mist/qa/wallpaper/session.test.mjs` | 测试套件 | 新增 3 项 F2 边界回归测试：零帧提前停止关源、首帧未满 10 秒停止并成功再次启动第二轮、`attempted=true` 下误带 `observing` 严格拒关。 |
| `dsh-whale-mist/qa/taskbar-hide/TaskbarRuntimeSelfTest.cs` | QA 自检 | 新增监督授权屏障自检，证明未授权时 worker 拒绝 verify 与 COM 动作并返回退出码 1。 |

---

## 3. 隔离候选构建与二进制指纹

### 3.1 构建命令
```powershell
dotnet publish dsh-whale-mist\qa\wallpaper-probe\WallpaperProbe.csproj `
  -c Release -r win-x64 --self-contained false `
  -o F:\dsh-wallpaper-plugins\.tmp\c1-host-integration-20261014-delivery\candidate
```

### 3.2 候选文件 SHA-256 指纹

| 产物文件 | 字节大小 | SHA-256 散列值 |
| --- | --- | --- |
| `WallpaperProbe.exe` | 162,304 | `C2727F2BAD7CA64F97059BE781F4E2DE5214440BD94B704D58993FD0A1C12731` |
| `WallpaperProbe.dll` | 230,912 | `D7DF61786F62DEA6F2DD478863E436D8B123746B1CA621379523C0B179F5F947` |
| `WallpaperProbe.deps.json` | 4,947 | `8356139AA4F13D3C11051CEB2DF5C22B1AC7F9A0E87CDAE003095960698EEB95` |
| `WallpaperProbe.pdb` | 46,164 | `1AE7FA57151DD0E753DB8E795B5B93D28F9C8367C1F5255529275F7C9D37CB92` |
| `WallpaperProbe.runtimeconfig.json` | 399 | `3E965CD7CFD553C2FF4E842D8D8019AAAE2DA0A21D92FF85A87573DD8D1B95C6` |

---

## 4. 受保护基线文件完整性核验

对 14 个受保护文件进行 SHA-256 核对，证明**未篡改任何线上运行资源、发布包或用户配置**：

| 文件路径 | 预期 SHA-256 | 实际状态 |
| --- | --- | --- |
| `dsh-whale-mist/src/client.js` | `4BD16FB8DBB4D3D135EFF8300EE71F0B25C6078174AC6846BAF325EFA4422182` | 一致 (MATCH) |
| `dsh-whale-mist/qa/wallpaper-probe/SourceWindowHelper.cs` | `2D62AE434B16C9090535F432EAF4BA49B06233DA13EEEE57A546BA1132561785` | 一致 (MATCH) |
| `dsh-whale-mist/assets/wallpaper/WallpaperProbe.exe` | `F172D2BC60701ADB4479E2E12EE296799F149B09B80C3EE3B5731F5EA30AE117` | 一致 (MATCH) |
| `dsh-whale-mist/assets/wallpaper/WallpaperProbe.dll` | `D7353A75665DCCD9D6263C10FE3CFC18D176572EBBE0AED2B4A1691D5DF39968` | 一致 (MATCH) |
| `release/plugins/dsh-whale-mist-0.6.0-rc.24.tgz` | `86021352502A1DBBD76B0A0B6D4B831967D3A271FA9D61E7F9C5CF01A61B6B02` | 一致 (MATCH) |
| `release/plugins/dsh-whale-mist-0.6.0-rc.26.tgz` | `30FD0E23571D7ED6F8D197CC5FBFCBA2111985E16D6F7FE2B35A35871C430E9C` | 一致 (MATCH) |
| `C:\Users\HP\.dsh\profiles\desktop\cordis.yml` | `C300DCF2EBC5F02062D6591268D29D3DB6FE45E0CB138F5467276FE2BA06076E` | 一致 (MATCH) |
| `C:\Users\HP\.dsh\profiles\desktop\cordis.patch.yml` | `5927127F641BBDF84D7944B1B82FFB8442B5570923F054FD64C0FDB1A6544285` | 一致 (MATCH) |
| `C:\Users\HP\.dsh\profiles\desktop\package.json` | `FE705C25E87C33059408EED06AA203454274F07E2DFC8D34D8FEDC4845BAE71D` | 一致 (MATCH) |
| `C:\Users\HP\.dsh\profiles\desktop\pnpm-lock.yaml` | `AAA14BF823AE447331104CAA21F4995C400C750A60F3D60B330F76EE868180DF` | 一致 (MATCH) |
| `C:\Users\HP\.dsh\profiles\desktop\pnpm-workspace.yaml` | `AE7C5B68E2F157528E62885804E69E88583897B775E03C86FCBE52FEAF498ABA` | 一致 (MATCH) |
| `C:\Users\HP\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe` | `DF4E91FD91F6F1BEE19A1990B0E167BFE06ABF8353279D82BBB8E60EDB6BA0D3` | 一致 (MATCH) |
| `E:\SteamLibrary\steamapps\common\wallpaper_engine\wallpaper64.exe` | `DA37927FC77151429406EDE43011A879798468C104D3D3801EAED5BFC045443A` | 一致 (MATCH) |
| `C:\Users\HP\.dsh\profiles\desktop\node_modules\dsh-whale-mist\package.json` | `ED62B47259988941BD66D00430904E3F434876A3B0BD8C967170CF9BF678C650` | 一致 (MATCH) |

*证明：14/14 受保护文件散列值 100% 吻合。*

---

## 5. 验证测试执行结果与退出码

| 测试套件 / 命令 | 执行目标 | 退出码 | 结果与通过率 |
| --- | --- | :---: | --- |
| `npm run check` | JS 语法、路由与 CSS 模板守卫检查 | 0 | **通过** (7 个文件检查合格) |
| `npm run test:wallpaper-host` | Host 全套生命周期与 F1/F2/F3 回归测试 | 0 | **105 / 105 通过** (新增 3 项 F2 提前停止与重启回归) |
| `npm run test:sdk-contract` | Cordis SDK 协议与路由注册离线契约测试 | 0 | **通过** (routesRegistered: true, status: 200) |
| `node qa/taskbar-hide/build.mjs` | 共用文件引用隔离构建测试 | 0 | **通过** (`acceptedUnchanged: true`) |
| `WallpaperProbeTaskbarQa.exe --taskbar-self-test` | 任务栏隐藏原生单元与策略自检 | 0 | **113 / 113 通过** (新增 1 项 F1 未授权启动屏障自检) |
| `check-generated.mjs` | 19 种原生生命周期作用域与故障门禁 | 0 | **19 / 19 通过** |
| `check-worker.mjs` | 5 种控制台假工作进程终止与迟到动作阻断 | 0 | **5 / 5 通过** (`lateActions: 0`, `realShellActions: 0`) |

### 5.1 F1 监督失败与启动屏障对照结果

| 故障注入场景 (`C1_JOB_FAULT`) | worker 是否启动 | verify 身份回调是否执行 | 假 ICalls / COM 动作次数 | 最终结果 |
| --- | :---: | :---: | :---: | --- |
| 正常绑定 (`none`) | 是 | 是 | 1 (after-binding) | 正常授权并执行 |
| 创建容器失败 (`create`) | 否 (启动前拒绝) | 否 (0 次) | 0 次 | `Started=false, CleanupSafe=true` |
| 立即绑定失败 (`assign`) | 立即终止 | 否 (0 次) | 0 次 | `Started=true, Terminated=true, CleanupSafe=true` |
| 延迟绑定失败 (`startup`) | 屏障拦截并终止 | **否 (0 次)** | **0 次** | `Started=true, Terminated=true, CleanupSafe=true` (动作发生前已被屏障完全拦截) |

### 5.2 F2 10 秒内提前停止对照结果

| 测试场景 | 生产 Runtime 输出 stage | Host 校验结果 | 关源调用次数 | 重新开始状态 |
| --- | --- | :---: | :---: | --- |
| 零帧提前停止 | `stopped-before-action` (或 `observing`) | 安全放行 | 1 次 (`closed: true`) | 会话正常解绑 |
| 首帧提前停止（<10s） | `stopped-before-action` | 安全放行 | 1 次 (`closed: true`) | 会话正常解绑 |
| 提前停止后再次启动下一轮 | 第 1 轮停止后立即 `create` 第 2 轮 | 安全放行 | 2 次 (每轮各 1 次) | 第二轮成功启动并正常关闭 |
| attempted=true 却为 observing | `observing` | **严格拒关** | 0 次 (`closed: false`) | 阻断关源，报 `worker-unconfirmed` |

---

## 6. 证据目录与产物位置

- 本轮候选产物目录：`F:\dsh-wallpaper-plugins\.tmp\c1-host-integration-20261014-delivery\candidate`
- QA 编译与执行日志：`F:\dsh-wallpaper-plugins\.tmp\c1-host-integration-20261014-delivery\qa-build`
- QA 自检报告：`F:\dsh-wallpaper-plugins\.tmp\c1-host-integration-20261014-delivery\qa-selftest.json`
- 第三轮复审反例基线：`F:\dsh-wallpaper-plugins\.tmp\c1-host-third-review-20261013-ec2619b1`

---

## 7. 暂未执行 / 交付 Codex 复审事项

按指令与复审要求严格保持约束，本次编码补修阶段**严禁越权**：
1. **不修改 `package.json` 版本号**：仍保留 `0.6.0-rc.26`。
2. **不覆盖资产与发布包**：未改动 `assets/wallpaper/WallpaperProbe.*` 与 `release/plugins/*.tgz`。
3. **不做实机独立运行**：未在真实桌面打开任何可见窗口。
4. **不进行 Git 提交或推送**。
