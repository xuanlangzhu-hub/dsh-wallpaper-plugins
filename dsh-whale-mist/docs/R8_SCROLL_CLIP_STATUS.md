# R8 进展报告（D1–D4 修正后）：下方带已复现，滞后是否真的画到屏幕仍未定

2026-10-08。基线 rc.20（源码 `F:\deepseekharness` 之外的 `F:\dsh-wallpaper-plugins`，日常 rc.1）。
依据 [R8_DIAGNOSTIC_REVIEW.md](../../docs/R8_DIAGNOSTIC_REVIEW.md)、
[NEXT_SCROLL_CLIP_TIMING.md](../../docs/NEXT_SCROLL_CLIP_TIMING.md)、
[RC20_DESKTOP_REVIEW.md](../../docs/RC20_DESKTOP_REVIEW.md)。
**状态：诊断工具已按 D1–D4 修正；`src/client.js` 仍未改动，未出 rc.21。**

## D1 已修：现在测的是卡片**下方**，并按裁剪后的可见区域判定

- 采样带用实际渲染帧的坐标计算：危险带 = `[card.bottom, scrollport.bottom]`，
  对照带 = 卡片上方 60px（那里必须能看到文字），另记录座位带 `[toolbar.top, card.top]`。
- 列边界取 `max(160, scrollport.left)` / `min(883, scrollport.right)`，不再写死 x=200。
- 判定改用「元素盒 ∩ 裁剪后可见区」的重叠面积，而不是截图：截图会把不同时刻混在一起。
  `getBoundingClientRect` 是布局盒，不含裁剪，这一点已在代码注释里写明。
- 顺带发现并修掉了我自己**同类错误的两处**：早先的 band 取证探针用 `scrollport.bottom` 而不是
  `view.bottom - clip` 作为可见下界，于是把已被裁掉的行（y 684–694，裁剪边界 552）算成"带内"，
  得出"静态也有 1 行"的错误结论。

## D2 已修：每轮只有一条 RAF 链，按帧时间戳去重

- `start()` 保存唯一 request id；`stop()` 取消它，tick 在停止后不再重排。
- 每次 `record(timestamp)` 先查 `frameTimestamps`，重复回调计入 `duplicateCallbacksSuppressed`
  而不重复计数。
- 新增自检：连续两轮各 400ms 采样，第二轮重复回调必须为 0，且两轮帧数速率差 < 0.05 帧/ms。
  实测 `97` 与 `101` 帧（重复 0），符合 60Hz 预期；旧版"32/202、48/633"这类数字作废。

## D3 已修：所有报告写在 profile 之外，并在清理前校验落盘

- 新增 `createRunDirectory()`：默认落在 `dsh-whale-mist/.tmp/<label>-<时间>/`，可用 `WM_RUN_DIR` 覆盖，
  **永不落在待删的 profile 内**。
- `verifyPersisted(path)` 在写完后校验文件存在且非空；`scroll-clip-frames`、`regions`（含 supplement）、
  `sidebar-band`、`pixels` 都已改为写 `runDir` 并校验。
- 实测落盘：`.tmp\qa-run-*\regions.json`、`supplement.json`、`band.json`、`.tmp\wm-history-pixels-*\result.json`、
  `.tmp\wm-scroll-frames-*\scroll-frames.json`；`.gitignore` 已加 `/dsh-whale-mist/.tmp/`。
- 历史 708 个目录不在本次所有权限内，未批量清理；用户已自行用 Dism++ 处理。

## D4 已修：清理只认本次登记、且校验路径边界

- `createProfile()` 把解析后的真实路径登记进本次运行的 `owned` 集合。
- `removeProfile()` 先做四道校验：参数非空 → 解析后必须在 `realpath(tmpdir())` 之内 → 不是 Temp 根本身 →
  不是符号链接/重解析点 → 且必须在本轮登记集合内。任一不满足**抛错**，不吞掉、不返回成功。
- 自测（仅用本次合成的目录，未碰工作区/旧证据/用户文件）：本轮创建的 profile 与其内报告一起被删；
  未登记的合成目录被拒；Temp 根被拒；`F:/deepseekharness/.tmp` 被拒；`undefined`/空串被拒；
  证据缺失时 `verifyPersisted` 抛错；运行结束后登记集合清空。

## 复现进展：卡片下方带确认有文字，且与裁剪滞后一一对应

用 `qa/scroll-clip-frames.mjs`（改版后）跑 5 轮共 774 帧：

| 运行 | 帧数 | 下方带有文字 | 座位带有文字 | 对照带（卡片上方） |
| --- | --- | --- | --- | --- |
| 静态 | 97 | 0 | 97 | 97 |
| 静态（第二轮） | 101 | 0 | 101 | 101 |
| 下滚 | 100 | 0 | 31 | 85 |
| 下滚后反向 | 218 | **14** | 142 | 203 |
| 纯反向 | 117 | **14** | 85 | 102 |
| 快速下滚 | 141 | 0 | 12 | 135 |

泄漏帧的形态一致：`clip` 落后一个滚动步长（如 `scrollTop=2158` 时应为 280，实测 120），
可见下界因此比卡片底**低 28px**（`visibleBottom=700` vs `cardBottom=672`），该带内出现 1–2 行。

像素对照（`qa/scroll-below-card-effect.mjs`，同一 `scrollTop=2158`）：

| 状态 | 卡片下方带（672–699）消息色像素 |
| --- | --- |
| 裁剪准确（`clip=280`，可见底 552） | **0** |
| 裁剪滞后一步（`clip=120`，可见底 712） | **1740**（集中在 y=686–695） |
| 裁剪恢复 | **0** |

所以：**滞后状态下卡片下方确实会画出文字**，而准确状态下不会。这一条现在是有效对照。

## 仍未定的一件事

帧采样反映的是「采样回调所在的这一帧」。主题在它自己的 RAF 回调里更新裁剪；如果主题的回调先跑并在
同一帧完成更新，浏览器绘制的是更新后的值，那么"采到旧值"就不等于"用户看见旧帧"。
我没有办法在无头浏览器里直接读合成器实际提交的帧，因此**不能断言这 28 帧就是用户看到的闪字**，
只能说：几何与像素都证明"若该值被绘制，就会在卡片下方出现文字"。

下一步先做这一件：在主题连续两帧写出**不同**裁剪值的那些帧上取证（值不变则不触发重绘），
或换 `Page.startScreencast` 取真实渲染帧序列并与之对齐。确认之后再改实现——
按复审要求，仍不删 RAF、不加 timeout、不加缓冲像素。

## 报告中的层级与说法更正

- 官方 0.2.0-rc.2 `ConversationBody` 在同一个 scrollBody 中渲染 `[Views, composerSeat]`；常规 active
  状态 composer 是 sticky。我此前把"消息独立滚动视口、composer 在外"写成已确认的官方结构，**该说法作废**。
- `getBoundingClientRect` 返回布局盒，不代表裁剪后的可见区域；它与 `elementFromPoint` 结果不同并不矛盾，
  两者测量的是不同东西。此前把它们当成冲突证据是错的。

## 本轮验证

隔离页检查全部通过：`check`、外观 30、壁纸外观 136、布局、区域、消息裁剪、侧栏暗带、滚动帧、
Host 46、SDK 契约。`src/client.js` 未改；未安装、未退出 DSH、未创建真实 WE 窗口。
