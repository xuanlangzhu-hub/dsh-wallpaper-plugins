# 静态核查：启动链与默认捕获设备（DS，2026-10-10）

> Codex 复审与下一步以 [修订记录](../../docs/CAPTURE_DEVICE_STATIC_REVIEWED.md) 为准。
> 原稿的 C 启动点、设备日志顺序及 V1/V2 的清理/因果排除口径已纠正，以下保留调查原文，不直接执行原方案。

只读调查。未修改任何源码/原生 helper/QA 工具/package/Profile/注册表/历史证据，未启动真实进程、
壁纸或浏览器，未安装/打包/提交/推送。依据现有源码与已保存日志；API 语义只引 Microsoft 官方文档。

## 1. 启动链与 spawn 参数

### D 路径（正式 Host，pipe 播放）

`src/wallpaper/session.js:261-262` 是唯一的捕获 subprocess 创建点：

```js
child = spawnChild(config.helper, [String(config.window), output, durationArg, String(config.fps), 'pipe',
  '--owned-location', location], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
```

- 实际 argv：`<HWND> <output> <seconds|--forever> <fps> pipe --owned-location <本轮窗口名>`，
  与 `CaptureArguments.Parse`（`qa/wallpaper-probe/CaptureArguments.cs:32-78`）的期望一致；
  daily 走 `--forever` 时强制要求 `pipe` 且必须有 `--owned-location`（同文件 72-73）。
- 选项对象只有 `windowsHide` 与 `stdio`，**没有 `env` 字段**。Node 的 `child_process.spawn` 在未提供
  `env` 时使用 `process.env`（父进程环境），因此捕获 helper **原样继承启动它的那个 Node 进程的环境**。
  这是源码直接可证的事实，但继承了哪些具体变量本仓库无记录（见第 3 节 unknown）。
- `spawnChild` 默认值就是 `spawn`（`src/wallpaper/session.js:79`），未被测试注入时不会换成别的东西。
- stdin 保留：`child.stdin.on('error', …)`（262-263 行后），`stdio[0]` 为 pipe，
  即 pipe 模式的停止通道就是这条 stdin。
- 输出目录、时长、fps、窗口句柄全部由 Host 计算后作为 argv 传入；helper 侧**不读任何环境变量**
  决定行为（全部 `.cs` 中只有 `Environment.ExitCode` 四处赋值，无 `GetEnvironmentVariable`）。

### 已知启动条件（只按代码说明）

`src/index.js:29-30` 决定整个壁纸子系统是否注册：

```js
if (process.platform !== 'win32' || process.env.ELECTRON_RUN_AS_NODE !== '1' ||
    basename(executable).toLowerCase() !== 'deepseek harness.exe' || !process.env.LOCALAPPDATA) return;
```

即：只有「官方 Host 以 `ELECTRON_RUN_AS_NODE=1` 运行、`process.execPath` 为 `DeepSeek Harness.exe`、
且有 `LOCALAPPDATA`」时才注册。**本条只说明代码在什么条件下注册**；`ELECTRON_RUN_AS_NODE` 是
Node 语义开关，源码中没有任何一处把它或其它变量传给捕获 helper 用于渲染设备选择。
`src/index.js:36-39` 另有 whale-icon-helper 的 spawn，同样无 `env`，与本问题无关。

### C 路径（本机对照，memory 采集）

已保存证据 `.tmp/capture-gpu-align-20261010-100812/`：

- 设备诊断来自 C 的 stdout 首条 JSON：`{"adapter":"Intel(R) UHD Graphics","luid":"103941","vendorId":32902}`。
- 启动者不是 Node：`measure-phase.ps1:5` 取 `$helper` 后以
  `& $helper @Arguments 2> …`（PowerShell 直接调用）执行，因此 C 的父进程是本轮 PowerShell 控制脚本，
  且**没有经过 `session.js:261` 的 spawn**。
- D 的 `[Capture]` 条目在 `D-final.json`：
  `{"adapter":"NVIDIA GeForce RTX 4060 Laptop GPU","luid":"105141","vendorId":4318}`，模式 `pipe`。

因此 C/D 之间存在**两个同时不同的因子**：启动者/继承环境，与 memory/pipe 模式。两者路径下 EXE/DLL
指纹相同（`CAPTURE_GPU_ALIGNMENT_20261010.md`），源码中也没有任何按 exe 路径或文件名分支的逻辑。

## 2. 设备创建：memory 与 pipe 的差异

### 设备创建之前的初始化差异（只有管道接线，不涉及设备）

`qa/wallpaper-probe/Program.cs:108-135`：

