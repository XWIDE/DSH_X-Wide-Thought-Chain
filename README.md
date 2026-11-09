![X-WIDE · I BELIEVE](./assets/xwide.png)

# DSH-X-Wide-Thought-Chain · `dsh-xwide-thought-chain` v0.1.12

> 把一条排障/交付的**思考链**装进 DeepSeek Harness，外加一个**零依赖开机自检**：DSH 升级、安装目录改名、插件丢失时，不再靠人肉从头摸形状。

- 原创设计 & 维护：**XWIDE** — <https://github.com/XWIDE/DSH_X-Wide-Thought-Chain>
- 许可：**MIT**（见 [LICENSE](./LICENSE)，含署名说明）· 变更历史见 [CHANGELOG.md](./CHANGELOG.md)
- **运行时零依赖**：`package.json` 无任何 `dependencies`——宿主侧只用 node 内置模块（`node:fs` / `node:path` / `node:url`），设置页只用浏览器 `fetch` ＋宿主提供的 React（`require("react")`）。**不需要装本仓库以外的任何插件，也不依赖本机那些守卫/记忆插件**；本地模型与云模型同用。
- **依赖边界（发布时说明清楚）**：本插件只读写**自己目录内**的文件（`data\settings.json`、`data\backups\`、`data\journal.jsonl`、`data\presets.json`、`data\boot.log`）。设置页里的「速度体检」「说明书」是**只读**面板：会读 profile 的 `cordis.patch.yml` 与工作区规则文件的**存在性与行内容**来报路径，绝不写它们；跨插件（守卫、记忆按需注入、hindsight、weknora）本版**不读写、不联动**。设置页要重启 DSH 才装载（web 侧在启动时组包）。

---

## 1 · 为什么要有它（真实病例）

本机 DSH 从 `DSH NEXT` 改名为 `DeepSeek Harness` 之后：

- 十几个脚本里写死的旧安装路径全部**静默失效**——工具返回「(无输出)」，不报错、不留日志；
- 判定器/交活闸丢了一批，**5 天没人察觉**；
- 人格预设 id 改名导致 300+ 会话的人格指针**静默失效一个月**。

这三类病的共同点：**漂移是静默的**。所以本插件做两件事：

1. 把「怎么想」固化成六步链，逼着先量再改；
2. 每次开机/升级后跑一遍自检，让漂移当场变红字。

## 2 · 六步思考链（`dsh_xwide_thought_chain`）

| 步 | 名称 | 要做的事 |
|---|---|---|
| ① | 冻结事实 | 两栏写清：已有读数（带来源）／还缺什么读数。**这步不许立假设** |
| ② | 量真形状 | 探针打印真实结构（API 存在性 / 对象键 / 行数 / 字节数）。**猜出来的字段名不许进下一步** |
| ③ | 最小复现 | 能稳定复现故障的最短命令 + 落盘读数。复现不了＝假设没成立 |
| ④ | 单变量对照 | 一次只改一个变量，A/B 各跑一次，贴两次读数 |
| ⑤ | 判定器 | 先写下能判红绿的脚本再动手。**判定器没说 OK 不许说「修好了」**；绿灯只证明管道通，不证明好用 |
| ⑥ | 交活闸 | 四件套：改动:行号 ／ 备份路径 ／ 回滚命令 ／ 判定器原文 ＋ 一条否定证据 ＋ 一句「这次没验到什么」 |

附带两条红线（写进输出里，不靠自觉）：**同一假设连败 N 次＝停手重列全景**（禁叠第 N+1 次）；**状态词只有你自己量过才许说**，量不到就直说「量不到」。

## 3 · 开机自检（`dsh_xwide_thought_chain_selfcheck`）

| 项 | 查什么 | 为什么要查 |
|---|---|---|
| C1 | 版本三处一致（`package.json` / `index.js` / `CHANGELOG.md`） | 发布纪律：改了代码忘了 bump 版本，现场就无法对账 |
| C2 | 自家源码零绝对路径字面量 | 本包自己吃自己的药——写死安装目录就是上面那些病例的根 |
| C3 | 装载自检：真 `import` 本包并对桩 `ctx` 跑一遍 `apply` | 语法过≠装载过；装载过≠跑得动 |
| C4 | 配方清单缺件（按 `data/inventory.json` 逐条 `existsSync`） | 把"我依赖哪些插件"变成机器可查的表，丢了当场报 |
| C5 | 安装路径漂移扫描（扫源码里的盘符字面量，逐个查存在性） | 改名/搬家后第一时间发现静默失效 |
| C6 | 崩溃日志通道新鲜度 | 启动时 stdout/stderr 没被收走，插件就永远看不到崩溃行 |

命令行也能跑（不装插件也能用）：

```bash
node lib/selfcheck.mjs          # 人读红绿表
node lib/selfcheck.mjs --json   # 机器读
node lib/selfcheck.mjs --deep   # 连 profile 的 local-plugins 一起扫路径漂移
```

输出末行是 `SELFCHECK = PASS n/n` 或 `SELFCHECK = NOT-PASS n/n`（退出码 0/1，可进 CI）。

## 4 · 微调设置（`dsh_xwide_thought_chain_config`，每项带说明）

调用 `dsh_xwide_thought_chain_config(show=true)` 会原样打印下表。存盘位置：插件目录 `data/settings.json`；profile 的 `config` 段可覆盖同名项（优先级：patch config > settings.json > 默认值）。

| 键 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `chain.steps` | string | `"1,2,3,4,5,6"` | 启用哪几步。只跑取证段填 `"1,2"`；跳过复现填 `"1,2,4,5,6"` |
| `chain.maxFindings` | number | `12` | 一次自检最多报几条，防刷屏（1–30；实测每条约 130 字，12 条≈780 token≈10 秒） |
| `chain.stuckAfterFailures` | number | `2` | 同一假设连败几次触发停手（1–5） |
| `selfcheck.pathDrift` | bool | `true` | 开关 C5 路径漂移扫描 |
| `selfcheck.scanDirs` | string | `""` | 额外扫描目录，分号分隔；留空＝插件自身（`--deep`/`deep=true` 时加扫 local-plugins） |
| `selfcheck.inventoryFile` | string | `"inventory.json"` | 配方清单文件名（`data\` 下） |
| `selfcheck.staleLogHours` | number | `72` | 崩溃日志超过多少小时算陈旧；`0`＝不查 |
| `prompt.enabled` | bool | `true` | 是否向 systemPrompt 注入这条链的一句话提醒 |
| `prompt.order` | number | `138` | 注入段顺序（越小越靠前） |
| `prompt.maxChars` | number | `700` | 注入文本上限，省上下文 |
| `write.journal` | bool | `true` | 改动是否记进 `data/journal.jsonl` 账本 |
| `write.maxBackups` | number | `10` | 设置历史备份保留几份（1–50） |
| `safety.allowMutate` | bool | **`false`** | 总开关。`false`＝自检只报问题＋给命令，绝不自动改文件 |

改法：`dsh_xwide_thought_chain_config(set="chain.stuckAfterFailures", value="1")` —— 当场生效，并先写备份。

### 4.1 · 界面里的调法（v0.1.9，设置中心 →「X-Wide 思考链」）

**四个分类**（页面按类分块，每项写明它属于哪类、改了影响什么）：① 思考链本体 ② 开机自检·看守 ③ 注入与开销 ④ 写入与退回。

**四组预设档位**——一次点一下，把上面四类一次配好（数值来自本机实测：decode 80.2 tok/s、冷 prefill 112.8 tok/s、前缀缓存命中约 90%、xhigh 8192 token ≈ 102 秒/轮）：

| 档名 | 配了什么 | 什么时候用 |
|---|---|---|
| **本地模型·省上下文** | 注入段 420 字、回显 6 条、六步全开、记账本开 | 日常推荐 |
| **快** | 注入段关（工具仍在）、只跑取证四步、回显 4 条、跳过陈旧日志检查 | 赶时间 |
| **准** | 六步全开、回显 12 条、注入段 900 字、记账本开 | 动真实文件／改配置那一刀 |
| **排障** | 连败 1 次就转 STUCK-5、回显 12 条、深扫路径漂移 | 突然卡在一个点 |

再加 **「把这组当前值存成档位」**：自存档位写进 `data/presets.json`，可一键应用、可删；内置四组不可覆盖。每次应用档位＝先备份再批量写，`dsh_xwide_thought_chain_rollback(restore=true)` 照旧退回。

**滑条**：六个数字项（回显条数 1–30、失败阈值 1–5、注入字数 100–1500、注入顺序 0–999、备份份数 1–50、陈旧日志 0–336 小时）拖滑块带实时数值与区间，**松手才写盘**（不是一路刷爆备份）。

## 4.2 经验库：让它记住「做错→做对」（v0.1.12）

插件带一份 **`lib/lessons.json`**：把历次真返工蒸成一条条规则，每条都写清 **触发条件 / 当时做错的 / 后来做对的 / 实测读数**。随包发布、只读，卸载随包走。

- **每轮开工就带着**：默认注入前 6 条到 systemPrompt（单独一段，不占六步那段的字数预算）。可调：`prompt.lessons=false` 关掉；`prompt.lessonsCount` 0–12 决定注入几条。代价标在说明里——每条≈40 字（约 20 token），6 条≈120 token，本机冷 prefill 112.8 tok/s ⇒ 一轮约多 1 秒；前缀缓存命中时几乎免费。
- **看得见**：设置页有一栏「这一版学到的规则」全量列出；面板「怎么运作 · 记忆在哪」也会打印它的路径与条数（读不到会明说）。
- **它记的是方法不是聊天记录**：例——「显示类交付只认渲染证据，宿主 API 调用成功≠界面存在」「顶层函数不许偷外层作用域的 config」「每类备份独占文件名前缀，写完回滚功能必须连退两次验一遍」「发布从干净暂存副本发，判定器＝pack 清单里备份数=0」「状态词只认自己量到的远端读数，工具自报的成功不算数」。

**排版与配色（v0.1.10）**：整页间距 34px、分类之间 22px＋分隔线、每项上下 10px、说明行距 1.7——不挤。四组档位用颜色一眼分开：**省＝绿**（`--dsw-alias-state-success-primary`）、**快＝蓝**（`--dsw-alias-brand-primary`）、**准＝琥珀**（`--dsw-alias-state-warn-primary`）、**排障＝红**（`--dsw-alias-state-error-primary`），自存档位随正文色；全部走宿主主题变量，深浅主题都由宿主给对比度。兜底色实测对深色底 5.45–5.98:1（WCAG 门槛 4.5）。

**两个只读面板**（都不写任何文件）：
- **速度体检**——读 profile 里 `reasoningEffort` / `maxTokens` 的当前真值＋行号，算出本插件自己占多少秒，并写明「慢的大头是输出量×轮数」和「要动模型档位＝改启动关键文件，本插件不代改」。
- **怎么运作 · 记忆在哪 · 怎么守住之前犯过的错**——列出本插件自己的值/备份/账本/档位/装载读数的真路径（逐个实测存在性），以及守错机制在哪：工作区 `错题本.md`（状态=硬线 的行每轮注入）、`沟通词典.md`、`卡点卡.md`、`规则书\卡点协议.md`；跨会话记忆用 `soul_recall(query=…)`／`cg(op="read", query=…)` 查。机制一句话：**你纠正我 → 当场往错题本/沟通词典各追加一行 → 第二次重犯就升成硬线**，所以同一个错只允许犯两次。这些文件本插件只报路径与用法，不读写。

## 4.3 规则库网上备份与发布（v0.1.13）

你的 `AGENTS.md`／沟通词典／错题本／尺子／规则书**不在插件包里**——它们是你工作区里的普通 md。这一节解决两件事：**换机器能拿回来**，和**你愿意时把方法送人**。

| 按钮（设置页第⑤组） | 干什么 | 硬闸 |
|---|---|---|
| 看漂移 | 列工作区与上次快照差哪些文件 | 只读 |
| 备份到私有仓 | 复制进插件目录 `data\rules-private` 并 git 提交＋打 tag＋推送 | **不写你工作区**；没配仓地址＝只本地提交，零上传 |
| 标记这次是好状态 | 记一条 good 记录（勾） | 发公开库的前置条件 |
| 把这份存到公开库 | 只发白名单里的方法文件 | ①必须先勾好状态 ②必须再点一次确认 ③**脱敏扫描零命中**才发；扫不过一个字节都不传 |
| 从私有仓拿回来 | 按快照清单写回工作区 | 每个原件先 `.bak-时间戳`；逐文件 sha256 对得上才写 |

**没有任何自动同步**：git 只在你点按钮／显式调工具时跑。插件不挂 hook、不定时任务。

默认白名单（公开库）：`AGENTS.md`、卡点卡、症状卡、排障方法卡、动作一本通、短卡、交活自检清单、防修坏护栏 ＋ 尺子／规则书／契约卡 三个目录。**默认不含**错题本、沟通词典、本机工具箱、数据源地图、耗时台账、运作体系——那些是你的原话和病例，只进私有仓。

脱敏扫描内置查：盘符绝对路径、`Administrator`、npm/GitHub 令牌、密码/密钥字面、邮箱、手机号，外加 `rules.scanExtra` 自定义词。命中就拒绝发布并打印命中的文件与类型。

工具：`dsh_xwide_thought_chain_rules(op=status|snapshot|good|publish|restore|list-good)`；`publish`/`restore` 必须 `confirm=true`。
设置：`rules.privateRepo` / `rules.publicRepo` / `rules.files` / `rules.dirs` / `rules.publicFiles` / `rules.publicDirs` / `rules.scanExtra` / `rules.publicVersion` / `rules.gitExe` / `rules.workspace`。

判定器：`_rules_backup_harness.mjs`（本地假远程跑全回路：备份→tag 真上远程→漂移→恢复带 .bak→没勾拒发→含私货拒发且零上传→清干净才发→快照≠勾的那份拒发），实测 **19/19**。

## 5 · 退回机制（`dsh_xwide_thought_chain_rollback`）

- 每次改设置前，先把当前 `settings.json` 复制到 `data/backups/settings.<时间戳>.json`；
- 改动记进账本 `data/journal.jsonl`（`{ts, kind, key, from, to, backup}`）；
- `dsh_xwide_thought_chain_rollback(restore=true)` → 退回上一份；退回前的状态**再存一份**（`settings.pre-rollback-*.json`），所以能来回退；
- `dsh_xwide_thought_chain_rollback(list=true)` → 看账本，谁在什么时候把什么从什么改成什么。

**写盘范围只有插件自己的 `data\` 目录。** profile 配置、宿主文件一律只读；自检发现问题只打印处方命令，默认一条都不执行。

## 6 · 装它

### 方式 A · 本地插件目录（推荐，零 npm）

1. 把本目录放到 `<profile>/local-plugins/dsh-xwide-thought-chain/`
2. 在 profile 的 patch 配置里加一行装载（完整步骤与注意项见 [install.md](./install.md)）：

```yaml
  - insert: './local-plugins/dsh-xwide-thought-chain/index.js'
    id: xwide-thought-chain
    type: module
