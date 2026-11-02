# Whale 玻璃控件独立样板（已选择 B 薄玻璃）

双击 `index.html` 即可离线操作。也可在仓库根目录执行：

```powershell
Start-Process -FilePath ./docs/previews/glass-controls-20261031/index.html
```

底部切 A 轻磨砂 / B 薄玻璃 / C 液态折射；URL 的 `?variant=A`、`B`、`C` 可直接定位。
箭头快捷键只在非控件焦点时生效，不抢滑块按键。可切暗色／明亮／复杂背景、并排对照、整栏毛玻璃；也可选择本机图片，图片只留在本页内存，不上传或存储。

本样板的问题：在相同字号、控件尺寸、布局和背景下，哪种材质适合壁纸侧栏？本轮刻意不改布局以隔离材质变量。用户已选择 B 薄玻璃，样板默认 B，整栏通透。

## 实现边界

- A/B：本地 CSS 实验；A 13px 模糊，B 3px 模糊＋细边缘。不是某个外部库的成品控件。
- C：真实 `liquid-glass-react@1.1.1`；8px 位移、4.8px 有效模糊、115% 饱和、关闭色散和弹性。不是截图或以阴影冒充折射。
- 保留库原始包，只在外层适配尺寸、投影、裁切。原库首次使用 270×69 默认尺寸，且只监听 window resize；本样板补 ResizeObserver 转接和边界裁切。原始首帧截图在本轮 `.tmp/.../first-render` 留存。
- 库的视觉层不截获操作，实际按钮、switch、range 保持原生语义和键盘事件。减少动态／减少透明度模式有降级。
- 播放、作者参数、保存都是本页内存中的交互展示；没有连接 DSH、WE、Profile 或任何真实参数下发。背景滑块只用于观察滑块本身，不改变真实壁纸。
- 默认无动画；无遥测、外部脚本、字体或图片请求。仅主动点击「参考资源」才打开外站。
- 不把这里的浏览器可用称为 DSH SDK／Electron 兼容、动态壁纸性能或用户视觉验收。小开关上的折射可能收益很小，需用户选择后再定接入范围。

## 来源与复现

上游：https://github.com/rdev/liquid-glass-react ，MIT，版权 MAX ROVENSKY。
实际采用 npm 1.1.1，不是远端 master 当前内容；npm 元数据 gitHead 为 `2f134d928b0313a7075f22e9f844212a72254231`。
下载包 SHA-512 与 registry integrity 一致，见 `provenance.json`。
运行依赖 React / ReactDOM 19.2.0、scheduler 0.27.0；构建 esbuild 0.25.11。该库声明 React >=19，后续应核宿主 React／SDK，不能直接升级宿主依赖。
全部运行许可放在 `THIRD_PARTY_LICENSES.txt`，并嵌入独立 HTML 的注释。

依赖只装在 `.tmp/glass-controls-prototype-20261031-a`；此目录和项目均未新增生产依赖。重建可在该独立目录复制本目录的 package/lock 后 `npm ci --ignore-scripts`，再从仓库根运行：

```powershell
node docs/previews/glass-controls-20261031/build.mjs
```

源码 `src.jsx` / `style.css` 只服务样板，不能直接整段替换生产侧栏。

待用户选择材质后记录结论，再吸收所需部分或归档；本轮不生成插件候选，不安装／发布。
