// 规则库网上备份/发布（v0.1.13）
// 设计红线：① 只有显式动作才跑 git，绝不挂 hook；② 写工作区前逐文件 .bak-时间戳 + sha256 校验；
// ③ 发公开库必须先「标记为好状态」＋脱敏扫描零命中，否则拒绝；④ 顶层函数不偷外层作用域（经验库 L3），配置一律当参数传。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const DEFAULT_FILES = "AGENTS.md,沟通词典.md,错题本.md,卡点卡.md,_symptom_cards.md,数据源地图.md,本机工具箱.md,运作体系-*.md,排障方法卡.md,动作一本通.md,参照物库.md,短卡-开工前必读.md,交活自检清单.md,防修坏-护栏.md,_timing.md";
export const DEFAULT_DIRS = "尺子,规则书,契约卡";
// 公开库默认只放方法，不放你的原话与病例（错题本/词典/本机工具箱/数据源地图/台账/运作体系都不在列）
export const DEFAULT_PUBLIC_FILES = "AGENTS.md,卡点卡.md,_symptom_cards.md,排障方法卡.md,动作一本通.md,短卡-开工前必读.md,交活自检清单.md,防修坏-护栏.md";
export const DEFAULT_PUBLIC_DIRS = "尺子,规则书,契约卡";

const MANIFEST = "XWIDE-MANIFEST.json";

function stamp() { return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, ""); }
function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }
function listFiles(dir, patterns) {
  const out = [];
  for (const raw of patterns) {
    const p = String(raw || "").trim();
    if (!p) continue;
    if (p.includes("*")) {
      const base = p.split("*")[0];
      try { for (const f of fs.readdirSync(dir)) if (f.startsWith(base)) out.push(f); } catch { /* 目录不存在＝零命中 */ }
    } else if (fs.existsSync(path.join(dir, p))) out.push(p);
  }
  return [...new Set(out)].sort();
}
function listDirFiles(dir, dirs) {
  const out = [];
  for (const d of dirs) {
    const dd = String(d || "").trim();
    if (!dd) continue;
    const abs = path.join(dir, dd);
    if (!fs.existsSync(abs)) continue;
    let ents = [];
    try { ents = fs.readdirSync(abs, { recursive: true }); } catch { continue; }
    for (const f of ents) {
      const rel = path.posix.join(dd, String(f).replace(/\\/g, "/"));
      try { if (fs.statSync(path.join(dir, rel)).isFile()) out.push(rel); } catch { /* 中途被删跳过 */ }
    }
  }
  return out.sort();
}
// 收集要传的文件 → { rel: { bytes, sha, abs } }
export function collect(workspace, filesPat, dirsList) {
  const set = {};
  const pats = (filesPat || []).map(s => String(s).trim()).filter(Boolean);
  const dl = (dirsList || []).map(s => String(s).trim()).filter(Boolean);
  for (const rel of [...listFiles(workspace, pats), ...listDirFiles(workspace, dl)]) {
    // .bak-时间戳 是恢复时生成的原件备份，不是正文；混进快照就是 v0.1.10 npm 那次同类毛病
    if (/\.bak-/.test(rel) || rel === MANIFEST) continue;
    const abs = path.join(workspace, rel);
    try {
      const buf = fs.readFileSync(abs);
      set[rel] = { bytes: buf.length, sha: sha256(buf), abs };
    } catch { /* 读不到就跳过，不编造 */ }
  }
  return set;
}

