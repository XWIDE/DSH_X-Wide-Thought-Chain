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
			".xw-set { color-scheme: dark; display: flex; flex-direction: column; gap: 34px; font-size: 14px; line-height: 1.6; padding-bottom: 28px; }",
			".xw-set h2 { margin: 0; font-size: 15px; font-weight: 600; }",
			".xw-set .xw-meta { font-size: 13px; color: var(--dsw-alias-label-tertiary, #adb2b8); }",
			".xw-set .xw-scope { font-size: 13px; color: var(--dsw-alias-label-secondary, #cfd3d6); border-left: 2px solid currentColor; padding-left: 10px; line-height: 1.7; max-width: 720px; }",
			".xw-set .xw-scope b { font-size: 13px; }",
			// 分类之间用分隔线＋大间距隔开（使用者点名「排得太密」）
			".xw-set .xw-group { display: flex; flex-direction: column; gap: 16px; padding: 22px 0; border-top: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28)); }",
			".xw-set .xw-h3 { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: .01em; }",
			".xw-set .xw-gdesc { font-size: 13px; color: var(--dsw-alias-label-secondary, #cfd3d6); margin-bottom: 4px; max-width: 720px; }",
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
			".xw-set .xw-note { font-size: 13px; color: var(--dsw-alias-label-secondary, #cfd3d6); max-width: 720px; line-height: 1.8; white-space: pre-line; margin-top: 6px; }",
			".xw-set .xw-save { display: flex; gap: 10px; align-items: center; }",
			".xw-set .xw-name { flex: 1; min-height: 32px; font: inherit; font-size: 13px; background: transparent; color: currentColor; border: 1px solid currentColor; border-radius: var(--dsw-radius-sm, 5px); padding: 0 10px; }",
			// 每项之间拉开：行距 14px，说明与控件之间 6px，项与项之间 20px
			".xw-set .xw-row { display: grid; grid-template-columns: minmax(170px, 240px) 1fr; gap: 6px 18px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.16)); }",
			".xw-set .xw-key { font-size: 14px; }",
			".xw-set .xw-desc { grid-column: 1 / 3; font-size: 13px; color: var(--dsw-alias-label-secondary, #cfd3d6); line-height: 1.7; max-width: 720px; }",
			".xw-set .xw-input { min-height: 32px; font: inherit; font-size: 14px; background: transparent; color: currentColor; border: 1px solid currentColor; border-radius: var(--dsw-radius-sm, 5px); padding: 0 10px; width: 100%; }",
			".xw-set .xw-check { width: 32px; height: 32px; margin-left: -6px; justify-self: start; accent-color: var(--dsw-alias-brand-primary, #7aaaff); }",
			".xw-set .xw-num { display: flex; align-items: center; gap: 12px; width: 100%; }",
			".xw-set .xw-range { flex: 1; height: 32px; background: transparent; color: currentColor; accent-color: currentColor; cursor: pointer; }",
			".xw-set .xw-bubble { font-size: 13px; width: 96px; min-width: 96px; text-align: right; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #cfd3d6); }",
			".xw-set .xw-status { font-size: 13px; color: var(--dsw-alias-label-tertiary, #adb2b8); white-space: pre-wrap; line-height: 1.7; padding: 12px 0; border-top: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28)); }",
			".xw-set .xw-pre { margin: 4px 0 0; font-size: 13px; font-family: ui-monospace, Consolas, monospace; white-space: pre-wrap; overflow-x: auto; line-height: 1.8; border-left: 2px solid currentColor; padding-left: 12px; }",
			// 视觉验收 2026-11-09（UI 视觉验收设计师 HOLD）补的六条：现有 xw-* 里没有等价类，逐条声明必要性
			".xw-set .xw-fold { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 32px; padding: 6px 8px; margin-left: -8px; background: transparent; border: 0; color: inherit; font: inherit; font-size: 15px; font-weight: 600; text-align: left; cursor: pointer; border-radius: var(--dsw-radius-sm, 8px); }",
			".xw-set .xw-fold:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #7aaaff); outline-offset: 2px; }",
			".xw-set .xw-caret { width: 16px; flex: none; font-size: 12px; color: var(--dsw-alias-label-tertiary, #adb2b8); }",
			".xw-set div.xw-h3.xw-fold::before { content: \"▸\"; width: 16px; flex: none; font-size: 12px; color: var(--dsw-alias-label-tertiary, #adb2b8); }",
			".xw-set div.xw-h3.xw-fold[aria-expanded='true']::before { content: \"▾\"; }",
			".xw-set .xw-preset.primary { background: var(--dsw-alias-brand-primary, #7aaaff); border-color: currentColor; color: #0b0d10; font-weight: 600; }",
			".xw-set .xw-ghost { min-height: 32px; padding: 0 10px; font: inherit; font-size: 12px; background: transparent; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12)); color: var(--dsw-alias-label-secondary, #cfd3d6); border-radius: var(--dsw-radius-sm, 8px); cursor: pointer; }",
			".xw-set .xw-toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; align-items: center; min-height: 40px; padding: 8px 0; background: var(--dsw-alias-bg-elevated, rgba(23,24,26,.92)); }",
			".xw-set .xw-adv { display: grid; grid-template-columns: minmax(170px, 240px) 1fr 96px; gap: 8px 16px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06)); }",
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

		// 高亮「当前模型」用的匹配：取模型 id 里 ≥3 位的字母段（swift / iq3），任一命中文件名（去符号后）即算。
		// 例 active="swift-1.5-iq3_s" → 令 run-swift-iq3_s.bat / 切到-IQ3_S.bat 亮，run-ud-q4_k_xl.bat 不亮。
		function hlMatch(name, active) {
			if (!active) return false;
			const nf = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
			const toks = String(active).toLowerCase().split(/[-_.\s]+/).filter((t) => /[a-z]/.test(t) && t.length >= 3);
			return toks.some((t) => nf.indexOf(t.replace(/[^a-z0-9]/g, "")) >= 0);
		}

		// 「运行引擎」选择器（用户 2026-11-16）：全局「思维链跑在哪个后台模型上」。放页面最前面，不埋在 watchdog 组。
		// 不勾手动锁定（默认）＝自动认当前活模型，啥都不用选；勾上＝出扫描目录+扫描按钮+下拉，挑一个锁死拉起它。
		function WdLauncherPicker(props) {
			const cur = props.cur, onSet = props.onSet;
			const lock = cur["watchdog.manualLock"] === true;
			const fs = react.useState([]); const files = fs[0], setFiles = fs[1];
			const bz = react.useState(false); const busy = bz[0], setBusy = bz[1];
			const ms = react.useState(""); const msg = ms[0], setMsg = ms[1];
			const ac = react.useState(""); const active = ac[0], setActive = ac[1];
			// 扫描目录用本地状态接管（修「打字进去不生效、点扫描说没填」——旧版 onChange 是空函数）：onChange 即时写本地 + 落盘
			const ds = react.useState(String(cur["watchdog.scanDir"] || "")); const dir = ds[0], setDir = ds[1];
			// 「含杂项」：默认不勾＝只列 .bat/.cmd（启动器本体）；勾上＝连 .ps1/.lnk 一起列（逃生门）
			const al = react.useState(false); const incAll = al[0], setIncAll = al[1];
			// 「过滤」：打字实时筛下拉（子串、不分大小写）——列表由你说了算，插件不猜哪个"有用"
			const fl = react.useState(""); const flt = fl[0], setFlt = fl[1];
			// 过滤即时生效（纯前端，不重扫）：空＝全列
			const shown = (() => { const q = String(flt || "").trim().toLowerCase(); return q ? files.filter((f) => String(f.name).toLowerCase().includes(q)) : files; })();
			const scan = (d) => {
				const target = String(d !== undefined ? d : dir).trim();
				if (!target) { setMsg("先在「扫描目录」里真打一行路径（例：你的启动器文件夹全路径），再点扫描"); return; }
				setBusy(true); setMsg("扫描中…");
				post({ action: "scan-launchers", dir: target, all: incAll })
					.then((r) => {
						setBusy(false);
						if (r && r.ok) { setFiles(r.files || []); setActive(r.active || ""); setMsg("扫到 " + (r.files || []).length + " 个启动器" + (r.active ? "；当前活模型＝" + r.active : "（8080 没起，读不到活模型）")); }
						else { setFiles([]); setMsg(((r && r.text) || "扫描失败")); }
					})
					.catch((e) => { setBusy(false); setFiles([]); setMsg("扫描失败：" + String((e && e.message) || e)); });
			};
			react.useEffect(() => { if (lock && cur["watchdog.autoScan"] === true && String(cur["watchdog.scanDir"] || "").trim()) scan(String(cur["watchdog.scanDir"])); }, []);
			return react.createElement("div", { className: "xw-group" },
				react.createElement("div", { className: "xw-h3" }, "运行引擎 · 思维链跑在哪个后台模型上"),
				react.createElement("label", { className: "xw-desc" },
					react.createElement("input", { type: "checkbox", checked: lock, style: { marginRight: "6px", width: "20px", height: "20px", padding: "6px", boxSizing: "content-box", accentColor: "var(--dsw-alias-brand-primary,#7aaaff)", verticalAlign: "middle" }, onChange: (e) => onSet("watchdog.manualLock", e.target.checked) }),
					"手动锁定启动器：不勾（默认）＝自动，插件自己认当前活模型（从 /v1/models），你不用选；勾上＝引擎崩了时只看门狗拉你下面挑的那个启动器，锁死跑它。（注：这里选的是「崩了拉起谁」＋高亮当前活模型，切换正在跑的模型本身要在启动表/端口那边做，界面点不动。）"),
				lock ? react.createElement(react.Fragment, null,
					react.createElement("div", { className: "xw-row" },
						react.createElement("label", { className: "xw-key" }, "扫描目录"),
						react.createElement("input", { className: "xw-input", type: "text", value: dir, placeholder: "例：你的启动器文件夹全路径（这里要真打字，灰字只是示例不算填）", onChange: (e) => { setDir(e.target.value); onSet("watchdog.scanDir", e.target.value); } }),
						react.createElement("div", { className: "xw-desc" }, "你的启动器（.bat/.cmd/.ps1/.lnk）所在文件夹。插件不假设引擎叫什么、不写死任何路径——这行由你填，扫出来才进下拉。")),
					react.createElement("label", { className: "xw-desc" },
						react.createElement("input", { type: "checkbox", checked: cur["watchdog.autoScan"] === true, style: { marginRight: "6px", width: "20px", height: "20px", padding: "6px", boxSizing: "content-box", accentColor: "var(--dsw-alias-brand-primary,#7aaaff)", verticalAlign: "middle" }, onChange: (e) => onSet("watchdog.autoScan", e.target.checked) }),
						"自动扫描：勾上＝每次进这页自动扫一次填下拉；不勾（默认）＝只在你点下面按钮时才扫（省性能）。"),
					react.createElement("label", { className: "xw-desc" },
						react.createElement("input", { type: "checkbox", checked: incAll, style: { marginRight: "6px", width: "20px", height: "20px", padding: "6px", boxSizing: "content-box", accentColor: "var(--dsw-alias-brand-primary,#7aaaff)", verticalAlign: "middle" }, onChange: (e) => setIncAll(e.target.checked) }),
						"含杂项（逃生门）：不勾（默认）＝下拉只列 .bat/.cmd，且自动筛掉卸载/安装/readme/停止/自测这类明显不是启动器的垃圾，列表短好挑；勾上＝连 .ps1/.lnk 脚本一起列、且不筛垃圾全给你看（怀疑筛掉了才勾）。改完重扫一次才生效。"),
					react.createElement("div", { className: "xw-row" },
						react.createElement("label", { className: "xw-key" }, "过滤"),
						react.createElement("input", { className: "xw-input", type: "text", value: flt, placeholder: "打字实时筛：例「切到」「run」「RESTART」（不分大小写，空＝全列）", style: { maxWidth: "460px" }, onChange: (e) => setFlt(e.target.value) }),
						react.createElement("div", { className: "xw-desc" }, "只显示名字含这几个字的——列表长短你说了算，插件不猜哪个有用。")),
					// 常驻「已锁定」行：读 watchdog.launcher，独立于过滤/勾选清单，筛没了也看得见、能直接解
					react.createElement("div", { className: "xw-row", style: { marginTop: "6px", alignItems: "center", gap: "10px" } },
						react.createElement("div", { className: "xw-desc", style: { margin: 0 } },
							String(cur["watchdog.launcher"] || "")
								? "已锁定拉起：" + String(cur["watchdog.launcher"]).split(/[\\/]/).pop() + "　（完整路径：" + cur["watchdog.launcher"] + "）"
								: "已锁定拉起：（无·当前走自动认模型）"),
						String(cur["watchdog.launcher"] || "")
							? react.createElement("button", { className: "xw-preset", style: { flex: "0 0 auto" }, onClick: () => onSet("watchdog.launcher", "") }, "清除锁定")
							: null),
					react.createElement("div", { className: "xw-row", style: { marginTop: "8px", alignItems: "flex-start" } },
						react.createElement("button", { className: "xw-preset on xw-tone-fast", disabled: busy, onClick: () => scan(), style: { flex: "0 0 auto" } }, busy ? "扫描中…" : "扫描启动器"),
						files.length === 0
							? react.createElement("div", { className: "xw-desc", style: { marginLeft: "12px", alignSelf: "center" } }, "（先点「扫描启动器」，扫出来这里才出勾选清单）")
							: react.createElement("div", { style: { marginLeft: "12px", maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", minWidth: "0" }, className: "xw-input" },
								shown.length === 0 ? react.createElement("div", { className: "xw-desc" }, "过滤把 " + files.length + " 项全筛没了——改改字或清空") : null,
								shown.map((f) => {
									const sel = String(cur["watchdog.launcher"] || "") === f.path;
									return react.createElement("label", { key: f.path, style: { display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", whiteSpace: "nowrap" } },
										react.createElement("input", { type: "checkbox", checked: sel, style: { width: "20px", height: "20px", padding: "6px", boxSizing: "content-box", accentColor: "var(--dsw-alias-brand-primary,#7aaaff)", flex: "0 0 auto" }, onChange: (e) => onSet("watchdog.launcher", e.target.checked ? f.path : "") }),
										f.name + (hlMatch(f.name, active) ? " ←当前模型" : "") + (sel ? "（已锁定拉起）" : ""));
								}))),
					msg ? react.createElement("div", { className: "xw-note" }, msg) : null,
					react.createElement("div", { className: "xw-desc" }, "下拉选中的文件写进 watchdog.launcher＝看门狗 DOWN 时锁死拉起它。要按模型分别拉起（自动模式用），把扫到的路径填进 watchdog.modelLaunchers 那张 JSON 表。")) : null);
		}

		// 重启前体检闸（作用②，用户 2026-11-16）：别让写程序把 DSH 写坏到开不了机。
		// 开关默认开；点「跑体检」＝语法扫 local-plugins 全部插件 JS + tail harness.log 崩溃签名，绿了才提示可重启。
		function WdBootCheckRow(props) {
			const cur = props.cur, onSet = props.onSet;
			const on = cur["bootcheck.enabled"] !== false;
			const bz = react.useState(false); const busy = bz[0], setBusy = bz[1];
			const rs = react.useState(null); const res = rs[0], setRes = rs[1];
			const run = () => { setBusy(true); setRes(null); post({ action: "bootcheck" }).then((r) => { setBusy(false); setRes(r && (r.lines ? r : { ok: false, lines: [(r && r.text) || "失败"] }) ); }).catch((e) => { setBusy(false); setRes({ ok: false, lines: ["失败：" + String((e && e.message) || e)] }); }); };
			return react.createElement("div", { className: "xw-group" },
				react.createElement("div", { className: "xw-h3" }, "重启前体检闸 · 别让写坏的代码把 DSH 砸到开不了机"),
				react.createElement("label", { className: "xw-desc" },
					react.createElement("input", { type: "checkbox", checked: on, style: { marginRight: "6px", width: "20px", height: "20px", padding: "6px", boxSizing: "content-box", accentColor: "var(--dsw-alias-brand-primary,#7aaaff)", verticalAlign: "middle" }, onChange: (e) => onSet("bootcheck.enabled", e.target.checked) }),
					"启用体检闸（勾上＝默认）：不勾＝整块关掉、零开销。这功能平时不扫不跑，只在你点「跑体检」那一刻才动。"),
				on ? react.createElement(react.Fragment, null,
					react.createElement("div", { className: "xw-desc" }, "你重启 DSH 之前手动点一下，跑两道关：① 语法——扫 profile 的 local-plugins 目录下【全部插件】的 .js/.mjs（DSH 启动时装载的就是这些；任何一个语法不过＝下次装载必炸＝开不了机）。② 崩溃日志——tail harness.log 尾部，找已知装载崩溃签名（plugin tree failed to load / loader entry / Cannot find module / SyntaxError）。两道全绿才提示「可以重启」。全程只读，不碰活的 DSH。"),
					react.createElement("div", { className: "xw-row", style: { marginTop: "6px", alignItems: "center", gap: "10px" } },
						react.createElement("button", { className: "xw-preset on xw-tone-fast", disabled: busy, onClick: run }, busy ? "体检中…" : "跑体检"),
						res ? react.createElement("div", { className: "xw-desc", style: { margin: 0, color: res.ok ? "var(--success, #2e7d32)" : "var(--error, #c62828)", fontWeight: 600 } }, res.ok ? "✅ 通过" : "⛔ 未过") : null),
					res && res.lines && res.lines.length ? react.createElement("pre", { className: "xw-input", style: { marginTop: "6px", maxHeight: "200px", overflowY: "auto", fontSize: "12px", whiteSpace: "pre-wrap" } }, res.lines.join("\n")) : null) : null);
		}

		// 高级设置折叠（用户 2026-11-16）：标了 advanced:true 的项收进这里，默认收起，只露常用项。
		function WdAdvanced(props) {
			const items = props.items, cur = props.cur, onSet = props.onSet;
			const op = react.useState(false); const open = op[0], setOpen = op[1];
			return react.createElement("div", { style: { marginTop: "10px" } },
				react.createElement("button", { className: "xw-preset", onClick: () => setOpen(!open) }, (open ? "▾ 收起高级设置" : "▸ 高级设置（" + items.length + " 项，一般不用动）")),
				open ? react.createElement(react.Fragment, null,
					items.map((m) => react.createElement(Row, { key: m.key, meta: m, value: cur[m.key] !== undefined ? cur[m.key] : m.def, onSet: onSet }))) : null);
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
				// 运行引擎选择器放页面最前面（用户 2026-11-16「他就应该是在最前面」）：全局「思维链跑在哪个后台模型上」的选择，不埋在 watchdog 组
				react.createElement(WdLauncherPicker, { cur, onSet }),
				react.createElement(WdBootCheckRow, { cur, onSet }),
				// 用户 2026-11-09 19:48「那这个放到最上面」：自学习这组挪到页首（原来挂在面板末尾）
				react.createElement(XwToolbar, null),
				react.createElement(SlSection, null),
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
					react.createElement("div", { className: "xw-note" }, presets.map((p) => p.name + " — " + (p.note || "")).join("\n")),
					// 状态读数放档位组内（用户 2026-11-16 图3红框）：点档位后这条反馈紧跟在档位说明下方
					status ? react.createElement("div", { className: "xw-status" }, status) : null),
				react.createElement("div", { className: "xw-group" },
					react.createElement("div", { className: "xw-h3" }, t("speed.btn")),
					react.createElement("div", { className: "xw-presets" },
						react.createElement("button", { className: "xw-preset", onClick: runSlow }, t("speed.btn"))),
					slow !== null ? react.createElement("pre", { className: "xw-pre" }, slow) : null),
				groups.map((g) => {
					const gi = items.filter((m) => (m.group || "chain") === g.id);
					const adv = gi.filter((m) => m.advanced);
					return react.createElement("div", { className: "xw-group", key: g.id },
						react.createElement("div", { className: "xw-h3" }, g.zh || g.id),
						g.desc ? react.createElement("div", { className: "xw-gdesc" }, g.desc) : null,
						gi.filter((m) => !m.advanced).map((m) => react.createElement(Row, { key: m.key, meta: m, value: cur[m.key] !== undefined ? cur[m.key] : m.def, onSet: onSet })),
						adv.length ? react.createElement(WdAdvanced, { items: adv, cur, onSet }) : null);
				}));
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
				try { startXwCollapse(); } catch (e) {}
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

		// 「自学习」并进本页（用户 2026-11-09 原话「自学习 放入到思考链里」＋截图圈出导航里多出一行）：
		// 不新起导航行，就在本面板末尾加一组；读写走自学习插件自己的 HTTP 通道，两边共用盘上设置。
		function SlGroup() {
			const st = react.useState(null); const d = st[0], setD = st[1];
			const ms = react.useState(""); const msg = ms[0], setMsg = ms[1];
			const bs = react.useState(false); const busy = bs[0], setBusy = bs[1];
			const call = async (body) => { const r = await fetch("/api/selflearn/settings", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); };
			const load = react.useCallback(async () => { try { setD(await call({ action: "get" })); } catch (e) { setMsg("自学习读数失败：" + String((e && e.message) || e) + "（插件没装载，或改动后没重启 DSH）"); } }, []);
			react.useEffect(() => { load(); }, [load]);
			const setMode = async (on) => {
				setBusy(true);
				try {
					const r = await call({ action: "set", key: "mode", value: on ? "auto" : "manual" });
					const txt = r.ok ? (on ? "已开：自动总结（每轮活读，当场生效）" : "已关：只记录，不注入任何东西") : ("写入失败：" + (r.text || ""));
					setMsg(txt);
					await load();
				} catch (e) { setMsg("写入失败：" + String((e && e.message) || e)); }
				setBusy(false);
			};
			const now = async () => {
				setBusy(true); setMsg("总结中…（扫这段时间的被否记录）");
				try { const r = await call({ action: "summary" }); setMsg(r.text || "已总结"); await load(); }
				catch (e) { setMsg("失败：" + String((e && e.message) || e)); }
				setBusy(false);
			};
			if (!d) return react.createElement("div", { className: "xw-group" }, react.createElement("div", { className: "xw-h3" }, "自学习"), react.createElement("div", { className: "xw-note" }, msg || "读取中…"));
			const cur = d.cur || {}, cards = d.cards || [];
			return react.createElement("div", { className: "xw-group" },
				react.createElement("div", { className: "xw-h3" }, "自学习"),
				react.createElement("label", { className: "xw-desc" },
					react.createElement("input", { type: "checkbox", checked: cur.mode !== "manual", disabled: busy, style: { marginRight: "6px", width: "20px", height: "20px", padding: "6px", boxSizing: "content-box", accentColor: "var(--dsw-alias-brand-primary,#7aaaff)", verticalAlign: "middle" }, onChange: (e) => setMode(e.target.checked) }),
					"自动总结：勾上＝我自动把被你否过的做法蒸成规矩，带进下一场新会话；不勾＝只记录、一个字都不注入。改这项当场生效，不用重启。"),
				react.createElement("div", { className: "xw-presets" },
					react.createElement("button", { className: "xw-preset on xw-tone-save", disabled: busy, onClick: now }, "立即总结")),
				// 用户 2026-11-09 19:48「在聊天里打一次『开始总结』和点里面这个按钮一样，这个上回说明里有」＝说明要写明两条路等价
				react.createElement("div", { className: "xw-desc" }, "点这个＝在聊天里打「开始总结」：两条路走同一个动作，都是现在就把这段时间被否的东西蒸成打法。"),
				react.createElement("div", { className: "xw-note" }, "现有打法 " + cards.length + " 条 · 同类被否满 " + (cur["learn.minCorrections"] !== undefined ? cur["learn.minCorrections"] : 2) + " 次自动升级 · 生效范围：勾＝当场，打法注入＝下一场新会话"),
				msg ? react.createElement("div", { className: "xw-note" }, msg) : null);
		}

		// 整页折叠（用户 2026-11-09 20:31「整个思维链里面的每一个块块都能做折叠…上面那两个按钮全打开。全折叠是指所有的整个的，因为现在整个页面太他妈长了」）
		// 做法＝不重构 JSX，挂载后给每个 .xw-group 的标题装上把手；状态存 localStorage（下次进页还在），React 重渲染后 MutationObserver 重新装。
		const XW_LS = "dsh-xwide-collapse-v1";
		let xwMo = null; // 自己写的 DOM 记录要丢掉，否则增强器把自己当变化重跑＝一闪一闪
		const xwRead = () => { try { return JSON.parse(localStorage.getItem(XW_LS) || "{}") || {}; } catch (e) { return {}; } };
		const xwWrite = (m) => { try { localStorage.setItem(XW_LS, JSON.stringify(m)); } catch (e) {} };
		// key 必须稳定：把手字符（▸/▾）会混进 textContent，第一次见到就把 key 钉进 dataset，之后只认 dataset
		const xwKey = (g, i) => {
			if (g.dataset.xwkey) return g.dataset.xwkey;
			const h = g.querySelector(".xw-h3");
			const t = h ? String(h.textContent || "").trim().replace(/^[▸▾]\s*/g, "").trim() : "";
			const k = t || ("组" + (i + 1));
			g.dataset.xwkey = k;
			return k;
		};
		const xwReport = (total, collapsed) => { try { fetch("/api/selflearn/settings", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "client-dom", dom: JSON.stringify({ phase: "collapse", groups: total, collapsed: collapsed, toolbar: typeof document !== "undefined" && !!document.querySelector(".xw-set > .xw-toolbar") }) }) }).catch(() => {}); } catch (e) {} };
		function xwEnhancePage() {
			if (typeof document === "undefined") return 0;
			const set = document.querySelector(".xw-set");
			if (!set) return 0;
			const groups = Array.from(set.children).filter((el) => el.classList && el.classList.contains("xw-group"));
			if (!groups.length) return 0;
			const st = xwRead();
			let collapsed = 0;
			groups.forEach((g, i) => {
				const key = xwKey(g, i);
				let fold = g.querySelector(":scope > .xw-h3.xw-fold");
				if (!fold) fold = g.querySelector(":scope > .xw-h3");
				if (!fold) { g.style.display = ""; return; }
				if (!fold.classList.contains("xw-fold")) {
					fold.classList.add("xw-fold");
					fold.setAttribute("role", "button");
					fold.setAttribute("tabindex", "0");
					// 把手交给 CSS ::before（只写 aria-expanded），不动文本节点——React 重渲染会把我塞进去的 span 清掉，清一次闪一次
					const flip = () => { const s2 = xwRead(); s2[key] = !s2[key]; xwWrite(s2); xwApply(); };
					fold.addEventListener("click", flip);
					fold.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
				}
				const isCol = !!st[key];
				fold.setAttribute("aria-expanded", isCol ? "false" : "true");
				// （不再写把手字符：aria-expanded 驱动 CSS ::before）
				Array.from(g.children).forEach((ch) => { if (ch === fold) return; const want = isCol ? "none" : ""; if (ch.style.display !== want) ch.style.display = want; });
				if (isCol) collapsed++;
			});
			// 两颗按钮改由 React 那半渲染（XwToolbar）＝DOM 节点插进 React 容器会被清掉，清一次闪一次
			try { if (xwMo) xwMo.takeRecords(); } catch (e) {}
			return { total: groups.length, collapsed: collapsed, toolbar: !!set.querySelector(":scope > .xw-toolbar") };
		}
		function xwApply() { return xwEnhancePage(); }
		const xwSetAll = (toOpen) => {
			const s2 = xwRead();
			Array.from(document.querySelectorAll(".xw-set > .xw-group")).forEach((g, i) => { const k = xwKey(g, i); if (toOpen) delete s2[k]; else s2[k] = true; });
			xwWrite(s2);
			const r = xwEnhancePage();
			xwReport(r.total, r.collapsed);
		};
		// 页首两颗＝React 渲染（不是 DOM 插节点）：这样 React 重渲染不会把它们清掉，也就不会一闪一闪
		function XwToolbar() {
			return react.createElement("div", { className: "xw-toolbar" },
				react.createElement("button", { type: "button", className: "xw-ghost", onClick: () => xwSetAll(true) }, "全打开"),
				react.createElement("button", { type: "button", className: "xw-ghost", onClick: () => xwSetAll(false) }, "全折叠"));
		}
		function startXwCollapse() {
			if (typeof document === "undefined") return;
			let deb = 0, lastKey = "";
			const run = (report) => {
				const r = xwEnhancePage();
				if (!r || !r.total) return;
				const k = r.total + "/" + r.collapsed;
				if (report && k !== lastKey) { lastKey = k; xwReport(r.total, r.collapsed); }
			};
			setTimeout(() => run(true), 700);
			if (typeof MutationObserver === "function") {
				// 只听 childList（我写的是 style/文本＝attribute/characterData，不进回调），＋熔断：8 秒内超过 30 次就停表
				let hits = 0, win = Date.now();
				xwMo = new MutationObserver(() => {
					const now = Date.now();
					if (now - win > 8000) { win = now; hits = 0; }
					if (++hits > 30) { try { xwMo.disconnect(); } catch (e) {} return; }
					clearTimeout(deb); deb = setTimeout(() => run(false), 300);
				});
				xwMo.observe(document.documentElement, { childList: true, subtree: true });
			}
		}

		// 用户 2026-11-09 20:03 定案：「自学习 是 X-Wide 思考链 一部份」＋「这么长的一条能成折叠的组吗？然后有两个菜单加 全展开、全折叠」
		// → 完整面板整块搬进本页（5 组，点标题折叠；顶上两颗全展开/全折叠），读写走自学习插件自己的 HTTP 通道。
		function SlSection() {
			const st = react.useState(null); const data = st[0], setData = st[1];
			const ms = react.useState(""); const msg = ms[0], setMsg = ms[1];
			const bs = react.useState(false); const busy = bs[0], setBusy = bs[1];
			const os = react.useState({ g1: true, g2: true, g3: false, g4: false, g5: false }); const open = os[0], setOpen = os[1];
			const call = async (body) => { const r = await fetch("/api/selflearn/settings", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); };
			const load = react.useCallback(async () => { try { setData(await call({ action: "get" })); } catch (e) { setMsg("自学习读数失败：" + String((e && e.message) || e) + "（插件没装载，或改动后没重启 DSH）"); } }, []);
			react.useEffect(() => {
				load();
				setTimeout(async () => {
					try {
						const root = document.querySelector(".sl-xwsec");
						if (!root) return;
						const box = root.querySelector('input[type=checkbox]');
						const r = box ? box.getBoundingClientRect() : null;
						await call({ action: "client-dom", dom: JSON.stringify({ phase: "panel", boxes: root.querySelectorAll('input[type=checkbox]').length, sliders: root.querySelectorAll('input[type=range]').length, boxH: r ? Math.round(r.height) : 0, boxVis: box ? box.offsetParent !== null : false, btn: !!root.querySelector("button") }) });
					} catch (e) {}
				}, 900);
			}, [load]);
			const onSet = async (key, value) => {
				setBusy(true);
				try { const r = await call({ action: "set", key, value }); setMsg(r.ok ? "已写入：" + key + " = " + value + "（当场生效）" : ("写入失败：" + (r.text || ""))); if (r.cur) setData((d) => ({ ...d, cur: r.cur })); }
				catch (e) { setMsg("写入失败：" + String((e && e.message) || e)); }
				setBusy(false);
			};
			const runNow = async () => {
				setBusy(true); setMsg("总结中…（扫这段时间的被否记录）");
				try { const r = await call({ action: "summary" }); setMsg(r.text || "已总结"); await load(); }
				catch (e) { setMsg("失败：" + String((e && e.message) || e)); }
				setBusy(false);
			};
			if (!data) return react.createElement("div", { className: "xw-group sl-xwsec" }, react.createElement("div", { className: "xw-h3" }, "自学习"), react.createElement("div", { className: "xw-note" }, msg || "读取中…"));
			const cur = data.cur || {}, items = data.items || [], cards = data.cards || [], tot = data.totals || {};
			const byKey = {}; for (const m of items) byKey[m.key] = m;
			const advKeys = ["enabled", "prompt.enabled", "rules.autoApply", "learn.minCorrections", "learn.stuckAfter", "record.scanWindow", "prompt.maxChars"];
			const autoOn = cur.mode !== "manual";
			const tog = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
			// 视觉验收 P0：标题＝真 button＋固定把手槽（命中区 32px、Tab 可达、aria-expanded）
			const h3 = (k, label) => react.createElement("button", { type: "button", className: "xw-h3 xw-fold", "aria-expanded": open[k], title: open[k] ? "点击折叠" : "点击展开", onClick: () => tog(k), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog(k); } } }, react.createElement("span", { className: "xw-caret" }, open[k] ? "▾" : "▸"), label);
			const all = (v) => setOpen({ g1: v, g2: v, g3: v, g4: v, g5: v });
			return react.createElement("div", { className: "xw-group sl-xwsec" },
				react.createElement("div", { className: "xw-h3" }, "自学习"),
				// 局部两颗「全展开/全折叠」已撤：页首 .xw-toolbar 那两颗（全打开／全折叠）管整页，不留两套同名控件
				react.createElement("div", null,
					h3("g1", "① 自动总结（主开关）"),
					open.g1 ? react.createElement("label", { className: "xw-desc", style: { marginTop: "8px" } },
						react.createElement("input", { type: "checkbox", checked: autoOn, disabled: busy, style: { marginRight: "6px", width: "20px", height: "20px", padding: "6px", boxSizing: "content-box", accentColor: "var(--dsw-alias-brand-primary,#7aaaff)", verticalAlign: "middle" }, onChange: (e) => onSet("mode", e.target.checked ? "auto" : "manual") }),
						"勾上＝我自动把被你否过的做法蒸成规矩，带进下一场新会话；不勾＝只记录、一个字都不注入。改这项当场生效，不用重启。") : null),
				react.createElement("div", { style: { marginTop: "16px" } },
					h3("g2", "② 立即总结"),
					open.g2 ? react.createElement(react.Fragment, null,
						react.createElement("div", { className: "xw-presets", style: { marginTop: "8px" } },
							react.createElement("button", { className: "xw-preset on primary", disabled: busy, onClick: runNow }, "立即总结")),
						react.createElement("div", { className: "xw-desc" }, "点这个＝在聊天里打「开始总结」：两条路走同一个动作，都是现在就把这段时间被否的东西蒸成打法。")) : null),
				react.createElement("div", { style: { marginTop: "16px" } },
					h3("g3", "③ 现有打法 " + cards.length + " 条（带进下一场新会话）"),
					open.g3 ? (cards.length
						? react.createElement("pre", { className: "xw-pre" }, cards.map((c) => "【" + c.label + " ×" + c.count + "】" + c.rule + "\n 来源：" + (c.source === "harvest" ? "手动收割" : c.source === "trigger" ? "你喊的总结" : "自动蒸") + " · 已注入 " + (c.injectCount || 0) + " 场 · 依据原话：" + (c.quote || "")).join("\n\n"))
						: react.createElement("div", { className: "xw-note" }, "还没有打法：同类被否满 " + (cur["learn.minCorrections"] !== undefined ? cur["learn.minCorrections"] : 2) + " 次会自动升级，点上面「立即总结」现在就能蒸。")) : null),
				react.createElement("div", { style: { marginTop: "16px" } },
					h3("g4", "④ 累计"),
					open.g4 ? react.createElement("div", { className: "xw-note" },
						"被否 " + (tot.corrections || 0) + " 次 · 空口完成 " + (tot.fakeDone || 0) + " 次 · 跨会话 " + (tot.sessions || 0) + " 个" + (data.latestStuck ? " · 最新卡点 " + data.latestStuck.label + " ×" + data.latestStuck.count : "")) : null),
				react.createElement("div", { style: { marginTop: "16px" } },
					h3("g5", "⑤ 高级设置（7 项）"),
					open.g5 ? advKeys.map((k) => {
						const m = byKey[k]; if (!m) return null;
						const val = cur[k];
						if (m.type === "boolean") return react.createElement("label", { key: k, className: "xw-desc", style: { display: "block", padding: "8px 0", borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06))" } },
							react.createElement("input", { type: "checkbox", checked: val === true, disabled: busy, style: { marginRight: "8px", width: "20px", height: "20px", padding: "6px", boxSizing: "content-box", accentColor: "var(--dsw-alias-brand-primary,#7aaaff)", verticalAlign: "middle" }, onChange: (e) => onSet(k, e.target.checked) }),
							react.createElement("b", null, k), " — " + m.desc);
						if (m.type === "number" && m.min !== undefined) return react.createElement("div", { key: k, style: { padding: "8px 0", borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06))" } },
							react.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
								react.createElement("b", { style: { minWidth: "170px" } }, k),
								react.createElement("input", { type: "range", min: m.min, max: m.max, step: 1, value: Number(val), disabled: busy, style: { flex: "1", height: "32px", background: "transparent", accentColor: "var(--dsw-alias-state-business-primary,#7aaaff)", cursor: "pointer" }, onChange: (e) => onSet(k, Number(e.target.value)) }),
								react.createElement("span", { className: "xw-bubble" }, Number(val) + " / " + m.min + "-" + m.max)),
							react.createElement("div", { className: "xw-desc" }, m.desc));
						return react.createElement("div", { key: k, className: "xw-desc" }, react.createElement("b", null, k), " — " + String(val));
					}) : null),
				msg ? react.createElement("div", { className: "xw-status" }, msg) : null,
				react.createElement("div", { className: "xw-note" }, "生效范围：勾和阈值＝当场生效（每轮活读盘上设置）；打法注入＝下一场新会话带上；插件代码改动＝要重启 DSH 才装载。"));
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
