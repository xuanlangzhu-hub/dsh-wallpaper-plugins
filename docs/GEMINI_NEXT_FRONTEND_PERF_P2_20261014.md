# 给 Gemini：P2 前端等待、解码与画布调用观测

2026-10-14最新接续：[P2最终复审通过](FRONTEND_PERF_P2_FINAL_REVIEW_20261014.md)。R1–R4已闭合，Codex另补停止计时的一行回归，P2十类/P1九类/check/Host105和独立实际接缝通过；Gemini无需继续返工。下一步由Codex准备独立测量候选，再协调用户短测；日常rc.28保持。以下R1–R4暂不通过为修前历史，不机械按旧范围继续编码或自动开窗/安装。

2026-10-14当前接续：[P2复审R1–R4](FRONTEND_PERF_P2_REVIEW_20261014.md)。原P2八类/P1九类/check/Host105和实际canvas/完整离线接缝正例已通过；仅补迟到解码跨run污染、异常位图释放、RAF句柄0/旧回调归属、分类总和不一致的P2比较门禁及实际反例回归。证据/源码快照见复审记录，保留已通过部分和活动rc.28，暂不打包/安装/实机。以下为原范围，不重新造测量平台或提前优化播放策略。

2026-10-14。先读 `AGENTS.md`、`NEXT_TASK.md`、[P1 前台实测结果](COMPLEX_SCENE_P1_FOREGROUND_RESULT_20261014.md)。P1 工具和首次实测已经完成；这一小步补前端缺失的时间/原因字段，之后交 Codex 复审并决定最小优化。**本任务不承诺提高帧率，不同时改调度策略或重写画面链路。**

## 为什么做这一步

同一三体运行的两个约20.5秒窗口，Native/Host 都约22.3fps，client 接收也约22.3fps；client 解码后 rendered 从22.31降到18.98fps，待处理旧帧覆盖增量0→64。窗口相隔约7分12秒，不是鼠标唯一因果证明。现在不知道额外旧帧覆盖发生在等待 RAF、JPEG 解码还是同步绘制/界面更新期间。

`src/client.js:471` 在 `emitFrame` 前增加 rendered；`paintWallpaper` 的 `drawImage` 在 `:1126`。旧字段的语义必须保留但说明纠正；不要继续称它为 canvas 成功绘制或真实呈现 FPS。`decodeErrors` 的 catch 覆盖解码和订阅者调用，新增原因统计要据真实失败阶段区分。

## 编码范围

工作区 `F:\dsh-wallpaper-plugins`；主要是：

- `dsh-whale-mist/src/client.js`：只在实际流/调度/解码/订阅者和 `drawImage` 接缝补计数与耗时。
- `dsh-whale-mist/src/wallpaper/session.js`：现有 `/whale-wallpaper/metrics` 的可选字段清洗/转存，保留2048字节上限及向后兼容。
- `dsh-whale-mist/qa/perf/watch-playback.mjs`、`analyze-playback.mjs`、`check-playback.mjs`、对应 README：必要的新字段保留、区间分析、真实口径说明与数值 fixture。
- 复用现有 appearance harness、wallpaper route/session 检查补实际接缝测试；可以增加一个小型 `qa/perf/check-frontend-stages.mjs`。不要另造浏览器平台或扩大旧 CPU/GPU 采样器。
- 新交付记录 `docs/FRONTEND_PERF_P2_DELIVERY_20261014.md`。

其它生产/原生/assets、版本/package.json、活动 tgz、Profile、安装和历史证据保持原样。日常还是 rc.28；未来候选单独定版本和核包，不能覆盖同版本归档。未明确列出的文件若确实必需，先在交付说明具体依赖，不作整文件重写。

## 必须落在实际执行点的观测