function git(cfg, cwd, args, allowFail) {
  const exe = cfg.gitExe || "git";
  try {
    const o = execFileSync(exe, args, { cwd, encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, text: String(o || "").trim() };
  } catch (e) {
    const text = String((e && (e.stderr || e.stdout || e.message)) || e).trim();
    if (allowFail) return { ok: false, text };
    throw new Error("git " + args.join(" ") + " 失败：" + text.slice(0, 300));
  }
}
function ensureClone(cfg, key, url) {
  const dir = path.join(cfg.dataDir, key);
  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.mkdirSync(dir, { recursive: true });
    git(cfg, dir, ["init", "-b", "master"], false);
    if (url) {
      git(cfg, dir, ["remote", "add", "origin", url], true);
      git(cfg, dir, ["fetch", "--depth", "1", "origin"], true);
      git(cfg, dir, ["checkout", "-B", "master", "origin/master"], true);
    }
  }
  return dir;
}
function commitAll(cfg, dir, msg, tag) {
  git(cfg, dir, ["add", "-A"], false);
  const st = git(cfg, dir, ["status", "--porcelain"], true);
  if (!st.text) return { committed: false, sha: git(cfg, dir, ["rev-parse", "HEAD"], true).text || "" };
  git(cfg, dir, ["-c", "user.name=XWIDE", "-c", "user.email=xwide@users.noreply.github.com", "commit", "-m", msg], false);
  const sha = git(cfg, dir, ["rev-parse", "HEAD"], false).text;
  if (tag) git(cfg, dir, ["tag", tag], true);
  return { committed: true, sha };
}
function pushIfRemote(cfg, dir, tag) {
  // 实测（_probe_gitpush.cjs 对照1/2）：push --follow-tags origin HEAD:master 只推分支不推 tag；显式 push origin <tag> 才上去
  const r = git(cfg, dir, ["remote", "get-url", "origin"], true);
  if (!r.ok || !/^https?:|^file:|^git@/.test(r.text)) return "本地提交（没配远程仓，零上传）";
  const p = git(cfg, dir, ["push", "origin", "HEAD:refs/heads/master"], true);
  if (!p.ok) return "推送失败：" + p.text.slice(0, 200);
  if (!tag) return "已推送分支 → " + r.text;
  const pt = git(cfg, dir, ["push", "origin", "refs/tags/" + tag], true);
  return pt.ok ? "已推送分支＋tag " + tag + " → " + r.text : "分支已推，tag 推送失败：" + pt.text.slice(0, 200);
}

// ── 状态：工作区现状 vs 上次快照清单 ────────────────────────────────
export function rulesStatus(cfg) {
  const lines = [];
  const ws = cfg.workspace;
  if (!ws || !fs.existsSync(ws)) return { ok: false, lines: ["找不到工作区目录：" + ws + "（设 DSH_WORKSPACE 或在设置里指）"], changed: [], cur: {} };
  const cur = collect(ws, cfg.files, cfg.dirs);
  const clone = path.join(cfg.dataDir, "rules-private");
  let last = null;
  try { last = JSON.parse(fs.readFileSync(path.join(clone, MANIFEST), "utf8")); } catch { /* 还没备份过 */ }
  const total = Object.values(cur).reduce((a, b) => a + b.bytes, 0);
  lines.push("要管的文件：" + Object.keys(cur).length + " 个，共 " + total.toLocaleString("en") + " B");
  if (!last) { lines.push("网上/本地快照：还没有一次（先点「备份到私有库」）"); return { ok: true, lines, changed: Object.keys(cur).map(rel => ({ rel, state: "新增" })), cur }; }
  const prev = last.files || {};
  const changed = [];
  for (const rel of Object.keys(cur)) {
    if (!prev[rel]) changed.push({ rel, state: "新增" });
    else if (prev[rel].sha !== cur[rel].sha) changed.push({ rel, state: "已改" });
  }
  for (const rel of Object.keys(prev)) if (!cur[rel]) changed.push({ rel, state: "工作区已删" });
  lines.push("上次快照：" + (last.stamp || "?") + " tag=" + (last.tag || "-") + " sha=" + String(last.sha || "").slice(0, 8) + "（" + Object.keys(prev).length + " 个文件）");
  lines.push(changed.length ? ("与上次快照相比变了 " + changed.length + " 个：" + changed.map(c => c.rel + "(" + c.state + ")").join("、")) : "与上次快照一致（零漂移）");
  return { ok: true, lines, changed, cur, last };
}

