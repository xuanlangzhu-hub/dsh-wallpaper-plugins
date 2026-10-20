# 独立强调色P1复审：主体检查通过，补设置页选中态A1

2026-10-17，Codex。复核[编码任务](GEMINI_NEXT_THEME_ACCENT_P1_20261017.md)、[小G交付](THEME_ACCENT_P1_DELIVERY_20261017.md)及生产/QA差异。**暂不标整体完成，仅有A1需要最小补修。** 主体设置、颜色派生、白名单和已通过部分保留，不重做整个强调色功能。

## 已通过范围

- `npm run check`通过，含语法/CSS模板守卫。
- 默认`npm run test:appearance`实际**458项通过**；英文fixture实际**454项通过**；场景选择正反对照通过。默认较英文多四项runner尾部检查，计数口径正确。
- 严格hex/模式容错、候选保留、reset与四字段预设隔离已有回归；颜色派生实现与任务中的normal/hover、参考面ink规则一致。
- Codex独立补充**41项强断言通过**：五主题组合×七个代表色的实际primary normal前景对比、实际focus命中、theme恢复Graphite填充与清除custom投影，以及通过CDP强制真实hover/active伪类验证primary hover和ghost hover/active消费派生色。
- 当前custom令牌的层叠规则覆盖palette及deep sidebar；普通品牌状态标记限定排除waiting/complete。没有把全局普通文字改为强调色。

额外41项中的按钮/ghost使用最小CSS消费者，复现已有官方令牌接缝，不是执行官方提取JS或完整官方桌面UI。数值检查针对不透明设计参考面，不代表任意动态壁纸的观感或认证。旧证据与其覆盖范围保持，不凭本轮短检查扩称长期稳定。

## A1 [P2] 设置页选中按钮没有接入自定义强调色

定位：`dsh-whale-mist/src/client.js:3679`的`.wm-settings-option.is-selected`，结合`:3658`附近普通按钮`border:0`及`:4032`后的custom覆盖。

任务明确要求设置选中态也接入同一ink/raw轻底。当前custom覆盖了Host令牌和焦点，但选中设置按钮仍使用普通`label-primary`、中性`bg-layer-1`及原阴影；没有custom作用域的选中规则。`brand-primary`变化不会自动改变它，给别的控件声明brand边框也不能证明此分段按钮已跟色。

本轮从**真实设置组件返回的custom选中按钮**获取class/aria属性，挂到隔离真实DOM中计算样式，未伪造生产状态或替换getStatus：

| 样式 | 自定义红#ff0000 | 自定义绿#00ff00 |
| --- | --- | --- |
| 按钮class | `wm-settings-option is-selected` | 相同 |
| 文字 | `rgb(231,236,245)` | 相同 |
| 底色 | `rgba(15,23,38,0.94)` | 相同 |
| 边框宽度 | 0px | 0px |
| 阴影/未聚焦轮廓 | 原中性值 | 相同 |
| 链接ink正向对照 | `rgb(255,77,77)` | `rgb(0,255,0)` |

因此颜色设置已生效，漏接的是**设置页已选状态的消费者**，不是所有颜色都不生效。probe的`actual-settings-selected-accent.regressionObserved=true`确认该缺口。现有QA验证了选中class/aria与独立nav/链接，却没有验证这个真实选中按钮的计算样式，458/454项通过未覆盖它。

### 最小补修要求

1. 在custom且Whale主题活跃时，将`.wm-settings-option.is-selected`接入已有ink与raw轻底（可复用现有interactive-active等派生值）。至少选中填充/可见标记实际随强调色变化，不要只设置没有宽度的border-color或只改aria。
2. 保持按钮尺寸、padding、圆角与键盘焦点，避免加边框导致布局跳动；普通正文/主题底色及waiting/complete等语义色保持。不在theme模式中改变现有选中外观。
3. 在正式QA中挂载真实设置组件返回的选中按钮，验证红/绿等两色的实际计算样式不同并符合预期；覆盖Mist/Abyss四palette及deep-sidebar、textContrast增强、普通/已选/聚焦状态。独立预期不能直接调用被测派生函数充当答案。
4. 验证切回theme、切palette、非Whale作用域与卸载后的恢复；不要把新覆盖写成无条件全局`.is-selected`。保留已有458/454项检查与真实hover/focus/active行为。

只补选中态接线及相应QA/报告，不改已通过的存储、颜色算法、Host/原生或预设生命周期。补修交付到`docs/THEME_ACCENT_P1_REPAIR_DELIVERY_20261017.md`，列实际计数/命令与元素证据。原交付和本复审保留。

## 证据、保护与下一步

证据目录：`F:\dsh-wallpaper-plugins\.tmp\theme-accent-p1-review-20261017-21a90fbc`。

- `check.log`、`appearance.log`、`english-suite.log`、`scene-selection.log`：本轮正式检查。
- `consumer-probe.log`：41项通过及A1反例；另外终止换行等非法hex受控输入均被拒绝，未发现该验证缺口。
- `probe/accent-expression.js`及隔离runner：真实设置按钮取样、实际CSS状态和复现步骤。
- `before.json`、源码/QA快照、`protected-verification.json`、`review-verification.json`：更新结论文档前422个保护文件指纹一致，含生产/QA、manifest/assets、旧归档、日常安装文件及5个Profile。Codex未改生产/正式QA。

本机复跑：`node <证据目录>/probe/appearance-regression.mjs --accent-review`。探针会记录当前A1，退出0只表示观察流程完成；修后正式回归必须断言选中态正确跟色，不能只看退出码。

使用独立临时profile无头Edge和假Host，未截图、查询/操作真实DSH或WE、打包安装、改版本/assets、提交推送、清理旧证据或跨会话消息。未机械重复未改的pairing/temp-profile/原生/性能检查。日常rc.31文件保持，实际运行/播放状态未查询。

A1闭合后再决定后续整合功能包或主题进预设；本轮不自动打包、升级日常或开始实机。120%继续随未来功能包交付，不单独重复候选/实机。工作区manifest/assets仍rc.30，未来从已审rc.31独立叠加审计，控制无关Trace，不直接发布整个工作区或覆盖旧tgz。
