# Changelog · DSH_X-Wide-Thought-Chain

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.28] - 2026-11-16

体检闸三处按用户反馈修对：说明写清真话、加总开关（默认开）、扫描启动列表筛垃圾。
- **作用①扫描范围扩到真·开机面**：`bootcheck.mjs` 从「只扫本插件目录」改成扫 profile 的 `local-plugins` 根下【全部插件】的 `.js/.mjs/.cjs`（路径从自身位置派生，零绝对路径字面量）。实测一次扫到 **14 个插件 / 27 个文件全过**——这才对上「防写坏 DSH 到开不了机」的原意（DSH 启动装载的就是这一坨，任何一个语法炸下次就开不了机）。
- **说明写对**（用户原话：「说明没什么意义…要写清楚扫哪些文件、防什么」）：界面文案 + 后端注释都改成点名「扫 local-plugins 全部插件语法」「tail harness.log 崩溃签名」「绿了才提示可重启」。
- **加总开关 `bootcheck.enabled`（默认 true）**：不勾＝整块隐藏、零开销（平时不扫不跑，只在点「跑体检」那刻动）。后端路由关掉时直接拒绝跑。
- **扫描启动列表筛垃圾**（用户原话：「过滤里还是很多没用的东西，不好用」）：`scan-launchers` 默认筛掉 `uninstall/setup/install/readme/copy/backup/update/version/selftest/doctor/status/stop/kill/shutdown/reboot/cleanup/reset` 这类明显不是启动器的项；「含杂项」勾选＝逃生门（连 `.ps1/.lnk` 一起列、且不筛垃圾全给你看）。
- **发布前脱敏**（发公开仓/npm 前扫出的作者机器私货）：用户可见文案里的示例路径 `F:\Strata-0.1.13`、`F:\...\run-swift-iq3_s.bat` 等 5 处换成中性占位符（`<你的启动器目录>`／「你的启动器文件夹全路径」），涉及 [index.js](index.js)、[lib/client.js](lib/client.js)、[lib/watchdog.mjs](lib/watchdog.mjs)。附带把开机自检 C2「自家源码零死路径」从 NOT-PASS 修成 PASS（现 7/7 全绿）。

## [0.1.27] - 2026-11-16

把「哨兵」按用户澄清的两个真作用重做：① 保本地模型（看门狗，已有，实测在跑）② 防写坏 DSH 到开不了机。删掉造歪的「裸起 DSH 体外哨兵」。
- **新增 `lib/bootcheck.mjs`「重启前体检闸」**（作用②）：点一下跑两道关——(1) 用宿主自带 node 对插件全部 `.js/.mjs` 跑 `--check`（任一不过＝下次装载必炸）；(2) tail `harness.log` 扫已知装载崩溃签名（plugin tree failed to load / failed to apply loader entry / duplicate loader entry id / Cannot find module / SyntaxError）。全绿才提示「可以重启」。零依赖、零绝对路径字面量、只读不碰活的 DSH、不自动扫。
- **接线**：index.js import 由 sentinel 换 bootCheck + `bootcheck` action；client.js `WdSentinelRow` → `WdBootCheckRow`（跑体检测验按钮＋判定行）。
- **退役**：`lib/sentinel.mjs` 改名 `sentinel.mjs.retired-2026-11-16` 保留不硬删（bootcheck 的 walkJs 不匹配该扩展名，语法关不受影响）。作用①看门狗 `watchdog.mjs` 原样保留（实测 watchdog.log 有 heartbeat，在盯 8080）。

## [0.1.26] - 2026-11-16

新增「DSH 体外哨兵」：插件死在 DSH 里救不了 DSH，装一个开机自启计划任务当体外哨兵，DSH 主进程没了就裸起它。
- **新文件 `lib/sentinel.mjs`**：动态认 DSH（问 OS「我父进程的 exe 是哪个」，零写死名字/路径）→ 生成脚本 → 注册/注销计划任务 `DshSentinel` → 读状态+日志尾。bundled 脚本 param 默认全空、真值由计划任务当参数传入（源码零绝对路径字面量）。
- **安全**：幂等（count==0 才拉起）＋冷却＋每小时上限防重启风暴＋`.off` 停用开关；DryRun/MaxLoops 供判定器验。
- **接线**：index.js 加 import + `sentinel-install/uninstall/status` 三 action；client.js 加 `WdSentinelRow` 组件（安装/卸载按钮＋状态＋日志尾），挂在运行引擎选择器后。
- **修**：日志函数起名 `SL` 撞 PowerShell 内置别名 `sl`(Set-Location，别名优先级压过函数)→全文炸 PathNotFound；改名 `Write-SLog`。`Test-Path $OffFlag` 补空串守卫。

