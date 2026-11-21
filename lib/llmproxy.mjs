// ⑨b LLM 反代流水：在本机端口上收 /v1/chat/completions，转发给真引擎，逐条记账。
// 目的＝唯一能记全的通道（宿主 SDK 不走 globalThis.fetch，实测零命中）。
// 纪律：字节透传（响应原样 pipe 给调用方），记账只读旁路；任何异常只 502＋记日志，绝不抛到宿主。
import http from "node:http";
import fs from "node:fs";

function tally(text) {
  let contentLen = 0, reasonLen = 0, finish = null, compTok = null, toolCalls = 0;
  const heads = []; // 空正文时要知道「它想完就 stop 前最后一句在想什么」：记思考首尾各一段
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const p = line.slice(6);
    if (p === "[DONE]") break;
    if (!p.includes('"delta"') && !p.includes('"usage"')) continue;
    let j; try { j = JSON.parse(p); } catch { continue; }
    const d = j.choices && j.choices[0];
    if (d && d.delta) {
      if (typeof d.delta.content === "string") contentLen += d.delta.content.length;
      if (Array.isArray(d.delta.tool_calls)) toolCalls += d.delta.tool_calls.length;
      if (typeof d.delta.reasoning_content === "string") {
        reasonLen += d.delta.reasoning_content.length;
        heads.push(d.delta.reasoning_content); // 空轮要整段思考（响应侧已有 4MB 记账上限兜底），首尾切片只进流水行
      }
    }
    if (d && d.finish_reason) finish = d.finish_reason;
    if (j.usage && typeof j.usage.completion_tokens === "number") compTok = j.usage.completion_tokens;
  }
  const head = heads.join("");
  return { contentLen, reasonLen, finish, compTok, toolCalls, thinkAll: head, thinkHead: head.slice(0, 200), thinkTail: head.length > 200 ? head.slice(-200) : null };
}

function tallyJson(txt) {
  let j = null; try { j = JSON.parse(txt); } catch {}
  const m = j && j.choices && j.choices[0] && j.choices[0].message;
  const r = m && m.reasoning_content ? String(m.reasoning_content) : "";
  return {
    contentLen: m && typeof m.content === "string" ? m.content.length : (m && m.content == null ? 0 : -1),
    reasonLen: r.length,
    finish: j && j.choices && j.choices[0] ? j.choices[0].finish_reason : null,
    compTok: j && j.usage ? j.usage.completion_tokens : null,
    toolCalls: m && Array.isArray(m.tool_calls) ? m.tool_calls.length : 0,
    thinkAll: r,
    thinkHead: r.slice(0, 200), thinkTail: r.length > 200 ? r.slice(-200) : null,
  };
}

