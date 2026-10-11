# A2 第三轮复审：R1/R2已修，只补R3内部结果边界

2026-10-11，Codex。check、catalog16/16、Host83/83复跑通过。
独立例子再次确认F1/F2/F4、重启预检期间stop/dispose取消、空/未加载/缺项选择按钮与真实action保护均通过。
不再返工这些已修项。**仍有一项新引入的P1缺陷，暂不打包/安装。**

## R3（P1）：外部请求可以伪造Host已验证结果

位置：dsh-whale-mist/src/wallpaper/session.js 的 startWithToken，`let selection = body?.resolveFrom ?? null`。
restart 的 Host 预检结果被放进 body.resolveFrom，然后共用的 startWithToken 从 body 取出并直接信任。
普通 start 路由的 body 直接来自请求 JSON，浏览器也能传同名字段，因此“内部已验证结果”没有与不可信请求分开。
selection 为真时verifySelection完全不执行，最终createPreviewSession又把该project作为已验证路径使用。

独立证据用**生产route + 生产createPreviewSession**，只mock helper/spawn；没有真实原生调用：

1. 正常提交从未登记的we-ID：返回409，verifyScene调用1次，零helper命令。
2. 同一ID加resolveFrom:{sceneId, project:<本轮目录里根本不存在的project.json>, mode:'daily'}：
   verifier调用次数仍是1（第二次请求完全跳过），路径直接到mock helper的`--we-open`参数。
3. mock helper主动抛“审查截获”后返回409。这一409来自我们的拦截，不是产品的路径/目录/ID拒绝；
   不能把该状态码当作问题已防住，也不声称真实WE已经读取/播放任意文件。

这绕过了前几轮建立的“前端只传ID、Host从获准库解析”的核心边界。

## 最小修正

- 不从HTTP请求body读取resolveFrom或任何“已验证结果”字段。
- 把预检结果作为startWithToken的**单独内部参数**或私有token字段，由restart分支显式传入；
  plain start不传这一内部值，始终执行verifySelection。
- 进入启动逻辑前，从请求只投影scene/mode/seconds等既有允许字段。附加project/resolveFrom/sceneId/helper/location等
  不能传成内部可信结构。拒绝或忽略额外字段均可，但不得跳过正常ID/路径核验。
- 保留R1的token取消/并发/清理保护和restart一次预检复用，不要退回读body前无归属或自动重复开源。
- 新增route→**真实session→mock helper**反例：未知ID+resolveFrom拒绝且零open调用；
  已登记ID+伪造resolveFrom不能改写获准项目；正常restart仍复用一次Host预检。
  不要仅断言HTTP409，必须同时检查没有启动参数泄漏。

只需这一局部修改与对应测试，不改UI、Native、其它已验模块或测试框架。

## 证据与边界

F:/dsh-wallpaper-plugins/.tmp/selection-third-review-20261011-095219：

- regressions.mjs / results.json：前轮独立反例改为预期通过后的结果，旧目录/证据未覆盖。
- untrusted-selection.mjs / untrusted-selection.json：真实route/session的新反例与命令边界记录。
- source-hashes.json / sdk-contract.json：本轮源码/活动包指纹与隔离SDK复核。

所有项目内容都是本轮假数据；没有真实WE调用、安装、Profile/外观存储修改或提交推送。日常rc.24活动包保持不变。
DS补R3、跑check/catalog/Host和新增反例后再交审查；不改版本、打包或操作应用。
