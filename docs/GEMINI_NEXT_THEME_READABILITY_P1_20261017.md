# 给小G：主题可读性P1——文字增强与聊天底色强度

2026-10-17，Codex拆分。用户已同意继续。先读根`AGENTS.md`、`NEXT_TASK.md`、两份README、[项目状态](PROJECT_STATUS.md)、[外观预设P1最终复审](WALLPAPER_APPEARANCE_PRESETS_P1_FINAL_REVIEW_20261017.md)及[主题只读调查](THEME_READABILITY_ACCENT_DESIGN_NOTES_20261016.md)。本文件将调查中的第一小步定成可编码范围；下文是本轮实现决策，不是已经实机确认的效果。

## 目标与范围

解决亮/复杂壁纸上文字和普通工具行不够清楚的问题。本轮只做两个控件：**文字可读性：标准/增强**，以及**聊天底色强度：0–100%**。保留现有主题和四套深色配色。旧“聊天区使用不透明底色”控件升级为强度滑块，同一区域只保留一个用户控件。

独立强调色、自定义主题底色、主题字段进入壁纸预设、自动套用和WE作者属性留待后续。不要临时重构整个设置页、修改官方组件、Host或采集生命周期。预设P1的R1/R2已经闭合，保留其已通过状态。

## 行为与数据契约

沿用全局键`dsh-whale-mist.appearance.v1`，只增加以下两项，不另建主题存储：

| 字段 | 类型/范围 | 缺省与作用 |
| --- | --- | --- |
| `textContrast` | `standard` / `enhanced` | 默认standard；standard不额外覆盖现有文字令牌，继续尊重系统高对比度；enhanced主动增强普通文字的层次区分 |
| `chatBackdrop` | 有限数字，整数化、钳位0–100 | 新用户及旧opaqueChat=false默认0；旧opaqueChat=true迁移100；只在真实背景层生效时覆盖聊天列 |

### 文字增强

控件始终显示于“界面可读性”分组，复用现有选项样式、键盘与选中态。`standard`的文案提示“保持主题原有文字，跟随系统高对比度”；增强提示“提高正文、次要说明和普通工具行的区分，不改变状态含义”。中英文均补齐。

只覆盖下面三个已有普通文字令牌，作为本轮可复核的初始值：

| 令牌 | 浅色Mist增强 | 深色Abyss四配色增强 |
| --- | --- | --- |
| `--dsw-alias-label-primary` | `#0c263b` | `#f2f5fc` |
| `--dsw-alias-label-secondary` | `#3c566b` | `#c0cada` |
| `--dsw-alias-label-tertiary` | `#506b80` | `#a3afc2` |

现有系统`prefers-contrast: more`已包含secondary/tertiary增强，复用这些接缝即可；手动增强不等于模拟系统偏好，不能因此触发隐藏壁纸的系统保护规则。系统more/reduced-transparency仍优先保留原保护，用户选standard不能撤销系统增强。

普通工具图标若原本继承行色，随相应文字令牌自然增强；不增加全局SVG/文本强制染色、CSS contrast滤镜或文字扫描。保留按钮前景`label-primary-foreground`、链接/品牌、业务强调、成功/错误/警告、禁用色及文件类型色。不要把所有图标都变成正文色，也不要顺手实现强调色。

作用域限定插件自身活跃的Mist/Abyss主题，可在无背景时使用。离开Whale主题后不影响官方主题；停用/卸载清除本轮投影属性及变量。standard、enhanced往返以及palette切换不得残留内联覆盖；兼容已有body级`!important`与媒体规则，不仅断言dataset已变化。

### 聊天底色强度与旧开关兼容

用`chatBackdrop`滑块替代旧`opaqueChat`勾选框；与文字控件同属可读性分组。选了图片/视频/Wallpaper背景时显示，background=none时可隐藏但保留值。侧栏`opaqueSidebar`开关、现有`surface`及其含义保持；不保留第二个重复的聊天底色开关。

- **0%**：不额外覆盖聊天列，视觉规则与旧opaqueChat=false一致；不能无条件写一个新背景把原规则清空。
- **1–99%**：在原`.BynINW_centerCol`容器上使用当前主题`--wm-base-rgb`与`chatBackdrop/100`透明度；不随surface再次相乘，不新增另一张遮罩或叠两层相同填充。
- **100%**：等同旧opaqueChat=true，包括整个右侧列、会话标题/对话轨迹标签区域及现有顶角覆盖，保留原`border-top-left-radius:0`等修补。0%及中间值不要继承100%才需要的强制方角。
- 保持既有输入卡片、窗口顶条、菜单、消息裁剪与桌宠保护；不要把背景画到整个frame或新建输入区遮罩。中间值覆盖的也是同一聊天列，不声称只影响正文小卡片。
- 提示明确“0%保留壁纸，100%使用主题实色；覆盖整个聊天列，与侧栏/卡片不透明度分开”。实际背景层未建立、停止/清理、媒体失败或background=none时，新填充不生效；值仍保留，下次有效背景出现时恢复。继续以现有`backdropSelector`/真实背景标记限定生效，不只看已选background字符串。

**迁移与唯一值来源必须明确实现**：