## [0.1.25] - 2026-11-16

修「选不上」根因：`watchdog.launcher` 之前没进 SETTINGS_SCHEMA。

- **根因**：index.js `setSetting` 用 `SETTINGS_SCHEMA.find(m=>m.key===key)` 白名单校验，非 schema 键直接 `return {ok:false,"没有这个设置项"}`；勾选框写 `watchdog.launcher` 被后端拒 → 界面永远显示没勾上＝「选不上」。同时 `loadSettings` 只遍历 schema，该键永不出现在回传 cur 里。
- **修**：schema 补一行 `{ key:"watchdog.launcher", type:"string", group:"watchdog", def:"" }`（正常显示，不标 advanced）。
- **加常驻「已锁定拉起：xxx」行**：读 watchdog.launcher，独立于过滤/勾选清单——过滤把锁定的筛没皮也看得见，带「清除锁定」按钮直接解。

## [0.1.24] - 2026-11-16

启动器选择改成「可见勾选清单」＋「过滤」框（用户：只显示有用的／实在不放心给个显示的勾选）。

- **下拉 select → 勾选清单**：扫出的每项一行 checkbox，点谁锁谁（写 watchdog.launcher），当前活模型行带 ←当前模型，已锁的带（已锁定拉起）；容器 maxHeight 300px 可滚。
- **过滤框**：纯前端子串筛（不分大小写，空＝全列），打字即时生效不重扫；筛没了提示「改改字或清空」。
- 放弃「按内容嗅探自动挑」：实测 14 个 .bat 里嗅探 KEEP 5 个但把 `切到-UD.bat`/`切到-IQ3_S.bat`（间接启动器，调 stop-all-engines.ps1 + start run-*.bat）DROP 了——插件不猜名字、不猜内容，列表由过滤框交给用户。

## [0.1.23] - 2026-11-16

扫描启动器默认只显示 .bat/.cmd（42 项里大半是 ADOPT/BENCH/FIX 等 .ps1 杂项，列表太长难挑）。

- **修法**：index.js scan-launchers 按 `body.all` 分档——不传/假＝只列 `.bat/.cmd`；`all:true`＝连 `.ps1/.lnk`。client.js 加「含杂项（.ps1/.lnk）」勾选（默认不勾），传给后端。只按扩展名过滤，不写死任何文件名（插件名无关纪律不变）。

## [0.1.22] - 2026-11-16

修「启动器下拉展开后字看不见」（深色主题下原生 select 列表是白底＋浅灰字，只有高亮行能读）。

- **修法**：给 `WdLauncherPicker` 的 `<select>` 和每个 `<option>` 强制 `background:#fff; color:#111`（黑字白底），不随深色主题走灰。

## [0.1.21] - 2026-11-16

修「扫描启动器报 `readActiveModel is not defined`，下拉点不开」。

- **根因**：index.js 第 447、598 行调用 `readActiveModel(port,{})`（扫启动器时读当前活模型），但顶部 import 只带了 `createWatchdog`，没带这个函数 → 运行时 ReferenceError → 扫描整体抛异常 → files 为空 → 下拉保持禁用。
- **修法**：line 23 import 补成 `import { createWatchdog, readActiveModel } from "./lib/watchdog.mjs"`（`readActiveModel` 在 watchdog.mjs:27 确为 export）。一行。

## [0.1.20] - 2026-11-16

「运行引擎」选择器搬到**页面最前面** + 修「扫描目录打字不生效」。

