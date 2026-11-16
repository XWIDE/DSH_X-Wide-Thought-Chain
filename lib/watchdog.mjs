// ═══════════════════════════════════════════════════════════════════════════
// watchdog.mjs · 8080 看门狗内核（v0.1.16）
//
// 这是「之前那个真有作用的看门狗」_strata_watchdog.ps1 核心逻辑的 Node 移植版
// ——不是空壳。原脚本在 2026-11-04 实测多次测到 8080 DOWN(check 2/2) → 跑
// RESTART-optimized.bat → 重启后复验 back up，日志默认写插件 data\watchdog.log。
// 搬的就是那套判据，逐条对应：
//   · TCP 真连接探活（不用 Get-NetTCPConnection，沙箱里它少报）—— 同 Test-Up
//   · 连续 downChecks 次确认才算 DOWN（躲一次抖动）           —— 同 downs 计数
//   · cooldownSec + maxPerHour 防重启风暴                      —— 同 restarts 滑窗
//   · 拉起 launcher 并记下它吐出的每一行                        —— 同 & cmd /c
//   · 重启后等 20s 复验端口                                     —— 同 RESTART OK/PENDING
//   · 双日志路径（主目录写不进就退到回退路径）                   —— 同 Write-WLog 的 foreach
//
// 设计纪律（吃本包自己的药）：零依赖、源码零绝对路径字面量（launcher/log 全从设置传入）、
// 探测/拉起全程 try/catch，绝不抛错连累宿主。默认 enabled=false（自杀红线：拉起会杀 8080）。
// ═══════════════════════════════════════════════════════════════════════════

import net from "node:net";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

// 读活引擎的当前模型 id（OpenAI 兼容 /v1/models）。零依赖，用 node:http。
// 优先返回「在 launchers 表里出现过的 id」（最精确），否则第一个非别名主 id；读不到返回 ""。
export function readActiveModel(port, launchers = {}, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    let req;
    try {
      req = http.get({ host: "127.0.0.1", port, path: "/v1/models", timeout: timeoutMs }, (res) => {
        let body = "";
        res.on("data", (b) => { body += b; if (body.length > 200000) req.destroy(); });
        res.on("end", () => {
          try {
            const data = JSON.parse(body).data || [];
            const primary = data.filter((d) => !d.alias_of);
            const withKey = primary.find((d) => Object.prototype.hasOwnProperty.call(launchers, d.id))
              || data.find((d) => Object.prototype.hasOwnProperty.call(launchers, d.id));
            finish(withKey ? withKey.id : (primary[0] && primary[0].id) || (data[0] && data[0].id) || "");
          } catch { finish(""); }
        });
      });
      req.on("timeout", () => { req.destroy(); finish(""); });
      req.on("error", () => finish(""));
    } catch { finish(""); }
  });
}

// 真 TCP 连接探活：3 秒内连上 127.0.0.1:port 返回 true，连不上/超时 false。
export function probePort(port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; try { sock.destroy(); } catch {} resolve(v); } };
    const sock = net.connect({ host: "127.0.0.1", port });
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    sock.once("close", () => finish(false));
  });
}

function stamp() { return new Date().toISOString().replace("T", " ").slice(0, 19); }

// 双日志：主路径写不进就退到回退路径（照原脚本 Write-WLog）。log 是函数注入，插件侧可并入 boot.log。
function makeLogger(logPath, fallbackPath, injectLog) {
  return function wlog(msg) {
    const line = stamp() + "  " + msg;
    for (const p of [logPath, fallbackPath]) {
      if (!p) continue;
      try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.appendFileSync(p, line + "\n", "utf8"); return; } catch {}
    }
    if (typeof injectLog === "function") { try { injectLog("watchdog: " + msg); } catch {} }
  };
}

// 拉起启动器并收集它 stdout/stderr 的一行文本（照原脚本 & cmd /c "launcher" 2>&1）。
function runLauncher(launcher, wlog) {
  return new Promise((resolve) => {
    let out = "";
    let child;
    try {
      child = spawn("cmd.exe", ["/c", launcher], { windowsHide: true, shell: false });
    } catch (e) { wlog("RESTART FAILED: spawn 异常 " + (e && e.message)); resolve(false); return; }
    const grab = (b) => { out += String(b); if (out.length > 4000) out = out.slice(0, 4000); };
    if (child.stdout) child.stdout.on("data", grab);
    if (child.stderr) child.stderr.on("data", grab);
    child.on("error", (e) => { wlog("RESTART FAILED: " + (e && e.message)); resolve(false); });
    // 启动器内部会 start 引擎后自己退出；不等它跑完整个 2-3 分钟，只把已吐的行记下来。
    child.on("close", () => {
      const oneLine = out.replace(/\r?\n/g, " | ").trim().slice(0, 500);
      if (oneLine) wlog("RESTART launcher output: " + oneLine);
      resolve(true);
    });
  });
}

