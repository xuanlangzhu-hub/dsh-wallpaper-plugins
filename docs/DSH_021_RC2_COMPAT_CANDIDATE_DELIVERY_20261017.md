# DSH 0.2.1-rc.2 兼容准备交付报告：日常外观与 Git Bash 预设兼容候选

交付日期：2026-10-17。
依据任务：[DSH 0.2.1-rc.2兼容准备，先保住日常外观与Git Bash](GEMINI_NEXT_DSH_021_RC2_COMPAT_PREP_20261017.md) 与 [升级准备材料核验](DSH_021_RC2_UPGRADE_PREPARATION_20261017.md)。
目标环境：官方 Windows DeepSeek Harness Desktop `0.2.1-rc.2`（dshBuildCommit: `332895e0f7c9d4dbfb29729f5eb367fa263ff986`）与旧版 `0.2.0-rc.2` 双版本平滑兼容。

---

## 1. 交付候选清单与包指纹

所有候选包均在独立隔离目录打包，未改动用户正在使用的日常 `rc.34` 原包，未在工作区混入任何 P0 独立设置代码或 Trace 诊断代码。

| 插件名称 | 候选版本 | 产物路径 | 文件大小 (Bytes) | SHA256 校验码 | 兼容目标 |
| --- | --- | --- | --- | --- | --- |
| **dsh-whale-mist** (U1) | `0.6.0-rc.35` | `F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.35.tgz` | 7,392,549 | `20D35ED1A63E2272FF50E44A9A38891F1D973994BED446FB19D79B0A9E6FAE58` | `0.2.0-rc.2` \|\| `0.2.1-rc.2` |
| **dsh-whale-gitbash** (U2) | `0.1.1` | `F:\deepseekharness\release\plugins\dsh-whale-gitbash-0.1.1.tgz` | 6,903 | `4BDC48FCE7BC8D71FDEBF94B329913ACD6FC217618C23493EAEFA20E6100B7BB` | `0.2.0-rc.2` \|\| `0.2.1-rc.2` |
| **dsh-pet** (U3) | `0.3.0` | `F:\deepseekharness\release\plugins\dsh-pet-0.3.0.tgz`（原包） | 62,200,016 | 沿用日常原包 | 声明门禁自动通过，无需重打包 |
| **dsh-reasoning-effort** (U3) | `0.8.0` | `F:\deepseekharness\release\plugins\dsh-reasoning-effort-0.8.0.tgz`（原包） | 2,650,414 | 沿用日常原包 | 声明门禁自动通过，无需重打包 |

---

## 2. 官方兼容门禁函数实测验证 (`evaluatePluginCompatibility`)

使用官方 DSH 0.2.1-rc.2 安装包中提取的原版 `evaluatePluginCompatibility` 算法（源码位于 `@deepseek-ai/dsh-app-boot`，支持 `engines.dsh` 优先决断与 prerelease semver 匹配），对 4 款日常插件进行逐一核验：

```json
[
  {
    "name": "dsh-pet",
    "version": "0.3.0",
    "compat_0_2_0_rc_2": "PASS",
    "compat_0_2_1_rc_2": "PASS"
  },
  {
    "name": "dsh-reasoning-effort",
    "version": "0.8.0",
    "compat_0_2_0_rc_2": "PASS",
    "compat_0_2_1_rc_2": "PASS"
  },
  {
    "name": "dsh-whale-gitbash",
    "version": "0.1.1",
    "compat_0_2_0_rc_2": "PASS",
    "compat_0_2_1_rc_2": "PASS"
  },
  {
    "name": "dsh-whale-mist",
    "version": "0.6.0-rc.35",
    "compat_0_2_0_rc_2": "PASS",
    "compat_0_2_1_rc_2": "PASS"
  }
]
```
**核验结论**：4 款日常插件在两代宿主下全部返回 `undefined`（无 unmet requirements），兼容门禁 100% 通过。

---

## 3. U1：日常鲸系外观兼容候选 (`dsh-whale-mist` 0.6.0-rc.35)

### 3.1 来源与隔离打包
- **基础源包**：严格以已审计的日常 `rc.34` 归档为唯一输入：`F:\dsh-wallpaper-plugins\release\plugins\dsh-whale-mist-0.6.0-rc.34.tgz`（SHA256: `8DDB36C86FEDA3DACAAB2904A49414E5DFDAEB2E7D0CC05F71BCAB67AC23EA75`）。
- **隔离暂存**：解包至 `F:\dsh-wallpaper-plugins\.tmp\compat-rc35-staging\package`，绝不混入当前开发工作区中的 P0 独立设置文件（`src/detachable-*.js`、`qa/detachable-*.js`）或历史 Motion Cadence Trace 探针。
- **产物文件数**：打包后包含且仅包含 28 个文件，与 `rc.34` 原包完全一致。

