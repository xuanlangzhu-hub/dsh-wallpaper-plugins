# rc.51 作者首次读取就绪补修：二次独立复审

2026-10-27。结论：**部分通过，保留本轮正向成果；只剩响应前完整身份绑定与四处QA等待截止需补，暂不提升或构建候选。**

本次审查 Gemini 的 `RC51_AUTHOR_READ_READINESS_REPAIR_SECOND_DELIVERY_20261027.md` 与 `.tmp/rc51-gemini-readiness-repair-20261027-b/`。已核实原 Antigravity「Scroll A Investigation Q1-Q3 Repairs」交付结束，保持 Gemini 3.8 Flash Medium／Turbo。Codex不修改其实现。

## 已接受的补修与独立证据

冻结、复制至全新排他目录 `.tmp/rc51-readiness-repair-second-review-20261027-a/` 后独立执行，源码／QA／监督器按原字节复跑；所有命令另有外层监督，stdin关闭、日志排他写入、子进程退出已确认。

| 检查 | 本轮结果 | 精确范围 |
|---|---|---|
| normal/run-normal.cjs | 外监督1094ms退出0；原监督981ms，8/8 | 首帧先到旧adapter红例、修复同一次GET绿例、先就绪对照、100ms无帧、预算、取消、双在途ABA、真实POST |
| fault/run-fault.cjs | 外监督1065ms退出0；原监督945ms，子退出1，7/8 | helper关闭IO真实返回closed:false，实际stop/isClosed验收失败；Case1自然失败，统计一致，非后置改报告 |
| verify-counterexamples.mjs | 554ms退出0 | ready事件前四字段漂移拒绝；实际Host保持targetActive=false；session_changed拒绝被消费；direct adapter.dispose立即解绑并拒绝 |
| Codex response-gap.mjs | 386ms退出0 | 一个正常对照及五个响应边界反例观察成立，**不是修复通过** |
| verify.py | 246ms退出0 | 39项交付冻结、281项共享保护输入、43项固定包文件及固定tgz保持 |

正常组实际仍为schema GET一次、零作者POST、6字段ready；预算组metadata先消耗120ms，沿用单一300ms总预算，504且监听释放。Case8确实发出合法POST `/api/author-properties/draft`、返回200／mutation:set，waitForReady与native command均0。index测试使用实际导出的读目标／生命周期函数；旧adapter来自固定rc.51原件。以上补修通过，不再重做前轮已通过的引擎／SDK诊断。

运行改动与固定包比较仍严格仅四文件：`src/index.js`、`src/wallpaper/session.js`、`src/wallpaper/author-properties-apply.js`、`src/wallpaper/author-properties-host.js`。client／包清单／其余运行文件保持。

## R1：等待成功后，身份未绑定到实际响应边界

位置（相对本轮b隔离目录）：

- `src/wallpaper/author-properties-apply.js:112` 冻结了完整身份和session；事件回调150–159行按该绑定验收后resolve，**这部分现在正确**。
- `src/wallpaper/author-properties-host.js:82–96` await成功后只做ticket检查和`canApply(id,generation)`；后者只验证当前目标合法且ID／代次相符，没有验证当前目标仍等于刚才的绑定。传出的targetActive变成布尔快照。
- `src/wallpaper/author-properties-host.js:122` 再次await后到state／send前，仅校验ticket，完整目标及具体session绑定未贯穿到这里。

独立复现：真实Host＋真实ApplyAdapter发一次HTTP GET；保持owner／scene／generation／location／ticket不变，注册真实等待。先让captureStarted=true并触发回调，此时真实waitForReady已按**旧合法身份**返回ok:true；在同一个事件循环轮次、Host的await续体运行前，分别将HWND、PID、startUtc、helper换成另一个合法值，或替换具体session对象。**五项最终全部HTTP200、application.targetActive=true。** 无漂移对照正常通过，监听0／native command0。未改写等待结果，也没有手填canApply=true。证据：`response-gap.mjs`、`response-gap.json`、`responseGap-result.json`。

这是受控目标IO的响应边界负例，验证任务要求的独立身份绑定；不声称正常生产换代不会改变generation，也不声称现场发生过错误写入或该竞态是唯一根因。原生apply的独立身份／写入校验未被本反例绕过。

**最小补修验收：** 将请求绑定的完整身份及具体session以适配器私有凭据或等价合同保留，成功后直到最终GET响应前，仍与同一绑定比较；不能仅复验“另一个合法目标”或复用跨请求ready布尔值。确保每个await之后、最终state/send同步构造前检查该凭据、ticket、disposed／busy／signal；保留原canApply和所有原生写门禁。失配返回拒绝或targetActive=false均可，但不能启用编辑。不要扩大schema包络、改变客户端或POST语义。把上面五个反例断言反向为拒绝，并保留同身份绿例、单GET／零写和原有生命周期负例。

## R2：四处注册等待只有单次sleep有界，整个阶段仍无截止

`test-readiness-repair.mjs:984、1022、1135、1151` 均为：

```js
while (session.stats().captureReadyListeners === 0) {
  await bounded(new Promise(r => setTimeout(r, 10)), 'wait for listener registration');
}
```

bounded只约束必定很快完成的一次sleep；如果监听永不注册，整个while仍持续，直到父监督25s强制结束。父总截止存在，不是无限无监督，但不满足本任务要求的独立阶段截止和自然清理；本轮正常组通过不能证明失败分支会自行收尾。

**最小补修验收：** 四处改成整个等待阶段受单一deadline约束，优先订阅完成信号；或显式总elapsed上限并抛出具体阶段错误。补一个“永不注册”受控负例，证明阶段按小预算失败、finally正常回收服务／Host／session、不依赖父强杀，结构化报告非零且保留。仅补这些QA与R1反例，别重开旧SDK或整套诊断。原正常／实际清理故障证据保留不覆盖。

## 证据边界与交付安排

本轮是实际session／Host／adapter／index接线、真实固定客户端引擎与原版effect函数体的离线检查；React为自写hook执行器，帧经FrameHub后由测试交给acceptFrame，解码／canvas与native helper／process IO仍为替身，鉴权上下文受控。不是实际桌面／GPU／完整HTTP帧流或唯一现场根因证明。

只补R1／R2，新的排他目录可从b复制，交 `docs/RC51_AUTHOR_READ_READINESS_REPAIR_FINAL_DELIVERY_20261027.md`。已通过部分不推倒重写；修改后只跑影响到的窄回归与真实清理故障／退出核验。等待Codex复审，不自行提升、打包安装、改版本／生产assets／Profile，不操作或采样日常DSH／WE，不推送清理／开定时。

日常仍DSH0.2.1-rc.3／Whalerc.48／GitBash0.1.2，本轮没有操作日常。原WE保持；既有228项脏改动保护，现场具体根因仍未全量定案。“▶ 播放”文案与后续UI调整仍后排。

## 交接记录

补修任务将单次发到既有Gemini会话；发送状态与正文保留在本轮独立目录的`dispatch.json`及`sent-task.txt`，以发送后核验结果为准。

已单次发送并确认新用户消息、空输入、Working及Stop execution；保持原模型／权限。见dispatch.json，等待FINAL_DELIVERY，不自动继续新阶段。
