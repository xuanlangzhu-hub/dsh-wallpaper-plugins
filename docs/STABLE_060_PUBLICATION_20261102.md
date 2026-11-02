# 0.6.0 正式版发布

2026-11-02。用户明确授权“正式版也发布”，本轮从已验收并日常使用的 rc.61 固定 tgz 准备 GitHub／npm 同一正式载荷，版本0.6.0。授权不包含重装日常应用；DSH／WE／Profile和日常rc.61不动。

## 内容与核验

- 原rc.61归档SHA256：`D6B286A18E06E4F1BA0C9AAF114F957EECFBD66085F0946A63985EB28B000A47`。
- 正式tgz：7,633,766字节，SHA256 `15A2CA9FCB58586B254FB4E9266F01E3D7EF3B43BF76CE380063E39C486A837A`。
- GitHub ZIP：7,407,629字节，SHA256 `CEC5A043EC2E47BEC1F07583DB059EADEF8261BFB8C400A9ED754DB6BD90FC34`。
- 原47文件中45项完全不变（包含全部14资产）；只改README与发行manifest，新增11项许可／来源文件，共58项。8项第三方DLL仍与既有NuGet核验记录同字节，许可原文保持。
- 两次独立打包tgz／ZIP／校验文件逐字节一致；实际归档58项白名单与摘要一致，27JS语法通过，npm publish dry-run退出0。dsh接口／engine／peerDependencies／exports等运行配置保持，无生命周期scripts。
- 152项行为与15项SDK结论按相同运行文件继承，不冒充本轮重新实机；内部诊断保留rc.61代码build身份，发行版本0.6.0，BUILD_PROVENANCE.json说明来源。

固定[发行材料](../release-sources/0.6.0/README.md)保存43项非资产文本快照、58项清单和确定配方；14资产与原始SDK RTF许可保留于实际包／已有根licenses，不把原生编译输出重复加入源码。

## 发布进度

准备阶段：npm登录曾401，用户已重新登录，核对为原maintainer；0.6.0版本发布前公开查询404。GitHub账号和远端正常，正式tag尚不存在。连接器没有Release创建／附件能力，使用本机已登录GitHub CLI，不读取或复制凭据。

本机独立证据 `.tmp/stable-release-060-20261102-a`；成品 `release/stable-0.6.0-20261102-a`，独立重建-b保留。线上发布与匿名下载核对结果随后追加，不以准备／dry-run冒充发布成功。

## 边界

已知问题见[发行说明](../release-sources/0.6.0/RELEASE_NOTES.md)。正式版本号表示选择公开交付当前功能范围，不等于三体／长期滑块／全部壁纸兼容已解决。没有新增运行功能、修改共享rc.30 manifest／assets、重编原生、安装或操作日常应用；三体、进一步任务栏优化和UI继续暂缓。

## GitHub 已正式公开

- [Whale Appearance 0.6.0](https://github.com/xuanlangzhu-hub/dsh-wallpaper-plugins/releases/tag/dsh-whale-mist-v0.6.0)，Release ID `431020229`。
- `draft=false`、`prerelease=false`，`/releases/latest`也指向本版。
- tag `dsh-whale-mist-v0.6.0` 固定指向发行材料提交 `2f0c6dedc610a87206fc5916876946103b98b824`。
- 两附件通过公开、未登录API查询与匿名下载核对，逐字节等同本机已审ZIP和校验文件；服务端SHA256 digest同样匹配。

创建草稿后第一次按tag读取未成功；按现有Release列表核对唯一名称／目标提交后定位同一ID，再下载草稿附件验证，没有重发创建或更换资产。发布只PATCH同一ID的draft／prerelease／make_latest；旧rc.53、tag和npm版本均未修改。

## npm 认证进度

初次非交互publish在认证阶段EOTP退出1；公开0.6.0仍404，确认未上传后才开启一次交互认证。交互流程已获得独立发布验证，等待用户完成；认证链接／authId不进入Git。尚不能称npm正式版可下载，最终registry与匿名tgz核对待补。

### npm 本轮等待已结束

交互认证的180秒等待到时，父监督终止自有npm进程并确认退出，回执code124；未收到发布成功结果。随后公开0.6.0查询仍404、latest／next仍为旧rc.53。本轮不继续自动重试；需用户在场时新开一次独立发布验证，再检查服务端结果。旧认证链接不要继续使用，发布授权仍有效，不需要重新决定是否发布。
