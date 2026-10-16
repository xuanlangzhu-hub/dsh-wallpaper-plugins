# rc.29 三体前端分段实测结果

2026-10-15，Codex。三体实时演算 | Three-Body problem - SYKM 的同一轮前台静止/缓慢移动鼠标短测完成，P2字段真实进入客户端→Host→日志→观察器→分析器。**本轮画布同步绘制计数约21.5fps，接近原生送帧；没有复现昨天鼠标段的大量前端覆盖。**用户反馈这轮没有明显卡顿。此为测量结果，不宣称rc.29修复了低帧率或普遍达到30fps。

日常rc.28和今天原设置已恢复，用户重开确认正常且停止；测试源窗口、capture/worker均0，原WE和官方文件保持。候选及原始数据保留，未提交/推送。

## 采样条件与覆盖

[候选与安装核验](RC29_FRONTEND_PERF_CANDIDATE_20261015.md)。本轮仅P2观测代码不同于rc.28，原生12文件、采集目标30fps/pipe/JPEG/窗口与外观不改。手动关闭原勾选的自动播放用于受控测量，结束恢复原勾选。

- 同一run：C:\Users\HP\AppData\Local\Whale Appearance\wallpaper-preview\2026-10-15T010712-5982-we-41612c520dd4406e48dea550
- capture PID35424，location WhaleWallpaperProbe-261015010712-c0a0；原WE PID10344，启动身份保留。仅作为本轮证据，不复用这些PID。
- 分辨率1302×776，人工确认同会话/前台/动作，客户端hidden全0。未采样OS焦点，不能把Native foreground=false误认作DSH后台。
- 两个观察器各27秒/22样本，选单段相对2–25秒中的19样本；指标36键，读错误/重复均0；client进度覆盖1.028/1.006，P2分类一致、dataReady=true。
- 以下均为北京时间，源数据保留UTC与单段单调时钟。

| 选定窗口 | 实际首尾 | 有效首尾跨度 |
| --- | --- | ---: |
| 静止 | 09:08:31.103–09:08:53.478 | 22.375s |
| 缓慢移动鼠标 | 09:10:03.556–09:10:25.927 | 22.372s |

两段首样本相隔92.453秒，选定窗口之间未采样70.078秒；保留这一缺口，没有插值。两段动作是唯一计划变化，但场景随时间演化/温度/负载未独立控制，不给鼠标唯一因果结论。

## 实测数值

| 指标 | 静止 | 鼠标移动 |
| --- | ---: | ---: |
| Native送帧计数/s | 21.49 | 21.56 |
| Host接收计数/s | 21.48 | 21.56 |
| client解码后投递计数/s | 21.49 | 21.47 |
| 成功drawImage计数/s | 21.49 | 21.47 |
| RAF等待平均 | 0.62ms | 2.02ms |
| 解码成功平均 | 4.53ms | 5.51ms |
| 同步通知平均（含画布订阅者） | 0.06ms | 0.06ms |
| drawImage同步调用平均 | 0.03ms | 0.03ms |
| 覆盖总数 | 0 | 2 |
| 其中等待回调时覆盖 | 0 | 2 |
| 其中解码/同步处理/其它覆盖 | 0/0/0 | 0/0/0 |
| decode失败/订阅者异常/绘制异常 | 0/0/0 | 0/0/0 |

前端阶段平均由耗时和/计数的阶段增量得到，累计max只作全run背景参考；sync包含draw，不把二者相加。rendered先于订阅者，drawCount仅表示同步API成功，两者都不是DWM屏幕FPS。drop分类反映JS接收新帧时管线状态，尤其dropSync=0不能据此证明所有主线程工作没有成本。

原生完整相邻序号分别484/485对，覆盖22.524/22.496秒、覆盖比例100%，本轮两段帧记录密度相当，使用完整frame_records统计成本；没有用稀疏跨序号间隔造“断帧”。

| 原生阶段 | 静止平均 | 鼠标平均 |
| --- | ---: | ---: |
| 回读 | 8.51ms | 8.57ms |
| JPEG | 4.86ms | 6.52ms |
| 原生encodeMs（含回读/JPEG等） | 13.98ms | 15.93ms |
| 连续输出间隔 | 46.54ms | 46.38ms |
| 最大相邻间隔 | 54ms | 55ms |
| ≥250ms间隔 | 0 | 0 |

不是WE源渲染FPS、物理呈现、GPU/功耗或端到端鼠标延迟测量。此次所有助手暂停，且用户没有明显卡感，不代表此前的使用场景/负载反馈失效。

## 能支持的下一步

本轮前端基本跟上当前上游约21.5fps，不能仅为昨天的覆盖现象删除RAF或重写画布。今日并没有采集rc.28与rc.29的受控前后对照，不能把“今天不卡”归因于观测代码或称帧率提高。

原生循环代码已经按1000/fps扣除本次处理时间再Task.Delay；“扣除编码再睡”不是新修复。对严格相邻记录做离线算术：间隔减下一条encodeMs，静止/鼠标的平均余量分别32.562/30.459ms。余量含前一帧记录后的日志/状态工作、等待/线程调度、资源释放、空帧重试与下一帧计时前工作；**不是实际Task.Delay耗时**，更不能直接说Windows定时器已定位为根因。

[下一步的局部任务](GEMINI_NEXT_NATIVE_PACING_P3_20261015.md)：先补请求等待/实际恢复、记录后工作、空帧等待的有界计数/耗时，隔离构建与真实接缝QA；再交Codex复审/另确认方便测一次。优先解释约46ms采集周期未达到33.3ms，不盲升FPS、不先改全局定时器/GPU或重写视频链路。

## 恢复与保留

- 今天5份Profile与10个关闭状态Local Storage文件备份、恢复逐文件哈希一致；rc.28安装28文件匹配活动归档。
- 原三体选择、自动播放勾选、主题/输入/桌面正常，用户确认保持停止。当前安装只允许Lucy自动播放；三体不自启符合现有范围，提示体验反馈已记录，后续单列改进。
- Host preview-final：running=false、failure=null、window.cleanup=absent/closed；Native summary：parent-stop、源窗口closed、taskbar cleanupSafe=true。最后进度preview-status仍显示旧running=true，已与终态区分，不能据旧进度误判仍运行。
- 独立window-find=0，capture/worker=0；原WE身份和DSH EXE/app.asar/WE EXE哈希保持。Electron重开后会写自身存储日志，因此外观哈希结论限关闭状态恢复时刻；恢复后的UI由用户确认。

证据：
- 实机目录：F:\dsh-wallpaper-plugins\.tmp\rc29-desktop-20261015-090238-9d91f7b0
- 原观察：idle-observation/observation.json、mouse-observation/observation.json及各自raw/
- 分段审计：selected-window-audit.json、idle-selected-audit.json、mouse-selected-audit.json
- 合成时间轴/阶段：combined-observation.json、segments.json；原单段时长未变化，缺口注明partial。
- 工具报告：analysis/analysis.json、analysis/analysis.md
- 离线余量：native-residual-audit.json/.mjs（只读算术，非新增实采）
- 终态/恢复：run-after-stop、final-cleanup-confirmed.json、restored-before-reopen.json、rc28-installed-restored.json、reopened-daily-confirmed.json
- 原设置与测试后设置：C:\Users\HP\.dsh\backups\official-desktop-before-p2-rc29-20261015-090238-9d91f7b0
