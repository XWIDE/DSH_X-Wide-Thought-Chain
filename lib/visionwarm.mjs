// visionwarm.mjs · 图像通道预热内核（v0.1.32）
//
// 治的病例（2026-11-21）：引擎冷启动后第一条带图消息要先把图像编码器拉上 GPU；
// 显存余量不够时 GPU 起不来，引擎会静默等满 STRATA_VISION_READY_S（默认 300 s）才转 CPU，
// 期间占住唯一槽位 → 界面上「发两次才回答」。
// 本模块在引擎端口刚恢复时，趁没人在聊天，先发一张 32×32 测试图把编码器热起来：
// 冷启动的 20 s 判失败 + 约 120 s CPU 热身发生在后台，用户发真图时编码器已经是热的。
//
// 纪律：零依赖、零绝对路径、任何失败只记日志不抛错（绝不连累宿主）。

import http from "node:http";
import net from "node:net";

// 32×32 纯色 PNG（220,30,30），192 字节。内容固定，避免每次现生成。
const PNG_32 = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAOklEQVR4nO3RQREAQAjDwHJC8C8KMSchfPhlBZSZUNOdS+90PR5Y8AfIRMhEyETIRMhEyETIRMhEIR/SgAFY1t5YwgAAAABJRU5ErkJggg==";

const BODY = JSON.stringify({
  model: "strata",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "ok" },
      { type: "image_url", image_url: { url: "data:image/png;base64," + PNG_32 } },
    ],
  }],
  max_tokens: 4,
  stream: false,
});

// 真 TCP 探活：连上就 true。
export function probePort(port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    let done = false;
    const sock = net.connect({ host: "127.0.0.1", port });
    const finish = (v) => { if (!done) { done = true; try { sock.destroy(); } catch {} resolve(v); } };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
  });
}

// 发一张测试图，量到首字节/整体耗时。永不 reject。
export function warmVision({ port = 8080, timeoutMs = 200000 } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; resolve({ ms: Date.now() - t0, ...r }); } };
    let req;
    try {
      req = http.request({
        host: "127.0.0.1", port, path: "/v1/chat/completions", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(BODY) },
        timeout: timeoutMs,
      }, (res) => {
        let bytes = 0;
        res.on("data", (c) => { bytes += c.length; });
        res.on("end", () => done({ ok: res.statusCode === 200, status: res.statusCode, bytes }));
        res.on("error", (e) => done({ ok: false, status: res.statusCode || 0, err: String(e && e.message || e) }));
      });
      req.on("timeout", () => { try { req.destroy(); } catch {} done({ ok: false, status: 0, err: "timeout " + Math.round(timeoutMs / 1000) + "s" }); });
      req.on("error", (e) => done({ ok: false, status: 0, err: String(e && e.message || e) }));
      req.write(BODY);
      req.end();
    } catch (e) {
      done({ ok: false, status: 0, err: String(e && e.message || e) });
    }
  });
}

// 周期看守：端口「断→通」那一刻排队预热一次；同一轮引擎启动只热一次。
export function createVisionWarmer(opts = {}) {
  const port = Number(opts.port) || 8080;
  const timeoutMs = Math.max(10000, Number(opts.timeoutS || 200) * 1000);
  const log = typeof opts.log === "function" ? opts.log : () => {};
  const delayMs = Math.max(0, Number(opts.settleSec != null ? opts.settleSec : 2) * 1000);
  let wasUp = false;
  let warmedForThisUp = false;
  let busy = false;
  let last = null;
  let timer = null;

  async function runWarm() {
    if (busy) return;
    busy = true;
    log("visionwarmer: 开始预热图像通道 port=" + port + "（最多等 " + Math.round(timeoutMs / 1000) + "s）");
    try {
      const r = await warmVision({ port, timeoutMs });
      last = r;
      const sec = (r.ms / 1000).toFixed(1);
      if (r.ok) log("visionwarmer: 预热完成 HTTP " + r.status + " 用时 " + sec + "s（首次带图不会再等冷启动）");
      else log("visionwarmer: 预热未成功（" + (r.err || ("HTTP " + r.status)) + "，用时 " + sec + "s）——引擎下次启动会再试");
    } catch (e) {
      log("visionwarmer: 预热异常 " + String(e && e.message || e));
    } finally {
      busy = false;
    }
  }

  async function tick() {
    let up = false;
    try { up = await probePort(port); } catch { up = false; }
    if (!up) {
      if (wasUp) log("visionwarmer: 端口 " + port + " 掉线，等它回来再热");
      wasUp = false;
      warmedForThisUp = false;
      return { up: false, warmed: false };
    }
    if (!wasUp) {
      wasUp = true;
      if (!warmedForThisUp) {
        warmedForThisUp = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { runWarm(); }, delayMs);
        if (typeof timer.unref === "function") timer.unref();
        return { up: true, warmed: false, scheduled: true };
      }
    }
    return { up: true, warmed: warmedForThisUp, last };
  }

  return { tick, warmNow: runWarm, get last() { return last; }, get busy() { return busy; } };
}
