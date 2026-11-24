window.__ModuleLoader__.load({
	id: "dsh-deepblue-hud",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		//#region dbh-bundle-body

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
// src/client/activity.ts
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function pickString(record, keys) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim() !== "") return value.trim();
	}
}
function pickNumber(record, keys) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
	}
}
/** Map an arbitrary status-ish field onto the three dot colours. */
function toStatus(record) {
	const raw = record.status ?? record.outcome ?? record.state ?? record.result;
	const lowered = (typeof raw === "string" ? raw : isRecord$2(raw) ? String(raw.kind ?? raw.type ?? "") : "").toLowerCase();
	if (record.error !== void 0 || record.errorCode !== void 0) return "error";
	if (lowered.includes("error") || lowered.includes("fail") || lowered.includes("abort")) return "error";
	if (lowered.includes("retry") || lowered.includes("warn") || lowered.includes("cancel")) return "warn";
	if (lowered === "") {
		if ((record.ok ?? record.success) === false) return "error";
	}
	return "ok";
}
function formatMs(ms) {
	if (ms === void 0) return void 0;
	if (ms < 1e3) return `${Math.round(ms)}ms`;
	if (ms < 6e4) return `${(ms / 1e3).toFixed(1)}s`;
	return `${Math.floor(ms / 6e4)}m${Math.round(ms % 6e4 / 1e3)}s`;
}
const LABEL_KEYS = [
	"label",
	"title",
	"name",
	"toolName",
	"summary",
	"kind",
	"type"
];
const ID_KEYS = [
	"id",
	"seq",
	"callId",
	"toolCallId"
];
const META_KEYS = [
	"durationMs",
	"elapsedMs",
	"ms",
	"duration"
];
const TIME_KEYS = [
	"startedAt",
	"startTime",
	"start",
	"time"
];
const END_KEYS = [
	"endedAt",
	"endTime",
	"end",
	"completedAt"
];
function toLine(record, index, indent) {
	const text = pickString(record, LABEL_KEYS);
	if (text === void 0) return null;
	const id = pickString(record, ID_KEYS) ?? String(pickNumber(record, ID_KEYS) ?? index);
	const duration = pickNumber(record, META_KEYS);
	const started = pickNumber(record, TIME_KEYS);
	const ended = pickNumber(record, END_KEYS);
	const derived = duration ?? (started !== void 0 && ended !== void 0 ? ended - started : void 0);
	const retry = pickNumber(record, ["retry", "attempt"]);
	const meta = derived !== void 0 ? formatMs(derived) : retry !== void 0 && retry > 0 ? `retry ${retry}` : void 0;
	return {
		id: `${index}:${id}`,
		kind: "tool",
		text,
		status: toStatus(record),
		...meta === void 0 ? {} : { meta },
		...indent === 0 ? {} : { indent }
	};
}
/** Read a list field out of an unknown inspection object. */
function arrayField(inspection, keys) {
	if (!isRecord$2(inspection)) return [];
	for (const key of keys) {
		const value = inspection[key];
		if (Array.isArray(value)) return value.filter(isRecord$2);
	}
	return [];
}
/**
* Fold the trajectory inspection onto the activity stream.
*
* Written defensively: the inspection is a client-internal shape that differs
* between releases, so every field is read by candidate name and anything
* unrecognisable is skipped rather than rendered as noise.
*
* @param inspection - whatever `useTrajectory((snapshot) => snapshot)` returned.
* @param running - whether the agent is currently working.
* @param limit - how many trailing lines to keep.
* @returns the stream, oldest first.
*/
function mapActivity(inspection, running, limit = 9) {
	const lines = [];
	if (isRecord$2(inspection)) {
		const partial = inspection.partial;
		const thought = pickString(isRecord$2(partial) ? partial : inspection, [
			"reasoning",
			"reasoningText",
			"thought",
			"thinking"
		]);
		if (thought !== void 0) lines.push({
			id: "think",
			kind: "think",
			text: thought.slice(-320),
			status: "ok"
		});
	}
	const runningCalls = arrayField(inspection, ["runningCalls", "activeCalls"]);
	for (const [index, call] of runningCalls.entries()) {
		const line = toLine(call, index, 0);
		if (line !== null) lines.push({
			...line,
			id: `run:${line.id}`,
			status: running ? "warn" : line.status
		});
	}
	const nodes = arrayField(inspection, [
		"eventNodes",
		"nodes",
		"events"
	]);
	const mapped = [];
	for (const [index, node] of nodes.entries()) {
		const line = toLine(node, index, 0);
		if (line !== null) mapped.push(line);
	}
	lines.push(...mapped.slice(-limit));
	return lines.slice(-limit);
}
// src/client/live.ts
/**
* One published snapshot plus the listeners that watch it.
*
* The bridge component (mounted in a session-scoped slot) is the only writer; the
* frame-wide panel reads through `useSyncExternalStore`, so both stay in step
* without the panel subscribing to the session itself.
*/
/** Shape with no session attached: zeroed, with every unavailable block hidden. */
const EMPTY_SNAPSHOT = {
	mode: "idle",
	session: {
		tokensIn: 0,
		tokensOut: 0,
		speed: 0,
		contextUsed: null,
		contextMax: null,
		cost: null
	},
	system: {
		cpuPercent: null,
		memory: null,
		diskPercent: null,
		network: null
	},
	activity: [],
	history: [],
	running: false,
	pending: {
		system: true,
		activity: true
	}
};
let current = EMPTY_SNAPSHOT;
const listeners = /* @__PURE__ */ new Set();
/** Current snapshot; the same reference until the next publish. */
function getLiveSnapshot() {
	return current;
}
/**
* Subscribe to publishes.
*
* @param listener - called after every publish.
* @returns the unsubscribe function.
*/
function subscribeLive(listener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
/**
* Replace the snapshot.
*
* @param next - the new snapshot.
*/
function publishLive(next) {
	if (next === current) return;
	current = next;
	for (const listener of listeners) listener();
}
/** Drop back to the empty snapshot, e.g. when the bridge unmounts. */
function resetLive() {
	publishLive(EMPTY_SNAPSHOT);
}
// src/client/pricing.ts
/**
* Rates by model id. Example (replace with your own plan's numbers):
*
* ```ts
* 'deepseek-chat': {
*   inputPerMillion: 2, cacheReadPerMillion: 0.5, cacheWritePerMillion: 2, outputPerMillion: 8,
* },
* ```
*/
const PRICING = {};
/**
* Estimate spend in CNY, or `null` when no rate row matches.
*
* @param totals - cumulative token counts for the session.
* @param model - model id from the session's model selection, when known.
*/
function estimateCost(totals, model) {
	if (model === void 0) return null;
	const row = PRICING[model];
	if (row === void 0) return null;
	return (totals.uncachedInputTokens * row.inputPerMillion + totals.cacheReadTokens * row.cacheReadPerMillion + totals.cacheWriteTokens * row.cacheWritePerMillion + totals.outputTokens * row.outputPerMillion) / 1e6;
}
// src/client/liveModel.ts
function count(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function optionalNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
/**
* Project the raw session projections onto the HUD snapshot.
*
* Pure on purpose: the mapping is the part worth testing, and keeping it out of
* the component means the smoke test can assert it without a renderer.
*
* @param input - projection views plus the smoothed rate.
* @returns the snapshot published to the store.
*/
function buildLiveSnapshot(input) {
	const usage = input.usage ?? {};
	const pressure = input.pressure ?? {};
	const uncached = count(usage.uncachedInputTokens);
	const cacheRead = count(usage.cacheReadTokens);
	const cacheWrite = count(usage.cacheWriteTokens);
	const contextUsed = optionalNumber(pressure.projectedTokens) ?? optionalNumber(pressure.pressureTokens);
	const contextMax = optionalNumber(pressure.contextWindow);
	return {
		mode: "live",
		session: {
			tokensIn: uncached + cacheRead + cacheWrite,
			tokensOut: count(usage.outputTokens),
			speed: Math.max(0, Math.round(input.speed * 10) / 10),
			contextUsed,
			contextMax,
			cost: estimateCost({
				uncachedInputTokens: uncached,
				outputTokens: count(usage.outputTokens),
				cacheReadTokens: cacheRead,
				cacheWriteTokens: cacheWrite
			}, input.model)
		},
		system: {
			cpuPercent: null,
			memory: null,
			diskPercent: null,
			network: null
		},
		activity: [],
		history: [],
		running: false,
		pending: {
			system: true,
			activity: true
		}
	};
}
// src/client/Bridge.tsx
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Session collector: renders nothing, publishes everything.
*
* Mounted into a session-scoped slot because that is where the projection and
* trajectory hooks exist; the frame-wide `shell.overlay` panel cannot reach them
* from `root` scope. The component writes into the module-level live store, and
* the panel reads from there through `useSyncExternalStore`.
*/
function SessionDock(props) {
	const usage = props.useProjection?.("tokenUsage") ?? void 0;
	const pressure = props.useProjection?.("contextPressure") ?? void 0;
	const inspection = props.useTrajectory?.((snapshot) => snapshot);
	const speed = (0, react.useRef)({
		lastOutput: 0,
		lastAt: 0,
		ema: 0
	});
	const diagnosed = (0, react.useRef)(false);
	const history = (0, react.useRef)([]);
	const tokensOut = typeof usage?.outputTokens === "number" ? usage.outputTokens : 0;
	const now = Date.now();
	if (tokensOut > speed.current.lastOutput) {
		const elapsed = speed.current.lastAt === 0 ? 0 : (now - speed.current.lastAt) / 1e3;
		const instant = elapsed > 0 ? (tokensOut - speed.current.lastOutput) / elapsed : 0;
		if (instant > 0) speed.current.ema = speed.current.ema * .55 + instant * .45;
		speed.current.lastOutput = tokensOut;
		speed.current.lastAt = now;
	}
	const runningCalls = isRecord$1(inspection) && Array.isArray(inspection.runningCalls) ? inspection.runningCalls.length : 0;
	const tokensFlowing = speed.current.lastAt !== 0 && Date.now() - speed.current.lastAt < 3e3;
	const running = runningCalls > 0 || tokensFlowing;
	const activity = mapActivity(inspection, running, 80);
	if (activity.length === 0 && isRecord$1(inspection) && !diagnosed.current) {
		diagnosed.current = true;
		console.debug("[deepblue-hud] trajectory inspection not mapped; keys:", Object.keys(inspection), inspection);
	}
	const projectionKey = [
		usage?.uncachedInputTokens ?? "",
		usage?.outputTokens ?? "",
		usage?.cacheReadTokens ?? "",
		usage?.cacheWriteTokens ?? "",
		pressure?.contextWindow ?? "",
		pressure?.projectedTokens ?? "",
		pressure?.pressureTokens ?? ""
	].join(":");
	const activityKey = activity.map((line) => `${line.id}|${line.text}|${line.status}`).join("~") + (running ? "!" : "");
	(0, react.useEffect)(() => {
		const publish = () => {
			const state = speed.current;
			if (state.lastAt !== 0 && Date.now() - state.lastAt > 2500) state.ema = 0;
			const base = buildLiveSnapshot({
				usage,
				pressure,
				speed: state.ema
			});
			history.current = [...history.current, {
				t: Date.now(),
				tokensIn: base.session.tokensIn,
				tokensOut: base.session.tokensOut,
				contextUsed: base.session.contextUsed,
				contextMax: base.session.contextMax
			}].slice(-180);
			publishLive({
				...base,
				activity,
				running,
				history: history.current
			});
		};
		publish();
		const timer = globalThis.setInterval(publish, 1e3);
		return () => {
			globalThis.clearInterval(timer);
			resetLive();
		};
	}, [projectionKey, activityKey]);
	return null;
}
// src/client/markdown.tsx
const FENCE = /^```\s*([\w-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
/**
* Split source text into block-level nodes.
*
* Fences are tracked first so anything inside them stays verbatim, and an
* unterminated fence (a stream that is still arriving) is treated as code to the
* end of the input rather than swallowing the rest as paragraphs.
*
* @param source - raw Markdown.
* @returns blocks in document order.
*/
function parseBlocks(source) {
	const lines = source.replace(/\r\n?/g, "\n").split("\n");
	const blocks = [];
	let buffer = [];
	const flushParagraph = () => {
		if (buffer.length === 0) return;
		const text = buffer.join("\n").trim();
		if (text !== "") blocks.push({
			kind: "paragraph",
			text
		});
		buffer = [];
	};
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const fence = FENCE.exec(line);
		if (fence !== null) {
			flushParagraph();
			const lang = fence[1] ?? "";
			const code = [];
			let closed = false;
			for (index += 1; index < lines.length; index += 1) {
				const next = lines[index] ?? "";
				if (FENCE.test(next)) {
					closed = true;
					break;
				}
				code.push(next);
			}
			blocks.push({
				kind: "code",
				lang,
				text: code.join("\n")
			});
			if (!closed) break;
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading !== null) {
			flushParagraph();
			blocks.push({
				kind: "heading",
				level: (heading[1] ?? "#").length,
				text: heading[2] ?? ""
			});
			continue;
		}
		if (RULE.test(line)) {
			flushParagraph();
			blocks.push({ kind: "rule" });
			continue;
		}
		const quote = QUOTE.exec(line);
		if (quote !== null) {
			flushParagraph();
			const quoted = [quote[1] ?? ""];
			while (index + 1 < lines.length) {
				const next = QUOTE.exec(lines[index + 1] ?? "");
				if (next === null) break;
				quoted.push(next[1] ?? "");
				index += 1;
			}
			blocks.push({
				kind: "quote",
				text: quoted.join("\n")
			});
			continue;
		}
		const unordered = UL.exec(line);
		const ordered = OL.exec(line);
		if (unordered !== null || ordered !== null) {
			flushParagraph();
			const isOrdered = ordered !== null;
			const items = [];
			const pattern = isOrdered ? OL : UL;
			let cursor = index;
			for (; cursor < lines.length; cursor += 1) {
				const item = pattern.exec(lines[cursor] ?? "");
				if (item === null) break;
				items.push(item[1] ?? "");
			}
			index = cursor - 1;
			blocks.push({
				kind: "list",
				ordered: isOrdered,
				items
			});
			continue;
		}
		if (line.trim() === "") {
			flushParagraph();
			continue;
		}
		buffer.push(line);
	}
	flushParagraph();
	return blocks;
}
/**
* Inline patterns, **unanchored** and scanned for the earliest match.
*
* Anchoring them (`/^…/`) was the bug that left stray `**` in the transcript:
* a line like `先说明一下，然后用 **grep** 定位` has no match at index 0, so the
* whole line was emitted as literal text with its asterisks intact. Array order
* breaks ties at the same index, so code wins over emphasis and `**bold**` wins
* over `*em*`.
*/
const INLINE = [
	{
		pattern: /`([^`]+)`/,
		render: (m, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
			className: "dbh-md-code",
			children: m[1]
		}, key)
	},
	{
		pattern: /\*\*([^*]+)\*\*/,
		render: (m, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: renderInline(m[1] ?? "", key) }, key)
	},
	{
		pattern: /__([^_]+)__/,
		render: (m, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: renderInline(m[1] ?? "", key) }, key)
	},
	{
		pattern: /~~([^~]+)~~/,
		render: (m, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("del", { children: renderInline(m[1] ?? "", key) }, key)
	},
	{
		pattern: /\[([^\]]+)\]\(([^)\s]+)\)/,
		render: (m, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
			className: "dbh-md-a",
			href: m[2],
			target: "_blank",
			rel: "noreferrer noopener",
			children: renderInline(m[1] ?? "", key)
		}, key)
	},
	{
		pattern: /<(https?:\/\/[^>\s]+)>/,
		render: (m, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
			className: "dbh-md-a",
			href: m[1],
			target: "_blank",
			rel: "noreferrer noopener",
			children: m[1]
		}, key)
	},
	{
		pattern: /\*([^\s*][^*]*?)\*/,
		render: (m, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: renderInline(m[1] ?? "", key) }, key)
	},
	{
		pattern: /(?<![A-Za-z0-9])_([^\s_][^_]*?)_(?![A-Za-z0-9])/,
		render: (m, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: renderInline(m[1] ?? "", key) }, key)
	},
	{
		pattern: /\\([\\`*_{}[\]()#+\-.!])/,
		render: (m, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: m[1] }, key)
	}
];
/**
* Render one line of inline Markdown.
*
* Recursive so emphasis can contain code and links. Text between matches is
* emitted as plain strings, which is what makes the output injection-safe by
* construction.
*
* @param text - inline source.
* @param prefix - key prefix, so nested nodes stay unique.
* @returns React nodes.
*/
function renderInline(text, prefix = "i") {
	const nodes = [];
	let rest = text;
	let index = 0;
	while (rest !== "") {
		let best = null;
		for (const entry of INLINE) {
			const found = entry.pattern.exec(rest);
			if (found === null || found[0] === "") continue;
			if (best === null || found.index < best.at) best = {
				at: found.index,
				found,
				entry
			};
		}
		if (best === null) {
			nodes.push(rest);
			break;
		}
		if (best.at > 0) nodes.push(rest.slice(0, best.at));
		nodes.push(best.entry.render(best.found, `${prefix}-${index}`));
		rest = rest.slice(best.at + best.found[0].length);
		index += 1;
	}
	return nodes;
}
function renderBlock$1(block, index) {
	switch (block.kind) {
		case "heading": {
			const Tag = `h${Math.min(block.level, 6)}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tag, {
				className: "dbh-md-h",
				children: renderInline(block.text, `h${index}`)
			}, index);
		}
		case "paragraph": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "dbh-md-p",
			children: renderInline(block.text, `p${index}`)
		}, index);
		case "code": return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("pre", {
			className: "dbh-md-pre",
			children: [block.lang === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dbh-md-lang",
				children: block.lang
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: block.text })]
		}, index);
		case "quote": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("blockquote", {
			className: "dbh-md-quote",
			children: renderInline(block.text, `q${index}`)
		}, index);
		case "list": {
			const Tag = block.ordered ? "ol" : "ul";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tag, {
				className: "dbh-md-list",
				children: block.items.map((item, itemIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: renderInline(item, `l${index}-${itemIndex}`) }, itemIndex))
			}, index);
		}
		case "rule": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("hr", { className: "dbh-md-rule" }, index);
		default: return null;
	}
}
/**
* Render assistant body text as Markdown.
*
* @param props.text - raw Markdown source.
* @returns the rendered blocks.
*/
function Markdown(props) {
	const blocks = parseBlocks(props.text);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dbh-md",
		children: blocks.map(renderBlock$1)
	});
}
// src/client/Typing.tsx
/**
* Typing speed: one tick every 26 ms, revealing a share of what is left so short
* lines do not crawl and long ones do not stall.
*/
const TICK_MS = 26;
/**
* Reveal `target` progressively.
*
* The revealed count is monotonic for a given line: when the target grows (a
* streamed reasoning delta, a longer command string) typing simply continues from
* where it was. A new line gets a new React key, which resets the count.
*
* @param target - full text.
* @param enabled - `false` renders the text at once (reduced motion, history).
* @returns the visible prefix.
*/
function useTyped(target, enabled) {
	const [revealed, setRevealed] = (0, react.useState)(enabled ? 0 : target.length);
	const timer = (0, react.useRef)(void 0);
	(0, react.useEffect)(() => {
		if (!enabled) {
			setRevealed(target.length);
			return;
		}
		if (revealed >= target.length) return;
		timer.current = globalThis.setTimeout(() => {
			setRevealed((current) => Math.min(target.length, current + Math.max(1, Math.ceil((target.length - current) / 10))));
		}, TICK_MS);
		return () => {
			if (timer.current !== void 0) globalThis.clearTimeout(timer.current);
		};
	}, [
		enabled,
		revealed,
		target.length
	]);
	return target.slice(0, Math.min(revealed, target.length));
}
/**
* One line of the activity stream, typed out.
*
* This is the one place the plugin deliberately mutates text content instead of
* animating `opacity`/`transform`: a typewriter *is* text reflow. It stays bounded
* — one line, fixed line height, `contain: layout`, and reduced motion renders the
* full text immediately.
*/
function TypingLine(props) {
	const text = useTyped(props.line.text, props.typing);
	const pending = text.length < props.line.text.length;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dbh-node",
		"data-status": props.line.status,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dbh-dot",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dbh-node-body",
				style: { paddingLeft: `${(props.line.indent ?? 0) * 10}px` },
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dbh-node-label",
					title: props.line.text,
					children: [text, pending || props.caret ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dbh-caret",
						"aria-hidden": "true"
					}) : null]
				})
			}),
			props.line.meta === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dbh-node-meta",
				children: props.line.meta
			})
		]
	});
}
// src/client/StepView.tsx
/** How deep the props scan walks before giving up. */
const MAX_DEPTH = 7;
const BLOCK_KINDS = /* @__PURE__ */ new Set([
	"reasoning",
	"text",
	"tool-call",
	"image",
	"other"
]);
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
function isBlock(value) {
	if (!isRecord(value)) return false;
	const kind = value.kind;
	return typeof kind === "string" && BLOCK_KINDS.has(kind);
}
/**
* Find the step's blocks in whatever the renderer receives.
*
* The props shape is a client-internal detail, so instead of hard-coding a path
* this walks the tree and takes the first array (or single object) whose members
* look like assistant blocks. A wrong guess therefore renders the fallback note
* rather than throwing inside the transcript.
*/
function findBlocks(input, depth = 0) {
	if (depth > MAX_DEPTH || !isRecord(input)) return [];
	for (const value of Object.values(input)) {
		if (Array.isArray(value)) {
			const blocks = value.filter(isBlock);
			if (blocks.length > 0) return blocks;
		}
		if (isBlock(value)) return [value];
		if (isRecord(value)) {
			const nested = findBlocks(value, depth + 1);
			if (nested.length > 0) return nested;
		}
	}
	return [];
}
/** Text-ish payload of a record, for tool output. */
function pickText(record) {
	for (const key of [
		"output",
		"result",
		"text",
		"content",
		"preview",
		"summary"
	]) {
		const value = record[key];
		if (typeof value === "string" && value.trim() !== "") return value;
		if (Array.isArray(value)) {
			const joined = value.map((item) => isRecord(item) && typeof item.text === "string" ? item.text : "").filter((text) => text !== "").join("\n");
			if (joined !== "") return joined;
		}
	}
	return null;
}
/**
* Look for the output of one tool call anywhere in the node.
*
* The inspected call's result may live beside the block, in a sibling map, or not
* at all — so this returns `null` more often than not, and the row falls back to
* the host's own inspector instead of inventing output.
*
* @param input - node/props tree.
* @param callId - id of the call to find.
* @returns output text, or `null`.
*/
function findToolResult(input, callId, depth = 0) {
	if (depth > MAX_DEPTH || callId === "" || !isRecord(input)) return null;
	const ownId = input.callId ?? input.toolCallId ?? input.id;
	if (ownId !== void 0 && String(ownId) === callId) {
		const text = pickText(input);
		if (text !== null) return text;
	}
	for (const value of Object.values(input)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				const found = findToolResult(item, callId, depth + 1);
				if (found !== null) return found;
			}
			continue;
		}
		if (!isRecord(value)) continue;
		const id = value.callId ?? value.toolCallId ?? value.id;
		if (id !== void 0 && String(id) === callId) {
			const text = pickText(value);
			if (text !== null) return text;
		}
		const nested = findToolResult(value, callId, depth + 1);
		if (nested !== null) return nested;
	}
	return null;
}
/** The host's "inspect this call" callback, when the node provides one. */
function findInspect(props) {
	if (!isRecord(props)) return void 0;
	const direct = props.inspectCall;
	if (typeof direct === "function") return direct;
	for (const value of Object.values(props)) if (isRecord(value) && typeof value.inspectCall === "function") return value.inspectCall;
}
/** Pretty-print raw arguments when they are JSON, else leave them alone. */
function prettyArgs(raw) {
	if (raw === void 0) return "";
	try {
		const parsed = JSON.parse(raw);
		return JSON.stringify(parsed, null, 2);
	} catch {
		return raw;
	}
}
/** First line of a collapsed thought, so a folded block still says something. */
function previewOf(text) {
	const first = text.replace(/\s+/g, " ").trim();
	return first.length > 64 ? `${first.slice(0, 63)}…` : first;
}
/**
* Reasoning text: typed out, collapsible.
*
* Collapsed by default for anything that is not the step's newest block — a long
* thought is the thing people scroll past, not the thing they read twice. The
* newest block starts open so the typing is visible while it streams, and folds
* itself once the answer body follows it.
*/
function Reasoning(props) {
	const [open, setOpen] = (0, react.useState)(props.defaultOpen);
	const prefersReduced = typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const shown = useTyped(open ? props.text : "", !prefersReduced);
	const characters = props.text.replace(/\s/g, "").length;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dbh-think",
		"data-open": open ? "true" : "false",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "dbh-think-head",
			"aria-expanded": open,
			onClick: () => setOpen((value) => !value),
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dbh-think-chev",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dbh-think-verb",
					children: "思考"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dbh-think-meta",
					children: [characters, " 字"]
				})
			]
		}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dbh-think-body",
			children: [shown, shown.length < props.text.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dbh-caret",
				"aria-hidden": "true"
			}) : null]
		}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dbh-think-preview",
			children: previewOf(props.text)
		})]
	});
}
/** Arguments summary for a collapsed tool row. */
function argsSummary(raw) {
	if (raw === void 0) return "";
	const flat = raw.replace(/\s+/g, " ").trim();
	return flat.length > 72 ? `${flat.slice(0, 71)}…` : flat;
}
/**
* One tool call: a compact row that expands to its arguments and output.
*
* The output is shown only when the node actually carries it; otherwise the row
* offers the host's inspector (`inspectCall`), which is the sanctioned way to see
* a call's full input and output without re-implementing the tool view.
*/
function ToolRow(props) {
	const [open, setOpen] = (0, react.useState)(false);
	const callId = props.block.callId ?? "";
	const args = prettyArgs(props.block.argsRaw);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dbh-step-tool",
		"data-open": open ? "true" : "false",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "dbh-step-tool-head",
			"aria-expanded": open,
			onClick: () => setOpen((value) => !value),
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dbh-step-dot",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dbh-step-tool-name",
					children: props.block.name ?? "tool"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dbh-step-tool-args",
					children: argsSummary(props.block.argsRaw)
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dbh-step-tool-chev",
					"aria-hidden": "true"
				})
			]
		}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dbh-step-tool-body",
			children: [
				args === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					className: "dbh-step-tool-pre",
					children: args
				}),
				props.result === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					className: "dbh-step-tool-pre dbh-step-tool-out",
					children: props.result
				}),
				props.result === null && props.inspect !== void 0 && callId !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dbh-step-tool-link",
					onClick: () => props.inspect?.(callId),
					children: "在调用详情中查看输出 →"
				}) : null,
				props.result === null && props.inspect === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dbh-step-tool-note",
					children: "此步未携带输出，宿主也未提供调用详情入口"
				}) : null
			]
		}) : null]
	});
}
function renderBlock(block, index, lastIndex, props) {
	if (block.kind === "reasoning") return block.text === void 0 || block.text === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Reasoning, {
		text: block.text,
		defaultOpen: index === lastIndex
	}, index);
	if (block.kind === "text") return block.text === void 0 || block.text === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Markdown, { text: block.text }, index);
	if (block.kind === "tool-call") {
		const callId = block.callId ?? "";
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolRow, {
			block,
			result: callId === "" ? null : findToolResult(props, callId),
			inspect: findInspect(props)
		}, index);
	}
	return null;
}
/**
* Replacement renderer for the shipped `assistant-step` node.
*
* Every failure mode lands on the visible note, never on a silent blank: a step
* that the plugin cannot read must say so, or the transcript would look like the
* message vanished.
*/
function AssistantStepView(props) {
	try {
		const blocks = findBlocks(props);
		if (blocks.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dbh-step-note",
			children: "此步由 Cockpit 接管，但结构未识别（详见控制台）"
		});
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dbh-step",
			children: blocks.map((block, index) => renderBlock(block, index, blocks.length - 1, props))
		});
	} catch {
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dbh-step-note",
			children: "Cockpit 接管渲染失败，已跳过此步"
		});
	}
}
// src/client/format.ts
/** Clamp `value` into `[min, max]`. */
function clamp(value, min, max) {
	return value < min ? min : value > max ? max : value;
}
/** Format an integer with thin thousands separators; compact above 10k. */
function formatTokens(value) {
	if (!Number.isFinite(value) || value < 0) return "—";
	if (value >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
	return Math.round(value).toLocaleString("en-US");
}
/** Format a plain percentage, no decimals. */
function formatPercent(percent) {
	if (!Number.isFinite(percent)) return "—";
	return `${Math.round(clamp(percent, 0, 100))}%`;
}
/** Bytes → `21.4 GB` style, one decimal. */
function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes < 0) return "—";
	const units = [
		"B",
		"KB",
		"MB",
		"GB",
		"TB"
	];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
