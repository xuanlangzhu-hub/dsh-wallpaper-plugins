# 独立强调色P1最终复审：A1/A2闭合，代码与隔离回归通过

2026-10-17，Codex。复核[A2交付](THEME_ACCENT_P1_SECOND_REPAIR_DELIVERY_20261017.md)、[修正契约](THEME_ACCENT_P1_SECOND_REVIEW_20261017.md)、实际源码/QA及独立反例。**本轮通过，A1跟色与A2叠色文字对比均可闭合，独立强调色P1结束编码补修。** 此结论不等于已经打包安装或通过真实DSH观感验收。

## 补修与回归结论

- 生产相对上一轮只改一行：custom选中设置按钮文字从`--wm-custom-ink`改为普通`--dsw-alias-label-primary`，保留raw alpha0.20选中底与ink焦点。未改链接派生、主按钮前景/hover、状态色、主题底色、Host/原生或预设生命周期。
- A1保持：红/绿选中底随强调色变化；标签不再被要求也呈红/绿。原探针`actual-settings-selected-accent.regressionObserved=false`，尺寸、padding、0px边框及焦点检查通过。
- A2通过：旧纯红参考反例在五主题均消失，计算后前景符合普通primary；增强模式随普通primary增强，不再固定链接ink。
- 最终局部方案修正了Codex上轮要求直接复用ink的漏项，详见修正契约；不归为小G未遵守旧要求。旧报告及失败证据保留。

## 独立实跑

| 检查 | 实际结果 |
| --- | --- |
| `npm run check` | 通过，含语法/CSS模板守卫 |
| `npm run test:appearance` | **570项通过** |
| `node qa/appearance-regression.mjs --english-suite` | **566项通过** |
| `node qa/appearance-regression.mjs --scene-selection-only` | 通过，正向启动一次、修改过选择不自动启动 |
| 旧消费者probe `--accent-review` | **41项通过**，A1未再现 |
| 旧叠色probe `--selected-contrast-review` | 五主题纯红全部通过，A2未再现 |
| 新矩阵probe `--selected-matrix-review` | **140组合+4项恢复=144项通过** |

默认570与英文566相差默认runner的四项尾部媒体/资源检查，不是语言控件遗漏。各套件有重叠覆盖，不能把全部passed相加当作独立测试场景数。

新矩阵使用真实设置组件返回的选中节点及生产CSS，fixture关闭transition以读取稳定终态，按实际alpha填充与不透明layer2参考面独立合成：五主题×七代表色×standard/enhanced两档×balanced/deep侧栏，共140组合；同时核对普通primary、alpha0.20、尺寸与边框/padding。另验证theme清除custom变量、非Whale作用域和dispose恢复。

| 主题/配色 | 140组合中该主题最低参考面对比 |
| --- | --- |
| Mist | 7.4795 |
| Abyss Ocean | 7.0470 |
| Graphite | 7.2328 |
| Violet | 7.4280 |
| Jade | **6.9199** |

旧纯红反例修后为Mist8.4463、Ocean12.2188、Graphite12.1286、Violet12.1070、Jade12.1998。纯红是前轮反例，不是所有颜色中的最差情况。对比结论仅限已知不透明参考面与所测组合，未采样动态壁纸，不作任意像素/所有颜色/全面无障碍保证。

本轮未机械重复未改的pairing/temp-profile、原生、性能/GPU或长测；这些在小G交付中的历史结果不扩称为本轮Codex重跑。

## 证据与保护

目录：`F:\dsh-wallpaper-plugins\.tmp\theme-accent-p1-closure-review-20261017-2b9b0264`。

`check.log`、`appearance.log`、`english-suite.log`、`scene-selection.log`保存正式输出；`consumer-probe.log`、`selected-contrast-probe.log`、`selected-matrix-probe.log`及probe源码保存独立复核。`before.json`、源码/QA快照、`protected-verification.json`与`review-verification.json`保存输入及结论。

更新结论/接续文档前，**426个保护文件指纹一致**，涵盖工作区生产/QA、manifest/assets、旧归档、日常安装文件及5个Profile。Codex只新增本机隔离证据与更新文档，未改生产/正式QA。

仅使用独立临时profile的无头Edge与假Host，没有截图、查询/操作真实DSH/WE、打包安装、改版本/assets、提交推送、清理旧归档或跨会话消息。日常rc.31文件保持，当前运行/播放状态本轮未查询。

## 下一步建议

四字段手动壁纸预设、主题可读性P1、独立强调色P1的当前代码审查均已收尾。**建议先冻结新增功能，独立整合并审计一个功能候选包，再统一短验**，避免继续堆字段而没有取得真实DSH效果反馈。主题字段进入壁纸预设、自动套用、作者属性与自定义底色暂不自动启动。

当前尚未创建候选或下发新编码任务。整合需以已审rc.31归档为基底，叠加已审外观/预设/可读性/强调色差异，控制无关Motion Cadence Trace，保持rc.31原生运行时；不要直接对整个rc.30 manifest工作区打包或仅改版本号。新版本与包名在构建时核对归档后确定，不覆盖旧tgz。120%随功能包交付，不单独重复候选/实机。真实安装/操作另需当时方便与退出确认，旧授权不复用。
