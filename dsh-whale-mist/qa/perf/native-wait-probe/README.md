# 原生等待隔离对照（QA 原型）

不打开或采集窗口，不启动/修改 DSH、Wallpaper Engine 或显卡设置。项目直接链接现有 `NativePacingTracker`，只测自身 Windows 等待与 CPU 时间。它不属于打包文件，**尚未接入采集 helper**。

先在新输出目录构建、运行；所有结果目录必须不存在：

```powershell
dotnet build qa/perf/native-wait-probe/NativeWaitProbe.csproj -c Release -o <新构建目录>
<新构建目录>/NativeWaitProbe.exe --mode baseline --output <新基线目录>
<新构建目录>/NativeWaitProbe.exe --mode self-test --output <新检查目录>
<新构建目录>/NativeWaitProbe.exe --mode compare --output <新对照目录> --iterations 24
```

`--iterations` 支持 8–128，每个请求、每轮分别采这么多次；每组四次预热不计入。请求为1/2/10/16/18/30ms，对照两轮，第二轮反转方法及请求顺序。原始每次等待保留在 results.json。

- `task-delay-plain`：直接 Task.Delay。
- `task-delay-tracked`：实际 NativePacingTracker 的截断预算/等待测量。
- `kernel-normal-direct`：普通内核计时器，直接阻塞等待，分离异步恢复与计时器类别。
- `kernel-highres-direct`：高精度计时器直接等待，属于阻塞对照。
- `kernel-highres-worker`：复用一个专用后台计时线程及一个计时器，通过异步 continuation 恢复调用方；只允许一个待处理请求。

只重测原生两方案时，可传 `--methods kernel-highres-direct,kernel-highres-worker`；支持方法的任意不重复子集。仅控制组时精度门槛为null，不把“没有候选”写成通过。

退出码：0写出结果/检查通过，2参数、平台或功能异常，5本机精度门槛未达。门槛为候选各组平均多等≤2ms、P95多等≤5ms、没有超过0.1ms的提前完成；这是本机实验门槛，**不是跨机器稳定CI断言**，也不是 FPS/功耗保证。输出已存在时返回2，不覆盖内容。

`KernelWaitTimer` 使用匿名、不可继承的同步计时器，单次相对到期、零主动合并延迟；取消使用独立事件，因为只取消计时器不会唤醒等待者。计时器取消后再释放，不能在等待中关闭句柄。异步原型复用调用方/实例取消事件，不为每帧创建链接CTS及事件。没有忙等、提高线程优先级、timeBeginPeriod 或全局计时器配置。

20项自测覆盖到期单位/参数、取消前不布置、5秒等待在途取消、重复取消后重用、并发拒绝、关闭顺序、后台线程退出、已接收请求关闭竞态和幂等释放。正式集成还需原生API故障注入/回退、实际helper父停止/异常路径，不能直接将QA原型当作已验收生产组件。

CPU是自身进程时间/实测墙钟时间，占一逻辑核；计数粒度较粗，0不等于零开销。程序没有真实编码、GPU渲染、WGC、流传输或界面呈现，因此不能从等待减少推导真实采集帧率、壁纸响应或游戏/电池收益。

本机结果及下一步范围见仓库 docs/NATIVE_WAIT_P4_ISOLATED_RESULT_20261015.md。