/** Bytes per second → `1.9 MB/s`. */
function formatRate(bytesPerSecond) {
	if (!Number.isFinite(bytesPerSecond) || bytesPerSecond < 0) return "—";
	return `${formatBytes(bytesPerSecond)}/s`;
}
/** CNY amount, always four decimals as specified. */
function formatCost(cny) {
	if (!Number.isFinite(cny)) return "¥—";
	return `¥${cny.toFixed(4)}`;
}
/** Tokens per second, one decimal. */
function formatSpeed(tokensPerSecond) {
	if (!Number.isFinite(tokensPerSecond)) return "—";
	return tokensPerSecond.toFixed(1);
}
/**
* Map a ratio to a severity tone.
*
* @param ratio - current fraction of the ceiling, `0..1`.
* @param warn - first threshold; at or above it the value is yellow.
* @param danger - second threshold; at or above it the value is red.
*/
function severity(ratio, warn, danger) {
	if (!Number.isFinite(ratio)) return "accent";
	if (ratio >= danger) return "error";
	if (ratio >= warn) return "warn";
	return "success";
}
/** Fraction `used / total`, guarded against a zero total. */
function ratio(used, total) {
	if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0;
	return clamp(used / total, 0, 1);
}
// src/client/Gallery.tsx
/**
* Data-flow gallery: the cockpit expanded into one full-screen surface.
*
* Three panes over the rolling sample buffer the bridge publishes every second:
* token rhythm (stacked bars), context occupancy (area + curve with its two
* thresholds), and the thinking/execution stream (typed, full history).
*
* Charts are hand-rolled — a plugin may not import a chart library — and animate
* with `transform` / `opacity` only.
*/
/** Bars drawn in the rhythm pane. */
const BARS = 60;
function formatClock(t) {
	const d = new Date(t);
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
function toneOf(value) {
	if (value >= .9) return "error";
	if (value >= .7) return "warn";
	return "success";
}
/** Per-second token deltas, with a visible stub for quiet seconds. */
function RhythmPane(props) {
	const samples = props.snapshot.history.slice(-61);
	const deltas = samples.slice(1).map((sample, index) => {
		const previous = samples[index];
		return {
			t: sample.t,
			input: Math.max(0, sample.tokensIn - (previous?.tokensIn ?? 0)),
			output: Math.max(0, sample.tokensOut - (previous?.tokensOut ?? 0))
		};
	});
	const peak = Math.max(1, ...deltas.map((delta) => delta.input + delta.output));
	const total = deltas.reduce((sum, delta) => sum + delta.input + delta.output, 0);
	const busiest = deltas.reduce((max, delta) => Math.max(max, delta.input + delta.output), 0);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dbh-gal-pane",
		"aria-label": "token 节奏",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: "dbh-gal-pane-head",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "token 节奏" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dbh-gal-pane-note",
					children: [
						deltas.length,
						" 秒 · 共 ",
						total,
						" token"
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dbh-gal-stats",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: total }), "合计"] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: busiest }), "峰值/秒"] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: deltas.length === 0 ? 0 : Math.round(total / deltas.length) }), "均值/秒"] })
				]
			}),
			deltas.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dbh-hint",
				children: props.snapshot.mode === "idle" ? "等待会话" : "刚开始采样"
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dbh-gal-bars",
				children: deltas.map((delta) => {
					const value = delta.input + delta.output;
					const share = Math.max(value / peak, value > 0 ? .08 : .015);
					const split = value === 0 ? 0 : delta.input / value * 100;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dbh-gal-bar",
						"data-empty": value === 0 ? "true" : "false",
						title: `${formatClock(delta.t)} · 入 ${delta.input} / 出 ${delta.output}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dbh-gal-bar-fill",
							style: {
								transform: `scaleY(${share})`,
								["--dbh-split"]: `${split.toFixed(1)}%`
							}
						})
					}, delta.t);
				})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
				className: "dbh-gal-legend",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
						className: "dbh-gal-key",
						"data-kind": "in"
					}), "入"] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
						className: "dbh-gal-key",
						"data-kind": "out"
					}), "出"] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dbh-gal-legend-time",
						children: [
							"每秒采样 · 最近 ",
							BARS,
							" 秒"
						]
					})
				]
			})
		]
	});
}
/** Context occupancy: filled area, curve, thresholds, live point, stats. */
function ContextPane(props) {
	const points = props.snapshot.history.map((sample) => sample.contextUsed === null || sample.contextMax === null || sample.contextMax <= 0 ? null : ratio(sample.contextUsed, sample.contextMax)).filter((value) => value !== null);
	const current = points.at(-1) ?? 0;
	const peak = points.length === 0 ? 0 : Math.max(...points);
	const average = points.length === 0 ? 0 : points.reduce((sum, value) => sum + value, 0) / points.length;
	const last = props.snapshot.history.at(-1);
	const line = points.length < 2 ? "" : points.map((value, index) => `${index === 0 ? "M" : "L"} ${index / (points.length - 1) * 100} ${(1 - Math.min(value, 1)) * 100}`).join(" ");
	const area = line === "" ? "" : `${line} L 100 100 L 0 100 Z`;
	const contextLabel = last === void 0 || last.contextUsed === null ? "待接入" : `${formatTokens(last.contextUsed)} / ${formatTokens(last.contextMax ?? 0)}`;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dbh-gal-pane",
		"aria-label": "上下文占用",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
			className: "dbh-gal-pane-head",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "上下文占用" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dbh-gal-pane-note",
				children: contextLabel
			})]
		}), points.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dbh-hint",
			children: "上下文待接入"
		}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dbh-gal-stats",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: formatPercent(current * 100) }), "当前"] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: formatPercent(peak * 100) }), "峰值"] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: formatPercent(average * 100) }), "均值"] })
			]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dbh-gal-curve",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 100 100",
					preserveAspectRatio: "none",
					role: "img",
					"aria-label": "上下文占用曲线",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
							className: "dbh-gal-grid-line",
							x1: "0",
							y1: "25",
							x2: "100",
							y2: "25"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
							className: "dbh-gal-grid-line",
							x1: "0",
							y1: "50",
							x2: "100",
							y2: "50"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
							className: "dbh-gal-grid-line",
							x1: "0",
							y1: "75",
							x2: "100",
							y2: "75"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
							className: "dbh-gal-th",
							"data-tone": "warn",
							x1: "0",
							y1: "30",
							x2: "100",
							y2: "30"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
							className: "dbh-gal-th",
							"data-tone": "error",
							x1: "0",
							y1: "10",
							x2: "100",
							y2: "10"
						}),
						area === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							className: "dbh-gal-area",
							d: area
						}),
						line === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							className: "dbh-gal-line",
							d: line
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dbh-gal-point",
					"data-tone": toneOf(current),
					style: {
						left: "100%",
						top: `${(1 - Math.min(current, 1)) * 100}%`
					}
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dbh-gal-th-labels",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "90%" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "70%" })]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dbh-gal-chip",
					"data-tone": toneOf(current),
					children: formatPercent(current * 100)
				})
			]
		})] })]
	});
}
/** Thinking and execution stream, typed, full history, auto-scrolled. */
function StreamPane(props) {
	const list = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		const node = list.current;
		if (node !== null) node.scrollTop = node.scrollHeight;
	}, [props.snapshot.activity.length, props.snapshot.running]);
	const lines = props.snapshot.activity;
	const last = lines.length - 1;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dbh-gal-pane",
		"aria-label": "思考与执行",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
			className: "dbh-gal-pane-head",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "思考与执行" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dbh-gal-pane-note",
				children: [lines.length, " 条 · 最新在下"]
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dbh-gal-stream",
			ref: list,
			children: lines.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dbh-hint",
				children: props.snapshot.pending.activity ? "轨迹采集待接入" : "本轮暂无工具调用"
			}) : lines.map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TypingLine, {
				line,
				typing: index === last,
				caret: props.snapshot.running && index === last
			}, line.id))
		})]
	});
}
/** The modal itself. */
function Gallery(props) {
	const dialog = (0, react.useRef)(null);
	const close = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		close.current?.focus();
		const onKeyDown = (event) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				props.onClose();
				return;
			}
			if (event.key !== "Tab") return;
			const scope = dialog.current;
			if (scope === null) return;
			const focusable = scope.querySelectorAll("button, [href], [tabindex]:not([tabindex=\"-1\"])");
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (first === void 0 || last === void 0) return;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, [props.onClose]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dbh-gal-backdrop",
		onClick: props.onClose,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dbh-gal",
			role: "dialog",
			"aria-modal": "true",
			"aria-label": "数据流",
			ref: dialog,
			onClick: (event) => event.stopPropagation(),
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
				className: "dbh-gal-head",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dbh-mark",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dbh-gal-title",
						children: "数据流 · DATA FLOW"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dbh-gal-window",
						children: [props.snapshot.history.length, " 秒采样窗口"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dbh-gal-close",
						"aria-label": "关闭数据流",
						onClick: props.onClose,
						ref: close,
						children: "×"
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dbh-gal-grid",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RhythmPane, { snapshot: props.snapshot }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextPane, { snapshot: props.snapshot }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StreamPane, { snapshot: props.snapshot })
				]
			})]
		})
	});
}
// src/client/source.ts
/**
* The panel's single data seam.
*
* The bridge (`Bridge.tsx`) is the only writer; this hook just mirrors the live
* store into React. Until a session mounts the bridge, the store holds the idle
* snapshot — zeroed, with the unwired blocks marked pending in the view.
*/
function useHudSnapshot() {
	return (0, react.useSyncExternalStore)(subscribeLive, getLiveSnapshot, getLiveSnapshot);
}
// src/client/sky.tsx
const STAR_COUNT$1 = 46;
/** Deterministic PRNG, so the layer does not reshuffle on every mount. */
function mulberry32$1(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function buildStars$1() {
	const random = mulberry32$1(12648430);
	return Array.from({ length: STAR_COUNT$1 }, (_, index) => ({
		id: index,
		x: random() * 100,
		y: random() * 100,
		size: random() < .15 ? 2 : 1 + random() * .8,
		drift: 4 + Math.round(random() * 6),
		twinkle: 3.5 + random() * 6,
		delay: random() * 14,
		dxp: 6 + random() * 16,
		dyp: -(6 + random() * 20)
	}));
}
const STARS = buildStars$1();
function styleFor(star) {
	return {
		left: `${star.x.toFixed(2)}%`,
		top: `${star.y.toFixed(2)}%`,
		width: `${star.size.toFixed(2)}px`,
		height: `${star.size.toFixed(2)}px`,
		animationDuration: `${star.drift}s, ${star.twinkle}s`,
		animationDelay: `-${star.delay.toFixed(2)}s, -${(star.delay / 2).toFixed(2)}s`,
		"--dbh-dx": `${star.dxp.toFixed(1)}px`,
		"--dbh-dy": `${star.dyp.toFixed(1)}px`
	};
}
/** Frame-wide, non-interactive drifting star layer. */
function StarVeil() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dbh-sky",
		"aria-hidden": "true",
		children: STARS.map((star) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "dbh-star",
			style: styleFor(star)
		}, star.id))
	});
}
// src/client/panel.tsx
/** Survives remounts within the page session: no storage service is injected. */
const memory = { collapsed: false };
/** Stagger between section entrances, inside the requested 30–50ms band. */
const STAGGER_MS = 40;
/** Collapse duration; matches `--dbh-dur` so the two stay in step. */
const COLLAPSE_MS = 180;
function prefersReducedMotion() {
	return typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function Bar(props) {
	const clamped = Math.min(Math.max(props.value, 0), 1);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dbh-bar",
		role: "progressbar",
		"aria-label": props.label,
		"aria-valuenow": Math.round(clamped * 100),
		"aria-valuemin": 0,
		"aria-valuemax": 100,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dbh-fill",
			"data-tone": props.tone,
			style: { transform: `scaleX(${clamped})` }
		})
	});
}
function Row(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dbh-row",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "dbh-k",
			children: props.label
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "dbh-v",
			"data-tone": props.tone,
			children: props.children
		})]
	});
}
/** Muted single line for a block with no source yet. */
function Hint(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "dbh-hint",
		children: props.children
	});
}
function Section(props) {
	const style = { animationDelay: `${props.index * STAGGER_MS}ms` };
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dbh-sec dbh-rise",
		style,
		"aria-label": props.title,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dbh-sec-head",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.title }), props.note === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dbh-sec-note",
				children: props.note
			})]
		}), props.children]
	});
}
const CONTEXT_LABEL = {
	accent: "上下文",
	success: "充裕",
	warn: "偏紧",
	error: "将满"
};
function SessionSection(props) {
	const { session, mode } = props.snapshot;
	const hasContext = session.contextUsed !== null && session.contextMax !== null && session.contextMax > 0;
	const used = hasContext ? ratio(session.contextUsed, session.contextMax) : 0;
	const tone = severity(used, .7, .9);
	const left = hasContext ? Math.max(session.contextMax - session.contextUsed, 0) : 0;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Section, {
		title: "会话",
		note: "经济",
		index: props.index,
		children: [
			mode === "idle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Hint, { children: "等待会话" }) : null,
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Row, {
				label: "Tokens",
				children: [
					formatTokens(session.tokensIn),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dbh-u",
						children: "入"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dbh-u",
						children: "/"
					}),
					formatTokens(session.tokensOut),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dbh-u",
						children: "出"
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Row, {
				label: "速度",
				tone: "accent",
				children: [formatSpeed(session.speed), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dbh-u",
					children: "tok/s"
				})]
			}),
			session.cost === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
				label: "费用估算",
				children: formatCost(session.cost)
			}),
			hasContext ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dbh-row",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dbh-k",
						children: "上下文"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dbh-v",
						children: [
							formatTokens(session.contextUsed),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dbh-u",
								children: ["/ ", formatTokens(session.contextMax)]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dbh-u",
								children: "·"
							}),
							formatPercent(used * 100)
						]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Bar, {
					value: used,
					tone,
					label: `上下文占用 ${formatPercent(used * 100)}`
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dbh-row",
					style: { marginTop: 5 },
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dbh-chip",
						"data-tone": tone,
						children: CONTEXT_LABEL[tone]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "dbh-sec-note",
						children: ["剩余 ", formatTokens(left)]
					})]
				})
			] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Hint, { children: "上下文待接入" })
		]
	});
}
function NetworkValue(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: "dbh-net",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { children: "↑" }), formatRate(props.network.tx)] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { children: "↓" }), formatRate(props.network.rx)] })]
	});
}
function SystemSection(props) {
	const { system } = props;
	const cpu = system.cpuPercent;
	const mem = system.memory;
	const disk = system.diskPercent;
	const empty = cpu === null && mem === null && disk === null && system.network === null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Section, {
		title: "系统",
		note: "体征",
		index: props.index,
		children: [
			cpu === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
				label: "CPU",
				tone: severity(cpu / 100, .7, .85),
				children: formatPercent(cpu)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Bar, {
				value: cpu / 100,
				tone: severity(cpu / 100, .7, .85),
				label: `CPU 占用 ${formatPercent(cpu)}`
			})] }),
			mem === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Row, {
				label: "内存",
				tone: severity(mem.percent / 100, .75, .9),
				children: [formatPercent(mem.percent), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dbh-u",
					children: [
						formatBytes(mem.used),
						" / ",
						formatBytes(mem.total)
					]
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Bar, {
				value: mem.percent / 100,
				tone: severity(mem.percent / 100, .75, .9),
				label: `内存占用 ${formatPercent(mem.percent)}`
			})] }),
			disk === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
				label: "磁盘",
				tone: severity(disk / 100, .8, .92),
				children: formatPercent(disk)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Bar, {
				value: disk / 100,
				tone: severity(disk / 100, .8, .92),
				label: `磁盘占用 ${formatPercent(disk)}`
			})] }),
			system.network === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
				label: "网络",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NetworkValue, { network: system.network })
			}),
			empty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Hint, { children: props.pending ? "主机通道未接入" : "暂无数据" }) : null
		]
	});
}
function ActivitySection(props) {
	const failed = props.lines.filter((line) => line.status === "error").length;
	const note = props.lines.length === 0 ? "暂无调用" : failed > 0 ? `${props.lines.length} 条 · ${failed} 失败` : `${props.lines.length} 条`;
	const visible = props.lines.slice(-4);
	const lastIndex = visible.length - 1;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Section, {
		title: "轨迹",
		note,
		index: props.index,
		children: visible.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Hint, { children: props.pending ? "轨迹采集待接入" : "本轮暂无工具调用" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dbh-tl",
			children: visible.map((line, position) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TypingLine, {
				line,
				typing: position >= lastIndex - 1,
				caret: props.running && position === lastIndex
			}, line.id))
		})
	});
}
function Cockpit() {
	const snapshot = useHudSnapshot();
	const [expanded, setExpanded] = (0, react.useState)(() => !memory.collapsed);
	const [closing, setClosing] = (0, react.useState)(false);
	const [gallery, setGallery] = (0, react.useState)(false);
	const timer = (0, react.useRef)(void 0);
	const clearTimer = (0, react.useCallback)(() => {
		if (timer.current !== void 0) {
			globalThis.clearTimeout(timer.current);
			timer.current = void 0;
		}
	}, []);
	(0, react.useEffect)(() => clearTimer, [clearTimer]);
	const toggle = (0, react.useCallback)(() => {
		if (expanded) {
			memory.collapsed = true;
			if (prefersReducedMotion()) {
				setClosing(false);
				setExpanded(false);
				return;
			}
			setClosing(true);
			clearTimer();
			timer.current = globalThis.setTimeout(() => {
				timer.current = void 0;
				setClosing(false);
				setExpanded(false);
			}, COLLAPSE_MS);
			return;
		}
		clearTimer();
		memory.collapsed = false;
		setClosing(false);
		setExpanded(true);
	}, [clearTimer, expanded]);
	const { session } = snapshot;
	const contextPercent = session.contextUsed !== null && session.contextMax !== null && session.contextMax > 0 ? `${Math.round(ratio(session.contextUsed, session.contextMax) * 100)}%` : "—";
	const cpuPercent = snapshot.system.cpuPercent;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StarVeil, {}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "dbh-panel",
			"data-expanded": expanded ? "true" : "false",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dbh-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dbh-head",
					"aria-expanded": expanded,
					"aria-controls": "dbh-body",
					"aria-label": expanded ? "Collapse cockpit panel" : "Expand cockpit panel",
					onClick: toggle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dbh-mark",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dbh-title",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "Cockpit" }), expanded ? " · 深蓝" : null]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dbh-mini",
							"aria-hidden": "true",
							children: [
								"上下文 ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: contextPercent }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { children: "·" }),
								"CPU ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: cpuPercent === null ? "—" : `${Math.round(cpuPercent)}%` })
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dbh-chev",
							"aria-hidden": "true"
						})
					]
				}), expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dbh-body",
					id: "dbh-body",
					"data-closing": closing ? "true" : "false",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionSection, {
							snapshot,
							index: 0
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SystemSection, {
							system: snapshot.system,
							pending: snapshot.pending.system,
							index: 1
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActivitySection, {
							lines: snapshot.activity,
							pending: snapshot.pending.activity,
							running: snapshot.running,
							index: 2
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dbh-foot",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dbh-foot-btn",
								onClick: () => setGallery(true),
								children: "数据流 · 展开"
							})
						})
					]
				}) : null]
			})
		}),
		gallery ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Gallery, {
			snapshot,
			onClose: () => setGallery(false)
		}) : null
	] });
}
// src/client/styles.ts
/**
* Panel stylesheet, injected once through `ctx.effect` and tagged with
* `data-plugin-css` so unload removes it again.
*
* Rules followed here:
* - every color is a `--dsw-alias-*` / `--dsw-specific-*` token (shadows are
*   `color-mix` of the base token, never a literal black);
* - animation touches only `opacity` and `transform` — bars animate with
*   `scaleX`, collapse with `translateY`, and no layout property transitions;
* - `prefers-reduced-motion: reduce` removes every animation and transition.
*/
const PANEL_CSS = String.raw`
.dbh-panel {
  --dbh-dur: 180ms;
  --dbh-dur-enter: 320ms;
  --dbh-dur-slow: 460ms;
  --dbh-ease: cubic-bezier(.22,.61,.36,1);
  position: absolute;
  right: 16px;
  /* Clears the composer band: the composer seat spans the column bottom, and a
     corner dock would sit on top of it. Tunable via --dbh-dock-bottom. */
  bottom: var(--dbh-dock-bottom, 168px);
  z-index: 1;
  width: 296px;
  max-width: calc(100vw - 24px);
  pointer-events: auto;
  box-sizing: border-box;
  font-family: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: 12px;
  line-height: 1.45;
  color: var(--dsw-alias-label-primary);
  -webkit-font-smoothing: antialiased;
}

.dbh-panel *,
.dbh-panel *::before,
.dbh-panel *::after { box-sizing: border-box; }

.dbh-card {
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow:
    0 20px 48px -22px color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent),
    0 2px 10px -6px color-mix(in srgb, var(--dsw-alias-bg-base) 78%, transparent);
}

/* ── header ─────────────────────────────────────────────────────────── */
.dbh-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 9px 11px;
  border: 0;
  border-radius: 0;
  background: linear-gradient(180deg, var(--dsw-alias-bg-layer-2), var(--dsw-alias-bg-layer-1));
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  appearance: none;
}
.dbh-head:hover { background: linear-gradient(180deg, var(--dsw-alias-bg-layer-3), var(--dsw-alias-bg-layer-1)); }
.dbh-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }

