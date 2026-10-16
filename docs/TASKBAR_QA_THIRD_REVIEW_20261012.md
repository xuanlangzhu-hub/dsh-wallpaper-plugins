# C1 QA 第三轮复审：自检通过不等于桌面效果通过，R1–R3 实际入口反例审查

2026-10-12，Antigravity。复审 Codex 对 C1 隔离 QA 工具（`dsh-whale-mist/qa/taskbar-hide/`）的 R1–R3 修复成果与接续记录（`docs/TASKBAR_QA_REPAIR_20261012.md`）。
**本轮原则：日常 rc.24 严格保留；完全离线复核与验证，未安装、未开真实窗口、未调用真实 Shell/WE、未提交/未推送。**

---

## 一、复审结论与测试复跑现状

本轮在全新独立输出目录 `F:/dsh-wallpaper-plugins/.tmp/taskbar-review-20261012-173600/` 下完成编译与离线回归：

| 检查项 | 命令 / 来源 | 运行结果 | 说明与边界 |
| --- | --- | --- | --- |
| 隔离编译 | `node qa/taskbar-hide/build.mjs` | **退出码 0** | accepted 源码与资产 13 项 SHA256 哈希完全一致 |
| 策略自检 | `WallpaperProbeTaskbarQa.exe --taskbar-self-test` | **88/88 PASS** | 全部基于 FakeProbe / FakeAction / FakeCalls 假边界 |
| 生成入口检查 | `node qa/taskbar-hide/check-generated.mjs` | **8/8 PASS** | 合成桩代码验证外层 try/finally 骨架 |
| 子进程监控检查 | `node qa/taskbar-hide/check-worker.mjs` | **4/4 PASS** | 真实控制台子进程生命周期，使用无窗口 FakeCalls |

**核心结论**：
100 项离线自检与检查脚本确实全部通过，但深入分析真实生成入口代码、进程通信与执行路径后确认：
**“检查通过不等于桌面效果通过”**。
现存测试在多处使用了简化 mock 与合成代码，掩盖了真实入口下的关键逻辑漏洞；本轮抓出 **R1 初始化清理间隙**、**R2 stdin 停止信号无法跨进程传播**、**R3 失败阶段死代码硬编码（归因错误）** 等具体反例。

---

## 二、核心事实：“检查通过不等于桌面效果通过”

当前 88 项自检与 12 项回归测试全绿，但它们只验证了策略状态机和进程监视器的离线抽象，**不证明任何实际桌面视觉效果**：

1. **视觉字段在报告中恒为 `null`**：
   在 `TaskbarHideStrategy.cs`（L331–L332）中，`taskbarHidden` 与 `altTabHidden` 永远输出为 `null`。即使底层 COM 返回 `S_OK (0x00000000)`，自动化工具也无法判断真实任务栏按钮是否消除，必须依赖人工桌面观察。
2. **`ITaskbarList::DeleteTab` 的桌面天然局限**：
   - **Alt+Tab 毫无隐藏效果**：`DeleteTab` 仅向 Explorer 的 `Shell_TrayWnd` 投递移除任务栏 Tab 的异步通知，窗口的 `WS_EX_APPWINDOW` 扩展样式并未改变，在 `Alt+Tab` 切换面板中依旧完全可见。
   - **Explorer 重启与崩溃恢复**：当 Windows Explorer 重启（或触发 `TaskbarCreated` 消息时），Explorer 会重新枚举并重建所有顶层窗口的任务栏按钮，此前的 `DeleteTab` 效果立即失效。
   - **多显示器副任务栏**：Windows 10/11 的副屏任务栏（`Shell_SecondaryTrayWnd`）机制复杂，单次 DeleteTab 是否在多屏全部生效并未得到多屏环境验证。
   - **窗口样式重绘与激活**：Wallpaper Engine 播放期间若调用了 `ShowWindow`、更新窗口标题或重设位置，Explorer 可能重新将按钮加回任务栏。

---

## 三、R1 初始化清理：实际入口反例与证据

### 反例 R1-A：`TakeOwnership()` 接管时机存在间隙，初始化早期失败导致真实探测窗口孤立泄漏
- **代码位置**：`generated/Program.cs`（L38 与 L145）、`TaskbarQaRuntime.cs`（L94–L98）
- **机理还原**：
  在生成的 `Program.cs` 中，`taskbarQa` 实例在最前端被创建（L38），但所有权标记 `TakeOwnership()` 却被硬编码注入在很靠后的位置（L145）：
  ```csharp
  // L38: 创建 runtime 并生成 taskbar-action.json 占位文件
  taskbarQa = TaskbarQaRuntime.Create(taskbarOptions, args, acceptedRequest);
  Native.EnsureDefaultDesktop();
  ...
  // L145: 实际标记所有权接管
  taskbarQa?.TakeOwnership();
  var hwnd = (nint)handle;
  ```
  如果程序在 L38 至 L145 之间发生任何异常（例如 `Native.EnsureDefaultDesktop()` 失败、标准输出管道打开失败、或输出目录校验异常）：
  - 异常被最外层捕获并落入最外层 `finally { taskbarQa?.Finish(); }`；
  - 在 `Finish()` 中，由于 `_ownsSource` 仍为 `false`，执行如下分支并直接返回：
    ```csharp
    if (!_ownsSource)
    {
        _strategy.RecordCleanup(new { outcome = "not-owned", closed = (bool?)null });
        WriteReport();
        return;
    }
    ```
