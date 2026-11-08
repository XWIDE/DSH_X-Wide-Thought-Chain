# Changelog · DSH_X-Wide-Thought-Chain

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.5] - 2026-11-08

**这条标题得纠正**：本条最初写的是「设置进界面」。重启后实测**没有生效**——侧栏没有出现本插件条目。真相是：`settings.register(ns, schema)` 只让命名空间**能持久化**，**不产生设置侧栏的条目**；侧栏那一行要由插件的**客户端半部**注册进官方 `settings.section` 槽（本机样本 `dsh-ui-tools`：README:38 说 register 只管持久化、README:649＋lib/client.js:4045 显示它是 client 端注册 `settings.section`（id `dsh-ui-tools`、order 100）自己画页面；反证＝只做了 host register 的 `dsh-thinking-levels` 也不在侧栏）。本插件是纯 host 插件，所以 v0.1.5 只做到持久化那一半。侧栏条目排在 **0.1.6**（需要加 client 入口）。

**设置进界面**：v0.1.4 及之前，13 项微调只能靠工具 `dsh_xwide_thought_chain_config` 读写；现在 DSH「设置」侧栏多出一个 **X-Wide 思考链** 面板，13 项全带说明与默认值。

- `inject` 加上 `"settings"`（`index.js:24`）；装载时注册命名空间 **`xwide-thought-chain`**（＝entry id），schema 由 `SETTINGS_SCHEMA` 现场生成，每项带 `title` / `type` / `default` / `description`，`base` 取当前生效值（`index.js:208-219`）。
- 调用形状照本机实测先例 `dsh-thinking-levels/lib/index.js:344`（`settings.register(ns, schema, { base })`），不猜 API。
- 注册失败/宿主无此面 → 只打一行日志跳过，**不影响启动**（整段包在 try 里）。
- 纠正 README 的旧判断：v0.1.4 写的「宿主未向第三方插件开放 settings UI API」**是错的**，已改。
- 判据：真 import＋apply 探针 → `命名空间: xwide-thought-chain`、`表单项数: 13`、`判定: PASS`。
- 生效范围：**重启后**（新进程装载时注册）；改动只在插件目录内，未碰 profile 配置。

## [0.1.4] - 2026-11-08

**补上 bundle 装载行 `cordis.patch.yml`（插件市场静态校验要求）**：`package.json` 声明了 `dsh.bundle.patch: "./cordis.patch.yml"`，但 0.1.3 的仓库 tree 与 npm tarball 里**都没有这个文件**——市场的收录校验「检查 `dsh.bundle.patch` 字段 ＋ patch 文件在同一棵 tree 存在」必挂，而且市场安装器优先用 npm 包，装了会缺装载行。现补进包内并同步六处版本号（含 logo.svg 里的版本标）。entry id 固定 `xwide-thought-chain`，与设置页命名空间一致。

## [0.1.3] - 2026-11-08

**打包隐私修复（npm 发布前 `pack --dry-run` 抓到）**：`files` 里的 `"data/"` 会把运行时隐私件打进公开包——实测清单含 `data/backups/` 里 11 份设置备份、`data/journal.jsonl`（改动账本，含本机路径）、`data/settings.json`。现改为只发 `data/inventory.example.json`；复跑预演＝24 文件 → 干净清单。版本号三处同步升到 0.1.3（自检 C1 项）。

## [0.1.2] - 2026-11-08

### Changed（破坏性：工具改名）
- **四个工具全部改成插件名打头**，与包名 `dsh-xwide-thought-chain` 对齐（本机惯例：doctor 包的工具叫 `dsh_session_check`）：
  `xwide_thought_chain` → `dsh_xwide_thought_chain`；`xwide_selfcheck` → `dsh_xwide_thought_chain_selfcheck`；`xwide_config` → `dsh_xwide_thought_chain_config`；`xwide_rollback` → `dsh_xwide_thought_chain_rollback`。
- 起因：用户当场指出「`xwide_selfcheck`？？？？ `dsh-xwide-thought-chain` 叫这个名字呀」——名字对不上＝记不住、也搜不到。**旧名字一律失效**（systemPrompt 注入段里的工具清单同步改了）。

## [0.1.1] - 2026-11-08

### Changed
- **换上作者本人的 X-WIDE「I BELIEVE」品牌标**：新增 `assets/xwide.png`（955,078 B，方图主标）与 `assets/xwide-avatar.png`（201,601 B，圆形头像标），README 顶部改用主标；原手绘链形标保留为 `assets/logo.svg`（矢量小标，带版本戳）。README 新增 §11 说明三个标各用在哪。

## [0.1.0] - 2026-11-08

首个可发布版本。

### Added
- **思考链工具 `xwide_thought_chain`**：六步链（冻结事实 → 量真形状 → 最小复现 → 单变量对照 → 判定器 → 交活闸），可按设置只启用其中几步。
- **零依赖开机自检 `xwide_selfcheck`**：C1 版本三处一致 / C2 自家源码零死路径 / C3 装载自检（真 `import` + 桩 `ctx.apply`）/ C4 配方清单缺件 / C5 安装路径漂移扫描 / C6 崩溃日志通道新鲜度。同一份内核也能命令行直跑：`node lib/selfcheck.mjs [--json] [--deep]`。
- **微调设置 `xwide_config`**：13 项参数，每项带说明；`show=true` 原样打印全部项与当前值。
- **退回机制 `xwide_rollback`**：每次改设置先写 `data\backups\settings.<时间戳>.json`，改动记进 `data\journal.jsonl` 账本；`restore=true` 一键退回上一份，退回前状态再存一份（可反复来回退）。
- 文档：README（含逐项设置表、装法、卸载、崩溃日志通道）、CHANGELOG、LICENSE(MIT)、`assets/logo.svg`、`data/inventory.example.json` 配方模板、`install.patch.yml` 装载片段模板。

### Security
- 默认 `safety.allowMutate=false`：自检只报问题 + 给命令，不自动改任何文件。
- 写盘范围只有插件自己的 `data\` 目录；profile 配置一律只读。
- `apply()` 全程 try/catch，自检失败不阻塞 DSH 启动。
