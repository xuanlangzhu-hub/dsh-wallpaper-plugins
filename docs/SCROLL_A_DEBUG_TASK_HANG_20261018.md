# 滚动A布局探针挂起：CDP小数ID与无界等待

2026-10-18，用户报告Antigravity后台“Inspect element bounding boxes”持续数分钟。只读核对发现对应临时Node进程18:56:17启动，19:10仍存在，累计用户/内核CPU时间均为0；命令连接本轮隔离fixture的9923 CDP端口。这里不是证明所有测试都慢，也不是CPU忙循环。

## 已定位原因

当前`debug-layout.mjs`及运行中的内联变体均使用：

```js
const id = Math.random();
ws.onmessage = e => {
  const d = JSON.parse(e.data);
  if (d.id === id) resolve(d.result);
};
```

在这个已经核实归属本轮隔离fixture的端口上，另开只读诊断socket，执行`Runtime.evaluate`字面量`1`：小数ID得到`{"error":{"code":-32600,"message":"Message must have integer 'id' property"}}`，没有id；整数ID1得到正常结果1。原脚本永远不满足`d.id === id`，也没有timeout/reject/error/close分支，故await永远不落定，后面的socket关闭和Edge退出不可达。

证据：`.tmp/scroll-a-hang-check-20261018-89c46875/protocol-check.mjs`、`protocol-result.json`及冻结的`debug-layout.mjs`。诊断只读查询测试页、求值字面量1，没有改DOM、停止进程或操作日常DSH/WE。

运行中的9923内联变体还有第二个问题：`JSON.stringify(() => {...}) + '()'`实际得到`undefined()`；修正ID后还会遇到表达式异常。应传实际JS表达式文本，并检查Runtime.evaluate的exceptionDetails。磁盘上的debug-layout.mjs使用模板字符串，不能把两者混为同一个版本。

## 给小G的最小处理要求

停止自己本轮已确认归属的挂起探针任务，保留输出；不杀其它测试或用户应用。用递增整数ID和pending Map处理响应；协议error、socket error/close、Runtime exception均显式拒绝，每条请求设有界超时（例如5–10秒）。在try/finally内关闭自己创建的socket/server/浏览器，等待浏览器退出后再处理自有临时profile；失败不能遗留常驻任务，也不能直接删除仍被使用的profile。

不需要为了看bounding boxes发模型任务或运行长测。先用一个布局查询验证有界完成，再继续既有滚动A R1–R3调查交付，不开新专项、不改生产实现。用户要求停止时尊重停止，定时任务仍PAUSED。

转达记录：19:12已通过computer-use发至小G原对话，核验新用户消息、输入清空及Working。挂起后台任务当时仍显示，不能据此宣称已经停止或脚本已修好；等待小G处理。Codex未改实现或终止进程。
