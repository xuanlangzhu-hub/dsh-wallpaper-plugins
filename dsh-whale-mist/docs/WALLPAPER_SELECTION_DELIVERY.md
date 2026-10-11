# 壁纸选择交付：受限列表、ID 解析与手动播放（DS，2026-10-11）

按 [DS_NEXT_WALLPAPER_SELECTION.md](../../docs/DS_NEXT_WALLPAPER_SELECTION.md) 实现 A2 小步；
第二轮依 [WALLPAPER_SELECTION_REVIEW_20261011.md](../../docs/WALLPAPER_SELECTION_REVIEW_20261011.md) 的 F1–F4 局部修正；
第三轮依 [WALLPAPER_SELECTION_SECOND_REVIEW_20261011.md](../../docs/WALLPAPER_SELECTION_SECOND_REVIEW_20261011.md) 的 R1/R2 局部补齐；
第四轮依 [WALLPAPER_SELECTION_THIRD_REVIEW_20261011.md](../../docs/WALLPAPER_SELECTION_THIRD_REVIEW_20261011.md) 的 R3 局部修正。起点 HEAD `cbca724`；
本仓库已有大量未提交工作，下表的"本轮"列只包含本轮改动的文件，其余差异属于前人。

本轮未安装、未打包、未开真实窗口/WE/浏览器可见窗口、未操作鼠标、未连接运行中的 DSH、未改 Profile、
外观存储、官方 EXE/app.asar、原壁纸文件或 WE 配置、未改版本/依赖/包内容策略、未提交或推送。

## 1. 本轮文件

| 文件 | 本轮改动 |
| --- | --- |
| `src/wallpaper/library.js` | **新增**：Host 库快照、显式刷新、id→受验项目文件的唯一通路 |
| `src/wallpaper/catalog.js` | 新增导出 `isCatalogId` / `verifyCatalogEntry`（启动前复核）与路径链接复核 |
| `src/wallpaper/scenes.js` | 纯规则：`isSceneId` / `CATALOG_ID_PATTERN` / `sceneSelection`；`resolveSceneRequest` 支持注入 `resolveProject`；Lucy 标记 `playbackVerified` |
| `src/wallpaper/session.js` | 列表/刷新路由、启动前复核、真实 `activeSceneId`、窗口名改为 Host 自有 |
| `src/index.js` | 显式库根 `WALLPAPER_LIBRARY_ROOTS` 并构建库 |
| `src/client.js` | 选择列表/刷新/选择与播放分离/持久化/自动播放限定/样式 |
| `qa/wallpaper/library.test.mjs` | **新增**：12 项 Host 库与双层解析检查 |
| `qa/wallpaper/ui-library.test.mjs` | **新增**：9 项选择 UI 行为检查 |
| `qa/wallpaper/session.test.mjs` | 补"伪造 catalog id 被拒"断言 |
| `qa/appearance-harness.js` | React 桩补 `useEffect`/`useCallback`（测试夹具，非产品） |
| `qa/appearance-wallpaper-regression.mjs` | 播放按钮计数排除刷新；补列表/两个标签的存在断言 |
| `qa/appearance-wallpaper-layout.mjs` | 场景字段从 select 改为列表容器；按钮行数单独计 |
| `package.json` | `check` 增加 catalog.js / library.js 语法检查（版本未改） |

## 2. API、根目录、缓存与 ID 校验

- **根目录来源**：`WALLPAPER_LIBRARY_ROOTS`（`src/index.js`），只有 Host 显式写死的绝对目录；
  本轮为已核对的 `E:\SteamLibrary\steamapps\workshop\content\431960`。请求不能传根目录，
  也没有全盘查找或自动搜 Steam。
- **列表/刷新路由**：`GET /whale-wallpaper/library` 只读缓存快照（不扫描）；
  `POST /whale-wallpaper/library/refresh` 显式刷新。两者都走既有 webServer 认证前缀 `/whale-wallpaper`。
- **缓存与并发**：首次刷新后缓存；刷新**合并**并发调用（同一次扫描，其余调用者收到 `joined:true`），
  不排队无限扫描；刷新成功后**原子替换**快照；刷新失败返回 502 且保留旧快照继续可用；
  根目录缺失作为 `rootWarnings` 报告，不显示成"空库"；截断以 `truncated` 报告。