// 工厂：apply() 用 setInterval 周期调用 tick()。opts 全从设置来（零绝对路径字面量）。
export function createWatchdog(opts = {}) {
  const port = Number(opts.port) || 8080;
  const downChecks = Math.max(1, Number(opts.downChecks) || 2);
  const cooldownSec = Math.max(60, Number(opts.cooldownSec) || 300);
  const maxPerHour = Math.max(1, Number(opts.maxPerHour) || 4);
  const launcher = String(opts.launcher || "");
  // modelLaunchers：模型 id → 启动器路径 的映射（设置里传 JSON 字符串或对象）。
  let launchers = opts.modelLaunchers;
  if (typeof launchers === "string") { try { launchers = JSON.parse(launchers); } catch { launchers = {}; } }
  if (!launchers || typeof launchers !== "object") launchers = {};
  const dryRun = !!opts.dryRun;
  const wlog = makeLogger(opts.logPath, opts.fallbackLog, opts.injectLog);

  let downs = 0;
  let restarts = [];   // Date[] 滑窗，用于 cooldown + maxPerHour
  let lastBeat = 0;
  let busy = false;    // 一次 tick 没跑完不重入（拉起+复验是异步的）
  let lastKnownModel = "";  // 健康期记下的「上一个活着的模型 id」，DOWN 时用它选对启动器
  const state = { startedAt: stamp(), probes: 0, restarts: 0, lastResult: "init", lastKnownModel: "" };

  // 按当前/最后已知模型选启动器；表里没有退到兜底 launcher。返回 {path, why}。
  function pickLauncher() {
    if (lastKnownModel && Object.prototype.hasOwnProperty.call(launchers, lastKnownModel))
      return { path: launchers[lastKnownModel], why: "model=" + lastKnownModel };
    return { path: launcher, why: lastKnownModel ? ("no-launcher-for-model=" + lastKnownModel + " → fallback") : "no-model-known → fallback" };
  }

  wlog("WATCHDOG START port=" + port + " downChecks=" + downChecks + " cooldown=" + cooldownSec + "s maxPerHour=" + maxPerHour + " dryRun=" + dryRun);

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      state.probes++;
      const up = await probePort(port);
      if (up) {
        if (downs > 0) wlog("PORT " + port + " back up after " + downs + " down-check(s)");
        downs = 0;
        state.lastResult = "up";
        // 健康期顺手记当前活模型 id，DOWN 时用它选对启动器（自发现）。
        const m = await readActiveModel(port, launchers);
        if (m && m !== lastKnownModel) { lastKnownModel = m; state.lastKnownModel = m; wlog("active model = " + m); }
        const now = Date.now();
        if (now - lastBeat >= 30 * 60 * 1000) { wlog("heartbeat: port " + port + " listening"); lastBeat = now; }
        return;
      }
      downs++;
      wlog("port " + port + " DOWN (check " + downs + "/" + downChecks + ")");
      state.lastResult = "down " + downs + "/" + downChecks;
      if (downs < downChecks) return;

      const now = new Date();
      restarts = restarts.filter((d) => (now - d) / 1000 < cooldownSec);
      if (restarts.length >= maxPerHour) {
        wlog("RESTART SKIPPED: " + restarts.length + " restarts within cooldown window (limit " + maxPerHour + ") - needs a human");
        downs = 0; state.lastResult = "skipped(cap)";
        return;
      }
      const pick = pickLauncher();
      if (!pick.path) { wlog("RESTART SKIPPED: launcher 未配置（看门狗设置 watchdog.launcher / watchdog.modelLaunchers）"); downs = 0; state.lastResult = "no-launcher"; return; }
      if (dryRun) { wlog("DRYRUN: would run " + pick.path + " (" + pick.why + ")"); downs = 0; restarts.push(now); state.restarts++; state.lastResult = "dryrun:" + pick.why; return; }
      if (!fs.existsSync(pick.path)) { wlog("RESTART SKIPPED: launcher missing (" + pick.path + ")"); downs = 0; state.lastResult = "launcher-missing"; return; }

      wlog("RESTART: running " + pick.path + " (" + pick.why + ")");
      downs = 0; restarts.push(now); state.restarts++; state.lastResult = "restarting";
      await runLauncher(pick.path, wlog);
      // 复验：引擎要 2-3 分钟，等 20s 探一次，连不上只报 PENDING（下一轮 tick 继续判）。
      await new Promise((r) => setTimeout(r, 20000));
      const back = await probePort(port);
      wlog(back ? ("RESTART OK: port " + port + " listening") : ("RESTART PENDING: port " + port + " not listening yet (engine can take 2-3 min)"));
      state.lastResult = back ? "restart-ok" : "restart-pending";
    } catch (e) {
      wlog("WATCHDOG tick 异常: " + (e && e.message));
    } finally {
      busy = false;
    }
  }

  return { tick, status: () => ({ ...state, downs, inCooldownWindow: restarts.length }) };
}