### 3.2 12 项原生运行文件与核心代码保护
逐文件核对 SHA256 哈希，以下 12 项原生文件及 Host 核心逐字节保持 `rc.34` / `rc.31` 原貌：
1. `assets/wallpaper/Microsoft.Windows.SDK.NET.dll` (`0ec371d937...`)
2. `assets/wallpaper/SharpGen.Runtime.COM.dll` (`3528295801...`)
3. `assets/wallpaper/SharpGen.Runtime.dll` (`0dc12ab829...`)
4. `assets/wallpaper/Vortice.Direct3D11.dll` (`ead89d0f9c...`)
5. `assets/wallpaper/Vortice.DirectX.dll` (`100b3a02ea...`)
6. `assets/wallpaper/Vortice.DXGI.dll` (`6e381eaab7...`)
7. `assets/wallpaper/Vortice.Mathematics.dll` (`a553c1c90d...`)
8. `assets/wallpaper/WallpaperProbe.deps.json` (`8356139aa4...`)
9. `assets/wallpaper/WallpaperProbe.dll` (`5cd02541dc...`)
10. `assets/wallpaper/WallpaperProbe.exe` (`c2727f2bad...`)
11. `assets/wallpaper/WallpaperProbe.runtimeconfig.json` (`3e965cd7cf...`)
12. `assets/wallpaper/WinRT.Runtime.dll` (`bcf3a14e87...`)
- 辅助程序 `assets/whale-icon-helper.exe` 与源码 `src/windows/WhaleDesktopIcon.cs` 保持原样。
- 前端逻辑 `src/client.js` 与 Host 调度 `src/index.js`、`src/wallpaper/*.js` 逐字节保持 `rc.34`。保留亮度 20–120、四字段预设、可读性底色 0–100、强调色与 P4 原生局部等待能力。

### 3.3 逐文件差异 (Diff)
相较于 `rc.34`，仅有 2 个文件发生受控变更：

#### (1) `package.json`
```diff
--- rc.34/package.json
+++ rc.35/package.json
@@ -3,3 +3,6 @@
-  "version": "0.6.0-rc.34",
+  "version": "0.6.0-rc.35",
+  "engines": {
+    "dsh": "0.2.0-rc.2 || 0.2.1-rc.2"
+  },
@@ -30,6 +33,6 @@
   "peerDependencies": {
-    "@deepseek-ai/dsh-client-ui-conversation": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2",
-    "@deepseek-ai/dsh-client-ui-layout": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2",
-    "@deepseek-ai/dsh-client-ui-primitives": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2",
-    "@deepseek-ai/dsh-client-ui-sidebar": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2",
-    "@deepseek-ai/dsh-client-ui-settings-general": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2",
-    "@deepseek-ai/dsh-client-ui-theme": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2"
+    "@deepseek-ai/dsh-client-ui-conversation": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2 || 0.2.1-rc.2",
+    "@deepseek-ai/dsh-client-ui-layout": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2 || 0.2.1-rc.2",
+    "@deepseek-ai/dsh-client-ui-primitives": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2 || 0.2.1-rc.2",
+    "@deepseek-ai/dsh-client-ui-sidebar": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2 || 0.2.1-rc.2",
+    "@deepseek-ai/dsh-client-ui-settings-general": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2 || 0.2.1-rc.2",
+    "@deepseek-ai/dsh-client-ui-theme": "0.1.0-rc.6 || 0.1.1-rc.1 || 0.1.1-rc.2 || 0.1.5-rc.1 || 0.2.0-rc.2 || 0.2.1-rc.2"
   },
```

#### (2) `README.md`
更新标题与说明为 `0.6.0-rc.35 DSH 0.2.1-rc.2 兼容候选（未实机验收）`，载明来源 SHA256 与变更边界。

### 3.4 新宿主接缝与虚拟模块核查
1. **浏览器虚拟模块核对**：检查 DSH 0.2.1-rc.2 的前端打包文件 `index-CN7NIWNw.js`，确认 `SZ().staticModules["@deepseek-ai/dsh-client-ui-primitives"]` 完整注册，且正常导出 `FishLogo`、图标与基础组件，未因独立 npm 目录缺失而失效。
2. **UI 模块存在性**：核对 `@deepseek-ai/dsh-client-ui-theme`、`layout`、`sidebar`、`conversation`、`settings-general` 均以 `0.2.1-rc.2` 版本随官方发布包提供。
3. **JS 语法校验**：在暂存目录对 `src/index.js`、`src/client.js`、`src/wallpaper/*.js` 执行 `node --check`，均通过。

---

## 4. U2：独立 Git Bash 预设兼容候选 (`dsh-whale-gitbash` 0.1.1)