- **数据边界**：列表返回 `id/title/type/available/reason/warnings/playbackVerified/previewRef`
  （即 `publicCatalogItem`），不含 project/entry/绝对路径/作者属性原文；路由层另有断言证明负载里
  没有 fixture 根路径。作者名称按纯文本渲染（客户端不使用 `dangerouslySetInnerHTML`）。
- **ID 校验**：浏览器只提交 `scene`（id）与 `mode`；`scene` 只接受 `lucy` 或 `we-<24位小写hex>`。
  `__proto__`/`constructor`/相对路径/绝对路径/裸哈希一律在进入查找前被拒，不会退到默认 Lucy。
  合法形状但未知或不可用的 id 由 Host 明确拒绝并说明原因。
- **启动前复核（每次都做）**：`verifyCatalogEntry` 重新解析 project.json 与内容文件的**物理路径**，
  逐个路径组件拒绝链接/junction，重新确认二者都在获准根内、类型未变、内容非空、
  内容文件仍是快照记下的那一个、项目 id 未变；删除、换类型、junction 替换、越界均拒绝。
  保留 scene.json 缺失时回退 `scene.pkg` 的既有规则。
- **双层解析一致**：`resolveSceneRequest` 仍在两处调用；routes 先复核并把
  `{sceneId, project, mode}` 交给 session，`create()` 再用注入的 `resolveProject` 解析同一条记录，
  因此最终 helper argv、会话报告与 `activeSceneId` 来自同一个 id。

## 3. 选中与实际播放

- 当前播放项来自 Host 状态 `activeSceneId`（取自存活会话自己的 config），不是前端的下一次选择；
  面板把"本次选择"和"当前播放"分成两个标签显示，标题不会假装画面已切换。
- 没播放时点「开始播放」；已播放时改选只保存，点「重新开始」才切换。
  `restart` 仍走既有所有权序列：先 `stopNow()` 并确认旧源 `closed===true`，未确认则返回 409，
  不新建；停止/重试清理始终可用（不因列表加载、所选项失效或刷新失败而失去入口）。
- 新场景启动失败时按既有路径恢复普通主题并清理本轮资源；失败后需手动选 Lucy 重试，无自动回退或重启。
- 未验证的库 scene 本轮**只支持手动启动**：`weAutoStart && daily` 只对 `lucy` 生效，
  选了未验证项时面板给出"未验证的壁纸不会自动播放"说明；Lucy 既有自动播放语义不变。
  不使用任何"已验证"持久化标记。
- 持久化：沿用 `appearance.v1`，只存稳定 id。旧值 `weScene="lucy"` 继续可用；
  语法合法的 catalog id 即使列表尚未加载也**不会被 normalizeSettings 清掉**（改由 Host 在启动时拒绝）。
  刷新、改外观参数、列表加载完成、重新挂载设置区都不触发播放。
- 最后选择被删除/不支持时保留该选择并显示「所选壁纸已不可用」，禁用开始、保留刷新/选 Lucy/停止，
  不悄悄替换成另一张。

## 4. 检查（全部在 `F:\dsh-wallpaper-plugins\dsh-whale-mist`，全新证据目录）

| 命令 | 结果 |
| --- | --- |
| `node --test qa/catalog/catalog.test.mjs` | **16/16 通过** |
| `npm run check` | 通过（含 5 个源文件语法 + CSS 模板守卫） |
| `npm run test:wallpaper-host` | **69/69 通过**（含新增 `library.test.mjs` 12 项、`ui-library.test.mjs` 9 项） |
| `npm run test:appearance` | 30 项通过 |
| `npm run test:appearance-wallpaper` | **139 项通过**（含列表/两标签/刷新断言） |
| `npm run test:appearance-wallpaper-layout` | 6 个面板宽度 + 640px 窄视口通过 |
| `npm run test:appearance-wallpaper-regions` | 8 项通过 |

证据目录（保留，未清理）：`.tmp/catalog-check-*`、`.tmp/wm-library-*`（临时目录）、
`.tmp/wm-ui-library-*`（临时目录）、`.tmp/whale-layout-qa-*`。

