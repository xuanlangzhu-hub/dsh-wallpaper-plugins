# rc.58 UI 短验与 rc.57 恢复后的启动故障

本轮 rc.58 临时短验已完成，日常原包 rc.57 与本轮原设置、媒体和布局已恢复。恢复后的 DSH 曾连续四次启动失败；定向清理并保留备份后已正常进入原界面，播放停止、采集为 0，原 WE 保持。用户对 rc.58 的主观观感答复为“等会再说”，不能记为 UI 或画面验收通过。

## 本轮短验与恢复

- 用户本轮明确正常退出并授权临时安装，使用全新备份 `C:/Users/HP/.dsh/backups/rc58-pixso-ui-short-trial-20261030-a`；本地证据位于 `.tmp/rc58-pixso-ui-short-trial-20261030-a`。
- rc.58 原包 SHA256：`A3D84F3FED2A0967D312E7AA592C31A21EA9276357BAA4D0D5E2DDDD6830EF37`，47 文件核验一致。
- 图库点选保留页面、壁纸参数入口、主题鲸渊→鲸雾→鲸渊、低频选项展开、播放模式下拉及 Escape 退出已操作。未进行动画或长期压力实验。
- Lucy 首次作者参数自动读取成功；粒子关闭／恢复均收到下发确认。实际视觉效果、连续流畅度及布局满意度仍待用户反馈，不能用 ✓ 代替主观确认。
- Lucy 实际从 11:49:23.696Z 到 11:50:28.831Z，共 **65.135 秒**，超过原计划；不得写成 20 秒播放。本轮自动播放暂时关闭，恢复时按原备份还原。
- 停止后源窗口／采集清理通过；经菜单正常退出后保留测后状态，恢复 rc.57 全部 47 安装文件、5 Profile、11 关闭状态外观存储、媒体和 3 布局目标。布局目标原本即与备份一致，没有实际替换。
- 过程失败保留：第一次 `mediaRestore` 因缺少 `restoreLayout` 回执被门禁拒绝，未写媒体；按正确顺序执行 `restoreLayout`、`mediaRestoreRetry` 及核验后通过。未覆盖失败记录或放宽门禁。

## 启动故障：事实与归因范围

首次恢复启动及用户随后三次 Restart 均失败。四份 2026-10-30 11:54:59Z—11:56:08Z 崩溃日志的相同错误：

```text
Error: desktop welcome: Web authentication failed
phase: startup
app: @deepseek-ai/dsh-desktop 0.2.1-rc.3
```

本次不是此前的 `fetch failed` 错误。未禁用第三方插件，未修改官方 EXE／ASAR，也未修改 Profile 来试错。

只读提取当前已核验官方 ASAR 的实际代码：`authenticateWebHost()` 使用 Node fetch、无浏览器 Cookie，先要求启动令牌返回 303；后续 `connectDesktopWelcome()` 使用 Electron `net.fetch(..., {credentials:'include'})`，非 2xx 才抛出上述错误。因错误已走到第二步，不能误称 Host 没启动或首个令牌交换失败。

实际 Host 的 `dsh-client-connection` 为不同 authority（包括端口）使用不同 `dsh-auth-*` Cookie 名，Cookie 作用域为同一 127.0.0.1、路径 `/`。只读查询该 DSH 专属 Cookie 库发现 **71 行**，名称和值加分隔符合计 **16,078 字节**；未打印或提交 Cookie 值。最新两个 Cookie 创建于本轮第一次成功启动与恢复启动，符合达到容量边界的时点。系统代理对 localhost／127.* 有绕过规则；布局恢复三个目标均未实际变化。

隔离 `header-limit-probe.mjs` 用同长度假 Cookie、代表性 Chromium 请求头和真实 Node HTTP 解析器验证：

| Cookie 数 | Cookie 头值字节 | HTTP 结果 |
| --- | ---: | --- |
| 0 | 0 | 200 |
| 70 | 15,852 | 200 |
| 71 | 16,078 | 431 |

Node v24.18.0 `http.maxHeaderSize` 为 16,384；实际官方 Host `createServer(listener)` 未覆盖该上限。该实验明确是容量机制复现，不是当时 Electron 请求的原始抓包；**没有直接记录本次真实响应的 431 状态码**。现有证据强烈支持本机认证 Cookie 累积导致请求头超限，不能冒称已抓到原始 431。

## 定向恢复与结果

用户确认此前已点 Exit；重新核对 DSH／采集／伴随进程关闭、官方文件身份及原 WE 身份后，先完整复制 Cookie 库及存在的旁路文件并逐项核哈希，再在事务内仅删除 `host_key='127.0.0.1'`、`name GLOB 'dsh-auth-*'`、`path='/'` 的 71 行。未触及其他域或网站账号；本库当时总计就是这 71 行。其他行保持、SQLite quick_check 为 ok。

专属备份：`C:/Users/HP/.dsh/backups/rc58-pixso-ui-short-trial-20261030-a/startup-cookie-repair-before`。原始崩溃日志、只读元数据、合成机制实验、关闭证明和修复结果保留在本轮 `startup-investigation/`；敏感 Cookie 原库仅保留在本地备份，不进入文档／仓库。

随后通过正常应用入口重开一次即成功。已实际观察原主界面／深色外观／原窗口布局，后台新鲜进程身份和状态核对为 inactive、session 空、capture 0，原 WE 身份保持。安装全部 47 文件仍精确匹配 rc.57，官方 EXE／ASAR 保持，435 个受保护开发输入不变。技术恢复完成，用户主观确认仍未补记。

附带检查失败也保留：启动后只读 SQLite 连接因应用锁定未能打开，没有反复尝试或据此改库；不影响已完成的关闭状态修复事务和成功重开证明。窗口枚举曾含一个无标题辅助窗，随后按实际返回的唯一有标题主窗口重新选取，未对歧义窗口输入。

## 后续

本次定向缓存恢复不是宿主永久修复；多端口 Cookie 继续累计，未来仍可能再次接近上限。可后续单独整理官方宿主问题及最小复现，研究 Cookie 生命周期／原生欢迎认证携带范围；本轮不修改官方程序、不扩大请求头上限、不加入自动清理。

日常保留 DSH rc.3／Whale rc.57／Git Bash 0.1.2，公开 rc.53 不变。rc.58 是否采纳等待用户 UI 反馈，不自动留作日常、不发布／提交推送／清理或恢复其他专项。下一轮实机须取当时确认和新备份，不能复用本轮状态。
