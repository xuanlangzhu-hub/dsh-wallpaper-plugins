# 独立强调色P1补修复审：A1跟色已闭合，补选中文字对比A2

2026-10-17，Codex。复核[A1补修交付](THEME_ACCENT_P1_REPAIR_DELIVERY_20261017.md)、[首审](THEME_ACCENT_P1_REVIEW_20261017.md)及实际差异。**A1已经修好；本轮整体暂不闭合，仅需局部处理A2。** 保留本轮七行CSS接线、真实选中态QA和其余已通过部分，不重做强调色算法或主题体系。

## 已确认通过

- `npm run check`通过；默认外观**495项**、英文fixture**491项**、场景选择检查通过。
- 独立复跑上轮探针：41项强断言通过；真实选中按钮红/绿底色和文字已不同，`actual-settings-selected-accent.regressionObserved=false`。A1不再返工。
- 新规则限定custom及Whale活跃作用域，未改变border/padding/圆角；新增QA涵盖五主题、deep sidebar、聚焦、文字增强及theme恢复。生产diff仅在选中设置按钮上增加ink文字/raw-alpha轻底覆盖，没有改变Host/native、存储或颜色算法。

## A2 [P2] 选中态叠加同色轻底后，复用链接ink降低文字对比

定位：`dsh-whale-mist/src/client.js:4069–4074`，尤其`color:var(--wm-custom-ink)`；以及`:383`附近只针对未着色参考面的ink派生。

**这是Codex上一轮接线要求的漏项，需要在此修正。** 我要求直接复用ink和raw轻底，未要求重新检查叠色后的文字背景；小G按该要求实现了跟色。链接ink在原参考面上满足门槛，不代表把同色20%填充叠在它后面仍满足门槛。本次不把问题归为小G未遵守上一轮要求。

补修交付声称“ink在20%alpha底色上均保持对比度≥4.5”，但现有QA只核对ink RGB及alpha，没有计算二者叠加后的关系。

本轮使用真实设置组件输出的选中按钮class、生产CSS和独立对比公式，在实际segment的layer2色上建立**不透明参考版本**，关闭fixture动画后读取终态计算样式；不采样桌面、不执行官方JS、不猜测动态壁纸像素。自定义纯红结果：

| 主题/配色 | 选中文字 | 对未着色layer2 | 对叠加20%红填充后的layer2 |
| --- | --- | --- | --- |
| Mist | #cd0000 | 5.1333 | **3.6306** |
| Abyss Ocean | #ff4d4d | 4.8697 | **4.4288** |
| Graphite | #ff4949 | 4.9239 | **4.3143** |
| Violet | #ff4242 | 4.8624 | **4.1759** |
| Jade | #ff5555 | 4.9799 | 4.6022 |

例如Mist参考面rgb(230,242,251)，红填充rgba(255,0,0,0.2)合成后为约rgb(235,193.6,200.8)，前景rgb(205,0,0)比值约3.63。该反例在已知不透明参考面就低于本功能设定的4.5，不涉及对任意壁纸作保证，也不是声称已经实机观察到不可读。

### 修正后的最小契约与补修

优先采用最小方案：**选中标签仍用普通`--dsw-alias-label-primary`，保留已跟色的raw-alpha选中底，焦点/非文字标记仍可用ink。** 不再要求选中标签本身必须呈现彩色ink。

1. 只调整选中设置控件的前景接线；普通primary文字的全局值、链接ink算法、主按钮黑白前景/hover、状态色、主题底色保持。不要为此重算所有链接或改变4.5设计门槛。
2. 红/绿的选中填充仍须不同，A1保持；可用既有焦点/标记表现强调色，不强求红/绿标签文字也不同。保留尺寸与custom作用域，以及theme/卸载恢复。
3. 更新此前“文字必须等于红/绿ink”的QA，改为选中标签遵守当前普通primary/textContrast规则，并对**实际合成参考底色**检验可读性。不能仅替换为另一组硬编码RGB却不算背景关系。
4. 正式回归至少覆盖五主题×七代表色（黑/白/灰/紫/红/绿/蓝），textContrast standard/enhanced、deep-sidebar及theme恢复；按生产CSS取得前景/alpha，用独立公式合成已知不透明参考面后验证≥4.5。动态壁纸任意像素仍不作保证。原495/491项中的其它有效覆盖保留，允许修正不再成立的ink断言。
5. 修正补修交付中对20%底色的过强保证，写明参考面与实际检查范围；不把属性匹配当成对比验证。

Codex对推荐方案作了独立设计核算：五主题的opaque layer2、七色×两档普通primary下的最小比值约为6.92–7.48，支持此局部选择。这是数值设计核算，尚未修改/验证生产修复，不代替小G实装后的QA。若发现实际接缝有冲突，给证据再作最小替代，不扩展功能。

续修交付到`docs/THEME_ACCENT_P1_SECOND_REPAIR_DELIVERY_20261017.md`，列局部diff、A1保留、A2合成对比和真实检查结果。旧交付/首审保留；本文件在选中标签前景契约上优先于上一轮直接ink接线要求。

## 本轮证据与现场保护

目录：`F:\dsh-wallpaper-plugins\.tmp\theme-accent-p1-final-review-20261017-9439d1c8`，名称只是预分配检查目录，不代表最终通过。

- `check.log`、`appearance.log`、`english-suite.log`、`scene-selection.log`：正式检查通过。
- `consumer-probe.log`：41项通过，A1未再现。
- `selected-contrast-probe.log`及`probe/selected-contrast-expression.js`：真实选中节点与参考叠色计算，4/5纯红组合低于门槛。
- `selected-contrast-initial-transition-attempt.log`保留最初未关闭控件transition的尝试；其主题切换期间读到了过渡颜色，不用于结论。最终probe在fixture中禁用transition，只读取稳定终态，没有改生产动画。
- `selected-primary-design-samples.json`：推荐普通primary前景的设计核算，明确不等于生产修复已通过。
- 更新结论文档前424个保护文件指纹一致，见`before.json`及`protected-verification.json`；Codex未改生产/正式QA。

复跑现象：`node <证据目录>/probe/appearance-regression.mjs --selected-contrast-review`；旧A1/41项用`--accent-review`。探针退出0是观察流程完成，不代表A2通过。

本轮只有独立临时profile的无头Edge与假Host，未查询/操作真实DSH/WE、截图、打包安装、改版本/assets、提交推送或跨会话消息。日常rc.31文件保持，当前播放/进程状态未查询；未重复未变的原生、pairing、temp-profile及性能流程。120%随未来功能包交付，不单独重复候选/实机；保留旧归档/证据/备份，不直接发布含无关Trace的整个工作区。
