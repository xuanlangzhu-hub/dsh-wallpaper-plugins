# C1 QA 第三轮复审 R1/R3 局部补修与离线验收报告

2026-10-12，Antigravity。依据 [`docs/TASKBAR_QA_THIRD_REVIEW_ASSESSMENT_20261012.md`](file:///F:/dsh-wallpaper-plugins/docs/TASKBAR_QA_THIRD_REVIEW_ASSESSMENT_20261012.md) 确立的“局部补 R1、R3，整套不推翻”接续原则，完成代码修复、反例消解及全新目录独立离线验证。

**本轮承诺与安全约束**：
- **日常环境严格不动**：生产 Profile 与安装版本保留为 `rc.24`（`dsh-whale-mist-0.6.0-rc.24.tgz`）。
- **纯离线验证**：未开启真实壁纸窗口、未调用真实 Shell/WE、未安装或修改生产包、未 git commit/push。
- **全新证据目录**：`.tmp/taskbar-repair-20261012-r1r3/`，所有旧证据与复审记录完整保留。

---

## 一、修复内容

### 1. R1：接管时机前移至 Runtime 创建，覆盖早期初始化失败

- **问题回顾**：此前 `TakeOwnership()` 仅在 `Program.cs` 靠后的 `var hwnd = (nint)handle;` 处调用。如果在 `TaskbarQaRuntime.Create` 成功之后、句柄转换之前的准备环节（如标准流准备、取消令牌创建、桌面环境确认等）发生异常，最外层 `finally` 触发时由于 `_ownsSource == false`，只记录 `outcome: "not-owned", closed: null`，不会触发身份复核与关源操作，导致反例中探测窗口孤立泄漏（`closeCalls = 0`）。
- **修改点**：
  1. [`TaskbarQaRuntime.cs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarQaRuntime.cs) 中：
     - 在 `TaskbarQaRuntime.Create` 内，当入参校验通过、身份门禁满足且证据文件成功占位后，**立即调用 `runtime.TakeOwnership();`**，在任何流/信号/捕获准备前确立清理责任。
     - `TaskbarQaRuntime.CreateOffline` 默认增加 `bool takeOwnership = true`，与生产 `Create` 语义保持完全一致；同时保留显式 `takeOwnership: false` 供测试未接管场景。
  2. 身份门禁与拒绝语义保留：
     - 未被 QA 接管的运行（或参数解析期拒绝）继续输出 `closed: null`。
     - 探测窗口身份变更（PID/StartTime/类名不符）时，`CanCloseOwned()` 严密拦截关源，输出 `outcome: "not-confirmed", closed: false`，进程退出码置 1。

### 2. R3：真实失败阶段归因与如实说明

- **问题回顾**：此前 `TaskbarHideStrategy._failure` 阶段硬编码为 `stage = "delete-tab"`，且 `_notes` 一律附加 `"DeleteTab failed once..."`。当实际发生的是 `HrInit` 失败（如 `0x80004005`）或动作前身份校验 `Verify` 失败（如窗口最小化/cloaked）时，`DeleteTab` 根本未曾调用，但报告却声称 DeleteTab 失败，造成排错归因自相矛盾。
- **修改点**：
  1. [`TaskbarHideStrategy.cs`](file:///F:/dsh-wallpaper-plugins/dsh-whale-mist/qa/taskbar-hide/TaskbarHideStrategy.cs) 中：
     - 增加 `FailureStageOf(string call)` 阶段映射函数：
       - `"DeleteTab"` -> `"delete-tab"`
       - `"HrInit"` -> `"hr-init"`
       - `"Verify"` -> `"verify"`
       - `"Worker"` -> `"worker"`
       - `"Create"` -> `"create"`
       - `"Release"` -> `"release"`
     - 将 `_failure` 对象的阶段属性更新为 `stage = FailureStageOf(action.Call)`。
     - 条件化 `_notes` 说明文字：
       - 仅当 `action.Call == "DeleteTab"` 时记录 `"DeleteTab failed once; it is not retried..."`；
       - 当 `action.Call == "HrInit"` 时记录 `"HrInit failed; DeleteTab was not attempted"`；
       - 当 `action.Call == "Verify"` 时记录 `"Verification failed ({action.Error}); DeleteTab was not attempted"`；
       - 当 `action.Call == "Worker"` 时记录 `"Worker failed ({action.Error}); call results are unknown"`；
       - 其它调用异常如实记录 `"{action.Call} failed; DeleteTab was not attempted"`。

---

## 二、测试套件扩充与验证结果

### 1. 本机测试结果汇总（全新构建目录：`.tmp/taskbar-repair-20261012-r1r3/`）

| 验证项 | 测试命令 / 工具 | 结果 | 关键验证边界 |
| --- | --- | --- | --- |
| 隔离编译 | `node qa/taskbar-hide/build.mjs --output .tmp/taskbar-repair-20261012-r1r3/build2` | **退出码 0** | 13 项 accepted 源码/资产 SHA256 严格未变，无警告 |
| QA 统一自检 | `WallpaperProbeTaskbarQa.exe --taskbar-self-test` | **90/90 PASS** | 覆盖 R1–R3 全部场景；包含 7 种 COM/Worker 调用流及真实清理门禁 |
| 生成代码检查 | `node qa/taskbar-hide/check-generated.mjs` | **13/13 PASS** | 验证真实生成的入口顺序与 13 种早期故障/生命周期阶段（含 PreCreationReject、EnsureDefaultDesktop、StreamSetup、IdentityChanged、Unowned） |
| Worker 生命周期 | `node qa/taskbar-hide/check-worker.mjs` | **4/4 PASS** | 真实控制台子进程超时/取消/异常/成功，全确认退出，无迟到动作 |
| 第三轮反例复跑 | `dotnet run --project Counterexamples.csproj` | **3/3 PASS** | 3 个先前反例的 `contradiction` 全为 `false`，全部 `repaired: true` |

### 2. 反例消解详细证据

运行 `.tmp/taskbar-repair-20261012-r1r3/counterexamples/bin/Release/net10.0-windows/Counterexamples.exe`，输出如下：

```json
{
  "count": 3,
  "evidence": [
    {
      "name": "post-hrinit-verify-failure-stage",
      "deleteTabCalled": false,
      "actionCall": "Verify",
      "reportedFailureStage": "verify",
      "notes": [
        "Verification failed (target-not-visible-or-minimized-or-cloaked); DeleteTab was not attempted"
      ],
      "contradiction": false,
      "expectedStage": "verify",
      "repaired": true,
      "detail": "When post-HrInit verification fails, stage is 'verify' and notes state truthful verification failure."
    },
    {
      "name": "hrinit-failure-stage",
      "deleteTabCalled": false,
      "actionCall": "HrInit",
      "reportedFailureStage": "hr-init",
      "notes": [
        "HrInit failed; DeleteTab was not attempted"
      ],
      "contradiction": false,
      "expectedStage": "hr-init",
      "repaired": true,
      "detail": "When HrInit fails, stage is 'hr-init' and notes state truthful HrInit failure."
    },
    {
      "name": "early-initialization-cleanup",
      "closesCount": 1,
      "outcome": "closed",
      "closed": true,
      "sourceStillExists": false,
      "contradiction": false,
      "repaired": true,
      "detail": "Early failure after runtime creation safely triggers owned cleanup and closes probe window."
    }
  ]
}
```

### 3. `check-generated.mjs` 覆盖 13 阶段记录

生成的 13 阶段检查结果（`integration.json`）：
- `PreCreationReject`：`closes: 0, sourceStillExists: true, cleanup: null`（参数被拒不触发关源）
- `EnsureDefaultDesktop`：`closes: 1, sourceStillExists: false, closed: true`（桌面初始化失败触发接管关源）
- `StreamSetup`：`closes: 1, sourceStillExists: false, closed: true`（流准备失败触发接管关源）
- `CreateDevice` ~ `Publication` ~ `Stop` ~ `Normal`：各阶段均确立所有权并安全单次清理
- `IdentityChanged`：`closes: 0, sourceStillExists: true, outcome: "not-confirmed", closed: false`（身份不匹配坚决拒绝关源）
- `Unowned`：`closes: 0, sourceStillExists: true, outcome: "not-owned", closed: null`（未接管运行不误关）

---

## 三、关于 R2 的事实厘清

本轮遵循 [`docs/TASKBAR_QA_THIRD_REVIEW_ASSESSMENT_20261012.md`](file:///F:/dsh-wallpaper-plugins/docs/TASKBAR_QA_THIRD_REVIEW_ASSESSMENT_20261012.md) 的裁定：
1. **取消链路机制**：父进程负责对取消令牌、`stop.txt` 及快捷键进行监控，并在超时或收到停止时向 worker 发送有界终止并等待退出确认；Worker 内部同时复核 `stop.txt` 与 Esc 键。这是清晰的“父监视器有界守护 + Worker 协作复核”模型，不可定性为“取消完全未处理”。
2. **Explorer 状态安全**：没有实测证据表明短生命周期 Worker 在超时兜底终止时损坏了 Explorer。微软官方文档说明 `TerminateProcess` 主要是 DLL 状态未清理的警告，而独立 Worker 设计本身就是为了隔离可能卡死的 COM 调用。
3. **架构保持稳定**：未做推翻式重构，保持了现有的进程监控模型与 4/4 退出保证。

---

## 四、下一步建议

1. **R1 与 R3 离线缺陷已全部补齐，反例均已消解。**
2. 保持日常稳定的 `rc.24` 配置，不自动安装或推送。
3. 离线工具链已具备高保真、归因准确、退出安全的门禁能力；后续若需验证 C1 真实效果，可在用户方便时开展小规模独立桌面观察。
