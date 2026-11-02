# 下一项类型范围：managed-window 只读基线

2026-10-30。用户决定暂不更新 DSH，继续原类型开发。本轮只读筛选候选、检查真实声明图与类型基线，没有补注释、执行应用模块或测试。此前单命令开发检查结果继续保留，未机械重跑未改用例。

## 选择依据

| 候选 | 实际范围 | 本轮决定 |
| --- | --- | --- |
| managed-window.js | 122行、无静态imports；路径／标识校验、窗口记录归一化、注入的helper调用和轮询 | 选作下一项，先明确纯校验与异步适配器边界 |
| author-properties-contract.js | 88行，但依赖1428行detachable-contract及managed-window；草稿状态、请求票据和作者值规则 | 后移，不能因文件短而忽略依赖闭包 |
| close-fence.js | 142行，node:crypto、异步关闭／准入状态机及有界请求体读取 | 后移，不借类型接入扩围到关闭恢复专项 |

没有静态imports不代表整个managed-window是纯逻辑。它的runHelper会调用传入spawn、设置定时器，waitForWindow会调用传入helper与sleep；本轮均未执行。

实际源码SHA256为 `6CCCBE58DE3F890F374C896B4EB2B253B916711FA9EE620C8728600BE04EBA86`。逐字节等同固定rc.53文件，并与rc.57固定包清单记录一致。本轮没有把QA原型副本当成生产唯一来源。

真实消费边：Session直接导入runHelper／waitForWindow／validateLocation／newLocation，作者契约直接导入validateLocation。只读解析了消费端文本，没有将Session或作者契约纳入编译或执行。

## 真实类型基线

工具：`dsh-whale-mist/qa/typescript-managed-window-scope/audit.py`、`audit.mjs`。

证据：`.tmp/typescript-managed-window-scope-20261030-a/`。

- 固定TS5.9.3和经SRI归档、完整文件集合重验的真实Node24／undici缓存，126个缓存文件前后核验。
- 编译图仅1个实际managed-window.js，加59个TS标准库、66个Node、41个undici声明；无DOM／SDK／伪造声明。strict／checkJs／noEmit、skipLibCheck:false。
- 21条诊断全部位于实际源：7006共18条，18048共3条。没有上游声明诊断。三条18048都来自for-of字符的codePointAt(0)结果可能undefined；这是类型证明缺口，不据此称运行中能产生空字符或出现新故障。
- 现有validateLocation／validateProjectFile入口仍是any；validateSize的输入、fallback及返回都是any。runHelper推导Promise<any>，waitForWindow和normalizeWindow返回记录中的hwnd／title／visible／left／top也带any。具体签名及行列已保存，不能靠只消掉参数诊断就宣称边界已准确。
- 1阶段约1.39秒，退出0且确认退出，无超时或清理错误；阶段15秒／总30秒监督，编译器输出0。

这里的“通过”是审计成功保留基线，不是源码已零错误、类型补修已完成或旧21条已消除。没有执行managed-window、helper、轮询、Session、DSH或WE。

## 测试来源必须分清

只读解析的测试包括：

- `qa/wallpaper/type-normalization.test.mjs` 有9个test声明，确实直接导入实际validateProjectFile，但也导入catalog／library／Session，并建立合成文件；不能把整文件当本模块纯回归执行。
- `qa/wallpaper-preview/tests/lifecycle.test.mjs` 有19个test声明，使用历史原型层；不可直接声称覆盖当前实际managed-window。
- `qa/wallpaper-preview/tests/managed-session.e2e.mjs` 是实机脚本，会调用真实helper／WE窗口；本轮只读，不运行。没有test声明不代表它没有顶层执行动作。
- `qa/wallpaper/close-fence.test.mjs` 有35个test声明，含Session／HTTP服务／临时Profile，属于另一边界，不拿来补本模块测试数量。

这些只是AST声明计数，不是通过数量。本轮运行测试数为0。

## 下一小步：隔离注释与直接消费验证

在新输出目录复制本模块，先隔离补JSDoc，不修改实际开发源或旧检查入口。范围覆盖原有导出，不拆运行文件、不改导出／调用顺序，也不调整超时、轮询次数或退出确认语义：

1. 校验入口用unknown，保留字符串trim、Windows盘符／UNC、json／mp4扩展与原拒绝规则。validateSize保留fallback原值，不能无依据收窄成固定number；newLocation保留原时间／随机输入及默认行为。
2. normalizeWindow对unknown输入保留原运行验证；原逻辑未保证title／visible／left／top的具体类型，不能擅自标成string／boolean／number。pid只作typeof number判断，不能在类型改动里新增有限数验证。对Number.isInteger或for-of的局部证明，仅允许有明确依据的窄视图，并由AST／边界对照证明没有改逻辑。
3. spawn／进程／流方法使用真实Node声明的最小接口；JSON.parse输出保持unknown，不把原始JSON直接伪装成已验证窗口数组。waitForWindow对注入回调的数组／记录前提须单列契约，明确它不等于底层runHelper已经完成该验证，也不代表Session消费端已编译。
4. 增加真正导入候选的正例和具体错误码负例，至少拒绝错误helper／sleep回调、错误参数列表、误用unknown记录字段、忽略可空窗口以及不合法输出假设。不用any、ignore、假声明压平问题。
5. 同轮保留原字节与候选，以纯调用／底层事件IO替身对照位置和路径边界、fallback、别名／空值、歧义／迟到窗口、helper成功／非法JSON／非零退出／error／超时／迟到close的原有结果。只有本轮拥有的合成进程与定时器可用，不启动真实helper或窗口。
6. 补运行AST／可选链与少量关键逻辑变异门禁。类型验证分小批、每阶段20秒／总预算受监督，异步用例须有独立短期限，不照搬实机等待时间；失败留档，不延长成无限脚本。

通过隔离验证后，才把审定注释接实际源，再讨论接入Node检查图。当前不改原ES-only／Node Hub图，不把本模块加入统一命令，也不将阶段审计算成第五个已补模块。

## 保护与日常边界

原421项输入保持，仅新增2个只读审计工具，423项接续清单在本轮protected-after.json；额外受审源码与测试指纹在result.json。旧门禁、失败输出与声明缓存保持，未重跑此前26阶段。

日常DSH0.2.1-rc.3／Whale rc.57／Git Bash0.1.2、公开rc.53保持，暂不升级rc.5。本轮没有日常进程／窗口／Profile查询或操作、打包安装／发布、提交推送、派发或清理。作者长期滑动调查、进一步任务栏优化、UI大改、三体／GPU／性能仍暂缓。
