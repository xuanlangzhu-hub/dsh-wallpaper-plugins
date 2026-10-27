# 短页签标题、统一箭头与本轮UI收尾

2026-10-26。接续[图库整理](WALLPAPER_NATIVE_UI_GALLERY_20261026.md)。源码已完成短标题／箭头整理，日常DSH0.2.1-rc.3／Whalerc.48／GitBash0.1.2保持；未打包安装、操作DSH／WE或写运行设置。整体观感按用户安排留到候选集中看。

## 本步变化

| Before | After | Why |
| --- | --- | --- |
| 原生侧栏页签显示Whale 外观，空间紧时截断 | 可见标题为“外观”，title／可访问名称及注册元信息保留Whale 外观 | 缩短常驻标题，保留完整身份与提示；顶栏入口名称保持 |
| 折叠使用浏览器默认三角，下拉使用⌄，分页使用‹／› | 同一细线chevron样式，展开／收起和左右方向明确 | 减少字体字形差异，保留原无障碍名称和交互 |
| 方向符号可能和播放三角接近 | 折叠／导航用细线箭头，播放保留原三角 | 区分导航和播放，不加旋转过渡动画 |

折叠继续使用原生details／summary；只通过本组件作用域CSS隐藏默认marker并绘制细线。点击／Enter／空格的开关和原错误自动展开机制保持。下拉仍由现有SelectMenu处理键盘／取消／焦点，箭头跟随aria-expanded改变方向；翻页仍调用原changePage，名称／禁用边界保持。装饰箭头不参与可访问名称。作者恢复区的DOM、确认与清除逻辑没有改写。

## 验证与保护

隔离工作／证据目录：`.tmp/ui-title-chevron-20261026-a`。冻结323项已有源码／QA／脚本／资产／归档，提升前全部保持。仅提升两个产品文件及一份新SDK专项；321项非允许既有输入保持。证据见`protected-before.json`、`tested-draft-inputs.json`、`source-diff.patch`、`boundary-audit.json`、`promotion-verification.json`。

作者／界面／图库controller API整体、复杂编辑器／恢复DOM、Preview和直接选择组件逐字保持；SelectMenu仅改装饰箭头节点，规范化对比后本体其余逐字保持；Gallery仅改两个分页图标节点，原动作不变；顶部主控／图库导航及注册信息保持。client原生生成块外逐字保持，含旧标题栏规则；Host、adapter、生产assets、manifest和版本未变，开发仍rc.30。日常rc.48安装只读核对与固定tgz的43文件集合／哈希一致。

| 检查 | 结果／输出 |
| --- | --- |
| 相关单元回归 | 706／706，无跳过／取消；`title-chevron-units-v1`，约10.9秒 |
| 独立短标题／箭头SDK | 7／7；`focused-title-chevron-windows-v1`，约4.4秒 |
| 布局／常用及低频选项／标题箭头联动组 | 42／42；`focused-title-presentation-windows-v1`，约14.2秒 |
| 图库／菜单／画面分组及预设联动组 | 31／31；`focused-title-gallery-actions-windows-v1`，约13.6秒 |
| 作者首次读取／旧结构及脏记录联动组 | 11／11；`focused-title-author-read-windows-v1`，约9.4秒 |
| 静态与生成 | 两个生成器check、JS语法／CSS模板guard通过 |

三组共84条分组检查，各自从新SDK页面启动；不是一轮完整串联84项通过。独立7项与第一组重叠，不能再累加为91项独立覆盖。使用实际官方Windows rc.3模块、完整产品client／controller／Host；原生窗口、WE命令／元数据IO和图片目录仍为明确替身。

七项专项实际检查SDK标题slot的可见短文本及完整提示、顶栏原入口、原生summary单次点击／Enter／空格、marker撤除与真实展开方向、下拉描边一致性及Escape焦点、分页左右方向／名称／动作、强制颜色／减少动态／零动画、280／360／520px及双倍文字无溢出。没有新增只镜像CSS字符串的单测。