1. **等待回调**：从安排一次 paint 到该次 RAF 或兜底回调实际执行的时间；区分触发来源，记录未执行而被取消的安排。使用单调计时，不能用 `Date.now` 的墙钟差当阶段耗时。一个安排只计一次，RAF/timeout 的取消与现有语义保持。
2. **解码**：等待 `createImageBitmap` 的时间与有效次数；同步记录成功、失败、解码后因隐藏/旧generation被放弃的情况。不要把 listener/draw 异常算成新的 decode 失败。
3. **同步处理与画布**：分别记录真实 `emitFrame`/必要同步状态通知的处理时间，以及真实 `drawImage` 调用次数与耗时；无图层、无canvas、过期/停止不能计成成功绘制。`drawImage` 返回只证明调用完成，不能称为物理呈现。计时必须覆盖实际代码，不能仅在 fake sink 或 controller publish 处猜绘制。
4. **覆盖原因**：保留现有 received/rendered/dropped 的行为；对 `latest` 被新帧覆盖，按当时真实状态区分正在解码/同步处理、等待回调或其它状态。分类尽量互斥并能核对到原 dropped 增量；解码后隐藏/取消丢弃另计，不能塞进旧 dropped 改历史语义。分类仍不是鼠标因果证明。

采用少量有界累计 count/sum/max 等字段，报告时可用同一run内 count/sum 差算阶段均值。样本数为0时均值为unknown，实际测到0ms才允许0；缺字段/非有限值/计数回退或跨run不能补成0。累计max不能冒充本阶段max/P95，无逐样本覆盖就不生成阶段P95。用现有500ms上报，不添加每帧console、磁盘日志、图像落盘或硬件/窗口查询。

每一轮的统计对象、起止和generation明确绑定；迟到解码、旧回调、旧订阅者报告不能改变新一轮计数或帧。报文字段名/单位/重置点/零值与缺值语义写进 README；完整 JSON 在真实 route 的2048字节限制内。Host和观察器必须实际保留新字段，不能只在 UI snapshot 增加然后被 allowlist/sanitizer 丢掉。

## 需要的验证

- 在现有 controller 的真实 stream→accept→schedule→decode→订阅者路径，用可控的单调时钟/RAF/解码Promise区分三种故意延迟；画布指标通过真实 `paintWallpaper` 路径的 fake canvas `drawImage` 验证，不仅测试独立聚合函数。
- RAF/兜底竞合仅计一次；latest在等待期间和解码期间被覆盖有正确分类与次数；hidden、失败、停止/重启、旧generation迟到均不误记新run。
- 同步 listener/draw 抛错与解码失败能区分；无图层/无canvas不计成功。既有 bitmap 所有权与 close 行为、latest-only、250ms兜底、流超时/清理保持。
- client→Host route→preview-status→观察器→分析器走一次真实接缝，含完整字段报文大小、旧版缺字段、无有效事件、实际0耗时、累计max不当阶段值、跨run/回退拒绝或unknown的数值断言。
- `node --check`、既有P1九类检查与相关appearance/Host检查通过；新检查要能因错误接缝失败，不只断言实现原样。

消息裁剪/历史RAF、输入区几何、主题/侧栏/桌宠、播放选择/自动播放、开始/停止/重启、任务栏取消清理不得改变。不删除RAF/兜底、不提高采集上限、不加队列、不改全局GPU/FPS，不改JPEG质量/尺寸或引入硬件视频；这些都要等数据支持再另定范围。

## 交付与下一步

交付记录列实际文件、字段语义、执行命令/结果、证据位置、报文最大尺寸和仍unknown的部分。原始输入与结果写独立 `.tmp` 目录，不清理/覆盖历史。

本任务仅编码和离线验证，不打包/安装、不操作DSH/WE或真实窗口，不提交/推送。交 Codex 复审，之后由用户操作一次短实测决定是否优化具体接缝；不要自行启动实机或重跑P1/GPU/长测。源码位置以当前文件为准，本任务中的行号只用于定位基线。