- **搬家**：运行引擎选择器从 watchdog 组内（maxPerHour 行下方）移到页面最顶部（scope 行之后、自学习工具条之前）。用户原话「他就应该是在最前面，不是埋在看守/看门狗那块」。标题改「运行引擎 · 思维链跑在哪个后台模型上」（去掉「看门狗拉哪个模型」的局部措辞）。
- **修真 bug**：扫描目录输入框旧版 `onChange` 是空函数 `(e)=>{}`，只在 `onBlur` 落盘——打字时 React 受控值弹回空，看着像填了、点扫描却说「先填扫描目录」。改成**本地状态即时接管 + onChange 当场落盘**，占位符文案写明「灰字只是示例不算填」。
- **语义如实标注**：说明里写清这选的是「崩了拉起谁＋高亮当前活模型」，切换正在跑的模型本身在启动表/端口那边做，界面点不动——不夸大成一键切换。
- 名字无关纪律不破：扫描目录由用户填、不写死任何绝对路径；模型 id 来自运行时 `/v1/models`。

## [0.1.19] - 2026-11-16

看门狗设置面板**精简 + 重做运行引擎选择**（用户原话「整体设计过于复杂，只暴露我调节有用的东西，要有详细说明往哪调会怎样」「扫描后旁边应该可以选择我启动的哪一个，不勾＝自动选」）。

- **运行引擎总开关** `watchdog.manualLock`（默认 false＝自动）：不勾＝看门狗自己从 `/v1/models` 认当前活模型，啥都不用选；勾上＝手动锁定，才出扫描区，下拉**常驻显示**（没扫时灰着写「先点扫描」），扫完旁边即可选 → 选中即锁死拉起它。修旧版「下拉扫完才出现、还挤在按钮行里看不见」。
- **面板分层**：标 `advanced:true` 的 8 项（port/downChecks/logPath/dryRun/modelLaunchers/localRouteOnly/scanDir/autoScan）收进「高级设置（N 项，一般不用动）」折叠，默认收起；只露 enabled / intervalSec / cooldownSec / maxPerHour / manualLock。
- **详细调节说明**：露出的每个数值项说明都补「往小调怎样 / 往大调怎样」（如 intervalSec 往小＝发现快恢复快但探测频，往大＝省开销但崩了慢发现）。
- 布局前序修正：状态读数移进档位组红框位、删 watchdog.launcher 独立行、扫描选择器顶到其原槽位。
- 名字无关纪律不破：不假设引擎名、不写死路径，目录用户填、模型 id 来自 `/v1/models`、启动器路径下拉选。源码零绝对路径字面量。

## [0.1.18] - 2026-11-16

看门狗设置面板加**扫描启动器 + 下拉挑**（用户原话「扫描出来我有几个启动，让他自己选」），并修「状态反馈跑到页尾看不见」。

- 新工具 `dsh_xwide_thought_chain_watchdog_scan`：给目录扫 `.bat/.cmd/.ps1/.lnk` + 读当前活模型 id，吐出可粘进 `watchdog.modelLaunchers` 的候选清单（只读、不拉起引擎）。
- 设置面板 watchdog 组内嵌选择器 `WdLauncherPicker`：**扫描目录**输入框 + **「扫描启动器」按钮**（点一下才扫）+ 扫完出**下拉**挑启动器写进 `watchdog.launcher`。新勾项 `watchdog.autoScan`（默认 false＝不每次进页都扫盘，省性能；勾上＝进页自动扫一次）；新填项 `watchdog.scanDir`。
- 宿主侧新 HTTP 动作 `scan-launchers`（走既有 `/api/xwide/settings` 通道，鉴权在内核）。
- 界面小修：档位/保存的状态读数从页尾挪到页首工具条下方（用户「不应该放到最下面」，点完档位滚到底才看见＝没用）。
- 名字无关纪律不破：插件不假设引擎叫 ollama/lmstudio/Strata，不写死任何启动器路径——目录由用户填、模型 id 来自运行时 `/v1/models`、启动器路径由下拉选。源码零绝对路径字面量。

生效范围＝**重启 DSH** 装载（改了 client.js 界面半部 + index.js 路由/schema）。判定器：`node --check` 三文件 exit=0；宿主 scan 动作对作者的启动器目录实测列出 bat 数与活模型 id；DOM 可见性需重启后在页面点按钮验（语法通≠看得见）。