.dbh-mark {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
  transform: rotate(45deg);
  animation: dbh-pulse 2.6s ease-in-out infinite;
}

.dbh-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .14em;
  text-transform: uppercase;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary);
}
.dbh-title em {
  font-style: normal;
  color: var(--dsw-alias-brand-primary);
}

.dbh-mini {
  display: flex;
  flex: none;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-caption);
  white-space: nowrap;
}
.dbh-mini b { font-weight: 600; color: var(--dsw-alias-label-secondary); }
.dbh-mini i { font-style: normal; color: var(--dsw-alias-border-l4); }
.dbh-panel[data-expanded="true"] .dbh-mini { display: none; }

/* muted line for a block whose source is not wired yet */
.dbh-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 0;
  font-size: 10.5px;
  color: var(--dsw-alias-label-caption);
}
.dbh-hint::before {
  content: "";
  flex: none;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}

.dbh-chev {
  flex: none;
  width: 9px;
  height: 9px;
  margin-bottom: 3px;
  border-right: 1.5px solid var(--dsw-alias-label-tertiary);
  border-bottom: 1.5px solid var(--dsw-alias-label-tertiary);
  transform: rotate(45deg);
  transition: transform var(--dbh-dur) var(--dbh-ease);
}
.dbh-panel[data-expanded="true"] .dbh-chev { transform: rotate(-135deg); }