| 行 | memory（`mode=="memory"`） | pipe（`mode=="pipe"`） |
| --- | --- | --- |
| 116 | `diagnostics = Console.Out` | `diagnostics = Console.Error` |
| 117 | `pipeOutput = Stream.Null` | `pipeOutput = Console.OpenStandardOutput()` |
| 119-125 | 不安装 stdin 读取任务 | `Task.Run` 循环读 `Console.In.ReadLineAsync()`，遇 `stop` 或 EOF 则 `stopSignal.Cancel()` |
| 139-141 | 设备诊断写到 stdout（无 `--echo-on-stderr` 时） | 设备诊断写 `ProbeJournal.Info("Capture", …)`（stderr 日志） |

关键点：**这些全部发生在 `Native.CreateDevice()` 之前，但都不接触 D3D/DXGI/WGC**。
`Program.cs:137` 的 `using var device = Native.CreateDevice();` 在两模式下是**同一行、同一参数**，
前面没有任何设备相关分支。mode 只出现在 108 行之后的行为分支里，不参与设备创建。

### 设备创建与其后的处理链

- `Native.CreateDevice()`（`Program.cs:448-459`）：
  `D3D11CreateDevice(0 /*pAdapter=NULL*/, 1 /*D3D_DRIVER_TYPE_HARDWARE*/, 0, 0x20 /*BGRA_SUPPORT*/,
  0, 0, 7 /*SDK version*/, …)`，再把 `ID3D11Device` 经
  `CreateDirect3D11DeviceFromDXGIDevice` 包成 WinRT `IDirect3DDevice`。
  **adapter 参数是 0，没有指定任何适配器**，所以选谁完全由操作系统决定。
- `StagingReadback.DescribeDevice(device)`（`StagingReadback.cs:14-24`）：
  由 `IDirect3DDevice` 取回底层 `ID3D11Device` → `IDXGIDevice` → `GetAdapter()`，
  返回**该 D3D11 设备真正落在哪块适配器**的 `Description.Description` / `Luid` / `VendorId`。
  这正是 C/D 表格里的设备名与 LUID 的来源（C 为 stdout 首条 JSON，D 为 `[Capture]` 日志），
  所以它不是"哪块卡最忙"的推测，而是设备自身的身份。
- `Native.CreateItem(hwnd)`（`Program.cs:473-489`）：经
  `GraphicsCaptureItem` 的 `IGraphicsCaptureItemInterop.CreateForWindow` 拿窗口捕获项；
  与设备无关，两模式共用。
- `Direct3D11CaptureFramePool.CreateFreeThreaded(device, B8G8R8A8UIntNormalized, 2, size)`
  （`Program.cs:145-146`）：**WGC 帧池绑定到上面那个 device**。此后捕获帧在该 device 所属适配器上产生、
  `session.StartCapture()` 之后的主循环（150-260）也只处理帧的内容，不再重建设备。
  所以设备一旦选定，整轮采集的 GPU 归属就定了。
- 设备之后的差异：`mode=="pipe"` 时帧经 `FramePipe.Write(pipeOutput, …)`（214-215）写 stdout，
  结束原因多一条 `pipe-disconnected`（246）；`mode!="pipe"` 时首帧另存 `first.jpg`、
  末帧经 `AtomicFile.Publish` 写 `latest.jpg`（217、251）。这些都不改变设备。

## 3. 已证事实 / 合理假设 / unknown

### 已证事实（源码或已保存日志直接可证）

1. D 的捕获进程由 `session.js:261` spawn，选项无 `env`，因此继承**启动它的 Node 进程**的环境；
   argv 固定含 `pipe` 与 `--owned-location`。
2. C 由 PowerShell 直接 `& $helper` 启动（`measure-phase.ps1`），不经 Node spawn。
3. `Native.CreateDevice` 传 `pAdapter=NULL`，不指定适配器；`DescribeDevice` 报告的是设备真实归属；
   WGC 帧池用同一个 device。
4. memory 与 pipe 在 `CreateDevice()` 之前**没有任何设备相关分支**；差异只在 stdout/stderr/stdin 接线。
5. 本机现状（只读查询）：Intel UHD Graphics 驱动 31.0.101.4502 且有显示输出（2560 宽），
   NVIDIA RTX 4060 Laptop 驱动 32.0.16.1714 无显示输出。
6. 只读注册表 `HKCU\Software\Microsoft\DirectX\UserGpuPreferences` 中共 15 项，
   **没有任何一项指向 `WallpaperProbe.exe`、`DeepSeek Harness.exe` 或 `node.exe`**；
   其余为游戏/LDPlayer/NVDisplay.Container 等（NVDisplay.Container 为 `GpuPreference=1`，与本问题无关）。

### 合理假设（有来源，但本机未验证）

- **A1**：device 的适配器由操作系统按"进程默认 GPU 首选项 + 枚举顺序"决定。Microsoft 的
  [D3D11CreateDevice](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-d3d11createdevice)
  写明：`pAdapter` 传 **NULL** 即"use the default adapter, which is the first adapter that is enumerated by
  `IDXGIFactory1::EnumAdapters`"，且枚举顺序就是 DXGI 适配器顺序。
  结合事实 5、6（无按程序首选项），**本轮观测到的 Intel/NVIDIA 差异的最可能载体是进程级默认 GPU 首选项
  或枚举顺序**，而这两者都不由 `Program.cs` 决定。