## [0.1.17] - 2026-11-16

看门狗加**自发现选模型**：不再写死一个启动器，治「watchdog 对 UD-Q4_K_XL 没作用」+「切模型后恢复成错模型」。

- 健康期每次 tick 顺手读 `http://127.0.0.1:<port>/v1/models`，记下当前活模型 id（取**主 id 不取 alias_of 别名**——本机实测主 id=`swift-1.5-iq3_s`、UD 是它的 alias，故映射按主 id 匹配绕开别名坑）。DOWN 时按新设置 `watchdog.modelLaunchers`（JSON 对象 `{模型id: 启动器绝对路径}`）选对应模型的启动器拉起；表里没有的模型退到 `watchdog.launcher` 兜底。
- 新设置 `watchdog.localRouteOnly`（默认 true）：**云端路由休眠闸**——读 `cordis.patch.yml`，只有当聊天 baseURL 指向本地 `localhost/127.0.0.1:<本端口>` 时才看守；切到云端模型（baseURL 不是本地该端口）自动休眠，不误重启你没用着的本地引擎。读不到 cordis 时保守当作本地（保持看守）。
- 名字无关设计：插件不假设对方用 ollama/lmstudio/Strata，也不假设启动器文件名——守哪个端口来自 cordis 的 baseURL，模型 id 来自运行时 `/v1/models`，启动器路径由用户在自己机器的设置里填，源码零硬编、零绝对路径字面量。
- 实测判定器：对本机活 8080 → `probePort=true`、`readActiveModel="swift-1.5-iq3_s"`（主 id）、映射命中 `run-swift-iq3_s.bat`；`node --check` 两文件 exit=0。

## [0.1.16] - 2026-11-16

新增 **⑥ 8080 看门狗**（把「之前那个真有作用的看门狗」`_strata_watchdog.ps1` 的核心逻辑移植进插件，不是空壳）：

- 新内核 `lib/watchdog.mjs`，逐条搬原脚本判据：真 TCP 连接探活 → 连续 `downChecks` 次确认才算 DOWN → 冷却 `cooldownSec` + 小时上限 `maxPerHour` 防重启风暴 → 跑启动器并记下它吐的行 → 重启后等 20s 复验端口（OK/PENDING）→ 双日志路径。铁证＝`F:\Strata-0.1.13\strata-watchdog.log` 2026-11-04 多次 DOWN(2/2)→RESTART→back up。
- 与 C7 的分工：**C7 自检内核保持「只检测不重启」**；本模块是**独立的、默认关闭的** opt-in 看守，只在 `watchdog.enabled=true` 时由 `apply()` 起一个 `unref` 定时器周期调用。开启＝显式授权插件在引擎崩了时自动重启 8080（自杀红线：会杀当前聊天后端），故默认 false，且 `dryRun` 可先验判据不惊动引擎。
- 源码零绝对路径字面量：启动器 / 日志路径全从设置来，本机值写在 `data\settings.json`。
- 新设置组 `watchdog`（enabled/port/intervalSec/downChecks/cooldownSec/maxPerHour/launcher/logPath/dryRun）。

生效范围：所有使用者；需**重启 DSH** 装载。判定器：`node --check index.js` 绿；对本机活 8080 调探活返回 true；`watchdog.enabled=true` 后 boot.log 出现「看门狗已启动」行。

## [0.1.15] - 2026-11-16

新增 **C7 路由端口对账**（看门狗判据搬进插件）：把外部 `_strata_guard_once.ps1` / `_strata_watchdog.ps1` 的核心判据——「profile 的 `cordis.patch.yml` 里 baseURL 写到的 localhost 端口，必须真有人 TCP 监听」——移植成自检内核的第 7 项。病例＝2026-11-16 那次 baseURL 被指到没人监听的 8090，引擎一直在 8080 好着，DSH 连不上却没有任何自检能发现。