/* ── body ───────────────────────────────────────────────────────────── */
.dbh-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: min(60vh, 520px);
  padding: 10px 11px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent), transparent 44px),
    var(--dsw-alias-bg-layer-1);
}
.dbh-body[data-closing="true"] {
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
  transition: opacity var(--dbh-dur) var(--dbh-ease), transform var(--dbh-dur) var(--dbh-ease);
}
.dbh-body::-webkit-scrollbar { width: 6px; }
.dbh-body::-webkit-scrollbar-thumb { border-radius: 3px; background: var(--dsw-alias-scrollbar-bg-l2); }
.dbh-body::-webkit-scrollbar-thumb:hover { background: var(--dsw-alias-scrollbar-hover-l2); }

/* ── section frame ──────────────────────────────────────────────────── */
.dbh-sec { display: flex; flex-direction: column; gap: 5px; }
.dbh-sec + .dbh-sec {
  padding-top: 10px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dbh-sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}
.dbh-sec-note {
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: .04em;
  text-transform: none;
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}

/* ── rows and values ────────────────────────────────────────────────── */
.dbh-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.dbh-k { flex: none; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.dbh-v {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
  text-align: right;
  white-space: nowrap;
}
.dbh-v[data-tone="accent"] { color: var(--dsw-alias-brand-primary); }
.dbh-v[data-tone="success"] { color: var(--dsw-alias-state-success-primary); }
.dbh-v[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); }
.dbh-v[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
.dbh-u {
  margin-left: 3px;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: .02em;
  color: var(--dsw-alias-label-caption);
}

/* ── bars ───────────────────────────────────────────────────────────── */
.dbh-bar {
  position: relative;
  height: 5px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-3);
}
.dbh-bar::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-border-l1) 80%, transparent);
}
.dbh-fill {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  transform-origin: 0 50%;
  background: var(--dsw-alias-brand-primary);
  /* Only the fill *shape* animates; a threshold change flips the color instantly,
     because a status change should read as a state, not as a fade. */
  transition: transform var(--dbh-dur-slow) var(--dbh-ease);
}
.dbh-fill[data-tone="success"] { background: var(--dsw-alias-state-success-primary); }
.dbh-fill[data-tone="warn"] { background: var(--dsw-alias-state-warn-primary); }
.dbh-fill[data-tone="error"] { background: var(--dsw-alias-state-error-primary); }

