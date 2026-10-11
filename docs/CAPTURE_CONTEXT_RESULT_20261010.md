# 真实 Host 对照完成：同 pipe 条件下，Node 选 Intel、Host 选 RTX4060

2026-10-10 下午，接续 [准备方案](CAPTURE_CONTEXT_PLAN_20261010.md)。用户确认方便、暂停助手，
自行退出/重开 DSH；Codex 后台备份、添加纯 Host QA 插件、运行及恢复。日常主题始终 rc.1，未安装 rc.23。

## 结果与意义

同一 Lucy 源 HWND **589868**、原 WE PID **11584**，同 helper 路径及接受的 EXE/DLL 指纹，
同捕获 cwd `F:/dsh-wallpaper-plugins`、pipe/8 秒/30 上限/`--echo-on-stderr`、三标准流接线。
两侧及时 drain stdout，stdin 至自然结束保持打开，无 forever/owned-location。

| 顺序 | 启动方 | Capture PID / 父 PID | 设备 | LUID | 帧数 |
| --- | --- | --- | --- | --- | --- |
| 1 | 普通 Node | 42048 / 44920 | Intel(R) UHD Graphics | 103941 | 170 |
| 2 | 正式 Desktop Host | 26124 / 34724 | NVIDIA GeForce RTX 4060 Laptop GPU | 105141 | 171 |
| 3 | 正式 Desktop Host | 44140 / 34724 | NVIDIA GeForce RTX 4060 Laptop GPU | 105141 | 171 |
| 4 | 普通 Node | 46756 / 44920 | Intel(R) UHD Graphics | 103941 | 171 |

四轮原生设备诊断各一条，均 duration / exit 0，无原生 error、超时或取消。实际捕获帧尺寸四轮均
**1302×776**；初始窗口查询的 868×517 不能混同于捕获物理像素尺寸。本轮不拿帧数/CPU 摘要作性能结论。

**在本次受测条件中，启动上下文差异足以复现设备差异。**
同 pipe、同源也复现，因此此前 C/D 的差异不需要 memory/pipe 同时不同；简单 Node pipe 也不会自动选 RTX。
不能由两次重复推广成全部系统/驱动的规则，也不能证明哪个单独环境变量是原因。

## 确实是真实 Host，而不是普通 Node 替代

QA 插件由官方插件树加载；只写就绪记录，随后接受本轮有限的两张票据，没有前端或公共启动路由。
Windows 实际进程与插件快照核对：Host PID 34724、父 PID 33248，两者路径均官方 DeepSeek Harness.exe。
Host 命令行指向官方 `@deepseek-ai/dsh-desktop-host/lib/index.js` 及 desktop Profile，非另起模拟 EXE。

- Host：内置 Node 24.18.1、Electron 44.0.0；自身 cwd 是 desktop Profile，但 **capture 子进程 cwd 已对齐仓库**。
- 普通 Node：`C:/Program Files/nodejs/node.exe`，Node 24.18.0，无 Electron；控制器 PID 44920。
- 记录的 4 个环境标志中，Host 的 ELECTRON_RUN_AS_NODE=1，普通 Node 为 null，其余三个均 null。
  两侧仍继承各自完整环境，未导出所有值。父进程身份、运行时和其它环境/图形策略没有分别拆开。

这些是组合上下文中的差异记录，**不把 ELECTRON_RUN_AS_NODE=1 当作 GPU 因果结论**。
本轮没有更改注册表、驱动、Windows/WE 全局 GPU 或 FPS 设置，也没有修改生产/原生资产。

## 用户观察、清理和恢复

- 用户确认本轮没有主动弹窗/抢焦点，原桌面壁纸正常。上午 V1 的不同观察继续保留，不覆盖其记录。
- 控制器核 Host 两轮 childClosed 后统一关闭唯一源，closed=true，匹配 HWND/PID，等待 1159ms。
- 后续 `--window-find` 空数组，capture 进程不存在，未终止原 WE。
- 用户正常退出后，官方 CLI 移除 QA 包，QA 的 node_modules 链接已不存在。
- 5 份 Profile 文件与 9 个关闭状态外观存储文件均恢复原 SHA256；测试后数据保留在备份下。
- 日常 rc.1、原 WE PID/StartTime、官方 EXE SHA256/Valid 签名保留。用户重开确认日常正常/无实验自动运行；
  重开后 5 份配置再次一致、capture 0。

备份：`C:/Users/HP/.dsh/backups/official-desktop-before-context-device-20261010-140259`。
证据：`F:/dsh-wallpaper-plugins/.tmp/context-device-v2-20261010-afternoon1`，包含 baseline、Host 实际身份、
就绪/领取/响应、4 轮原生输出、report、帧尺寸、CLI 安装/移除日志及关闭/重开恢复核验。
本机临时 QA 包及源码保留作复现工具，不发布、不自动运行，不改正在引用的 tgz。

## 下一步边界

本轮到这里，不自动再交换环境变量、绑定显卡或重跑五阶段。
设备差异已经能在真实 Host 对照中复现，继续穷举启动变量不是当前必须完成的产品工作。
下一步优先评估**仅本次采集进程显式选择适配器的受限 QA 方案**，再比较完整链路的实际成本与可用性，
不要因为“独显更强”或“核显省电”就预设默认卡。两侧需要同源/同尺寸和直接设备诊断，选择失败需明确报告。
先做方案和隔离验证，不修改全局策略；如需新 helper，另保留实验产物，不覆盖当前 rc.23 指纹。
真实窗口/安装仍另约用户。没有完成优化，也不宣称显卡选择设置已经实现。