- 读 `../cordis.patch.yml` 的 baseURL，抽出所有 `localhost/127.0.0.1:<port>`，逐个用 `node:net` 真连一次（3 秒超时），任一端口连不上＝报红，处方给启动表命令。
- **只检测不重启**：常驻循环会卡死宿主、自动重启违反自检内核「只报不改」纪律，故这两条留在外部的计划任务里。
- 新设置开关 `selfcheck.routePort`（默认开）。因走命令行入口，计划任务在 DSH 进程外也能跑同一份内核。

生效范围：所有使用者；需**重启 DSH** 装载。判定器：`node lib/selfcheck.mjs` 出现 C7 行，当前 8080 活→绿，临时指错端口→红。

## [0.1.14] - 2026-11-09

只改**对外可见的措辞与默认值**（功能零改动）——上一版第⑤组是照作者个人写的，别人装上会看不懂：

- 栏目标题去掉「你的命根子／你送人的方法」→ 「私有仓＝自己的备份；公开仓＝你愿意分享的方法」（中英各一份）。
- `rules.scanExtra` 默认从作者的机器专属词（`<项目名>,<安装目录名>,<端口>`）**改成空**：那三个名字是作者机器上的项目名/目录名/端口，别人装上等于白扫。要用的词请自己填（作者本人的已写进他自己的 `data\settings.json`，扫描行为不变）。
- 设置说明与说明书里的速度数字统一标注为**作者机器实测**（decode 80.2 tok/s、冷 prefill 112.8 tok/s），并指向面板「速度体检」自量——不再冒充通用值。
- 文件/目录白名单说明写明：**默认值是示例文件名**，使用者按自己工作区增删；含个人病例与原话的文件建议只进私有仓。
- 「怎么守住之前犯过的错」那段补一句：这些规则文件不在包里，标「读不到」＝这台机器没这套文件，工具与自检照常用。

生效范围：所有使用者；需**重启 DSH** 装载（设置页文案与默认值随插件走）。判定器三层全绿见交付报告 §38。

## [0.1.13] - 2026-11-09

新增「规则库网上备份与发布」：把你的 `AGENTS.md`／词典／错题本／尺子／规则书按你点按钮的方式备份到**私有仓**，勾了「我认为这是好状态」才允许把**方法白名单**发到公开仓。

- 新模块 `lib/rules-git.mjs`（零依赖，只用 node 内置＋git）：`collect`/`rulesStatus`/`rulesSnapshot`/`rulesMarkGood`/`rulesPublishPublic`/`rulesRestore`/`scanText`。
- 新工具 `dsh_xwide_thought_chain_rules`（op=status|snapshot|good|publish|restore|list-good；publish/restore 必须 `confirm=true`）。
- 设置页新第⑤组＋10 个 `rules.*` 项（每项带说明）；界面五个按钮：看漂移 / 备份到私有仓 / 标记好状态 / 发公开库（需勾选＋二次确认）/ 从私有仓拿回来（二次确认）。
- 三道硬闸：没勾好状态不发；快照≠勾的那份不发；脱敏扫描命中不发（盘符路径、Administrator、npm_/ghp_ 令牌、密码字面、邮箱、手机号、自定义词）。
- 安全性质：git 只在显式动作里跑（无 hook、无定时）；备份只写插件目录；恢复逐文件 `.bak-时间戳` ＋ sha256 校验后才写。

实测（判定器 `_rules_backup_harness.mjs`，本地假远程全回路）：**19/19 PASS**。

