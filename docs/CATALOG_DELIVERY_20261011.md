# 壁纸库第一小步完成：只读登记，尚未接选择/播放

2026-10-11。按 NEXT_WALLPAPER_LIBRARY.md 实现；日常 rc.24 的安装引用、包和 Profile 未改。
没有调用 WE/原生 helper、操作窗口/鼠标或更改原壁纸、配置；没有改版本、打包、提交或推送。

## API 和输出

`dsh-whale-mist/src/wallpaper/catalog.js`，纯 Host 模块，导入没有扫描副作用：

```js
const catalog = await scanWallpaperCatalog({ roots: [approvedLibraryRoot] });
const list = catalog.items.map(publicCatalogItem);
```

调用方须显式提供 1–8 个获准绝对目录，不接受驱动器/文件系统根。
默认深度1、目录512、枚举条目4096、记录256、单份 JSON 512KiB；范围内的自定义上限可调整，
触及数量预算标 truncated，深度是明确的扫描范围。JSON 仅作数据，作者脚本/HTML/命令均不执行。

private items 给出稳定哈希 id、title/type、经路径核验的 project/entry/preview、available/reason/warnings、
workshopId 和 playbackVerified=false。id 基于物理项目位置，不随标题或枚举顺序变，不直接暴露路径；
移动项目目录会改变 id，本步未设计迁移识别。

**available 仅表示 scene 文件完整、符合继续验证的登记条件，不是当前已经可播放。**
video/web 分类保留但 available=false，reason=playback_type_not_supported；未知/缺内容/坏 JSON等独立标记。
没有替换 Lucy 白名单，也没有自动接入 Host apply/start。

publicCatalogItem 仅返回受限列表元数据与 previewRef（wallpaperId/kind），不返回绝对路径、entry 或属性原文。
title 是长度受限的纯文本数据，允许原字符串包含尖括号；后续 UI 必须以文本渲染，不能当作者 HTML 插入。
本步没有缩略图 HTTP 路由/文件读取服务；后续访问缓存路径时应重新核路径和资源状态。

## 文件处理

- scene 元数据可能 file=scene.json，但工坊只提供 scene.pkg：缺失的相对声明文件允许回退到同项目的 scene.pkg。
  越界、链接或坏路径不使用回退掩盖；空内容单独拒绝。
- 缺缩略图/空缩略图不会把正常 scene 当缺内容；危险缩略图路径拒绝，SVG/非图片不作为预览引用。
- 根/子目录/文件组件拒绝链接与 junction；相对路径拒绝 ..、绝对路径、NTFS ADS 和 Windows 特殊字符，
  realpath 后核不区分大小写的边界。metadata 打开后也检查限长及变化。
- 这些是只读快照校验，未来文件服务/播放注册不能把缓存记录当永久授权或文件未变的证明。
- 限额内 opendir 枚举，不读整个硬盘、不读壁纸本体；stat 检查内容/缩略图存在性，不解包 scene.pkg 或执行网页。

## 验证

`node --test qa/catalog/catalog.test.mjs`：**16/16**，无真实进程/窗口调用。
覆盖打包 scene、./路径、类型分类、坏 JSON/非对象/超长、缺项目/内容/缩略图/空文件、
越界/绝对路径/ADS、junction与链接根、稳定 id/大小写/重复根、数量/深度限制及 public 数据边界。
最终 fixture 与结果保留在 `F:/dsh-wallpaper-plugins/.tmp/catalog-check-irl06Q`，未执行递归清理。
语法检查与 diff whitespace 检查通过。没有接入已有执行入口，所以不重复 Host/桌面/性能实测。

只读核对获准的本机工坊根 `E:/SteamLibrary/steamapps/workshop/content/431960`：

| 项目 | 数量 |
| --- | --- |
| 总登记记录 | 26 |
| scene | 15 |
| video | 8 |
| web | 1 |
| unknown | 2 |
| 文件登记条件满足的 scene | 14 |

没有截断、无根目录错误。未知/缺内容等原因保留，不把记录总数当可播放壁纸数。
Lucy 被识别为可继续验证的 scene，scene.pkg 回退正确，预览为本地 GIF。
真实 private/public 快照、概要和最终源码复核位于 `.tmp/catalog-library-uhPsdA`；
最终代码核对结果与首次快照一致，源码指纹另存 verified-source-final.json。5份 Profile 配置与日常引用的 rc.24 tgz 哈希核对未变。
本机库数量是该次快照，不是后续固定值；扫描没有调用 WE 或 Native。

## 下一小步

基于 catalog 接 Host 的受限列表/刷新与 id 解析，在现有外观设置做最小列表/缩略图选择。
始终由 Host 校验并解析 id，前端不提交任意路径；资源路由单独核验，不能直接暴露文件系统。
先保持已验的 Lucy，选另一张 scene 做切换/失败回退/持久化与清理短验，再扩类型。
那是新候选版本，必须不覆盖日常 rc.24；实际安装/开窗前再确认用户方便。
目前没有选择 UI、多壁纸播放、属性编辑或隐藏入口实现。