export function startLlmProxy({ listenPort, upstreamPort = 8080, file, log }) {
  if (globalThis.__xwLlmProxy) return "已启动（跳过）";
  globalThis.__xwLlmProxy = true;
  const stamp = () => new Date().toTimeString().slice(0, 12);
  const emit = (rec) => { try { fs_append(file, rec); } catch {} };
  const srv = http.createServer((req, res) => {
    const chunks = []; // 必须按 Buffer 收：逐块 toString 会在多字节边界把中文切坏
    req.on("data", (c) => { chunks.push(c); });
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const rec = { t: stamp(), url: req.url, listen: listenPort };
      try {
        const b = JSON.parse(body || "{}");
        rec.model = b.model; rec.maxTok = b.max_tokens; rec.stream = !!b.stream;
        rec.msgs = (b.messages || []).length;
        rec.imgs = (b.messages || []).reduce((n, m) => n + (Array.isArray(m.content) ? m.content.filter((p) => p && p.type === "image_url").length : 0), 0);
        rec.bodyBytes = Buffer.byteLength(body);
      } catch { rec.bodyFail = true; }
      const t0 = Date.now();
      const upHdr = () => { // 重试时 body 变长：content-length 必须让 Node 自己算，否则引擎只读旧长度→JSON 被截断
        const h = Object.assign({}, req.headers, { host: "127.0.0.1:" + upstreamPort });
        delete h["content-length"]; delete h["transfer-encoding"];
        return h;
      };
      const writeSide = () => {
        try { fs.appendFileSync(file.replace(/\.jsonl$/, "") + "_empty.txt", "=== " + rec.t + " finish=" + rec.finish + " compTok=" + rec.compTok + " reasonLen=" + rec.reasonLen + (rec.retry ? " [这一趟是重试前那一轮]" : "") + " ms=" + rec.ms + "\n" + (rec.thinkAll || "(无思考)") + "\n\n", "utf8"); } catch {}
        rec.sideWritten = true;
      };
      const finalize = () => { // 收口：立完成即记账（空轮整段思考落 side 文件）
        if (rec.zero && !rec.sideWritten) {
          try { fs.appendFileSync(file.replace(/\.jsonl$/, "") + "_empty.txt", "=== " + rec.t + " finish=" + rec.finish + " compTok=" + rec.compTok + " reasonLen=" + rec.reasonLen + " ms=" + rec.ms + "\n" + (rec.thinkAll || "(无思考)") + "\n\n", "utf8"); } catch {}
        }
        delete rec.thinkAll; // 整段只进 side 文件，流水行不被撑爆
        emit(rec);
        if (log) log("llmproxy: " + (rec.zero ? "空正文" : "有正文") + " finish=" + rec.finish + " compTok=" + rec.compTok + " reasonLen=" + rec.reasonLen + " ms=" + rec.ms + (rec.retry ? (rec.retryZero ? " [重试后仍空]" : " [重试救回]") : ""));
      };
      const up = http.request({ host: "127.0.0.1", port: upstreamPort, path: req.url, method: req.method, headers: upHdr() }, (ur) => {
        const acc = []; let accBytes = 0;
        let pend = Buffer.alloc(0); // 只扣住尾部 ≤8KB：空正文时这尾巴不能先发出去，否则宿主已判「本轮结束」，重试插不进去
        const flush = (force) => {
          if (force) { if (pend.length) res.write(pend); pend = Buffer.alloc(0); return; }
          if (pend.length > 8192) { res.write(pend.slice(0, pend.length - 8192)); pend = pend.slice(-8192); }
        };
        ur.on("data", (c) => {
          if (accBytes < 4e6) { acc.push(c); accBytes += c.length; } // 只用于记账，上限 4MB
          pend = Buffer.concat([pend, c]); flush(false); // 字节透传，只慢 8KB
        });
        ur.on("end", () => {
          rec.ms = Date.now() - t0; rec.status = ur.statusCode;
          const txt = Buffer.concat(acc).toString("utf8");
          try { Object.assign(rec, /text\/event-stream/.test(String(ur.headers["content-type"])) ? tally(txt) : tallyJson(txt)); } catch (e) { rec.parseFail = String(e && e.message); }
          rec.zero = rec.contentLen === 0 && !rec.toolCalls; // 判据（随读数改，第 3 次）：空正文＋没调工具＝用户说的「什么都没返回」
          // 病根（2026-11-22 实测 4/4）：模型在思考块里写到反引号就吐 EOS，`<｜end▁of▁thinking｜>` 从未出现 ⇒ 正文 0 字、finish=stop。
          // 修法＝模型无关的兜底：这一轮空且是自然结束，就压着尾巴重来一次（追加一句直接回答的催促），重试的流照常透传给宿主。
          let b2 = null;
          if (rec.zero && rec.finish === "stop" && rec.reasonLen > 0 && !rec.retry) {
            try { b2 = JSON.parse(body); } catch {}
            if (b2) {
              writeSide(); // 重试前先把这一轮的整段思考落盘：救回来也留证据（不然 side 文件就空了）
              rec.retry = true; rec.retrySent = true;
              b2.messages = (b2.messages || []).concat([{ role: "user", content: "（上一轮你只输出了思考、没有正文就结束了。这一轮请直接给结论，不要输出思考过程，不要引用代码块。）" }]);
              const up2 = http.request({ host: "127.0.0.1", port: upstreamPort, path: req.url, method: req.method, headers: upHdr() }, (r2) => {
                const acc2 = []; let n2 = 0;
                r2.on("data", (c) => { res.write(c); if (n2 < 4e6) { acc2.push(c); n2 += c.length; } });
                r2.on("end", () => {
                  res.end();
                  try { Object.assign(rec, /text\/event-stream/.test(String(r2.headers["content-type"])) ? tally(Buffer.concat(acc2).toString("utf8")) : tallyJson(Buffer.concat(acc2).toString("utf8"))); } catch {}
                  rec.retryZero = rec.contentLen === 0 && !rec.toolCalls;
                  rec.zero = rec.retryZero; // 重试后还空才算真症状；救回来就不算
                  finalize();
                });
              });
              up2.on("error", (e) => { rec.retryFail = String(e && e.message); flush(true); res.end(); finalize(); });
              up2.end(JSON.stringify(b2));
              return;
            }
          }
          flush(true); res.end(); finalize();
        });
      });
      up.on("error", (e) => {
        rec.ms = Date.now() - t0; rec.upstreamFail = String(e && e.message); emit(rec);
        if (log) log("llmproxy: 转发失败 " + rec.upstreamFail);
        try { res.writeHead(502, { "content-type": "application/json" }); res.end('{"error":"llmproxy upstream fail"}'); } catch {}
      });
      up.end(body);
    });
    req.on("error", () => { try { res.destroy(); } catch {} });
  });
  srv.on("error", (e) => { if (log) log("llmproxy: 监听失败 " + (e && e.message)); });
  srv.listen(listenPort, "127.0.0.1");
  if (typeof srv.unref === "function") srv.unref();
  return "已启动 listen=127.0.0.1:" + listenPort + " -> 127.0.0.1:" + upstreamPort + " file=" + file;
}

function fs_append(file, rec) { fs.appendFileSync(file, JSON.stringify(rec) + "\n", "utf8"); }