过程中被判定器抓到并修掉的三个真问题（都留了证据）：
1. `git push --follow-tags origin HEAD:master` **不推 tag**（对照实验 `_probe_gitpush.cjs`：远程只有 `refs/heads/master`）→ 改成推分支后显式 `push origin refs/tags/<tag>`。
2. 快照在提交后 `--amend` 回填清单，会把 tag 留在被换掉的旧提交上，导致 tag 推不上去 → 去掉 amend，只回填工作区清单。
3. 恢复生成的 `.bak-*` 落在 `尺子\` 里被当正文收进快照（和 v0.1.10 npm 打进 20 个 `.bak` 同一类毛病）→ `collect` 排除 `.bak-` 与清单文件本身。

## [0.1.12] - 2026-11-09

**经验库：让插件记住「做错→做对」，下个会话开工就带着这些坑。**

- 新增 **`lib/lessons.json`**（随包发布、只读）：12 条来自真返工的规则，每条含 **触发条件 / 做错的 / 做对的 / 实测读数**。这批的内容全部出自本次真实病例——侧栏没出现（`exports.inject=[]`）、面板函数偷外层 `config`（6 条探针 FAIL）、源码写死绝对路径（判分器 T5）、退回吞键（8 键→1 键，判分器 T6）、npm 包里混进 20 个 `.bak-*`（`files` 白名单赢过 `.npmignore`）、`dist-tags.latest` 未同步时不许说「已发布」、`unpublish` 被 2FA 政策挡→同位 `deprecate`、`ENEEDAUTH` 其实是缺 `.npmrc`、配色第一版红 4.34:1 不达标、用户截图优先于代码断言、可调项按你的心智分块。
- 注入：默认前 6 条成独立一段进 systemPrompt（不占六步段字数预算）。新设置两项：`prompt.lessons`（bool，默认开）、`prompt.lessonsCount`（0–12，默认 6）。说明里标了代价：每条≈40 字≈20 token，6 条≈120 token；本机冷 prefill 112.8 tok/s ⇒ 一轮约多 1 秒，前缀缓存命中几乎免费。
- 界面：设置页新增一栏「这一版学到的规则」全量显示（中英双语标题）；面板「怎么运作 · 记忆在哪」打印经验库路径＋条数（读不到会明说）。
- 顺手修掉一处作用域隐患：`about()` 改成显式收 `config` 并自己 `loadSettings`——这正是经验库 L3 那条规则的现场应用（我写完注入就自查出来的）。

## [0.1.11] - 2026-11-08

**只修发布打包，代码零改动。**

- **缺陷**：`dsh-xwide-thought-chain@0.1.10` 的 npm 包里混进 **20 个 `.bak-*` 编辑备份**（1.4 MB／33 文件）。根因：npm 的规则是 **`package.json` 的 `files` 白名单赢过 `.npmignore`** —— 我加了 `.npmignore` 排除 `*.bak-*`，实测对 `files:["assets/"]` 里的备份完全无效（预演读数 `bak_in_package=20`、`total files: 33`）。
- **修法**：发布不再直接指向插件目录，而是把该发的文件复制到工作区里的**干净暂存目录**再 `npm publish`——插件目录里的真备份一个都不动。判定器＝`npm pack` 后的清单里 `.bak` 计数必须为 **0**，且文件数与体积逐版对比。
- 0.1.10 在 npm 上保留原样（npm 不允许覆盖同版本号；72 小时内可 unpublish，需要就说）。

## [0.1.10] - 2026-11-08

**排版拉开 ＋ 档位配色（使用者看图说「排得太密了」＋「省快准用颜色区分」）。**

**同版修好一个退回缺陷（判分器 T6 抓到，不是我发现的）**：`rollback(restore=true)` 之前挑目录里**最新**的 `settings.*` 备份，而它自己每次退回都会往同一目录写 `settings.pre-rollback-*` 快照 ⇒ **第二次退回取到的是「第一次退回时的快照」**，连退两次会把设置越退越少（实测：退完只剩 `{"chain.maxFindings": 7}`，其余 7 个键被吞）。修法＝改动前快照改前缀 `settings.write-*`，退回只认这一类，`pre-rollback-*` 只当后悔药不参与退回。修后工具层判据 **11/11**（含「一键退回生效＝退回后与改前内容等价」）。

- **间距**：整页 `gap` 18→**34px**；分类之间 **22px ＋ 分隔线**；每项上下 **10px ＋ 淡分隔线**；说明文字行距 **1.7**，档位说明 **1.8** 且换行成段；面板 `pre` 行距 **1.8**。字号不动（尺子档位 15/14/13/12）。
- **档位配色**（文字与边框同色，走宿主主题变量）：**省**＝`--dsw-alias-state-success-primary`（绿）、**快**＝`--dsw-alias-brand-primary`（蓝）、**准**＝`--dsw-alias-state-warn-primary`（琥珀）、**排障**＝`--dsw-alias-state-error-primary`（红）、自存档位＝随主题正文色。兜底色实测对深色底 `#2b2f36` 对比度 **5.61 / 5.59 / 5.98 / 5.45**（WCAG，门槛 4.5:1，用 `calc` 按亮度公式实算）。
- **已知边界（写清楚，不藏）**：同一批兜底色放**浅色底**只有 2.1–2.3:1 —— 它们只在宿主 token 缺席时才用；本机宿主这些 token 存在（官方插件同款用法），届时取宿主主题色，浅深两底由宿主保证。**没验到浅色主题下的真机观感**。

