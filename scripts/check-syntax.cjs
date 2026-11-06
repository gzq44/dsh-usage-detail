const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "lib", "client.js"), "utf8");
let depth = 0;
let state = "code";
let templateDepths = [];
const lineDepths = [];
for (let i = 0; i < src.length; i += 1) {
	const ch = src[i];
	const next = src[i + 1];
	if (state === "line-comment") { if (ch === "\n") { state = "code"; lineDepths.push(depth); } continue; }
	if (state === "block-comment") { if (ch === "*" && next === "/") { state = "code"; i += 1; } if (ch === "\n") lineDepths.push(depth); continue; }
	if (state === "string") {
		if (ch === "\\") { i += 1; continue; }
		if (ch === '"' || ch === "'") state = "code";
		if (ch === "\n") lineDepths.push(depth);
		continue;
	}
	if (state === "template") {
		if (ch === "\\") { i += 1; continue; }
		if (ch === "`") state = templateDepths.pop() === "code" ? "code" : "template";
		if (ch === "\n") lineDepths.push(depth);
		continue;
	}
	if (ch === "/" && next === "/") { state = "line-comment"; i += 1; continue; }
	if (ch === "/" && next === "*") { state = "block-comment"; i += 1; continue; }
	if (ch === '"' || ch === "'") { state = "string"; continue; }
	if (ch === "`") { templateDepths.push("code"); state = "template"; continue; }
	if (ch === "(" || ch === "{" || ch === "[") depth += 1;
	if (ch === ")" || ch === "}" || ch === "]") depth -= 1;
	if (ch === "\n") lineDepths.push(depth);
}
const from = Number(process.argv[2] || 600);
const to = Number(process.argv[3] || 1040);
for (let i = from - 1; i < Math.min(to, lineDepths.length); i += 1) {
	console.log(`${i + 1}\t${lineDepths[i]}\t${src.split("\n")[i].slice(0, 80)}`);
}

