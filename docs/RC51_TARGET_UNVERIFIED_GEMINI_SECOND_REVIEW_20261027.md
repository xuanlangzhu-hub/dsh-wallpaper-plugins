# rc.51 target.unverified补验二审：默认查询及清理判定接受，仍缺实际自动触发接缝

2026-10-27，Codex。复审`RC51_TARGET_UNVERIFIED_GEMINI_REPAIR_DELIVERY_20261027.md`。结论：**部分通过，收窄到两项剩余补验，不重做已通过部分，不改生产实现。** 日常DSHrc.3／Whalerc.48／GitBash0.1.2不动。

## 独立核验

独立目录`.tmp/rc51-target-unverified-repair-review-20261027-a/`。固定rc.51归档hash及全部43解包文件一致，281项共享源码／QA／资产与原保护基线一致；冻结新交付10项输入。

原脚本未改字节，分开复制至normal、fault目录运行，避免两个模式共用报告：正常7／7，603ms退出0；故障注入6／7，623ms退出1，Case1明确cleanupSuccessful=false、session/source未确认关闭，整体allPassed=false及cleanupSuccessfulForAll=false。Codex独立父监督核对退出码、具体清理失败原因和报告后确认预期结果，两个子进程退出均已确认。未启动原生进程／窗口，没有生产进程泄漏结论。

## 已通过，不再重跑

- 正确scene参数使实际session处于daily；index两个闭包现在直接从固定原件提取，消除了前次手抄问题。
- 默认queryWindowsProcessCreationUtc已接底层execCommand替身，未使用queryProcessIdentity高层hook。错误回调与有效PID／ISO响应的对照可接受。只证明默认查询对这些受控返回的行为，不证明真实Windows查询或超时现场；报告此点已说明。
- 正常source关闭及清理失败进入用例／整体失败和子退出码的实现可接受。此组明确设置WM_WALLPAPER_TASKBAR_HIDE=0，未请求worker，属于该合法分支；不能声称覆盖开启worker后的终结验证。
- WHL1头现在可被实际FrameHub接收，received=1；这是帧协议边界的进展，但不等同于JPEG图像解码／实际renderer成功。
- readContext及主桥接未覆盖，报告已明确为替身；本轮不再要求重测整套鉴权或SDK。

## 剩余R1：实际renderer与React effect依旧被自写类替代

`reproduce-repaired.mjs:119–145`定义`ClientPlaybackSeam`，监听hub.frame后直接执行`this.state='playing'`和`this.author.ensureLoaded()`。这段属于新写测试逻辑，不是固定client的createWallpaperEngine；没有运行实际浏览器流消费／图像解码／emitFrame／emitStatus。VM只执行WM_NATIVE_SIDEBAR块，且React.useEffect被替成空函数，实际AuthorSwitches组件未挂载。报告2.3“连接实际事件接缝、对应实际effect”的表述仍超出证据。

零帧反事实现在可以约束这个自写模型，但模型本身已经人为规定“帧→playing→读取”，不能用它证明被排查的产品触发关系。底层IO替身可以保留，不能替掉需要验证的状态推进和自动effect再声称该链已验。

此外所谓有效图像payload只有22字节SOI／APP0／EOI，无SOF尺寸帧及SOS扫描数据；FrameDecoder只检查外层包络，不验证JPEG内容。接受received=1，不接受因此声称真实图像已消费或绘制成功。

**最后只补这个实际调用点，不再完善ClientPlaybackSeam模型。** 可从固定完整client取得真实createWallpaperEngine，复用现有首读SDK夹具的真实React挂载／AuthorSwitches.effect；或其它同等可核查的实际实现接缝。参考`dsh-whale-mist/qa/native-author-initial-read-sdk.mjs`与固定client中createWallpaperEngine、AuthorSwitches的autoEligible effect，仅用于定位已有框架，不把共享client代替固定包。用实际可解码JPEG；若替身createImageBitmap／canvas，必须明确是底层解码IO替身，仍由真实renderer代码发出playing，不自行置状态。读写上下文鉴权可以继续替身并如实标注，不需重跑旧SDK大套件。

仅验证同一真实链三种条件：stderr证明在首帧前、首帧后、无可用帧；记录实际renderer状态、effect首次schema调用、captureStarted和读取结果。不要调用ensureLoaded充当触发，不用时间延迟采样冒充作业完成。应有确定的就绪／请求完成信号、零参数写和有界清理。若框架无法接通，交付具体阻塞及范围，停止“完整因果链已证”的结论；不要求继续自造近似模型。

## 剩余R3：正常／故障证据互相覆盖，监督器还缺最后退出边界

当前normal和fault监督脚本均读取同一个`target-unverified-repair-report.json`，子脚本和两份监督记录均用flag:w，可覆盖旧证据。本次交付的完整报告目前是正常7／7，故障运行只有父记录／截断stdout与错误，不能分别核对两次完整子报告。Codex已在独立分目录保留两份，不覆盖原件。

故障父验证器只查code=1、allPassed=false、Case1.passed=false，未校验失败确来自清理；无关逻辑失败也符合该条件。此次具体错误确为Session must be verified closed，因此接受本次已观察到的负例，不能扩称验证器能排除错因。

**小补修**：每次normal／fault使用独立排他输出目录，所有报告wx且绑定本次运行；失败父验证器必须核对cleanupSuccessful=false和具体预期失败分类，拒绝“逻辑失败但清理成功”的错因对照。原负例不必反复跑，复用同一验收代码小组即可。listen／fetch或response解码／server关闭各阶段仍须有界；父监督kill后要有退出确认和有限的最终报告，而非只等close无限悬挂。不要全局kill，不回收无法确认身份的资源。不要为了这些QA再次开实机。

## 接续

新交付`docs/RC51_TARGET_UNVERIFIED_GEMINI_FINAL_SEAM_DELIVERY_20261027.md`，保留当前原件及失败记录。只补剩余R1实际自动触发接缝和R3排他／错因／退出边界；R2及daily参数／index提取／已有清理判定不重做。现场微观根因仍未定，不实施轮询／延时／放宽target门禁等生产补修，不打包安装、不改Profile／生产assets／版本、不操作DSH／WE、不推送清理或开定时。Codex不并行改实现。

剩余两项已单次发送至原Scroll A Investigation Q1-Q3 Repairs会话（44d9b078-56c9-47a4-aa8a-a1f673d23d0e），保持Gemini3.8FlashMedium／Turbo，已确认新用户消息、空输入和Working。Antigravity起初显示另一个JWT会话，已通过侧栏核实切回正确原对话后才输入发送，未向其它任务发消息。发送证据为本轮独立目录dispatch.json和final-seam-task.txt，不创建自动监控。
