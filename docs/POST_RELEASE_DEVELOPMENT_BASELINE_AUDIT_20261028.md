# 预发行后D0：任务栏链路来源审计

2026-10-28。结论：任务栏所需来源已核清，可进入隔离原生源上的最小补修；不能直接从共享开发树整体重编或打包。当前日常rc.53和两个公开发行物保持。

范围按[当前分步计划](POST_RELEASE_DEVELOPMENT_PLAN_20261028.md)：只审任务栏相关输入，不重新审计全部UI。本轮无生产实现修改、应用操作、安装、发布、提交推送或清理。

## 固定输入与实际来源

- 原包：`.tmp/rc53-gallery-author-candidate-20261028-a/dsh-whale-mist-0.6.0-rc.53.tgz`，SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。
- 43项均按`release-sources/rc53/package-manifest.json`核对。29份已提交文本位于`release-sources/rc53/package/`；二进制不重复加入Git。
- 原生源码采用`.tmp/rc39-video-candidate-20261020-6a8d759a/native-source/`的18文件留档。构建记录为同目录的`native-provenance.json`、`native-build-result.json`，既有构建退出0、未超时、退出已确认。
- 这条关联由留档构建记录和产物逐字节匹配支持，本轮没有重新编译生产DLL，不能称为已证明可重复得到相同二进制。

| rc.53资产 | 逐字节匹配来源 |
| --- | --- |
| `assets/wallpaper/WallpaperProbe.dll` | rc.39的`native-publish/`，SHA256 `E359130534CA0E585557B5B4FDAA8309056A3DC0409E07B476E46C86201889B1` |
| `assets/wallpaper/WallpaperProbe.exe` | rc.31的`native-publish/`，SHA256 `C2727F2BAD7CA64F97059BE781F4E2DE5214440BD94B704D58993FD0A1C12731` |
| `assets/wallpaper/WallpaperProbe.deps.json`、`WallpaperProbe.runtimeconfig.json` | 同一rc.31留档 |
| `Microsoft.Windows.SDK.NET.dll`、`WinRT.Runtime.dll` | 同一rc.31留档，位于`assets/wallpaper/` |
| `SharpGen.Runtime.dll`、`SharpGen.Runtime.COM.dll` | 同一rc.31留档，位于`assets/wallpaper/` |
| `Vortice.DXGI.dll`、`Vortice.Direct3D11.dll`、`Vortice.DirectX.dll`、`Vortice.Mathematics.dll` | 同一rc.31留档，位于`assets/wallpaper/` |
| `assets/DeepSeek-Harness.ico`、`assets/whale-icon-helper.exe` | 与受保护的共享资产一致；不是本轮任务栏源窗口改动对象 |

rc.31留档目录为`.tmp/rc31-p4-candidate-20261015-152630-ed24ea48/`。上表覆盖14资产，完整文件大小／哈希／绝对工作区内来源记录在本轮`source-map.json`。

**apphost差异是预期的。** rc.39当时只替换DLL，继续使用已验rc.31启动器及依赖；不能拿rc.39新生成EXE与当前原包不一致当成资产损坏，亦不能顺手替换它。见[rc.39复审](RC39_VIDEO_MP4_CANDIDATE_REVIEW_20261020.md)与[rc.40整合](RC40_VIDEO_ASCII_BRIDGE_CANDIDATE_REVIEW_20261020.md)。

## 共享开发源不能直接提升

18份原生源中16份与共享`dsh-whale-mist/qa/wallpaper-probe/`相同，包括任务栏Runtime／Strategy／Worker／List、WindowIdentity和SourceWindowHelper。不同的是`Program.cs`与`CaptureArguments.cs`：共享版本含未发行Trace及其参数／记录接点。

rc.39对比已审rc.31源码只改`Program.cs`与`SourceWindowHelper.cs`，用于视频路径支持；rc.31留档源码指纹也与既有审查记录匹配。不能为了移除Trace而倒退到缺视频支持的旧Program。

| Host文件 | 固定rc.53与共享开发源 | 后续处理 |
| --- | --- | --- |
| `src/wallpaper/session.js` | 不同；共享含Trace，同时缺少已验的captureListeners／notifyCapture／waitForCapture就绪接点 | 使用固定rc.53，不整体覆盖 |
| `src/index.js` | 不同；固定版保留作者读取就绪等待及诊断接点 | 使用固定rc.53 |
| `managed-window.js`、`close-fence.js`、`scenes.js` | 三份逐字节相同 | 保留原包，不为任务栏重写生命周期／关闭证明 |

侧栏不在本次改动范围。其真实整合ESM为`release-sources/rc53/build-inputs/native-appearance-sidebar.js`（SHA256 `CD3FB3388DA1005F9526A16552BCCE83EA1CFBEFD8359BC0232D4F68CACDFDC3`），固定产物client为`9D4914C6E4DA3CB7875C8F321B27613DD1D1B4C79628511CB5E47A6AFBED8F3B`。已有生成边界见该目录`build-inputs.json`；任务栏补丁不改ESM、生成器或client，也不建第二套UI生成体系。

## 后续基线选择

采用**固定rc.53运行文件＋隔离rc.39原生源码的最小补修**：在新的工作目录复制18份原生源，只修改任务栏触发接缝。原包、固定快照、共享生产assets／manifest保持；后续如需验证编译，只输出到独立目录并记录来源、工具链和差异，不立即生成发行候选。

Host读取就绪、作者身份／取消／预算门禁、图库留页／显式切换、关闭证明均沿用固定rc.53。Trace不混入未来候选。本轮没有实现这些输入的迁移，也没有把共享树改成rc.53。

## 证据与接续

本轮证据目录：`.tmp/taskbar-postrelease-audit-20261028-a/`，含`source-map.json`、18份原生源冻结副本、相关JS差异、保护输入清单与回放结果。该目录仅本机留档，不作为安装源。

收尾`closeout-integrity.json`确认361项保护输入、18份原留档及冻结副本均未变化，rc.53原tgz、GitHub ZIP、npm tgz三份归档哈希保持；47个本地文档链接有效，`git diff --check`通过。既有脏文档未重置，没有提交推送或清理。

D0通过仅指上述任务栏输入的来源覆盖完成。D1时序、17项离线回放及下一编辑点见[任务栏时序审计](TASKBAR_STARTUP_TIMING_AUDIT_20261028.md)。它不代表完整任务栏隐藏、真实采集回归或全部UI已重新验收。