```

3. **重启 DSH**（插件在启动时装载，改代码不重启不生效）。
4. 验证：让助手跑 `dsh_xwide_thought_chain_selfcheck`，末行应出现 `SELFCHECK = PASS 6/6`。

> 注意：patch 是启动关键文件。**先备份再改**，一次只加这一行；改完重启前跑一遍语法/装载校验。这行加坏了 DSH 起不来——本插件不碰它，也不该由插件碰。

### 方式 B · npm 包名发布后安装

```bash
npm i dsh-xwide-thought-chain
```

（发布后生效；作用域包名同理，小写连字符。）

## 7 · 卸载 / 回滚

- 删掉 patch 里那一行（或用安装前的备份覆盖回去）→ 重启 → 插件消失；
- 想连数据一起清：删插件目录里的 `data/`（设置、账本、备份都在里面，插件本体不含用户数据）。

## 8 · 崩溃日志通道（C6 检查的东西）

DSH 作为 Electron 主进程启动时，如果 stdout/stderr 没被收进文件，插件永远看不到 `failed to apply loader entry …` 这类崩溃行。做法：用一个把输出重定向到 `<用户目录>/logs/harness.log` 与 `harness.err.log` 的启动器启动 DSH，然后 `dsh_xwide_thought_chain_selfcheck` 会告诉你这通道是不是新鲜的。

## 9 · 兼容与限制（说清楚，别让人踩坑）

- **零运行时依赖**：不需要任何其他插件、服务、Python、网络。
- 自检 C5 只能发现**源码里写死的盘符路径**指向不存在的位置；它不能替你猜新路径该是什么（处方只给方向）。
- C3 装载自检用桩 `ctx`（只实现 `tools.register` / `systemPrompt.section`），所以它证明"apply 不抛错、工具形状合法"，不证明宿主全部 API 行为。
- 设置怎么改（三处，改的是同一份 `data/settings.json`）：① DSH「设置」侧栏里的 **X-Wide 思考链**页（v0.1.6 起：13 项表单，值走 `POST /api/xwide/settings` 落盘并留备份）；② 工具 `dsh_xwide_thought_chain_config`（当场生效、自动备份、`..._rollback` 退回）；③ profile 的 `cordis.patch.yml` 里本插件的 `config:` 段写同名项，重启生效（优先级最高，会盖住前两者）。
- 为什么 v0.1.5 那版没有界面条目（留档，别再踩）：host 侧 `settings.register` **只让命名空间能持久化**，侧栏条目必须由**客户端半部**注册进官方 `settings.section` 槽才出现——v0.1.6 补的就是这一半。客户端装载发生在启动时，所以**加了 client 入口后必须重启 DSH** 才看得到那一行。
- Windows 为主开发/实测；macOS/Linux 未测。

## 10 · 版本策略

语义化版本：破坏性改动 → 主版本；新工具/新设置项 → 次版本；修 bug → 修订号。**三处版本号必须一致**（C1 会自动抓）。改动记进 [CHANGELOG.md](./CHANGELOG.md)。

## 11 · 品牌标（三个文件，都是 XWIDE 原创）

| 文件 | 是什么 | 用在哪 |
|---|---|---|
| `assets/xwide.png` | **X-WIDE「I BELIEVE」品牌主标**（蓝→品红渐变晶体 X + 字标，方图白底） | 本 README 顶部、GitHub 仓库首页 |
| `assets/xwide-avatar.png` | **圆形头像标**（同款 X，圆底裁切） | GitHub/插件市场头像位、任何需要圆形的地方 |
| `assets/logo.svg` | 链形小标（六节点 + 加宽箭头 + 版本戳） | 插件内嵌/图标位（矢量、体积小、带版本号） |

---

原创设计：XWIDE · MIT · v0.1.10
