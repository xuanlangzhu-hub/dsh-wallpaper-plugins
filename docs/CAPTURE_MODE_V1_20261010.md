# V1：同一 Node 控制器中切换采集模式，四轮设备一致

2026-10-10。用户确认方便、其它助手暂停后执行；未安装插件、未退出 DSH、未改 GPU 设置。

## 实测与结论边界

同一 Node v24.18.0 控制器 PID 40056，持续使用 Lucy 源 HWND 1573458、WE PID 11584。
helper 路径、指纹、cwd、捕获时的环境对象及三条标准流接线保持相同。
每轮有限 8 秒、采集上限 30；两个模式都使用 `--echo-on-stderr`，stdout 持续消费，stdin 保持打开。
没有 `--forever` 或 `--owned-location`，源由控制器最终统一关闭。

| 顺序 | 模式 | helper PID | 帧数 | 设备 | LUID | 结束 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | memory | 15104 | 169 | Intel(R) UHD Graphics | 103941 | duration / exit 0 |
| 2 | pipe | 616 | 157 | Intel(R) UHD Graphics | 103941 | duration / exit 0 |
| 3 | pipe | 29796 | 157 | Intel(R) UHD Graphics | 103941 | duration / exit 0 |
| 4 | memory | 5780 | 163 | Intel(R) UHD Graphics | 103941 | duration / exit 0 |

四轮各有一条有效设备诊断，vendorId 32902，无原生 error、超时或取消。
每轮前后身份/可见/非最小化/非 cloaked 核验通过。初始源实际尺寸 868×517，
不能把启动请求的 1280×720 当作实测帧尺寸，也不拿本轮帧数或 CPU 摘要作性能比较。

**只说明：在本次普通 Node 上下文中，单独切换 memory/pipe 未复现设备差异。**
这不是正式 Electron Host；不能断定父环境已经是原因，也不能排除模式与上下文的交互。
此前正式 D 阶段选 RTX4060、C 阶段选 Intel 的原因仍未定。

## 失败记录与启动观察

第一次 run1 在首次捕获前失败，未产生试次：原生 `--window-find` 输出 camelCase，
`--window-status` 却用默认 PascalCase。控制器读取后者时误报身份缺失。
只在 QA 控制器中归一化字段，未修改原生源码/资产；新增对应回归后 13/13 通过，再执行 run2。
run1 的错误报告与关闭确认保留，不当成捕获模式失败。

用户在整轮结束后反馈：**看到弹窗或抢焦点，原桌面壁纸正常**。
没有足够信息把观察归属到 run1 或 run2；本轮不能宣称启动无闪窗/无抢焦点。
run1 初始源状态 foreground=true，run2 初始状态 false；这些单次状态不能排除其它时刻的抢焦点。
这是独立 QA 源的启动观察，不覆盖此前 rc.23 正式插件人工验收结论；同时保留为后续调查线索。

## 清理与日常状态

- 两次 finally 都按唯一名称关闭本轮源；run2 以期望 PID 11584 保护关闭，结果 closed=true。
- 最后只读 `--window-find` 返回空数组；没有杀 WE 或其它同名进程。
- 日常插件仍 0.6.0-rc.1；5 份 Profile 文件和官方 EXE 的 SHA256 与准备快照一致。
- 原 WE PID/路径/StartTime 一致；用户确认原桌面壁纸正常。
- 初始保护核验误用字符串比较日期，产生 false；PowerShell JSON 日期转换后改用 UTC ticks
  比较，结果 true。初始文件保留，以 `preservation-verified.json` 为核验结果。

证据：

- `.tmp/mode-device-v1-prep-20261010/before.json`
- `.tmp/mode-device-v1-20261010-run1/report.json`
- `.tmp/mode-device-v1-20261010-run2/`：报告、指纹、各轮原生输出、保护核验。
- `dsh-whale-mist/.tmp/perf/mode-check-Jq3VJJ/checks.json`：13 项隔离回归。

## 下一步

本轮停止，不自动扩成 V2。优先设计一个**真实正式 Host 与普通 Node 的最小启动上下文对照**，
沿用同 helper 指纹、同 pipe 模式、同源，先核实际执行入口/身份与设备诊断。
不能用“另起普通 node.exe”冒充正式 Host，也不先修改系统 GPU 绑定。
新一轮创建窗口或操作 DSH 前另约用户；DS 暂不改生产代码、安装或开启实机测试。
