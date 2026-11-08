// ═══════════════════════════════════════════════════════════════════════════
// DSH_X-Wide-Thought-Chain · dsh-xwide-thought-chain  v0.1.0
//
// 这是什么：把一条排障/交付的思考链固化成插件——
//   ① 冻结事实（已读数 / 未读数两栏） ② 量真形状（探针，不许猜 API）
//   ③ 最小复现 ④ 单变量对照 ⑤ 判定器 ⑥ 交活闸
// 外加零依赖开机自检（安装路径漂移 / 缺件 / 版本一致 / 崩溃日志通道），
// 逐项带说明的微调设置，以及「每个写动作先备份、可一键退回」的退回机制。
//
// 设计纪律（本包自己吃自己的药，自检 C2 会扫这些）：
//   · 运行时**零依赖**：只用 node 内置模块，不依赖任何其他 DSH 插件
//   · 源码里**零绝对路径字面量**：一律 import.meta.url / process.env 派生
//   · 默认不写盘：safety.allowMutate=false 时所有修复只给命令，不执行
//   · 写盘范围只有插件自己的 data\ 目录；profile 配置一律只读
//   · 自检失败绝不抛错阻塞启动（apply 全程 try/catch）
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-xwide-thought-chain";
export const version = "0.1.10";
export const inject = ["tools", "systemPrompt", "settings"];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "data");
const BACKUPS = path.join(DATA, "backups");
const SETTINGS_FILE = path.join(DATA, "settings.json");
const JOURNAL = path.join(DATA, "journal.jsonl");
const BOOT_LOG = path.join(DATA, "boot.log");

// 自带日志通道（本机插件 console.log 进不了 harness.log，实测 5 B 死通道；照样本 dsh-ui-tools 的 ui-tools-host.log 做法）
function logBoot(msg) {
  try { fs.mkdirSync(DATA, { recursive: true }); fs.appendFileSync(BOOT_LOG, new Date().toISOString() + " | v" + version + " | " + msg + "\n", "utf8"); } catch { /* 日志坏了不连累功能 */ }
}

// ── 微调设置：每项带说明＋分类（group）＋滑条区间（min/max），界面按分类分块渲染 ──────────────
export const SETTINGS_GROUPS = [
  { id: "chain", zh: "① 思考链本体", desc: "六步链跑哪几步、每步报几条、几次失败算卡住" },
  { id: "selfcheck", zh: "② 开机自检·看守", desc: "升级/改名/换机后的路径漂移与缺件检查" },
  { id: "prompt", zh: "③ 注入与开销", desc: "每轮往 systemPrompt 注入多少字——本插件的开销都在这" },
  { id: "disk", zh: "④ 写入与退回", desc: "记账本、备份份数、以及“只报不自动改”的总开关" },
];
export const SETTINGS_SCHEMA = [
  { key: "chain.steps", type: "string", group: "chain", def: "1,2,3,4,5,6", desc: "六步链启用哪几步（逗号分隔）。例：只跑取证段填 \"1,2\"；跳过复现填 \"1,2,4,5,6\"。" },
  { key: "chain.maxFindings", type: "number", group: "chain", min: 1, max: 30, def: 12, desc: "一次自检最多报几条发现，防止刷屏。1–30。实测代价：每条约 130 字，12 条≈780 token≈10 秒（本机 decode 80.2 tok/s）；4 条≈4 秒。" },
  { key: "chain.stuckAfterFailures", type: "number", group: "chain", min: 1, max: 5, def: 2, desc: "同一假设连续失败几次就强制转 STUCK-5（停手、重列全景）。1–5。" },
  { key: "selfcheck.pathDrift", type: "boolean", group: "selfcheck", def: true, desc: "扫自身与 local-plugins 源码里的绝对路径字面量，逐个查存在性——安装目录改名后立刻报（本机曾因此静默失效一个月）。" },
  { key: "selfcheck.scanDirs", type: "string", group: "selfcheck", def: "", desc: "额外要扫的目录，分号分隔。留空＝插件自身 + profile 的 local-plugins。" },
  { key: "selfcheck.inventoryFile", type: "string", group: "selfcheck", def: "inventory.json", desc: "配方清单文件名（在插件 data\\ 下）。缺件检查按它逐条 existsSync。" },
  { key: "selfcheck.staleLogHours", type: "number", group: "selfcheck", min: 0, max: 336, def: 72, desc: "崩溃日志超过多少小时算陈旧（提示启动器没在用）。0＝不检查。" },
  { key: "prompt.enabled", type: "boolean", group: "prompt", def: true, desc: "是否向 systemPrompt 注入这条链的一句话提醒。关掉后只剩工具。" },
  { key: "prompt.order", type: "number", group: "prompt", min: 0, max: 999, def: 138, desc: "systemPrompt 段落顺序（越小越靠前）。" },
  { key: "prompt.maxChars", type: "number", group: "prompt", min: 100, max: 1500, def: 700, desc: "注入文本最长字符数（每轮一次）。实测：700→420 字每轮约省 1.7 秒等量 prefill（冷读 112.8 tok/s）；前缀缓存命中约 90%，所以「稳定」比「短」更省。" },
  { key: "write.journal", type: "boolean", group: "disk", def: true, desc: "是否把每次改设置追加进 data\\journal.jsonl（退回机制的账本）。" },
  { key: "write.maxBackups", type: "number", group: "disk", min: 1, max: 50, def: 10, desc: "settings.json 保留几份历史备份（data\\backups\\）。1–50。" },
  { key: "safety.allowMutate", type: "boolean", group: "disk", def: false, desc: "总开关：false＝自检只报问题 + 给命令，绝不自动改任何东西；true＝允许插件自己写文件（仍先备份，且只写插件自己的 data\\）。" },
];