新增检查覆盖的行为（用 fixture 与 fake session/helper，未调用真实 WE/Native）：

- 列表/刷新：按需加载、状态轮询不扫描、并发刷新合并为一次扫描、失败保留旧快照、缺根报告、截断、
  scene/video/不可用项独立且带原因。
- 数据边界：public 不含路径；伪造 id/`__proto__`/路径不触发任何 helper 调用；拒绝信息不回显私有路径。
- 启动前复核：删除内容、改类型、同路径 junction 替换均被拒；合法 scene.pkg 回退可解析。
- 双层请求：fixture catalog id 真正变成 `--we-open` 的 project.json 与会话 `sceneId`，并出现在
  `activeSceneId`；路由只把 `{sceneId, project, mode, seconds}` 交给会话，前端传的 path/entry/helper/window 全部被丢弃。
- 竞态：复核期间 stop → 迟到结果不开源、不建会话。
- 持久化/自动播放：id 形状与保留规则、未验证项不自动播放，均有断言。

## 5. 未验收项与下一轮实机建议

- **未做**：没有真实窗口/实机播放证据；"scene 能否真的渲染""失败恢复""重启后名字与持久化"都未验证。
  上述检查不构成实机通过，fixture 不代表 WE 行为。
- **未做**：缩略图路由/网格/搜索/收藏/自定义目录/原壁纸参数/音频；`previewRef` 未使用。
- **未做**：`playbackVerified` 仍是常量 false（除 Lucy），不会因一次成功就持久化。
- 实机短验建议（**本轮不执行，由 Codex 审查后与用户协作**）：Lucy → 用户选第二张 scene → Lucy，
  检查画面真的切换、当前名称正确、停止/失败清理、重启后仍记住选择、未验证项不自动播放。
  需要新候选版本，且不得覆盖日常 rc.24。

## 6. F1–F4 修正（第二轮）

- **F1 首次进入真正加载**：列表读取分两态——`GET /whale-wallpaper/library?ensure=1` 表示"我要一份列表"，
  快照不存在时由 Host 在这里完成**首次有界扫描**并直接返回条目；快照已存在则退化为纯缓存读取。
  客户端首次挂载固定发 `ensure=1`，因此不再需要用户猜到先点刷新。并发仍合并，状态轮询与
  render 仍不扫描，重开区域不重复扫描，只有刷新控件触发重扫。缺根/失败明确显示，不会永远停在未加载空态。
- **F2 就绪与具体选择解耦**：新增 `probeHost`（平台/宿主/helper）承担启动门槛，`probeAvailability` 增加
  `catalogUsable`，`missing` 只报告"这些样例的文件没了"这一事实，不再由唯一样例否定整个服务。
  Lucy 用原样例文件校验，catalog 项用其受限记录复核；缺 helper 等原错误保留。
- **F3 可用性保护与重启顺序**：开始/重启按钮要求已确认可用的选择（`selectionUsable()`），action 层再护一次；
  **停止/重试清理完全独立于库状态**，加载中、刷新失败、所选项失效都不封锁停止。
  Host 侧 `restart` 改为**先复核下一项、再关旧源**：复核失败返回 409 且旧画面继续播放，不再出现
  "为了一个不可用的新项先关掉可用旧源"。刷新期间旧的有效选择保持可用。
- **F4 复核不再放宽越界声明**：只有**合法相对声明解析成功、而文件真的 ENOENT**、且该记录的内容确实就是
  scene.pkg 时才允许包回退；`unsafe_path`/`link_refused` 等声明一律拒绝，回退不能掩盖被改过的声明。
  快照记下的 entry 文件必须先存在且非空；扫描已判不可用的记录（含危险 preview）不会被"旁边有 scene.pkg"
  升级成可启动。

### 本轮新增/加强的检查

