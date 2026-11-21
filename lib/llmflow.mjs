// ⑨ 发送/接收流水：同进程内截 globalThis.fetch，专记「跑完一轮但正文为空 / completion tokens=0」。
// 只读旁路：不改请求体、不改响应体；解析失败一律吞掉，绝不影响宿主聊天。
import fs from "node:fs";

function parseSse(text) {
  let contentLen = 0, reasonLen = 0, finish = null, compTok = null;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const p = line.slice(6);
    if (p === "[DONE]") break;
    if (!p.includes('"delta"') && !p.includes('"usage"')) continue;
    let j; try { j = JSON.parse(p); } catch { continue; }
    const d = j.choices && j.choices[0];
    if (d && d.delta) {
      if (typeof d.delta.content === "string") contentLen += d.delta.content.length;
      if (typeof d.delta.reasoning_content === "string") reasonLen += d.delta.reasoning_content.length;
    }
    if (d && d.finish_reason) finish = d.finish_reason;
    if (j.usage && typeof j.usage.completion_tokens === "number") compTok = j.usage.completion_tokens;
  }
  return { contentLen, reasonLen, finish, compTok };
}

export function installLlmFlow({ file, log, port = 8080 }) {
  if (globalThis.__xwLlmFlow) return "已装载（跳过）";
  const orig = globalThis.fetch;
  if (typeof orig !== "function") return "宿主无 fetch，放弃";
  globalThis.__xwLlmFlow = true;
  const stamp = () => new Date().toTimeString().slice(0, 12);
  const emit = (rec) => { try { fs.appendFileSync(file, JSON.stringify(rec) + "\n", "utf8"); } catch {} };
  globalThis.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!url.includes("/chat/completions") || !url.includes(":" + port)) return orig.call(globalThis, input, init);
    const rec = { t: stamp(), port };
    try {
      const raw = (init && init.body) || (input && input.body);
      const b = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (b) {
        rec.model = b.model; rec.maxTok = b.max_tokens; rec.stream = !!b.stream;
        rec.msgs = (b.messages || []).length;
        rec.imgs = (b.messages || []).reduce((n, m) => n + (Array.isArray(m.content) ? m.content.filter((p) => p && p.type === "image_url").length : 0), 0);
      }
    } catch {}
    const t0 = Date.now();
    const res = await orig.call(globalThis, input, init);
    rec.ms = Date.now() - t0; rec.status = res.status;
    try {
      const cl = res.clone();
      Promise.resolve(cl.text()).then((txt) => {
        if (rec.stream) Object.assign(rec, parseSse(txt));
        else {
          let j = null; try { j = JSON.parse(txt); } catch {}
          const m = j && j.choices && j.choices[0] && j.choices[0].message;
          rec.contentLen = m && typeof m.content === "string" ? m.content.length : (m && m.content == null ? 0 : -1);
          rec.reasonLen = m && m.reasoning_content ? String(m.reasoning_content).length : 0;
          rec.finish = j && j.choices && j.choices[0] ? j.choices[0].finish_reason : null;
          rec.compTok = j && j.usage ? j.usage.completion_tokens : null;
        }
        rec.zero = rec.compTok === 0 || (rec.contentLen === 0);
        emit(rec);
        if (rec.zero && log) log("llmflow: 抓到空正文 finish=" + rec.finish + " compTok=" + rec.compTok + " reasonLen=" + rec.reasonLen + " 用时=" + rec.ms + "ms");
      }).catch(() => { rec.parseFail = true; emit(rec); });
    } catch (e) { rec.cloneFail = String(e && e.message); emit(rec); }
    return res;
  };
  return "已装载 port=" + port + " file=" + file;
}