### 4.1 源码与改动范围
- **源码位置**：`F:\deepseekharness\dsh-whale-gitbash`。
- **原归档保护**：保留原日常归档 `release/plugins/dsh-whale-gitbash-0.1.0.tgz`。
- **候选版本**：规划新版本 `0.1.1`，产物写入 `release/plugins/dsh-whale-gitbash-0.1.1.tgz`。

### 4.2 新宿主契约与标准预设比对
1. **`SandboxPwshExecutor` 类契约核对**：
   - 提取 DSH 0.2.1-rc.2 的 `@deepseek-ai/dsh-pwsh-sandbox/lib/index.js` 进行比对，其导出的 `SandboxPwshExecutor` 继承链、方法签名（`argv`、`execute`、`resolve`、`confine`）与 0.2.0-rc.2 完全一致。
   - `createGitBashExecutor` 采用的安全子类化方案在新版中依然有效。
2. **Cordis 与依赖版本**：
   - DSH 0.2.1-rc.2 官方搭载 `@deepseek-ai/cordis` 为 `4.0.5`，`@deepseek-ai/schemastery` 为 `3.18.5`。
   - 依赖声明更新为 `"@deepseek-ai/cordis": "^4.0.4 || ~4.0.5"` 与 `"@deepseek-ai/schemastery": "^3.18.1"`，在两版宿主下均能精准解析。
3. **预设组合与工具**：
   - 核对 `cordis.patch.yml` 中引用的全部 23 个官方插件/工具（包括 `dsh-persona`、`dsh-agent-instructions`、`dsh-tool-bash`、`dsh-tool-fs`、`dsh-plan-mode`、`dsh-compaction-basic`、`dsh-tool-subagent` 等），在 DSH 0.2.1-rc.2 中全部存在且版本均为 `0.2.1-rc.2`。
   - 预设使用独立的 `isolate: { shell: true }` 隔离组，不覆盖官方默认 PowerShell 模式，会话预设 ID `whale-standard-gitbash` 保持不变。
4. **安全保护边界（不变）**：
   - 坚持 Windows 受限令牌失败防御：若命令执行模式非 `danger-full-access`，严格抛出 `GitBashConfinementError` 并明确拒绝，绝不因新版本或 MSYS 启动失败而擅自提权。

### 4.3 自动化测试与验证
1. **单元测试与语法检查**：
   ```
   > dsh-whale-gitbash@0.1.1 check
   > node --check src/index.js && node --check src/executor.js && node --check src/executor-core.js

   > dsh-whale-gitbash@0.1.1 test
   > node --test tests/config.test.mjs

   ✔ MSYS drive paths convert without turning /usr into a drive (0.5987ms)
   ✔ System32 WSL launcher is rejected; Git cmd sibling is discovered (0.6614ms)
   ✔ createGitBashExecutor enforces danger-full-access confinement and resolves MSYS paths (4.0867ms)
   ℹ tests 3
   ℹ suites 0
   ℹ pass 3
   ℹ fail 0
   ℹ cancelled 0
   ℹ skipped 0
   ℹ todo 0
   ℹ duration_ms 101.1926
   ```
   3/3 测试通过，包含新增的执行器受限模式拦截断言与环境/参数解析断言。

---

## 5. U3：其余日常插件声明核验

1. **`dsh-pet` 0.3.0**：
   - 其 package.json 声明 `peerDependencies` 中所有的 `@deepseek-ai/dsh-*` 范围均为 `"^0.2.0-rc.1"`。
   - 根据 semver 规则，`^0.2.0-rc.1` 匹配所有的 `0.2.x` 预发版，且官方门禁开启了 `includePrerelease: true`。因此对 `0.2.1-rc.2` 门禁计算直接通过，无需重打包。
2. **`dsh-reasoning-effort` 0.8.0**：
   - 其声明范围同样统一为 `"^0.2.0-rc.1"`，在 `0.2.1-rc.2` 门禁计算下直接通过，无需重打包。
   - 注入的会话与模型选择槽位在 0.2.1-rc.2 前端虚拟模块中均正常存在。

---

## 6. 审计与后续步骤边界

1. **本轮保护边界**：
   - 未安装、启动、退出或重启真实 DSH / WE 进程。
   - 未修改磁盘上的官方 EXE、app.asar 或活动 Desktop Profile。
   - 用户仍在日常运行 `rc.34`，壁纸播放保持停止，无任何运行态扰动。
2. **升级前置确认**：
   - 目前已具备兼容 `0.2.0-rc.2` 与 `0.2.1-rc.2` 的双版本插件候选（U1: `rc.35`, U2: `0.1.1`）。
   - 必须等待 Codex 审计通过后，再在用户方便时通过菜单正常退出 DSH、执行关闭后全量备份，最后启动官方安装器进行升级与短验。