## [0.1.9] - 2026-11-08

**设置页重做：分类 + 档位 + 滑条 + 说明书，把"调什么、值多少代价"讲清楚。**

- **四个分类分块**：① 思考链本体 ② 开机自检·看守 ③ 注入与开销 ④ 写入与退回。每项标了归属，页面按类渲染。
- **四组预设档位**（一次点一下批量配好）：**本地模型·省上下文**（注入 420 字／回显 6 条／六步全开）·**快**（注入关／只跑取证四步／回显 4 条）·**准**（六步全开／回显 12 条／注入 900 字）·**排障**（连续失败 1 次就转 STUCK-5／深扫路径漂移）。数值来自本机实测（decode 80.2 tok/s、冷 prefill 112.8 tok/s、前缀缓存命中约 90%、xhigh 8192 token ≈ 102 秒/轮）。**＋「把当前这套存成一组」**：自存档位存 `data\presets.json`，可删；内置四组不可覆盖。
- **滑条**：六个数字项（回显条数 1–30、失败阈值 1–5、注入字数 100–1500、顺序 0–999、备份份数 1–50、陈旧日志 0–336 小时）改成滑块，带实时数值与区间；松手才写盘（不是一路刷备份）。
- **「怎么运作 · 记忆在哪 · 怎么守住之前犯过的错」面板**：列出本插件值/备份/账本/档位/装载读数的真路径（逐个 `existsSync` 标在不在）、守错机制的位置（工作区 `错题本.md`／`沟通词典.md`／`卡点卡.md`／`规则书\卡点协议.md`／`AGENTS.md`，以及"纠正→追加一行→第二次重犯升硬线"这条链）、跨会话记忆的查法（`soul_recall`、`cg(op="read")`；hindsight／记忆按需注入／weknora 是独立插件，本插件不读写它们），和效率三个入口按代价排序。只读，不写任何文件。
- **速度体检面板**：显示 profile 里 `reasoningEffort` / `maxTokens` 的当前真值＋行号，本插件自己占多少（注入段字数、回显条数换算成秒），并写明"要动模型档位＝改启动关键文件，本插件不代改"。
- **说明里带实测代价**：例：`chain.maxFindings` 12 条 ≈ 780 token ≈ 10 秒；4 条 ≈ 4 秒；注入段 700→420 字每轮约省 1.7 秒等量 prefill。
- **零依赖声明**：`package.json` 无任何 `dependencies`；只用 `node:fs/path/url` ＋浏览器侧 `fetch`，React 由宿主提供（`require("react")`）。**不需要装任何别的插件也能用**；跨插件的只读总览不在本版范围。

**这一刀的自曝**：首版把 `applyPreset`/`savePreset`/`slowCheck` 写在模块顶层却引用只在 `apply(ctx, config)` 里的 `config` → 一调就抛，探针当场判红（档位「快」落盘 `prompt.enabled=undefined`、速度体检无读数）。修法是给三个函数加 `config` 形参＋调用点传参；复跑探针 28 条全绿。**这就是判定器的价值**：没有它我会照旧说"做好了"。

## [0.1.8] - 2026-11-08

**根因修掉：客户端入口没声明依赖，宿主直接拒绝给 `ctx.slots`。** v0.1.7 的自报通道在你重启后立刻出读数（`data\boot.log` 第 21–22 行，真宿主 14:40）：

```
client: 心跳到达（客户端半部已装载）
client: 注册报错自报 -> Error: cannot get property "slots" without inject
    at new apply (dsh-app://app/plugins/??@deepseek-ai/dsh-client-ui-settings-subagent/client.js,…)
```

