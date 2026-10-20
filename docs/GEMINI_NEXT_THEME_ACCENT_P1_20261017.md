# 给小G：独立强调色P1——跟随主题与自定义

2026-10-17，Codex拆分，用户已同意继续。先读AGENTS、NEXT_TASK、两份README、PROJECT_STATUS、[主题可读性最终复审](THEME_READABILITY_P1_FINAL_REVIEW_20261017.md)、[四字段预设最终复审](WALLPAPER_APPEARANCE_PRESETS_P1_FINAL_REVIEW_20261017.md)及[主题调查](THEME_READABILITY_ACCENT_DESIGN_NOTES_20261016.md)。本文件是本轮具体编码契约，取代旧调查中强调色控件尚未确定的建议；不是已经实现或实机验收的功能。

## 目标与范围

在既有Mist/Abyss与四深色配色之外，开放独立强调色：**跟随主题 / 自定义**。主按钮、普通链接、引用/业务高亮、选中态和焦点使用明确白名单。用户不必为了换强调色连底色一起换掉。

默认跟随主题，保持当前外观与令牌结果；自定义只改变下列交互色，不改主题base/layers/sidebar底色、全局文字、textContrast、chatBackdrop、壁纸滤镜或既有保护。普通工具行/继承图标继续属于可读性，成功/警告/错误、禁用行为、代码差异与文件类型色保留。不要全局重染SVG、替换所有蓝紫色或使用hue/contrast滤镜。

主题字段进入壁纸预设、自动套用、自定义主题底色、作者WE属性与新性能专项留后续。本轮不打包安装或操作真实应用。

## 字段、控件与存储

沿用`dsh-whale-mist.appearance.v1`，只新增：

| 字段 | 契约 |
| --- | --- |
| `accentMode` | `theme` / `custom`，默认theme |
| `accentColor` | 严格`#RRGGBB`六位不透明十六进制，接受大小写、规范化小写；默认候选`#8c72f2`，在theme模式下不生效 |

颜色只接受字符串且完整匹配`^#[0-9a-fA-F]{6}$`，不接受短hex、alpha、颜色名、CSS表达式、空格前后缀或任意字符串。存储中的非法/缺失颜色回退候选默认值；若存储同时声称custom而没有合法颜色，模式也回退theme，避免损坏旧存储突然强加紫色。未知模式回退theme。新用户/旧存储缺字段默认为theme，现有其它字段保持，冷启动不自动重写存储。

`controller.set`对非法枚举/颜色写入拒绝且保持现状，不让无效输入污染CSS。设置合法颜色本身不隐式改变模式；选择custom时使用已经规范化并保留的候选值。切回theme保留最后候选颜色，稍后重新custom可恢复；全局reset回到theme及默认候选，并保留壁纸预设库。

设置区在主题/配色附近新增独立“强调色”分组：

- 分段按钮“跟随主题 / 自定义”，中英文、aria选中态及键盘行为与现有控件一致。
- 仅custom显示一个原生`input[type=color]`及当前六位hex文本（只读即可）；本轮不增加第二个自由文本颜色编辑器、吸色器或颜色库。
- 可用小型静态示例显示“主按钮 / 链接”实际派生色，复用本页样式，不运行播放/截图或另开页面。
- 提示说明“按钮使用所选颜色；链接、高亮和焦点会随主题调整深浅以便识别。跟随主题恢复原配色”。不宣称所有图标都会同色。
- 现有palette仍选择主题底色；custom时切换palette不重置raw颜色，派生文字色随新底色重新计算；theme时完整回归各palette原有强调色。更新palette提示，避免它仍暗示可覆盖当前独立强调色。

两字段是全局设置；当前壁纸预设v1仍只有brightness/mask/blur/surface。保存/应用/删除四字段预设不改变强调色，选壁纸不自动套色；不得因新增字段而更改R1/R2清理/可用性屏障。

## 派生色规则

区分所选raw填充色、可读的ink色和按钮前景色。以下4.5是本功能对**不透明参考面**的数值设计门槛，不是任意动态壁纸的对比保证；不要据此宣称全面无障碍认证。

