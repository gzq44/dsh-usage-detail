/**
 * dsh-usage-detail — browser half.
 *
 * Registers one "settings.section" entry ("使用详细") with three tabs:
 *   1. Conversation heatmap (daily count of human-sent user messages)
 *   2. Token usage totals grouped by provider/model
 *   3. Files produced per day (write/edit tool calls), with a date picker
 *
 * Data source: the official session Remote API (`session/list` + `session/events`),
 * paged backwards per session. Aggregates are cached in localStorage with a
 * per-session maxSeq checkpoint so later scans are incremental.
 */
window.__ModuleLoader__.load({
	id: "dsh-usage-detail",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const React = require("react");

		/* ------------------------------------------------------------------ */
		/* Styles                                                              */
		/* ------------------------------------------------------------------ */
		const CSS = `
.dud-section{max-width:800px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI Variable Text","Segoe UI",system-ui,"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",sans-serif}
.dud-heading{margin:0;font-size:17px;font-weight:650;letter-spacing:.01em}
.dud-intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12.5px;line-height:19px}

.dud_card{background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 4%,transparent);border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px 16px;flex-direction:column;gap:12px;display:flex}
.dud_cardTitle{font-size:11.5px;font-weight:600;color:var(--dsw-alias-label-tertiary);letter-spacing:.05em}

.dud_statGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px}
.dud_stat{flex-direction:column;gap:3px;display:flex;padding:11px 13px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 3%,transparent);border:.5px solid var(--dsw-alias-border-l2)}
.dud_statValue{font-size:20px;font-weight:700;line-height:24px;font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}
.dud_statLabel{font-size:11.5px;color:var(--dsw-alias-label-tertiary);line-height:15px}

.dud_seg{display:inline-flex;padding:3px;gap:2px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 3%,transparent);border:.5px solid var(--dsw-alias-border-l2);width:max-content}
.dud_segBtn{font:inherit;font-size:12.5px;line-height:18px;padding:5px 14px;border-radius:8px;border:0;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;transition:color .12s ease,background .12s ease}
.dud_segBtn:hover{color:var(--dsw-alias-label-primary)}
.dud_segBtn[data-active=true]{background:var(--dsw-alias-state-business-primary);color:#fff;font-weight:600}
.dud_segBtn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}

.dud_toolbar{flex-direction:column;gap:10px;display:flex}
.dud_toolbarRow{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.dud_meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:17px}
.dud_scanBtn{cursor:pointer;font:inherit;font-size:13px;font-weight:600;line-height:20px;padding:6px 16px;border-radius:9px;border:1px solid transparent;background:var(--dsh-usage-detail-accent,#26a641);color:#fff;transition:filter .12s ease,transform .05s ease}
.dud_scanBtn:hover{filter:brightness(1.1)}
.dud_scanBtn:active{transform:translateY(.5px)}
.dud_scanBtn[disabled]{cursor:default;opacity:.55;filter:none}
.dud_progress{height:8px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 10%,transparent);overflow:hidden}
.dud_progressBar{height:100%;border-radius:4px;background:linear-gradient(90deg,#26a641,#39d353);transition:width .25s ease}
.dud_error{color:#e5484d;font-size:12.5px;line-height:19px;margin:0}
.dud_empty{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12.5px}

.dud_hmScroll{overflow-x:auto;padding:2px 2px 6px}
.dud_hm{display:inline-grid;grid-auto-flow:column;grid-auto-columns:min-content;gap:3px}
.dud_hmCol{grid-auto-rows:min-content;display:grid;gap:3px}
.dud_hmCell{width:12px;height:12px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 10%,transparent)}
.dud_hmCell[data-level="1"]{background:#0e4429}
.dud_hmCell[data-level="2"]{background:#006d32}
.dud_hmCell[data-level="3"]{background:#26a641}
.dud_hmCell[data-level="4"]{background:#39d353}
.dud_hmCell:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dud_hmMonths{display:inline-grid;grid-auto-flow:column;gap:3px;margin-bottom:3px}
.dud_hmMonthLabel{font-size:10.5px;height:13px;line-height:13px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dud_hmMonthSpacer{width:12px}
.dud_hmLegend{align-items:center;gap:5px;display:flex;color:var(--dsw-alias-label-tertiary);font-size:11.5px}
.dud_hmSummary{color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));font-size:12.5px;font-weight:500;margin:0}

.dud_tableWrap{overflow-x:auto;margin:0 -4px}
.dud_table{border-collapse:collapse;font-size:12.5px;width:100%}
.dud_table th{color:var(--dsw-alias-label-tertiary);font-weight:600;font-size:11.5px;letter-spacing:.03em;text-align:right;padding:6px 10px;white-space:nowrap;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dud_table th:first-child,.dud_table td:first-child{text-align:left}
.dud_table td{padding:8px 10px;text-align:right;white-space:nowrap;border-bottom:.5px solid color-mix(in srgb,var(--dsw-alias-border-l2) 60%,transparent);font-variant-numeric:tabular-nums;line-height:17px}
.dud_table tbody tr:hover td{background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 3%,transparent)}
.dud_table tr.dud_total td{font-weight:700;border-bottom:0;border-top:1px solid var(--dsw-alias-border-l2)}

.dud_fileList{flex-direction:column;gap:8px;display:flex}
.dud_fileRow{flex-direction:column;gap:5px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 3%,transparent);border:.5px solid var(--dsw-alias-border-l2);display:flex;transition:background .12s ease}
.dud_fileRow:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 6%,transparent)}
.dud_filePath{font-family:ui-monospace,SFMono-Regular,"Cascadia Mono",Consolas,"Liberation Mono",monospace;font-size:12px;line-height:17px;word-break:break-all}
.dud_fileMeta{align-items:center;gap:8px;display:flex;color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:16px;flex-wrap:wrap}
.dud_badge{font-size:11px;line-height:16px;padding:1px 8px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary))}
.dud_badge[data-kind="write"]{color:#39d353;border-color:rgba(57,211,83,.4)}
.dud_badge[data-kind="edit"]{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-border-l2)}
.dud_dateInput{font:inherit;font-size:12.5px;padding:5px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);color-scheme:light dark}
.dud_navBtn{cursor:pointer;font:inherit;font-size:12.5px;line-height:18px;padding:5px 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);transition:background .12s ease}
.dud_navBtn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 6%,transparent)}
.dud_navBtn[disabled]{cursor:default;opacity:.5}
.dud_chips{align-items:center;gap:6px;display:flex;flex-wrap:wrap}
.dud_chip{cursor:pointer;font:inherit;font-size:12px;line-height:18px;padding:3px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-tertiary);transition:color .12s ease,background .12s ease}
.dud_chip:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary,#888) 5%,transparent)}
.dud_chip[data-active=true]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-state-business-primary)}
.dud_fileCount{color:var(--dsw-alias-label-tertiary);font-size:12px;margin:0}
`;
		const CSS_TAG = "dsh-usage-detail/styles";
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_TAG)}]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-usage-detail";
			tag.dataset.pluginCss = CSS_TAG;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		/* ------------------------------------------------------------------ */
		/* Locales                                                             */
		/* ------------------------------------------------------------------ */
		const NS = "usage.detail";
		const zh = {
			nav: "使用详细",
			title: "使用详细",
			intro: "统计您与 DSH 的对话频次、各模型 Token 用量与每日产出文件。数据来自本机会话历史，扫描后缓存在浏览器中，下次仅增量更新。",
			"tab.heatmap": "对话热力图",
			"tab.tokens": "Token 统计",
			"tab.files": "文件产出",
			scan: "扫描全部会话",
			rescan: "更新数据",
			scanning: "正在扫描",
			scannedAt: "上次扫描",
			never: "尚未扫描",
			sessions: "个会话",
			scanHint: "首次扫描需读取全部会话历史，约需十几秒，请耐心等待。",
			"heatmap.empty": "暂无数据。点击「扫描全部会话」开始统计。",
			"heatmap.less": "少",
			"heatmap.more": "多",
			"heatmap.range": "近一年您共发出 {n} 条消息（不含子代理与系统注入）。",
			"heatmap.day": "{date}：{n} 条消息",
			"tokens.model": "模型",
			"tokens.calls": "调用次数",
			"tokens.input": "输入",
			"tokens.output": "输出",
			"tokens.cacheRead": "缓存读",
			"tokens.cacheWrite": "缓存写",
			"tokens.reasoning": "推理",
			"tokens.total": "总计",
			"tokens.sum": "合计",
			"tokens.empty": "暂无数据。点击「扫描全部会话」开始统计。",
			"tokens.byModel": "按模型",
			"tokens.byTime": "按时间",
			"gran.day": "天",
			"gran.week": "周",
			"gran.month": "月",
			"tokens.period": "时间段",
			"heatmap.today": "回到今天",
			"stat.messages": "累计消息",
			"stat.activeDays": "活跃天数",
			"stat.streak": "最长连续",
			"stat.peak": "单日峰值",
			"stat.calls": "总调用",
			"stat.input": "总输入",
			"stat.output": "总输出",
			"stat.cacheRead": "缓存命中",
			"stat.total": "总 Token",
			"stat.unit.day": "天",
			"files.pick": "选择日期：",
			"files.prev": "前一天",
			"files.next": "后一天",
			"files.today": "今天",
			"files.none": "该日没有文件产出记录。",
			"files.new": "新建",
			"files.edit": "修改",
			"files.count": "共 {n} 个文件",
			"files.recent": "最近有产出的日期：",
			"files.noRecent": "尚无任何文件产出记录。",
			"error.partial": "{n} 个会话读取失败，统计可能不完整",
			"error.list": "会话列表读取失败：{msg}",
			"error.storage": "缓存写入失败（可能超出浏览器存储上限）：{msg}"
		};
		const en = {
			nav: "Usage Detail",
			title: "Usage Detail",
			intro: "Your DSH conversation frequency, per-model token usage, and files produced per day. Data is scanned from local session history and cached in the browser; later scans are incremental.",
			"tab.heatmap": "Heatmap",
			"tab.tokens": "Tokens",
			"tab.files": "Files",
			scan: "Scan all sessions",
			rescan: "Refresh data",
			scanning: "Scanning",
			scannedAt: "Last scan",
			never: "Never scanned",
			sessions: "sessions",
			scanHint: "The first scan reads every session's history and may take a while.",
			"heatmap.empty": "No data yet. Click \"Scan all sessions\" to start.",
			"heatmap.less": "Less",
			"heatmap.more": "More",
			"heatmap.range": "You sent {n} messages in the last year (subagents and injected context excluded).",
			"heatmap.day": "{date}: {n} messages",
			"tokens.model": "Model",
			"tokens.calls": "Calls",
			"tokens.input": "Input",
			"tokens.output": "Output",
			"tokens.cacheRead": "Cache read",
			"tokens.cacheWrite": "Cache write",
			"tokens.reasoning": "Reasoning",
			"tokens.total": "Total",
			"tokens.sum": "Total",
			"tokens.empty": "No data yet. Click \"Scan all sessions\" to start.",
			"tokens.byModel": "By model",
			"tokens.byTime": "By time",
			"gran.day": "Day",
			"gran.week": "Week",
			"gran.month": "Month",
			"tokens.period": "Period",
			"heatmap.today": "Today",
			"stat.messages": "Messages",
			"stat.activeDays": "Active days",
			"stat.streak": "Longest streak",
			"stat.peak": "Daily peak",
			"stat.calls": "Calls",
			"stat.input": "Input",
			"stat.output": "Output",
			"stat.cacheRead": "Cache read",
			"stat.total": "Total tokens",
			"stat.unit.day": "d",
			"files.pick": "Pick a date:",
			"files.prev": "Prev day",
			"files.next": "Next day",
			"files.today": "Today",
			"files.none": "No files were produced on this day.",
			"files.new": "created",
			"files.edit": "edited",
			"files.count": "{n} file(s)",
			"files.recent": "Recent days with output:",
			"files.noRecent": "No file output recorded yet.",
			"error.partial": "{n} session(s) failed to read; stats may be incomplete",
			"error.list": "Failed to list sessions: {msg}",
			"error.storage": "Failed to save cache (browser storage limit?): {msg}"
		};
		const FALLBACK_DICTS = { zh, en };

		/* ------------------------------------------------------------------ */
		/* Helpers                                                             */
		/* ------------------------------------------------------------------ */
		const STORE_KEY = "dsh-usage-detail:v1";
		const PAGE_MAX_MESSAGES = 500;

		function dayKeyOf(ms) {
			const d = new Date(ms);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		}
		function todayKey() {
			return dayKeyOf(Date.now());
		}
		function shiftDayKey(key, deltaDays) {
			const [y, m, d] = key.split("-").map(Number);
			const dt = new Date(y, m - 1, d + deltaDays);
			return dayKeyOf(dt.getTime());
		}
		/** Monday-start week key (the week's Monday date) of a day key. */
		function weekKeyOf(dayKey) {
			const [y, m, d] = dayKey.split("-").map(Number);
			const date = new Date(y, m - 1, d);
			date.setDate(date.getDate() - (date.getDay() + 6) % 7);
			return dayKeyOf(date.getTime());
		}
		/** Month key ("YYYY-MM") of a day key. */
		function monthKeyOf(dayKey) {
			return dayKey.slice(0, 7);
		}
		function fmtInt(n) {
			return Number(n || 0).toLocaleString("en-US");
		}
		/** Compact large numbers for stat cards: 1.2万 / 4.99亿 (zh), 12.3K / 4.99M (en). */
		function fmtCompact(n, lang) {
			const value = Number(n || 0);
			if (lang === "zh") {
				if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`;
				if (value >= 1e4) return `${(value / 1e4).toFixed(1)}万`;
				return fmtInt(value);
			}
			if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
			if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
			return fmtInt(value);
		}
		function fmtDateTime(ms) {
			if (!ms) return "–";
			const d = new Date(ms);
			const p = (x) => String(x).padStart(2, "0");
			return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
		}
		function fmtTime(ms) {
			if (!ms) return "–";
			const d = new Date(ms);
			const p = (x) => String(x).padStart(2, "0");
			return `${p(d.getHours())}:${p(d.getMinutes())}`;
		}

		function emptyAggregate() {
			return {
				version: 2,
				scannedAt: 0,
				sessions: {},
				dailyMessages: {},
				tokens: {},
				tokensByDay: {},
				files: {}
			};
		}

		function loadAggregate() {
			try {
				const raw = localStorage.getItem(STORE_KEY);
				if (!raw) return emptyAggregate();
				const parsed = JSON.parse(raw);
				/* v1 caches lack per-day token buckets: a full rescan rebuilds them. */
				if (parsed?.version !== 2) return emptyAggregate();
				return {
					version: 2,
					scannedAt: parsed.scannedAt || 0,
					sessions: parsed.sessions || {},
					dailyMessages: parsed.dailyMessages || {},
					tokens: parsed.tokens || {},
					tokensByDay: parsed.tokensByDay || {},
					files: parsed.files || {}
				};
			} catch {
				return emptyAggregate();
			}
		}

		let lastSaveAt = 0;
		function saveAggregate(agg, force) {
			const now = Date.now();
			if (!force && now - lastSaveAt < 2000) return true;
			try {
				localStorage.setItem(STORE_KEY, JSON.stringify(agg));
				lastSaveAt = now;
				return true;
			} catch (error) {
				console.warn("[dsh-usage-detail] cache save failed:", error);
				return false;
			}
		}

		/* ------------------------------------------------------------------ */
		/* Aggregation over one event                                          */
		/* ------------------------------------------------------------------ */
		/** Fold one durable event into the aggregate (mutates `agg`). */
		function applyEvent(agg, evt, sessionId, humanSession) {
			if (!evt || typeof evt.type !== "string") return;
			if (evt.type === "user/message" && humanSession) {
				const source = evt.data?.source;
				if (source?.kind === "user") {
					const key = dayKeyOf(evt.time);
					agg.dailyMessages[key] = (agg.dailyMessages[key] || 0) + 1;
				}
				return;
			}
			if (evt.type === "assistant/message") {
				const usage = evt.data?.usage;
				if (usage) {
					const src = evt.data?.message?.source;
					const key = `${src?.provider || "unknown"}/${src?.model || "unknown"}`;
					const input = usage.inputTokens || 0;
					const output = usage.outputTokens || 0;
					/* Per-model lifetime totals… */
					const bucket = agg.tokens[key] || (agg.tokens[key] = {
						input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, calls: 0
					});
					bucket.input += input;
					bucket.output += output;
					bucket.cacheRead += usage.cacheReadTokens || 0;
					bucket.cacheWrite += usage.cacheWriteTokens || 0;
					bucket.reasoning += usage.reasoningTokens || 0;
					bucket.total += usage.totalTokens ?? (input + output);
					bucket.calls += 1;
					/* …and the same usage bucketed by day for the time views. */
					const dayKey = dayKeyOf(evt.time);
					const day = agg.tokensByDay[dayKey] || (agg.tokensByDay[dayKey] = {});
					const dayBucket = day[key] || (day[key] = {
						input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, calls: 0
					});
					dayBucket.input += input;
					dayBucket.output += output;
					dayBucket.cacheRead += usage.cacheReadTokens || 0;
					dayBucket.cacheWrite += usage.cacheWriteTokens || 0;
					dayBucket.reasoning += usage.reasoningTokens || 0;
					dayBucket.total += usage.totalTokens ?? (input + output);
					dayBucket.calls += 1;
				}
				return;
			}
			if (evt.type === "tool/call") {
				const name = evt.data?.name;
				if (name !== "write" && name !== "edit") return;
				let filePath;
				try {
					const args = JSON.parse(evt.data.arguments || "");
					filePath = args?.file_path;
				} catch { /* malformed arguments: ignore */ }
				if (typeof filePath !== "string" || filePath.length === 0) return;
				const key = dayKeyOf(evt.time);
				const day = agg.files[key] || (agg.files[key] = {});
				const entry = day[filePath] || (day[filePath] = { path: filePath, writes: 0, edits: 0, firstTime: evt.time, lastTime: evt.time });
				if (name === "write") entry.writes += 1;
				else entry.edits += 1;
				entry.lastTime = evt.time;
				return;
			}
		}

		/* ------------------------------------------------------------------ */
		/* Scan engine (client, over the session Remote API)                   */
		/* ------------------------------------------------------------------ */
		/**
		 * Page backwards through one session's durable log, folding events newer
		 * than `maxSeq` into `agg`. Stops early at an inherited-seed marker (fork
		 * prefix owned by the parent session).
		 * @param address - typed Remote address ("session" or "subagent").
		 * @returns the new maxSeq checkpoint (unchanged when nothing new).
		 */
		async function scanSession(remote, address, sessionId, humanSession, agg, signal) {
			const prev = agg.sessions[sessionId];
			const maxSeq = prev?.maxSeq ?? -1;
			let newMax = maxSeq;
			let beforeSeq;
			for (;;) {
				signal.throwIfAborted();
				const request = {
					address,
					maxMessages: PAGE_MAX_MESSAGES
				};
				if (beforeSeq !== undefined) request.beforeSeq = beforeSeq;
				const result = await remote.session.events(request, signal);
				if (!result.ok) {
					const error = new Error(`session/events failed for ${sessionId}`);
					error.code = result.error?.code || "gateway/internal";
					throw error;
				}
				const page = result.value;
				const records = page.records || [];
				let reachedKnown = false;
				let seedCut = false;
				for (const record of records) {
					const evt = record?.event ?? record;
					if (!evt || typeof evt.seq !== "number") continue;
					if (evt.seq <= maxSeq) { reachedKnown = true; break; }
					if (evt.type === "session/end-seed" && evt.data?.inherited === true) { seedCut = true; break; }
					if (evt.seq > newMax) newMax = evt.seq;
					applyEvent(agg, evt, sessionId, humanSession);
				}
				if (reachedKnown || seedCut || !page.hasMore) break;
				const firstSeq = records[0]?.event?.seq ?? records[0]?.seq;
				if (typeof firstSeq !== "number") break;
				beforeSeq = firstSeq;
			}
			if (!prev || (prev.maxSeq ?? -1) < newMax) {
				agg.sessions[sessionId] = { maxSeq: newMax, human: humanSession };
			}
			return newMax;
		}

		/* ------------------------------------------------------------------ */
		/* Store                                                               */
		/* ------------------------------------------------------------------ */
		function createStore(initial) {
			let snapshot = initial;
			const listeners = new Set();
			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => { listeners.delete(listener); };
				},
				publish(next) {
					snapshot = next;
					for (const listener of [...listeners]) listener();
				}
			};
		}

		const initialUiState = (data) => ({
			phase: data && data.scannedAt > 0 ? "ready" : "empty",
			data: data || emptyAggregate(),
			progress: { done: 0, total: 0 },
			errors: []
		});

		let sharedStore = null;
		let sharedController = null;

		function startScan(ctx, storeArg) {
			const store = storeArg || sharedStore;
			if (!store || sharedController) return;
			const controller = new AbortController();
			sharedController = controller;
			const signal = controller.signal;
			const previous = sharedStore.getSnapshot();
			sharedStore.publish({ ...previous, phase: "scanning", progress: { done: 0, total: 0 }, errors: [] });
			(async () => {
				const agg = loadAggregate();
				const errors = [];
				try {
					const listResult = await ctx.remote.session.list({}, signal);
					if (!listResult.ok) throw new Error(listResult.error?.code || "gateway/internal");
					const items = listResult.value.items || [];
					const total = items.length;
					sharedStore.publish({ ...sharedStore.getSnapshot(), progress: { done: 0, total } });
					let done = 0;
					for (const summary of items) {
						signal.throwIfAborted();
						const sessionId = summary.sessionId;
						if (typeof sessionId !== "string" || sessionId.length === 0) { done += 1; continue; }
						const humanSession = summary.origin !== "subagent";
						/* Subagent sessions carry no cwd header; they are only
						 * readable through their typed subagent address. */
						const address = (!humanSession && typeof summary.parentSessionId === "string" && summary.parentSessionId.length > 0)
							? { kind: "subagent", parentSessionId: summary.parentSessionId, childSessionId: sessionId, mode: "unknown" }
							: { kind: "session", sessionId };
						try {
							await scanSession(ctx.remote, address, sessionId, humanSession, agg, signal);
						} catch (error) {
							if (signal.aborted) throw error;
							errors.push({ sessionId, code: error?.code || "gateway/internal" });
							agg.sessions[sessionId] = { ...(agg.sessions[sessionId] || { maxSeq: -1 }), failed: true };
						}
						done += 1;
						saveAggregate(agg, false);
						sharedStore.publish({ ...sharedStore.getSnapshot(), progress: { done, total } });
					}
					signal.throwIfAborted();
					agg.scannedAt = Date.now();
					const stored = saveAggregate(agg, true);
					if (!stored) errors.push("__storage__");
					sharedStore.publish({ ...sharedStore.getSnapshot(), phase: "ready", data: agg, errors });
				} catch (error) {
					if (signal.aborted) {
						/* Scan cancelled: keep whatever was folded so far. */
						saveAggregate(agg, true);
						sharedStore.publish({
							...sharedStore.getSnapshot(),
							phase: agg.scannedAt > 0 ? "ready" : "empty",
							data: agg,
							errors
						});
					} else {
						console.error("[dsh-usage-detail] scan failed:", error);
						sharedStore.publish({
							...sharedStore.getSnapshot(),
							phase: agg.scannedAt > 0 ? "ready" : "empty",
							data: agg,
							errors: [...errors, `__list__:${error?.message || error}`]
						});
					}
				} finally {
					if (sharedController === controller) sharedController = null;
				}
			})();
		}

		/* ------------------------------------------------------------------ */
		/* Views                                                               */
		/* ------------------------------------------------------------------ */
		const h = React.createElement;

		/** Segmented control used for the main tabs and the token mode/granularity switches. */
		function Segmented({ options, value, onChange, ariaLabel }) {
			return h("div", { className: "dud_seg", role: "tablist", "aria-label": ariaLabel },
				options.map((option) => h("button", {
					type: "button",
					key: option.value,
					role: "tab",
					className: "dud_segBtn",
					"data-active": value === option.value ? "true" : undefined,
					"aria-selected": value === option.value,
					onClick: () => onChange(option.value)
				}, option.label)));
		}

		/** One stat card: a large number over a small label. */
		function StatCard({ value, label }) {
			return h("div", { className: "dud_stat" },
				h("span", { className: "dud_statValue" }, value),
				h("span", { className: "dud_statLabel" }, label)
			);
		}

		/** Build the 53-week grid columns ending today (Monday-first weeks). */
		function buildHeatmapColumns(dailyMessages) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const mondayIndex = (today.getDay() + 6) % 7;
			const start = new Date(today);
			start.setDate(start.getDate() - mondayIndex - 7 * 52);
			const columns = [];
			const months = [];
			let lastMonth = -1;
			for (let week = 0; week < 53; week += 1) {
				const column = [];
				const weekStart = new Date(start);
				weekStart.setDate(start.getDate() + week * 7);
				const month = weekStart.getMonth();
				months.push(month !== lastMonth ? month : null);
				lastMonth = month;
				for (let day = 0; day < 7; day += 1) {
					const d = new Date(weekStart);
					d.setDate(weekStart.getDate() + day);
					if (d > today) { column.push(null); continue; }
					const key = dayKeyOf(d.getTime());
					column.push({ key, date: d, count: dailyMessages[key] || 0 });
				}
				columns.push(column);
			}
			return { columns, months };
		}

		function heatmapLevels(dailyMessages) {
			const values = Object.values(dailyMessages || {}).filter((n) => n > 0).sort((a, b) => a - b);
			if (values.length === 0) return [1, 1, 1];
			const quantile = (q) => values[Math.min(values.length - 1, Math.floor(q * (values.length - 1)))];
			return [quantile(0.25), quantile(0.5), quantile(0.75)];
		}

		const MONTH_NAMES = {
			zh: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
			en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
		};

		/** Longest run of consecutive days with at least one message. */
		function longestStreak(dailyMessages) {
			const keys = Object.entries(dailyMessages || {}).filter(([, n]) => n > 0).map(([k]) => k).sort();
			let best = 0;
			let run = 0;
			let previous;
			for (const key of keys) {
				run = previous !== undefined && shiftDayKey(previous, 1) === key ? run + 1 : 1;
				if (run > best) best = run;
				previous = key;
			}
			return best;
		}

		function HeatmapView({ data, t }) {
			const counts = data.dailyMessages || {};
			const hasData = Object.keys(counts).length > 0;
			const scrollRef = React.useRef(null);
			const didAutoScrollRef = React.useRef(false);
			React.useEffect(() => {
				/* First paint with data: start at the current week (right edge),
				 * so the current month is visible without dragging. */
				if (!hasData || didAutoScrollRef.current) return;
				const element = scrollRef.current;
				if (!element) return;
				element.scrollLeft = element.scrollWidth;
				didAutoScrollRef.current = true;
			}, [hasData]);
			const backToToday = () => {
				const element = scrollRef.current;
				if (element) element.scrollLeft = element.scrollWidth;
			};
			if (!hasData) return h("p", { className: "dud_empty" }, t("heatmap.empty"));
			const lang = (typeof navigator !== "undefined" && navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
			const { columns, months } = buildHeatmapColumns(counts);
			const [t1, t2, t3] = heatmapLevels(counts);
			const levelOf = (n) => (n <= 0 ? 0 : n <= t1 ? 1 : n <= t2 ? 2 : n <= t3 ? 3 : 4);
			const monthNames = MONTH_NAMES[lang === "zh" ? "zh" : "en"];
			let totalInRange = 0;
			for (const column of columns) {
				for (const cell of column) if (cell) totalInRange += cell.count;
			}
			const activeDays = Object.values(counts).filter((n) => n > 0).length;
			const peak = Math.max(0, ...Object.values(counts));
			const streak = longestStreak(counts);
			return h("div", { style: { flexDirection: "column", gap: "12px", display: "flex" } },
				h("div", { className: "dud_statGrid" },
					h(StatCard, { value: fmtCompact(totalInRange, lang), label: t("stat.messages") }),
					h(StatCard, { value: fmtInt(activeDays), label: t("stat.activeDays") }),
					h(StatCard, { value: `${fmtInt(streak)} ${t("stat.unit.day")}`, label: t("stat.streak") }),
					h(StatCard, { value: fmtInt(peak), label: t("stat.peak") })
				),
				h("div", { className: "dud_card" },
					h("div", { className: "dud_toolbarRow", style: { justifyContent: "space-between" } },
						h("p", { className: "dud_hmSummary" }, t("heatmap.range").replace("{n}", fmtInt(totalInRange))),
						h("button", { type: "button", className: "dud_chip", onClick: backToToday }, t("heatmap.today"))
					),
					h("div", { className: "dud_hmScroll", ref: scrollRef },
					h("div", { style: { display: "inline-block" } },
						h("div", { className: "dud_hmMonths" },
							months.map((month, index) => h(
								"div",
								{ key: index, className: month === null ? "dud_hmMonthSpacer" : "dud_hmMonthLabel", style: month === null ? { width: "11px" } : undefined },
								month === null ? null : monthNames[month]
							))
						),
						h("div", { className: "dud_hm", role: "grid", "aria-label": t("tab.heatmap") },
							columns.map((column, weekIndex) => h(
								"div",
								{ key: weekIndex, className: "dud_hmCol", role: "row" },
								column.map((cell, dayIndex) => {
									if (cell === null) return h("div", { key: dayIndex, className: "dud_hmCell", style: { visibility: "hidden" } });
									const dateLabel = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, "0")}-${String(cell.date.getDate()).padStart(2, "0")}`;
									return h("div", {
										key: dayIndex,
										className: "dud_hmCell",
										role: "gridcell",
										"data-level": String(levelOf(cell.count)),
										tabIndex: -1,
										title: t("heatmap.day").replace("{date}", dateLabel).replace("{n}", fmtInt(cell.count))
									});
								}))
							)
						),
						h("div", { className: "dud_hmLegend" },
							t("heatmap.less"),
							[0, 1, 2, 3, 4].map((level) => h("div", { key: level, className: "dud_hmCell", "data-level": String(level) })),
							t("heatmap.more")
						)
					)
				)
			)
		);
		}

		const EMPTY_SUM = () => ({ calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 });

		/** Collapse per-day per-model usage rows into granularity buckets, newest first. */
		function collapseTimeBuckets(tokensByDay, granularity) {
			const out = new Map();
			for (const [dayKey, models] of Object.entries(tokensByDay || {})) {
				const key = granularity === "day" ? dayKey
					: granularity === "week" ? weekKeyOf(dayKey)
					: monthKeyOf(dayKey);
				let row = out.get(key);
				if (row === undefined) {
					const label = granularity === "week" ? `${key} ~ ${shiftDayKey(key, 6)}` : key;
					row = { key, label, sums: EMPTY_SUM() };
					out.set(key, row);
				}
				for (const modelRow of Object.values(models || {})) {
					row.sums.calls += modelRow.calls || 0;
					row.sums.input += modelRow.input || 0;
					row.sums.output += modelRow.output || 0;
					row.sums.cacheRead += modelRow.cacheRead || 0;
					row.sums.cacheWrite += modelRow.cacheWrite || 0;
					row.sums.reasoning += modelRow.reasoning || 0;
					row.sums.total += modelRow.total || 0;
				}
			}
			return [...out.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
		}

		const TOKEN_COLUMNS = ["tokens.calls", "tokens.input", "tokens.output", "tokens.cacheRead", "tokens.cacheWrite", "tokens.reasoning", "tokens.total"];

		function tokenTable(t, headCells, bodyRows, totalRow) {
			return h("div", { className: "dud_tableWrap" },
				h("table", { className: "dud_table" },
					h("thead", null, h("tr", null, headCells)),
					h("tbody", null, [...bodyRows, totalRow])
				)
			);
		}

		function TokenView({ data, t }) {
			const entries = Object.entries(data.tokens || {});
			const [mode, setMode] = React.useState("model");
			const [granularity, setGranularity] = React.useState("week");
			if (entries.length === 0) return h("p", { className: "dud_empty" }, t("tokens.empty"));
			const lang = (typeof navigator !== "undefined" && navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
			/* Lifetime totals feed the stat cards in both modes. */
			const lifetime = entries.reduce((acc, [, v]) => ({
				calls: acc.calls + (v.calls || 0), input: acc.input + (v.input || 0), output: acc.output + (v.output || 0),
				cacheRead: acc.cacheRead + (v.cacheRead || 0), total: acc.total + (v.total || 0)
			}), EMPTY_SUM());
			const header = [t(mode === "model" ? "tokens.model" : "tokens.period"), ...TOKEN_COLUMNS.map(t)];
			let bodyRows;
			let totalRow;
			if (mode === "model") {
				const rows = entries
					.map(([model, v]) => ({ model, ...v, computed: (v.input || 0) + (v.output || 0) + (v.cacheRead || 0) + (v.cacheWrite || 0) }))
					.sort((a, b) => b.computed - a.computed);
				bodyRows = rows.map((row) => h("tr", { key: row.model },
					h("td", null, row.model),
					h("td", null, fmtInt(row.calls)),
					h("td", null, fmtInt(row.input)),
					h("td", null, fmtInt(row.output)),
					h("td", null, fmtInt(row.cacheRead)),
					h("td", null, fmtInt(row.cacheWrite)),
					h("td", null, fmtInt(row.reasoning)),
					h("td", null, fmtInt(row.total))
				));
				const sum = rows.reduce((acc, r) => ({
					calls: acc.calls + r.calls, input: acc.input + r.input, output: acc.output + r.output,
					cacheRead: acc.cacheRead + r.cacheRead, cacheWrite: acc.cacheWrite + r.cacheWrite,
					reasoning: acc.reasoning + r.reasoning, total: acc.total + r.total
				}), EMPTY_SUM());
				totalRow = h("tr", { className: "dud_total", key: "__total" },
					h("td", null, t("tokens.sum")),
					h("td", null, fmtInt(sum.calls)),
					h("td", null, fmtInt(sum.input)),
					h("td", null, fmtInt(sum.output)),
					h("td", null, fmtInt(sum.cacheRead)),
					h("td", null, fmtInt(sum.cacheWrite)),
					h("td", null, fmtInt(sum.reasoning)),
					h("td", null, fmtInt(sum.total))
				);
			} else {
				const rows = collapseTimeBuckets(data.tokensByDay, granularity);
				bodyRows = rows.map((row) => h("tr", { key: row.key },
					h("td", null, row.label),
					h("td", null, fmtInt(row.sums.calls)),
					h("td", null, fmtInt(row.sums.input)),
					h("td", null, fmtInt(row.sums.output)),
					h("td", null, fmtInt(row.sums.cacheRead)),
					h("td", null, fmtInt(row.sums.cacheWrite)),
					h("td", null, fmtInt(row.sums.reasoning)),
					h("td", null, fmtInt(row.sums.total))
				));
				const sum = rows.reduce((acc, r) => ({
					calls: acc.calls + r.sums.calls, input: acc.input + r.sums.input, output: acc.output + r.sums.output,
					cacheRead: acc.cacheRead + r.sums.cacheRead, cacheWrite: acc.cacheWrite + r.sums.cacheWrite,
					reasoning: acc.reasoning + r.sums.reasoning, total: acc.total + r.sums.total
				}), EMPTY_SUM());
				totalRow = h("tr", { className: "dud_total", key: "__total" },
					h("td", null, t("tokens.sum")),
					h("td", null, fmtInt(sum.calls)),
					h("td", null, fmtInt(sum.input)),
					h("td", null, fmtInt(sum.output)),
					h("td", null, fmtInt(sum.cacheRead)),
					h("td", null, fmtInt(sum.cacheWrite)),
					h("td", null, fmtInt(sum.reasoning)),
					h("td", null, fmtInt(sum.total))
				);
			}
			return h("div", { style: { flexDirection: "column", gap: "12px", display: "flex" } },
				h("div", { className: "dud_statGrid" },
					h(StatCard, { value: fmtCompact(lifetime.calls, lang), label: t("stat.calls") }),
					h(StatCard, { value: fmtCompact(lifetime.input, lang), label: t("stat.input") }),
					h(StatCard, { value: fmtCompact(lifetime.output, lang), label: t("stat.output") }),
					h(StatCard, { value: fmtCompact(lifetime.cacheRead, lang), label: t("stat.cacheRead") }),
					h(StatCard, { value: fmtCompact(lifetime.total, lang), label: t("stat.total") })
				),
				h("div", { className: "dud_card" },
					h("div", { className: "dud_toolbarRow", style: { justifyContent: "space-between" } },
						h(Segmented, {
							ariaLabel: t("tab.tokens"),
							value: mode,
							onChange: setMode,
							options: [
								{ value: "model", label: t("tokens.byModel") },
								{ value: "time", label: t("tokens.byTime") }
							]
						}),
						mode === "time" ? h(Segmented, {
							ariaLabel: t("tokens.byTime"),
							value: granularity,
							onChange: setGranularity,
							options: [
								{ value: "day", label: t("gran.day") },
								{ value: "week", label: t("gran.week") },
								{ value: "month", label: t("gran.month") }
							]
						}) : null
					),
					bodyRows.length === 0 ? h("p", { className: "dud_empty" }, t("tokens.empty")) : tokenTable(t,
						header.map((label, i) => h("th", { key: i }, label)),
						bodyRows,
						totalRow
					)
				)
			);
		}

		function FilesView({ data, t }) {
			const files = data.files || {};
			const recentDays = React.useMemo(
				() => Object.keys(files).sort((a, b) => (a < b ? 1 : -1)).slice(0, 14),
				[files]
			);
			const initialDay = React.useMemo(() => {
				if (files[todayKey()] && Object.keys(files[todayKey()]).length > 0) return todayKey();
				return recentDays[0] || todayKey();
			}, [files, recentDays]);
			const [day, setDay] = React.useState(initialDay);
			React.useEffect(() => { setDay(initialDay); }, [initialDay]);
			const dayFiles = files[day] || {};
			const rows = Object.values(dayFiles).sort((a, b) => b.lastTime - a.lastTime);
			return h("div", { style: { flexDirection: "column", gap: "12px", display: "flex" } },
				h("div", { className: "dud_card" },
					h("div", { className: "dud_toolbarRow" },
						h("span", { className: "dud_meta" }, t("files.pick")),
						h("button", {
							type: "button",
							className: "dud_navBtn",
							onClick: () => setDay(shiftDayKey(day, -1))
						}, "‹ " + t("files.prev")),
						h("input", {
							type: "date",
							className: "dud_dateInput",
							value: day,
							onChange: (event) => { if (event.target.value) setDay(event.target.value); }
						}),
						h("button", {
							type: "button",
							className: "dud_navBtn",
							disabled: day >= todayKey(),
							onClick: () => setDay(shiftDayKey(day, 1))
						}, t("files.next") + " ›")
					),
					recentDays.length > 0 ? h("div", { className: "dud_chips" },
						h("span", { className: "dud_meta" }, t("files.recent")),
						recentDays.map((key) => h("button", {
							type: "button",
							key: key,
							className: "dud_chip",
							"data-active": key === day ? "true" : undefined,
							onClick: () => setDay(key)
						}, key)
						)
					) : h("p", { className: "dud_empty" }, t("files.noRecent"))
				),
				h("div", { className: "dud_card" },
					h("div", { className: "dud_toolbarRow", style: { justifyContent: "space-between" } },
						h("span", { className: "dud_cardTitle" }, t("tab.files")),
						h("span", { className: "dud_fileCount" }, t("files.count").replace("{n}", fmtInt(rows.length)))
					),
					rows.length === 0
						? h("p", { className: "dud_empty" }, t("files.none"))
						: h("div", { className: "dud_fileList" },
							rows.map((row) => h("div", { className: "dud_fileRow", key: row.path },
								h("div", { className: "dud_filePath" }, row.path),
								h("div", { className: "dud_fileMeta" },
									row.writes > 0 ? h("span", { className: "dud_badge", "data-kind": "write" }, `${t("files.new")} ×${fmtInt(row.writes)}`) : null,
									row.edits > 0 ? h("span", { className: "dud_badge", "data-kind": "edit" }, `${t("files.edit")} ×${fmtInt(row.edits)}`) : null,
									h("span", null, `${fmtTime(row.firstTime)} – ${fmtTime(row.lastTime)}`)
								)
							))
						)
				)
			);
		}

		/* ------------------------------------------------------------------ */
		/* Section component                                                   */
		/* ------------------------------------------------------------------ */
		function UsageDetailSection(props) {
			const { t: propT } = props || {};
			const t = typeof propT === "function"
				? propT
				: (key) => (FALLBACK_DICTS.zh[key] ?? FALLBACK_DICTS.en[key] ?? key);
			const store = sharedStore;
			const empty = h("div", { className: "dud_section" },
				h("h2", { className: "dud_heading" }, t("title")),
				h("p", { className: "dud_empty" }, t("heatmap.empty")));
			if (!store) return empty;
			const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
			const [tab, setTab] = React.useState("heatmap");
			const scanning = state.phase === "scanning";
			const progress = state.progress || { done: 0, total: 0 };
			const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
			const sessionCount = Object.keys(state.data?.sessions || {}).length;
			const storageError = state.errors?.includes("__storage__");
			const listErrors = state.errors?.filter((e) => typeof e === "string" && e.startsWith("__list__:")) || [];
			const failRows = (state.errors || []).filter((e) => e && typeof e === "object" && typeof e.sessionId === "string");
			const codes = {};
			for (const row of failRows) codes[row.code] = (codes[row.code] || 0) + 1;
			const failSummary = Object.entries(codes).map(([code, n]) => `${code} ×${n}`).join("，");
			const scanButtonLabel = state.data?.scannedAt > 0 ? t("rescan") : t("scan");
			return h("div", { className: "dud-section" },
				h("h2", { className: "dud-heading" }, t("title")),
				h("p", { className: "dud-intro" }, t("intro")),
				h("div", { className: "dud_card" },
					h("div", { className: "dud_toolbar" },
						h("div", { className: "dud_toolbarRow" },
							h("button", {
								type: "button",
								className: "dud_scanBtn",
								disabled: scanning,
								onClick: () => startScan(sharedContext, store)
							}, scanning ? `${t("scanning")} ${percent}%` : scanButtonLabel),
							h("span", { className: "dud_meta" },
								`${t("scannedAt")}: ${state.data?.scannedAt > 0 ? fmtDateTime(state.data.scannedAt) : t("never")}`
								+ (sessionCount > 0 ? ` · ${fmtInt(sessionCount)} ${t("sessions")}` : ""))
						),
						state.data?.scannedAt > 0 ? null : h("p", { className: "dud_meta" }, t("scanHint")),
						scanning ? h("div", { className: "dud_progress" },
							h("div", { className: "dud_progressBar", style: { width: `${percent}%` } })
						) : null,
						storageError ? h("p", { className: "dud_error" }, t("error.storage").replace("{msg}", "")) : null,
						listErrors.length > 0 ? h("p", { className: "dud_error" }, t("error.list").replace("{msg}", listErrors[0].slice("__list__:".length))) : null,
						(!scanning && failRows.length > 0) ? h("p", { className: "dud_error" },
							`${t("error.partial").replace("{n}", fmtInt(failRows.length))}${failSummary ? `（${failSummary}）` : ""}`) : null
					)
				),
				h(Segmented, {
					ariaLabel: t("title"),
					value: tab,
					onChange: setTab,
					options: [
						{ value: "heatmap", label: t("tab.heatmap") },
						{ value: "tokens", label: t("tab.tokens") },
						{ value: "files", label: t("tab.files") }
					]
				}),
				h("div", { style: { minWidth: 0, flexDirection: "column", gap: "12px", display: "flex" } },
					tab === "heatmap" ? h(HeatmapView, { data: state.data, t }) : null,
					tab === "tokens" ? h(TokenView, { data: state.data, t }) : null,
					tab === "files" ? h(FilesView, { data: state.data, t }) : null
				)
			);
		}

		/* ------------------------------------------------------------------ */
		/* Plugin apply                                                        */
		/* ------------------------------------------------------------------ */
		let sharedContext = null;

		function apply(ctx) {
			sharedContext = ctx;
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "usage-detail: dictionaries");
			const t = ctx.locale.bind(NS);
			const storeInstance = createStore(initialUiState(loadAggregate()));
			sharedStore = storeInstance;
			ctx.effect(() => () => {
				if (sharedController) sharedController.abort();
				if (sharedStore === storeInstance) sharedStore = null;
			}, "usage-detail: scan lifecycle");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "usage-detail",
				order: 12,
				label: () => t("nav"),
				locale: NS,
				inject: () => ({ hooks: { usageStats: storeInstance } })
			}, UsageDetailSection));
		}

		exports.apply = apply;
		exports.inject = ["slots", "locale", "remote", "remote.session"];
		/* Test surface: harmless in the browser, used by scripts/smoke-test.cjs. */
		exports._internals = { applyEvent, scanSession, createStore, initialUiState, startScan, buildHeatmapColumns, heatmapLevels, dayKeyOf, weekKeyOf, monthKeyOf, collapseTimeBuckets };
		return module.exports;
	}
});
