# 实际生成的解码器已纳入统一检查

承接[消费端／构建范围](TYPESCRIPT_CONSUMER_BUILD_SCOPE_20261030.md)，本轮仅扩展离线QA，不修改运行源码、开发client、生成脚本、manifest或assets。检查对象仍是三个生产模块，另加一个真实生成的WHL1代码单元；没有将生成段算作第四个生产模块。

## 来源与检查方式

统一入口命令保持：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-check/run.py --compiler-root .tmp/ts-compiler-1 --output .tmp/ts-check-1
```

真实生成器只对本轮复制的client执行两次，核验幂等和协议块外字节保持。随后按唯一marker提取该副本的解码器原字节，只追加QA export别名；不重写类或补.d.ts。新增verify-generated.mjs核对来源文件哈希、偏移、片段哈希、包装哈希及原字节相等，再验证类型和运行token。

最终 `.tmp/typescript-generated-decoder-20261030-a/` 的来源记录：

| 项目 | 数值／SHA256 |
|---|---|
| 生成client | `857099305D15BE5A337CBCB90B90B8CA24380927A0DD08BB6B54E95619B15E9D` |
| 片段字节范围（含起点、不含终点） | 27686–30093 |
| 真实解码器片段 | `DC834DDEC161C4BDFA575E0E9A40924F03C48E2CA9341AB906022F29286945FE` |
| 追加export后的QA模块 | `51A05C757789A4CD6BD75AC780D91B7947329F177F37340191BD36B63DE34F9C` |

完整生成副本、提取模块、消费者、负例及inputs.json均留存。生成段的运行token同时对照实际协议源与固定未标注基线；完整client只做语法检查，不执行。

## 验证结果

- 原三模块联合strict／checkJs／noEmit仍零错，原28负例／44纯回归保持通过。
- 生成段与真正导入它的消费者单独noEmit零错，程序只有这两文件及57个ES2022库，共59文件。无Node／DOM／宿主SDK或假声明。
- 原协议7负例完整重绑生成段，错误chunk、回调、字段、宽度类型、缺构造参数、JPEG元素及sequence赋值均在各自文件按指定单个错误码拒绝。
- 原协议运行文件重绑固定基线／真实生成段，共12项通过，覆盖分帧／边界／截断／异常输入／共享缓冲区和回调异常；未运行宿主或浏览器paint／accept。
- 合计4个QA正例消费、35负例、56纯运行用例通过。18阶段全部退出0、确认退出，无超时或清理错误；阶段最多20秒／运行预算80秒，Node单进程／单项3秒。
- 编译器仍固定TS5.9.3，归档SRI／SHA1及解压文件前后核验；编译器输出0，无声明／map／tsbuildinfo。提取decoder.js和生成client是明确QA产物，不是编译器emit。

另在 `.tmp/typescript-generated-decoder-provenance-20261030-a/` 构造3份不一致输入：错误片段偏移、错误来源client哈希、伪装成更新哈希的额外包装代码。全部在各自预期来源门禁行触发AssertionError、退出1且确认退出，无超时。原通过轮不改；这些是预期拒绝，不是主检查失败，也不混入35项类型负例计数。

## 变更与接续

变更前396项已核并备份，记录在 `.tmp/typescript-generated-decoder-preflight-20261030-a/`。旧输入394项保持；只有统一run.py及其README改变，新增生成段验证器和protected-baseline-v3.json两个文件。v3明确固定397项（含新验证器），自身由工具指纹保护；旧379／393项manifest及全部旧证据保留不覆盖。

最终398项接续清单及批准差异在通过轮 `protected-after.json`／`baseline-transition.json`。公共执行器及原自检源码未变，以指纹核对承接，不为此机械重跑自检。日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，无日常进程／窗口／Profile查询、依赖安装、打包安装、发布／推送／派发／清理。

首批类型检查与生成接缝现已闭合。下一项仅只读界定FrameHub这一真实消费者的Node事件／Buffer与共享Trace接口差异，先明确真实类型来源及可隔离范围；不运行或修改FrameHub，不装Node类型、不写声明替身，不自动扩入Session／SDK。作者调查、进一步任务栏优化、UI大改、三体／GPU／性能仍暂缓；本轮不宣称运行性能改善或全client类型覆盖。