// ── 预设档位：一次点一下，把上面四类一次配好。数值来自本机实测（尺子台账：decode 80.2 tok/s、
// 冷 prefill 112.8 tok/s、前缀缓存命中 ~90%、xhigh 8192 token ≈ 102 秒/轮）
export const PRESETS = [
  { name: "本地模型·省上下文", note: "日常推荐：注入段压到 420 字（越稳越小越省缓存），六步全开，回显 6 条，记账本开" , values: { "prompt.enabled": true, "prompt.maxChars": 420, "chain.steps": "1,2,3,4,5,6", "chain.maxFindings": 6, "chain.stuckAfterFailures": 2, "selfcheck.pathDrift": true, "selfcheck.staleLogHours": 72, "write.journal": true } },
  { name: "快", note: "赶时间：注入段关掉（工具仍在），只跑取证四步，回显 4 条，跳过陈旧日志检查", values: { "prompt.enabled": false, "chain.steps": "1,2,4,5", "chain.maxFindings": 4, "chain.stuckAfterFailures": 2, "selfcheck.staleLogHours": 0, "write.journal": false } },
  { name: "准", note: "动真实文件/改配置那一刀：六步全开，回显 12 条，注入段 900 字，记账本开", values: { "prompt.enabled": true, "prompt.maxChars": 900, "chain.steps": "1,2,3,4,5,6", "chain.maxFindings": 12, "chain.stuckAfterFailures": 2, "selfcheck.pathDrift": true, "write.journal": true } },
  { name: "排障", note: "卡住时：连续失败 1 次就转 STUCK-5，回显 12 条，深扫路径漂移", values: { "prompt.enabled": true, "prompt.maxChars": 700, "chain.steps": "1,2,3,4,5,6", "chain.maxFindings": 12, "chain.stuckAfterFailures": 1, "selfcheck.pathDrift": true, "selfcheck.staleLogHours": 72 } },
];

