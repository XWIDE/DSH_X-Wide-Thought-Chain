// ═══════════════════════════════════════════════════════════════════════════
// bootcheck.mjs · 「重启前体检闸」（作用②：别让写程序把 DSH 写坏到开不了机）
//
// 用户原话钉死的作用：「不让他写程序，不写坏 DSH，不能让 DSH 它启动不了」。
// 这道闸在你点「重启 DSH」之前手动跑一次，把写坏的代码挡在开机前。扫两样东西：
//   ① 语法关：扫 profile 的 local-plugins 根目录下【全部插件】的 .js/.mjs/cjs，
//      对每个跑 `--check`（用宿主自带 node，零依赖）。DSH 启动时会装载这些插件，
//      任何一个语法不过＝下次装载必炸＝DSH 开不了机 → 判 FAIL，提示先别重启。
//   ② 崩溃签名关：tail harness.log 尾部，扫已知装载崩溃签名
//      （plugin tree failed to load / failed to apply loader entry /
//       duplicate loader entry id / SyntaxError / Cannot find module）。
//      命中＝上次启动真被这类问题砸过 → 报出来当证据。
// 全程 try/catch，绝不抛错连累宿主。源码零绝对路径字面量（路径全从入参/env 派生）。
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const CRASH_SIGNATURES = [
  /plugin tree failed to load/i,
  /failed to apply loader entry/i,
  /duplicate loader entry id/i,
  /Cannot find module/i,
  /SyntaxError/,
];

function walkJs(dir, out) {
  let names;
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of names) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "data" || e.name.startsWith(".")) continue;
      walkJs(full, out);
    } else if (/\.(js|mjs|cjs)$/.test(e.name)) {
      out.push(full);
    }
  }
}

// 语法关：用宿主进程自己当 node（ELECTRON_RUN_AS_NODE），跑 --check。
function syntaxCheckFiles(files) {
  const bad = [];
  for (const f of files) {
    let r;
    try {
      r = spawnSync(process.execPath, ["--check", f], {
        env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
        encoding: "utf8",
        timeout: 15000,
      });
    } catch (e) {
      bad.push({ file: f, msg: "spawn 失败: " + ((e && e.message) || e) });
      continue;
    }
    if (r.error) { bad.push({ file: f, msg: "spawn 错误: " + r.error.message }); continue; }
    if (r.status !== 0) {
      const tail = String(r.stderr || "").split("\n").filter(Boolean).slice(-3).join(" | ");
      bad.push({ file: f, msg: (tail || ("exit " + r.status)) });
    }
  }
  return bad;
}

// 崩溃签名关：tail 日志尾部，扫已知崩溃签名。
function scanCrashLog(logPath, tailLines = 200) {
  if (!logPath) return { present: false, hits: [], note: "未传 logPath" };
  let raw;
  try { raw = fs.readFileSync(logPath, "utf8"); } catch (e) { return { present: false, hits: [], note: "读不到 " + logPath + "：" + ((e && e.message) || e) }; }
  const lines = raw.split("\n").slice(-tailLines);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (CRASH_SIGNATURES.some((re) => re.test(ln))) hits.push(ln.trim().slice(0, 240));
  }
  return { present: true, hits, note: "扫了尾 " + lines.length + " 行" };
}

export function bootCheck(opts = {}) {
  // 默认扫 profile 的 local-plugins 根（本插件 lib 往上两级）——DSH 启动装载的就是这一坨。
  const scanRoot = opts.scanRoot || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const logPath = opts.logPath || (function () {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    return home ? path.join(home, "logs", "harness.log") : "";
  })();

  const lines = [];
  let ok = true;

  // ① 语法关：扫 local-plugins 根下全部插件的 .js/.mjs/cjs
  const files = [];
  walkJs(scanRoot, files);
  const plugins = Array.from(new Set(files.map((f) => {
    const rel = path.relative(scanRoot, f);
    return rel.split(path.sep)[0] || "(根)";
  }))).sort();
  const bad = syntaxCheckFiles(files);
  if (!files.length) {
    ok = false;
    lines.push("① 语法关：扫描目录里没找到任何 .js/.mjs（dir=" + scanRoot + "）＝没东西可验，判失败。");
  } else if (bad.length) {
    ok = false;
    lines.push("① 语法关：✗ " + bad.length + "/" + files.length + " 个文件语法不过——重启后装载必炸、DSH 开不了机，先别重启：");
    for (const b of bad.slice(0, 12)) lines.push("   · " + path.relative(scanRoot, b.file) + ": " + b.msg);
  } else {
    lines.push("① 语法关：✓ " + plugins.length + " 个插件共 " + files.length + " 个 .js/.mjs 全部 --check 通过。");
    lines.push("   扫的插件：" + plugins.join("、"));
  }

  // ② 崩溃签名关
  const cr = scanCrashLog(logPath);
  if (!cr.present) {
    lines.push("② 崩溃日志关：（跳过）" + cr.note + "——这条没验到，不代表没问题。");
  } else if (cr.hits.length) {
    ok = false;
    lines.push("② 崩溃日志关：✗ 尾部命中 " + cr.hits.length + " 条装载崩溃签名（上次启动被这类问题砸过）：");
    for (const h of cr.hits.slice(0, 8)) lines.push("   · " + h);
  } else {
    lines.push("② 崩溃日志关：✓ " + cr.note + "，无已知崩溃签名。");
  }

  lines.push("");
  lines.push(ok ? "判定：✅ 体检通过——可以重启 DSH。" : "判定：⛔ 体检未过——先修上面标红的，别急着重启。");
  return { ok, lines, checked: files.length, badCount: bad.length, crashHits: cr.hits.length };
}
