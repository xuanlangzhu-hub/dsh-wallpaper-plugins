# 原生侧栏：鲸雾 / 鲸渊主题切换

2026-10-22，接续[文字可读性迁入](WALLPAPER_NATIVE_READABILITY_20261022.md)。本轮仅迁入主题切换及完成该入口所需的失败处理，不制作候选或操作日常应用。

## 结果

默认收起的“界面”分区最前面新增“主题”原生选择框，只含**鲸雾(mist) / 鲸渊(abyss)**。后面的不透明度、聊天底色和文字可读性保留，不增加保存/应用按钮、成功段落或新色板。

正常切换走原`controller.set('theme', value)`，复用原ThemeRuntime、主题注册、恢复规则、CSS投影与存储。主题资产、默认鲸渊、配色和强调色规则不改。新入口只接受原允许集；控制器值未知、缺少runtime读写能力或setter、没有会话、旧页占用或已卸载时不盲写入，不假冒默认主题。

切换后同时核对**已发布偏好和实际ThemeRuntime.active.id**。选择值不等于主题实际切换成功；失败显示主题字段的短错误，保留已经发生的修改，不回滚已保存偏好。

同一偏好且实际主题已一致时不重复写入；若偏好已保存但实际主题不一致，新的明确选择只向原ThemeRuntime重应用该主题，验证实际结果，不重复写偏好。主题变化监听随侧栏服务代次释放，旧页互斥及迟到事件拒绝保持。切换不会重置其它外观值，也不发送壁纸播放、停止或作者参数命令。

## 两处失败边界与补修

1. **同值重试可能误报成功。** 初版只检查保存值：Runtime在偏好写入后抛错，或静默忽略切换，再选相同值会跳过实际操作。两项受控负例已先复现；新增实际主题核对及明确同值重应用后通过。失败输入与报告保留在`runtime-negative-inputs`和`runtime-negative-before.*`。
2. **控制器快照可能落后于已保存偏好。** 完整SDK注入真实ThemeRuntime抛错后，记录为`preference: mist / cached: abyss / active: whale-abyss`，重试仍停在这个状态，`runtime-cache-probe`失败。原controller在调用Runtime之后才发布设置，抛错会跳过通知。本轮将该段通知放入`finally`：保留原异常，使已发生的设置变化仍能发布。修复后首次失败为`mist / mist / whale-abyss`且明确报错，用户再次选mist后为`mist / mist / whale-mist`，错误清除。没有通过改成成功预期或吞异常规避问题。

controller块外改动只涉及上述通知时机；原CSS投影和其它行为保持。异常仍然抛给调用者，不能将这项改动解释为所有存储/主题后端失败都已修复。

## 输入保护

证据：`F:\dsh-wallpaper-plugins\.tmp\native-sidebar-theme-20261022-b416e0d7`，含设计、开工副本、256项保护清单、负例输入、各次SDK脚本/报告、最终冻结及`change-audit.json`。

256项既有输入中三项变化，其余253项保持；新增一份16项主题QA。既有可读性QA只把一处泛指选择框的定位收窄到`textContrast`，避免新增主题选择框后定位到错误控件，断言与验收要求保持。原111 SDK脚本与上轮逐字相同。

| 最终输入 | SHA256 |
| --- | --- |
| `dsh-whale-mist/src/client.js` | `8F35BF8375535D2E6B0E42F5E7B5D719AF47C4788858C55D2E00AD62908A0823` |
| `dsh-whale-mist/src/sidebar/native-appearance-sidebar.js` | `FF38580446BE3297A60830CFE878EB487B3C8D296900F1080C638F79FA159597` |
| `dsh-whale-mist/qa/native-sidebar-readability.test.mjs` | `F6FD9F3532DA2B09E8F4B4506DE61539CABB52EB9D3C8BC1F8D7A0484434E690` |
| `dsh-whale-mist/qa/native-sidebar-theme.test.mjs` | `395C9F76AE47AB4EBBEE9F2834944CC5338B4BFEC07AE50A14851B50EE08FE31` |

本轮不能继续声称client生成块外完全不变。audit严格比较块外仅上述`try/finally`变化，`client-outside-before/after.txt`留证；互斥门禁、作者Host/执行器、两个生成器、manifest/生产assets及21项官方SDK快照保持，原脏改动保留。

