# 显式选择采集显卡：独立 QA helper 已准备，真实 Host 采集待验

最新：已完成 [真实 Host 选卡短验](EXPLICIT_ADAPTER_RESULT_20261010.md)，两张硬件卡均选中并正确出帧，
QA 已移除、日常恢复并由用户重开确认。以下保留准备阶段记录。

2026-10-10，接续 [真实 Host 上下文结果](CAPTURE_CONTEXT_RESULT_20261010.md)。
本记录初始为准备状态：未安装临时包、未打开壁纸窗口、未修改日常 rc.1 或系统显卡设置。

## 实施与边界

只为受限 QA helper 增加 `--qa-adapter-luid <十进制 int64>`，按 DXGI 枚举到的 LUID 选择硬件。
明确选择时传 adapter 指针、D3D_DRIVER_TYPE_UNKNOWN；未选择时仍保持原默认创建路径。
这个参数组合遵循 [Microsoft D3D11CreateDevice](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-d3d11createdevice)
的规则；枚举时释放不使用的 COM 引用，所选 adapter 保留到设备创建完成。
不存在的 LUID、软件适配器或实际设备 LUID 不匹配均报错，不能静默默认回退。

没有编辑 accepted `qa/wallpaper-probe` 的源码或覆盖 `assets/wallpaper`。
新增 `qa/adapter-probe/AdapterSelection.cs` 与 `build.mjs`：复制 Program.cs 到新证据目录，
在三个精确且仅出现一次的锚点生成 QA 入口/创建分支，链接其余原源码，再发布独立的 WallpaperProbeAdapterQa。
生成源码、输入指纹、构建日志和输出指纹全部保留。生产主题、原生资产、版本和 tgz 均不变。

## 后台检查

- 首次构建 prep1 因 Vortice Luid.ToString 重载参数不足失败，目录/日志保留。
  修正 QA 格式化调用后，用全新 prep2 构建成功，未覆写 prep1。
- 参数检查 9/9；未创建设备或捕获窗口。
- DXGI 本机只读枚举：Intel UHD 103941、RTX4060 105141、软件 Basic Render Driver 104932。
- 仅设备创建自检：指定两张硬件卡均与实际 D3D 设备 LUID 匹配；未知 LUID 和软件卡被拒绝。
  这些自检不建立 GraphicsCaptureItem，不打开/捕获窗口，不证明真实画面或完整链路性能。
- JS 隔离检查：显式参数/分块帧解码/损坏流/参数拒绝 3/3，Host 队列与生命周期 10/10，原 trial 13/13。
  首尾 JPEG 样本只保留两张，不写每帧图片或积累全部 stdout。

构建证据：`.tmp/adapter-device-20261010-prep2`；源/accepted 资产指纹核对未变。
QA EXE SHA256 `7B22B7C2A6CEC034D204ACA1465F0D805FC016D99D6B2FEA5DF2AD2A304A9052`；
QA DLL SHA256 `E0332BF89D819A8265659510E0E22A4B160C8A67FABC3C9979A47431617D8DD9`。
JS 证据目录分别为 `adapter-trial-check-i9pmhk`、`context-check-ue0usA`、`mode-check-lYw0BU`，
均在 `dsh-whale-mist/.tmp/perf` 下。

## 下一小步：只验证真实 Host 选卡采集可用性

新目录：`.tmp/adapter-host-20261010-round1`。临时包名 dsh-whale-adapter-device-qa，
版本 0.0.1-qa.1791613804541。包只含入口/patch/package.json，引用本机固定 QA 模块；独立 native 文件复制到
本轮目录并逐文件记录/核验 SHA256。不是便携发布包，也不加入生产前端设置。

先确认用户方便、助手暂停且没有运行任务。用户退出后备份五份配置、九个外观存储文件及原 WE/EXE。
只添加临时 QA 插件，保持日常 rc.1。用户重开，外部核实际 Host 身份后显式运行：

```powershell
node dsh-whale-mist/qa/perf/probe-adapter-device.mjs --run --root .tmp/adapter-host-20261010-round1
```

同一 Host、同一个控制器拥有的 Lucy 源，Intel→NVIDIA 各 8 秒，pipe/30 上限与其它接线保持一致。
Host 仅借用窗口：指定 LUID、实际设备诊断、自然结束、完整 frame stream、尺寸和首尾 JPEG 都需核对。
不因 stdout 非空或编译成功就宣称画面正常。停止/取消/错误沿用有限时长与 child close 后响应；
未确认 Host 完成则不冒险关借用源。最后统一关闭唯一源，移除 QA、恢复本轮备份并由用户重开确认。

这两次短捕获只回答**真实 Host 能否显式选中两张卡并正确出帧**。
不能用它们判断核显更省电/独显更快，不能把 Native CPU 或 readback 摘要当完整 DSH 传输/解码/显示成本。
若通过，再设计包含实际显示与足够样本的窄成本对照；未通过则先保留失败，不落生产默认卡。
