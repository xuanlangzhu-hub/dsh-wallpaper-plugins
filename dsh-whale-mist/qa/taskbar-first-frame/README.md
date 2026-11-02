# 首个发布帧后的任务栏移除：隔离补修

当前改动是`runtime.patch`：正式`TaskbarHideRuntime.Create`的`MinSeconds:10`改为0。
旧值来自C1实验的调用前画面对照，正式接入继续沿用；它不是Windows要求。
保留encoded／published、身份重验、停止、异步单次动作和终结门禁；QA选项及Strategy默认值保持。

## 运行

在仓库根执行，输出必须是`.tmp`下的全新目录：

```powershell
python dsh-whale-mist/qa/taskbar-first-frame/check.py --output .tmp/taskbar-first-frame-<new-round>
```

需要本机.NET10及已缓存的原生构建依赖，不下载组件，不操作DSH／WE／窗口／Shell。
`baseline.json`固定rc.39留档的18份输入；原留档缺失或漂移时拒绝，不能自动改用共享Trace源。
`prepare.py`复制到隔离目录，核对声明的补丁精确一致后只改Runtime；不会覆盖原留档或生产assets。

`check.py`先构建旧代码、运行同一41项断言并要求暴露原工厂门槛，再构建补丁并要求全部通过，最后隔离编译完整原生工程。
回放调用真实工厂读取配置，真实Runtime通过私有构造器注入窗口probe／时钟，真实worker监控器及COM调用流程使用底层IO替身。
不执行公开工厂创建的真实probe或worker闭包，不初始化COM、不枚举窗口、不启动真实采集或实际worker进程。

各子阶段有8／12／40／45秒期限，控制器总截止180秒，dotnet禁用构建服务器和共享编译；记录PID、退出码、超时和退出确认。
若超时先终止自己的直接子进程并保留日志，控制器失败，不声称编译后代均已确认退出，也不自动清理或交付安装资产。
运行目录保留红／绿控制、source-receipt、commands、stdout／stderr与result，不覆盖失败证据。

## 结果边界

41项通过证明配置与相关门禁逻辑，没有证明真实窗口隐藏、WGC连续性、焦点或创建期零闪现。
第一帧之前源窗口已经存在；当前方案只能提前移除，真实观察另行按当轮确认、新备份和核包流程安排。
本目录不是插件发行／安装入口；原生编译输出只作离线验证，不能直接覆盖日常DLL或替换已验apphost。

本轮报告见仓库`docs/TASKBAR_FIRST_FRAME_REPAIR_20261028.md`。

## 固定rc.53离线整合预检

```powershell
python dsh-whale-mist/qa/taskbar-first-frame/preflight.py --output .tmp/taskbar-first-frame-integration-<new-round>
```

要求保留已审的`.tmp/taskbar-first-frame-repair-20261028-c/`及固定rc.53原tgz。
本入口核对这两份来源指纹，将43文件解到新的本机目录，仅在该副本替换DLL，不生成安装包或改变版本。
归一化deps依赖图、8项依赖字节、旧apphost内嵌入口名逐项核对。`IntegrationProbe.cs`用PEReader读取真实DLL，不加载或执行目标程序集；同时链接已审纯协议／Runtime源码生成样本，窗口和worker操作用替身。
`host-preflight.test.mjs`只导入固定副本JS，验证帧／日志／终结清理以及回退开关；实际Host生成的三种argv再交给真实C#解析器闭环。
控制器总截止120秒，子阶段40／12／20／8秒；不运行WallpaperProbe入口，不调用其EnsureDefaultDesktop或任何真实窗口功能。
结果仍不是旧apphost实际启动或WGC／视觉验收。详细边界见`docs/TASKBAR_FIRST_FRAME_INTEGRATION_PREFLIGHT_20261028.md`。