| 检查 | 断言的行为 |
| --- | --- |
| `library.test.mjs`「首次读取扫描一次，之后不扫」 | 首次 `ensure=1` 真的扫描且返回条目；重开、轮询、普通读取都不再扫描；只有 refresh 重扫 |
| `library.test.mjs`「样例缺失但第二张可用」 | status `available=true`、`missingScenes=[lucy]`，第二张真的启动 |
| `library.test.mjs`「样例缺失不掩盖坏选择」 | 被删的库 scene 与缺失样例各自 409，零会话 |
| `library.test.mjs`「不可用项重启不清旧画面」 | 重启到已失效项返回 409，旧会话**没有被 stop**，随后停止仍可用 |
| `library.test.mjs`「可用项重启确实切换」 | 复核通过后才关旧源，新会话用复核过的选择，`activeSceneId` 为新项 |
| `library.test.mjs`「声明变越界仍被拒」 | `../`、绝对路径、ADS 三种改法各自 409 且零会话；合法 scene.json 缺失仍走包回退 |
| `library.test.mjs`「不可用记录不被升级」 | 危险 preview 的记录即使有 scene.pkg 也不能启动 |
| `ui-library.test.mjs`「开始/重启需要可用选择」 | 按钮表达式含 `selectionUsable()`，停止表达式**不含**库状态；action 层再次校验 |
| `ui-library.test.mjs`「加载中不算不可用」 | 用真实源码表达式在六种列表状态下求值 |
| `appearance-wallpaper`（真实浏览器） | 首次挂载发出 `ensure=1`；只打开区域不强制重扫 |

### 本轮检查结果

| 命令 | 结果 |
| --- | --- |
| `node --test qa/catalog/catalog.test.mjs` | 16/16 |
| `npm run check` | 通过 |
| `npm run test:wallpaper-host` | **77/77**（library 19 + ui-library 10） |
| `npm run test:appearance` | 30 |
| `npm run test:appearance-wallpaper` | **143**（含首次加载断言） |
| `npm run test:appearance-wallpaper-layout` | 6 宽度 + 窄视口 |
| `npm run test:appearance-wallpaper-regions` | 8 |

### 仍未验收（与上一轮相同）

仍然没有实机证据：scene 能否真的渲染、失败恢复、重启后记忆都未验证，fixture 与隔离页不代表 WE 行为，
也不代表官方 Desktop 布局。未安装、未打包、未开真实窗口、未提交。

## 7. R1/R2 补齐（第三轮）

- **R1 重启预检纳入操作归属**：`restart` 现在在**读 body 之前**就 `claim('start')`，归属覆盖
  "读 body → 复核下一项 → 关闭旧项 → 创建新项" 全过程，不再走 `stopNow()`（那会 bump generation
  并换发新 token，正是"取消被遗忘"的来源）。新增 `cancelGeneration`：**外部 stop 与插件卸载**都会 bump 它，
  token 在 claim 时捕获该值，因此预检期间的取消会让该请求的每一步都拒绝，迟到的旧请求无法再取用最新归属。
  内部关闭改为 `closeRun()`（不碰归属与取消标记），stop 仍走 `stopNow()`。
  保留"新项无效不关旧画面"与"旧项清理未确认不开新源"；并发切换在预检期间有界拒绝（409）。
  `startWithToken` 删掉了被无条件覆盖的 `preVerified` 形参；restart 把复核结果作为 `resolveFrom` 传入，
  因此每个重启只复核一次，不再写"复用"却实际重算。
- **R2 空库/未加载不再当作可用**：新增 `selectionState()`，把选择分成四态——`verified`（样例或已被列表确认
  的条目）、`pending`（catalog id 尚未被成功读取确认：加载中、读取失败、空快照）、`unusable`（已成功读取但该项
  缺失或标记不可用）、`unknown`（存值本身不是 id）。`selectionUsable()` 现在**只**在 `verified` 时成立，
  开始/重启因此在前两种状态下禁用且 action 层拒绝；`pending` 显示"正在等待列表确认"，`unusable` 才显示
  "所选壁纸已不可用"。样例按其自身文件状态单独判定（不被库状态抹掉）；刷新期间已确认的旧记录保持可用；
  停止/重试清理仍只依赖运行与清理状态。

### 本轮新增的行为断言