- **实际后果**：
  外部测试宿主在运行 probe 之前拉起的真实 WE 探测窗口（`WhaleWallpaperProbe-...`）**完全不会被调用关闭**（closeCalls = 0）。探测窗口在桌面上孤立泄漏，而报告却写成 `outcome: "not-owned", closed: null` 并成功退出清理流程。
- **反例物料验证**：
  隔离测试 `early-initialization-failure-leaves-window-unclosed` 证实：在未调 `TakeOwnership()` 时发生退出，`closesCount == 0`，`probe.Exists == true`。

### 反例 R1-B：`check-generated.mjs` 8 个故障场景测试使用合成桩，与真实生成代码脱节
- **代码位置**：`check-generated.mjs`（L48–L56）
- **机理还原**：
  脚本声称通过了 8 个阶段（`CreateDevice`, `CreateItem`, `FramePool`, `Session`, `StartCapture`, `Publication`, `Stop`, `Normal`）的异常覆盖，但它**根本没有运行实际生成的 `Program.cs`**。它只是截取了文件首尾的 try/finally 字符串，并在中间硬拼接了一段 10 行的合成测试：
  ```csharp
  taskbarQa = TaskbarQaRuntime.CreateOffline(...);
  taskbarQa.TakeOwnership();
  if (phase != "Normal") throw new IOException("fake " + phase + " failure");
  ```
  所有 7 种异常均在同一行抛出同一个假 `IOException`，且在抛错前**人工强制调用了 `TakeOwnership()`**。这完全掩盖了 R1-A 中存在的生命周期接管间隙，自检通过无法代表真实环境下的初始化清理健壮性。

---

## 四、R2 worker 退出确认与停止传播：实际入口反例与证据

### 反例 R2-A：stdin 停止信号无法跨进程传播至子进程，父进程依赖外部强杀（Kill）
- **代码位置**：`generated/Program.cs`（L136–L148）、`TaskbarQaRuntime.cs`（L151）
- **机理还原**：
  在日常及管道模式下，宿主通过 stdin 管道发送 `"stop"` 字符串指令，父进程捕获后在进程内存中标记 `stopSignal.Cancel()`。
  然而，执行 COM 调用的 worker 是一个完全独立的控制台子进程（`WallpaperProbeTaskbarQa.exe --taskbar-worker ...`），其在 `RunWorkerEntry` 内部的停止判断委托仅为：
  ```csharp
  () => File.Exists(args[5]) || (Native.GetAsyncKeyState(0x1B) & 0x8000) != 0
  ```
  子进程**仅监视磁盘上的 `stop.txt` 和物理键盘 Esc 键**！
- **实际后果**：
  - 当父进程从 stdin 接收到 `"stop"` 信号时，磁盘上并未生成 `stop.txt`，物理 Esc 键也未被按下，子进程内部的 `stopRequested()` **永远为 `false`**。
  - 父进程在 `TaskbarWorker.Run` 的监视循环中检测到 `stopRequested()`，进而执行 `worker.Kill()` 暴力强杀子进程。
  - 这**不是“停止信号在 worker 内部协作传播与安全退出”**，而是父进程从外部硬性中断。如果此时子进程正好卡在 Explorer 的 `DeleteTab` COM 交互内部，强杀可能导致 COM 通信未完成或留下脏状态。
  - `check-worker.mjs` 测试全绿是因为它的测试用例仅验证了父进程能检测到超时/取消并确认 PID 退出，并未覆盖真实 stdin 管道下的停止信号跨进程传递。

### 反例 R2-B：真实 worker 进程内包含四重全系统窗口枚举（EnumWindows）与高开销进程检查
- **代码位置**：`TaskbarQaRuntime.cs`（L144–L148）、`TaskbarList.cs`（L134–L146）
- **机理还原**：
  在真实的 `--taskbar-worker` 入口中，每次 `verify()` 均执行一次 `probe.Inspect(hwnd)`：
  1. `SourceWindowHelperQa.FindExactTitle` 调用一次 `EnumWindows` 全局枚举并过滤所有匹配项；
  2. `SourceWindowHelper.VerifyExpectedWindow` 再次调用 `EnumWindows` 进行全系统二次枚举；
  3. 在 `ExecuteCalls` 共同流程中，`HrInit()` 调用前执行一次 `verify()`（2 次全局枚举），`HrInit()` 成功后、调用 `DeleteTab()` 之前**再次执行一次 `verify()`**（又是 2 次全局枚举）。