四组均确认自有headless Edge退出、HTTP／bridge／Host夹具收尾，订阅／引用／DOM／活动URL为0。独立10／10、三组分别22／22、74／74、9／9 URL全部回收，无带消费者撤销。所有组保留精确HTTP错误预期：作者组唯一显式编辑身份拒绝409，其余组无作者错误；bootstrap／disconnect401按既有身份和正文核对，不笼统忽略日志。

### 保留的整套超时

首次`focused-title-chevron-linked-windows-v1`触发45秒父监督，约46.3秒确认测试node退出；没有完整SDK报告或逐阶段记录，不能确认它执行到哪一步，也不把它算通过。原stdout／stderr／浏览器脚本快照／run结果保留。

退出后只读CIM核对：该node／直接子进程、本轮路径的node及当前headless Edge均未发现活进程，记录在`timeout-process-audit.json`。这只能证明检查时的进程状态，不能补称失败轮有正常的页面／Host清理报告，也没有手动终止日常应用。

后续没有延长45秒期限，而是按上述三个领域分组，并在每项开始／通过、浏览器启动及收尾写独立progress.jsonl，记录node／自有浏览器PID、临时配置身份和退出码。各组仍有45秒期限和51秒兜底；最后检查点均为cleanup-finished且自有浏览器exitCode=0。分组后的证据可独立定位和核验，整套单轮性能／累计状态结论仍未获得。

[折叠及控件箭头示意](previews/title-chevron-20261026/chevron-interface.png)来自隔离SDK及合成内容，不是用户桌面或真实壁纸背景验收；短页签标题另由实际SDK标题slot断言证明。继续沿用emil-design-eng的简洁反馈／键盘原则，无新依赖或动画库。

## 本轮呈现清单复核

| 项目 | 当前状态 |
| --- | --- |
| 紧凑主控、界面页缩小对象条、共享动作popover | [第一步](WALLPAPER_NATIVE_UI_POLISH_STEP1_20261026.md)完成，异常重试仍外露 |
| 画面／界面透出集中、模糊常显、四字段预设精简 | [第二步](WALLPAPER_NATIVE_UI_POLISH_STEP2_20261026.md)完成，聊天底色不入预设 |
| 作者参数标题、来源／原名帮助和重读 | [第三步](WALLPAPER_NATIVE_UI_POLISH_STEP3_20261026.md)完成 |
| 合格Lucy首次自动只读、失败重试及旧记录保护 | [首次读取](WALLPAPER_NATIVE_AUTHOR_INITIAL_READ_20261026.md)完成，不自动apply |
| 常用分段／配色色块及低频选项 | [直接选择](WALLPAPER_NATIVE_UI_DIRECT_CHOICES_20261026.md)／[低频整理](WALLPAPER_NATIVE_UI_LOW_FREQUENCY_20261026.md)完成 |
| 图库密度、分页、选中／播放标记 | [图库](WALLPAPER_NATIVE_UI_GALLERY_20261026.md)完成，分级／预览边界保持 |
| 短页签与chevron统一 | 本步完成 |
| 浅深主题、亮壁纸透明背景及真实桌面整体观感 | 待本轮固定候选集中验收；SDK示意不替代用户观感 |
| 背景来源合并成单一选择入口 | 未做，当前仍沿用原WE／本地图片／本地视频／关闭流程；涉及关闭清理和异步媒体票据，留作独立功能改进 |
| 当前标题栏透明兼容 | 保留[观察记录](TITLEBAR_TRANSPARENCY_OBSERVATION_20261026.md)，本轮不盲换类名或恢复遮盖 |

本轮排定的呈现整理已收尾，未宣称Opus所有可选建议、所有背景来源流程或视觉体验均已完成。下一步基于固定日常rc.48准备本轮UI候选、冻结源码／生成块并独立核包；不能从含Trace的开发rc.30树整体打包。实际安装前另按当时方便／无任务确认并新备份。当前没有新候选包、安装、提交推送、清理、派发或定时任务。
