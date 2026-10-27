> 本任务已按[P0交付](WALLPAPER_AUTHOR_SETTINGS_P0_DELIVERY_20261021.md)完成离线范围，正式认证/可见表单/WE真实应用另由[P1](WALLPAPER_AUTHOR_SETTINGS_P1_INTEGRATION_TASK_20261021.md)接续，日常rc.42保持。

# 每张壁纸自己的设置：P0 受限元数据与共享表单契约

2026-10-21。[壁纸类型本阶段收束](WALLPAPER_TYPES_CLOSURE_RC42_REVIEW_20261021.md)后进入本任务。用户要从预览列表选壁纸后，在该壁纸详情中看到自己的作者设置，主侧栏和独立窗一致、能及时看效果。P0先补数据和交互契约，不照搬通用设置长表，不改日常安装或执行WE命令。

## 先调查与交付

1. 仅对已批准、当前可显示分级的项目，通过Host按ID重验后读取限量project.json字段，确认scene/web声明的实际参数形状。不要把general.properties存在与否、作者默认值、用户当前WE值混为一谈；缺声明显示“此壁纸未提供可调参数”，不得伪造支持。
2. 设计Host专用schema解析器：字段数量、嵌套深度、字符串/选项长度、数字范围均有限；不执行作者代码或表达式。原始HTML/脚本、个人路径/文件和任意JSON不能直接进入前端。复用既有年龄分级、项目入口及根路径重验，不因打开详情读取隐藏分级的预览/文件。
3. 首批支持bool、有限slider、color、combo；以本地真实声明决定是否需要textinput。file/directory、自定义脚本/表达式先明确未支持；显示条件和翻译token先记录真实形状，再设计有限解析，不能eval。属性label与值当文本，不注入HTML/CSS。
4. 契约包含wallpaperId、schema指纹/版本、字段key/type/约束、默认值与草稿。每张壁纸独立草稿；切换所选壁纸不修改正在播放的另一张，场景A迟到读写不能覆盖B。同步独立窗/主面板时沿现有版本及单controller机制。
5. 先用合成项目和真实Host路由做离线证明：路径/分级/类型变化、损坏schema、过大/非有限数字、非法key/选项、原型键、迟到切换、停止/清理锁、并发双端版本漂移均明确拒绝或保留原值；保留老外观预设、模式、自动播放与亮度/遮罩等通用项。

## 应用链先设计，P0 不真实下发

[官方User Properties](https://docs.wallpaperengine.io/en/web/customization/properties.html)区分bool/slider/color/combo等类型及作者默认值；web接收变更事件不证明我们的控制链已可用。[官方CLI](https://help.wallpaperengine.io/en/functionality/cli.html)支持applyProperties，并可用location定位独立窗口。后续只考虑当前活动ID及同轮location的受限更新，绝不省略location让命令影响全部桌面壁纸。

P0交付生成受校验的内部请求/参数形状和底层IO替身，不执行CLI。必须说明RAW分隔符/引号及字符边界、属性键白名单、范围检查、schema漂移、活动会话/停止代次、迟到结果、命令期限与失败回显；只有退出码并不证明网页或scene真正应用。不得改源project.json、WE全局config、桌面当前壁纸或执行任意属性JSON。

之后再独立接共享控件及受审Host应用路由，最终按当时方便确认、新备份做限定样例可见变化实验。作者参数可用性/持久化/还原与全局外观预设分别验收。本任务不安装发布、不新开真实窗、不发DSH模型请求；工作区manifest/生产assets仍rc.30，不整包开发树。所有QA/CLI/HTTP/子进程均须总截止与退出确认，禁止无限等待。

交付应包含解析/约束设计、真实声明形状清单（不复制私有资源）、合成QA、前后指纹、失败/不支持边界及下一阶段最小实现范围。P0完成不等同实时设置功能已实机可用。