1. 读取时，若`chatBackdrop`为有限数字，钳位/取整后优先使用；否则回退到严格布尔`opaqueChat===true ? 100 : 0`。旧字符串/数字布尔仍视为false。不能因为新默认值0先合并而吞掉旧true。
2. 为保持旧controller调用兼容，保留`opaqueChat`为派生别名：规范化结果与持久化中`opaqueChat === (chatBackdrop===100)`。新字段与旧bool冲突时以上一条优先级为准，不维护两个独立状态。
3. `controller.set('chatBackdrop', n)`更新强度并同步派生bool；旧`set('opaqueChat', true/false)`明确映射到100/0后再规范化，不能让旧settings里的chatBackdrop优先级使别名调用失效。非布尔/非有限数字写入依原校验拒绝。
4. 中间值不携带旧不透明flag，否则会被原CSS覆盖成实色。100与0保持旧端点行为；project/clearProjection完整配对。
5. 冷启动只读取并归一化，不因迁移自动重写存储。用户真实修改时再按现有流程保存。全局reset回到standard、0及opaqueChat=false，并保留壁纸预设库。

`textContrast`的未知枚举回到standard；`chatBackdrop`的负值/过大/小数按上述钳位取整，NaN/Infinity/字符串/null走旧别名回退。range扩展不能让新字段自动混入壁纸预设：`PRESET_PROPERTIES`和v1 entries仍只有brightness/mask/blur/surface。保存/应用/删除四字段预设不改变本轮两项全局设置，预设选择/重开不自动套用。

## 实现接缝与改动范围

- `dsh-whale-mist/src/client.js`：DEFAULT/ALLOWED/RANGE/normalize、controller.set别名协调、project/clear、WhaleAppearanceSettings、主题/背景CSS。使用现有分组和控件函数，按需增加稳定的`data-wm-setting`供检查。
- `dsh-whale-mist/qa/appearance-harness.js`及必要QA扩展：复用真实controller与隔离DOM，补充计算后样式断言。若需要调整fixture，说明它代表什么，不靠更改生产状态来迁就fixture。
- 根/插件README、PROJECT_STATUS与交付报告按实际结果更新；NEXT_TASK留清楚复核入口。AGENTS只改必要的当前任务状态，不改现场规则。
- 没有Host路由、文件扫描、窗口查询、额外定时器、每帧DOM扫描或GPU实验。调控件不发送start/restart/stop/refresh等壁纸命令；组件原有按需读取不能因每次滑动重新扫描。

当前定位可参考client.js的`:55`默认值、`:105`范围、`:135`归一化、`:223`投影、`:281`palette覆盖、`:3030`附近设置返回、`:3710`系统more、`:3728`背景CSS、`:3790`区域填充、`:4330`附近controller.set。行号随本轮改动会漂移，以实际符号为准。官方颜色归属证据位于`.tmp/theme-readability-investigation-20261016-a4c861c5`，只读使用，不执行提取代码或修改官方app.asar。

## 验证要求

不要仅测试新函数返回值或数dataset数量，以下是行为验收点，不规定靠堆断言达到某个总数：

1. **旧设置/持久化**：缺新字段的opaqueChat false/true分别迁移0/100；损坏布尔、坏新枚举/数值、双字段冲突、数值边界、小数、旧别名调用往返。默认读不重写localStorage，其它原有设置保留；新实例重开和reset正确。
2. **真实控件**：通过真实onChange/onClick更新controller、显示与持久化；聊天旧重复勾选框消失；标签有中英文及键盘可访问名称。不要依赖变化后的固定useState槽位索引伪造成功。
3. **真实CSS计算**：Mist与Abyss四palette共五组合，标准保持原值、增强命中三令牌、返回标准及切换palette/主题无残留。建立小型普通正文/工具行继承色、显式语义状态色/按钮前景fixture，证明增强只改应改部分；不要只核对CSS字符串或data属性。
4. **聊天填充**：真实背景标记下同一centerCol验证0/中间值/100的颜色与alpha、100顶角行为、surface独立性；模拟标题/标签/输入卡片层，确认无整个frame填充、原输入保护与裁剪规则不被改写。关闭实际背景标记/停止、切换非Whale主题、停用、重开能正确恢复/清除。此为隔离规则检查，不声称实机裁剪/像素已验收。
5. **系统偏好**：standard遵守系统more；手动enhanced并不隐藏背景。more/reduced-transparency的原隐藏背景/不透明保护保持；偏好解除后按保存选项恢复，不回写用户选项。
6. **预设与播放隔离**：本轮两项全局设置不进入四字段预设；保存/应用/删除/reset保留各自语义；P1 R1/R2状态屏障不回退。模拟Host记录控件调整不新增播放/清理/目录刷新命令。

运行`npm run check`、`npm run test:appearance`及`node qa/appearance-regression.mjs --scene-selection-only`。采用独立输出目录/临时profile，假Host为全部壁纸端点提供受控回复，禁止接真实DSH端点；不截图或开正式应用。现有外观160项及额外17项是上轮审查结果，不把复制旧日志当本轮通过；记录实际断言数与新增覆盖。未改Host/native不机械重跑原生或性能全套。

## 交付与现场边界

交付报告写到`docs/THEME_READABILITY_P1_DELIVERY_20261017.md`，列字段/迁移表、令牌与生效范围、真实命令/证据、未覆盖边界；完成后交Codex复核。出现与本契约冲突的实际组件限制，先记录证据与具体取舍，不悄悄扩大范围或把代码检查当观感通过。

本轮只编码、隔离检查与文档，不改版本、不构建原生assets、不打包/安装/热改、不查询或操作DSH/WE、不提交推送、不删除旧证据/归档/备份、不向其它会话发消息。用户此前“继续”是当前小步授权，不能复用旧退出状态操作应用。日常rc.31保持，manifest/assets仍rc.30；未来功能包从已审rc.31独立叠加并审计，控制无关Trace，120%随功能包交付，不单独重复候选/实机。
