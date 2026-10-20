# 主题可读性P1最终复审：QA1闭合，代码与隔离回归通过

2026-10-17，Codex。复核[QA1补修交付](THEME_READABILITY_P1_QA_REPAIR_DELIVERY_20261017.md)、[首轮复审](THEME_READABILITY_P1_REVIEW_20261017.md)及实际差异。**本轮通过，QA1闭合，主题可读性P1可以结束编码补修。** 新功能尚未打包安装或取得真实DSH观感验收。

## 补修核对

- 生产`src/client.js`与首轮复审快照SHA-256一致，没有为迎合测试改动实际英文文案、颜色、迁移或底色实现；manifest/assets、Host/原生代码保持。
- QA定位改为目标textContrast行及其copy/label/hint结构，移除了过时英文片段模糊查找。
- 正式harness明确遍历zh-CN与en-US，通过真实按钮检查行标签、标准/增强文案、controller值、选中样式、aria-pressed及动态提示。预期为独立文本常量，没有从当前DOM反向生成“正确答案”。
- 语言桩在finally恢复原语言值；没有强制全套只跑中文或删除失败断言。
- 正式runner增加`--english-suite`，本轮独立实跑退出0。首轮发现的英文提示断言失败不再出现。

本次QA改动未引入新的生产行为。首轮迁移/样式/预设隔离结论与额外45项检查作为历史证据保留；生产指纹一致，本轮未机械重复该45项、GPU/性能或实机流程。

## 实跑结果与计数口径

| 命令 | 实际结果 |
| --- | --- |
| `npm run check` | 通过，含语法及CSS模板守卫 |
| `npm run test:appearance` | **298项通过**，其中含显式双语言控件检查 |
| `node qa/appearance-regression.mjs --english-suite` | **294项通过**，语言en-US，执行完整fixture.run |
| `node qa/appearance-regression.mjs --scene-selection-only` | 通过；未改选择启动一次，改过选择不自动启动 |

**校正交付中的“默认与英文均294”**：英文分支执行fixture.run后输出294；默认分支还运行四项尾部断言：reduced-motion暂停视频、reduced-transparency隐藏背景、快速来源切换释放资源、dispose取消加载，因此默认为298。差异来自runner覆盖范围，不是中英文控件漏跑。两种入口不能笼统称为相同的全量覆盖。

前序预设基线160、本轮默认298，默认入口净增138；英文入口294只与同范围fixture比较。先前报告的静态assert数量/循环展开说明保留作参考，本次最终结论以各实际日志为准。该计数修正已由本复审说明，不要求小G再次返工功能或为凑相同数字重复媒体流程。

## 证据与现场保护

目录：`F:\dsh-wallpaper-plugins\.tmp\theme-readability-p1-final-review-20261017-f14fb5a9`。

`check.log`、`appearance.log`、`english-suite.log`、`scene-selection.log`保存实际输出；`appearance.log`含中英文逐项提示/选中态结果。`before.json`、生产/QA快照、`protected-verification.json`、`review-verification.json`保存输入及保护核验。

更新本轮结论/入口文档前，**419个保护文件指纹一致**，覆盖工作区生产/QA、manifest/assets、旧包归档、日常安装文件和5个Profile。Codex本轮只运行既有隔离检查、保存本机证据并更新文档，未修改生产或正式QA。

检查使用独立临时profile的无头Edge与QA假Host，不是官方DSH验收；未查询/操作真实DSH或WE、截图、打包安装、改版本/assets、提交推送、清理归档或发送跨会话消息。日常rc.31文件保持，当前运行/播放状态未查询。未启动新的主题编码任务。

## 下一步

主题可读性P1的文字标准/增强、聊天底色0–100及旧opaqueChat兼容在代码/隔离范围闭合，四字段壁纸预设及R1/R2成果保留。下一小步可拆**独立强调色**的字段、控件和令牌白名单，保留普通工具继承色与成功/警告/错误等状态色的区别；主题字段进入壁纸预设、自动套用仍留后续。

尚未给小G下新的强调色编码任务。120%继续随未来功能包交付，不单独重复候选/实机；工作区manifest/assets仍rc.30冻结，未来从已审rc.31独立叠加并审计，不直接把含无关Trace的整个工作区发布为日常包。
