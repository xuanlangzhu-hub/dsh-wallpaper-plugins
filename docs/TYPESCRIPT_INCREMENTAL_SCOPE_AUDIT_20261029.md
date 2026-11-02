# 渐进类型约束：首项范围审计（2026-10-29）

后续更新：[10月30日首项checkJs实现](TYPESCRIPT_FRAME_PROTOCOL_CHECKJS_20261030.md)已完成，日常为rc.57。以下是准备阶段快照，原“尚未实现／未固定编译器”不再代表当前进度；生成边界和Trace排除约定继续有效。

接续更新：[本机日常已切到rc.56](RC56_DAILY_TRIAL_20261029.md)，运行文件和本审计所用固定rc.56相同。以下“当前仍rc.53”为审计时状态；首项选择与生成边界不变，类型检查和实现尚未开始。

用户决定暂不继续任务栏优化，接受先保留有效优化、再接渐进TS。本轮完成只读清单，选定首项；**没有运行类型检查、安装编译器或修改运行源码**。当前日常仍rc.53，rc.56日常切换独立准备。

## 基线与首项

固定未来基线为已验rc.56的23JS，来自已验rc.53成果，避免把共享rc.30／Trace树整体提升。三份候选模块逐字节比较均与固定rc.56相同：

| 模块 | 大小／依赖 | 本轮选择 |
| --- | --- | --- |
| `src/wallpaper/frame-protocol.js` | 32行，0 imports；导出HEADER_BYTES、MAX_FRAME_BYTES、FrameDecoder | **首项**：范围小、无IO／宿主依赖 |
| `src/wallpaper/author-properties-contract.js` | 88行，依赖detachable-contract与managed-window，含作者值／草稿状态约束 | 后续，避免首项牵出跨模块状态类型 |
| `src/wallpaper/media-bridge-permissions.js` | 45行，依赖node:child_process，包含Windows只读ACL／reparse检查 | 暂不作为首项，避免牵入OS命令替身及Node类型 |

FrameDecoder SHA256：`074AB958CFA6E9D0050067BA8AD5B280605671D9630615194ACB282DCD79DED9`。入口维持ESM `.js`，宿主与包仍消费JS，不新增运行构建器、修改exports或把全部文件改成.ts。

## 已核对的生成边界

- Host通过`frame-hub.js`导入FrameDecoder。共享FrameHub含未发行Trace，与固定rc.56不同；首项类型检查不把它拉入范围。
- `scripts/build-wm-protocol.mjs`将该单一协议源去export、重命名为WM_FRAME_DECODER后写入client的两个marker之间。当前共享client和固定rc.56的协议区块都与此源一致。
- QA下`wallpaper-preview/`还有历史原型副本，不是当前生产唯一来源，不能顺手迁移所有同名文件。
- 该生成器会写共享client，本轮没有运行它。后续先在隔离副本验证注释／类型标注的影响；不覆盖固定client或混入Trace，不在类型检查步骤重生成UI。

## 第一小步建议：JSDoc＋checkJs，noEmit

先为Frame／回调和push输入加JSDoc类型，配单模块范围的严格检查：allowJs、checkJs、noEmit、incremental:false、types:[]，使用ES2022标准库。只包含该模块与隔离类型消费夹具，不带React、DOM、Node或宿主SDK类型。

这是TypeScript官方支持的JS渐进路径：[checkJs](https://www.typescriptlang.org/tsconfig/checkJs.html)用于报告纳入范围的JS错误，[JSDoc类型标注](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)表达参数／对象／回调约束；[noEmit](https://www.typescriptlang.org/tsconfig/noEmit.html)禁止输出JS、声明和source map。先做开发校验与维护收益，不承诺画面或执行速度提高。

当前PATH没有发现tsc，项目本地`node_modules/typescript/package.json`也不存在；没有由此推断其它工具环境绝不存在编译器。下一步需选择并固定独立开发编译器版本和来源／完整性，避免临时npx latest、全局安装或升级正式包依赖。尚未选定版本，不能称已完成TS接入或已经零错误。

## 后续实现的验收契约

1. 固定32行基线，在隔离副本新增必要JSDoc；运行语句／导出／报错文本／解析边界保持，任何实际逻辑问题单列处理，不顺手修功能。
2. 真正检查这个模块及类型消费者，正例涵盖Uint8Array／帧回调；负例应拒绝字符串输入、错误回调入参和帧字段类型等契约错误。不能仅写一套脱离真实实现的声明自测。
3. 保持运行时对非法输入的既有拒绝，类型系统不代替字节流验证；回归拆块、多帧、损坏magic、越界和截断等现有协议案例。纯Node夹具即可，不启动DSH／WE或窗口。
4. 类型检查不输出任何运行产物，且不写assets／client／版本／已发布包；确认被检查文件集合受控，不能用全仓exclude或宽泛any压制失败。
5. 日常安装独立闭合。首项只有类型约束，无需重做任务栏视觉测试、原生DLL构建或全套性能采样；确有运行行为变化才重新定范围。

## 本轮证据

只读工具：[audit.py](../dsh-whale-mist/qa/typescript-scope-audit/audit.py)，输出 `.tmp/typescript-scope-audit-20261029-a/scope-audit.json`。记录三模块／生成器／共享与固定client／FrameHub指纹、消费者及工具可用性；361保护输入和源码保持，无编译器、生成器、应用或类型测试执行。

本报告是首项可执行范围与后续验收标准，尚非TS实现交付。任务栏进一步研究、UI改版、三体、公开发布和工作区清理仍暂停／不在此项范围。