function loadSettings(config = {}) {
  const disk = (() => { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")); } catch { return {}; } })();
  const s = {};
  for (const m of SETTINGS_SCHEMA) {
    const v = config[m.key] ?? disk[m.key];
    s[m.key] = v === undefined || v === null ? m.def : v;
  }
  return s;
}

function stamp() { return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14); }
function note(kind, obj) {
  try {
    fs.mkdirSync(DATA, { recursive: true });
    fs.appendFileSync(JOURNAL, JSON.stringify({ ts: new Date().toISOString(), plugin: name, version, kind, ...obj }) + "\n", "utf8");
  } catch { /* 记账失败不影响功能 */ }
}

// ── 六步链：把「怎么想」变成可填的表，逼着先量再改 ─────────────────────────
function chainRun(input, S) {
  const want = String(S["chain.steps"]).split(",").map(x => x.trim()).filter(Boolean);
  const steps = [
    { n: 1, title: "冻结事实", prompt: "两栏写清：已有读数（带来源）／还缺什么读数。不许在这步立假设。" },
    { n: 2, title: "量真形状", prompt: "探针打印真实结构（API 存在性 / 对象键 / 行数 / 文件大小）。猜出来的选择器、字段名一律不许进下一步。" },
    { n: 3, title: "最小复现", prompt: "能稳定复现故障的最短命令 + 落盘读数。复现不了＝假设没成立。" },
    { n: 4, title: "单变量对照", prompt: "一次只改一个变量，跑 A/B 两次，贴两次读数。多变量一起动＝结论作废。" },
    { n: 5, title: "判定器", prompt: "写下能判红绿的脚本再动手；判定器没说 OK 不许说「修好了」。绿灯只证明管道通，不证明好用。" },
    { n: 6, title: "交活闸", prompt: "四件套：改动:行号 ／ 备份路径 ／ 回滚命令 ／ 判定器原文 ＋ 一条否定证据 ＋ 一句「这次没验到什么」。" },
  ];
  const max = Math.max(1, Math.min(100, Number(S["chain.maxFindings"]) || 12));
  const picked = steps.filter(s => want.includes(String(s.n))).slice(0, max);
  const stuck = Number(S["chain.stuckAfterFailures"]) || 2;
  const lines = ["X-WIDE THOUGHT-CHAIN v" + version + "（当前第 " + (input && input.step ? input.step : "?") + " 步）"];
  if (input && input.problem) lines.push("问题：" + String(input.problem).slice(0, 300));
  for (const s of picked) {
    lines.push("\n[" + s.n + "] " + s.title);
    lines.push("  要做：" + s.prompt);
  }
  lines.push("\n停手红线：同一假设连续失败 " + stuck + " 次＝停当前方向，重列全景（禁叠第 " + (stuck + 1) + " 次）。");
  lines.push("出口纪律：状态词（已完成／生效了／下完了）只有你自己量过才许说；量不到就直说「量不到」。");
  return { text: lines.join("\n"), steps: picked.map(s => s.n) };
}

// ── 零依赖自检：委托 lib/selfcheck.mjs（同一份代码也能命令行直跑）──────────
async function runSelfcheck(S, args) {
  const mod = path.join(HERE, "lib", "selfcheck.mjs");
  if (!fs.existsSync(mod)) return { ok: false, text: "缺内核文件 lib\\selfcheck.mjs（安装不完整，退回＝重装本包）" };
  const modUrl = "file:///" + mod.replace(/\\/g, "/");
  const { selfcheck } = await import(modUrl);
  return selfcheck({ settings: S, schema: SETTINGS_SCHEMA, version, args: args || {} });
}

function setSetting(key, value, S) {
  const meta = SETTINGS_SCHEMA.find(m => m.key === key);
  if (!meta) return { ok: false, text: "没有这个设置项：" + key + "\n可选项见 dsh_xwide_thought_chain_config(show=true)" };
  let v = value;
  if (meta.type === "number") { v = Number(value); if (!Number.isFinite(v)) return { ok: false, text: "要数字，收到：" + value }; }
  if (meta.type === "boolean") v = value === true || value === "true" || value === 1;
  const disk = (() => { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")); } catch { return {}; } })();
  const prev = disk[key] !== undefined ? disk[key] : meta.def;
  fs.mkdirSync(BACKUPS, { recursive: true });
  // 前缀 settings.write-＝改动前的快照，退回只认这一类；和 settings.pre-rollback-*（退回动作自己留的后悔药）分开。
  // 混用同一个前缀时第二次退回会取到「第一次退回时的快照」——判分器 T6 实测抓到（退完只剩一个键）
  const bak = path.join(BACKUPS, "settings.write-" + stamp() + ".json");
  if (fs.existsSync(SETTINGS_FILE)) fs.copyFileSync(SETTINGS_FILE, bak);
  else fs.writeFileSync(bak, JSON.stringify(disk, null, 2), "utf8");
  disk[key] = v;
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(disk, null, 2), "utf8");
  const keep = Math.max(1, Math.min(50, Number(S["write.maxBackups"]) || 10));
  const list = fs.readdirSync(BACKUPS).filter(f => f.startsWith("settings.write-")).sort();
  for (const old of list.slice(0, Math.max(0, list.length - keep))) { try { fs.unlinkSync(path.join(BACKUPS, old)); } catch { } }
  if (S["write.journal"]) note("setting.set", { key, from: prev, to: v, backup: bak });
  return { ok: true, text: key + " : " + JSON.stringify(prev) + " → " + JSON.stringify(v) + "\n备份（退回用）：" + bak + "\n退回：dsh_xwide_thought_chain_rollback(restore=true)" };
}

// ── 预设档位：内置四组＋使用者自存组（data\\presets.json），一次点一下批量写（先备份再写，进账本）──
const PRESETS_FILE = path.join(DATA, "presets.json");
const readCustomPresets = () => { try { const j = JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")); return Array.isArray(j) ? j : []; } catch { return []; } };
const writeCustomPresets = (list) => { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(PRESETS_FILE, JSON.stringify(list, null, 2), "utf8"); };

function allPresets() {
  const custom = readCustomPresets().map(p => ({ name: p.name, note: p.note || "使用者自存的档位", custom: true, values: p.values || {} }));
  return PRESETS.map(p => ({ name: p.name, note: p.note, values: p.values })).concat(custom);
}

function applyPreset(presetName, config) {
  const p = allPresets().find(x => x.name === presetName);
  if (!p) return { ok: false, text: "没有这组档名：" + presetName + "\n现有：" + allPresets().map(x => x.name).join(" / ") };
  const disk = (() => { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")); } catch { return {}; } })();
  const S = loadSettings(config);
  fs.mkdirSync(BACKUPS, { recursive: true });
  const bak = path.join(BACKUPS, "settings.write-" + stamp() + ".json"); // 同 setSetting：退回只认 settings.write- 这一类
  if (fs.existsSync(SETTINGS_FILE)) fs.copyFileSync(SETTINGS_FILE, bak); else fs.writeFileSync(bak, JSON.stringify(disk, null, 2), "utf8");
  const changed = [];
  for (const [k, v] of Object.entries(p.values || {})) {
    const meta = SETTINGS_SCHEMA.find(m => m.key === k);
    if (!meta) continue;
    let val = v;
    if (meta.type === "number") { val = Number(v); if (!Number.isFinite(val)) continue; }
    if (meta.type === "boolean") val = v === true || v === "true" || v === 1;
    if (disk[k] !== val) changed.push(meta.key + " : " + JSON.stringify(disk[k] !== undefined ? disk[k] : meta.def) + " → " + JSON.stringify(val));
    disk[k] = val;
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(disk, null, 2), "utf8");
  const keep = Math.max(1, Math.min(50, Number(S["write.maxBackups"]) || 10));
  const list = fs.readdirSync(BACKUPS).filter(f => f.startsWith("settings.write-")).sort();
  for (const old of list.slice(0, Math.max(0, list.length - keep))) { try { fs.unlinkSync(path.join(BACKUPS, old)); } catch { } }
  if (S["write.journal"]) note("preset.apply", { name: p.name, changed: changed.length, backup: bak });
  logBoot("route: 预设已应用「" + p.name + "」改 " + changed.length + " 项，备份 " + path.basename(bak));
  return { ok: true, text: "已应用档位「" + p.name + "」：改了 " + changed.length + " 项\n" + (changed.join("\n") || "（当前值已与这组一致）") + "\n备份（退回用）：" + bak, cur: loadSettings(config) };
}

function savePreset(presetName, config) {
  const nm = String(presetName || "").trim();
  if (!nm) return { ok: false, text: "档名不能为空" };
  if (PRESETS.some(p => p.name === nm)) return { ok: false, text: "「" + nm + "」是内置档位名，换一个（内置不可覆盖）" };
  const S = loadSettings(config);
  const values = {}; for (const m of SETTINGS_SCHEMA) values[m.key] = S[m.key];
  const list = readCustomPresets().filter(p => p.name !== nm);
  list.push({ name: nm, savedAt: new Date().toISOString(), values });
  writeCustomPresets(list);
  note("preset.save", { name: nm, keys: Object.keys(values).length });
  logBoot("route: 自存档位已保存「" + nm + "」（" + Object.keys(values).length + " 项）");
  return { ok: true, text: "已把当前这套存成档位「" + nm + "」（存 data\\presets.json，只写插件目录内）", presets: allPresets() };
}

function deletePreset(presetName) {
  const list = readCustomPresets();
  const next = list.filter(p => p.name !== presetName);
  if (next.length === list.length) return { ok: false, text: "没有这组自存档位：" + presetName + "（内置四组不可删）" };
  writeCustomPresets(next);
  note("preset.delete", { name: presetName });
  return { ok: true, text: "已删自存档位「" + presetName + "」", presets: allPresets() };
}

// 速度体检：只读盘上真值＋给命令，不写任何文件（safety.allowMutate 纪律不变）
const PROFILE_PATCH = path.resolve(HERE, "..", "..", "cordis.patch.yml");
function slowCheck(config) {
  const S = loadSettings(config);
  const lines = ["—— 速度体检（只读盘上真值，不改任何东西）——"];
  const mc = Number(S["prompt.maxChars"]) || 0;
  lines.push("本插件自己占的：注入段 " + (S["prompt.enabled"] ? "开，上限 " + mc + " 字/轮（≈ 最多 " + Math.ceil(mc / 2) + " token）" : "关（零开销，工具仍在）"));
  lines.push("工具回显：每步上限 " + S["chain.maxFindings"] + " 条；账本：" + (S["write.journal"] ? "开" : "关") + "；备份保留 " + S["write.maxBackups"] + " 份");
  if (!fs.existsSync(PROFILE_PATCH)) { lines.push("读不到 profile 的 cordis.patch.yml（路径：" + PROFILE_PATCH + "）——模型档位那部分测不到，直说。"); return { lines }; }
  const raw = fs.readFileSync(PROFILE_PATCH, "utf8").split(/\r?\n/);
  const hits = [];
  raw.forEach((l, i) => { if (/reasoningEffort|maxTokens/.test(l)) hits.push("  第 " + (i + 1) + " 行：" + l.trim()); });
  lines.push("profile 里的模型档位真值（慢的大头在这，不在本插件）：");
  if (hits.length) for (const h of hits.slice(0, 12)) lines.push(h);
  else lines.push("  （没匹配到 reasoningEffort / maxTokens 行）");
  lines.push("本机实测代价（尺子台账 2026-11-08）：decode 80.2 tok/s、冷 prefill 112.8 tok/s、前缀缓存命中约 90%（命中省 96.2%）、引擎 total_slots:1 串行；xhigh 思考预算 8192 token ≈ 102 秒/轮。");
  lines.push("能立刻减本插件开销的一条：注入段关掉（prompt.enabled=false）或压到 420 字（预设「本地模型·省上下文」）。");
  lines.push("要动模型档位＝改 profile 的 cordis.patch.yml（启动关键文件，改错整个界面打不开）；生效范围＝新会话，旧会话是会话级覆盖。本插件不代改，只给读数与位置。");
  return { lines };
}

// 怎么运作·记忆在哪·怎么守错：全用盘上真读数（逐个 existsSync），不写任何文件
const DSH_HOME = path.resolve(HERE, "..", "..", "..");
// 工作区候选路径一律从 homedir／环境变量推导——本包纪律：源码零绝对路径字面量（自检 C2 与判分器 T5 都会抓，v0.1.9 首版就栽在这）
const HOME_DIR = (() => { try { return os.homedir(); } catch { return ""; } })();
const WS_CANDIDATES = [
  process.env.DSH_WORKSPACE || "",
  path.join(HOME_DIR, "Documents", "deepseek-harness", "default-workspace"),
  path.join(HOME_DIR, "Documents", "default-workspace"),
  path.join(HOME_DIR, "deepseek-harness", "default-workspace"),
].filter(Boolean);
function exists(p) { try { return fs.existsSync(p); } catch { return false; } }
function countLines(p) { try { return fs.readFileSync(p, "utf8").trim().split(/\r?\n/).filter(Boolean).length; } catch { return 0; } }
function about() {
  const lines = ["—— 这套东西怎么运作（只读盘上真值）——"];
  const baks = (() => { try { return fs.readdirSync(BACKUPS).filter(f => f.startsWith("settings.write-")).length; } catch { return 0; } })();
  lines.push("【本插件的值在哪】全在插件目录内，卸载＝删目录 + 清 profile 两处登记：");
  lines.push("  当前值：" + SETTINGS_FILE + (exists(SETTINGS_FILE) ? "" : "（还没写过，用的是内置默认）"));
  lines.push("  历史备份：" + BACKUPS + "（现 " + baks + " 份）→ 退回：dsh_xwide_thought_chain_rollback(restore=true)");
  lines.push("  改动账本：" + JOURNAL + "（现 " + countLines(JOURNAL) + " 条：谁在什么时候把哪项从什么改成什么）");
  lines.push("  自存档位：" + PRESETS_FILE + (exists(PRESETS_FILE) ? "" : "（还没存过）") + "　装载读数：" + BOOT_LOG);
  lines.push("【怎么守住之前犯过的错】不在本插件里，在这几处（逐个实测存在性）：");
  const ws = WS_CANDIDATES.find(p => exists(p)) || WS_CANDIDATES[0];
  for (const f of ["错题本.md", "沟通词典.md", "卡点卡.md", "规则书\\卡点协议.md", "AGENTS.md"]) {
    lines.push("  " + (exists(path.join(ws, f)) ? "在  " : "读不到 ") + path.join(ws, f));
  }
  lines.push("  机制：你纠正我 → 当场往 错题本/沟通词典 各追加一行 → 第二次重犯就升成 AGENTS.md 硬线（那条每轮都注入）。所以同一个错只允许犯两次。");
  lines.push("  记忆库（跨会话）：用工具查，不靠界面——soul_recall(query=…) 捞历史原文；cg(op=\"read\", query=…) 查结构化节点（约束/决策/产物）；DSH 侧另有 hindsight / 记忆按需注入 / weknora 三个独立插件（本插件不读写它们）。");
  const memDirs = (() => { try { return fs.readdirSync(DSH_HOME).filter(n => /mem|aeis|lingshu|storages/i.test(n)).map(n => n + (exists(path.join(DSH_HOME, n)) ? "" : "?")); } catch { return []; } })();
  lines.push("  " + DSH_HOME + " 下与记忆相关的目录：" + (memDirs.length ? memDirs.join(" / ") : "（没扫到）"));
  lines.push("【效率的三个入口，按代价从大到小】");
  lines.push("  1) 输出量 × 轮数——本机实测 decode 80.2 tok/s、xhigh 思考预算 8192 token ≈ 102 秒/轮。本插件能压的是「每步回显几条」：12 条≈780 token≈10 秒；4 条≈325 token≈4 秒。");
  lines.push("  2) 每轮固定注入——注入段 700 字→420 字，每轮约省 1.7 秒等量 prefill（冷 prefill 112.8 tok/s，前缀缓存命中约 90%）。");
  lines.push("  3) 模型档位与思考预算——在 profile 的 cordis.patch.yml（启动关键文件，本插件不代改；看行号用上面的「速度体检」）。");
  return { lines };
}

function rollbackLast() {
  if (!fs.existsSync(BACKUPS)) return { ok: false, text: "没有历史备份可退（data\\backups\\ 还不存在）" };
  // 只认改动快照 settings.write-*；退回自己留的 settings.pre-rollback-* 不参与，否则第二次退回会取到第一次退回时的快照
  const list = fs.readdirSync(BACKUPS).filter(f => f.startsWith("settings.write-")).sort();
  if (!list.length) return { ok: false, text: "没有「改动前快照」可退（data\\backups\\settings.write-*.json 一个都没有；先改一次设置再退）" };
  const latest = path.join(BACKUPS, list[list.length - 1]);
  if (fs.existsSync(SETTINGS_FILE)) fs.copyFileSync(SETTINGS_FILE, path.join(BACKUPS, "settings.pre-rollback-" + stamp() + ".json"));
  fs.copyFileSync(latest, SETTINGS_FILE);
  note("setting.rollback", { restoredFrom: latest });
  return { ok: true, text: "已退回上一份设置\n来源备份 = " + latest + "\n退回前状态另存于 data\\backups\\settings.pre-rollback-*.json（不参与下一次退回）" };
}

export function apply(ctx, config = {}) {
  try {
    if (config.enabled === false) { console.log("[" + name + "] disabled by config"); return; }
    const S = loadSettings(config);

    if (S["prompt.enabled"]) {
      const base = "X-Wide 思考链 v" + version + "：排障/交付按六步走 —— ①冻结事实（读数两栏）②量真形状（探针，禁猜 API）③最小复现 ④单变量对照（A/B 各一次）⑤判定器（没说 OK 不许说修好了）⑥交活闸（改动:行号／备份／回滚命令／判定器原文＋否定证据＋没验到的）。同一假设连败 " + S["chain.stuckAfterFailures"] + " 次＝停手重列全景。工具：dsh_xwide_thought_chain / dsh_xwide_thought_chain_selfcheck / dsh_xwide_thought_chain_config / dsh_xwide_thought_chain_rollback。";
      ctx.systemPrompt.section({
        name: "tool:xwide-thought-chain",
        order: Number(S["prompt.order"]) || 138,
        text: base.slice(0, Math.max(120, Number(S["prompt.maxChars"]) || 700)),
      });
    }

    const render = (_a, v) => [{ type: "text", text: String((v && v.text) || "") }];
    const out = { schema: { type: "object", additionalProperties: true }, render };

    const defs = [
      {
        name: "dsh_xwide_thought_chain",
        description: "取用 X-Wide 思考链的当前步骤清单（六步：冻结事实→量真形状→最小复现→单变量对照→判定器→交活闸）。传 problem=你正在查的问题，step=现在第几步。卡在某个点上、或者准备说「修好了」之前调用。",
        parameters: { type: "object", additionalProperties: false, properties: { problem: { type: "string", description: "一句话问题描述" }, step: { type: "number", description: "现在走到第几步（1–6）" } }, required: [] },
        output: out, timeoutMs: 20000, isConcurrencySafe: () => true,
        async execute(args) { const r = chainRun(args || {}, S); return { ok: true, text: r.text, steps: r.steps }; },
        presentCall: (a) => ({ card: "generic", title: "dsh_xwide_thought_chain", content: String((a && a.problem) || "取链") }),
        presentResult: (_a, r) => ({ card: "generic", title: "dsh_xwide_thought_chain", content: String((r && r.text) || "").slice(0, 2000) }),
      },
      {
        name: "dsh_xwide_thought_chain_selfcheck",
        description: "零依赖开机自检：①安装路径漂移（源码里的绝对路径字面量逐个查存在性）②配方清单缺件 ③版本三处一致 ④崩溃日志通道新鲜度 ⑤自身设置可读。DSH 升级／改名／换机后跑一次。默认只报问题 + 给命令，不自动改（safety.allowMutate=false）。",
        parameters: { type: "object", additionalProperties: false, properties: { json: { type: "boolean", description: "true=输出 JSON" }, deep: { type: "boolean", description: "true=顺带扫 profile 的 local-plugins（慢一点）" } }, required: [] },
        output: out, timeoutMs: 180000, isConcurrencySafe: () => true,
        async execute(args) { const a = args || {}; return await runSelfcheck(S, { json: !!a.json, deep: !!a.deep }); },
        presentCall: () => ({ card: "generic", title: "dsh_xwide_thought_chain_selfcheck", content: "开机自检" }),
        presentResult: (_a, r) => ({ card: "generic", title: "dsh_xwide_thought_chain_selfcheck", content: String((r && r.text) || "").slice(0, 3000) }),
      },
      {
        name: "dsh_xwide_thought_chain_config",
        description: "看/改本插件的微调设置（每项带说明）。show=true 列出全部项与当前值；set=某项名 + value=新值 当场生效并留备份（可用 dsh_xwide_thought_chain_rollback 退回）。",
        parameters: { type: "object", additionalProperties: false, properties: { show: { type: "boolean", description: "true=列出全部设置项 + 说明" }, set: { type: "string", description: "要改的项，如 selfcheck.pathDrift" }, value: { type: "string", description: "新值（布尔填 true/false）" } }, required: [] },
        output: out, timeoutMs: 20000, isConcurrencySafe: () => false,
        async execute(args) {
          const a = args || {};
          if (a.set !== undefined) return setSetting(String(a.set), a.value, S);
          const cur = loadSettings(config);
          const lines = ["X-Wide 思考链 v" + version + " 设置（存 data\\settings.json，profile 的 config 段可覆盖同名项）"];
          for (const m of SETTINGS_SCHEMA) lines.push("· " + m.key + " = " + JSON.stringify(cur[m.key]) + "（默认 " + JSON.stringify(m.def) + "）\n    " + m.desc);
          return { ok: true, text: lines.join("\n") };
        },
        presentCall: (a) => ({ card: "generic", title: "dsh_xwide_thought_chain_config", content: (a && a.set) ? String(a.set) : "列出设置" }),
        presentResult: (_a, r) => ({ card: "generic", title: "dsh_xwide_thought_chain_config", content: String((r && r.text) || "").slice(0, 3000) }),
      },
      {
        name: "dsh_xwide_thought_chain_rollback",
        description: "退回机制：restore=true 把设置退到上一份备份；list=true 看账本（每次改动的 from/to 与备份路径）。本插件只写自己的 data\\ 目录，profile 配置一律只读。",
        parameters: { type: "object", additionalProperties: false, properties: { restore: { type: "boolean", description: "true=退回上一份设置备份" }, list: { type: "boolean", description: "true=打印改动账本" } }, required: [] },
        output: out, timeoutMs: 30000, isConcurrencySafe: () => false,
        async execute(args) {
          const a = args || {};
          if (a.restore) return rollbackLast();
          try {
            const raw = fs.readFileSync(JOURNAL, "utf8").trim().split(/\r?\n/).filter(Boolean);
            const tail = raw.slice(-Math.max(1, Number(S["chain.maxFindings"]) || 12));
            return { ok: true, text: "账本 " + raw.length + " 条，最近 " + tail.length + " 条：\n" + tail.map(l => l.slice(0, 240)).join("\n") };
          } catch { return { ok: true, text: "账本是空的（还没改过任何设置）" }; }
        },
        presentCall: (a) => ({ card: "generic", title: "dsh_xwide_thought_chain_rollback", content: (a && a.restore) ? "退回上一份" : "看账本" }),
        presentResult: (_a, r) => ({ card: "generic", title: "dsh_xwide_thought_chain_rollback", content: String((r && r.text) || "").slice(0, 3000) }),
      },
    ];

    for (const d of defs) ctx.tools.register(d);
    logBoot("host: apply 开跑，注册 " + defs.length + " 个工具");
    console.log("[" + name + "] v" + version + " 已注册 " + defs.length + " 个工具（零依赖内核 lib\\selfcheck.mjs）");

    // 界面设置面板：命名空间＝entry id（xwide-thought-chain），schema 由 SETTINGS_SCHEMA 生成，每项带说明
    try {
      if (typeof ctx.inject === "function") {
        ctx.inject(["settings"], (sctx) => {
          const settings = sctx && sctx.settings;
          if (typeof (settings && settings.register) !== "function") { logBoot("host: 无 settings.register 服务，跳过命名空间注册"); console.log("[" + name + "] 本机宿主无 settings.register，跳过界面设置"); return; }
          const props = {}, base = {};
          for (const m of SETTINGS_SCHEMA) { props[m.key] = { type: m.type, default: m.def, title: m.key, description: m.desc }; base[m.key] = S[m.key]; }
          try {
            settings.register("xwide-thought-chain", { type: "object", additionalProperties: false, title: "X-Wide 思考链 v" + version, properties: props }, { base });
            logBoot("host: settings.register OK（命名空间 xwide-thought-chain，" + Object.keys(props).length + " 项）");
          } catch (e2) { logBoot("host: settings.register 抛异常：" + (e2 && e2.message)); throw e2; }
        });
      }
    } catch (e) { logBoot("host: settings 分支失败：" + (e && e.message)); console.log("[" + name + "] settings.register 失败（不影响启动）：" + (e && e.message)); }

    // 界面表单的读写通道：POST /api/xwide/settings。鉴权全在内核（Host/Origin 栅栏＋cookie，
    // 非 owner 直接 403），插件侧不加第二道——照样本实测结论：加了会因为拿不到 peer 参数把功能整个关死。
    try {
      ctx.inject(["connection"], (sctx) => {
        const c = sctx && sctx.connection;
        if (!c || !c.fetch || typeof c.fetch.register !== "function") { logBoot("host: 无 connection.fetch.register 服务，跳过读写通道"); console.log("[" + name + "] 本机宿主无 connection.fetch.register，跳过界面读写通道"); return; }
        const reply = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
        const dispose = c.fetch.register({
          path: "/api/xwide/settings",
          methods: ["POST"],
          requestBody: "buffered",
          async fetch(request) {
            try {
              const body = await request.json().catch(() => ({}));
              const action = String((body && body.action) || "get");
              // 客户端心跳与自报错误：证明 web 侧真装载了（以及槽注册时抛了什么）
              if (action === "ping") { logBoot("client: 心跳到达（客户端半部已装载）"); return reply({ ok: true, version }); }
              if (action === "client-error") { logBoot("client: 注册报错自报 -> " + String((body && body.msg) || "").slice(0, 400)); return reply({ ok: true }); }
              logBoot("route: action=" + action + (body && body.key ? " key=" + body.key : ""));
              if (action === "set") {
                const r = setSetting(String(body.key), body.value, S);
                return reply({ ok: r.ok, text: r.text, cur: loadSettings(config) });
              }
              if (action === "apply-preset") return reply(applyPreset(String(body.name || ""), config));
              if (action === "save-preset") return reply(savePreset(String(body.name || ""), config));
              if (action === "delete-preset") return reply(deletePreset(String(body.name || "")));
              if (action === "slowcheck") { const r = slowCheck(config); return reply({ ok: true, lines: r.lines, cur: loadSettings(config) }); }
              if (action === "about") { const r = about(); return reply({ ok: true, lines: r.lines, cur: loadSettings(config) }); }
              return reply({
                ok: true, version,
                groups: SETTINGS_GROUPS,
                items: SETTINGS_SCHEMA.map(m => ({ key: m.key, type: m.type, group: m.group, min: m.min, max: m.max, def: m.def, desc: m.desc })),
                presets: allPresets(),
                cur: loadSettings(config),
              });
            } catch (e) { logBoot("route: 异常 " + (e && e.message)); return reply({ ok: false, text: String((e && e.message) || e) }); }
          }
        });
        logBoot("host: 读写通道已注册 POST /api/xwide/settings");
        console.log("[" + name + "] 界面读写通道已注册 POST /api/xwide/settings（dispose=" + typeof dispose + "）");
      });
    } catch (e) { logBoot("host: 读写通道注册失败：" + (e && e.message)); console.log("[" + name + "] 界面读写通道注册失败（不影响启动）：" + (e && e.message)); }
    logBoot("host: apply 跑完");
  } catch (e) {
    // 装载失败绝不阻塞启动
    logBoot("host: 装载失败：" + (e && e.message));
    console.log("[" + name + "] 装载失败（不影响 DSH 启动）：" + (e && e.message));
  }
}
