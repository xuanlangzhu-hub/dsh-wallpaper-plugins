# Node 24 独立声明缓存已锁定并验证

承接[FrameHub范围审计](TYPESCRIPT_FRAME_HUB_SCOPE_20261030.md)，本轮只准备离线QA声明环境，不补FrameHub类型、不执行应用模块。未运行npm install／包hooks，不创建node_modules，不修改项目／全局依赖或日常环境。

## 精确来源与依赖闭包

| 包 | 固定版本 | 实际依赖 | 归档SHA256 |
|---|---|---|---|
| @types/node | 24.10.0 | undici-types ~7.16.0 | `1852009E5B2E5D687A6239B8D4A1800A1EF97CFA274637DD2A716F1ED11A3595` |
| undici-types | 7.16.0 | 无 | `53B5E2FA12A4118A4838E80B1CC6E1D8CD30D6F7E5BEA69640E5386F6EB3F8AF` |

精确元数据来自官方registry：[Node声明](https://registry.npmjs.org/@types%2fnode/24.10.0)、[传递依赖](https://registry.npmjs.org/undici-types/7.16.0)。网页工具未能打开这些API，改由限时HTTPS请求直接读取并保留原始响应，不据搜索摘要猜版本。Node 24.10.0是固定QA类型基线，不追latest，不表示运行时版本24.10.0；undici取其实际tilde范围的固定下界版本。两包许可证均MIT，包内身份／版本／许可证／依赖与元数据一致，无未锁定optional／peer依赖。

`qa/typescript-node-environment/lock.json`锁定精确metadata／tarball、SRI、SHA1、依赖、条目和解压大小，SHA256 `5BC90B0917974BF2FF2841DBCDAC0D554414A1F1567FC4BEE379A8EEE148F89D`。完整元数据另存哈希；未来校验核心字段，不让无关维护字段变化自动更新版本或依赖。

发现记录 `.tmp/typescript-node-metadata-20261030-a/`；通过的完整缓存 `.tmp/typescript-node-cache-20261030-b/`。

## 下载与完整性

父监督45秒／worker预算40秒，单请求8秒、URL固定且拒绝重定向；有响应与解压上限。SRI／SHA1通过后才解析归档，拒绝越界路径、链接、特殊成员、重复大小写文件名及声明／文档之外的文件。所有内容只落到缓存types/node与types/undici-types，不执行载荷。

- Node归档88项＝75文件＋13目录，解压2,518,290字节。
- undici归档45项＝45文件，解压110,131字节。
- 共120实际文件完整留SHA256；检查器从锁定SRI归档重建文件哈希，与receipt及真实文件集合交叉核对，不能只相信receipt自报通过。连同元数据／归档／状态等126个文件在检查前后核指纹。
- b轮worker退出0、确认退出、无超时／清理错误，准备工具输入保持。

a轮因将上游fileCount当成纯文件数而拒绝Node归档。SRI／SHA1／解压大小已正确，核原始tar得知88包含13目录；修为校验总条目数、分别记录75个文件和13目录，另起b轮。未跳过计数或覆盖失败轮，a保留归档／成员清单／失败回执。

## 真实声明闭包验证

最终 `.tmp/typescript-node-environment-20261030-a/`。TS5.9.3编译器仍独立按锁定SRI归档和全部成员验证；只编译QA消费者，不执行它们或FrameHub／Session／Trace／旧transport测试。

- 正例覆盖真实EventEmitter事件、Buffer、全局Buffer／performance和HTTP ServerResponse的方法及write布尔返回，零错误。
- 将Buffer错误赋为string的负例，在指定消费者文件以单个2322拒绝。
- strict／noEmit、skipLibCheck:false；实际声明图为59个TS标准库、66个Node声明、41个undici声明，无lib.dom／webworker／SDK或伪声明。Node包额外引用的标准库属于这个独立环境，不改旧ES-only的57库检查。
- 使用明确types:['node']／缓存typeRoots和undici真实包路径；逐文件限制程序图，只能来自固定编译器、本缓存与本轮消费者。类型包可有传递依赖，不能只限制types名称就认为图已封闭。[TS types配置](https://www.typescriptlang.org/tsconfig/types.html)
- 保持声明检查开启，没有用skipLibCheck掩盖上游不兼容；实际检查兼容TS5.9.3。[TS skipLibCheck说明](https://www.typescriptlang.org/tsconfig/skipLibCheck.html)
- 一阶段退出0、确认退出无超时，编译器输出0，无声明／map／tsbuildinfo。

另 `.tmp/typescript-node-cache-boundaries-20261030-a/` 的合成归档仅用于解析器测试，不参加Node类型编译：1合法夹具通过，7项错误SRI／越界／链接／重复大小写／运行JS／隐藏依赖／错误条目数均在对应预期门禁拒绝。

## 使用与下一步

工具5文件：lock.json、prepare.py、check.py、smoke.mjs、README.md。缓存准备／验证命令在工具README，不依赖npm登录或历史候选包；输出必须全新，不清理旧轮或自动重试。

下一步只读使用这份真实声明环境重新扫描实际共享FrameHub及FrameDecoder，核完整图和每条诊断，再确定隔离JSDoc范围；**本轮尚未重测FrameHub，不能推算原23条已消除多少。** 不运行Hub或transport，不改Trace／Session或发行包。QA Node24目标与宿主Node／Electron版本继续分开，宿主版本未知不触发日常查询或兼容性承诺。

原400项保护输入全部保持，新增5QA形成405项接续清单，见最终验证目录protected-after.json／baseline-transition.json。旧ES-only三模块／生成段配置及35负例／56回归保持，以指纹承接，未机械重跑。日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，无日常进程／窗口／Profile查询、安装打包、发布／推送／派发／清理；作者调查、进一步任务栏优化、UI大改、三体／GPU／性能暂缓。
