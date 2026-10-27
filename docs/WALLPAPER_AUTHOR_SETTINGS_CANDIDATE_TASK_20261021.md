> 2026-10-21 进展：[rc.44核包通过](RC44_AUTHOR_SETTINGS_CANDIDATE_REVIEW_20261021.md)，rc.43失败尝试保留；下一步按[短验准备](RC44_AUTHOR_SETTINGS_SHORT_TEST_PREPARATION_20261021.md)取得新的方便/退出确认，尚未安装。下文保留候选制作要求。

# 作者设置：从固定rc.42构建最小候选

2026-10-21。先读[P1A双端草稿](WALLPAPER_AUTHOR_SETTINGS_P1_DRAFT_DELIVERY_20261021.md)和[P1B定向下发](WALLPAPER_AUTHOR_SETTINGS_APPLY_DELIVERY_20261021.md)。日常仍rc.42；本任务先构建核包，不安装、不操作DSH/WE、不执行真实属性命令。

1. 核对git脏改动并冻结输入。固定来源为`release/plugins/dsh-whale-mist-0.6.0-rc.42.tgz`，SHA256 `A9B8044CB9C11CCC8B5FAB5309814B3616F267F9F15479484CCE79D714F70CB8`。确认归档/版本占用后分配新候选号，不覆盖任何旧包。
2. 解固定归档到独立目录，只移入作者参数所需变更：P0受限metadata投影/library入口及5个作者模块，P1双端表单/认证静态闭包/主端生成闭包，P1B session只增加windowStartUtc状态、唯一Host adapter和apply入口。其它既有功能保持固定rc.42。不能复制整个开发client/session或整包开发树：其中仍有Trace/后续诊断代码，manifest/生产assets仍rc.30。
3. 特别核对主端嵌入bridge、共享contract、实际HTML/companion导入及schema/adapter的Node导入闭包；加入模块不可成为任意静态文件路由。共享表单生成应与本轮受审源码一致。包内应是已审P4原生资产，原生12文件不改，不混入开发Trace二进制。
4. 明确逐文件前后差异与导入闭包，从实际tgz解包运行适用335项主检查、24销毁、只读SDK载体和参数接收器边界检查。QA与监督脚本从受审冻结输入进入独立目录，修正过的LF/CRLF选择器测试须保留。验证须有期限和子进程退出证明；不得借核包调用真实WE或日常DSH。
5. 静态/源码/替身/真实接收器结果分别记录。核包通过后才向用户请求当时方便/无任务并正常退出，新备份当前活动包、Profile及关闭存储。规划一个已批准Everyone场景/网页样例、少量可见参数的“保存草稿→应用→观察→停止”短验，默认恢复rc.42与本轮原设置，是否改作日常另由用户决定。

本轮未取得新的实机授权。不得因为脚本/335项通过就声称作者代码已响应或所有壁纸参数兼容；未知退出、缺失窗口身份、不同活动ID及分级收紧仍须拒绝。原WE和其它范围保持。
