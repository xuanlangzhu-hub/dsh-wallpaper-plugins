# 性能采样工具修复与静态接口结论

2026-10-09，Codex 接手。接续 [初次复审](PERF_SAMPLER_REVIEW.md)。生产候选仍 rc.23，日常仍 rc.1。
本轮只修 QA 工具和文档，没有启动真实壁纸窗口、操作 DSH、安装插件、改 Profile 或源资产。

## 已修复

- PowerShell 语法根因是原脚本第 94 行的 `/** ... process's ... */`：这种注释格式不属于
  PowerShell，单引号干扰后续解析，最终错误出现在第 457 行 `}`。替换为 `#` 注释后整文件解析通过；
  不是根据花括号数量盲目增删。
- CPU 先取旧值再计算，保存真实 delta/elapsed；缺失保持 null，并清掉差分基线。恢复后的首读不跨缺口
  计算。利用率按总有效 delta / 总有效时间 / 逻辑处理器容量汇总。
- 查询限定 `pid_<id>_*`，缓存实际路径，读时再筛 PID；每轮复核 StartTime，阻塞 GPU 查询结束再复核。
  PID 复用或身份不可读时排除对应数据并标记 `identityStable=false`。
- GPU 四项内存默认 null，有效零保留；有效状态包含 0/1。单项无效不丢其它有效值，非终止 provider
  错误随有效返回保留。真实包装函数的 null、部分错误与 timestamp 用替代 Get-Counter 验证。
- 保留接受的 GPU 原始 path/instance/status/value/provider timestamp；无效项记录实际状态与原因。
- availability 与 activity 分开，真零空闲不当故障。拓扑排序后比较；A→B→A 明确分段，查询失败为 unknown。
  覆盖字段区分已知/未知样本，不再把未知段称作“全阶段一套适配器”。
- 四项内存按 LUID 分别给有效样本均值/计数，不把随时间相加的字节数称作内存占用；输出原子创建。

## 验证范围

入口：`dsh-whale-mist/qa/perf/check-sampler.mjs`。完整脚本在确定性 fixture 下执行，
进程身份、CPU、硬件容量、GPU 和适配器均替代；无真实窗口、无实时系统计数器。
另有从 PowerShell AST 提取真实 provider 包装函数的替代 Get-Counter 检查。

中间的 21/21、23/23、24/24 与最早 6/9 结果保留，不能混为最终结果。

- 最终结果：25/25 通过，含整文件 ParseFile 和真实 provider 包装函数的替代调用。
- 最终证据：`F:/deepseekharness/.tmp/perf-sampler-repair-20261009-145646/sampler-check-B1NfY6/results.json`，同目录保留输入、每例输出与运行日志。
- 原始脚本、测试、报告备份：`F:/deepseekharness/.tmp/perf-sampler-repair-20261009-145646`。
- DS 原始实时输出：`F:/dsh-wallpaper-plugins/.tmp/perf-rc24`，未修改/清理。

这证明已列故障的解析和数值/归属回归通过，不代表本机实时计数器本轮已重新验收。
旧机器速度/硬件/权限值是 DS 当时快照。采样器没有整卡 GPU 比例、功耗/时钟，也不保证窗口和 GPU
读数同步；正式对照必须检查各指标覆盖、错误、阶段身份及实际尺寸/FPS。

## Lucy 独立限帧/质量静态调查

依据 [Wallpaper Engine 官方 CLI](https://help.wallpaperengine.io/en/functionality/cli.html)：

- `openWallpaper -playInWindow` 支持唯一窗口名、位置、宽高与无边框；宽高是窗口尺寸控制，
  实际渲染/采集物理像素仍需测量，不能直接称同画质优化。
- `applyProperties -location <窗口名>` 可定位该窗口的壁纸属性；属性应来自该项目声明/Share JSON。
  文档示例里的 `rate` 不能据此视为通用渲染 FPS 参数。
- 该公开 CLI 页未列独立窗口 FPS/通用质量控制；pause/stop/play/mute 为全部壁纸动作，不用于这轮限帧。

只读核对本机 `E:/SteamLibrary/steamapps/workshop/content/431960/3521337568/project.json`：
`type=scene`，`file=scene.json`。全部 19 个属性声明中未见 FPS 或通用质量滑块。
存在 `particles`（粒子）、`newproperty10`（光照）、`newproperty1`（水袋）、`newproperty`（开场动画）
和时间组件等外观开关；这些是场景内容选项，不是已验证的限帧接口。
关闭它们可能改变观感/资源成本，但本轮未发送属性命令、未验证动态应用范围或实际收益。
本轮只读声明与文件指纹另存为上述备份目录中的 `lucy-property-declarations.json`。

结论：目前没有找到可据以实施的独立渲染 FPS 上限。若继续，先做固定质量 A→B→C→D→A 对照；
需要降成本时，单独比较受约束的尺寸或一个场景属性，明确观感代价，不能顺手修改全局 WE 设置。

PDH 状态依据 [Microsoft 数据状态文档](https://learn.microsoft.com/en-us/windows/win32/perfctrs/checking-pdh-interface-return-values)：
VALID_DATA 与 NEW_DATA 都是成功数据状态；函数调用成功与具体计数器数据有效性应分开判断。

## 下一步

工具交付后先确定阶段进程清单、独立输出目录与用户配合的窗口时段，再做 30–60 秒阶段对照。
当前没有开始正式阶段采样，不打 rc.24 包，不把这轮 QA 修复当成插件性能优化。
