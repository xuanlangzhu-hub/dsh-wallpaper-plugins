# C1 DeleteTab独立短验：入口消失、动态恢复，动作处仍有断帧

2026-10-12，Codex。用户确认方便、其它助手暂停且无运行任务后执行一次独立测试。
**本机Lucy的C1入口移除路线得到实证；当前QA同步动作会阻塞出帧，暂不合入日常包。**
日常rc.24保持打开且未安装/修改，不改生产源码/资产/Profile、官方EXE、原WE或全局设置；未提交/推送。

## 测试范围与方法

证据根：`F:/dsh-wallpaper-plugins/.tmp/taskbar-c1-live-20261012-194811-8477b8`。
复用最终复审的QA二进制，事前核18项构建输入及EXE/DLL哈希；不为本轮再编译或装临时插件。
控制方只创建唯一`WhaleWallpaperProbe-C1-20261012-194811-8477b8`，Lucy官方项目，正坐标屏幕外无边框源。
使用同一WGC捕获项/会话，pipe模式40秒，至少10秒有效编码/发布基线后尝试一次DeleteTab，末尾自动清理。
未切换owner/APPWINDOW/TOOLWINDOW、未隐藏/最小化/激活源，不调用AddTab或重启Explorer。
这是独立源与捕获流验证，不是DSH背景层集成验收；动态连续性由真实JPEG/时间与像素证据核对。

启动前控制脚本相对模块路径写错一次，Node在模块加载阶段退出，没有创建任何窗口或原生动作；
修正后进行上述唯一原生轮次。prelaunch-correction.json保留，未覆盖旧实验。

## 用户观察

- 新增Wallpaper任务栏入口出现一会，约10秒后消失，到测试结束未再出现。
- Alt-Tab查看时也未见Wallpaper条目。这是本轮人工观察，不升级为DeleteTab保证通用Alt-Tab排除。
- 无窗口主动闪到眼前、无抢焦点。
- 原桌面壁纸与DSH日常界面均正常。

人工结果另存human-observation.json，原生taskbar-action.json中的自动视觉字段仍保留null，原始证据不改写。

## 原生动作和资源

| 项目 | 本轮事实 |
| --- | --- |
| 源身份 | HWND 4067146，原wallpaper64 PID 11732，StartTime 2026-10-12T00:52:42.5302295Z，精确本轮location |
| 触发 | 第214帧，捕获钟10.023秒；首个有效帧0.126秒 |
| HrInit / DeleteTab | 均0x00000000；各自结果保留；一次调用 |
| worker | started/exited=true；无超时或终止，cleanupSafe=true |
| 窗口事实 | 调用前后visible=true，iconic/cloaked=false；style 0x94000000、exStyle 0、owner/parent 0、位置/尺寸/Z序一致 |
| 捕获/清理 | 40.019秒，duration结束；捕获进程退出0；本轮源closed=true，关闭等待965ms |
| 监督复核 | 独立枚举确认源已不存在，reviewed QA进程剩余0；原WE PID/StartTime/路径保留 |
| 保护 | 16项源码/资产/tgz/Profile/官方EXE/WE EXE/安装版本文件哈希一致；日常仍rc.24 |

物理启动位置为x=4096；原生查询窗口位置2731×0、尺寸868×517，而JPEG为1302×776。
记录各自坐标视角，不把DPI差异当成DeleteTab改变窗口；判断依据是调用前后同接口读数一致。

## 动态与动作卡顿

总接收794帧；触发前213帧，触发后580帧且580个不同JPEG哈希。
核对调用前后样本都为正常Lucy画面，无白条/黑屏；调用后两张间隔约15秒的JPEG解码抽样，
排除时钟区域后的2144点中35.1%出现大于5的RGB平均差异，整体平均绝对差10.230，
因此不是仅凭源时间戳增长、JPEG元数据或单张末帧声称动态。

**当前有一次明显出帧间隔，不能写成无缝持续。** 第214→215帧的接收间隔3069ms，
第215帧到达时源帧年龄3072ms；第215→216帧源时间间隔3066ms，随后恢复正常约46ms节奏，末帧年龄48ms。
其它接收间隔最大92ms。这与OnFrame同步等待worker完成、暂停捕获循环的源码路径一致，
但本轮没有进一步拆解worker启动、身份枚举、COM各自耗时，不能把3秒全部归因于其中一项。
样本和逐帧信息在received-frames.json、timing-analysis.json、decoded-pixel-analysis.json、capture/frames.jsonl及summary.json。

## 结论与下一步

入口移除、源属性保留、调用后动态恢复与清理在本机Lucy本轮成立；开始后的短暂入口仍存在。
Alt-Tab只按用户本轮未见记录，不承诺其它版本、壁纸、多屏、Explorer重建或正式Host生命周期。

下一步先让Gemini局部修QA的同步等待：[非阻塞动作任务](GEMINI_NEXT_C1_NONBLOCKING_QA_20261012.md)。
保持同一捕获会话、一次DeleteTab、worker退出确认与身份门禁，不能通过停播/重建/样式切换掩盖断帧。
离线复审后再约用户用同一独立方法短验；不直接改日常包，不重跑GPU/长时流程。
