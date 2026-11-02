# Whale 外观 0.6.0 固定发行材料

此正式版从已验 rc.61 原 tgz 提升，45项运行代码／配置／资产保持原样，14个资产不变。只调整原 package.json、README，新增11项许可／来源资料，共58文件。内部诊断保留 rc.61 代码构建身份；正式分发版本为0.6.0。

- 原始rc.61 SHA256：`D6B286A18E06E4F1BA0C9AAF114F957EECFBD66085F0946A63985EB28B000A47`。
- 正式tgz SHA256：`15A2CA9FCB58586B254FB4E9266F01E3D7EF3B43BF76CE380063E39C486A837A`。
- GitHub ZIP内的tgz与npm提交文件为同一字节。
- package保存43项非资产文本快照；14项资产留在正式包，SDK原始RTF许可另在根licenses保留。所有58文件指纹见package-manifest.json。

```powershell
python -X utf8 release-sources/0.6.0/build-release.py --archive <已验rc61.tgz> --output <不存在的新目录> --node <node.exe> --npm-cli <npm-cli.js>
```

配方不联网／安装／发布／运行DSH或WE，只核对固定源并以35秒截止运行npm pack --ignore-scripts，再核对58项实际归档、原45项与14资产不变、8项第三方DLL及许可资料。两次独立打包的tgz／ZIP／校验文件逐字节相同。

源包与原始失败／实测／备份仅本机保留，旧审计中的published:false是构建时记录；实际渠道结果见 [正式版发布记录](../../docs/STABLE_060_PUBLICATION_20261102.md)。不改写旧审计标志，不整体打包Trace开发树，也不将发布授权当作安装许可。