/* ── chips ──────────────────────────────────────────────────────────── */
.dbh-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}
.dbh-chip[data-tone="success"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 42%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
  color: var(--dsw-alias-state-success-primary);
}
.dbh-chip[data-tone="warn"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 42%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
  color: var(--dsw-alias-state-warn-primary);
}
.dbh-chip[data-tone="error"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 46%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent);
  color: var(--dsw-alias-state-error-primary);
}

/* ── network pair ───────────────────────────────────────────────────── */
.dbh-net { display: inline-flex; align-items: baseline; gap: 8px; }
.dbh-net span { font-variant-numeric: tabular-nums; }
.dbh-net i {
  margin-right: 2px;
  font-style: normal;
  font-size: 9.5px;
  color: var(--dsw-alias-label-caption);
}

/* ── trajectory ─────────────────────────────────────────────────────── */
.dbh-tl { display: flex; flex-direction: column; }
.dbh-node {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 0;
}
.dbh-node::before {
  content: "";
  position: absolute;
  top: 11px;
  bottom: -11px;
  left: 4.5px;
  width: 1px;
  background: var(--dsw-alias-border-l2);
}
.dbh-node:last-child::before { display: none; }
.dbh-dot {
  position: relative;
  z-index: 1;
  flex: none;
  width: 6px;
  height: 6px;
  margin: 5px 0 0 2px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
  box-shadow: 0 0 0 3px var(--dsw-alias-bg-layer-1);
}
.dbh-node[data-status="ok"] .dbh-dot { background: var(--dsw-alias-brand-primary); }
.dbh-node[data-status="warn"] .dbh-dot { background: var(--dsw-alias-state-warn-primary); }
.dbh-node[data-status="error"] .dbh-dot { background: var(--dsw-alias-state-error-primary); }
.dbh-node[data-status="error"] .dbh-dot {
  box-shadow:
    0 0 0 3px var(--dsw-alias-bg-layer-1),
    0 0 0 5px color-mix(in srgb, var(--dsw-alias-state-error-primary) 22%, transparent);
}
.dbh-node-body { flex: 1 1 auto; min-width: 0; }
.dbh-node-label {
  overflow: hidden;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dbh-node[data-status="error"] .dbh-node-label { color: var(--dsw-alias-state-error-primary); }
.dbh-node[data-status="warn"] .dbh-node-label { color: var(--dsw-alias-label-primary); }
.dbh-node-meta {
  flex: none;
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-caption);
}
.dbh-node[data-status="error"] .dbh-node-meta { color: var(--dsw-alias-state-error-primary); }
.dbh-node[data-status="warn"] .dbh-node-meta { color: var(--dsw-alias-state-warn-primary); }

