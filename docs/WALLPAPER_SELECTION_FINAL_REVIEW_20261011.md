# A2 壁纸选择后台审查通过，实机留待下一轮

2026-10-11，Codex。用户要求审查通过后收尾并推送，今天不安装或开真实窗口。

## 结论

F1–F4、R1/R2、R3已闭合。本轮没有发现新的阻断问题。
列表/显式刷新、受限ID解析、手动选择播放、选中与当前播放分离的源码和离线行为可接续准备新候选。
这不是第二张scene或全库实机通过：当前日常仍是已经安装的rc.24，工作区新增A2尚未打包/安装，package版本暂未改变。
下一轮必须另取新版本，不能从当前工作区同版本覆盖活动rc.24 tgz。

## 已核验

- check与CSS模板守卫通过；catalog16/16、Host85/85复跑通过。
- 独立前轮反例改为正确预期，在新目录复跑：首次加载只扫描一次、缺Lucy不阻塞第二张、危险声明拒绝/合法包回退保留。
- restart慢预检期间stop/dispose：迟到请求均409，无新会话，active=false；正常并发/重启由相关回归覆盖。
- 未加载/空库/缺项/不可用选择：开始/重启禁用，实际action不提交；初始等待提示与已加载缺项提示区分。
- R3以真实route和真实createPreviewSession、mock helper复核：普通未知ID和伪造resolveFrom请求都执行Host verifier；
  后者不产生任何helper调用，不再把不存在/未登记项目传到--we-open。
- DS新增真实session/mock helper回归确认已登记ID的真实获准项目优先，外部project/location/helper字段不接管内部参数，restart预检复用一次。
- 隔离Cordis SDK组成通过，不连接正在使用的DSH。
- 选择区隔离界面143项通过，布局6种面板宽度及640px窄视口通过；不能当官方Desktop视觉验收。

## 证据与保护

本轮独立证据：F:/dsh-wallpaper-plugins/.tmp/selection-final-review-20261011-114057。
run.mjs、regressions.mjs、results.json、untrusted-selection.mjs/json、sdk-contract.json、source-hashes.json均保留，旧失败证据未覆盖。
fixture均是假元数据/假内容，mock helper没有调用真实WE/Native。
未修改Profile/日常外观、未退出或重开DSH、未触碰原壁纸或官方EXE、未打新包或发布。
日常rc.24活动tgz SHA256仍为86021352502A1DBBD76B0A0B6D4B831967D3A271FA9D61E7F9C5CF01A61B6B02。

本次推送只保存经过本轮审查的库/选择实现、相关回归、日常试用/路线/交接记录。
临时证据、活动tgz、原壁纸本体不提交；其它历史实验源码留在本地，未因本次审查被合入生产。

## 下一轮

准备新候选和备份方案后，再确认用户方便。用户点击界面，Codex后台协作：
首次列表→Lucy→用户选另一张scene→Lucy，短验实际动态画面/名字/重启/停止清理与重开选择记忆。
自动播放保持关闭；其它scene仍为未验证手动实验，不追加任务栏隐藏/参数编辑/完整选择器。
今天在审查和推送后停止，DS无需继续返工。
