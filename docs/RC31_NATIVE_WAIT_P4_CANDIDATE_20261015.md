# rc.31 P4 原生局部等待短测候选

2026-10-15追加：[三体 P4前台短测已完成](COMPLEX_SCENE_P4_FOREGROUND_RESULT_20261015.md)。实际kernel-highres-worker、等待偏差0.46/0.40ms、周期33.93/33.56ms、送帧计数29.48/29.80每秒；用户反馈好了很多、未见明显卡顿。本轮停止清理通过，日常rc.28及五Profile/十外观文件已恢复、28安装文件一致，用户重开正常保持停止；原WE保留。以下“尚未安装”为核包时快照，不能作为当前状态。

2026-10-15，Codex。基于 [P4 最终复审及文档收尾](NATIVE_WAIT_P4_INTEGRATION_FINAL_REVIEW_20261015.md) 的固定输入，独立 publish、打包和核包完成。用户已授权继续准备候选并进入后续临时安装/短测流程；核包阶段尚未安装或操作 DSH/WE，正式退出/短测前仍需确认届时方便及无运行任务。

## 候选与核包

- 归档：F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.31.tgz
- SHA256：F1C5B2A3ADCD2BA9B67CC3D432CDB8637B140ADDEDFD520D19CA0BB1B11965DB
- 大小：7,384,632 bytes；28 个文件。
- 相对不可变 rc.30，仅 package.json、README.md、assets/wallpaper/WallpaperProbe.dll 三文件不同；客户端、Host 和其它运行依赖保持。
- 实际发布 DLL SHA256：5CD02541DC6C7F252168E100E17A77D47947EACF66068055F7ACD57508294C90。
- 冻结并核对 26 份已复审输入（含已更正交付），18 份原生工程输入在新目录以 Release/win-x64、框架依赖方式 publish；12 个包内原生运行文件与输出逐字节一致，不含 QA 源码/PDB。
- 实际发布 helper 的 --self-test-native-wait 54 项通过；--self-test-native-pacing 的 ok=true、mismatches=0、r1Checked=true、snapshotFields=22；npm run check 通过。
- 包中的真实等待实现由已复审源码编译，包含 NativePacingDelay、KernelWaitTimer 及正式 ParentStopChannel；没有使用旧 assets DLL 误包。

候选在独立 package-stage 中设置版本并替换发布运行文件，28 个包内文件均与暂存目录一致。开发工作区 package.json 仍为 rc.30、生产 assets 与固定哈希基线保持；这种构建边界避免让候选准备破坏原 QA 的 rc.30 保护门禁。安装时只使用上方独立 rc.31 归档，不直接安装工作区目录。

已复审的实现不改，既有 20 个独立控制、P3 五类及父停止共用入口的证据继续有效，不为打包重复 GPU、P2、Host 全套或长测。

## 实际行为与测试边界

普通 pacing 使用每 capture 最多一个后台等待线程、异步 continuation 和单 pending 请求。高精度创建失败明确记录原因并回退 Task.Delay，稳定父 token 的回退取消源按实例复用。正式 stdin stop/EOF 可取消在途等待，退出结清任务、确认线程退出后释放句柄；运行故障当次传播。

保留 30fps 目标、即时预算/整数截断/最低 1ms、空帧 2ms Task.Delay、P3 22 字段以及 P2/前端/Host。未改全局定时器、设备/尺寸/JPEG、RAF、主题和自动播放名单。后端诊断仅在启动时记录一次，短测需确认实际选择。

历史原型与组件数据证明局部等待有改善方向，原始逐轮 precisionGoal=false 保留，不能宣称新版真实播放已达到 30fps。壁纸响应鼠标移动时近一秒停顿仍是单独待观察症状，不能承诺本次等待接入已解决。

## 当前保护与下一阶段

核包结束时，26 复审输入、54 工作区保护文件、五份 Profile 保持；日常 rc.28 的 28 个安装文件与活动归档一致。旧 rc.28/29/30 均未覆盖，工作区 12 份原生运行资产仍为 rc.30。尚未改安装、Profile 或 Local Storage；未操作/退出应用、创建源窗口、实采、提交或推送。

下一阶段依序：

1. 确认用户方便、其它助手暂停、DSH 无运行任务；由用户正常退出 DSH，先不重开。按届时状态保存五份 Profile 与关闭状态的 Local Storage，不复用上午或前轮备份。
2. 核验 DSH/本轮 capture 与 worker 已结束，保留原 Wallpaper Engine 与官方文件；官方 CLI 临时安装本归档，逐文件核对实际安装后再由用户打开。
3. 用户手动开始同一三体 scene，保持窗口尺寸和外观，前台静止与移动鼠标各约 20–30 秒。同 run 读取既有日志，核对实际后端、请求/实际等待、完整周期、送帧/draw 计数、前端帧龄与覆盖；记录用户体感。
4. 停止并核对本轮源/capture/worker 退出，保存原始证据；按本轮备份恢复 rc.28 和当前设置，再由用户重开确认。是否以后保留新包由用户体验另定。

rc.30 的 13.2ms 等待偏差和约 46.4ms 周期仅作历史参考，跨 run/时间不能称严格 A/B。若近一秒联动停顿仍在，后续独立调查源响应与传输/前端排队，不混改本方案或重跑 GPU/长测。

## 证据

目录：F:\dsh-wallpaper-plugins\.tmp\rc31-p4-candidate-20261015-152630-ed24ea48

- before.json、native-source/：26 固定输入及 18 原生源。
- native-publish/、publish.log、native-runtime-hashes.json：实际发布输出和 12 运行文件指纹。
- published-wait-selftest/、published-pacing-selftest/ 及对应日志：54 项等待/22 字段自测。
- package-stage/、npm-pack.json、audit-candidate.py、package-audit.json：隔离组装、精确包内容与最终审计。
- check.log：语法与 CSS 模板检查。

包内 README 为候选快照，最终安装/真实短测结果另记；归档不覆盖。
