# DSH rc.2兼容候选复审：可安排有备份的升级短验

2026-10-17，Codex。复审[小G兼容候选交付](DSH_021_RC2_COMPAT_CANDIDATE_DELIVERY_20261017.md)，对照[U1/U2任务](GEMINI_NEXT_DSH_021_RC2_COMPAT_PREP_20261017.md)及[升级准备](DSH_021_RC2_UPGRADE_PREPARATION_20261017.md)。

**结论：两项兼容候选的核包、声明门禁和本轮离线接口检查通过，可以安排正常退出、新备份及官方0.2.1-rc.2升级短验。** 不宣称已安装、真实新宿主视觉通过、所有插件功能通过或长期稳定。当前宿主仍为0.2.0-rc.2，日常插件仍rc.34。

## 候选核包

| 候选 | 本轮核对结果 |
| --- | --- |
| 鲸系外观0.6.0-rc.35 | 7,392,549字节，28文件；SHA256=`20D35ED1A63E2272FF50E44A9A38891F1D973994BED446FB19D79B0A9E6FAE58` |
| Git Bash 0.1.1 | 6,903字节，7文件；SHA256=`4BDC48FCE7BC8D71FDEBF94B329913ACD6FC217618C23493EAEFA20E6100B7BB` |

rc.35相对不可变rc.34仅package.json/README变化；其余26文件逐字节相同，包括client、Host、12个原生运行文件及图标辅助资产。没有P0/Trace混入。两个原归档均保留，不覆盖任何同版本归档。

Git Bash 0.1.1相对0.1.0的7个文件字节均有变化：manifest/README有内容更新，其余5个是LF→CRLF，规范化换行后执行器、patch及LICENSE内容一致。不能将它写成“只改两文件且其余逐字节相同”；本轮未发现执行器业务逻辑被改变。`whale-candidate-diff.json`、`gitbash-detailed-byte-diff.json`和规范化diff保留原始核对结果。

## 声明与实际SDK检查

证据根：`.tmp/detachable-appearance-p0-seventh-review-20261017-fca7697e`。新SDK均来自此前已签名/校验的官方rc.2安装器，不是从当前安装的旧SDK替代；检查使用系统Node 24与独立headless Edge，没有启动官方Desktop EXE。

1. **声明门禁**：使用实际新宿主兼容函数原文和同包semver，读取两个候选及桌宠0.3.0/推理档位0.8.0固定归档manifest；对旧0.2.0-rc.2及新0.2.1-rc.2的8个组合均无unmet requirements。无版本豁免，见`compatibility-results.json`。
2. **真实Cordis Host接缝**：`new-sdk-whale-host-contract.mjs`以实际候选Host和新版Cordis4.0.5核对webServer注入及路由注册；status、拒绝任意scene/非法mode及metrics检查通过。webServer是可记录路由的隔离服务替身，未挂实际DSH端口，未启动壁纸或图标辅助程序，见`new-sdk-whale-host-result.json`。
3. **真实新版ThemeRuntime**：`new-theme-runtime-check.mjs`在隔离浏览器执行候选client和实际新版ThemeRuntime，6项通过：注册/选择Abyss、切Mist、切回Abyss、亮度120可用、新字体大小API仍可调用、dispose移除主题。React与周边服务仍是fixture，未跑真实React布局、键盘快捷键或字体持久化验收。最初的临时检查脚本有路由/fixture API适配错误，保留失败日志；修正仅限临时脚本，成功结果见`new-theme-runtime-success.log`及`new-theme-runtime-result.json`，不是靠改产品代码通过。
4. **真实新版Git Bash继承接缝**：`new-sdk-gitbash-contract.mjs`以真实Cordis、schemastery和SandboxPwshExecutor构造候选执行器，验证resolve/argv/UTF-8环境、read-only/workspace-write在spawn前拒绝；full-access路径到真实父类，由subprocess替身拦截，实际OS进程启动数0。未把mock父类3项单测扩称新SDK执行通过，独立补测结果见`new-sdk-gitbash-result.json`。
5. **预设配置**：实际新app-boot解析候选patch，递归检查29个条目（含重复/子路径/禁用入口，非29个不同包）；模块均可解析，23个有schema的配置接受、6个无schema，未调用任何plugin.apply或启动Agent。见`new-sdk-preset-config-result.json`。此证据不证明真实子代理、工作流或所有工具运行行为。
6. **既有Git Bash单测**：冻结源码语法检查退出0、3/3单测通过，候选执行器与测试输入按换行规范化一致。执行器源码不改；新SDK补测绑定实际候选核心文件。
7. **UI入口静态核对**：实际新frontend的static module映射存在primitives→zU，zU导出FishLogo；general settings、会话标题actions、模型选择、shell.overlay及settings.section声明存在。settings.section实际承载于settings-general，不因为settings域基础包本身没有声明就称槽位已删除。见`new-ui-surface-result.json`。小G交付的`SZ().staticModules[...]`措辞应理解为SZ返回的映射，并非此属性路径的真实调用证据。

