# rc.44 作者设置实机反馈与待修项

2026-10-21。当前结论：**作者参数效果未验收，本轮短验暂不通过；根因未定**。已按本轮退出确认保留测后数据并恢复 rc.42、原设置及布局，37项安装核验通过；用户已确认正常重开、原外观布局正常、播放停止，未将 rc.44 转为日常。

## 实际反馈与证据

本轮备份、固定原包与安装核验见 [短验记录](RC44_AUTHOR_SETTINGS_SHORT_TEST_20261021.md)。用户截图证明作者表单和“粒子/Particles”勾选框已经显示。两张截图分别为粒子未勾选/勾选，均提示“有未保存的修改；尚未下发壁纸”。截图本身只证明拍摄时仍有未保存修改，**不证明用户从未按保存、应用顺序操作**。

用户随后明确反馈“似乎确实按顺序点了，确实没看见什么变化”，并请求代操作。应以实际反馈继续调查，不能再把未生效归咎于操作顺序。现有335项回归、24项销毁与Win32接收器检查不覆盖本轮作者视觉响应，不能抵消这一结果。

Windows computer-use 的 node_repl 初始化报 `failed to write kernel assets: 系统找不到指定的路径。 (os error 3)`，reset后仍失败；本轮未能代点击，也没有用其它通道伪装一次UI点击成功。未向真实WE补发属性命令，未热改安装目录。

只读Host检查确认Lucy daily播放、原WE启动身份保持。原先location `WhaleWallpaperProbe-261021055708-6bcf` / capture PID47028，后续已变成 `WhaleWallpaperProbe-261021060359-3390` / capture PID46884。检查因同轮身份变化拒绝继续原窗口查询，未盲用旧HWND；不能把两次播放的参数结果串接。当前 active=true，lastCleanup是前轮closed=true，**不能把该旧清理结果当作当前轮已停止**。

证据根：`F:\dsh-wallpaper-plugins\.tmp\rc44-author-settings-short-trial-20261021-54a8ec12`，重点为author-panel-question-summary.json、author-panel-user-question.json、inspectWindow-result.json、author-current-end-state.json及对应有界脚本输出。用户截图保存在本对话所附原始临时文件，未改图。

## 功能排查要求

后续先在隔离环境建立实际共享表单→main/companion请求→Host→受控命令接收器的可复现链，再定位最小修复；本轮信息不足以定案在表单、Host门禁、命令传递或作者响应的哪一层。需要区分：未保存/禁用、保存返回、apply返回、身份门禁拒绝、命令发送与退出、作者可见效果。

- 使用真实DOM按钮disabled及click行为验证编辑→保存→应用，不用跳过disabled的测试替身把任意fire当点击。保存后pending应清除、dirty应保留到发送，失败与超时须显示明确结果，不能静默无反应。
- 记录脱敏请求结果和阶段、同一壁纸/代次/location/HWND/PID/UTC启动时间、退出是否确认。不得记录令牌；不得增加无条件真实WE命令、任意location或全局fallback。
- 覆盖吸附与独立视图、重开/重建会话后的失效边界；结果不确定不得自动重试。原始界面中禁用的“应用”视觉差异不足，应明确解释不可用原因。
- 官方 [命令行文档](https://help.wallpaperengine.io/zh/functionality/cli.html)规定applyProperties可按location限定并使用RAW JSON；静态形状符合文档仍不能证明本轮发到正确窗口或作者已响应。缺少实际响应时保留未知。

验收要求：精确固定候选离线通过后，另取当时方便确认、新备份，真实Lucy仅粒子关闭/恢复；UI明确成功/失败反馈，受控命令及退出证据齐全，用户确认可见变化。不得为排查自动重装、修改日常、改WE全局设置或扩大到其它参数。

## 用户新UI方向

详见 [侧栏改版要求](WALLPAPER_SETTINGS_SIDEBAR_REQUIREMENTS_20261021.md)。本轮只登记，不混入临时安装或声称已实现。先完成当前试验恢复，再安排实现。

## 恢复收尾状态

恢复前已新鲜核对DSH/伴随/采集关闭、原WE保持；17项测后数据另存。本轮37安装文件、5个Profile、9个关闭存储文件、三项布局核验一致，全部有界恢复步骤通过。用户已确认正常重开、原外观布局正常、播放停止，恢复收尾闭合；下发根因与作者可见效果仍未知。

## 离线排查进展

已用固定rc.44真实DOM/main transport/认证Host链复现：仅普通播放计数引起renderer revision变化，就会拒绝保存/应用，且无属性命令。最小修复已提升Host源码并补20项回归，实际相关109项通过；见[复现及最小修复](AUTHOR_SETTINGS_PLAYBACK_REVISION_FIX_20261021.md)。这是确定缺陷，但缺少用户原请求回放与作者实机效果，仍不宣称全部根因解决。日常rc.42保持，下一小步仅补独立窗完整链路。
