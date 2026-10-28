# rc.53 固定日常包源码

本目录保存通过限定短验、已另行新备份并保留日常的rc.53原始归档文本，不从含Trace的共享rc.30开发树重建。`package/`的29个文本文件按原包字节保存；完整43文件的大小／SHA256及归档指纹在`package-manifest.json`。14项二进制资产留在原归档，不重复提交。本目录缺少资产，不能直接安装或运行npm pack。

`build-inputs/native-appearance-sidebar.js`是本次实际整合的侧栏源模块，含rc.52已有读取诊断接点，未加入43文件原包。其指纹和生成client指纹见`build-inputs.json`。共享开发模块用于继续开发，两者不能无条件互换；原始首次读取就绪的四个后端运行文件保留固定包字节。

原归档版本`0.6.0-rc.53`，SHA256 `8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`，7,261,385字节。原包README包含临时候选及历史说明，为保持指纹没有改写；当前状态以[日常交接](../../docs/RC53_DAILY_TRIAL_20261028.md)为准。

Git快照与推送不等于GitHub Release或npm发布。首个Release准备事项见[发行准备](../../docs/FIRST_GITHUB_RELEASE_PREPARATION_20261028.md)。不要改写已验原包或同版本覆盖，不把本机备份、真实会话截图、壁纸本体或Wallpaper Engine放进公开附件。

`build-release-bundle.py`只将明确指定的原tgz与当前许可证／安装说明包装成外层ZIP，
不重建运行载荷；必须输出到新目录。`third-party-inventory.json`保存8DLL原NuGet匹配，
`license-sources.json`保存许可来源与用户回忆的旧ICO衍生关系，明确精确原图／工具未知。
当前[本地ZIP核对](../../docs/RC53_FIRST_RELEASE_BUNDLE_20261028.md)已通过，待用户安排公开。
补记来源的外层b轮保留原tgz，不覆盖a轮。重建示例（输出目录须不存在）：

```powershell
python release-sources/rc53/build-release-bundle.py --archive <固定rc53原tgz路径> --output <新输出目录>
```
