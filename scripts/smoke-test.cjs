/** Smoke test: load lib/client.js with a mocked ModuleLoader, mount apply(),
 *  then drive a full fake scan through _internals.startScan and verify the
 *  aggregates (heatmap buckets, per-model tokens, per-day files). */
const fs = require("node:fs");
const path = require("node:path");

// --- localStorage mock -------------------------------------------------
const storage = new Map();
global.localStorage = {
	getItem(k) { return storage.has(k) ? storage.get(k) : null; },
	setItem(k, v) { storage.set(k, String(v)); },
	removeItem(k) { storage.delete(k); }
};

// --- React mock (only what the components touch at module level) --------
const reactMock = {
	createElement: () => null,
	useSyncExternalStore: () => ({}),
	useState: () => [null, () => {}],
	useMemo: (fn) => fn(),
	useEffect: () => {}
};

// --- Load the plugin ----------------------------------------------------
const source = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
const header = "factory: (require) => {";
const bodyStart = source.indexOf(header) + header.length;
const tail = "\t}\n});";
const bodyEnd = source.lastIndexOf(tail);
if (bodyEnd < 0) throw new Error("cannot locate factory tail");
const factory = new Function("require", source.slice(bodyStart, bodyEnd));
const plugin = factory((id) => {
	if (id === "react") return reactMock;
	throw new Error("unexpected require: " + id);
});

console.log("inject:", JSON.stringify(plugin.inject));
if (JSON.stringify(plugin.inject) !== JSON.stringify(["slots", "locale", "remote", "remote.session"])) {
	throw new Error("unexpected inject list");
}

// --- Mount apply() on a mock cordis ctx ---------------------------------
let sectionHook = null;
const dictionaries = [];
const ctx = {
	locale: {
		register: (ns, dicts) => { dictionaries.push(ns); return () => {}; },
		bind: (ns) => (key) => `[${ns}]${key}`
	},
	effect: (fn) => { fn(); return () => {}; },
	slots: {
		inject: (name, register) => { sectionHook = { name, register }; },
		register: (options, Component) => ({ options, Component })
	},
	remote: null
};
plugin.apply(ctx);
if (!sectionHook || sectionHook.name !== "settings.section") throw new Error("settings.section not registered");
const registration = sectionHook.register();
if (registration.options.id !== "usage-detail" || registration.options.order !== 12) throw new Error("bad registration options");
if (typeof registration.options.label() !== "string") throw new Error("label not a string");
if (typeof registration.Component !== "function") throw new Error("component missing");
const injected = registration.options.inject();
if (!injected?.hooks?.usageStats?.getSnapshot) throw new Error("usageStats hook store missing");
console.log("section registered:", registration.options.id, "order", registration.options.order, "| dicts:", dictionaries.join(","));

// --- Fake remote with two sessions --------------------------------------
const t = (y, m, d, hh) => new Date(y, m - 1, d, hh, 0, 0).getTime();
const logs = {
	s1: [
		{ type: "session", seq: 0, time: t(2026, 11, 1), data: {} },
		{ type: "user/message", seq: 1, time: t(2026, 11, 5, 9), data: { source: { kind: "user" } } },
		{ type: "user/message", seq: 2, time: t(2026, 11, 5, 10), data: { source: { kind: "time-context" } } },
		{ type: "assistant/message", seq: 3, time: t(2026, 11, 4, 10), data: { usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, cacheReadTokens: 10 }, message: { source: { provider: "companyseek", model: "glm-5.3" } } } },
		{ type: "assistant/message", seq: 7, time: t(2026, 11, 5, 10), data: { usage: { inputTokens: 7, outputTokens: 3 }, message: { source: { provider: "companyseek", model: "glm-5.3" } } } },
		{ type: "tool/call", seq: 4, time: t(2026, 11, 5, 11), data: { name: "write", arguments: JSON.stringify({ file_path: "C:\\test\\a.md", content: "x" }) } },
		{ type: "tool/call", seq: 5, time: t(2026, 11, 5, 12), data: { name: "edit", arguments: JSON.stringify({ file_path: "C:\\test\\a.md", old_string: "x", new_string: "y" }) } },
		{ type: "tool/call", seq: 6, time: t(2026, 11, 5, 13), data: { name: "pwsh", arguments: JSON.stringify({ command: "ls" }) } }
	],
	sub1: [
		{ type: "user/message", seq: 1, time: t(2026, 11, 5, 14), data: { source: { kind: "user" } } },
		{ type: "assistant/message", seq: 2, time: t(2026, 11, 5, 14), data: { usage: { inputTokens: 7, outputTokens: 3 }, message: { source: { provider: "companyseek", model: "glm-5.3" } } } },
		{ type: "tool/call", seq: 3, time: t(2026, 11, 5, 15), data: { name: "write", arguments: JSON.stringify({ file_path: "C:\\test\\sub.txt", content: "" }) } }
	]
};
let callCount = 0;
const fakeRemote = {
	session: {
		list: async () => ({ ok: true, value: { items: [
			{ sessionId: "s1", origin: undefined },
			{ sessionId: "sub1", origin: "subagent" }
		] } }),
		events: async () => {
			callCount += 1;
			// Single page per session (hasMore false)
			if (callCount === 1) return { ok: true, value: { records: logs.s1.map((event) => ({ type: "event", event })), hasMore: false, cursor: 6 } };
			if (callCount === 2) return { ok: true, value: { records: logs.sub1.map((event) => ({ type: "event", event })), hasMore: false, cursor: 3 } };
			return { ok: true, value: { records: [], hasMore: false, cursor: 0 } };
		}
	}
};