| 检查 | 断言的行为 |
| --- | --- |
| `library.test.mjs`「慢预检期间 stop」 | stop 立即 200；放行后迟到 restart 非 200，会话数不增，`active=false`，归属已释放 |
| `library.test.mjs`「慢预检期间卸载」 | disposer 完成后放行，迟到 restart 非 200，不产生新会话 |
| `library.test.mjs`「读 body 期间 stop」 | 归属在读 body 前取得，晚到的 body 不能复活已取消的重启 |
| `library.test.mjs`「两次重启并发 + 正常重启仍完成」 | 并发切换 409；放行后正常重启 200、旧源已关、新会话用复核过的选择；**复核只发生一次** |
| `ui-library.test.mjs`「R2 未确认选择不可提交」 | 用生产源码表达式在未加载／空库／缺项／读取失败／已确认／不可用／样例缺失／非法 id 八种状态下求值 |
| `ui-library.test.mjs`「R2 按钮与警告跟随状态」 | 开始/重启含 `!selectionUsable()`；停止表达式不含库状态；`pending` 有自己的文案行 |
| `ui-library.test.mjs`「样例与已确认项在忙时仍可用」 | 样例不被库状态抹掉；已确认条目在刷新期间保持可用 |

旧契约中"`null` + `loaded=false` 视为可用"的期望已按复审要求改成 `false`，不是把实现改回去迎合断言。

### 本轮检查结果

| 命令 | 结果 |
| --- | --- |
| `node --test qa/catalog/catalog.test.mjs` | 16/16 |
| `npm run check` | 通过 |
| `npm run test:wallpaper-host` | **83/83**（library 23 + ui-library 12） |
| `npm run test:appearance` / `-wallpaper` / `-layout` / `-regions` | 30 / 143 / 6 宽度 + 窄视口 / 8 |

## 8. R3 修正（第四轮）

R3 是 R1 那轮我自己引入的缺陷：restart 的预检结果被放进请求 body 的 `resolveFrom`，而共用的
`startWithToken` 又从 body 取它。普通 start 的 body 直接来自请求 JSON，因此浏览器可以传同名
字段，让"内部已验证结果"与不可信请求混在一条通道上——id→获准根解析的核心边界被绕过。

修正（只动这一处）：

- 预检结果改为存放在 **token 的私有字段** `token.verifiedSelection`，由 restart 分支显式写入；
  普通 start 不设置该字段，因此**始终执行 `verifySelection`**。
- `startWithToken` 不再读取 body 中任何"已验证结果"形状的字段（`resolveFrom`/`project`/`sceneId` 都不读）。
- 新增 `projectSelectionRequest(body)`：进入启动逻辑前只投影 `scene`/`mode`/`seconds` 三个既有允许字段，
  其余（project/entry/helper/location/window 等）不进任何内部结构。start 与 restart 两条路径都走这个投影。
- R1 的 token 取消、并发有界拒绝、先复核后关旧源、restart 单次预检复用全部保留。

### 本轮新增反例（route → 真实 session → mock helper）

| 检查 | 断言的行为 |
| --- | --- |
| 未知 id + 伪造 `resolveFrom` | 409；**verifier 调用 0 次**；helper 命令 0 条、`--we-open` 0 条；伪造路径不出现在任何 argv |
| 已登记 id + 伪造 project | `--we-open` 打开的是获准项目，伪造路径一次都没出现；该 id 由 Host 自身快照复核恰好 1 次 |
| 附加 `location`/`helper` 字段 | 只用本轮生成的窗口名；调用者给的名字与 helper 路径都不出现在 argv |
| 正常 restart | 复核恰好 1 次（复用 token 上的结果），重启后打开的仍是获准项目 |

这些断言检查的是**helper 实际收到的参数**，不只是 HTTP 状态码——按复审要求，"409 来自我们主动拦截"
不算证据，必须同时确认没有启动参数泄漏。

### 本轮检查结果

| 命令 | 结果 |
| --- | --- |
| `node --test qa/catalog/catalog.test.mjs` | 16/16 |
| `npm run check` | 通过 |
| `npm run test:wallpaper-host` | **85/85**（library 25 + ui-library 12） |
| `npm run test:appearance` / `-wallpaper` / `-layout` / `-regions` | 30 / 143 / 6 宽度 + 窄视口 / 8 |

## 9. 边界确认

日常 `release/plugins/dsh-whale-mist-0.6.0-rc.24.tgz`、Profile、外观存储、原 WE 进程与官方 EXE
均未改动；未安装、未包、未开真实窗口、未提交或推送。R8 与 GPU/性能相关文件未触碰。
