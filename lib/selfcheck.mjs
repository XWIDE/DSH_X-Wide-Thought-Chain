// ═══════════════════════════════════════════════════════════════════════════
// lib/selfcheck.mjs · X-Wide 思考链 的零依赖自检内核  v0.1.0
// 只用 node 内置模块。DSH 里由 xwide_selfcheck 调用；也能命令行直跑：
//     node lib/selfcheck.mjs            人读表
//     node lib/selfcheck.mjs --json     机器读
//     node lib/selfcheck.mjs --deep     连 profile 的 local-plugins 一起扫
// 检查项（每项都带 rollback＝怎么退／怎么修）：
//   C1 版本三处一致（package.json / index.js / CHANGELOG.md）
//   C2 自家源码零绝对路径字面量（本包纪律，防"安装改名即静默失效"）
//   C3 插件模块能 import + apply 不抛错（装载自检）
//   C4 配方清单缺件（data/inventory.json 逐条 existsSync）
//   C5 路径漂移扫描（扫源码里的盘符字面量，逐个查存在性）
//   C6 崩溃日志通道新鲜度（提示启动器是否在用）
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, "..");

const read = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
// inventory 里允许写占位符：%USERPROFILE% / $env: 前缀 / ~ 开头，都展开成运行期真实路径（源码里不写死盘符）
function resolvePlaceholders(p) {
  let s = String(p || "");
  s = s.replace(/%([A-Za-z_]+)%/g, (_m, k) => process.env[k] !== undefined ? process.env[k] : "%" + k + "%");
  s = s.replace(/^\$env:([A-Za-z_]+)[\\/]/, (_m, k) => (process.env[k] !== undefined ? process.env[k] : "") + path.sep);
  if (s.startsWith("~")) s = (process.env.USERPROFILE || process.env.HOME || "~") + s.slice(1);
  return s;
}

function versionFiles() {
  const out = {};
  try { out.pkg = JSON.parse(read(path.join(PKG, "package.json"))).version || ""; } catch { out.pkg = ""; }
  const m = read(path.join(PKG, "index.js")).match(/export const version\s*=\s*"([^"]+)"/);
  out.index = m ? m[1] : "";
  const c = read(path.join(PKG, "CHANGELOG.md")).match(/#+\s*\[?(\d+\.\d+\.\d+)\]?/);
  out.changelog = c ? c[1] : "";
  return out;
}