- **实际后果**：
  在真实桌面环境（存在数十至数百个顶层窗口）下，worker 进程为了执行一次 `DeleteTab`，在同一线程上连续进行了 **4 次全系统窗口枚举 + 进程对象句柄打开**。
  而 `check-worker.mjs` 中仅使用了耗时为 0 的内存打桩类 `FakeCalls`，完全掩盖了真实桌面下 worker 内部的耗时抖动以及与父进程 50ms 轮询发生超时竞争的风险。

---

## 五、R3 报告写失败与 HRESULT 完整性：实际入口反例与证据

### 反例 R3-A：失败阶段（failure.stage）死代码硬编码为 `"delete-tab"`，发生归因错误
- **代码位置**：`TaskbarHideStrategy.cs`（L267 与 L276）
- **机理还原**：
  在 `TaskbarHideStrategy.cs` 的 `OnFrame` 决策逻辑中：
  ```csharp
  if (!execution.CleanupSafe)
  {
      _stage = "action-unconfirmed";
      _failure = new { stage = "delete-tab", message = action.Error, hresult = $"0x{action.Hresult:X8}" };
      ...
  }
  if (!action.Succeeded)
  {
      _stage = "action-failed";
      _failure = new { stage = "delete-tab", message = action.Error, hresult = $"0x{action.Hresult:X8}" };
      _notes.Add("DeleteTab failed once; it is not retried and no AddTab/owner fallback is attempted");
  }
  ```
  注意：无论实际是在哪一个子阶段发生失败（例如 worker 启动失败、worker 超时、`Verify` 前置或后置校验失败、`HrInit` 失败）：
  - 报告中的 `failure.stage` **恒被硬编码为 `"delete-tab"`**！
  - 报告中的 `notes` **恒追加 `"DeleteTab failed once; it is not retried..."`**！
- **反例物料验证**：
  在隔离反例工程 `counterexamples.json` 中，我们模拟注入了“`HrInit` 成功（0x00000000），但随后复核发现窗口已最小化或不可见（`Verify` 失败返回 0x80070057 E_INVALIDARG）”的场景：
  ```json
  {
    "name": "post-hrinit-verify-failure-stage-misattributed",
    "deleteTabCalled": false,
    "actionCall": "Verify",
    "reportedFailureStage": "delete-tab",
    "notes": [
      "DeleteTab failed once; it is not retried and no AddTab/owner fallback is attempted"
    ],
    "contradiction": true,
    "detail": "When post-HrInit verification fails, DeleteTab is never called, but failure.stage is hardcoded as 'delete-tab' and notes state 'DeleteTab failed once'."
  }
  ```
  在此场景下，协议中的 `deleteTab` 确实为 `null`（证明未调用），但生成的 `taskbar-action.json` 却对外界报告：
  `failure: { stage: "delete-tab", message: "target-not-visible...", hresult: "0x80070057" }`
  这与交付文档声称的“未调用/未知字段为 null、各阶段真实记录”产生直接矛盾，将校验拒绝错误伪装成了 DeleteTab 本身执行失败。

---

## 六、反例工程与证据文件索引

本轮所有反例代码均已在隔离目录中编译并执行落地，未污染生产环境与日常基线：

- **隔离验证根目录**：`F:/dsh-wallpaper-plugins/.tmp/taskbar-review-20261012-173600/`
- **自检通过结果备份**：`.tmp/taskbar-review-20261012-173600/selftest.json`
- **反例复现源码**：`.tmp/taskbar-review-20261012-173600/counterexamples/Program.cs`
- **反例复现工程**：`.tmp/taskbar-review-20261012-173600/counterexamples/Counterexamples.csproj`
- **反例事实输出 JSON**：`.tmp/taskbar-review-20261012-173600/counterexamples/bin/Release/net10.0-windows/counterexamples.json`

---

## 七、后续修复与实测建议

1. **修正 R1 接管时隙**：在 `TaskbarQaRuntime.Create` 校验完窗口与参数后立即确立接管，或将外层 `Finish()` 调整为只要探针存在且匹配即实施安全关闭，避免早期异常时把已打开的窗口遗留在桌面上。
2. **修正 R2 停止传递**：在父子进程间建立显式停止通道（例如父进程收到 stdin `"stop"` 时亦在目标目录触碰 `stop.txt` 或传递事件句柄），避免对 worker 进行不可预期的强杀。
3. **消除 R3 硬编码归因**：`TaskbarHideStrategy` 中的 `failure.stage` 应直接取自 `action.Call` 的真实阶段（如 `"Verify"`, `"HrInit"`, `"Worker"` 等），并在 `deleteTab == null` 时禁止写入 `"DeleteTab failed once"` 注释。
4. **推进真实桌面短验**：离线自检已证明状态机边界闭合，后续应与用户约定时间进行 C1 真实窗口单次短验，重点由人工核对任务栏按钮、Alt-Tab 及动态帧是否确实符合预期。
