# P3 补修复审通过

2026-10-15，Codex。复核 [Gemini补修交付](NATIVE_PACING_P3_DELIVERY_20261015.md) 与 [首轮R1–R3](NATIVE_PACING_P3_REVIEW_20261015.md)。**R1、R2已修复；R3新增真实C#测量方法及二进制自测，Codex另补实际Host报告链路和一致虚拟时钟控制，均通过。本轮P3观测实现通过离线复审。**

这不是实机节奏/帧率改善验收。日常rc.28、生产assets和rc.28/rc.29归档保持，本轮未改实现/打包/安装/打开真实窗口/操作DSH或WE/提交/推送。

## 三项结果

| 项目 | 本轮独立核验 |
| --- | --- |
| R1 请求算法与预算边界 | 实际循环在等待点重新读取elapsed，实际编译程序集中的ComputePacingRequested恢复int截断与最低1ms；15.6→17、15.3→18、17.8→15、34→1均通过 |
| R2 缺计数隐藏回退 | 重跑首轮相同完整入口反例：nativePacing.valid=false、dataReady=false、P3差值null；保留reset与invalid原因，不再丢弃异常中间样本 |
| R3 实际计时/Host接缝 | 实际编译程序集的等待/记录后测量方法、ProbeJournal序列化、真实createPreviewSession日志订阅和1s报告写入、watch、完整analyze均通过数值/字段核对 |

额外边界控制：正常输入均值10/25保持有效；旧日志全部无P3仍可正常分析；合法零计数对应均值null；1e309经完整入口继续拒绝，未作为缺陷。永久专项现已使用固定资产SHA，摆脱mtime比较。

## Codex补充的真实接缝控制

Gemini提供的自测执行了新的原生方法、原生序列化与分析入口，但其专项Test5仍直接从生成文件进入分析，没有经过真实Host报告。Codex在独立证据目录补齐该环节，不再为这一测试缺口要求重做主体：

1. 加载本轮独立构建的实际WallpaperProbe.dll，通过反射调用其实际NativePacingTracker与ProbeJournal，不复制实现或改生产文件。
2. 一致虚拟时钟A：编码15、记录后8.33、总工作23.33ms，请求10/实际25ms；另有三次空帧请求2/实际5ms。
3. 一致虚拟时钟B：编码15、记录后20、总工作35ms，此时应请求最低1ms，注入实际5ms，控制通过。两组分开，避免把“总工作35ms”和“30fps仍请求10ms”混成同一预算。
4. 原生生成的两条完整Status日志字节注入真实Host session的假子进程stderr；helper/窗口与WHL1/client进度为明确的合成fixture，没有调用真实窗口操作。
5. 等待真实1s Host报告定时器写preview-status.json，真实watch采到40样本，全部22项数值逐样本精确保留。
6. 完整分析得到请求10、实际25、偏差15、记录后8.33、总工作23.33、空帧3次/实际均值5ms，state=synthetic且dataReady=true。

这是软件接缝与口径控制；回放帧/秒标记和前台声明是fixture，不能当实际FPS、OS可见性、系统等待偏差或鼠标实验。Gemini自测中10/25及20/35是分项输入，不应从其标记拼成一帧完整耗时。上述A/B控制独立确认真实方法按一致预算工作。

后续可将本轮host-bridge及clock-control纳入长期QA；当前已落盘并可复跑，不需要为此再返工或重跑GPU。

## 复跑与保护

- 固定20份审查输入，新独立目录构建实际工程：0警告/0错误。
- npm run check、P3五类、P1九类通过；Host/P2实现未改，本轮不重复无关整套。
- 5组独立完整入口控制均通过；实际程序集4预算边界及A/B虚拟时钟、实际Host接缝通过。
- 20审查/32保护输入和5份Profile前后指纹一致；日常rc.28安装28文件结束时再次匹配原归档；生产原生资产不变。

## 下一步

无需Gemini继续补R1–R3。Codex可准备独立的新测量候选，使用已固定的P3源码隔离构建并核包；不覆盖rc.29，日常回退仍为届时rc.28与当轮原设置。

候选核验后，先确认用户方便，再做同场景短前台观测，读取真实请求等待/实际恢复、记录后工作与空帧成本。此时才回答约46ms采集周期的主要来源；当前根因仍unknown，不盲升FPS、改全局定时器或重写视频链路。

## 证据

本轮：F:\dsh-wallpaper-plugins\.tmp\native-pacing-p3-second-review-20261015-2dcd23df

- before.json、source-reviewed/：固定输入/保护基线；
- native-source/、build/、build.log：独立实际工程；
- check.log、p3-check.log、p1-check.log：复跑；
- clock-control/、clock-control.json、clock-control-journal.jsonl：加载实际程序集、时钟控制及实际原生日志字节；
- host-bridge.mjs、host-run/、host-observation/、host-analysis/、host-bridge-result.json；
- verify-host-fields.mjs、host-field-preservation.json：40样本/22键精确核验；
- independent-regressions.mjs、independent-regressions.json与各控制输入/分析：首轮反例及合法边界；
- after.json、daily-final.json：20/32/5指纹与日常28文件保护。

首轮失败报告和全部原始证据保留为历史，不再按旧指针继续返工。
