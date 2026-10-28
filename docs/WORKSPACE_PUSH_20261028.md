# rc.53 源码与交接整理

2026-10-28。用户授权先推送当前成果，再准备首个GitHub Release。本轮范围为源码／QA、固定日常包文本快照及交接文档；没有清理工作区、操作日常DSH／WE、改Profile、创建tag／Release或发布npm。

## 提交与保护

源提交：`27d61ef21f9c71b02c624699d13c6cb5b753e620`（`feat: refine gallery playback and preserve rc53 release sources`），45文件。包含图库选择／显式播放／安全切换、非Lucy参数绑定、相应QA、固定rc.53的29份包内文本和实际整合侧栏源、43文件指纹，以及按既有package MIT声明补充的根LICENSE。

文档另作接续提交，包含日常切换与恢复记录、[发行准备](FIRST_GITHUB_RELEASE_PREPARATION_20261028.md)和本地发布说明草案。先前本机与远端main均为`9e036e3dcffec299da2a38a4a6bd08b7758bec53`，本轮只做正常快进推送，不重写历史。最终远端核对回执保存在本机`.tmp/rc53-push-20261028-a/`，最终提交号以本次推送结果及Git日志为准。

整理前所有本轮脏文件及忽略的NEXT_TASK已经复制到该目录`before/`，另存原始指纹、工作树补丁及status。不reset／clean，不删除原始失败证据、归档、备份或媒体。真实会话截图、`.tmp`、本机发行包及Profile没有加入Git。固定43文件包和日常rc.53未改写；14个二进制资产不在新快照中重复提交。

## 检查

- 当前生成片段一致性、npm run check、20项选择与参数ID测试及固定快照client／侧栏源语法检查均通过。
- 通过指纹核对复用之前984／58／最终169回归及实际包SDK15场景，不重复启动浏览器或真实应用。
- 固定rc.53源码29文件、整合模块与原tgz／已验SDK输入对应。Git暂存区的30份原始包／构建源字节一致；外层JSON元数据按值核对。最初对外层JSON也要求原始换行字节，因正常Git换行转换拒绝；收窄到明确的原始载荷范围后重新核对，没有改动运行文件或原包来迎合检查，见本机`source-stage-assertion-correction.json`。
- 当前改动／新增文件未匹配私钥、GitHub或API凭证模式，且没有真实截图／备份路径被纳入待提交文件。模式扫描不等于对全部历史内容的安全审计。
- git diff --check通过；固定快照的混合换行按.gitattributes保留，不为了消除提示改写已验包。

## 首个 Release 的边界

GitHub只读查询表明仓库公开、默认main且当前Release列表为空。可基于这次功能做首个预发行；公开附件前仍须完成本机原tgz未携带的LICENSE／第三方NOTICE，以及Windows SDK具体随包文件的再分发条件核对。当前仓库新增项目MIT许可不自动补进旧tgz，也不把Windows SDK归为MIT。

不会上传整份开发树充当安装包，GitHub自动Source code.zip不能替代经过白名单核对的附件。npm发布独立安排，当前private:true保持。日常继续rc.53，Git推送不代表公开Release或npm已发布。
