# 给小G：DSH 0.2.1-rc.2兼容准备，先保住日常外观与Git Bash

2026-10-17。用户已把DSH升级排在完整独立设置/UI之前。先读[升级准备与原始证据位置](DSH_021_RC2_UPGRADE_PREPARATION_20261017.md)，不要再按rc.1或旧宿主推断新版；实际目标为官方Windows 0.2.1-rc.2。

本轮只做兼容准备和离线验证，不安装/启动/退出/重开真实DSH，不改活动`.dsh`、官方EXE/app.asar或用户窗口，不提交推送清理、不跨会话发消息。用户仍在使用日常rc.34。修改另一源码仓库前先读对应AGENTS.md并核对git status，保留既有改动。

## U1：日常鲸系外观兼容候选

- 来源只能是`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.34.tgz`，SHA256=`8DDB36C86FEDA3DACAAB2904A49414E5DFDAEB2E7D0CC05F71BCAB67AC23EA75`。另建隔离暂存，不从含Trace/P0的工作区整体打包，不覆盖rc.34。
- 已复现：新宿主兼容函数拒绝原包的6项精确旧版本UI peer。先从已解包的新宿主核对真实客户端导出/虚拟模块、theme/layout/sidebar/conversation/settings服务与生命周期、`ctx.webServer`路由、字体和令牌变化，以及settings/媒体/壁纸/图标路径。不把npm包是否存在等同于浏览器虚拟模块是否存在。
- 仅在有接口与离线加载证据后声明精确已验证的旧0.2.0-rc.2及新0.2.1-rc.2支持，可按新机制增加`engines.dsh`；需要的peer声明同时核对，不用宽泛0.2.x、latest或版本豁免掩盖未知。
- 规划新候选版本0.6.0-rc.35（先确认未占用，不覆盖任何同名归档）；只做宿主兼容所需差异，保留rc.34的20–120亮度、四字段预设、可读性、强调色、原生P4与无Trace边界，不带入P0或新UI。给逐文件差异和新包清单/指纹，12个原生文件无必要不改。
- 验证使用实际候选输入；既有外观/场景选择及Host契约按影响核对，若fixture仍只模拟旧宿主，不能将其通过称为新宿主接缝通过。至少补实际新宿主导出/槽位/路由接缝证据，以及旧版本回归。没有实机就清楚写未验视觉和长期运行。

## U2：独立Git Bash预设兼容候选

- 源码`F:\deepseekharness\dsh-whale-gitbash`，原日常归档`F:\deepseekharness\release\plugins\dsh-whale-gitbash-0.1.0.tgz`，先读该仓库AGENTS及插件README。
- 原包把`dsh-agent-preset`、`dsh-pwsh-sandbox`、`dsh-tool-bash`锁在0.2.0-rc.2，新门禁已确认拒绝。核对新SandboxPwshExecutor接口、工具/权限/工作目录/后台进程契约；对照新官方standard组合，检查原自带组合中的服务/工具/参数是否退休或变化，保留Git Bash替换的独立realm和原预设ID/会话恢复语义。
- 规划0.1.1兼容候选（先确认未占用），保护0.1.0原包；只在证据支持后增加精确版本声明。默认PowerShell、官方标准模式、旧会话、访问权限和受限令牌失败保护保持，不因新版或MSYS错误自动提权。
- 跑适当语法/原有执行器测试与新SDK离线契约；确需命令执行时限定隔离目录，不挂真实Desktop Profile，不触发模型请求或自动升级权限。

## U3：其余日常插件与交付

- dsh-pet 0.3.0与dsh-reasoning-effort 0.8.0仅声明门禁已通过，不顺手升级/重打包。核对其实际用到的新宿主槽位/导出，尤其rc.1 stats拆分；发现不兼容再给最小证据与方案，不将“未命中特定字符串”当作完整验收。
- U1/U2分开交付，给源包与新候选指纹、原始日志、实际宿主文件/commit版本、修改文件清单、静态/运行/视觉验收边界。无新候选前不能写“现在可直接升级”。
- [P0六审H1/H2](DETACHABLE_APPEARANCE_P0_SIXTH_REVIEW_20261017.md)只补执行前会话/弹窗代次核对，已有G2不要重做；可先收尾这两个点，再优先U1/U2，不扩完整设置页。兼容产物绝不混入P0开发文件。
- Codex审计候选通过后，才安排当时无任务确认、关闭后完整新备份、官方宿主升级和最短必要短验。安装与恢复由后续明确现场步骤执行，本任务不先问用户退出。