⇒ 客户端 bundle **确实装载了**（心跳到），死在**我自己写的 `exports.inject = []`**：cordis 只把声明过的服务给插件，没声明 `slots` 就不给，槽注册当场抛异常。

**修法**：客户端入口改成 `exports.inject = ["slots", "locale"]`（样本 `dsh-ui-tools\lib\client.js:129` 声明的是 `["slots","modelDirectories","sessions","locale","workspaces"]`，本插件只用前两项里的两个，按需最小声明）。**这就是 v0.1.5/v0.1.6 两轮侧栏没条目的真因**——不是槽不存在、不是打包没带上、不是鉴权。

顺带一条真机读数（写进文档免得以后再猜）：宿主半部在同一份日志里报 `host: 无 settings.register 服务，跳过命名空间注册` ⇒ 这台宿主上 `settings` 服务存在但**没有 `register` 方法**，v0.1.5 那次「注册命名空间」在真机上从未发生（所以 `settings.yaml` 至今不存在是必然，不是没人改过）。界面值一律走插件自己的 `data\settings.json`，不依赖它。

## [0.1.7] - 2026-11-08

**加自带日志通道＋客户端自报：把「为什么侧栏没有」从猜变成读得到。** v0.1.6 在你机器上重启后侧栏仍无条目，而装载账（`/dsh-market/installed`）显示本插件与成功样本完全一致（`activation.state=live`、`bundle=true`、`hot=true`、`brokenPlugins` 空、`diagnostics.findings=[]`），web 侧却没有任何可读通道（`/plugins/<id>/client.js` 对成功样本也 404＝不是暴露面；`/api/*` 一律 401＝鉴权墙在路由前，401 证明不了什么）。本机插件 `console.log` 进不了 `harness.log`（实测 5 B 死通道），样本靠自己的 `ui-tools-host.log` 才看得见——这次补上同款：

- 宿主半部：`data\boot.log` 逐条记 `apply 开跑 / settings.register OK 或抛异常 / 读写通道已注册 / 装载失败`。
- 客户端半部：装载即 POST 心跳（`action:"ping"`）→ 落一条 `client: 心跳到达`；注册过程抛异常则把**堆栈原文**POST 回来落 `client: 注册报错自报 -> …`；`ctx.slots.inject` 不存在时自报形状。
- 从此「客户端到底装载没装载」「槽注册炸在哪一行」都有盘上读数，不再靠截图猜。

**判据**：重启后看 `data\boot.log`。有 `host:` 行没 `client:` 行＝web 侧没装载（问题在打包/装载层）；两行都有且带 `注册报错自报`＝问题在槽注册，堆栈直接给答案。

## [0.1.6] - 2026-11-08

**加客户端半部：设置侧栏那一行终于有了着落。** v0.1.5 只做到「命名空间能持久化」，这次补上真正产生条目的那一半：

- `lib/client.js`（新）：注册进官方 **`settings.section`** 槽（root list 槽，id `xwide-thought-chain`、order 140），自己画 13 项表单——开关/数字/文本三种控件，每项带说明与默认值；文案走 `ctx.locale.register`（中英）。入口格式照本机样本 `dsh-ui-tools` 量出来的 `window.__ModuleLoader__.load({id,factory})` 写法，React 走 `require("react")`。
- `index.js`：宿主半部注册读写通道 `POST /api/xwide/settings`（`connection.fetch.register`，鉴权全在内核，插件侧不加第二道）。界面改的值当场写进 `data\settings.json` 并留备份，工具与自检立刻读到。
- `package.json`：加 `exports["./client"]` ＋ `dsh.client { inject: [], platform: "web" }`。
- 界面按尺子/02 做：字号只用 15/14/13/12，次级说明 `.70` 白＝实测 9.4:1，输入框与开关 32px，无通配选择器、无 `!important` 刷色，颜色继承宿主（深浅两底都不写死）。

**生效范围**：客户端半部要**重启 DSH** 才装载（web 侧装载发生在启动时）；装载后设置中心侧栏出现「X-Wide 思考链」。本次交付的判定器只覆盖到语法＋宿主半部装载＋样式判据，**界面真出现那一行由使用者重启后核对**。

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