1. 对8位sRGB通道`v/255`：小于等于0.04045则除12.92，否则`((v+0.055)/1.055)^2.4`；亮度`L=0.2126R+0.7152G+0.0722B`；两色比值为`(max(L1,L2)+0.05)/(min(L1,L2)+0.05)`。
2. 主按钮normal fill使用raw，前景在纯黑/纯白中选择与raw比值更高者（相等取黑）。同一前景用于normal/hover，不改普通正文primary。
3. hover先按sRGB整数通道将raw向所选前景混合12%，四舍五入；若与该前景比值低于4.5，则改向相反端点混合12%。验证最终量化后的normal/hover都达到4.5，不只检查未取整浮点值。此规则让黑白极值也有可见hover变化；不要只写背景而忽略文字。
4. ink用于文字式链接/引用/品牌高亮及焦点。若raw在当前主题的不透明参考面上最小比值已达4.5则保留；否则Mist向黑、Abyss向白混合，在`k/255，k=1..255`中取首个量化后满足全部参考面的颜色。参考面取现有主题base、layer1/2/3、sidebar及deep sidebar的RGB（忽略原alpha，作为不透明面），复用源码现有数据，不读屏幕像素/壁纸或调用getComputedStyle做每帧推断。
5. 透明选中底/轻按钮使用raw固定alpha，不把surface/chatBackdrop再乘进强调色：轻按钮normal/hover为0.18/0.26，交互normal/hover/active为0.16/0.12/0.20，业务浅底0.20，侧栏选中底0.16。选中标记与焦点用不透明ink保持识别，不把浅底alpha当文字色。

黑/白极值、#808080、中间明度与高饱和红绿蓝都应能确定性派生。运算仅在设置/主题变更时进行，不建定时器、每帧扫描或自动追色。颜色派生的作用是可控基础行为，最终观感留后续功能包验收。

## 自定义模式令牌白名单

只有custom且当前Whale主题活跃时覆盖；theme模式不新增这些令牌覆盖，以保留旧基线（包括当前链接原值）。

| 接缝 | 自定义值 |
| --- | --- |
| `--dsw-alias-button-primary-fill` / `--dsw-alias-button-primary-hover` | raw / 派生hover |
| `--dsw-alias-label-primary-foreground` | 上述黑/白按钮前景；不要误改普通label-primary |
| `--dsw-alias-brand-primary` / `--dsw-alias-brand-primary-new-colorprimary-new-color` | ink |
| `--dsw-alias-link` | ink；普通Markdown链接确实使用此令牌，不能只改brand |
| `--dsw-alias-markdown-citation` / `--dsw-alias-state-business-primary` | ink |
| `--dsw-alias-state-business-tertiary` | raw alpha0.20 |
| `--dsw-alias-button-info-fill` / `--dsw-alias-button-info-hover` | raw alpha0.18/0.26 |
| `--dsw-alias-button-ghost-active-fill` | raw alpha0.20 |
| `--dsw-alias-interactive-bg-primary` / `--dsw-alias-interactive-bg-hover` / `--dsw-alias-interactive-bg-active` | raw alpha0.16/0.12/0.20 |
| `--dsw-specific-sidebar-nav-item-active` / `--dsw-specific-sidebar-nav-item-active-accent` | raw alpha0.16 / ink |
| `--dsw-focus-ring-color`及插件既有`:focus-visible`接缝 | ink；真实轮廓须命中，不能只写未被使用的变量 |

官方Button的primary使用fill+label-primary-foreground，hover只换fill，因此需同一前景覆盖两个状态。官方Markdown使用alias-link；普通工具DisclosureRow使用label-tertiary/secondary，这部分**不纳入accent**。

本插件有硬编码蓝/紫焦点和设置选中态，custom时须接入同一ink/raw轻底（查`body.* :focus-visible`、`.wm-settings-option.is-selected`等），不让控件本身仍显示旧紫色。原样式的尺寸、轮廓宽度/偏移、键盘可用性保持。

`.wm-status-mark`普通品牌标记若因brand token变化而换底，须同时配对可读前景（可局部使用raw+按钮前景）；waiting/complete等已有语义状态的背景/图标必须保留，不用更高特异性规则压掉它们。状态呼吸动效不新增或扩展；旧装饰光晕无需全部追色。

不扩充到bubble/主题光晕、滚动条、分隔线、普通文字、成功/警告/错误/idle、diff增删色、文件类型静态色或官方文件。`--wm-accent-rgb`目前只在palette定义，单写它不能算完成；若本步复用，记录其实际消费者，不能用“覆盖很多变量”代替元素验收。

## CSS层叠与生命周期