// --- Drive a full scan through the store the UI uses --------------------
const store = injected.hooks.usageStats;
plugin._internals.startScan({ ...ctx, remote: fakeRemote }, store);
const waitFor = (predicate, timeoutMs = 5000) => new Promise((resolve, reject) => {
	const started = Date.now();
	const tick = () => {
		if (predicate()) return resolve();
		if (Date.now() - started > timeoutMs) return reject(new Error("timeout waiting for scan"));
		setTimeout(tick, 20);
	};
	tick();
});
(async () => {
	await waitFor(() => store.getSnapshot().phase === "ready");
	const snap = store.getSnapshot();
	const agg = snap.data;
	console.log("phase:", snap.phase, "scannedAt>0:", agg.scannedAt > 0, "errors:", JSON.stringify(snap.errors));

	// Heatmap: only the human message from s1 counts (subagent + injected excluded)
	const dm = agg.dailyMessages;
	const humanCount = Object.values(dm).reduce((a, b) => a + b, 0);
	if (humanCount !== 1) throw new Error(`expected 1 human message, got ${humanCount}: ${JSON.stringify(dm)}`);
	console.log("heatmap bucket:", JSON.stringify(dm));

	// Tokens: three usage events (11-04 ×1, 11-05 ×2) on one model
	const tokenRow = agg.tokens["companyseek/glm-5.3"];
	if (!tokenRow) throw new Error("token row missing: " + JSON.stringify(agg.tokens));
	if (tokenRow.calls !== 3 || tokenRow.input !== 114 || tokenRow.output !== 56 || tokenRow.cacheRead !== 10 || tokenRow.total !== 170) {
		throw new Error("token aggregation wrong: " + JSON.stringify(tokenRow));
	}
	console.log("tokens:", JSON.stringify(tokenRow));

	// Per-day token buckets
	const byDay = agg.tokensByDay || {};
	const day4 = byDay["2026-11-04"]?.["companyseek/glm-5.3"];
	const day5 = byDay["2026-11-05"]?.["companyseek/glm-5.3"];
	if (!day4 || day4.calls !== 1 || day4.input !== 100 || day4.total !== 150) throw new Error("11-04 bucket wrong: " + JSON.stringify(day4));
	if (!day5 || day5.calls !== 2 || day5.input !== 14 || day5.total !== 20) throw new Error("11-05 bucket wrong: " + JSON.stringify(day5));
	console.log("tokensByDay: 11-04", JSON.stringify(day4), "| 11-05", JSON.stringify(day5));

	// Time collapse: day / week / month
	const I = plugin._internals;
	const dayRows = I.collapseTimeBuckets(byDay, "day");
	const weekRows = I.collapseTimeBuckets(byDay, "week");
	const monthRows = I.collapseTimeBuckets(byDay, "month");
	if (dayRows.length !== 2 || dayRows[0].key !== "2026-11-05" || dayRows[0].sums.total !== 20) throw new Error("day collapse wrong: " + JSON.stringify(dayRows));
	if (weekRows.length !== 1 || weekRows[0].sums.calls !== 3 || weekRows[0].sums.total !== 170) throw new Error("week collapse wrong: " + JSON.stringify(weekRows));
	if (!/^\d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2}$/.test(weekRows[0].label)) throw new Error("week label wrong: " + weekRows[0].label);
	if (monthRows.length !== 1 || monthRows[0].key !== "2026-11" || monthRows[0].sums.total !== 170) throw new Error("month collapse wrong: " + JSON.stringify(monthRows));
	// Week keys must land on Mondays
	for (const key of ["2026-11-04", "2026-11-05", "2026-01-01", "2026-06-30"]) {
		const [y, m, d] = I.weekKeyOf(key).split("-").map(Number);
		if (new Date(y, m - 1, d).getDay() !== 1) throw new Error(`weekKeyOf(${key}) not a Monday: ${I.weekKeyOf(key)}`);
	}
	console.log("time buckets: day", dayRows.length, "| week", JSON.stringify(weekRows[0].label), "| month", monthRows[0].key);

	// Files: one day, two paths, write+edit counters
	const dayKey = Object.keys(agg.files)[0];
	if (Object.keys(agg.files).length !== 1) throw new Error("file day buckets wrong: " + JSON.stringify(Object.keys(agg.files)));
	const a = agg.files[dayKey]["C:\\test\\a.md"];
	const sub = agg.files[dayKey]["C:\\test\\sub.txt"];
	if (!a || a.writes !== 1 || a.edits !== 1) throw new Error("a.md aggregation wrong: " + JSON.stringify(a));
	if (!sub || sub.writes !== 1) throw new Error("sub.txt aggregation wrong: " + JSON.stringify(sub));
	console.log("files:", JSON.stringify(agg.files[dayKey]));

	// Checkpoints + cache roundtrip
	if (agg.sessions.s1.maxSeq !== 7 || agg.sessions.sub1.maxSeq !== 3) throw new Error("checkpoints wrong: " + JSON.stringify(agg.sessions));
	const cached = JSON.parse(storage.get("dsh-usage-detail:v1"));
	if (cached.version !== 2 || cached.dailyMessages["2026-11-05"] !== 1) throw new Error("cache not persisted correctly");

	// Heatmap grid geometry: 53 columns, each ≤7 cells
	const grid = plugin._internals.buildHeatmapColumns({ "2026-11-05": 1 });
	if (grid.columns.length !== 53) throw new Error("grid columns: " + grid.columns.length);
	for (const column of grid.columns) if (column.length !== 7) throw new Error("column size");
	console.log("grid: 53x7 OK");

	console.log("SMOKE OK");
})().catch((error) => { console.error("SMOKE FAILED:", error); process.exit(1); });