// 扫源码里的盘符字面量；返回 [{file, line, path, exists}]
function scanLiterals(dirs, label) {
  const hits = [];
  const re = /["'`]([A-Za-z]:[^"'`\r\n]{2,300})["'`]/g;
  for (const dir of dirs) {
    if (!exists(dir)) continue;
    const stack = [dir];
    let seen = 0;
    while (stack.length && seen < 4000) {
      const d = stack.pop();
      let ents = [];
      try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".git") stack.push(p); continue; }
        if (!/\.(cjs|mjs|js)$/i.test(e.name)) continue;
        seen++;
        const sz = (() => { try { return fs.statSync(p).size; } catch { return 0; } })();
        if (sz > 500000) continue;
        const lines = read(p).split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue; // 注释里的旧名当病历留着，不算漂移
          let m; re.lastIndex = 0;
          while ((m = re.exec(l))) {
            const raw = m[1].replace(/\\\\/g, "\\");
            hits.push({ file: p, line: i + 1, path: raw, ok: exists(raw), label });
          }
        }
      }
    }
  }
  return hits;
}

export async function selfcheck({ settings = {}, schema = [], version = "", args = {} } = {}) {
  const S = Object.assign({ "selfcheck.pathDrift": true, "selfcheck.scanDirs": "", "selfcheck.inventoryFile": "inventory.json", "selfcheck.staleLogHours": 72, "chain.maxFindings": 12 }, settings);
  const results = [];
  const push = (id, name, pass, detail, rollback) => results.push({ id, name, pass: !!pass, detail: String(detail).slice(0, 900), rollback: String(rollback || "").slice(0, 500) });

  // C1 版本三处一致
  const v = versionFiles();
  const same = v.pkg && v.index && v.changelog && v.pkg === v.index && v.index === v.changelog;
  push("C1", "版本三处一致", same, "package.json=" + v.pkg + " / index.js=" + v.index + " / CHANGELOG=" + v.changelog,
    same ? "" : "把三处版本号改成同一个（发布纪律：改代码必 bump 版本）");

  // C2 自家源码零绝对路径字面量
  const own = scanLiterals([PKG, path.join(HERE)], "self");
  const ownBad = own.filter(h => !h.ok);
  push("C2", "自家源码零死路径", ownBad.length === 0, ownBad.length ? ownBad.slice(0, 5).map(h => path.basename(h.file) + ":" + h.line + " → " + h.path).join(" | ") : "扫了 " + own.length + " 处盘符字面量，全存活",
    ownBad.length ? "改用 import.meta.url / process.env 派生路径，别写死安装目录" : "");

  // C3 装载自检：import 本包 index.js 并对桩 ctx 跑一遍 apply
  let loadOk = false, loadDetail = "";
  try {
    const mod = await import(pathToFileURL(path.join(PKG, "index.js")).href);
    const registered = [];
    const sections = [];
    const stubCtx = { tools: { register: (d) => { if (!d || !d.name) throw new Error("工具定义缺 name"); registered.push(d.name); } }, systemPrompt: { section: (s) => { if (!s || !s.text) throw new Error("systemPrompt 段缺 text"); sections.push(s.name); } } };
    mod.apply(stubCtx, {});
    loadOk = registered.length >= 4 && sections.length >= 0;
    loadDetail = "apply 通过：注册 " + registered.length + " 个工具 [" + registered.join(",") + "]，注入段 " + sections.length + " 个";
  } catch (e) { loadDetail = "import/apply 抛错：" + (e && e.message); }
  push("C3", "装载自检（真 import + apply）", loadOk, loadDetail, loadOk ? "" : "语法与形状先过：node --check index.js；再 npm run selfcheck");

  // C4 配方清单缺件
  const invName = String(S["selfcheck.inventoryFile"] || "inventory.json");
  const invPath = path.join(PKG, "data", invName);
  const invExample = path.join(PKG, "data", "inventory.example.json");
  if (!exists(invPath) && exists(invExample)) {
    push("C4", "配方清单（inventory）", true, "未定制：现用 data\\inventory.example.json（把 inventory.example.json 复制成 " + invName + " 填你自己的路径）", "copy data\\inventory.example.json data\\" + invName);
  } else if (!exists(invPath)) {
    push("C4", "配方清单（inventory）", false, "找不到 " + invPath + "，也没有 example 模板", "重装本包，或从仓库 data\\ 目录补回模板");
  } else {
    let list = [];
    try { list = JSON.parse(read(invPath)).items || []; } catch (e) { push("C4", "配方清单（inventory）", false, "JSON 解析失败：" + e.message, "校验 data\\" + invName + " 是否合法 JSON"); list = null; }
    if (list) {
      const miss = list.filter(it => it.path && !it.optional && !exists(resolvePlaceholders(it.path)));
      const opt = list.filter(it => it.path && it.optional && !exists(resolvePlaceholders(it.path)));
      push("C4", "配方清单（inventory）", miss.length === 0, "登记 " + list.length + " 条" + (opt.length ? "（其中 " + opt.length + " 条标了 optional，缺了不算红）" : "") + (miss.length ? "，缺 " + miss.length + " 条：" + miss.slice(0, 6).map(m => m.name).join(",") : "，全在"),
        miss.length ? "缺的条目：重装对应插件，或在 inventory 里把它标 \"optional\": true 后重跑" : "");
    }
  }

  // C5 路径漂移扫描（外部目录）
  if (S["selfcheck.pathDrift"]) {
    const dirs = String(S["selfcheck.scanDirs"] || "").split(";").map(s => s.trim()).filter(Boolean);
    if (args.deep) {
      const home = process.env.USERPROFILE || process.env.HOME || "";
      if (home) dirs.push(path.join(home, ".dsh", "profiles", "desktop", "local-plugins"));
    }
    const hits = scanLiterals(dirs, "ext");
    const dead = hits.filter(h => !h.ok);
    push("C5", "路径漂移扫描", dead.length === 0,
      dirs.length ? ("扫了 " + dirs.length + " 个目录共 " + hits.length + " 处盘符字面量" + (dead.length ? "；死路径 " + dead.length + " 处：" + dead.slice(0, 6).map(h => path.basename(h.file) + ":" + h.line).join(", ") : "，全存活")) : "未指定扫描目录（设 selfcheck.scanDirs 或加 --deep）",
      dead.length ? "把死路径换成运行期派生（process.execPath / env 派生根），别写死安装目录名" : "");
  } else {
    push("C5", "路径漂移扫描", true, "已按设置关闭（selfcheck.pathDrift=false）", "");
  }

  // C6 崩溃日志通道新鲜度
  const hours = Number(S["selfcheck.staleLogHours"]);
  if (!hours) push("C6", "崩溃日志通道", true, "已关闭（staleLogHours=0）", "");
  else {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const log = path.join(home, "logs", "harness.log");
    if (!exists(log)) push("C6", "崩溃日志通道", false, "没有 " + log + "：启动时 stdout/stderr 没被收，插件看不到崩溃行", "用一个把 stdout/stderr 重定向到该文件的启动器启动 DSH（README「崩溃日志通道」一节）");
    else {
      const ageH = (Date.now() - fs.statSync(log).mtimeMs) / 3600000;
      push("C6", "崩溃日志通道", ageH <= hours, "日志 " + Math.round(ageH) + " 小时前写过（阈值 " + hours + " 小时）", ageH <= hours ? "" : "日志长期不动＝启动器没在用，检查启动方式");
    }
  }

  const max = Math.max(1, Number(S["chain.maxFindings"]) || 12);
  const n = results.filter(r => r.pass).length;
  const verdict = n === results.length ? "SELFCHECK = PASS " + n + "/" + results.length : "SELFCHECK = NOT-PASS " + n + "/" + results.length;
  let text;
  if (args.json) text = JSON.stringify({ version: v.pkg, results, verdict }, null, 2);
  else {
    const lines = ["X-WIDE SELF-CHECK v" + (version || v.pkg) + " @ " + new Date().toISOString()];
    for (const r of results.slice(0, max)) {
      lines.push("[" + (r.pass ? "通过" : "缺项") + "] " + r.id + " " + r.name + "  —— " + r.detail);
      if (!r.pass && r.rollback) lines.push("        处方：" + r.rollback);
    }
    lines.push(verdict);
    text = lines.join("\n");
  }
  return { ok: n === results.length, status: n === results.length ? 0 : 1, text, results, verdict };
}

// ── 命令行入口 ─────────────────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const argv = process.argv.slice(2);
  const settings = (() => { try { return JSON.parse(read(path.join(PKG, "data", "settings.json"))); } catch { return {}; } })();
  let schema = [], version = "";
  try { const m = await import(pathToFileURL(path.join(PKG, "index.js")).href); schema = m.SETTINGS_SCHEMA || []; version = m.version || ""; } catch { }
  const r = await selfcheck({ settings, schema, version, args: { json: argv.includes("--json"), deep: argv.includes("--deep") } });
  console.log(r.text);
  process.exit(r.status);
}
