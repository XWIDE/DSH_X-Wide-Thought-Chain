// diff + 语法检查：分模块验收的裁判。git 列出「盘上真改了哪些文件」，逐个过语法闸。
// 只读不写任何文件；零绝对路径字面量（路径全从参数来）；顶层函数不偷外层作用域。
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(exe, args, cwd, ms) {
  return new Promise((resolve) => {
    const p = execFile(exe, args, { cwd, timeout: ms || 10000, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
    p.on("error", () => resolve({ code: -1, stdout: "", stderr: "spawn failed: " + exe }));
  });
}

// PATH 自动探测 python（零配置）：探到缓存结果，只探一次
let pyProbe;
async function probePy(run) {
  if (pyProbe !== undefined) return pyProbe;
  for (const c of ["python", "py"]) {
    const r = await run(c, ["--version"], process.cwd(), 8000);
    if (r.code === 0) { pyProbe = c; return c; }
  }
  pyProbe = "";
  return "";
}
const SYNTAX_EXT = /\.(js|cjs|mjs|json|py)$/i;

export async function diffCheck(opts) {
  const o = opts || {};
  const repo = String(o.repo || "").trim() || process.cwd();
  const gitExe = String(o.gitExe || "git").trim() || "git";
  const pyExe = String(o.pyExe || "").trim();
  const nodeExe = String(o.nodeExe || "").trim() || process.execPath;
  const maxFiles = Math.max(1, Number(o.maxFiles) || 50);
  // claims＝AI 声称改过的文件清单（相对/绝对均可）；声称改了、git 里没有＝没执行，直接 FAIL
  const claims = Array.isArray(o.claims) ? o.claims.map((c) => String(c || "").trim()).filter(Boolean) : [];

  if (!fs.existsSync(repo)) return { ok: false, text: "目录不存在：" + repo };
  const st = await run(gitExe, ["status", "--porcelain"], repo, 15000);
  if (st.code !== 0) {
    return { ok: false, text: "git 不可用或这里不是仓库（code=" + st.code + "）\n" + (st.stderr || st.stdout).slice(0, 400) + "\n仓库=" + repo + "（自检仓库=插件自带规则库；工具调用时传对仓库路径）。" };
  }
  const lines = st.stdout.split(/\r?\n/).filter(Boolean);
  // porcelain: "XY path"；X/Y 为 M/A/?/D…；跳过删除(D)，重命名取目标路径
  const changed = [];
  for (const l of lines) {
    const xy = l.slice(0, 2), f = l.slice(3).trim();
    if (!f || xy.includes("D")) continue;
    if (f.includes("->")) { const t = f.split("->").pop().trim(); if (t) changed.push(t.replace(/^"|"$/g, "")); }
    else changed.push(f.replace(/^"|"$/g, ""));
  }
  const targets = changed.filter((f) => SYNTAX_EXT.test(f));
  const skipped = changed.length - targets.length;
  const list = targets.slice(0, maxFiles);

  const rows = [];
  let fails = 0;
  for (const rel of list) {
    const abs = path.resolve(repo, rel);
    if (!fs.existsSync(abs)) { rows.push("⊘ " + rel + "（列在 diff 里但盘上不存在）"); continue; }
    let r;
    if (/\.json$/i.test(rel)) {
      try { JSON.parse(fs.readFileSync(abs, "utf8")); r = { code: 0, stderr: "" }; }
      catch (e) { r = { code: 1, stderr: String(e && e.message) }; }
    } else if (/\.py$/i.test(rel)) {
      if (!pyExe && !(await probePy(run))) { rows.push("⊘ " + rel + "（未配 diffcheck.pyExe，跳过 py 语法检查）"); continue; }
      r = await run((pyExe || await probePy(run)), ["-m", "py_compile", abs], repo, 20000);
    } else {
      r = await run(nodeExe, ["--check", abs], repo, 20000);
    }
    if (r.code === 0) rows.push("✅ " + rel);
    else { fails++; rows.push("❌ " + rel + "\n   " + String(r.stderr || "").split(/\r?\n/).slice(0, 4).join("\n   ")); }
  }

  // 声称项核验：AI 说「我改了 X」→ X 必须出现在 git 改动清单里，缺席＝没执行
  const changedAbs = new Set(changed.map((f) => path.resolve(repo, f).toLowerCase()));
  let missClaims = 0;
  const claimRows = [];
  for (const c of claims) {
    const abs = path.resolve(repo, c);
    if (changedAbs.has(abs.toLowerCase())) claimRows.push("✅ 声称项 " + c + "（盘上确有改动）");
    else { missClaims++; claimRows.push("❌ 声称项 " + c + " —— git 改动里没有 ＝ 说改了、实际没执行"); }
  }
  const bad = fails + missClaims;

  const head = [
    "diff+语法检查 · 仓库=" + repo,
    "改动文件 " + changed.length + " 个（语法类 " + list.length + " 个，非语法类跳过 " + skipped + " 个" + (targets.length > maxFiles ? "，超限截断 " + (targets.length - maxFiles) + " 个" : "") + "）",
  ];
  const verdict = bad === 0 && list.length > 0 ? "GATE PASS" : (bad === 0 && list.length === 0 ? "GATE PASS（无语法类改动，没东西可查——确认你改的文件类型对不对）" : "GATE FAIL");
  const text = head.join("\n") + (claimRows.length ? "\n声称项核验 " + claims.length + " 项：\n" + claimRows.join("\n") : "") + "\n" + (rows.length ? rows.join("\n") : "（没有改动文件）") + "\n判定：" + verdict;
  return { ok: bad === 0, text, verdict, files: list, fails: bad };
}
