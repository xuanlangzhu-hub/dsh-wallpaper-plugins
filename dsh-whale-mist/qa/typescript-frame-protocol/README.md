# 首项渐进类型检查：WHL1 FrameDecoder

检查实际开发源 `../../src/wallpaper/frame-protocol.js`。使用严格 JSDoc／checkJs，不改变ESM `.js`入口、运行语句、现有client或原生assets。只有此模块和一个实际类型消费者，以及编译器ES2022标准库；不引入DOM、Node、React、DSH SDK或共享Trace FrameHub。

编译器固定TypeScript5.9.3，来源／SRI见 `compiler-lock.json`。编译器只放仓库 `.tmp`，不安装全局依赖或改正式包依赖，不运行npm／生命周期钩子。

从仓库根在Windows终端执行（需已有Python与Node）：

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-frame-protocol/prepare-compiler.py --output .tmp/dev-tools/typescript-5.9.3
python -X utf8 dsh-whale-mist/qa/typescript-frame-protocol/run.py --compiler-root .tmp/dev-tools/typescript-5.9.3 --output .tmp/frame-types-check-1
```

两个输出目录都必须尚不存在；编译器目录已准备好时跳过第一条，不覆盖旧证据。下载由保留句柄的父进程45秒监督；检查各阶段20秒、总65秒，超时只结束自身helper。证据、标准输出／错误均保留，不自动重试。

若只执行正例检查（不跑运行协议／负例）：

```powershell
node .tmp/dev-tools/typescript-5.9.3/package/lib/tsc.js --project dsh-whale-mist/qa/typescript-frame-protocol/tsconfig.json --noEmit --pretty false
```

`run.py`会先核对编译器归档SRI、归档成员与已解压文件，再检查：原固定rc.57源码确有2处隐式any；类型化实际模块正例通过；7项独立错误消费在预期文件／错误码上被拒绝。没有手写同名声明或宽泛any／ts-ignore绕过。

12项纯Node协议回归比较原版和类型化版：所有拆点、多帧、magic、长度／尺寸／时钟边界、截断、非法输入、超大输入、offset view／SharedArrayBuffer、回调错误传播。不会运行历史transport测试中的C#程序或启动应用。

校验运行token与原版、现有client两个协议区块完全相同。实际生成器仅在本轮隔离目录运行，确认重复生成幂等、协议标记外内容不变，生成后的第三个协议区块也做token核对；不覆盖共享client。类型检查noEmit、无声明／JS／map／tsbuildinfo输出，隔离生成器的client写入单独记录。需要重新生成正式client或发包时另按届时固定载荷整合，不能从含Trace共享树直接打包。

这一步提供开发期错误检查，不代表全仓已迁移TS，不承诺播放性能提升。真实长时故障与日常rc.57不属于本检查操作范围。