// ── 备份到私有库（显式动作；只往插件目录复制，不写工作区）──────────────
export function rulesSnapshot(cfg, note) {
  const st = rulesStatus(cfg);
  if (!st.ok) return { ok: false, text: st.lines.join("\n") };
  const dir = ensureClone(cfg, "rules-private", cfg.privateRepo);
  let n = 0;
  for (const [rel, info] of Object.entries(st.cur)) {
    const dst = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, fs.readFileSync(info.abs));
    n++;
  }
  const tag = "snap-" + stamp();
  const files = {};
  for (const [rel, info] of Object.entries(st.cur)) files[rel] = { bytes: info.bytes, sha: info.sha };
  const man = { stamp: stamp(), tag, sha: "", files, note: String(note || "") };
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(man, null, 2), "utf8");
  const c = commitAll(cfg, dir, "snapshot " + tag + " " + (note || "").slice(0, 60), tag);
  // 实测教训：提交后再 --amend 会把 tag 留在被换掉的旧提交上，推送就推不到 tag；所以只回填清单、不改历史
  man.sha = c.sha || "";
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(man, null, 2), "utf8");
  const push = pushIfRemote(cfg, dir, tag);
  fs.writeFileSync(path.join(cfg.dataDir, "last-snapshot.json"), JSON.stringify({ tag, sha: c.sha, stamp: man.stamp, files: n }, null, 2), "utf8");
  return { ok: true, text: "备份完成：" + n + " 个文件 → tag " + tag + "，sha " + String(c.sha).slice(0, 8) + "\n" + push + "\n回滚：git -C \"" + dir + "\" checkout " + tag, tag, sha: c.sha, files: n };
}

// ── 标记「我认为这是好状态」（勾一下）──────────────────────────────
export function rulesMarkGood(cfg, note) {
  const dir = path.join(cfg.dataDir, "rules-private");
  let man;
  try { man = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), "utf8")); } catch { return { ok: false, text: "还没有任何快照，先点「备份到私有库」再勾。" }; }
  const good = { id: man.tag, sha: man.sha || "", stamp: man.stamp, note: String(note || ""), markedAt: new Date().toISOString() };
  const f = path.join(cfg.dataDir, "good.json");
  let list = [];
  try { list = JSON.parse(fs.readFileSync(f, "utf8")); } catch { list = []; }
  list.push(good);
  fs.writeFileSync(f, JSON.stringify(list, null, 2), "utf8");
  return { ok: true, text: "已标记为好状态：" + good.id + "（sha " + String(good.sha).slice(0, 8) + "）。现在可以点「把这份存到公开库」。", good };
}
export function goodList(cfg) {
  try { return JSON.parse(fs.readFileSync(path.join(cfg.dataDir, "good.json"), "utf8")); } catch { return []; }
}

