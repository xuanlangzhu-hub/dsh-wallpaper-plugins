# rc.30 原生采集节奏测量候选

2026-10-15，Codex。基于 [P3 补修复审](NATIVE_PACING_P3_FINAL_REVIEW_20261015.md) 的固定输入，独立构建、打包和核包完成；用户稍后恢复工作，已临时安装并完成[三体P3前台短测](COMPLEX_SCENE_P3_FOREGROUND_RESULT_20261015.md)。日常 rc.28 和当轮设置已恢复，用户确认正常；壁纸联动时近一秒停顿未解决，不作为性能通过。

测试前用户重新确认三体播放中、自动播放未勾选、其它助手暂停且DSH无任务。本轮独立备份当时设置，未沿用上午rc.29备份。测试后用户确认日常正常、三体选择和自动播放关闭保留，保持停止。

## 候选与检查

- 包：F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.30.tgz
- SHA256：B200FEBFCC34CF06C3400BCED1FA4B52FDFE05B40E25293D235B3BB9A9E2212E
- 大小：7,370,077 bytes；28 个文件，均与打包时工作区逐字节一致。
- 相对 rc.29 仅 README.md、package.json、assets/wallpaper/WallpaperProbe.dll 三文件变化；依赖、客户端、Host、apphost 和其余运行文件不变。
- 实际 DLL SHA256：FD69D9B9C42376A99A29DAFCFA53071CB282F21D5FBF29FC738405646581FF34。
- 20 份已复审输入一致；15 份原生工程输入复制到新隔离目录，以 Release/win-x64、框架依赖方式 publish。12 个包内运行文件与该 publish 输出一致，PDB 和 QA 源码不入包。
- npm run check 通过；实际发布 helper 的 --self-test-native-pacing 通过，ok=true、mismatches=0、r1Checked=true、snapshotFields=22，未创建真实壁纸窗口。
- 日常 rc.28 的 28 个安装文件与原归档一致，五份 Profile 配置保持。活动 rc.28 与历史 rc.29 归档未覆盖。

该轮仅更新工作区版本、说明及原生构建资产，未改已复审实现。既有 P3 五类、P1 九类和真实 Host 接缝证据继续有效，不为打包重复 GPU、P2 或长时测试。包内 README 是候选快照，后续实机结果另行记录，不覆盖同版本包。

## 观测范围

增加实际请求等待/恢复、记录后工作、状态写入、空帧重试、完整循环间隔和总工作耗时，保留 rc.29 的前端分段观测。计数和总耗时取阶段增量；累计 max 不能当阶段 P95，零计数均值为未知。

状态写入包含在记录后工作内，不能重复相加；实际等待包含线程调度及恢复到读时钟的时间，不等于 GPU 或屏幕呈现耗时。前端 drawCount 仍是同步 drawImage 调用完成计数，不是物理屏幕 FPS。

30fps 目标、即时预算、原有整数截断与最低 1ms 等待、尺寸/质量/设备策略、RAF、输入裁剪、主题和自动播放验证名单保留，不改全局定时器。打包时尚无新的真实耗时结论；本轮约46ms周期已通过结果记录进一步拆开，但仍未实施优化或通过性能改善验收。

## 本轮执行

1. 已重新确认当前条件，备份五份 Profile 和十个关闭状态外观文件。
2. 官方 CLI 临时安装 rc.30，28 个安装文件核验一致。
3. 同run/1302×776/30fps目标的前台静止与鼠标窗口各19样本，22原生/36前端字段与覆盖通过；请求/实际等待偏差约13.2ms，鼠标段另有55次前端覆盖和984ms帧龄新高。
4. 已保存测试后数据并恢复rc.28及本轮原设置；原WE/官方文件保持，自有窗口与capture/worker为0，用户重开确认正常。下一步按结果记录拆分等待优化与前端积压调查。

不自动扩大为 GPU 矩阵或长测，不盲升 FPS，不要求 Gemini 继续返工已通过的 P3。

## 证据

目录：F:\dsh-wallpaper-plugins\.tmp\rc30-p3-candidate-20261015-c75091a4

- before.json、workspace-before/、native-source/：固定输入与打包前资产/元数据备份。
- native-publish/、publish.log、native-runtime-hashes.json：隔离发布及包内原生文件指纹。
- published-selftest/、published-selftest.log：实际发布 helper 的合成数值检查。
- check.log、npm-pack.json、audit-candidate.py、package-audit.json：检查与独占写入归档审计。

未提交或推送。