桌宠和推理档位保留原包，只覆盖声明/所用槽位静态存在；本轮未验动画、提醒或真实模型请求。既有client/外观QA未变，历史570/566/场景选择证据沿用，不把旧fixture说成真实新版整体视觉通过。

## 现场升级方案（尚未执行）

1. 本轮重新读取官方nightly feed，仍为0.2.1-rc.2，已保存`pre-short-test-feed.yml`。新旧安装器指纹/签名及旧app.asar与当前安装一致的证明保留在[准备目录](DSH_021_RC2_UPGRADE_PREPARATION_20261017.md)。若实际安装前又发新版本，报告变化并保留本次已审目标，不自动换版。
2. 先取得用户当时方便/无任务的明确确认，暂停其它助手，停止壁纸并通过菜单正常退出DSH；原WE保持。**不用复用历史退出回复**。本轮只复审，尚无安装/退出/重启授权。
3. 关闭后新备份完整升级相关数据：Desktop Profile及依赖状态、Electron userData、`.dsh`的会话/附件/存储/配置/凭据/插件数据和固定归档。备份为本轮新目录并逐项指纹核对，保留已有旧备份，避免递归把backups嵌套复制；不打印凭据内容，不以旧5Profile/11个外观文件代替宿主升级备份。
4. 按官方支持的插件安装路径切到已审rc.35与Git Bash0.1.1，再以已审官方rc.2安装器/明确版本的更新流程升级原安装位置。优先在已退出状态通过经核对的Profile安装流程处理，不能直接手改node_modules/官方app.asar；如需要临时打开旧版插件页，先告知用户并安排相应正常关闭，不能默默多次重启。
5. 正常重开后先核对版本、两候选实际加载、主题/布局/新字体设置、模型与推理档位、桌宠及Git Bash预设可见；现有会话只读显示，不自动发送付费模型请求。再安排Lucy最短播放/停止与清理，保留原窗口/外观，不重做三体或性能矩阵。Git Bash实际执行如需验收，另明确范围，使用独立目录并保持权限门禁。
6. 成功后记录实际覆盖和最终日常版本；失败先留新现场、正常退出，再按旧安装器及当轮备份处理。新数据另保留，不盲目覆盖升级后新增会话。旧安装器来源已核对，不代表升级后数据自动向后兼容；官方更新器也不自动降级。

## 保护与结论边界

209项保护清单见`protected-before.json`、`verification.json`。本轮未改小G实现/候选包、当前安装EXE/app.asar、活动Profile或外观存储，未操作真实DSH/WE窗口，未安装/提交推送/清理或跨会话消息。用户仍在日常使用，不能声明活动数据冻结，也不能复用交付中的“当前播放停止”为本轮现场事实。

[P0七审](DETACHABLE_APPEARANCE_P0_SEVENTH_REVIEW_20261017.md)补修已通过，但P0不在rc.35中。本次升级只保持日常外观和Git Bash兼容，不交付独立设置窗口。
