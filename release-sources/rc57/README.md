# rc.57 本机短验配方

只从已固定47文件实验载荷生成本机候选，默认回退日常 rc.56。详情见 [候选与短验准备](../../docs/RC57_AUTHOR_DIAGNOSTIC_CANDIDATE_20261029.md)。不从共享 Trace 开发树整体打包，不发布。

最终归档：`.tmp/rc57-author-diagnostic-candidate-20261029-b/dsh-whale-mist-0.6.0-rc.57.tgz`，SHA256 `EE286630B7D6F090C8762A7409A9E816BCE31D892EF355D0DEE4CEEE7273D262`。

配方：`build-candidate.py` → 新输出目录；`check-candidate.py` → 新核包目录；`prepare-trial.py --output <新.tmp轮路径>` → 未授权工具。配方有固定前轮输入，保留相关 `.tmp`，不承诺无这些证据即可独立重建。

本次核包 `.tmp/rc57-author-diagnostic-package-check-20261029-b`。实际短验工具最终 `.tmp/rc57-author-diagnostic-short-trial-20261029-b`，a已被b替代但保留。准备阶段没有授权或生产备份；随后用户新确认后完成实测，已恢复日常rc.56并写closed-out，本轮不可复用。见[实测及恢复](../../docs/RC57_AUTHOR_DIAGNOSTIC_SHORT_TEST_20261029.md)。生成工具本身不授权运行应用。

启动脚本只向子进程传一个诊断变量。默认0，显式本次启动1，恢复沿用原父进程值。新启动监督器只结束 helper，不杀应用树；未知结果不重开。下载 collector 只读本轮明确文件，不扫描 Downloads，不删除原文件。

日常切换配方 `prepare-daily.py` 派生全新 `.tmp/rc57-daily-trial-20261029-a`，purpose=`retain-rc57-daily`，准备阶段不创建授权或生产备份。沿用原包，只确认重开／外观／目录，不重复播放、作者修改或导出，诊断默认关闭。见[日常准备](../../docs/RC57_DAILY_TRIAL_PREPARATION_20261029.md)。

10月29日日常准备轮未执行并保留。10月30日以 `--output .tmp/rc57-daily-trial-20261030-a` 建新轮，用户新确认后备份并安装，已保留rc.57日常、诊断默认关闭、用户确认正常；该轮也已closed-out。见[日常交接](../../docs/RC57_DAILY_TRIAL_20261030.md)。旧配方与回退工具不能代替下一次当时方便确认或新备份。