/* typewriter caret: the only text-mutating motion in the plugin */
.dbh-node-label { contain: layout style; }
.dbh-caret {
  display: inline-block;
  width: 5px;
  height: 10px;
  margin-left: 2px;
  border-radius: 1px;
  background: var(--dsw-alias-brand-primary);
  vertical-align: -1px;
  animation: dbh-blink 1.05s steps(1, end) infinite;
}

/* ── sky: near-field drifting stars ─────────────────────────────────── */
/* Frame-wide, behind the panel, and never in the way of the UI underneath.
   Doubled class keeps pointer-events: none ahead of the host rule that hands
   every overlay entry pointer events. */
.dbh-sky.dbh-sky {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.dbh-star {
  position: absolute;
  border-radius: 50%;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 82%, transparent);
  box-shadow: 0 0 4px color-mix(in srgb, var(--dsw-alias-brand-primary) 34%, transparent);
  animation-name: dbh-drift, dbh-twinkle;
  animation-timing-function: ease-in-out, ease-in-out;
  animation-iteration-count: infinite, infinite;
  will-change: transform, opacity;
}

/* ── motion ─────────────────────────────────────────────────────────── */
@keyframes dbh-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes dbh-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .38; }
}
@keyframes dbh-drift {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(var(--dbh-dx, 10px), var(--dbh-dy, -12px), 0); }
}
@keyframes dbh-twinkle {
  0%, 100% { opacity: .25; }
  50% { opacity: .95; }
}
@keyframes dbh-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.dbh-rise { animation: dbh-rise var(--dbh-dur-enter) var(--dbh-ease) both; }

@media (prefers-reduced-motion: reduce) {
  .dbh-panel,
  .dbh-panel *,
  .dbh-panel *::before,
  .dbh-panel *::after,
  .dbh-sky,
  .dbh-sky *,
  .dbh-step,
  .dbh-step *,
  .dbh-gal,
  .dbh-gal *,
  .dbh-gal-backdrop {
    animation: none !important;
    transition: none !important;
  }
  .dbh-body[data-closing="true"] { opacity: 0; transform: none; }
  /* Reduced motion keeps the sky, just still. */
  .dbh-star { opacity: .55; }
}

@media (max-width: 960px) {
  .dbh-panel { right: 10px; width: 264px; bottom: var(--dbh-dock-bottom, 150px); }
}