## 最终验证

`final-regressions-report.json`：新增16项加既有508项，共**524项通过**。覆盖合法/重复/非法主题值、损坏偏好、无服务/无会话/旧页/卸载、实际主题不一致、拒绝/抛错/静默忽略和显式同值重试；原生/作者生成块、语法与CSS检查通过，所有阶段退出确认。

SDK经完整Whale入口、实际React/官方SDK/ThemeRuntime/会话/原生右栏/dockkit、主端bridge及真实回环HTTP链路，绑定最终client/module哈希：

| 最终组 | 流程 | 父监督时间 | 属性IO替身 | 峰值/最终 |
| --- | --- | --- | --- | --- |
| `final-existing-sdk` | 原111项 | 11.693秒 | 60次 | 1 / 0 |
| `theme-sdk-scope-probe` | 新主题10项 + 前轮可读性/界面/互斥31项，共41项 | 12.197秒 | 0次 | 0 / 0 |

合计**152项SDK流程**。新增主题流程验证：默认折叠/标签/键盘选择；实际主题ID、隔离localStorage和body标记；保留其它外观值；Runtime抛错/静默忽略及同值重试；宿主dark/light重置后的原恢复规则；快速切换与同一事件轮内宿主重置后采纳最新明确偏好；旧通用页往返；浮动副本同步/唯一标签；服务重建/360与520宽度；合成Lucy播放中切换不改变源代次或新增播放/作者请求。

组合组只有既有流程明确开始/停止用的2次合成播放请求，新主题操作新增播放/停止/属性命令0。窗口spawn/close仍为原Host协议下底层IO替身，4个假handle、5次关闭尝试、最终0；没有真实独立窗。原111组60次属性命令亦为底层IO替身，**全部真实WE命令0**。

401仍精确核对既有首次snapshot可选与唯一disconnect，路由/POST/generation1/unauthorized-main-token/连接阶段匹配；原111的3条故意作者409保持，最终组合组无额外400或作者409。console与HTTP错误逐项对应，`cleanLog:false`，不增加宽泛豁免。最终订阅、refs/pins、监听、DOM、stream、预览活动和Blob URL归零，自有headless Edge退出、两服务关闭确认。产品停帧/作者期限、空流夹具30秒和SDK45秒总截止/51秒收束保持。

## 夹具修正及保留观察

`theme-sdk-fixed-cache`的41个业务流程完成后仍判失败：首次让真实ThemeRuntime写内置dark/light偏好时，旧夹具把scope的`set(field,value)`实现成了`set(value)`，回声也缺字体字段，引发两条`.split`异常。依据官方SDK契约修正**测试scope**为完整主题设置对象及键值写入，未修改官方ThemeRuntime或吞掉页面错误。最终记录只出现两次合法scope写入：`preference=dark`与`preference=light`。

这个失败运行还保留了一条`/api/main/snapshot`的400/stale-revision；当轮未记录其请求revision，不能断言与错误scope回声有何因果。本轮未改snapshot传输，也不将后续未再出现称为并发快照问题已修复。新夹具增加请求/Host revision诊断，最终两组仍不允许该400，没有新增豁免；有效输入下若再现，先做单项定位。失败报告的业务流程通过不抵消最终校验失败，已清理的页面结果与浏览器/服务退出证明保留。

## 下一小步与边界

下一步只迁入既有**配色选择**，保留当前四种配色及其主题投影；强调色后排。继续离线实现，若有效夹具出现上述快照异常，先定位再推进，不靠重试取绿。

本轮不是实际文字、主题颜色、透明度或Windows独立窗视觉验收。日常DSH0.2.1-rc.2 / 外观rc.42 / Git Bash0.1.1保持，Profile、生产assets和版本不动；未打包安装、操作日常DSH/WE、提交推送清理、联系其它助手或恢复定时。


2026-10-23接续：现有四种深色配色已迁入，见[配色选择离线交付](WALLPAPER_NATIVE_PALETTE_20261023.md)。下一步仅既有强调色入口；本报告保留的快照400观察未定因，不因后轮通过而撤回。
