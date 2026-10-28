# 图库与非 Lucy 参数：固定 rc.52 隔离整合

日期：2026-10-28。结论：**未打包的隔离整合通过，尚未安装或实机验收。** 用户暂停打包／发布的安排保持，日常仍为 rc.52。

## 整合边界

从已验收的 rc.52 原归档提取43个文件，在 `.tmp/rc52-gallery-author-integration-20261028-a/draft/dsh-whale-mist` 整合本轮图库选择、显式播放／切换与非 Lucy 作者参数绑定。不是从共享 rc.30／Trace 开发树整体构建。

- 原归档 SHA256：`93553C4C6E4DD8DCB4C433D9066DBF0814C21341BF7D519B9DE24A0EB14362C4`。
- 原43文件中仅 `src/client.js` 改动；其余42文件、14个资产完全一致，manifest／版本未改。
- client 的原生侧栏片段之外，原文仅增加 restart 对 `ok:false`／`cleanup.closed:false` 的失败判断；其余字节保持。
- 四个首次读取就绪运行文件 `index.js`、`author-properties-host.js`、`author-properties-apply.js`、`session.js` 保留原包字节，不重新移植后端。
- 当前共享侧栏没有携带的三个 rc.52 诊断接点在隔离模块中保留：允许列表阶段码函数、schema 诊断保存、读取失败文案阶段码。不得在以后候选中丢失。
- 额外侧栏模块和 QA 仅供隔离构建／验证；该目录不是发行白名单或可安装候选。未生成新 tgz、未改版本、未安装、未发布、未提交推送。

整合后的 client SHA256：`9D4914C6E4DA3CB7875C8F321B27613DD1D1B4C79628511CB5E47A6AFBED8F3B`；侧栏模块：`CD3FB3388DA1005F9526A16552BCCE83EA1CFBEFD8359BC0232D4F68CACDFDC3`。

## 验证及证据

证据根目录：`.tmp/rc52-gallery-author-integration-20261028-a/`。

| 检查 | 实际结果 |
| --- | --- |
| 新增选择／切换和参数 ID 单测 | 20/20，343ms；`integrated-unit-result.json`，父监督确认退出 |
| 固定 Windows rc.3 SDK／真实 client 与 Author Host 的受控场景 | 15/15，8561ms；`focused-windows-integrated-bytepreserved-run.json`、对应 report |
| 最终文件审计 | `integration-audit.json`；42原文件／14资产／四后端文件一致，侧栏生成片段匹配，24个 JS 语法通过 |
| 日常安装只读核对 | 43文件仍匹配固定 rc.52 原包；未读取或写回日常 Profile，未操作 DSH／WE |

SDK 延续上轮14个场景，新增非 Lucy 的 metadata409：首次读取显示 `[schema.metadata.409]`，不自动循环请求；一次显式重试恢复参数显示，全程无参数下发。已有 A→B 显式切换、409清理失败及 HTTP200 失败正文保留 A、单独停止 A 的覆盖继续通过。

SDK 的目录／源窗口身份／命令执行 IO 受控，没有启动 Wallpaper Engine。实际使用固定包内的后端模块和官方 Windows SDK，不将模拟源解释成真实非 Lucy 壁纸验收。记录并严格核对两项桥接基线401、restart409及 schema metadata409；不是忽略错误后宣称日志全绿。页面异常为空，浏览器退出、Host／HTTP服务／桥接关闭均确认，页面资源引用和 Object URL 清零。

## 本轮审计发现并修正

第一份隔离副本通过行为检查，但字节审计发现 Python 在 Windows 文本写入时转换了 client 无关片段的换行。未修改日常文件。已改为以原归档字节为底，只替换原生片段和一个 restart 判断，再按字节写入，最终审计确认无额外变更。

原 `focused-windows-integrated-*` 结果及 `client-before-byte-preservation.js` 保留，原因记录在 `byte-preservation-correction.json`。修正后使用独立输出标签重跑15场景，不覆盖先前证据。共享实现和上一轮五个最终源码／QA指纹未变；新增 `native-author-diagnostic-preservation-sdk.mjs` 保存本次诊断回归。

## 后续与未验收项

实现说明及前一轮红测／补修记录见[图库选择与参数 ID 报告](WALLPAPER_GALLERY_SELECTION_AND_AUTHOR_ID_20261028.md)。本轮不重复984项大回归，适用的20项及整合 SDK 已覆盖受影响路径。

下一步若用户允许，仅准备本机短验用的新候选和本轮备份／回退流程；公开 Release／npm 继续暂停。实际安装还需届时方便／无任务和正常退出确认，不能沿用历史确认。实机重点为卡片留图库、A播放时选B后显式切换与停止、非 Lucy scene／web 参数展示及条件允许时的实际下发；不以 Lucy 自动播放资格推广到其它壁纸。空声明／不支持字段／video不当作可下发参数，不承诺读取真实 WE 当前值或全部壁纸支持。
