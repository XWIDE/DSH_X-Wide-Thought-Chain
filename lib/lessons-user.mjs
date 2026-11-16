// lib/lessons-user.mjs · 用户侧自长经验库（插件自己的 data\ 目录，零依赖）
// 设计：随包发布的 lib/lessons.json 是作者的 12 条；这一层是使用者自己攒的，
// 只在插件 data\lessons-user.json 里，升级插件不动它，也不进 npm 包。
import fs from "node:fs";
import path from "node:path";

const FIELDS = ["when", "wrong", "right", "evidence", "rule"];

function file(dataDir) { return path.join(dataDir, "lessons-user.json"); }
function pendingFile(dataDir) { return path.join(dataDir, "pending-review.json"); }

export function loadUser(dataDir) {
  try {
    const j = JSON.parse(fs.readFileSync(file(dataDir), "utf8"));
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

function saveUser(dataDir, list) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file(dataDir), JSON.stringify(list, null, 2), "utf8");
}

// 归一化用于查重：去空白与标点，取前 60 字
function keyOf(o) {
  const s = String(o.rule || "") + "|" + String(o.when || "");
  return s.toLowerCase().replace(/[\s。，,。.、；;：:"'`（）()\[\]／/\\-]+/g, "").slice(0, 60);
}

export function addUser(dataDir, entry) {
  const missing = FIELDS.filter((f) => !String((entry && entry[f]) || "").trim());
  if (missing.length) return { ok: false, text: "缺字段：" + missing.join("、") + "（六项要齐：触发/做错/做对/读数/规则，id 与时间自动生成）" };
  const list = loadUser(dataDir);
  const k = keyOf(entry);
  const hit = list.find((x) => keyOf(x) === k);
  if (hit) {
    // 重犯计数：第二次同一件事 → 升 promoted（对应「同一个错只允许犯两次」）
    hit.hits = (hit.hits || 1) + 1;
    hit.lastSeen = new Date().toISOString();
    if (hit.hits >= 2) hit.promoted = true;
    saveUser(dataDir, list);
    return { ok: true, text: "已合并到第 " + hit.id + " 条（第 " + hit.hits + " 次命中" + (hit.promoted ? "，已升为硬线条目" : "") + "），没新增重复条目" };
  }
  const n = list.length + 1;
  const rec = { id: "U" + String(n).padStart(2, "0"), when: entry.when.trim(), wrong: entry.wrong.trim(), right: entry.right.trim(), evidence: entry.evidence.trim(), rule: entry.rule.trim(), hits: 1, promoted: false, created: new Date().toISOString() };
  list.push(rec);
  saveUser(dataDir, list);
  return { ok: true, text: "新增 " + rec.id + "（现共 " + list.length + " 条，注入前 N 条进下一轮）" };
}

export function pruneUser(dataDir, keep) {
  const list = loadUser(dataDir);
  const k = Math.max(1, Math.min(list.length, Number(keep) || list.length));
  const cut = list.slice(-k);
  saveUser(dataDir, cut);
  return { ok: true, text: "裁到最近 " + cut.length + " 条（删掉 " + (list.length - cut.length) + " 条旧的）" };
}

// 注入用：取最近 N 条（新的在前），每条压成两行（规则＋触发），带「重犯已升」标记
export function userLessonLines(list, n) {
  if (!Array.isArray(list) || !list.length || n <= 0) return [];
  return list.slice(-n).reverse().map((x) => "· [U" + (x.promoted ? "↑" : "") + "] " + x.rule + "\n  触发：" + x.when);
}

// 复盘请求：斜杠命令写一个待办，注入段看见它就要求助手当场产出 lesson 并清掉
export function askReview(dataDir, note) {
  fs.mkdirSync(dataDir, { recursive: true });
  const p = { askedAt: new Date().toISOString(), note: String(note || "").slice(0, 200), done: false };
  fs.writeFileSync(pendingFile(dataDir), JSON.stringify(p, null, 2), "utf8");
  return p;
}
export function readPending(dataDir) {
  try {
    const p = JSON.parse(fs.readFileSync(pendingFile(dataDir), "utf8"));
    return p && p.done === false ? p : null;
  } catch { return null; }
}
export function clearPending(dataDir) {
  try { fs.rmSync(pendingFile(dataDir), { force: true }); return true; } catch { return false; }
}
