# 独立 Node 24 声明缓存

这只是QA使用的真实上游声明与完整依赖闭包，不安装运行依赖、不执行包脚本、不改变日常环境。目标为已确认QA Node 24；不等于确认宿主Node／Electron版本。

lock.json固定@types/node 24.10.0与其实际依赖undici-types 7.16.0，不追latest，也不把Node声明版本当运行时版本。固定官方npm registry的精确版本元数据、tarball、SRI、SHA1、依赖与大小。完整元数据保留并记哈希，验证身份／依赖／dist等核心字段；发现时的metadata哈希保留为来源证据，不要求未来无关维护字段永远不变。

从仓库根运行，缓存和检查输出都必须为全新.tmp目录：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-node-environment/prepare.py --output .tmp/node24-types-1
python -X utf8 dsh-whale-mist/qa/typescript-node-environment/check.py --cache .tmp/node24-types-1 --compiler-root .tmp/ts-compiler-1 --protected-manifest .tmp/typescript-frame-hub-scope-20261030-a/protected-after.json --output .tmp/node24-types-check-1
```

显式的400项保护清单参数是本轮接续例子，不自动搜“最新”。编译器需先用原固定工具准备TS5.9.3，检查时重新核SRI归档及全部成员。

下载前有45秒父监督／40秒worker总预算，单请求8秒、大小上限固定，只访问锁定URL且拒绝重定向。归档通过SRI／SHA1后才解析；拒绝绝对路径、越界、反斜杠／冒号、链接／特殊成员、重复文件和不在声明／文档白名单中的文件，限制条目／解压大小。Node归档元数据的fileCount包含目录：88项＝75文件＋13目录；工具分别保留条目数、目录数与实际文件数，不拿目录充当文件指纹。失败留档、非零，不自动重试或清理旧轮。

落盘只到缓存types/node和types/undici-types，不创建node_modules。check.py从固定SRI归档重新导出完整文件哈希，核receipt及实际文件集合前后不变，不能只相信本地receipt自报通过。

smoke.mjs用真实Node事件、Buffer、performance及HTTP ServerResponse声明编译QA正例，并用错误Buffer赋值验证2322拒绝。skipLibCheck保持false；程序图只能出现本轮消费者、固定编译器标准库及两真实声明包。Node环境单独types:['node']，undici显式映射到缓存真实包，拒绝lib.dom／webworker／SDK或伪声明。只做类型检查，不执行消费者、FrameHub、Session、Trace、原测试或真实服务。

原ES-only三模块／生成段检查保持独立。本阶段完成后，再只读重测真实声明下的FrameHub基线，不能沿用缺Node环境时的23条诊断直接补源码。
