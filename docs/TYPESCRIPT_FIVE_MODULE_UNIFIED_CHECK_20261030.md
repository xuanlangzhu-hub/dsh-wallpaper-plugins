# 首批五模块统一类型检查闭合

2026-10-30。将已接实际源码的managed-window纳入统一离线命令，修复同进程配方加载边界；本轮只改QA工具和说明，五个运行模块、生成器、生产assets和版本均未修改。

## 统一入口

```powershell
python -X utf8 dsh-whale-mist/qa/typescript-all/run.py --compiler-root .tmp/ts-compiler-1 --cache .tmp/node24-types-1 --output .tmp/type-check-all-1
```

输入仍是预先固定的TS5.9.3和真实Node24／undici缓存，输出必须全新。不联网、不安装依赖、不清理旧证据或自动重试，也不依赖历史轮次路径。

三个入口顺序执行，环境图和原始收据分别保留：

| 输出组 | 范围 | 类型负例／纯运行对照 | 阶段 |
| --- | --- | --- | --- |
| es-only | 实际frame-protocol、probe-log、scenes和真实生成的解码器单元 | 35／56 | 18 |
| node-hub | 实际FrameHub／FrameDecoder及QA消费端 | 14／17 | 8 |
| node-managed-window | 实际managed-window及QA消费端 | 16／21 | 9 |

ES-only保持57个ES2022标准库、types:[]；两个Node组各自保持59标准库＋66Node＋41undici，skipLibCheck:false，不混DOM／SDK。重叠协议依赖不重复算生产模块，生成单元不算第六个独立生产模块。

## 同名配方加载

原Hub和managed-window检查器都用裸名导入annotate.py，在runpy同进程顺序调用时可能复用错误的sys.modules缓存。本轮新增common.load_annotation_recipe：

- 入口先验证完整审定输入，再按配方完整路径创建独立模块规格、加载新模块并取可调用annotate。
- 内部身份由完整路径派生，不查询或注册裸名annotate缓存；不通过清空整个模块缓存解决问题。
- 两个Node结果分别记录配方路径和SHA，编排器按对应身份核对，不能把Hub收据当managed-window收据。

这不替换编译器、声明、注释配方内容、类型负例或运行测试逻辑。ES生成器／Node事件IO等原有边界保持。

## 验证

编排边界：`.tmp/typescript-five-module-boundaries-20261030-a/`，12项通过。保留原8项期限／退出／收据／上下文恢复检查，新增真实配方在错误裸名缓存下两种顺序加载、加载异常的上下文保持、缺少可调用导出的拒绝、managed-window专属计数及配方身份拒绝。合成收据只是验证编排控制，不替代实际类型检查。

实际完整执行：`.tmp/typescript-five-modules-20261030-a/`，约70.45秒，一次通过。

- 35个阶段全部退出0、确认退出，无超时和清理错误；三组对应上述35／56、14／17、16／21全部通过。
- 最慢ES阶段约2.87秒、Hub约4.98秒、managed-window约3.65秒；编译器输出0。
- 总160秒约束仍传递至每个实际Node子进程；每阶段20秒、各入口80／75／75秒以及超时清理最多3秒保持，没有延长期限来换通过。
- 任一组失败即停止后续组，未运行项保留not-run；通过、失败、未知退出和部分结果不能混为一谈。
- 435项输入前后指纹一致，两个Node组实际记录的是不同配方路径／SHA。运行源码、基线和既有注释配方完全保持。

Node运行测试里的进程／HTTP响应仍是底层事件IO替身，没有启动真实helper、Session、DSH或WE；不证明宿主兼容、画面／性能或原生退出。QA正例也不等于真实Session／SDK消费端已编译。

## 保护与接续

变更备份／双边差异：`.tmp/typescript-five-module-integration-20261030-a/`。原434个输入424项保持，批准变化仅10个QA工具／说明文件；新增v6清单1项，v6自身不包含于自己的434项映射，另行保护后共435项。旧v5及以前清单、历史失败输出完整保留，不覆盖历史门禁。

首批五个实际模块及生成单元现已具备同一命令下的严格类型与纯运行回归，当前这一批渐进类型工作闭合。后续按实际维护收益或新功能再扩大范围，不自动选第六模块、不整体改.ts、不自动扩大Session／SDK／Trace专项。整理提交、打包、安装或发布另按用户安排，不因类型检查通过就自动执行。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，DSHrc.5暂不更新。本轮无日常进程／窗口／Profile查询或操作，无打包安装、发布、提交推送、派发或清理。作者长时间滑动调查、进一步任务栏优化、UI大改、三体／GPU／性能仍暂缓。