// ── 脱敏扫描：零命中才允许发公开库 ────────────────────────────────
const SCAN = [
  ["盘符绝对路径", /[A-Za-z]:[\\/]{1,2}[^\s"'）)]{2,}/g],
  ["本机用户名 Administrator", /Administrator/g],
  ["npm 令牌", /npm_[A-Za-z0-9]{16,}/g],
  ["GitHub 令牌", /ghp_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9]{16,}/g],
  ["密码/密钥字面", /(password|passwd|secret|api[_-]?key|token)\s*[:=：]\s*[A-Za-z0-9_\-]{8,}/gi],
  ["邮箱", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ["手机号", /\b1[3-9]\d{9}\b/g],
];
export function scanText(text, extra) {
  const hits = [];
  for (const [name, re] of SCAN) {
    re.lastIndex = 0;
    const m = String(text).match(re);
    if (m && m.length) hits.push({ name, n: m.length, sample: String(m[0]).slice(0, 40) });
  }
  for (const raw of (extra || [])) {
    const s = String(raw || "").trim();
    if (!s) continue;
    try {
      const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      const m = String(text).match(re);
      if (m && m.length) hits.push({ name: "自定义：" + s, n: m.length, sample: s });
    } catch { /* 坏正则跳过 */ }
  }
  return hits;
}

// ── 发公开库：必须先勾好状态；扫描零命中；只拷白名单 ───────────────
export function rulesPublishPublic(cfg, id) {
  const goods = goodList(cfg);
  if (!goods.length) return { ok: false, text: "没勾过「我认为这是好状态」，不发公开库。（这是硬闸，不是提示）" };
  const pick = id ? goods.filter(g => g.id === id) : goods.slice(-1);
  if (!pick.length) return { ok: false, text: "找不到那个勾：" + id + "。已标记的有：" + goods.map(g => g.id).join("、") };
  const good = pick[pick.length - 1];
  const priv = path.join(cfg.dataDir, "rules-private");
  let man;
  try { man = JSON.parse(fs.readFileSync(path.join(priv, MANIFEST), "utf8")); } catch { return { ok: false, text: "私有快照清单读不到，不发。" }; }
  if (man.tag !== good.id) return { ok: false, text: "最新快照(" + man.tag + ") ≠ 你勾的那份(" + good.id + ")。要发哪份就先把那份重新备份再勾，别发混了。" };

  const pubFiles = collect(priv, cfg.publicFiles, cfg.publicDirs);
  const hits = [];
  for (const [rel, info] of Object.entries(pubFiles)) {
    const t = fs.readFileSync(info.abs, "utf8");
    for (const h of scanText(t, cfg.scanExtra)) hits.push(Object.assign({ rel }, h));
  }
  if (hits.length) {
    return { ok: false, text: "脱敏扫描没过：命中 " + hits.length + " 处，公开库不发布。\n" +
      hits.slice(0, 12).map(h => "· " + h.rel + " → " + h.name + " ×" + h.n + "（例：" + h.sample + "）").join("\n") +
      "\n处理：把这些内容从公开白名单里去掉（rules.publicFiles / rules.publicDirs），自定义词放 rules.scanExtra。" };
  }
  const dir = ensureClone(cfg, "rules-public", cfg.publicRepo);
  for (const rel of fs.readdirSync(dir, { recursive: true })) {
    const r = String(rel).replace(/\\/g, "/");
    if (r === MANIFEST || r === ".git" || r.startsWith(".git/")) continue;
    try { fs.rmSync(path.join(dir, r), { recursive: true, force: true }); } catch { /* 空目录跳过 */ }
  }
  let n = 0;
  for (const [rel, info] of Object.entries(pubFiles)) {
    const dst = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, fs.readFileSync(info.abs));
    n++;
  }
  const tag = "rules-" + (cfg.publicVersion || stamp());
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify({ fromSnapshot: man.tag, markedAt: good.markedAt, stamp: stamp(), files: pubFiles }, null, 2), "utf8");
  const c = commitAll(cfg, dir, "publish " + tag + "（来自私有快照 " + man.tag + "，扫描零命中）", tag);
  const push = pushIfRemote(cfg, dir, tag);
  return { ok: true, text: "公开库发布：" + n + " 个方法文件 → tag " + tag + "\n脱敏扫描：零命中（扫了 " + Object.keys(pubFiles).length + " 个文件）\n" + push, tag, files: n };
}

// ── 从私有库拿回来（写工作区前逐文件 .bak + sha 校验）───────────────
export function rulesRestore(cfg, tag) {
  const dir = path.join(cfg.dataDir, "rules-private");
  if (!fs.existsSync(dir)) return { ok: false, text: "插件里还没有私有库副本（data\\rules-private）。先备份一次，或在另一台机器配 rules.privateRepo 再拉。" };
  if (cfg.privateRepo) git(cfg, dir, ["pull", "--ff-only", "origin", "master"], true);
  if (tag) git(cfg, dir, ["checkout", tag], false);
  let man;
  try { man = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), "utf8")); } catch { return { ok: false, text: "快照清单读不到，不恢复（不自作主张写你的文件）。" }; }
  const ws = cfg.workspace;
  if (!ws || !fs.existsSync(ws)) return { ok: false, text: "找不到工作区目录：" + ws };
  const s = stamp();
  const done = [];
  for (const [rel, info] of Object.entries(man.files || {})) {
    const src = path.join(dir, rel);
    if (!fs.existsSync(src)) continue;
    const buf = fs.readFileSync(src);
    if (sha256(buf) !== info.sha) return { ok: false, text: "快照内文件校验不合：" + rel + "（期望 " + String(info.sha).slice(0, 8) + "，实得 " + sha256(buf).slice(0, 8) + "）——停手，一个字节都不写。" };
    const dst = path.join(ws, rel);
    if (fs.existsSync(dst)) fs.copyFileSync(dst, dst + ".bak-" + s);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, buf);
    done.push(rel);
  }
  if (tag) git(cfg, dir, ["checkout", "master"], true);
  return { ok: true, text: "恢复完成：" + done.length + " 个文件（来自 " + (man.tag || "?") + "）。原件已备份为 *.bak-" + s + "\n逐文件核对：sha256 全对才写的。", files: done.length, stamp: s };
}
