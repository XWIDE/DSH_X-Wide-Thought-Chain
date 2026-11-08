// ═══════════════════════════════════════════════════════════════════════════
// DSH_X-Wide-Thought-Chain · 客户端半部（web）v0.1.6
//
// 这是「设置侧栏那一行」的唯一正解：官方 settings.section 槽是 root list 槽，
// 只有插件的**客户端半部**注册进去，设置中心导航才会出现这一页。
// （host 侧 ctx.settings.register 只让命名空间能持久化，不产生条目——实测。）
//
// 形状全部照本机成功样本 dsh-ui-tools 量出来的写法，不猜 API：
//   · 入口格式 window.__ModuleLoader__.load({id, factory:(require)=>{…}}）  样本 :75-81 / :4142-4146
//   · React 走 require("react")                                            样本 :82
//   · CSS 用 <style data-plugin-css> 挂 document.head                       样本 :3914-3919
//   · 槽注册 ctx.slots.inject("settings.section", …)                        样本 :4048-4055
//   · 读写走 fetch POST /api/xwide/settings（同源 cookie 鉴权在内核里）      样本 :1895-1899
//
// 界面纪律（尺子/02）：字号只用 15/14/13/12；次级说明 rgba(255,255,255,.70)
// ＝深色底实测 9.4:1；输入框与按钮 ≥32px；无通配选择器、无 !important 刷颜色；
// 宿主配色一律继承（currentColor），深浅两底都不写死。
// ═══════════════════════════════════════════════════════════════════════════