/* ── markdown body (assistant text inside the takeover) ─────────────── */
.dbh-md { display: flex; flex-direction: column; gap: 8px; font-size: 13px; line-height: 1.65; }
.dbh-md > :first-child { margin-top: 0; }
.dbh-md > :last-child { margin-bottom: 0; }
.dbh-md-p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.dbh-md-h {
  margin: 4px 0 0;
  font-size: 13.5px;
  font-weight: 650;
  letter-spacing: .01em;
  color: var(--dsw-alias-label-primary);
}
.dbh-md-code {
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--dsw-alias-markdown-inline-code);
  font-family: var(--dsw-code-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
}
.dbh-md-pre {
  position: relative;
  margin: 0;
  padding: 9px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-markdown-code-block);
  overflow-x: auto;
  font-family: var(--dsw-code-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.55;
  color: var(--dsw-alias-label-primary);
  white-space: pre;
}
.dbh-md-lang {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 9.5px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-caption);
}
.dbh-md-quote {
  margin: 0;
  padding: 2px 0 2px 10px;
  border-left: 2px solid var(--dsw-alias-border-l3);
  color: var(--dsw-alias-label-secondary);
}
.dbh-md-list { margin: 0; padding-left: 18px; }
.dbh-md-list li { margin: 2px 0; }
.dbh-md-rule { margin: 2px 0; border: 0; border-top: 1px solid var(--dsw-alias-border-l2); }
.dbh-md-a { color: var(--dsw-alias-link); text-decoration: underline; text-underline-offset: 2px; }


/* ── footer entry to the gallery ────────────────────────────────────── */
.dbh-foot { display: flex; justify-content: flex-end; padding-top: 2px; }
.dbh-foot-btn {
  padding: 3px 9px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  letter-spacing: .04em;
  cursor: pointer;
  appearance: none;
}
.dbh-foot-btn:hover { border-color: var(--dsw-alias-border-l3); color: var(--dsw-alias-label-primary); }
.dbh-foot-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }

/* ── data-flow gallery ──────────────────────────────────────────────── */
.dbh-gal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  pointer-events: auto;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 72%, transparent);
  animation: dbh-gal-fade var(--dbh-dur) var(--dbh-ease) both;
}
.dbh-gal {
  display: flex;
  flex-direction: column;
  width: min(1080px, 100%);
  height: min(680px, 100%);
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow:
    0 32px 80px -32px color-mix(in srgb, var(--dsw-alias-bg-base) 95%, transparent),
    0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
  font-family: var(--dsw-font-family, system-ui, sans-serif);
  color: var(--dsw-alias-label-primary);
  animation: dbh-gal-pop var(--dbh-dur-enter) var(--dbh-ease) both;
}
.dbh-gal-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: linear-gradient(180deg, var(--dsw-alias-bg-layer-2), var(--dsw-alias-bg-layer-1));
}
.dbh-gal-title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.dbh-gal-close {
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  appearance: none;
}
.dbh-gal-close:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.dbh-gal-close:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dbh-gal-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 1px;
  background: var(--dsw-alias-border-l1);
}
.dbh-gal-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  padding: 12px 14px 14px;
  background: var(--dsw-alias-bg-layer-1);
}
.dbh-gal-pane-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}
.dbh-gal-pane-note {
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: .04em;
  text-transform: none;
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}
.dbh-gal-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  flex: 1;
  min-height: 90px;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.dbh-gal-bar {
  position: relative;
  flex: 1 1 0;
  height: 100%;
  display: flex;
  align-items: flex-end;
  transform-origin: 50% 100%;
}
.dbh-gal-bar-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 2px 2px 0 0;
  transform-origin: 50% 100%;
  transition: transform var(--dbh-dur-slow) var(--dbh-ease);
  /* input below the split, output above it */
  background: linear-gradient(
    to top,
    var(--dsw-alias-brand-primary) 0,
    var(--dsw-alias-brand-primary) var(--dbh-split, 50%),
    var(--dsw-alias-state-business-primary) var(--dbh-split, 50%),
    var(--dsw-alias-state-business-primary) 100%
  );
}
.dbh-gal-legend {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: var(--dsw-alias-label-caption);
}
.dbh-gal-legend span { display: inline-flex; align-items: center; gap: 5px; }
.dbh-gal-key { width: 8px; height: 8px; border-radius: 2px; }
.dbh-gal-key[data-kind="in"] { background: var(--dsw-alias-brand-primary); }
.dbh-gal-key[data-kind="out"] { background: var(--dsw-alias-state-business-primary); }
.dbh-gal-curve {
  position: relative;
  flex: 1;
  min-height: 120px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
  overflow: hidden;
}
.dbh-gal-curve svg { width: 100%; height: 100%; display: block; }
.dbh-gal-line {
  fill: none;
  stroke: var(--dsw-alias-brand-primary);
  stroke-width: 1.6;
  vector-effect: non-scaling-stroke;
}
.dbh-gal-th { stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
.dbh-gal-th[data-tone="warn"] { stroke: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, transparent); }
.dbh-gal-th[data-tone="error"] { stroke: color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent); }
.dbh-gal-th-labels {
  position: absolute;
  top: 4px;
  left: 8px;
  display: flex;
  gap: 8px;
  font-size: 9px;
  color: var(--dsw-alias-label-caption);
}
.dbh-gal-th-labels span:first-child { color: var(--dsw-alias-state-error-primary); }
.dbh-gal-th-labels span:last-child { color: var(--dsw-alias-state-warn-primary); }
.dbh-gal-chip {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 80%, transparent);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.dbh-gal-chip[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); }
.dbh-gal-chip[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
.dbh-gal-chip[data-tone="success"] { color: var(--dsw-alias-state-success-primary); }
.dbh-gal-stream {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  overscroll-behavior: contain;
}
.dbh-gal-stream::-webkit-scrollbar { width: 6px; }
.dbh-gal-stream::-webkit-scrollbar-thumb { border-radius: 3px; background: var(--dsw-alias-scrollbar-bg-l2); }
@keyframes dbh-gal-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dbh-gal-pop {
  from { opacity: 0; transform: translateY(12px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}


/* gallery stats strip */
.dbh-gal-stats {
  display: flex;
  gap: 14px;
  padding: 6px 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 10px;
  color: var(--dsw-alias-label-caption);
  letter-spacing: .04em;
}
.dbh-gal-stats span { display: inline-flex; align-items: baseline; gap: 4px; }
.dbh-gal-stats b {
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.dbh-gal-legend-time {
  margin-left: auto;
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}
.dbh-gal-bar[data-empty="true"] .dbh-gal-bar-fill {
  background: color-mix(in srgb, var(--dsw-alias-border-l3) 80%, transparent);
}
/* curve area fill + live point */
.dbh-gal-area {
  fill: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent);
}
.dbh-gal-grid-line {
  stroke: color-mix(in srgb, var(--dsw-alias-border-l1) 90%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.dbh-gal-point {
  position: absolute;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);
  animation: dbh-gal-pulse 2.4s ease-in-out infinite;
}
.dbh-gal-point[data-tone="warn"] { background: var(--dsw-alias-state-warn-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-warn-primary) 22%, transparent); }
.dbh-gal-point[data-tone="error"] { background: var(--dsw-alias-state-error-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-error-primary) 22%, transparent); }
@keyframes dbh-gal-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .55; transform: scale(1.45); }
}
.dbh-gal-window {
  font-size: 9.5px;
  letter-spacing: .06em;
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}

/* ── assistant-step takeover (trial) ────────────────────────────────── */
/* Rendered inside the host transcript, so it borrows the host's type scale and
   tokens instead of the panel's compact sizes. */
.dbh-step {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.6;
}
/* collapsible thought block */
.dbh-think {
  border-left: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
  border-radius: 0 8px 8px 0;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 70%, transparent);
}
.dbh-think-head {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  appearance: none;
}
.dbh-think-head:hover { color: var(--dsw-alias-label-primary); }
.dbh-think-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dbh-think-chev {
  flex: none;
  width: 6px;
  height: 6px;
  margin-bottom: 2px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
  transition: transform var(--dbh-dur) var(--dbh-ease);
}
.dbh-think[data-open="true"] .dbh-think-chev { transform: rotate(-135deg); }
.dbh-think-verb { font-weight: 600; letter-spacing: .04em; }
.dbh-think-meta {
  margin-left: auto;
  color: var(--dsw-alias-label-caption);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}
