# rc.53 npm 发行副本

此目录保存npm专用的确定配方与安装说明，不从共享rc.30／Trace开发树打包。
固定输入是已公开GitHub rc.53 tgz，SHA256
`8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA`。

npm副本为 `dsh-whale-mist@0.6.0-rc.53.npm.1`，公开预发行标签 `next`。
不与GitHub的原始rc.53同名归档混淆，不覆盖该附件、正式tag或日常安装。

`build-npm-package.py`验证原包43文件，41项运行代码／资产逐字节保持，
仅调整package.json（版本、private、发布／仓库元数据、明确白名单；移除缺源QA／构建scripts）
和README，另加入10份许可证／第三方资料。npm包53文件，无安装生命周期scripts，
宿主接口／peerDependencies／engine与原包相同，运行未另行声称实机验收。

```powershell
python release-sources/npm-rc53/build-npm-package.py --archive <已验rc53原tgz> --output <不存在的新目录> --node <node.exe> --npm-cli <npm-cli.js>
```

配方只执行有35秒截止的 `npm pack --ignore-scripts`，不会登录、发布、安装插件、
调用DSH／WE或修改共享开发目录。输出含原始pack结果、逐文件指纹、SHA256／SHA1／SHA512。
归档实际内容必须与期望53文件逐字节相同，否则停止。
公开发行由单独的已授权步骤完成，不将私有配置或凭据打包。

GitHub与npm版本的区别、发布结果和后续范围见[本轮记录](../../docs/RC53_NPM_PUBLICATION_20261028.md)。
