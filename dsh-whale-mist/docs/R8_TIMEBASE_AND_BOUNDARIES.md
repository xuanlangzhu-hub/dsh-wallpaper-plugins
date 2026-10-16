# R8 第四轮（T1–T4 修正）：探针时间基准已校准；「滞后」与「旧帧」两个解释都不成立

2026-10-08。基线 rc.20。依据 [R8_THIRD_REVIEW.md](../../docs/R8_THIRD_REVIEW.md)。
**`src/client.js` 未改动，未出 rc.21。** 本轮先修确定的问题，再继续定位。

## T1：时间基准（已修，且实测有效）

**问题**：`scroll-painted-view.mjs` 把页内 `performance.now()` 与 Node `Date.now()` 直接比较，
所以每帧都落到最后一条 tick 上——"98 帧 scrollTop 全 0"是这个 bug 的产物，不是浏览器交付旧帧。

**修法**：

- 新增 `qa/frame-pairing.mjs`：三种时间明确分开
  - **generated**：`metadata.timestamp`（协议定义为 `Network.TimeSinceEpoch`，epoch 秒）。
    本机实测字段为 `offsetTop/pageScaleFactor/deviceWidth/deviceHeight/scrollOffsetX/scrollOffsetY/timestamp`，
    **没有** `monotonicTimestamp`，因此不假定它存在；
  - **delivered**：本机 epoch 毫秒，只用于量传输延迟；
  - **sampled**：页内 `performance.now()`，配合 `performance.timeOrigin` 换算。
  换算 `pageTime = timestamp * 1000 - timeOrigin`；超出容差的样本标 `unmatched`，不放大容差去凑。
  另输出 calibration（偏移范围、负偏移数）。
- 新增 `qa/check-pairing.mjs`：**纯逻辑人工序列自检**（不启动浏览器），8/8 通过，其中第 1 条就是
  复审给的那个序列（`(100,0),(200,160),(300,320),(400,0)`）——旧代码三个帧全落到最后一条，
  修正后落回正确样本，且 `distinctScrollTops >= 2`。
- 新增 `qa/scroll-calibrated-frames.mjs`：唯一绘制帧入口，用上述配对；每帧记录 generated/delivered/
  sampled 三个时间、配对误差、该帧所在样本的几何与裁剪值。
- `qa/scroll-frame-metadata.mjs`：只读探测本机 screencast 元数据字段与页内时钟，用于校准来源。

**实测**（reverse 场景）：141 帧、**matched 141 / unmatched 0**、平均配对误差 **1.62 ms**（最大 3.5 ms）、
**32 个不同 scrollTop**（0…2478）——不再是"全是 0"。

## T3：junction 绕过（已修）

`assertOutsideProfiles` 原先用 `resolve()`（纯语法解析），现在改为**物理路径**：向上找到最近存在的祖先，
`realpath` 之后把尚不存在的后缀拼回去；Windows 下按大小写不敏感比较；父子两个方向都查
（既拒绝指向 profile 内的链接，也拒绝把 profile 包在里面的目录）。

合成回归 `qa/temp-profile-boundaries.mjs`（只用本轮合成目录）：

| 用例 | 结果 |
| --- | --- |
| 直接写入 profile | 拒绝 |
| 经 junction 的 `result.json`（`evidencePath`） | 拒绝 |
| 经 junction 的路径（`assertOutsideProfiles`） | 拒绝 |
| 经 junction 指向**已存在**文件（`verifyPersisted`） | 拒绝 |
| 经 junction 且后缀**尚不存在**（`new/nested/report.json`） | 拒绝 |
| 覆盖在正常外部目录 | 采纳、校验、cleanup 后仍存在 |

## T4：run 目录同毫秒重名（已修）

`WM_RUN_DIR` 分支原先 `Date.now()` + `mkdir`，同标签同毫秒会返回同一目录。现在**两个分支都用
`mkdtemp`**：校验基目录后在其下分配唯一新目录。自测：默认分支唯一、自定义分支唯一且落在基目录内、
**冻结 `Date.now` 后仍唯一**。

## T2：撤回上一轮的排他性解释

复审说得对：第一张有字、第二张无字，只能说明所读状态与两次异步取图不一致，
**不能**唯一归因于"截图返回旧帧"，也不能排除用户报告的瞬时呈现。
`docs/R8_PAINTED_FRAMES_STATUS.md` 中的「已推翻自然滚动泄漏」已撤回，改为"原因未区分"，
原始图片与数据保留。

## 定位进展：校准后，"滞后"与"旧帧"都不是原因

同一入口、reverse 场景，三组独立数字：

1. **裁剪写入本身**：32 次写入，与写入时刻应有值对比，**落后 0 次**（`WRITES {"total":32,"behind":0}`）。
2. **滞后帧与带内文字不相关**：`clip < expectedClip` 的帧 7 个，其中带内**有文字 0 个**；
   带内有文字的帧 6 个，其中 `clip < expectedClip` 的 **0 个**（全部 `clip == expectedClip`）。
3. **采样器里那 16 个"滞后样本"是采样顺序假象**：采样器的 RAF 回调与主题的 RAF 回调在同一帧内，
   前者可能先执行，读到的是本帧尚未更新的值；写入检查（第 1 条）证明写入值时并没有落后。

也就是说：**在这套夹具里，裁剪在滚动期间始终正确**，卡片周围出现的文本像素不能由"边界滞后"解释。
它更可能来自**帧归属的不确定性**（1.6 ms 配对误差、编码与投递延迟）：被扫的那张图的内容，
可能并不精确对应它被配到的那一刻几何。要把这一点分开，需要"同一帧内绑定几何与画面"的手段，
而不是继续用近似配对。

## 下一步

- 保留这唯一入口与已校准的时间轴，不再新增近似探针。
- 负对照按复审要求**只作用于目标裁剪写入**：分别记录计算值/计算时间/真正写入时间，
  正常版与延迟版共用同一测量器；先证明该对照在滚动中确实产生可见错位，再用它的阳性结果校验检测能力。
- 只有拿到可信的失败循环后才定位生产裁剪。未拿到就交具体限制，不把"没测到"写成"没有"。

## 已确认不变

顶部遮挡、左上角点、侧栏暗带、两个区域开关、消息裁剪、host 46 项与 SDK 契约照旧通过；
`src/client.js` 一行未改；未安装、未退出 DSH、未创建真实 WE 窗口；历史临时目录未动。
