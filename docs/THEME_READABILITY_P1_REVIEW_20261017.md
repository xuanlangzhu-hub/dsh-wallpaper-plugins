# 主题可读性P1复审：功能检查通过，英文QA须小补

2026-10-17，Codex。复核[任务](GEMINI_NEXT_THEME_READABILITY_P1_20261017.md)、[小G交付](THEME_READABILITY_P1_DELIVERY_20261017.md)、实际生产及QA差异。**功能实现本轮未发现阻塞问题；交付测试仍有一项QA1需补修，暂不标整体完成。** 保留已经通过的迁移、样式及前序预设边界，不扩大为主题重做。

## 已通过范围

- `npm run check`通过，含CSS模板守卫；当前中文环境`npm run test:appearance`实际281项通过。
- 场景选择检查通过，正向自动启动一次，修改过选择则不自动启动。
- 两字段归一化、旧opaqueChat迁移、派生别名、controller写入协调及默认/reset符合契约；旧四字段预设未混入主题字段，旧预设屏障代码未被本轮修改。
- Codex额外45项隔离断言通过：Mist与Abyss四配色的普通工具行/图标继承、成功/错误/警告及按钮前景保持、聊天底色0/50/100与顶角、实际图片背景建立/移除、surface独立、手动增强不隐藏背景、系统more/reduced-transparency及偏好解除后恢复、主题作用域、英文真实控件文案、调节不新增Host请求。

额外检查建立真实图片背景和最小聊天/工具行DOM，使用真实controller与计算后样式；Host为隔离假回复。无截图、真实DSH/WE操作或实机观感验收。inactive主题检查使用CSS活跃类移除模拟作用域，不宣称对官方切主题流程作了实机验收。

## QA1 [P2] 英文提示测试与生产文案不一致，英文环境回归失败

定位：`dsh-whale-mist/qa/appearance-harness.js:669–680`，对应生产`src/client.js:2448–2449`。

增强提示测试预期`Increases distinction...`，并按该前缀查找节点；生产实际提示为`Increases separation between body text, secondary notes, and normal tool rows without altering semantic states`。标准提示测试预期/查找`Preserves the theme...`，生产实际为`Preserves original theme text and follows system high contrast`。两组查找条件和断言文本都未同步。

本轮在独立QA页面将`navigator.language`受控设为`en-US`后执行真实`fixture.run()`，退出码1，失败于：

```text
Error: dynamic hint displays enhanced copy when enhanced
```

增强项为实跑失败；标准项的同类不一致也已由源码核对确认。补充探针通过真实英文标准按钮/组件检查，两种实际提示都能正常渲染，因此这是**测试错误，不能据此认定英文产品UI损坏**。当前中文环境281项通过不能证明英文分支通过；交付中的“中英文验证通过”范围需修正。

### 最小补修

1. 修正QA中的英文预期与节点定位，保留真实控件/显示内容校验；不要为了迎合旧断言改生产文案，也不要删除提示断言或强制所有测试使用中文。
2. 在正式QA中明确覆盖zh-CN、en-US两语言的standard/enhanced切换、提示及选中状态；可做同一隔离页面的定向双语言控件检查，不要求重复所有媒体生成。恢复语言桩，避免污染后续断言。查找应限定目标设置行/稳定结构，避免依赖过时英文片段或固定hook槽位。
3. 复跑check、默认外观与场景选择，并给出英文分支的实际通过证据。单纯将预期常量写成当前DOM读数不构成校验。
4. 修正交付断言数：上轮实际基线为160项，本轮实际281项，净增121。原报告“140+141”与前序日志不符；新增静态assert数量、循环执行数与最终passed若不同，应注明，不能混用。

**本次只需QA及报告补修。** 生产功能保留；若验证中发现真实生产缺陷，先记录证据再限定范围，不顺手改强调色/Host/生命周期。补修交付到`docs/THEME_READABILITY_P1_QA_REPAIR_DELIVERY_20261017.md`，原交付与本复审保留。

## 本轮证据与边界

目录：`F:\dsh-wallpaper-plugins\.tmp\theme-readability-p1-review-20261017-7ad2b53e`。

- `check.log`、`appearance.log`、`scene-selection.log`：默认检查结果。
- `english-suite.log`：英文fixture真实失败，Node进程退出码1（外层采集命令正常完成不代表该检查通过）。
- `readability-supplemental.log`：额外45项通过；`probe/readability-expression.js`及隔离runner保存完整步骤。
- `before.json`、源码/QA快照及`protected-verification.json`：更新结论/接续文档前417个保护文件指纹一致，覆盖工作区、manifest/assets、旧包、日常安装文件和5个Profile。Codex未改生产或正式QA。

复跑英文失败：`node <证据目录>/probe/appearance-regression.mjs --english-suite`。它受控切换语言、执行真实fixture.run，不含正式runner随后执行的系统媒体/快速切换尾部检查；其通过断言数不要求等于默认281。补充计算样式/媒体偏好：同一runner加`--readability-review`。

使用独立临时profile的无头Edge和假Host，未查询或操作真实DSH/WE，未打包/安装、改版本/assets、提交推送或向其它会话发消息。日常rc.31文件保持，当前运行/播放状态未查询。背景/控件代码检查不替代真实DSH验收。

QA1闭合后再拆独立强调色；主题纳入壁纸预设仍是后续范围。120%继续随未来功能包交付，不单独重复候选/实机，不直接发布含无关Trace的整个工作区。