- **A2**：因为 `pAdapter=NULL` 且 helper 不读环境变量做分支，"父进程环境里某个变量直接切换 GPU"
  只能通过**操作系统在创建进程/创建设备时读取的输入**起作用，不能通过 helper 自身逻辑起作用。

### unknown（明确写清，不猜）

1. **捕获 helper 实际继承到的环境变量清单未知**。本仓库不记录它；已保存日志里没有环境快照，
   也没有 helper 自报 env/argv 的字段（`Program.cs` 无此日志）。
   因此**无法从现有证据判断是哪个变量（如果有）与 GPU 选择相关**。
2. **pipe 管道本身是否改变设备选择未知**。源码显示 mode 不参与设备创建（事实 4），
   但这只证明"代码未按 mode 分支"，不等于"运行时无影响"（例如 pipe 带来的时序/父进程差异）。
3. **两轮之间是否存在与本问题相关的系统状态变化未知**（例如用户是否在两次运行之间改过图形设置、
   驱动是否重载、显示拓扑是否变化）。已保存证据只覆盖 WE/DSH/前台/播放策略一致性，没有显示配置快照。
4. **"父 PID 不同"本身不构成原因**。父 PID 只是启动方式的代理变量；一个具体 NVIDIA 控制面板参数或
   Windows 图形设置是否真正参与，现有证据不足以断言。

## 4. 两个最小后续验证（各只验证一件事）

两项都**只用于设备选择调查**，输出只作诊断，**不得当作正式 DSH 成本或实机验收**；
不改生产实现、不加 GPU 绑定、不改全局图形策略、不开新的正式窗口。

### V1（单因素：只切 memory/pipe，其它全同）

- **改变**：仅第五个位置参数 `memory` ⇄ `pipe`。
- **保持**：同一个 EXE/DLL、同一个启动者、同一个父进程与继承环境、同一个源窗口、同 fps/时长、
  同样的 `stdio` 接线（stdin/stdout/stderr 都接上并持续读取，memory 模式下 stdout 只读不关，
  以免改变它的诊断写入行为）。
- **输出与证伪**：记录每轮 `DescribeDevice` 的对象（adapter/luid/vendorId，各 ≥2 次重复）。
  **若两者始终给出同一适配器**，则"pipe 管道影响设备选择"被证伪，剩余变量只有启动者/环境；
  **若稳定不同**，则 mode 或它带来的接线差异是有效因子，需在 V2 之前先缩小它。
- **保留语义**：pipe 轮保持 stdin 常开、正常读 stdout 并消费背压、退出归属为"父进程主动停止"；
  memory 轮不发送 `stop`、按其时长自行结束；两轮结束都确认窗口 closed=true、probe 窗口归零、
  输出目录各自独立且不覆盖历史证据。

### V2（单因素：只换启动者/环境，模式相同）

- **改变**：启动者。同一份 EXE 与同一份 argv，A 组从 PowerShell 直接执行（同 V1 的 memory 形式），
  B 组由一个小 Node 脚本用与 `session.js:261` **完全相同的选项**（`windowsHide: true`、
  `stdio: ['pipe','pipe','pipe']`、不传 `env`）spawn；若需要，第三组可由同一个 Node 脚本显式传入
  一份**最小化/可控**的环境，用于判断"环境"是不是有效因子。
- **保持**：EXE/DLL、argv、窗口、fps/时长、stdin/stdout/stderr 接线、清理方式一致。
- **输出与证伪**：同样记录 `DescribeDevice` 的 adapter/luid（各 ≥2 次）。
  **若三组相同**，则"启动者/继承环境影响设备选择"被证伪，应转向系统状态（第 3 节 unknown 3）；
  **若 B 组与 A 组不同且与正式 D 一致**，则启动方式是被隔离出的变量，下一步才值得去看具体环境差异
  （届时需要 helper 或启动器额外记录自身环境，属新增观测，另行申请）。
- **保留语义**：Node 脚本必须持续读 stdout（消费背压）、保留 stdin 供停止、等待子进程退出并回收
  退出码；结束时确认窗口 closed=true、无遗留 probe 进程、证据目录不覆盖旧数据。
  模拟 pipe 消费者仅用于本次设备选择调查，**不冒充正式 DSH 的播放与成本归属**。

两项都不需要安装、打包、提权、改驱动或改任何全局 GPU 策略。

## 5. 交付边界

- 本文件为唯一新增产物；未改 `src/`、原生 helper、QA 工具、package、Profile、注册表或历史证据。
- 未启动真实进程/壁纸/浏览器；本节所有本机陈述均来自只读查询（CIM、注册表读）与已保存日志。
- 结论不构成性能结论，也不证明插件性能改善；是否进行下一次窗口测试由用户确认。