window.__ModuleLoader__.load({
	id: "dsh-xwide-thought-chain",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");

		const API_PATH = "/api/xwide/settings";
		const NS = "xwide-thought-chain-settings";

		const ZH = {
			"nav.label": "X-Wide 思考链",
			"title": "X-Wide 思考链",
			"loading": "正在读取设置…",
			"loadFail": "读不到设置（宿主侧路由未注册？重启插件后重试）",
			"saving": "保存中…",
			"saved": "已保存并留备份",
			"saveFail": "保存失败",
			"scopeTitle": "生效范围",
			"scopeBody": "数值/开关改完立刻写进插件的 data\\settings.json：工具与自检当场读到新值；注入到 systemPrompt 的那段要等下次启动才换。退回：dsh_xwide_thought_chain_rollback(restore=true)",
			"default": "默认",
			"a11y.toggle": "切换 {label}"
		};
		const EN = {
			"nav.label": "X-Wide Thought Chain",
			"title": "X-Wide Thought Chain",
			"loading": "Loading settings…",
			"loadFail": "Cannot read settings (host route not registered? reload the plugin)",
			"saving": "Saving…",
			"saved": "Saved, backup kept",
			"saveFail": "Save failed",
			"scopeTitle": "Where it takes effect",
			"scopeBody": "Edits are written straight into the plugin's data\\settings.json: tools and self-check read the new value immediately; the systemPrompt section refreshes on next start. Rollback: dsh_xwide_thought_chain_rollback(restore=true)",
			"default": "default",
			"a11y.toggle": "Toggle {label}"
		};

		// 只用 4 档字号（15/14/13/12）；颜色一律继承宿主，次级说明 .70 白＝9.4:1。
		const CSS = [
			".xw-set{max-width:820px;padding:4px 0 24px;line-height:1.5}",
			".xw-set h2.xw-h{font-size:15px;font-weight:600;margin:0 0 4px}",
			".xw-set .xw-ver{font-size:13px;font-weight:600;opacity:.7;margin:0 0 16px}",
			".xw-set .xw-note{font-size:13px;font-weight:600;opacity:.7;margin:0 0 16px;padding:8px 12px;border:1px solid currentColor;border-radius:8px;opacity:.7}",
			".xw-set .xw-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.18)}",
			".xw-set .xw-txt{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}",
			".xw-set .xw-label{font-size:14px;font-weight:400;word-break:break-word}",
			".xw-set .xw-desc{font-size:13px;font-weight:600;opacity:.7;word-break:break-word}",
			".xw-set .xw-def{font-size:12px;font-weight:600;opacity:.7}",
			".xw-set input.xw-in{height:32px;min-width:140px;padding:8px;font-size:14px;color:inherit;background:transparent;border:1px solid currentColor;border-radius:8px}",
			".xw-set input.xw-num{height:32px;width:110px;padding:8px;font-size:14px;color:inherit;background:transparent;border:1px solid currentColor;border-radius:8px}",
			".xw-set input.xw-sw{width:32px;height:32px;accent-color:currentColor;cursor:pointer;flex:none}",
			".xw-set input.xw-in:focus,.xw-set input.xw-num:focus,.xw-set input.xw-sw:focus{outline:2px solid currentColor;outline-offset:2px}",
			".xw-set .xw-status{font-size:13px;font-weight:600;opacity:.7;margin-top:12px;white-space:pre-wrap;word-break:break-word}"
		].join("\n");

		function Row(props) {
			const h = react.createElement;
			const { meta, value, t, onSet } = props;
			const label = meta.key;
			const common = { "aria-label": t("a11y.toggle", { label }) };
			let control = null;
			if (meta.type === "boolean") {
				control = h("input", {
					type: "checkbox", className: "xw-sw", checked: value === true, ...common,
					onChange: (e) => onSet(meta.key, e.target.checked)
				});
			} else if (meta.type === "number") {
				control = h("input", {
					type: "number", className: "xw-num", defaultValue: value, ...common,
					onBlur: (e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onSet(meta.key, v); }
				});
			} else {
				control = h("input", {
					type: "text", className: "xw-in", defaultValue: value, ...common,
					onBlur: (e) => onSet(meta.key, e.target.value)
				});
			}
			return h("div", { className: "xw-row", key: meta.key }, [
				h("div", { className: "xw-txt" }, [
					h("span", { className: "xw-label" }, label),
					h("span", { className: "xw-desc" }, meta.desc),
					h("span", { className: "xw-def" }, t("default") + ": " + JSON.stringify(meta.def))
				]),
				control
			]);
		}

		function XwSettingsSection(props) {
			const h = react.createElement;
			const t = props && props.t;
			const [state, setState] = react.useState({ loading: true, items: [], cur: {}, version: "", error: "" });
			const [status, setStatus] = react.useState("");

			const call = react.useCallback((body) => fetch(API_PATH, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			}).then((r) => (r.status === 404 || r.status === 405 ? Promise.reject(new Error("route-missing")) : r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))), []);

			react.useEffect(() => {
				let alive = true;
				call({ action: "get" }).then((d) => {
					if (!alive) return;
					setState({ loading: false, items: d.items || [], cur: d.cur || {}, version: d.version || "", error: "" });
				}).catch(() => {
					if (!alive) return;
					setState({ loading: false, items: [], cur: {}, version: "", error: "fail" });
				});
				return () => { alive = false; };
			}, [call]);

			const onSet = react.useCallback((key, value) => {
				setStatus(t("saving"));
				call({ action: "set", key, value }).then((d) => {
					setStatus((d && d.ok ? t("saved") + "\n" : t("saveFail") + "\n") + String((d && d.text) || ""));
					if (d && d.cur) setState((s) => ({ ...s, cur: d.cur }));
				}).catch((e) => setStatus(t("saveFail") + "：" + String((e && e.message) || e)));
			}, [call, t]);

			if (state.loading) return h("div", { className: "xw-set" }, [h("p", { className: "xw-ver" }, t("loading"))]);
			if (state.error) return h("div", { className: "xw-set" }, [h("p", { className: "xw-ver" }, t("loadFail"))]);

			return h("div", { className: "xw-set" }, [
				h("h2", { className: "xw-h" }, t("title")),
				h("p", { className: "xw-ver" }, "v" + state.version + " · " + state.items.length + " 项"),
				h("p", { className: "xw-note" }, [
					h("strong", null, t("scopeTitle") + "："),
					" " + t("scopeBody")
				]),
				state.items.map((m) => Row({ key: m.key, meta: m, value: state.cur[m.key], t, onSet })),
				h("div", { className: "xw-status", role: "status" }, status)
			]);
		}

		function apply(ctx) {
			// 自报通道：心跳＝证明 web 侧真装载了；注册报错原文 POST 回宿主，写进插件 data\boot.log
			const report = (body) => { try { fetch(API_PATH, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {}); } catch (e) {} };
			report({ action: "ping" });
			try {
				if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function") { report({ action: "client-error", msg: "无 ctx.slots.inject；形状=" + Object.keys(ctx || {}).join(",") }); return; }
				ctx.effect(() => {
					if (typeof document === "undefined") return;
					const tagId = "dsh-xwide-thought-chain/styles";
					const existing = document.querySelector('style[data-plugin-css="' + tagId + '"]');
					if (existing !== null) return () => existing.remove();
					const tag = document.createElement("style");
					tag.dataset.plugin = "dsh-xwide-thought-chain";
					tag.dataset.pluginCss = tagId;
					tag.textContent = CSS;
					document.head.appendChild(tag);
					return () => tag.remove();
				}, "xwide: settings page styles");

				ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), "xwide: settings page dictionaries");
				const t = ctx.locale.bind(NS);

				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "xwide-thought-chain",
					order: 140,
					label: () => t("nav.label"),
					locale: NS,
					inject: () => ({ t })
				}, XwSettingsSection));
				console.log("[dsh-xwide-thought-chain] 客户端设置页已注册进 settings.section（id xwide-thought-chain）");
			} catch (e) {
				report({ action: "client-error", msg: String((e && e.stack) || (e && e.message) || e).slice(0, 400) });
				console.log("[dsh-xwide-thought-chain] 客户端设置页注册失败（不影响启动）：" + (e && e.message));
			}
		}

		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	}
});
