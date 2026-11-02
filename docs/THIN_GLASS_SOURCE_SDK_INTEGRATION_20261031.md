# B 薄玻璃：侧栏源码与固定底座 SDK 接入

用户实际查看独立样板后选择「薄玻璃效果最好」，随后授权继续。本轮完成 B 材质定点接入及固定底座 SDK 检查，没有生成候选、安装或改变日常 rc.57。

## 结果

- 按钮、输入框、分段选项及开关使用局部 **3px blur + 120% saturation**、低不透明度主题透色和细边缘；取消普通控件的外投影，只保留半像素内侧亮边。悬停／按下仍有反馈，菜单维持较实底色，不为通透牺牲菜单文字。
- 开关去掉凸起渐变，保留 40×24px 和 18px 滑块手柄。轨道去掉凹槽内阴影，手柄改为薄透色和 1px 细边，原生 input、键盘事件及作者参数下发保持。
- 保留宿主相对字号、既有布局／间距／窄栏适配；整栏默认通透，18px 整栏磨砂仍只由独立选项启用。未加动画、SVG 折射库、React 19 或任何生产依赖。
- 减少透明度／高对比度模式切为实底并撤去局部滤镜。SDK 发现低优先级降级规则被普通控件盖住，已修正；滑块伪元素也补降级。

两项既有实现变化：`dsh-whale-mist/src/sidebar/native-appearance-sidebar.js` 的 controls CSS 和同步生成的 `src/client.js`。新增 SDK 检查文件 `qa/sidebar-material/thin-glass-sdk.mjs`；未改播放、作者读取／提交／恢复、存储字段、版本或资产。

## 范围和字节证据

`.tmp/thin-glass-source-20261031-a` 保存本轮 439 个输入指纹及两项前像。最终 437 项保持，批准变化仅 client／sidebar；**两个文件的 controls CSS 之外字节逐项一致**。生成 CSS 与源相同，生成器 `--check`、三项 JS 语法、CSS 模板 guard、diff whitespace 检查通过。已知 Git 的 LF→CRLF 提示保留，不改变换行策略。

固定完整底座沿用已审 `.tmp/pixso-ui-proportion-material-sdk-20261031-c` 的 47 文件，只替换其中已核准的 CSS 子串，不用共享 ESM 整体替换发行片段。最终 `.tmp/thin-glass-sdk-20261031-c/integration-proof.json` 核对：46 文件／14 资产不变；固定 client 和完整 adapter 在 CSS 外字节一致，诊断记录器前缀及导出包装保留。运行源码与实际 QA、报告中的输入哈希逐项绑定。

这是隔离的 rc.57 底座 overlay，旧版本和诊断 build 元数据尚未转换为新候选身份；不要将它直接当发行包安装。共享开发树 manifest/assets 仍为原基线且含其它开发成果，不整体打包。

## 检查与限制

| 检查 | 实际结果 |
| --- | --- |
| 现有主题、可读性、材质相关行为 | 37 项通过；hooks／服务替身，不称实机。此后只修 CSS 媒体分支及 QA 焦点方法，JS 外围字节保持，不机械重跑整套。 |
| 实际官方 Windows rc.3 SDK | 7 项既有材质／布局／作者链路 + 4 项薄玻璃检查，共 11 项通过。包括明暗主题、280/320/400/520/570px、面板切换、作者滑块键盘 2→3→2 原下发链路及高对比度降级。 |
| 本轮具体材质 | 普通按钮实读 `blur(3px) saturate(1.2)`，只有细内亮边；开关 40×24px；字体与宿主相同。Chromium 的 range 伪元素 computedStyle 不可靠，只收观察，不以其尺寸当屏幕证明。 |
| 协议／原生边界 | 通过原 WHL1 客户端解码有限合成 JPEG 帧；Host API 与实际适配器在隔离测试运行，窗口／采集／WE IO 是替身，不是实机或连续播放性能证明。 |
| 资源收尾 | 三轮自有浏览器、HTTP／桥接服务均正常收尾，子进程退出0/1按实际留档，无超时；最终订阅／引用／监听／URL／stream 均清理。 |

保留的失败：

1. `-a`：程序化 focus 延续鼠标输入模式，测试错误要求 `:focus-visible` 出现；改用真实 Shift+Tab／Tab 到控件，生产代码不为测试改动。
2. `-b`：高对比度实读仍有滤镜，确认是 CSS 优先级问题。保留失败截图／日志后修实际媒体分支，另起 `-c` 重验通过。

最终 SDK 运行约 5.48 秒，父监督 45 秒，阶段期限保持，无扩大等待。页面 JS 错误为零；原夹具主连接竞争的两个精确 401（snapshot/disconnect）按既有身份／时点边界核对，不称零控制台错误。没有操作日常 DSH／WE、Profile 或真实浏览器账号。

## 实际 SDK 截图

背景为本轮生成的曲线 JPEG，不含用户壁纸或会话；是官方 SDK 下的控件呈现，不能替代用户实机观感。

- [深色：通透](previews/thin-glass-integration-20261031/thin-abyss-clear.png)
- [深色：毛玻璃](previews/thin-glass-integration-20261031/thin-abyss-frosted.png)
- [浅色：通透](previews/thin-glass-integration-20261031/thin-mist-clear.png)
- [浅色：毛玻璃](previews/thin-glass-integration-20261031/thin-mist-frosted.png)

下一小步可单独准备固定底座的新本机候选及新备份／回退流程，重建两端一致的新版本／诊断身份，不从共享树整体打包。安装仍需当时方便／无任务与正常退出确认、新备份；本轮不自动打包或安装。日常 DSH rc.3／Whale rc.57／Git Bash 0.1.2、公开 rc.53 保持，无提交推送、清理或恢复其它专项。
