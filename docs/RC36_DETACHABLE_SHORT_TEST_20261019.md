# rc.36 实机短验中断，日常 rc.35 和原设置已恢复

2026-10-19，Codex。用户授权“已退出，可以短验”，本轮按[候选复审计划](RC36_DETACHABLE_CANDIDATE_REVIEW_20261019.md)操作；Windows Computer Use 在读取独立 Edge App 窗口时因 URL 识别策略停止。本轮没有完成独立窗口交互验收。用户随后确认“已退出”，已恢复日常 rc.35 和原设置；接续用户回复“正常了”，**恢复后的正常重开、外观布局和播放停止已获用户确认，本轮恢复收尾**。

## 本轮备份与安装

- 证据：`.tmp/rc36-detachable-short-trial-20261019-c42a1b90`。
- 新备份：`C:\Users\HP\.dsh\backups\rc36-detachable-short-trial-20261019-c42a1b90`，5 个 Profile、实际关闭状态 Local Storage 的 9 个文件逐项哈希核验；另存原桌面设置、Preferences、Local State、活动 rc.35 文件和两份固定包。
- 本轮原 WE：PID 11780，启动身份 `2026-10-19T00:49:08.4024581Z`，路径为既有 wallpaper64.exe。只作身份核对，没有终止或改 WE。
- 固定 rc.36：SHA-256 `DCF07386808BC5DD50522AF9143A3840E0B485F6881907D640F744D80B0DF8D5`；安装前日常 rc.35 的 28 项逐字节匹配固定原包。
- 官方 CLI 确认为 0.2.1-rc.2，以 `plugin --profile desktop add` 安装固定 rc.36。首次校验由旧 PowerShell 启动，因 Get-FileHash 不可用在安装调用前退出；只修本轮监督脚本使用当前 pwsh，未改产品或系统配置。首次失败日志保留。
- 实际安装退出码 0，约 73.8 秒。pnpm 有网络重试，90 秒总限内正常完成，无强制结束。35 个安装文件逐字节匹配候选；9 个关闭存储文件不变，Profile 仅 package.json 和 pnpm-lock.yaml 发生安装变更。

## 已观察到的实机行为

以下来自本轮 Windows 界面观察，不扩称用户主观验收：

1. 正常重开原 DSH，已有会话和原布局可见，没有运行任务；顶栏出现“Whale 外观”入口。
2. 点击顶栏入口，右侧快捷设置面板出现，包含图库、分级、四项效果、主题、文字可读性、强调色和预设入口。
3. 默认仅“所有人”选中，其余两档未选；列表显示 Lucy，原所选隐藏条目显示已被分级筛选隐藏，不能开始。没有打开成人预览。
4. 点击 Lucy 后，预览、选中标记和“已验证”出现，仍显示未开始播放。开始按钮当时仍禁用：尚未核对其与当前背景来源/控制器状态的关系，**仅记待查现象，不判定为已确认产品故障**。
5. 点击“弹出独立窗口”，窗口清单出现真正独立的 Edge 顶层窗口，标题“鲸系外观 · 独立设置”。尚未成功读取其页面状态，不能把窗口标题存在写成页面/桥接/吸附交互通过。

读取独立窗口状态时，Computer Use 返回：

> Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy. Stop your work and send a final message noting why Computer Use ended.

按要求立即停止本轮电脑操作并告知用户，没有绕过策略、换自动化接口继续读取或点击，也没有把策略停止归因成插件故障。没有实际点击开始播放。

**未覆盖**：独立页内容、主/伴随双向同步、独立→吸附→再独立、关闭后的主界面状态、全不选分级、预设操作、Lucy 播放/鼠标/停止清理及长期体验。离线核包通过的结论保持，实机整体未验收。

### 用户补充：独立窗口出现后的 Windows 确认消息

恢复后用户补充：独立窗口弹出时出现一个记忆中与“Windows 信息收集确认”有关的消息，用户已点击确认，认为提示现已消失；用户推测可能是系统提示而非插件问题。未取得完整标题、正文或该提示截图，其来源、触发条件及是否与 Computer Use 的 URL 识别失败有关均未核实。此反馈作为用户观察保留，不归因为 Windows 关键词触发，不判定插件故障，也不据提示消失认定工具限制已经解除。没有据此重新安装候选或继续操作受阻窗口。

## 已恢复的日常与现场

用户关闭独立窗口并正常退出 DSH 后，先核对 DSH、WallpaperProbe 和带独立 profile 的 companion Edge 进程为 0，再执行恢复。

- 重新安装前保留本轮 Profile 至 `profile-before-rc35-reinstall`；官方 CLI 安装固定 rc.35 退出码 0，约 2.4 秒。
- 恢复前保留测试后 Profile 和完整 Local Storage，再恢复本轮原 5 个 Profile、9 个存储文件；没有删除会话、附件或旧备份。
- rc.35 的 28 个安装文件、5 个 Profile、9 个存储文件逐项核验一致。
- 原 desktop/settings.json、Preferences、Local State 均未变，无需覆盖；官方 EXE、app.asar 和 WE 文件保持，原 WE PID 与创建身份保持。
- 工作区 202 项源码/QA/资产/归档保护输入一致，无实现变更、重新构建、提交、推送或清理。这里只更新实机记录和接续入口。
- 最终关闭态证据：`restore-final-verification.json`、`restored-daily-with-settings.json`、`settings-restored.json`、`restore-package-result.json`。DSH 保持关闭，等待用户按日常方式重开，确认原外观/布局正常且播放停止；未声称已经完成重开验收。

关闭态证据之后，用户已按上一条恢复确认问题回复“正常了”。此项是用户反馈，未另外进行窗口采样或改设置。下一步用户改排 Grok 后台协作接入；本轮不再尝试 rc.36。若日后继续 rc.36 短验，另行确认当前方便并重新备份；需安排能合规读取该独立窗口的操作路径，或由用户操作独立页再反馈。不要重复安装后直接重试同一受阻接口，也不要自动给小 G 派产品补修。定时保持 PAUSED，A/三体/GPU 不重启。
