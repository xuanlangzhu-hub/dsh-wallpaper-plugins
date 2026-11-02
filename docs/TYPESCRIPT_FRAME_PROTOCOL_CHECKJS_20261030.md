# D2 首项完成：FrameDecoder 的渐进类型检查

用户决定作者参数问题先到这里、继续后续开发，本轮恢复[此前D2范围](TYPESCRIPT_INCREMENTAL_SCOPE_AUDIT_20261029.md)。**首个实际开发模块已接入严格类型检查，仍保持ESM `.js`入口。** 本轮未操作／查询日常DSH、WE或Profile，未安装候选、发包、推送或清理。日常仍沿用已确认的rc.57，长时滑块根因未定，不在本轮继续调查。

## 实际改动

仅修改运行源码 `dsh-whale-mist/src/wallpaper/frame-protocol.js`：增加WHL1帧结构与构造回调／push输入的JSDoc，32行变45行。所有运行token与固定rc.57原版一致，导出、语句、错误文本和运行验证边界均保持；不是改成`.ts`或重写解析器。

| 输入 | SHA256 |
|---|---|
| 固定rc.57原协议模块 | `074AB958CFA6E9D0050067BA8AD5B280605671D9630615194ACB282DCD79DED9` |
| 类型化实际开发源 | `3FDDACB47E248CAD62AECFC822C2FF1DF1B7C1C4C5C605ABD733822C5CE2D5C7` |

新增开发检查目录 `dsh-whale-mist/qa/typescript-frame-protocol/`，包含8个锁定编译器／配置／类型消费者／检查／说明文件。正式package.json、版本、依赖、入口、现有client、生成器和全部原生assets未改，不整体提升共享Trace树。

配置为allowJs、checkJs、strict、noEmit、incremental:false、types:[]、ES2022／NodeNext。实际正例只纳入这个JS模块及一个从真实实现导入的TS消费者，另有57个编译器ES2022标准库文件；没有DOM、Node、React或DSH SDK类型，没有手写同名声明、any兜底或ts-ignore。`checkJs`会检查纳入的JS，`noEmit`不输出编译文件，分别见[官方checkJs说明](https://www.typescriptlang.org/tsconfig/checkJs.html)和[noEmit说明](https://www.typescriptlang.org/tsconfig/noEmit.html)。

## 独立编译器

TypeScript固定5.9.3，元数据来源 `https://registry.npmjs.org/typescript/5.9.3`，归档URL／SRI见 `compiler-lock.json`。归档SHA256为 `10E108C9CF7D5F2879053DFF18515FB405ABF2CCEF63EAAF017D9C571687A1D3`。

最终使用 `.tmp/typescript-compiler-5.9.3-supervised-20261030-a`。没有运行npm、生命周期钩子、全局安装或改项目正式依赖。下载由保留worker句柄的父进程45秒监督，单连接12秒超时；失败留档，不自动重试。类型检查前再次将固定SRI归档、归档成员清单、已解压文件逐个绑定验证，不能仅相信自报的本地manifest。原始准备目录也保留，两份下载归档哈希相同。

这是开发工具版本固定，不表示选择了目前最新版本，也不宣称引入TS能提高播放性能。

## 真正的类型与协议验证

最终证据 `.tmp/typescript-frame-protocol-20261030-f/`：

- 未标注基线在严格检查下确有2处隐式any（构造回调与push输入）；标注后的**真实开发源**和正例消费零错误。正例包括帧字段／回调、Uint8Array、SharedArrayBuffer与void返回。
- 7个独立负例均在预期文件、预期错误码上拒绝：字符串chunk、错误回调参数、未知帧字段、width当字符串、缺构造回调、JPEG字节赋字符串、sequence赋字符串。不是仅用声明文件自测。
- 12项纯Node运行回归对照原版／类型化版：每个拆点和多帧、magic及长度／尺寸／时间边界、截断、非法输入和超大输入、offset view／SharedArrayBuffer、回调错误传播。运行期拒绝没有被类型检查替代。
- CLI实际执行noEmit并核对文件清单与输出目录；编译器写入0，无新增JS、声明、map或tsbuildinfo。检查本身不写开发源码。

检查执行各阶段20秒、总预算65秒，Node测试单进程、单项3秒截止。最终6阶段全部退出0、确认退出且无超时。编译器下载和检查均有明确退出围栏，不是一直等待的后台任务。

## 生成边界与保留证据

现有共享client及固定rc.57 client的协议块，去掉注释／空白后的运行token都与原版一致。实际 `build-wm-protocol.mjs` 仅复制到隔离目录执行：只替换协议标记内的注释／格式，标记外内容不变，二次执行幂等，生成client的语法通过，第三个协议块token也一致。**没有运行会覆盖共享client的原位置生成器。** 隔离生成器写client与类型编译器noEmit是两个单独步骤，不混称“完全没有生成文件”。

过程a先验证隔离注释；b–d接入实际源、强化编译器归档绑定和下载父监督；e的功能检查通过后，最后不可变输入审计误把主动生成的隔离client列为“必须不变”而失败。仅将该生成产物从原始输入清单分开，保留其标记外内容／token／幂等验证；f全部通过。a–f均保留，未改运行逻辑来绕过检查。

历史361保护输入中，360保持；唯一有意变化是本模块的上述JSDoc。旧保护快照不覆盖，新的 `protected-after.json` 对这1处更新指纹并加入8个新QA文件，形成369项开发接续基线。批准差异记录在 `approved-source-change.json`。未来准备包／实机工具须显式采用经审的新基线，不能为了跑过旧脚本删掉保护检查或重用旧授权。

## 使用与后续

可执行命令见[检查目录说明](../dsh-whale-mist/qa/typescript-frame-protocol/README.md)。编译器目录和输出目录都可显式指定，输出必须全新，避免覆盖历史证据。

本次只是首个模块的渐进接入，不代表全仓迁移完成。无需为注释／noEmit类型检查再做DSH安装或性能采样。下一小步先只读选择第二个小型契约或真实消费者，核对固定rc.57与共享Trace差异，再决定类型范围；不自动将FrameHub、Node类型或宿主SDK拉进来。作者长时调查、进一步任务栏优化、UI大改和三体继续按原决定暂缓，公开发布／推送／清理不在本轮。