.dbh-think-body {
  padding: 0 10px 9px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  contain: layout style;
}
.dbh-think-preview {
  padding: 0 10px 8px;
  overflow: hidden;
  color: var(--dsw-alias-label-caption);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dbh-step-tool {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 12px;
  overflow: hidden;
}
.dbh-step-tool-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 5px 9px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  appearance: none;
}
.dbh-step-tool-head:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dbh-step-tool-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dbh-step-tool-chev {
  flex: none;
  width: 5px;
  height: 5px;
  margin-bottom: 2px;
  border-right: 1.4px solid var(--dsw-alias-label-tertiary);
  border-bottom: 1.4px solid var(--dsw-alias-label-tertiary);
  transform: rotate(45deg);
  transition: transform var(--dbh-dur) var(--dbh-ease);
}
.dbh-step-tool[data-open="true"] .dbh-step-tool-chev { transform: rotate(-135deg); }
.dbh-step-tool-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 9px 8px;
}
.dbh-step-tool-pre {
  margin: 0;
  max-height: 220px;
  padding: 7px 8px;
  overflow: auto;
  border-radius: 6px;
  background: var(--dsw-alias-markdown-code-block);
  font-family: var(--dsw-code-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.dbh-step-tool-out { color: var(--dsw-alias-label-primary); }
.dbh-step-tool-link {
  align-self: flex-start;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-link);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  appearance: none;
}
.dbh-step-tool-link:hover { text-decoration: underline; text-underline-offset: 2px; }
.dbh-step-tool-link:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dbh-step-tool-note { color: var(--dsw-alias-label-caption); font-size: 11px; }
.dbh-step-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-business-primary);
}
.dbh-step-tool-name {
  flex: none;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.dbh-step-tool-args {
  overflow: hidden;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dbh-step-note {
  padding: 6px 9px;
  border: 1px dashed var(--dsw-alias-border-l3);
  border-radius: 8px;
  color: var(--dsw-alias-label-caption);
  font-size: 12px;
}
`;
// src/client/theme.ts
/**
* Layer identity. One layer per source: unload (or a re-apply) removes exactly
* this layer, which is what makes "uninstall restores the UI" true.
*/
const OVERRIDE_SOURCE = "dsh-deepblue-hud";
/**
* Deep-blue palette as a theme token layer.
*
* Only **real** alias tokens are listed — a misspelled name is written to
* `<body>` but matches no CSS variable, so the theme degrades silently. Names
* verified against the 0.2.x token directory (`--dsw-alias-*`, 57 names, plus
* `--dsw-specific-sidebar-fill`).
*
* The composition follows the brief: ~60% deep navy surfaces, ~30% layered
* transitions, ~10% tidal-blue accent. Both schemes carry the same values: this
* is a deliberate re-skin, not a light-mode theme, and the `{ light, dark }`
* pair is still required by the runtime (a bare string throws).
*/
const pair = (value) => ({
	light: value,
	dark: value
});
/**
* Starfield background (experiment).
*
* This token is a **background value**, not a color: the app frame and the centre
* column both paint `background: var(--dsw-alias-bg-base)`, so a layered gradient
* here becomes a real, full-page starfield behind every panel. `fixed` attachment
* pins every layer to the viewport, which is what keeps several elements painting
* the same token seamless.
*
* The stars are generated, not tiled: one non-repeating gradient layer per star,
* positioned by a seeded PRNG so the sky is irregular and identical across
* reloads. (Tiling was the earlier version; with one star per tile the grid was
* visible no matter how the tile sizes were chosen.)
*
* Known collateral (accept or revert, it is one constant): the few consumers that
* need a *color* — `background-color:` and `color-mix(… var(--…bg-base) …)` — are
* invalidated, most visibly the composer seat's fade-to-background.
*/
/** Deterministic PRNG so the sky does not reshuffle on every reload. */
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
const STAR_COUNT = 90;
function buildStars() {
	const random = mulberry32(1592595255);
	const layers = ["radial-gradient(120% 70% at 50% -10%, rgb(56 189 248 / .07), transparent 62%) 0 0 / 100% 100% fixed no-repeat", "radial-gradient(70% 50% at 8% 105%, rgb(56 189 248 / .05), transparent 70%) 0 0 / 100% 100% fixed no-repeat"];
	for (let index = 0; index < STAR_COUNT; index += 1) {
		const x = (random() * 100).toFixed(2);
		const y = (random() * 100).toFixed(2);
		const size = (random() < .12 ? 1.5 + random() * 1.1 : .7 + random() * .7).toFixed(2);
		const alpha = (.22 + random() * .58).toFixed(2);
		const tint = random() < .2 ? "56 189 248" : "226 234 245";
		layers.push(`radial-gradient(${size}px ${size}px at ${x}% ${y}%, rgb(${tint} / ${alpha}) 50%, transparent 52%) 0 0 / 100% 100% fixed no-repeat`);
	}
	return layers.join(", ");
}
const DEEP_BLUE = {
	"--dsw-alias-bg-base": pair(`${buildStars()}, #0a1524`),
	"--dsw-alias-bg-module-platform": pair("#08111d"),
	"--dsw-alias-bg-mask-1": pair("rgb(3 8 15 / 0.66)"),
	"--dsw-specific-sidebar-fill": pair("#081320"),
	"--dsw-alias-bg-layer-1": pair("#101e31"),
	"--dsw-alias-bg-layer-2": pair("#16283f"),
	"--dsw-alias-bg-layer-3": pair("#1c3450"),
	"--dsw-alias-bg-layer-4": pair("#223d5d"),
	"--dsw-alias-bg-overlay": pair("#0e1b2c"),
	"--dsw-alias-interactive-bg-hover": pair("#16283f"),
	"--dsw-alias-interactive-bg-active": pair("#1c3450"),
	"--dsw-alias-menu-group-header-fill": pair("#0d1a2b"),
	"--dsw-alias-markdown-code-block": pair("#0c1826"),
	"--dsw-alias-markdown-inline-code": pair("#16283f"),
	"--dsw-alias-label-primary": pair("#e2eaf5"),
	"--dsw-alias-label-secondary": pair("#9db3d1"),
	"--dsw-alias-label-tertiary": pair("#7a92b3"),
	"--dsw-alias-label-caption": pair("#66799a"),
	"--dsw-alias-label-dimmed": pair("#556b8c"),
	"--dsw-alias-label-primary-foreground": pair("#06111d"),
	"--dsw-alias-label-error": pair("#ffa1a1"),
	"--dsw-alias-border-l1": pair("#17293f"),
	"--dsw-alias-border-l2": pair("#1f3754"),
	"--dsw-alias-border-l3": pair("#294669"),
	"--dsw-alias-border-l4": pair("#34577f"),
	"--dsw-alias-brand-primary": pair("#38bdf8"),
	"--dsw-alias-state-business-primary": pair("#38bdf8"),
	"--dsw-alias-link": pair("#7dd3fc"),
	"--dsw-alias-state-success-primary": pair("#34d399"),
	"--dsw-alias-state-success-tertiary": pair("#0f3d31"),
	"--dsw-alias-state-warn-primary": pair("#fbbf24"),
	"--dsw-alias-state-warn-label": pair("#fbbf24"),
	"--dsw-alias-state-warn-tertiary": pair("#3f3320"),
	"--dsw-alias-state-error-primary": pair("#f87171"),
	"--dsw-alias-state-idle-primary": pair("#5b7396"),
	"--dsw-alias-button-primary-fill": pair("#38bdf8"),
	"--dsw-alias-button-primary-hover": pair("#5cc9f9"),
	"--dsw-alias-button-ghost-active-fill": pair("#1c3450"),
	"--dsw-alias-button-ghost-active-border": pair("#294669"),
	"--dsw-alias-button-tool-bar-fill": pair("#101e31"),
	"--dsw-alias-button-tool-bar-hover": pair("#16283f"),
	"--dsw-alias-toast-bg": pair("#16283f"),
	"--dsw-alias-toast-label": pair("#e2eaf5"),
	"--dsw-alias-tooltip-bg": pair("#16283f"),
	"--dsw-alias-tooltip-key-bg": pair("#1c3450"),
	"--dsw-alias-scrollbar-bg-l2": pair("#1f3754"),
	"--dsw-alias-scrollbar-hover-l2": pair("#294669")
};
// src/client/index.ts
/** Package name; also the module id the loader registered and the CSS tag key. */
const PLUGIN_ID = "dsh-deepblue-hud";
/** The frame-wide slot the panel occupies: additive, above every column. */
const PANEL_SLOT = "shell.overlay";
/** A session-scoped seat, used only to reach the projection hooks. */
const COLLECTOR_SLOT = "conversation.input.dock";
/** Keyed Chat-node renderer replaced by the typing trial (see StepView.tsx). */
const CHAT_NODE_SLOT = "conversation.chat.node";
const CHAT_NODE_KEY = "assistant-step";
/** Cell ids; fresh ids add cells beside the shipped entries. */
const PANEL_ID = PLUGIN_ID;
const COLLECTOR_ID = `${PLUGIN_ID}.collector`;
const STEP_ID = `${PLUGIN_ID}.step`;
/**
* Services this Client half needs. Declared so the plugin stays inactive (and
* reports a missing-service diagnostic) instead of throwing on a composition
* without the slot registry or the theme service.
*/
const inject = ["slots", "theme"];
/**
* Client plugin body.
*
* Four registrations, all owned by the plugin fiber through `ctx.effect` /
* `ctx.slots.inject`, so unloading the plugin restores the page exactly:
*
* 1. a theme token layer (`overrideTokens`), one layer per source id;
* 2. a stylesheet node;
* 3. the `shell.overlay` panel;
* 4. a headless collector in a session-scoped slot, because session projections
*    are only reachable from inside a session seat.
*/
function apply(ctx) {
	ctx.effect(() => ctx.theme.overrideTokens(OVERRIDE_SOURCE, DEEP_BLUE), "deepblue-hud: token layer");
	ctx.effect(() => {
		const style = document.createElement("style");
		style.dataset.plugin = PLUGIN_ID;
		style.dataset.pluginCss = `${PLUGIN_ID}/panel.css`;
		style.textContent = PANEL_CSS;
		document.head.appendChild(style);
		return () => {
			style.remove();
		};
	}, "deepblue-hud: stylesheet");
	ctx.slots.inject(COLLECTOR_SLOT, () => ctx.slots.register({
		name: COLLECTOR_SLOT,
		id: COLLECTOR_ID,
		order: 40,
		registrant: PLUGIN_ID
	}, SessionDock));
	ctx.slots.inject(CHAT_NODE_SLOT, () => ctx.slots.register({
		name: CHAT_NODE_SLOT,
		key: CHAT_NODE_KEY,
		priority: -1,
		registrant: STEP_ID
	}, AssistantStepView));
	ctx.slots.inject(PANEL_SLOT, () => ctx.slots.register({
		name: PANEL_SLOT,
		id: PANEL_ID,
		order: 60,
		label: "Cockpit",
		registrant: PLUGIN_ID
	}, Cockpit));
}
exports.AssistantStepView = AssistantStepView;
exports.Gallery = Gallery;
exports.Markdown = Markdown;
exports.apply = apply;
exports.buildLiveSnapshot = buildLiveSnapshot;
exports.findToolResult = findToolResult;
exports.inject = inject;
exports.mapActivity = mapActivity;
exports.parseBlocks = parseBlocks;
exports.prettyArgs = prettyArgs;


		return module.exports;
	}
});

//# sourceMappingURL=client.js.map