当前最终style由`css + paletteCss + backdropCss`组成，palette有body级`!important`；deep sidebar分支选择器还多一层属性。新覆盖必须在**实际层叠中**胜出，包括四palette、deep sidebar、canvas/glass变体及背景开启时。仅在style末尾追加同特异性不足的选择器仍可能失败。可集中增加custom作用域及私有`--wm-custom-*`派生变量，不改写官方主题归档或依赖私有React DOM扫描。

theme模式/离开Whale活跃类/插件停用时不得残留官方令牌覆盖；私有变量、dataset、style的project/clear配对。保留`accentColor`候选不等于保留custom投影。不要把官方令牌直接作为无条件body行内important写入后忘记恢复；若确需改变投影机制，记录原值/归属并证明恢复，优先沿用作用域CSS。

与textContrast同时增强时只改各自白名单，按钮前景不被三普通文字令牌覆盖。系统more/reduced-transparency、偏好解除与原背景隐藏/恢复规则保持；不得根据强调色模式模拟系统偏好或重写用户设置。

## 代码范围与验证

主要修改`dsh-whale-mist/src/client.js`的设置/校验/归一化、派生/投影/清理、设置控件和CSS；QA限相应harness/runner及必要小辅助。保留已有未提交实现，不回退可读性/预设修复，不改Host/native/版本/assets。

新增隔离行为检查，使用真实controller、真实控件回调与计算后CSS；预期值独立于被测派生函数，不把实际DOM颜色读出来再充当预期：

1. **默认兼容**：缺字段/坏模式/坏颜色/大小写/字段冲突、冷启动不写入、controller非法值拒绝、候选保留、自定义与theme往返、重开/reset；上轮Mist/Abyss四palette的theme模式令牌/焦点/链接基线不变。
2. **极值与配对**：至少黑、白、灰、#8c72f2和红绿蓝，五主题组合；normal/hover实际填充和按钮前景符合算法、量化后比值达门槛；ink符合参考面条件，custom raw在切palette时保持，ink按新主题派生。
3. **真实消费者**：建立最小primary按钮、普通Markdown链接、引用/业务标记、nav选中、设置选中和可键盘聚焦fixture；必要时只读复用已有官方CSS提取文件并记录来源，不执行官方提取JS。计算样式验证normal/hover/focus/active，尤其真实focus轮廓和deep-sidebar特异性，不能只查body变量或CSS字符串。
4. **不误染**：textContrast standard/enhanced两档，普通工具行/继承图标、success/warn/error、文件类型色、disabled行为与主题底色保持；状态waiting/complete不被普通品牌标记覆盖。预设依然严格四字段，保存/应用/删除不碰强调色。
5. **生命周期/系统**：实际图片或受控背景状态下，与chatBackdrop/surface独立；停止、未出帧与background=none不改变所存强调色；非Whale作用域、跟随主题、卸载、重开无残留。系统more/reduced-transparency仍保持原保护，解除后按保存选项恢复。
6. **双语言与交互隔离**：正式harness显式zh-CN/en-US验证真实按钮、标签、色值与提示、aria/选中态，finally恢复语言桩；不要再使用过时文案片段模糊定位或固定hook槽位。调色不新增Host start/stop/restart/refresh/扫描请求，也不做窗口/进程查询。

运行`npm run check`、`npm run test:appearance`、`node qa/appearance-regression.mjs --english-suite`和`--scene-selection-only`，补充相应新断言。现有默认298、英文fixture294相差默认尾部四项检查，记录各入口真实passed/退出码和覆盖，不估算统一总数。静态assert处数与循环执行数分开。不得删旧断言凑通过；测试输入全假Host端点，独立临时profile/证据目录，不截图或开正式应用。未改Host/native不重跑原生/性能全套。

## 交付与边界

报告写入`docs/THEME_ACCENT_P1_DELIVERY_20261017.md`，列字段/迁移、颜色派生、实际命中的白名单与消费者、未改色范围、CSS层叠证据、实际命令/输出和未覆盖部分，交Codex复核。发现既有接缝限制时记录具体证据，不擅自换全局滤镜、染色所有图标或扩大范围。

本轮只编码/隔离验证/文档；不改官方EXE/app.asar，不查询或操作真实DSH/WE，不打包/安装/热改、不改版本/assets、不提交推送、不清理旧包/实测/备份、不向其它会话发消息。当前“继续”不代替未来现场方便/退出确认。日常rc.31保持，工作区manifest/assets仍rc.30；未来从已审rc.31独立叠加审计，控制无关Trace，不直接打整个工作区/覆盖同版本归档。120%随功能包交付，不单独重复候选或实机。
