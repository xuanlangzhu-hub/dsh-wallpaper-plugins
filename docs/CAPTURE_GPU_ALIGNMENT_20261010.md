# 同安装路径的 C/D 验证完成：设备仍不同，日常已恢复

2026-10-10，接续 [对齐计划](NEXT_CAPTURE_GPU_ALIGNMENT.md)。用户确认方便、暂停助手，并点击退出/重开/播放/停止。
本轮只统一 helper 执行路径，未改生产实现、GPU 首选项、驱动或全局 WE FPS，未重复五阶段/35 分钟。

## 实际结果

C/D 都从 `C:/Users/HP/.dsh/profiles/desktop/node_modules/dsh-whale-mist/assets/wallpaper/WallpaperProbe.exe`
启动，EXE 与 DLL 指纹完全相同。路径一致后，**设备仍未对齐**。

| 项目 | C：后台直接 memory 采集 | D：正式 Host pipe 播放 |
| --- | --- | --- |
| Capture PID / 父 PID | 16496 / 23372（本轮 PowerShell 控制脚本） | 48936 / 5760（已识别 DSH Host） |
| 设备自身诊断 | Intel(R) UHD Graphics | NVIDIA GeForce RTX 4060 Laptop GPU |
| 设备 LUID（十进制 / 十六进制） | 103941 / 0x19605 | 105141 / 0x19ab5 |
| 实际帧尺寸 | 1302×776 | 1302×776 |
| 资源样本 | 5，错误 0，身份稳定 | 5，错误 0，身份稳定 |
| Native CPU（32 逻辑容量归一） | 0.127% | 0.045% |
| Native 状态边界处理速率 | 21.43 fps | 21.55 fps |
| 客户端绘制 / 解码错误 | 不适用 | 21.54 fps / 0 |

设备名称/LUID 直接来自已有 `StagingReadback.DescribeDevice(device)`，不只根据 GPU 引擎百分比猜测：
C 为 stdout 首条 JSON，D 为最终 Host diagnostics.messages 的 `[Capture]` 条目。
各 producer 状态快照不同步，速率按各自真实秒数计算；不代表源渲染 FPS。GPU 计数不当整卡占用。

EXE SHA256：`F172D2BC60701ADB4479E2E12EE296799F149B09B80C3EE3B5731F5EA30AE117`；
DLL SHA256：`D7353A75665DCCD9D6263C10FE3CFC18D176572EBBE0AED2B4A1691D5DF39968`。

## 可以与不能得出的结论

- 执行路径相同并不足以让本机默认捕获设备相同；不能把两段 native CPU 差异当编码/传输净收益。
- 父进程/继承环境与 memory/pipe 模式仍同时不同，**尚未证明哪项是原因**，也不猜具体环境变量。
- 源码 `Program.cs` 的 `Native.CreateDevice()` 调用 `D3D11CreateDevice` 时 adapter 参数为 0，
  未显式传入某个目标适配器；本轮不修改它，也未验证操作系统选择机制。
- 直接设备诊断比单纯的“3D 活动 LUID 不同”更明确；前一轮结果保留，不继续按路径假设反复测。

下一步先按 [静态核查任务](DS_CAPTURE_DEVICE_INVESTIGATION.md) 整理启动/设备创建链，再选择一个能隔离
父环境或模式的最小验证。不得因此直接加生产 GPU 绑定、改全局策略、注入 Host 或自行开新测试窗口。

## 清理与恢复

C capture 结束，本轮唯一源 `WhaleWallpaperProbe-gpu-align-20261010-100812-C` 确认 closed=true。
D 用户停止并退出，本轮源 `WhaleWallpaperProbe-261010021451-fc5b` 消失、capture 退出，全部 probe 窗口 0。
官方 CLI 恢复 rc.1，关闭状态 5 配置/9 外观存储文件哈希一致，测试后数据另存；原 WE PID 11584/启动身份保留，
官方 EXE 哈希未变、签名 Valid。用户重开确认日常正常/无实验自播；重开后配置仍一致、capture 0。

证据：`F:/dsh-wallpaper-plugins/.tmp/capture-gpu-align-20261010-100812`，baseline、C/D 原始样本、设备日志、
阶段/边界快照、alignment-summary.json、清理和恢复记录。备份：
`C:/Users/HP/.dsh/backups/official-desktop-before-gpu-align-20261010-100812`。
候选仍 rc.23，包未变，本轮不新增实现或新包。结果只是对齐验证，不是优化完成或通用低开销验收。
