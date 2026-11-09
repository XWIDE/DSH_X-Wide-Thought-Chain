// DSH_X-Wide-Thought-Chain · 客户端半部 v0.1.9
// 在 DSH 设置中心注册官方槽 settings.section，画出「X-Wide 思考链」那一行与它的设置页：
// 四个分类分块 + 预设档位一键批量应用（含自存档位）+ 数字项滑条 + 速度体检面板。
// 数据全走宿主侧 POST /api/xwide/settings；不依赖任何第三方包（react 由宿主提供）。
window.__ModuleLoader__.load({
	id: "dsh-xwide-thought-chain",
	factory: (require) => {
		const module = { exports: {} };
		const exports = module.exports;
		const react = require("react");

		const API_PATH = "/api/xwide/settings";
		const NS = "xwide-thought-chain-settings";

		const ZH = {
			"nav.label": "X-Wide 思考链",
			"page.title": "X-Wide 思考链",
			"page.loading": "读取设置…",
			"page.loadFail": "读不到设置：宿主读写通道没起来（看插件 data\\boot.log）",
			"page.saving": "保存中…",
			"page.saved": "已保存（新值下一轮生效；插件自身改动要重启）",
			"page.saveFail": "保存失败：",
			"preset.title": "档位（一次点一下，把下面四类一次配好）",
			"preset.saveName": "把这组当前值存成档位…",
			"preset.saveBtn": "存为档位",
			"preset.del": "删",
			"preset.applied": "已应用档位「",
			"speed.btn": "速度体检（只读盘上真值）",
			"speed.loading": "体检中…",
			"scope.title": "生效范围",
			"scope.body": "这里改的值：下一轮对话就生效。插件自身的代码改动：要重启 DSH 才装载。",
			"about.title": "怎么运作 · 记忆在哪 · 怎么守住之前犯过的错",
			"about.btn": "打开说明（读盘上真路径，不写任何东西）",
			"about.loading": "读取中…",
			"lessons.title": "这一版学到的规则（做错→做对，随包发布，只读）",
			"rules.title": "规则库网上备份与发布（私有仓＝自己的备份；公开仓＝你愿意分享的方法）",
			"rules.intro": "只有你点按钮才跑 git，插件里没有任何自动同步。「备份到私有仓」只把文件复制进插件目录的 data\\rules-private 并提交（不写你工作区）。「发公开库」要先勾「我认为这是好状态」，再点两次确认，而且必须先过脱敏扫描（盘符路径／Administrator／令牌／邮箱／手机号／自定义词零命中）——扫不过就拒绝发布，一个字节都不传。恢复＝从私有仓拿回来，每个原件先 .bak-时间戳，sha256 全对才写。仓库地址在设置第⑤组填：rules.privateRepo / rules.publicRepo（留空＝只本地提交，零上传）。",
			"rules.status": "看漂移（工作区 vs 上次快照）",
			"rules.snapshot": "备份到私有仓",
			"rules.good": "标记这次是好状态",
			"rules.tick": "我认为这是好状态（勾了才允许发公开库）",
			"rules.publish": "把这份存到公开库",
			"rules.publishArm": "再点一次＝确认发到公网",
			"rules.restore": "从私有仓拿回来",
			"rules.restoreArm": "再点一次＝确认写回工作区",
			"rules.busy": "跑 git 中…（这步会真读写磁盘/网络）",
			"def": "默认",
		};
		const EN = {
			"nav.label": "X-Wide Thought Chain",
			"page.title": "X-Wide Thought Chain",
			"page.loading": "Loading settings…",
			"page.loadFail": "Cannot load settings (host channel down — see plugin data\\boot.log)",
			"page.saving": "Saving…",
			"page.saved": "Saved (takes effect next turn; plugin code changes need a restart)",
			"page.saveFail": "Save failed: ",
			"preset.title": "Presets (one click sets the whole group below)",
			"preset.saveName": "Save current values as a preset…",
			"preset.saveBtn": "Save preset",
			"preset.del": "del",
			"preset.applied": "Preset applied: ",
			"speed.btn": "Speed check (read-only)",
			"speed.loading": "Checking…",
			"scope.title": "Scope",
			"scope.body": "Values here apply from the next turn. Plugin code changes need a DSH restart.",
			"about.title": "How it works · where memory lives · how past mistakes stay fixed",
			"about.btn": "Open the explanation (reads real paths, writes nothing)",
			"about.loading": "Reading…",
			"lessons.title": "What this version learned (mistake → fix, shipped in the package, read-only)",
			"rules.title": "Rules backup & publish (private repo = your own backup; public repo = the method you choose to share)",
			"rules.intro": "git runs only when you click — there is no auto-sync. \"Snapshot to private\" copies files into the plugin's own data\\rules-private and commits (it never writes your workspace). \"Publish public\" requires ticking \"this state is good\", a second confirming click, and a clean privacy scan (drive paths / Administrator / tokens / email / phone / custom words) — if the scan hits anything, nothing is uploaded. Restore pulls from the private repo, backing up every file as .bak-<stamp> and verifying sha256 before writing. Set repo URLs in group ⑤: rules.privateRepo / rules.publicRepo (empty = local commit only, zero upload).",
			"rules.status": "Check drift (workspace vs last snapshot)",
			"rules.snapshot": "Snapshot to private repo",
			"rules.good": "Mark this state as good",
			"rules.tick": "This state is good (required before publishing)",
			"rules.publish": "Publish this to the public repo",
			"rules.publishArm": "Click again = confirm upload to the internet",
			"rules.restore": "Restore from private repo",
			"rules.restoreArm": "Click again = confirm writing to workspace",
			"rules.busy": "Running git… (this really touches disk/network)",
			"def": "default",
		};

		const CSS = [
			".xw-set { display: flex; flex-direction: column; gap: 34px; font-size: 14px; line-height: 1.6; padding-bottom: 28px; }",
			".xw-set h2 { margin: 0; font-size: 15px; font-weight: 600; }",
			".xw-set .xw-meta { font-size: 13px; opacity: .7; }",
			".xw-set .xw-scope { font-size: 13px; opacity: .7; border-left: 2px solid currentColor; padding-left: 10px; line-height: 1.7; }",
			".xw-set .xw-scope b { font-size: 13px; }",
			// 分类之间用分隔线＋大间距隔开（使用者点名「排得太密」）
			".xw-set .xw-group { display: flex; flex-direction: column; gap: 16px; padding: 22px 0; border-top: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28)); }",
			".xw-set .xw-h3 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: .01em; }",
			".xw-set .xw-gdesc { font-size: 13px; opacity: .7; margin-bottom: 4px; }",
			".xw-set .xw-presets { display: flex; flex-wrap: wrap; gap: 14px 12px; align-items: center; }",
			".xw-set .xw-preset { min-height: 32px; padding: 0 14px; font: inherit; font-size: 13px; background: transparent; color: currentColor; border: 1px solid currentColor; border-radius: var(--dsw-radius-sm, 5px); cursor: pointer; }",
			".xw-set .xw-preset.on { font-weight: 600; }",
			// 档位颜色：用宿主主题状态色（深浅两底由宿主保证对比度），兜底色实测对深色底 ≥4.5:1（WCAG，最小 5.45）
			".xw-set .xw-tone-save { color: var(--dsw-alias-state-success-primary, #5cb98a); border-color: currentColor; }",
			".xw-set .xw-tone-fast { color: var(--dsw-alias-brand-primary, #6aa9ff); border-color: currentColor; }",
			".xw-set .xw-tone-precise { color: var(--dsw-alias-state-warn-primary, #d9a441); border-color: currentColor; }",
			".xw-set .xw-tone-debug { color: var(--dsw-alias-state-error-primary, #ec8894); border-color: currentColor; }",
			".xw-set .xw-tone-custom { color: var(--dsw-alias-label-secondary, currentColor); border-color: currentColor; }",
			".xw-set .xw-del { min-height: 32px; padding: 0 8px; font: inherit; font-size: 12px; background: transparent; color: currentColor; border: 1px solid currentColor; border-radius: var(--dsw-radius-sm, 5px); cursor: pointer; opacity: .7; }",
			".xw-set .xw-note { font-size: 12px; opacity: .7; width: 100%; line-height: 1.8; white-space: pre-line; margin-top: 6px; }",
			".xw-set .xw-save { display: flex; gap: 10px; align-items: center; }",
			".xw-set .xw-name { flex: 1; min-height: 32px; font: inherit; font-size: 13px; background: transparent; color: currentColor; border: 1px solid currentColor; border-radius: var(--dsw-radius-sm, 5px); padding: 0 10px; }",
			// 每项之间拉开：行距 14px，说明与控件之间 6px，项与项之间 20px
			".xw-set .xw-row { display: grid; grid-template-columns: minmax(170px, 240px) 1fr; gap: 6px 18px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.16)); }",
			".xw-set .xw-key { font-size: 14px; }",
			".xw-set .xw-desc { grid-column: 1 / 3; font-size: 12px; opacity: .7; line-height: 1.7; }",
			".xw-set .xw-input { min-height: 32px; font: inherit; font-size: 14px; background: transparent; color: currentColor; border: 1px solid currentColor; border-radius: var(--dsw-radius-sm, 5px); padding: 0 10px; width: 100%; }",
			".xw-set .xw-check { width: 32px; height: 32px; justify-self: start; accent-color: currentColor; }",
			".xw-set .xw-num { display: flex; align-items: center; gap: 12px; width: 100%; }",
			".xw-set .xw-range { flex: 1; height: 32px; background: transparent; color: currentColor; accent-color: currentColor; cursor: pointer; }",
			".xw-set .xw-bubble { font-size: 13px; min-width: 58px; text-align: right; font-variant-numeric: tabular-nums; }",
			".xw-set .xw-status { font-size: 13px; opacity: .7; white-space: pre-wrap; line-height: 1.7; padding: 12px 0; border-top: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28)); }",
			".xw-set .xw-pre { margin: 4px 0 0; font-size: 13px; font-family: ui-monospace, Consolas, monospace; white-space: pre-wrap; overflow-x: auto; line-height: 1.8; border-left: 2px solid currentColor; padding-left: 12px; }",
		].join("\n");

		function post(body) {
			return fetch(API_PATH, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			}).then((r) => r.json());
		}

		function Row(props) {
			const meta = props.meta, value = props.value, onSet = props.onSet;
			const local = react.useState(String(value));
			const draft = local[0], setDraft = local[1];
			if (meta.type === "boolean") {
				return react.createElement("div", { className: "xw-row", key: meta.key },
					react.createElement("label", { className: "xw-key" }, meta.key),
					react.createElement("input", {
						className: "xw-check", type: "checkbox", checked: !!value,
						onChange: (e) => onSet(meta.key, e.target.checked),
					}),
					react.createElement("div", { className: "xw-desc" }, meta.desc));
			}
			if (meta.type === "number" && typeof meta.min === "number" && typeof meta.max === "number") {
				const shown = Number(value);
				return react.createElement("div", { className: "xw-row", key: meta.key },
					react.createElement("label", { className: "xw-key" }, meta.key),
					react.createElement("div", { className: "xw-num" },
						react.createElement("input", {
							className: "xw-range", type: "range", min: meta.min, max: meta.max, step: 1, value: shown,
							onInput: (e) => setDraft(e.target.value),
							onPointerUp: () => { const v = Number(draft); if (v !== shown) onSet(meta.key, v); },
							onKeyUp: () => { const v = Number(draft); if (v !== shown) onSet(meta.key, v); },
							onChange: (e) => setDraft(e.target.value),
						}),
						react.createElement("span", { className: "xw-bubble" }, shown + " / " + meta.min + "-" + meta.max)),
					react.createElement("div", { className: "xw-desc" }, meta.desc));
			}
			return react.createElement("div", { className: "xw-row", key: meta.key },
				react.createElement("label", { className: "xw-key" }, meta.key),
				react.createElement("input", {
					className: "xw-input", type: "text", value: draft,
					onChange: (e) => setDraft(e.target.value),
					onBlur: () => { if (draft !== String(value)) onSet(meta.key, draft); },
				}),
				react.createElement("div", { className: "xw-desc" }, meta.desc));
		}

		// 档位配色（使用者要求「省/快/准用颜色区分」）：走宿主主题状态色，深浅两底都由宿主保证对比度
		const PRESET_TONE = { "本地模型·省上下文": "xw-tone-save", "快": "xw-tone-fast", "准": "xw-tone-precise", "排障": "xw-tone-debug" };
		const toneOf = (p) => (p && p.custom ? "xw-tone-custom" : (PRESET_TONE[p && p.name] || "xw-tone-custom"));

		function XwSettingsSection(props) {
			const t = props.t;
			const st = react.useState(null);
			const data = st[0], setData = st[1];
			const su = react.useState("");
			const status = su[0], setStatus = su[1];
			const pn = react.useState("");
			const presetName = pn[0], setPresetName = pn[1];
			const sp = react.useState(null);
			const slow = sp[0], setSlow = sp[1];
			const ab = react.useState(null);
			const about = ab[0], setAbout = ab[1];
			const rsx = react.useState("");
			const rulesMsg = rsx[0], setRulesMsg = rsx[1];
			const gd = react.useState(false);
			const goodTicked = gd[0], setGoodTicked = gd[1];
			const arm = react.useState("");
			const armed = arm[0], setArmed = arm[1];

			react.useEffect(() => {
				post({ action: "get" }).then((r) => { if (r && r.ok) setData(r); else setStatus(t("page.loadFail")); }).catch(() => setStatus(t("page.loadFail")));
			}, []);

			const refresh = () => post({ action: "get" }).then((r) => { if (r && r.ok) setData(r); });

			const onSet = (key, value) => {
				setStatus(t("page.saving"));
				post({ action: "set", key, value })
					.then((r) => { if (r && r.ok) { setData((d) => (d ? { ...d, cur: r.cur } : d)); setStatus(t("page.saved") + "\n" + (r.text || "")); } else setStatus(t("page.saveFail") + ((r && r.text) || "")); })
					.catch((e) => setStatus(t("page.saveFail") + e));
			};

			const applyPreset = (name) => {
				setStatus(t("page.saving"));
				post({ action: "apply-preset", name })
					.then((r) => {
						if (r && r.ok) { setData((d) => (d ? { ...d, cur: r.cur } : d)); setStatus(t("preset.applied") + name + "」\n" + (r.text || "")); }
						else setStatus(((r && r.text) || "应用失败"));
					})
					.catch((e) => setStatus(t("page.saveFail") + e));
			};

			const savePreset = () => {
				if (!presetName.trim()) return;
				post({ action: "save-preset", name: presetName.trim() })
					.then((r) => { if (r && r.ok) { setPresetName(""); refresh(); setStatus(r.text || ""); } else setStatus((r && r.text) || "保存失败"); })
					.catch((e) => setStatus(t("page.saveFail") + e));
			};

			const delPreset = (name) => {
				post({ action: "delete-preset", name })
					.then((r) => { if (r && r.ok) { refresh(); setStatus(r.text || ""); } else setStatus((r && r.text) || "删除失败"); })
					.catch((e) => setStatus(t("page.saveFail") + e));
			};

			const runSlow = () => {
				setSlow(t("speed.loading"));
				post({ action: "slowcheck" })
					.then((r) => setSlow(((r && r.lines) || []).join("\n")))
					.catch((e) => setSlow(String(e)));
			};

			const runAbout = () => {
				setAbout(t("about.loading"));
				post({ action: "about" })
					.then((r) => setAbout(((r && r.lines) || []).join("\n")))
					.catch((e) => setAbout(String(e)));
			};

			const runRules = (op, confirmIt) => {
				setRulesMsg(t("rules.busy"));
				post({ action: "rules", op, confirm: !!confirmIt })
					.then((r) => {
						setArmed("");
						if (r && r.rulesState) setData((d) => (d ? { ...d, rulesState: r.rulesState } : d));
						setRulesMsg(String((r && r.text) || ""));
						if (op === "good" && r && r.ok) setGoodTicked(true);
					})
					.catch((e) => { setArmed(""); setRulesMsg(String(e)); });
			};

			if (data === null) return react.createElement("div", { className: "xw-set" }, t("page.loading"));

			const groups = data.groups || [];
			const items = data.items || [];
			const presets = data.presets || [];
			const lessons = data.lessons || [];
			const lessonsText = lessons.length
				? lessons.map((l) => "[" + l.id + "] " + l.rule + "\n\t触发：" + (l.when || "")).join("\n")
				: "（这个包里没有 lib\\lessons.json，经验库是空的）";
			const rulesState = data.rulesState || null;
			const rulesHead = rulesState
				? ((rulesState.lines || []).join("\n") + "\n" + (rulesState.snapshot ? "最近快照：" + rulesState.snapshot.tag + "（" + rulesState.snapshot.files + " 个文件）" : "最近快照：还没有一次") + "\n已勾的好状态：" + ((rulesState.good || []).map((g) => g.id).join("、") || "无"))
				: "（读不到状态）";
			const cur = data.cur || {};

			return react.createElement("div", { className: "xw-set" },
				react.createElement("h2", null, t("page.title")),
				react.createElement("div", { className: "xw-meta" }, "v" + data.version + " · " + items.length + " 项 · " + groups.length + " 个分类"),
				react.createElement("div", { className: "xw-scope" }, react.createElement("b", null, t("scope.title") + "："), t("scope.body")),
				react.createElement("div", { className: "xw-group" },
					react.createElement("div", { className: "xw-h3" }, t("about.title")),
					react.createElement("div", { className: "xw-presets" },
						react.createElement("button", { className: "xw-preset", onClick: runAbout }, t("about.btn"))),
					about !== null ? react.createElement("pre", { className: "xw-pre" }, about) : null),
				react.createElement("div", { className: "xw-group" },
					react.createElement("div", { className: "xw-h3" }, t("lessons.title")),
					react.createElement("div", { className: "xw-note" }, lessonsText)),
				react.createElement("div", { className: "xw-group" },
					react.createElement("div", { className: "xw-h3" }, t("rules.title")),
					react.createElement("div", { className: "xw-note" }, t("rules.intro")),
					react.createElement("pre", { className: "xw-pre" }, rulesHead),
					react.createElement("div", { className: "xw-presets" },
						react.createElement("button", { className: "xw-preset", onClick: () => runRules("status") }, t("rules.status")),
						react.createElement("button", { className: "xw-preset on xw-tone-save", onClick: () => runRules("snapshot") }, t("rules.snapshot")),
						react.createElement("button", { className: "xw-preset", onClick: () => runRules("good") }, t("rules.good")),
						react.createElement("label", { className: "xw-desc" },
							react.createElement("input", { type: "checkbox", checked: goodTicked, onChange: (e) => setGoodTicked(e.target.checked), style: { marginRight: "6px" } }),
							t("rules.tick")),
						goodTicked ? react.createElement("button", { className: "xw-preset on xw-tone-fast", onClick: () => (armed === "publish" ? runRules("publish", true) : setArmed("publish")) }, armed === "publish" ? t("rules.publishArm") : t("rules.publish")) : null,
						react.createElement("button", { className: armed === "restore" ? "xw-preset on xw-tone-debug" : "xw-preset", onClick: () => (armed === "restore" ? runRules("restore", true) : setArmed("restore")) }, armed === "restore" ? t("rules.restoreArm") : t("rules.restore"))),
					rulesMsg ? react.createElement("div", { className: "xw-note" }, rulesMsg) : null),
				react.createElement("div", { className: "xw-group" },
					react.createElement("div", { className: "xw-h3" }, t("preset.title")),
					react.createElement("div", { className: "xw-presets" },
						presets.map((p) => react.createElement("span", { key: p.name, style: { display: "inline-flex", gap: "4px", alignItems: "center" } },
							react.createElement("button", { className: "xw-preset on " + toneOf(p), title: p.note || "", onClick: () => applyPreset(p.name) }, p.name),
							p.custom ? react.createElement("button", { className: "xw-del", onClick: () => delPreset(p.name) }, t("preset.del")) : null)),
						react.createElement("div", { className: "xw-save" },
							react.createElement("input", { className: "xw-name", type: "text", placeholder: t("preset.saveName"), value: presetName, onChange: (e) => setPresetName(e.target.value) }),
							react.createElement("button", { className: "xw-preset", onClick: savePreset }, t("preset.saveBtn")))),
					react.createElement("div", { className: "xw-note" }, presets.map((p) => p.name + " — " + (p.note || "")).join("\n"))),
				react.createElement("div", { className: "xw-group" },
					react.createElement("div", { className: "xw-h3" }, t("speed.btn")),
					react.createElement("div", { className: "xw-presets" },
						react.createElement("button", { className: "xw-preset", onClick: runSlow }, t("speed.btn"))),
					slow !== null ? react.createElement("pre", { className: "xw-pre" }, slow) : null),
				groups.map((g) => react.createElement("div", { className: "xw-group", key: g.id },
					react.createElement("div", { className: "xw-h3" }, g.zh || g.id),
					g.desc ? react.createElement("div", { className: "xw-gdesc" }, g.desc) : null,
					items.filter((m) => (m.group || "chain") === g.id).map((m) =>
						react.createElement(Row, { key: m.key, meta: m, value: cur[m.key] !== undefined ? cur[m.key] : m.def, onSet: onSet })))),
				status ? react.createElement("div", { className: "xw-status" }, status) : null);
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
				});
				ctx.locale.register(NS, { zh: ZH, en: EN });
				const t = (k) => (ZH[k] !== undefined ? ZH[k] : k);
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
		// 依赖必须显式声明：真宿主实测抛 `Error: cannot get property "slots" without inject`
		// （v0.1.7 的 boot.log 第 22 行，堆栈来自 dsh-app://app/plugins/…/client.js）。
		// 样本 dsh-ui-tools 的客户端入口声明是 ["slots","modelDirectories","sessions","locale","workspaces"]（:129），
		// 本插件只用到 slots（注册槽）与 locale（文案），按需最小声明。
		exports.inject = ["slots", "locale"];
		return module.exports;
	}
});
